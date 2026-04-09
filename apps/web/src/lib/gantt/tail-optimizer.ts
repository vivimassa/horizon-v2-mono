/**
 * Tail Assignment Optimizer — Greedy + Simulated Annealing
 * Ported from Horizon V1 and adapted for V2 GanttFlight/GanttAircraft types.
 *
 * Phase 1: Greedy chain-preferring assignment (instant)
 * Phase 2: Simulated annealing refinement (configurable time budget)
 *
 * Strategies:
 *  - minimize: tight rotations, strict station continuity
 *  - balance:  even utilization across aircraft
 *  - fuel:     minimize total fuel consumption (may break chains)
 */

import type { GanttFlight, GanttAircraft, GanttAircraftType } from './types'

// ── Public types ──────────────────────────────────────────────

export type OptimizerPreset = 'quick' | 'normal' | 'deep'
export type OptimizerMethod = 'minimize' | 'balance' | 'fuel'

export interface OptimizerConfig {
  preset: OptimizerPreset
  method: OptimizerMethod
}

export interface OptimizerProgress {
  phase: 'greedy' | 'sa'
  /** 0–100 */
  percent: number
  /** Current cost (SA phase) */
  cost: number
  /** Best cost found so far (SA phase) */
  bestCost: number
  /** Elapsed ms */
  elapsedMs: number
  stats: OptimizerStats
}

export interface OptimizerStats {
  totalFlights: number
  assigned: number
  overflow: number
  chainBreaks: number
  /** Fuel mode only — estimated total fuel burn in kg */
  totalFuelKg?: number
  /** Fuel mode only — baseline fuel burn (minimize-gaps assignment) in kg */
  baselineFuelKg?: number
  /** Fuel mode only — savings percentage vs baseline */
  fuelSavingsPercent?: number
}

export interface ChainBreak {
  flightId: string
  prevArr: string
  nextDep: string
}

/** Per-aircraft-type breakdown for the summary report */
export interface TypeBreakdown {
  icaoType: string
  typeName: string
  totalFlights: number
  assigned: number
  overflow: number
  totalBlockHours: number
  aircraftCount: number
  /** Average block hours per aircraft per day */
  avgBhPerDay: number
}

export interface OptimizerResult {
  /** Map: flightId → registration */
  assignments: Map<string, string>
  overflow: GanttFlight[]
  chainBreaks: ChainBreak[]
  stats: OptimizerStats
  /** Per-AC-type breakdown */
  typeBreakdown: TypeBreakdown[]
  elapsedMs: number
}

// ── SA presets ────────────────────────────────────────────────

const SA_PRESETS: Record<OptimizerPreset, {
  timeBudgetMs: number; initialTemp: number; coolingRate: number
}> = {
  quick:  { timeBudgetMs: 5_000,  initialTemp: 5000,  coolingRate: 0.999  },
  normal: { timeBudgetMs: 15_000, initialTemp: 8000,  coolingRate: 0.9995 },
  deep:   { timeBudgetMs: 30_000, initialTemp: 10000, coolingRate: 0.9998 },
}

// ── SA cost weights ──────────────────────────────────────────

const COST_OVERFLOW          = 50_000
const COST_CHAIN_BREAK       = 5_000
const COST_CHAIN_BREAK_FUEL  = 500     // Relaxed — accept chain breaks for fuel savings
const COST_TAT_VIOLATION     = 3_000
const COST_IDLE_PER_HOUR     = 200
const COST_UTIL_BALANCE      = 10
const COST_FUEL_PER_KG       = 1       // 1:1 — fuel kg IS the cost unit in fuel mode

// ── Internal types ───────────────────────────────────────────

interface FlightBlock {
  id: string
  flights: GanttFlight[]
  icaoType: string
  startMs: number
  endMs: number
  depStation: string
  arrStation: string
  pinnedReg: string | null
}

interface AircraftSlot {
  registration: string
  icaoType: string
  windows: { start: number; end: number; dep: string; arr: string }[]
  lastArr: string | null
  lastEnd: number
  totalBlockMs: number
}

// ── Helpers ──────────────────────────────────────────────────

function getTatMs(types: GanttAircraftType[], icao: string): number {
  const t = types.find(t => t.icaoType === icao)
  return (t?.tatDefaultMinutes ?? 30) * 60_000
}

/** Build per-registration fuel burn rate map (kg/hr). Falls back to type average, then 0. */
function buildBurnRateMap(
  aircraft: GanttAircraft[],
  aircraftTypes: GanttAircraftType[],
): Map<string, number> {
  const rates = new Map<string, number>()

  // Compute per-type averages from registrations that have rates
  const typeRates = new Map<string, number[]>()
  for (const ac of aircraft) {
    const icao = ac.aircraftTypeIcao ?? 'UNKN'
    if (ac.fuelBurnRateKgPerHour != null && ac.fuelBurnRateKgPerHour > 0) {
      const list = typeRates.get(icao) ?? []
      list.push(ac.fuelBurnRateKgPerHour)
      typeRates.set(icao, list)
    }
  }
  // Fill gaps from AircraftType-level data
  for (const t of aircraftTypes) {
    if (!typeRates.has(t.icaoType) && t.fuelBurnRateKgPerHour != null && t.fuelBurnRateKgPerHour > 0) {
      typeRates.set(t.icaoType, [t.fuelBurnRateKgPerHour])
    }
  }
  const typeAvg = new Map<string, number>()
  for (const [icao, vals] of typeRates) {
    typeAvg.set(icao, vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  // Assign each registration a rate
  for (const ac of aircraft) {
    const icao = ac.aircraftTypeIcao ?? 'UNKN'
    const rate = ac.fuelBurnRateKgPerHour ?? typeAvg.get(icao) ?? 0
    rates.set(ac.registration, rate)
  }
  return rates
}

function buildBlocks(flights: GanttFlight[]): FlightBlock[] {
  const rotationMap = new Map<string, GanttFlight[]>()
  const singles: GanttFlight[] = []

  for (const f of flights) {
    if (f.rotationId) {
      const list = rotationMap.get(f.rotationId) ?? []
      list.push(f)
      rotationMap.set(f.rotationId, list)
    } else {
      singles.push(f)
    }
  }

  const blocks: FlightBlock[] = []

  for (const [rotId, legs] of rotationMap) {
    legs.sort((a, b) => (a.rotationSequence ?? 0) - (b.rotationSequence ?? 0) || a.stdUtc - b.stdUtc)
    const first = legs[0], last = legs[legs.length - 1]
    blocks.push({
      id: `rot_${rotId}`,
      flights: legs,
      icaoType: first.aircraftTypeIcao ?? 'UNKN',
      startMs: first.stdUtc,
      endMs: last.staUtc,
      depStation: first.depStation,
      arrStation: last.arrStation,
      pinnedReg: legs.find(f => f.aircraftReg)?.aircraftReg ?? null,
    })
  }

  for (const f of singles) {
    blocks.push({
      id: `flt_${f.id}`,
      flights: [f],
      icaoType: f.aircraftTypeIcao ?? 'UNKN',
      startMs: f.stdUtc,
      endMs: f.staUtc,
      depStation: f.depStation,
      arrStation: f.arrStation,
      pinnedReg: f.aircraftReg,
    })
  }

  blocks.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  return blocks
}

function canFitBlock(slot: AircraftSlot, block: FlightBlock, tatMs: number): boolean {
  for (const w of slot.windows) {
    if (block.startMs < w.end + tatMs && w.start < block.endMs + tatMs) return false
  }
  return true
}

function recordBlock(slot: AircraftSlot, block: FlightBlock) {
  slot.windows.push({ start: block.startMs, end: block.endMs, dep: block.depStation, arr: block.arrStation })
  if (block.endMs > slot.lastEnd) {
    slot.lastEnd = block.endMs
    slot.lastArr = block.arrStation
  }
  slot.totalBlockMs += block.endMs - block.startMs
}

// ── Phase 1: Greedy assignment ──────────────────────────────

function greedyAssign(
  flights: GanttFlight[],
  aircraft: GanttAircraft[],
  aircraftTypes: GanttAircraftType[],
  method: OptimizerMethod,
  burnRates: Map<string, number> | null = null,
): { assignments: Map<string, string>; overflow: GanttFlight[]; chainBreaks: ChainBreak[]; slots: Map<string, AircraftSlot> } {
  const assignments = new Map<string, string>()
  const overflow: GanttFlight[] = []
  const chainBreaks: ChainBreak[] = []

  const allBlocks = buildBlocks(flights)

  // Group aircraft by type
  const acByType = new Map<string, GanttAircraft[]>()
  for (const ac of aircraft) {
    const type = ac.aircraftTypeIcao ?? 'UNKN'
    const list = acByType.get(type) ?? []
    list.push(ac)
    acByType.set(type, list)
  }

  // Init slots
  const slots = new Map<string, AircraftSlot>()
  for (const ac of aircraft) {
    slots.set(ac.registration, {
      registration: ac.registration,
      icaoType: ac.aircraftTypeIcao ?? 'UNKN',
      windows: [],
      lastArr: null,
      lastEnd: 0,
      totalBlockMs: 0,
    })
  }

  // Group blocks by type
  const blocksByType = new Map<string, FlightBlock[]>()
  for (const block of allBlocks) {
    const list = blocksByType.get(block.icaoType) ?? []
    list.push(block)
    blocksByType.set(block.icaoType, list)
  }

  for (const [icaoType, typeBlocks] of blocksByType) {
    const regs = acByType.get(icaoType)
    if (!regs || regs.length === 0) {
      for (const b of typeBlocks) overflow.push(...b.flights.filter(f => !f.aircraftReg))
      continue
    }
    const tatMs = getTatMs(aircraftTypes, icaoType)

    const pinned = typeBlocks.filter(b => b.pinnedReg)
    const free = typeBlocks.filter(b => !b.pinnedReg)

    // Step 1: Record pinned blocks
    for (const block of pinned) {
      const reg = block.pinnedReg!
      const slot = slots.get(reg)
      if (!slot) continue
      for (const f of block.flights) assignments.set(f.id, reg)
      recordBlock(slot, block)
    }

    // Step 2: Main pass
    const deferred: FlightBlock[] = []
    for (const block of free) {
      let bestReg: string | null = null
      let bestPriority = 99
      let bestGap = Infinity
      let bestScore = -Infinity

      for (const ac of regs) {
        const slot = slots.get(ac.registration)!
        if (!canFitBlock(slot, block, tatMs)) continue

        const sameStation = slot.lastArr === block.depStation
        const isIdle = slot.lastArr === null

        if (method === 'fuel') {
          // ── Fuel mode: score by burn rate × block time ──
          // Does NOT defer on station mismatch — all candidates in single pass
          const blockHours = (block.endMs - block.startMs) / 3_600_000
          const rate = burnRates?.get(ac.registration) ?? 0
          let score = -(blockHours * rate)
          if (sameStation && !isIdle) score += 100
          else if (isIdle) score += 50

          if (score > bestScore) { bestScore = score; bestReg = ac.registration }

        } else if (method === 'balance') {
          if (!sameStation && !isIdle) { continue }
          const priority = sameStation && !isIdle ? 1 : 2
          const gap = sameStation && !isIdle ? block.startMs - slot.lastEnd : Infinity
          const score = -slot.totalBlockMs * 2 + (sameStation ? 500 : 0) + (isIdle ? 300 : 0)
          if (priority < bestPriority || (priority === bestPriority && score > bestScore)) {
            bestPriority = priority; bestScore = score; bestGap = gap; bestReg = ac.registration
          }

        } else {
          // minimize
          if (!sameStation && !isIdle) { continue }
          const priority = sameStation && !isIdle ? 1 : 2
          const gap = sameStation && !isIdle ? block.startMs - slot.lastEnd : Infinity
          if (priority < bestPriority || (priority === bestPriority && gap < bestGap)) {
            bestPriority = priority; bestGap = gap; bestReg = ac.registration
          }
        }
      }

      if (bestReg) {
        // Track chain breaks for fuel mode (inline, not deferred)
        if (method === 'fuel') {
          const slot = slots.get(bestReg)!
          if (slot.lastArr && slot.lastArr !== block.depStation) {
            chainBreaks.push({ flightId: block.flights[0].id, prevArr: slot.lastArr, nextDep: block.depStation })
          }
        }
        for (const f of block.flights) assignments.set(f.id, bestReg)
        recordBlock(slots.get(bestReg)!, block)
      } else {
        deferred.push(block)
      }
    }

    // Step 3: Recovery pass — allow chain breaks (for minimize/balance deferred blocks + fuel overflow)
    for (const block of deferred) {
      let bestReg: string | null = null
      let bestScore = -Infinity

      for (const ac of regs) {
        const slot = slots.get(ac.registration)!
        if (!canFitBlock(slot, block, tatMs)) continue

        const sameStation = slot.lastArr === block.depStation
        const isIdle = slot.lastArr === null
        let score = 0

        if (method === 'fuel') {
          const blockHours = (block.endMs - block.startMs) / 3_600_000
          const rate = burnRates?.get(ac.registration) ?? 0
          score = -(blockHours * rate)
          if (sameStation && !isIdle) score += 100
          else if (isIdle) score += 50
        } else {
          if (sameStation && !isIdle) score = 1000
          else if (isIdle) score = 500
          else score = 0
          if (method === 'balance') score -= slot.totalBlockMs / 60_000
        }

        if (score > bestScore) { bestScore = score; bestReg = ac.registration }
      }

      if (bestReg) {
        const slot = slots.get(bestReg)!
        if (slot.lastArr && slot.lastArr !== block.depStation) {
          chainBreaks.push({ flightId: block.flights[0].id, prevArr: slot.lastArr, nextDep: block.depStation })
        }
        for (const f of block.flights) assignments.set(f.id, bestReg)
        recordBlock(slot, block)
      } else {
        overflow.push(...block.flights)
      }
    }
  }

  return { assignments, overflow, chainBreaks, slots }
}

// ── Phase 2: Simulated Annealing ────────────────────────────

function computeCost(
  assignments: Map<string, string>,
  flights: GanttFlight[],
  aircraft: GanttAircraft[],
  aircraftTypes: GanttAircraftType[],
  method: OptimizerMethod,
  burnRates: Map<string, number> | null,
): { cost: number; chainBreaks: number; overflowCount: number; totalFuelKg: number } {
  let cost = 0
  let chainBreakCount = 0
  let totalFuelKg = 0
  const overflowCount = flights.filter(f => !f.aircraftReg && !assignments.has(f.id)).length
  cost += overflowCount * COST_OVERFLOW

  const byReg = new Map<string, GanttFlight[]>()
  for (const f of flights) {
    const reg = f.aircraftReg ?? assignments.get(f.id)
    if (!reg) continue
    const list = byReg.get(reg) ?? []
    list.push(f)
    byReg.set(reg, list)
  }

  const utilizations: number[] = []
  const chainBreakPenalty = method === 'fuel' ? COST_CHAIN_BREAK_FUEL : COST_CHAIN_BREAK

  for (const [reg, regFlights] of byReg) {
    regFlights.sort((a, b) => a.stdUtc - b.stdUtc)
    let totalBlock = 0
    const regBurnRate = burnRates?.get(reg) ?? 0

    for (let i = 0; i < regFlights.length; i++) {
      const f = regFlights[i]
      const blockMs = f.staUtc - f.stdUtc
      totalBlock += blockMs

      // Fuel accumulation
      if (burnRates) {
        totalFuelKg += (blockMs / 3_600_000) * regBurnRate
      }

      if (i > 0) {
        const prev = regFlights[i - 1]
        if (prev.arrStation !== f.depStation) {
          cost += chainBreakPenalty
          chainBreakCount++
        }
        const ac = aircraft.find(a => a.registration === reg)
        const tatMs = getTatMs(aircraftTypes, ac?.aircraftTypeIcao ?? '')
        const gap = f.stdUtc - prev.staUtc
        if (gap < tatMs && gap >= 0) {
          cost += COST_TAT_VIOLATION
        }
        const gapHours = gap / 3_600_000
        if (gapHours > 6) {
          cost += (gapHours - 6) * COST_IDLE_PER_HOUR
        }
      }
    }
    utilizations.push(totalBlock)
  }

  // Utilization balance penalty (skip for fuel mode — not relevant)
  if (method !== 'fuel' && utilizations.length > 1) {
    const mean = utilizations.reduce((a, b) => a + b, 0) / utilizations.length
    const variance = utilizations.reduce((sum, u) => sum + (u - mean) ** 2, 0) / utilizations.length
    cost += Math.sqrt(variance) / 60_000 * COST_UTIL_BALANCE
  }

  // Fuel cost (fuel mode only)
  if (method === 'fuel' && burnRates) {
    cost += totalFuelKg * COST_FUEL_PER_KG
  }

  return { cost, chainBreaks: chainBreakCount, overflowCount, totalFuelKg }
}

async function runSA(
  greedyResult: { assignments: Map<string, string>; overflow: GanttFlight[] },
  flights: GanttFlight[],
  aircraft: GanttAircraft[],
  aircraftTypes: GanttAircraftType[],
  preset: OptimizerPreset,
  method: OptimizerMethod,
  burnRates: Map<string, number> | null,
  onProgress: (p: OptimizerProgress) => void,
  signal: AbortSignal,
): Promise<{ assignments: Map<string, string>; overflow: GanttFlight[] }> {
  const config = SA_PRESETS[preset]
  const startTime = Date.now()

  const current = new Map(greedyResult.assignments)
  let currentEval = computeCost(current, flights, aircraft, aircraftTypes, method, burnRates)
  let currentCost = currentEval.cost

  const best = new Map(current)
  let bestCost = currentCost

  let temp = config.initialTemp
  let iteration = 0

  const movableIds = flights.filter(f => !f.aircraftReg && current.has(f.id)).map(f => f.id)
  if (movableIds.length < 2) return { assignments: best, overflow: greedyResult.overflow }

  const acByType = new Map<string, string[]>()
  for (const ac of aircraft) {
    const type = ac.aircraftTypeIcao ?? 'UNKN'
    const list = acByType.get(type) ?? []
    list.push(ac.registration)
    acByType.set(type, list)
  }

  const flightMap = new Map(flights.map(f => [f.id, f]))

  while (Date.now() - startTime < config.timeBudgetMs) {
    if (signal.aborted) break

    iteration++
    temp *= config.coolingRate

    const moveType = Math.random() < 0.7 ? 'swap' : 'relocate'

    if (moveType === 'swap' && movableIds.length >= 2) {
      const idx1 = Math.floor(Math.random() * movableIds.length)
      let idx2 = Math.floor(Math.random() * (movableIds.length - 1))
      if (idx2 >= idx1) idx2++

      const fId1 = movableIds[idx1], fId2 = movableIds[idx2]
      const reg1 = current.get(fId1), reg2 = current.get(fId2)
      if (!reg1 || !reg2 || reg1 === reg2) continue

      const f1 = flightMap.get(fId1)!, f2 = flightMap.get(fId2)!
      if (f1.aircraftTypeIcao !== f2.aircraftTypeIcao) continue

      current.set(fId1, reg2)
      current.set(fId2, reg1)

      const newEval = computeCost(current, flights, aircraft, aircraftTypes, method, burnRates)
      const delta = newEval.cost - currentCost

      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        currentCost = newEval.cost
        currentEval = newEval
        if (currentCost < bestCost) {
          bestCost = currentCost
          for (const [k, v] of current) best.set(k, v)
        }
      } else {
        current.set(fId1, reg1)
        current.set(fId2, reg2)
      }
    } else {
      const fId = movableIds[Math.floor(Math.random() * movableIds.length)]
      const f = flightMap.get(fId)!
      const oldReg = current.get(fId)
      if (!oldReg) continue

      const typeRegs = acByType.get(f.aircraftTypeIcao ?? 'UNKN') ?? []
      if (typeRegs.length < 2) continue

      const newReg = typeRegs[Math.floor(Math.random() * typeRegs.length)]
      if (newReg === oldReg) continue

      current.set(fId, newReg)

      const newEval = computeCost(current, flights, aircraft, aircraftTypes, method, burnRates)
      const delta = newEval.cost - currentCost

      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        currentCost = newEval.cost
        currentEval = newEval
        if (currentCost < bestCost) {
          bestCost = currentCost
          for (const [k, v] of current) best.set(k, v)
        }
      } else {
        current.set(fId, oldReg)
      }
    }

    if (iteration % 200 === 0) {
      const elapsed = Date.now() - startTime
      const percent = Math.min(99, Math.round((elapsed / config.timeBudgetMs) * 100))
      const bestEval = computeCost(best, flights, aircraft, aircraftTypes, method, burnRates)
      onProgress({
        phase: 'sa',
        percent,
        cost: currentCost,
        bestCost,
        elapsedMs: elapsed,
        stats: {
          totalFlights: flights.length,
          assigned: best.size,
          overflow: bestEval.overflowCount,
          chainBreaks: bestEval.chainBreaks,
        },
      })
      // Yield to event loop so React can re-render progress
      await new Promise(r => setTimeout(r, 0))
    }
  }

  const finalOverflow = flights.filter(f => !f.aircraftReg && !best.has(f.id))
  return { assignments: best, overflow: finalOverflow }
}

// ── Public API ───────────────────────────────────────────────

export async function runOptimizer(
  flights: GanttFlight[],
  aircraft: GanttAircraft[],
  aircraftTypes: GanttAircraftType[],
  config: OptimizerConfig,
  onProgress: (p: OptimizerProgress) => void,
  signal: AbortSignal,
): Promise<OptimizerResult> {
  const startTime = Date.now()
  const burnRates = config.method === 'fuel' ? buildBurnRateMap(aircraft, aircraftTypes) : null

  // Phase 1: Greedy
  onProgress({
    phase: 'greedy', percent: 0, cost: 0, bestCost: 0, elapsedMs: 0,
    stats: { totalFlights: flights.length, assigned: 0, overflow: 0, chainBreaks: 0 },
  })

  const greedy = greedyAssign(flights, aircraft, aircraftTypes, config.method, burnRates)

  const greedyEval = computeCost(greedy.assignments, flights, aircraft, aircraftTypes, config.method, burnRates)
  onProgress({
    phase: 'greedy', percent: 100, cost: greedyEval.cost, bestCost: greedyEval.cost,
    elapsedMs: Date.now() - startTime,
    stats: {
      totalFlights: flights.length,
      assigned: greedy.assignments.size,
      overflow: greedy.overflow.length,
      chainBreaks: greedy.chainBreaks.length,
    },
  })

  if (signal.aborted) {
    return buildResult(greedy.assignments, greedy.overflow, greedy.chainBreaks, flights, aircraft, aircraftTypes, config.method, burnRates, startTime)
  }

  await new Promise(r => setTimeout(r, 50))

  // Phase 2: Simulated Annealing
  onProgress({
    phase: 'sa', percent: 0, cost: greedyEval.cost, bestCost: greedyEval.cost,
    elapsedMs: Date.now() - startTime,
    stats: {
      totalFlights: flights.length,
      assigned: greedy.assignments.size,
      overflow: greedy.overflow.length,
      chainBreaks: greedy.chainBreaks.length,
    },
  })

  const sa = await runSA(greedy, flights, aircraft, aircraftTypes, config.preset, config.method, burnRates, onProgress, signal)

  const finalChainBreaks = computeChainBreaks(sa.assignments, flights)

  onProgress({
    phase: 'sa', percent: 100, cost: 0, bestCost: 0,
    elapsedMs: Date.now() - startTime,
    stats: {
      totalFlights: flights.length,
      assigned: sa.assignments.size,
      overflow: sa.overflow.length,
      chainBreaks: finalChainBreaks.length,
    },
  })

  return buildResult(sa.assignments, sa.overflow, finalChainBreaks, flights, aircraft, aircraftTypes, config.method, burnRates, startTime)
}

function computeChainBreaks(assignments: Map<string, string>, flights: GanttFlight[]): ChainBreak[] {
  const breaks: ChainBreak[] = []
  const byReg = new Map<string, GanttFlight[]>()

  for (const f of flights) {
    const reg = f.aircraftReg ?? assignments.get(f.id)
    if (!reg) continue
    const list = byReg.get(reg) ?? []
    list.push(f)
    byReg.set(reg, list)
  }

  for (const [, regFlights] of byReg) {
    regFlights.sort((a, b) => a.stdUtc - b.stdUtc)
    for (let i = 1; i < regFlights.length; i++) {
      if (regFlights[i - 1].arrStation !== regFlights[i].depStation) {
        breaks.push({
          flightId: regFlights[i].id,
          prevArr: regFlights[i - 1].arrStation,
          nextDep: regFlights[i].depStation,
        })
      }
    }
  }
  return breaks
}

function buildResult(
  assignments: Map<string, string>,
  overflow: GanttFlight[],
  chainBreaks: ChainBreak[],
  flights: GanttFlight[],
  aircraft: GanttAircraft[],
  aircraftTypes: GanttAircraftType[],
  method: OptimizerMethod,
  burnRates: Map<string, number> | null,
  startTime: number,
): OptimizerResult {
  const stats: OptimizerStats = {
    totalFlights: flights.length,
    assigned: assignments.size,
    overflow: overflow.length,
    chainBreaks: chainBreaks.length,
  }

  // Compute period days from flight date range
  let minMs = Infinity, maxMs = -Infinity
  for (const f of flights) {
    if (f.stdUtc < minMs) minMs = f.stdUtc
    if (f.staUtc > maxMs) maxMs = f.staUtc
  }
  const periodDays = flights.length > 0 ? Math.max(1, Math.ceil((maxMs - minMs) / 86_400_000)) : 1

  // Per-type breakdown
  const typeMap = new Map<string, TypeBreakdown>()
  for (const t of aircraftTypes) {
    typeMap.set(t.icaoType, {
      icaoType: t.icaoType, typeName: t.name,
      totalFlights: 0, assigned: 0, overflow: 0,
      totalBlockHours: 0,
      aircraftCount: aircraft.filter(a => a.aircraftTypeIcao === t.icaoType).length,
      avgBhPerDay: 0,
    })
  }
  for (const f of flights) {
    const icao = f.aircraftTypeIcao ?? 'UNKN'
    let entry = typeMap.get(icao)
    if (!entry) { entry = { icaoType: icao, typeName: icao, totalFlights: 0, assigned: 0, overflow: 0, totalBlockHours: 0, aircraftCount: 0, avgBhPerDay: 0 }; typeMap.set(icao, entry) }
    entry.totalFlights++
    const reg = f.aircraftReg ?? assignments.get(f.id)
    if (reg) { entry.assigned++; entry.totalBlockHours += f.blockMinutes / 60 }
    else entry.overflow++
  }
  // Calculate avg BH/day per aircraft
  for (const entry of typeMap.values()) {
    if (entry.aircraftCount > 0 && periodDays > 0) {
      entry.avgBhPerDay = Math.round((entry.totalBlockHours / entry.aircraftCount / periodDays) * 10) / 10
    }
  }
  const typeBreakdown = [...typeMap.values()].filter(t => t.totalFlights > 0).sort((a, b) => b.totalFlights - a.totalFlights)

  // Compute fuel stats for fuel mode
  if (method === 'fuel' && burnRates) {
    const fuelEval = computeCost(assignments, flights, aircraft, aircraftTypes, 'fuel', burnRates)
    stats.totalFuelKg = Math.round(fuelEval.totalFuelKg)

    // Baseline: what would minimize-gaps produce in fuel terms?
    const baselineGreedy = greedyAssign(flights, aircraft, aircraftTypes, 'minimize')
    const baselineEval = computeCost(baselineGreedy.assignments, flights, aircraft, aircraftTypes, 'fuel', burnRates)
    stats.baselineFuelKg = Math.round(baselineEval.totalFuelKg)

    stats.fuelSavingsPercent = stats.baselineFuelKg > 0
      ? Math.round((1 - stats.totalFuelKg / stats.baselineFuelKg) * 1000) / 10
      : 0
  }

  return {
    assignments,
    overflow,
    chainBreaks,
    stats,
    typeBreakdown,
    elapsedMs: Date.now() - startTime,
  }
}

// ── Serialization helpers (for DB persistence) ──────────────

/** Serialize an OptimizerResult for storage (Map → array, strip full flight objects) */
export function serializeResult(
  result: OptimizerResult,
  config: OptimizerConfig,
): {
  config: { preset: string; method: string }
  stats: OptimizerStats
  assignments: { flightId: string; registration: string }[]
  overflowFlightIds: string[]
  chainBreaks: ChainBreak[]
  typeBreakdown: TypeBreakdown[]
  elapsedMs: number
} {
  return {
    config: { preset: config.preset, method: config.method },
    stats: result.stats,
    assignments: [...result.assignments.entries()].map(([flightId, registration]) => ({ flightId, registration })),
    overflowFlightIds: result.overflow.map(f => f.id),
    chainBreaks: result.chainBreaks,
    typeBreakdown: result.typeBreakdown,
    elapsedMs: result.elapsedMs,
  }
}

/** Generate auto-name for an optimizer run */
export function generateRunName(config: OptimizerConfig): string {
  const methodLabels: Record<string, string> = { minimize: 'Minimize Gaps', balance: 'Balance Fleet', fuel: 'Fuel Efficient' }
  const presetLabels: Record<string, string> = { quick: 'Quick', normal: 'Normal', deep: 'Deep' }
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${methodLabels[config.method] ?? config.method} (${presetLabels[config.preset] ?? config.preset}) — ${dd} ${mon} ${hh}:${mm}`
}
