/**
 * Virtual tail assignment engine for Gantt chart display.
 * Client-side only — no database writes.
 *
 * Uses a chain-preferring greedy algorithm to place flights onto
 * available aircraft registrations.  The assignment unit is a
 * **route block**: all legs sharing the same routeId + operating date
 * are assigned atomically to the same aircraft.  Standalone flights
 * (no routeId) form single-flight blocks.
 *
 * Full overlap prevention: every new block is tested against ALL
 * existing assignments on an aircraft using absolute timestamps,
 * not just the most recent arrival.
 */

import {
  evaluateRules,
  evaluateBonus,
  type FlightForEval,
  type AircraftForEval,
  type RuleViolation,
  type RejectionReason,
  type ScheduleRule,
} from './schedule-rule-evaluator'

// Re-export types from tail-assignment for shared use
export type {
  AssignableFlight,
  AssignableAircraft,
  ChainBreak,
  TailAssignmentResult,
  AircraftTypeTAT,
} from './tail-assignment'

import type {
  AssignableFlight,
  AssignableAircraft,
  ChainBreak,
  TailAssignmentResult,
  AircraftTypeTAT,
} from './tail-assignment'
import { isFlightDomestic, resolveTatMs } from './tail-assignment'

// ─── Assignment block ────────────────────────────────────────

interface AssignmentBlock {
  id: string
  flights: AssignableFlight[] // sorted by date + STD
  icaoType: string
  /** If any flight in the block has aircraftReg, pin whole block */
  preAssignedReg: string | null
  /** Absolute start timestamp (ms) — first flight's departure */
  startMs: number
  /** Absolute end timestamp (ms) — last flight's arrival */
  endMs: number
}

// ─── Time window for overlap tracking ─────────────────────────

interface TimeWindow {
  startMs: number
  endMs: number
  depStation: string
  arrStation: string
  depRouteType: string | null
  arrRouteType: string | null
}

// ─── Aircraft state tracker ───────────────────────────────────

interface AircraftState {
  /** All assigned time windows — checked exhaustively for overlaps */
  windows: TimeWindow[]
  /** Minutes from midnight of the latest-ending assignment (for chain logic) */
  lastSTA: number | null
  /** date.getTime() of the latest-ending assignment (for chain logic) */
  lastSTADate: number | null
  /** Arrival station of the latest-ending assignment (for chain logic) */
  lastARR: string | null
  assignedFlights: AssignableFlight[]
}

// ─── Rule stats accumulator (mutable, shared across functions) ──

interface RuleStats {
  hardRulesEnforced: number
  softRulesBent: number
  totalPenaltyCost: number
}

// ─── Helpers ──────────────────────────────────────────────────

/** Convert date + minutes-from-midnight to absolute milliseconds. */
function toAbsoluteMs(date: Date, minutes: number): number {
  return date.getTime() + minutes * 60000
}

/**
 * Check if a block can fit on an aircraft without overlapping
 * any existing assignment (including TAT buffer).
 */
function canFitBlock(
  state: AircraftState,
  blockStartMs: number,
  blockEndMs: number,
  blockDepRouteType: string | null,
  blockArrRouteType: string | null,
  tatData: AircraftTypeTAT,
  useMinimum: boolean,
): boolean {
  for (const w of state.windows) {
    const tatAfterExisting = resolveTatMs(
      tatData,
      isFlightDomestic(w.arrRouteType),
      isFlightDomestic(blockDepRouteType),
      useMinimum,
    )
    const tatAfterBlock = resolveTatMs(
      tatData,
      isFlightDomestic(blockArrRouteType),
      isFlightDomestic(w.depRouteType),
      useMinimum,
    )

    if (blockStartMs < w.endMs + tatAfterExisting && w.startMs < blockEndMs + tatAfterBlock) {
      return false
    }
  }
  return true
}

function checkStationChain(state: AircraftState, block: AssignmentBlock): boolean {
  const blockDepStation = block.flights[0].depStation
  const blockArrStation = block.flights[block.flights.length - 1].arrStation

  let prevWindow: TimeWindow | null = null
  let prevEndMs = -Infinity
  for (const w of state.windows) {
    if (w.endMs <= block.startMs && w.endMs > prevEndMs) {
      prevWindow = w
      prevEndMs = w.endMs
    }
  }

  let nextWindow: TimeWindow | null = null
  let nextStartMs = Infinity
  for (const w of state.windows) {
    if (w.startMs >= block.endMs && w.startMs < nextStartMs) {
      nextWindow = w
      nextStartMs = w.startMs
    }
  }

  if (prevWindow && prevWindow.arrStation !== blockDepStation) {
    return false
  }

  if (nextWindow && blockArrStation !== nextWindow.depStation) {
    return false
  }

  return true
}

function validateBlockInternal(block: AssignmentBlock): boolean {
  for (let i = 0; i < block.flights.length - 1; i++) {
    const curr = block.flights[i]
    const next = block.flights[i + 1]
    const currEndMs = toAbsoluteMs(curr.date, curr.staMinutes)
    const nextStartMs = toAbsoluteMs(next.date, next.stdMinutes)
    if (nextStartMs < currEndMs) {
      console.warn(
        `Route ${block.id}: internal leg overlap — leg ends at ${curr.staMinutes}min but next starts at ${next.stdMinutes}min`,
      )
      return false
    }
  }
  return true
}

// ─── Block builder ───────────────────────────────────────────

function buildBlocks(flights: AssignableFlight[]): AssignmentBlock[] {
  const blockMap = new Map<string, AssignableFlight[]>()

  for (const f of flights) {
    let key: string
    if (f.routeId) {
      const baseDateMs = f.date.getTime() - f.dayOffset * 86400000
      const baseDate = new Date(baseDateMs).toISOString().slice(0, 10)
      key = `route_${f.routeId}_${baseDate}`
    } else {
      key = `standalone_${f.id}`
    }
    const list = blockMap.get(key) || []
    list.push(f)
    blockMap.set(key, list)
  }

  const blocks: AssignmentBlock[] = []
  Array.from(blockMap.entries()).forEach(([id, blockFlights]) => {
    blockFlights.sort((a: AssignableFlight, b: AssignableFlight) => {
      const da = a.date.getTime()
      const db = b.date.getTime()
      if (da !== db) return da - db
      return a.stdMinutes - b.stdMinutes
    })

    const first = blockFlights[0]
    const last = blockFlights[blockFlights.length - 1]

    blocks.push({
      id,
      flights: blockFlights,
      icaoType: blockFlights[0].aircraftTypeIcao || 'UNKN',
      preAssignedReg: blockFlights.find((f: AssignableFlight) => f.aircraftReg)?.aircraftReg || null,
      startMs: toAbsoluteMs(first.date, first.stdMinutes),
      endMs: toAbsoluteMs(last.date, last.staMinutes),
    })
  })

  return blocks
}

// ─── Main function ────────────────────────────────────────────

export function autoAssignFlights(
  flights: AssignableFlight[],
  aircraft: AssignableAircraft[],
  tatByType: Map<string, AircraftTypeTAT>,
  method: 'minimize' | 'balance' = 'minimize',
  rules: ScheduleRule[] = [],
  aircraftFamilies: Map<string, string> = new Map(),
  allowFamilySub: boolean = false,
  typeFamilyMap: Map<string, string> = new Map(),
  useMinimumTat: boolean = false,
  _chainContinuity: 'strict' | 'flexible' = 'flexible',
  _flightPriority: 'time' | 'coverage' = 'time',
  _maxFerryMinutes: number = 0,
  _cityPairBlockTimes?: Map<string, number>,
): TailAssignmentResult {
  const assignments = new Map<string, string>()
  const overflow: AssignableFlight[] = []
  const chainBreaks: ChainBreak[] = []
  const ruleViolations = new Map<string, RuleViolation[]>()
  const rejections = new Map<string, RejectionReason[]>()
  const stats = { hardRulesEnforced: 0, softRulesBent: 0, totalPenaltyCost: 0 }

  const allBlocks = buildBlocks(flights)

  const blocksByType = new Map<string, AssignmentBlock[]>()
  for (const block of allBlocks) {
    const list = blocksByType.get(block.icaoType) || []
    list.push(block)
    blocksByType.set(block.icaoType, list)
  }

  const aircraftByType = new Map<string, AssignableAircraft[]>()
  for (const ac of aircraft) {
    const list = aircraftByType.get(ac.icaoType) || []
    list.push(ac)
    aircraftByType.set(ac.icaoType, list)
  }

  const globalStates = new Map<string, AircraftState>()
  for (const ac of aircraft) {
    globalStates.set(ac.registration, {
      windows: [],
      lastSTA: null,
      lastSTADate: null,
      lastARR: null,
      assignedFlights: [],
    })
  }

  const recordAssignment = (block: AssignmentBlock, reg: string) => {
    for (const f of block.flights) {
      assignments.set(f.id, reg)
    }
    const st = globalStates.get(reg)
    if (st) {
      const firstFl = block.flights[0]
      const lastFlight = block.flights[block.flights.length - 1]
      st.windows.push({
        startMs: block.startMs,
        endMs: block.endMs,
        depStation: firstFl.depStation,
        arrStation: lastFlight.arrStation,
        depRouteType: firstFl.routeType,
        arrRouteType: lastFlight.routeType,
      })
      const currentLastEndMs =
        st.lastSTA !== null && st.lastSTADate !== null ? st.lastSTADate + st.lastSTA * 60000 : -Infinity
      if (block.endMs > currentLastEndMs) {
        st.lastSTA = lastFlight.staMinutes
        st.lastSTADate = lastFlight.date.getTime()
        st.lastARR = lastFlight.arrStation
      }
      st.assignedFlights.push(...block.flights)
    }
  }

  Array.from(blocksByType.entries()).forEach(([icaoType, typeBlocks]) => {
    const regs = aircraftByType.get(icaoType)
    if (!regs || regs.length === 0) {
      for (const block of typeBlocks) overflow.push(...block.flights)
      return
    }

    const tatData = tatByType.get(icaoType) ?? {
      sched_dd: null,
      sched_di: null,
      sched_id: null,
      sched_ii: null,
      min_dd: null,
      min_di: null,
      min_id: null,
      min_ii: null,
      default: 30,
    }

    const states = globalStates

    const pinnedBlocks: AssignmentBlock[] = []
    const freeBlocks: AssignmentBlock[] = []
    for (const block of typeBlocks) {
      if (block.preAssignedReg) {
        pinnedBlocks.push(block)
      } else {
        freeBlocks.push(block)
      }
    }

    pinnedBlocks.sort((a: AssignmentBlock, b: AssignmentBlock) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      return a.endMs - b.endMs
    })

    for (const block of pinnedBlocks) {
      const reg = block.preAssignedReg!
      const st = states.get(reg)

      if (st && st.lastARR && st.lastARR !== block.flights[0].depStation) {
        chainBreaks.push({
          flightId: block.flights[0].id,
          prevArr: st.lastARR,
          nextDep: block.flights[0].depStation,
        })
      }

      recordAssignment(block, reg)

      if (rules.length > 0) {
        const acForEval: AircraftForEval = {
          registration: reg,
          icaoType: icaoType,
          family: aircraftFamilies.get(reg) || null,
        }
        for (const f of block.flights) {
          const fEval: FlightForEval = {
            id: f.id,
            depStation: f.depStation,
            arrStation: f.arrStation,
            stdMinutes: f.stdMinutes,
            staMinutes: f.staMinutes,
            blockMinutes: f.staMinutes - f.stdMinutes,
            serviceType: f.serviceType || 'J',
            date: f.date,
            aircraftTypeIcao: f.aircraftTypeIcao,
          }
          const result = evaluateRules(fEval, acForEval, rules)
          if (result.violations.length > 0) {
            const existing = ruleViolations.get(f.id) || []
            ruleViolations.set(f.id, [...existing, ...result.violations])
            stats.softRulesBent += result.violations.filter((v) => v.enforcement === 'soft').length
            stats.hardRulesEnforced += result.violations.filter((v) => v.enforcement === 'hard').length
            stats.totalPenaltyCost += result.totalPenalty
          }
        }
      }
    }

    freeBlocks.sort((a: AssignmentBlock, b: AssignmentBlock) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      return a.endMs - b.endMs
    })

    for (const block of freeBlocks) {
      if (block.flights.length > 1 && !validateBlockInternal(block)) {
        overflow.push(...block.flights)
        continue
      }

      const firstFlight = block.flights[0]
      let bestReg: string | null

      if (method === 'balance') {
        bestReg = findBalancedAircraft(
          firstFlight,
          block,
          states,
          regs,
          tatData,
          useMinimumTat,
          chainBreaks,
          rules,
          aircraftFamilies,
          ruleViolations,
          rejections,
          stats,
        )
      } else {
        bestReg = findBestAircraft(
          firstFlight,
          block,
          states,
          regs,
          tatData,
          useMinimumTat,
          chainBreaks,
          rules,
          aircraftFamilies,
          ruleViolations,
          rejections,
          stats,
        )
      }

      if (bestReg) {
        recordAssignment(block, bestReg)
      } else {
        overflow.push(...block.flights)
      }
    }
  })

  // ── Family substitution pass ──────────────────────────────
  if (allowFamilySub && overflow.length > 0) {
    const overflowBlocks = buildBlocks(overflow)

    const familyToTypes = new Map<string, string[]>()
    for (const [icao, family] of Array.from(typeFamilyMap.entries())) {
      const list = familyToTypes.get(family) || []
      if (!list.includes(icao)) list.push(icao)
      familyToTypes.set(family, list)
    }

    overflow.length = 0

    for (const block of overflowBlocks) {
      const blockFamily = typeFamilyMap.get(block.icaoType)
      if (!blockFamily) {
        overflow.push(...block.flights)
        continue
      }

      const siblingTypes = (familyToTypes.get(blockFamily) || []).filter((t) => t !== block.icaoType)

      if (siblingTypes.length === 0) {
        overflow.push(...block.flights)
        continue
      }

      const siblingRegs: AssignableAircraft[] = []
      for (const sibType of siblingTypes) {
        const regs = aircraftByType.get(sibType)
        if (regs) siblingRegs.push(...regs)
      }

      if (siblingRegs.length === 0) {
        overflow.push(...block.flights)
        continue
      }

      let sibTatData: AircraftTypeTAT = {
        sched_dd: null,
        sched_di: null,
        sched_id: null,
        sched_ii: null,
        min_dd: null,
        min_di: null,
        min_id: null,
        min_ii: null,
        default: 30,
      }
      for (const sibType of siblingTypes) {
        const td = tatByType.get(sibType)
        if (td) {
          sibTatData = td
          break
        }
      }

      const firstFlight = block.flights[0]
      let bestReg: string | null

      if (method === 'balance') {
        bestReg = findBalancedAircraft(
          firstFlight,
          block,
          globalStates,
          siblingRegs,
          sibTatData,
          useMinimumTat,
          chainBreaks,
          rules,
          aircraftFamilies,
          ruleViolations,
          rejections,
          stats,
        )
      } else {
        bestReg = findBestAircraft(
          firstFlight,
          block,
          globalStates,
          siblingRegs,
          sibTatData,
          useMinimumTat,
          chainBreaks,
          rules,
          aircraftFamilies,
          ruleViolations,
          rejections,
          stats,
        )
      }

      if (bestReg) {
        recordAssignment(block, bestReg)
      } else {
        overflow.push(...block.flights)
      }
    }
  }

  return {
    assignments,
    overflow,
    chainBreaks,
    ruleViolations,
    rejections,
    summary: {
      totalFlights: flights.length,
      assigned: assignments.size,
      overflowed: overflow.length,
      hardRulesEnforced: stats.hardRulesEnforced,
      softRulesBent: stats.softRulesBent,
      totalPenaltyCost: stats.totalPenaltyCost,
    },
  }
}

// ─── Priority-based aircraft selection ────────────────────────

function findBestAircraft(
  firstFlight: AssignableFlight,
  block: AssignmentBlock,
  states: Map<string, AircraftState>,
  regs: AssignableAircraft[],
  tatData: AircraftTypeTAT,
  useMinimum: boolean,
  chainBreaks: ChainBreak[],
  rules: ScheduleRule[],
  aircraftFamilies: Map<string, string>,
  ruleViolations: Map<string, RuleViolation[]>,
  rejections: Map<string, RejectionReason[]>,
  stats: RuleStats,
): string | null {
  interface Candidate {
    reg: string
    priority: 1 | 2 | 3
    gap: number
    softPenalty: number
    violations: RuleViolation[]
    bonus: number
  }

  const candidates: Candidate[] = []
  const firstFlightDateMs = firstFlight.date.getTime()

  for (const ac of regs) {
    const st = states.get(ac.registration)!

    const blockDepRouteType = block.flights[0].routeType
    const blockArrRouteType = block.flights[block.flights.length - 1].routeType

    if (!canFitBlock(st, block.startMs, block.endMs, blockDepRouteType, blockArrRouteType, tatData, useMinimum)) {
      for (const f of block.flights) {
        const flightRejections = rejections.get(f.id) || []
        flightRejections.push({
          registration: ac.registration,
          icaoType: ac.icaoType,
          reason: 'overlap',
        })
        rejections.set(f.id, flightRejections)
      }
      continue
    }

    const chainOk = checkStationChain(st, block)

    const acForEval: AircraftForEval = {
      registration: ac.registration,
      icaoType: ac.icaoType,
      family: aircraftFamilies.get(ac.registration) || null,
    }

    let hardBlocked = false
    let blockSoftPenalty = 0
    let blockBonus = 0
    const blockViolations: RuleViolation[] = []

    if (rules.length > 0) {
      for (const f of block.flights) {
        const fEval: FlightForEval = {
          id: f.id,
          depStation: f.depStation,
          arrStation: f.arrStation,
          stdMinutes: f.stdMinutes,
          staMinutes: f.staMinutes,
          blockMinutes: f.staMinutes - f.stdMinutes,
          serviceType: f.serviceType || 'J',
          date: f.date,
          aircraftTypeIcao: f.aircraftTypeIcao,
        }

        const result = evaluateRules(fEval, acForEval, rules)
        if (!result.allowed) {
          hardBlocked = true
          for (const fl of block.flights) {
            const flightRejections = rejections.get(fl.id) || []
            flightRejections.push({
              registration: ac.registration,
              icaoType: ac.icaoType,
              reason: 'hard_rule',
              ruleViolations: result.violations,
            })
            rejections.set(fl.id, flightRejections)
          }
          break
        }
        blockSoftPenalty += result.totalPenalty
        blockViolations.push(...result.violations)
        blockBonus += evaluateBonus(fEval, acForEval, rules)
      }
    }

    if (hardBlocked) continue

    const sameStation = st.lastARR === firstFlight.depStation
    const isIdle = st.lastSTA === null

    let priority: 1 | 2 | 3
    let gap: number

    if (chainOk && sameStation && !isIdle) {
      priority = 1
      gap = computeGapFn(st, firstFlight, firstFlightDateMs)
    } else if (chainOk && isIdle) {
      priority = 2
      gap = Infinity
    } else {
      priority = 3
      gap = Infinity
    }

    candidates.push({
      reg: ac.registration,
      priority,
      gap,
      softPenalty: blockSoftPenalty,
      violations: blockViolations,
      bonus: blockBonus,
    })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    const aCost = a.softPenalty - a.bonus
    const bCost = b.softPenalty - b.bonus
    if (aCost !== bCost) return aCost - bCost
    return a.gap - b.gap
  })

  const best = candidates[0]

  if (best.priority === 3) {
    const st = states.get(best.reg)!
    if (st.lastARR && st.lastARR !== firstFlight.depStation) {
      chainBreaks.push({
        flightId: firstFlight.id,
        prevArr: st.lastARR,
        nextDep: firstFlight.depStation,
      })
    }
  }

  if (best.violations.length > 0) {
    for (const f of block.flights) {
      const existing = ruleViolations.get(f.id) || []
      ruleViolations.set(f.id, [...existing, ...best.violations])
    }
    stats.softRulesBent += best.violations.filter((v) => v.enforcement === 'soft').length
    stats.totalPenaltyCost += best.softPenalty
  }

  for (const c of candidates) {
    if (c.reg === best.reg) continue
    for (const f of block.flights) {
      const flightRejections = rejections.get(f.id) || []
      flightRejections.push({
        registration: c.reg,
        icaoType: regs.find((r) => r.registration === c.reg)?.icaoType || '',
        reason: 'score',
        totalCost: c.softPenalty - c.bonus,
      })
      rejections.set(f.id, flightRejections)
    }
  }

  return best.reg
}

// ─── Balance-utilization aircraft selection ──────────────────

function findBalancedAircraft(
  firstFlight: AssignableFlight,
  block: AssignmentBlock,
  states: Map<string, AircraftState>,
  regs: AssignableAircraft[],
  tatData: AircraftTypeTAT,
  useMinimum: boolean,
  chainBreaks: ChainBreak[],
  rules: ScheduleRule[],
  aircraftFamilies: Map<string, string>,
  ruleViolations: Map<string, RuleViolation[]>,
  rejections: Map<string, RejectionReason[]>,
  stats: RuleStats,
): string | null {
  interface Candidate {
    reg: string
    score: number
    violations: RuleViolation[]
    softPenalty: number
  }

  const candidates: Candidate[] = []
  const blockFirstDep = firstFlight.depStation
  const blockDepRouteType = block.flights[0].routeType
  const blockArrRouteType = block.flights[block.flights.length - 1].routeType

  for (const ac of regs) {
    const st = states.get(ac.registration)!

    if (!canFitBlock(st, block.startMs, block.endMs, blockDepRouteType, blockArrRouteType, tatData, useMinimum)) {
      for (const f of block.flights) {
        const flightRejections = rejections.get(f.id) || []
        flightRejections.push({
          registration: ac.registration,
          icaoType: ac.icaoType,
          reason: 'overlap',
        })
        rejections.set(f.id, flightRejections)
      }
      continue
    }

    const chainOk = checkStationChain(st, block)

    const acForEval: AircraftForEval = {
      registration: ac.registration,
      icaoType: ac.icaoType,
      family: aircraftFamilies.get(ac.registration) || null,
    }

    let hardBlocked = false
    let blockSoftPenalty = 0
    let blockBonus = 0
    const blockViolations: RuleViolation[] = []

    if (rules.length > 0) {
      for (const f of block.flights) {
        const fEval: FlightForEval = {
          id: f.id,
          depStation: f.depStation,
          arrStation: f.arrStation,
          stdMinutes: f.stdMinutes,
          staMinutes: f.staMinutes,
          blockMinutes: f.staMinutes - f.stdMinutes,
          serviceType: f.serviceType || 'J',
          date: f.date,
          aircraftTypeIcao: f.aircraftTypeIcao,
        }

        const result = evaluateRules(fEval, acForEval, rules)
        if (!result.allowed) {
          hardBlocked = true
          for (const fl of block.flights) {
            const flightRejections = rejections.get(fl.id) || []
            flightRejections.push({
              registration: ac.registration,
              icaoType: ac.icaoType,
              reason: 'hard_rule',
              ruleViolations: result.violations,
            })
            rejections.set(fl.id, flightRejections)
          }
          break
        }
        blockSoftPenalty += result.totalPenalty
        blockViolations.push(...result.violations)
        blockBonus += evaluateBonus(fEval, acForEval, rules)
      }
    }

    if (hardBlocked) continue

    let score = 0

    const totalBlockMinutes = st.assignedFlights.reduce((sum, f) => {
      return sum + (toAbsoluteMs(f.date, f.staMinutes) - toAbsoluteMs(f.date, f.stdMinutes)) / 60000
    }, 0)
    score -= totalBlockMinutes * 2

    if (chainOk && st.lastARR && st.lastARR === blockFirstDep && st.lastSTA !== null) {
      score += 500
    } else if (!chainOk && st.windows.length > 0) {
      score -= 200
    }

    if (st.assignedFlights.length === 0) {
      score += 300
    }

    if (st.lastSTA !== null && st.lastSTADate !== null) {
      const lastEndMs = st.lastSTADate + st.lastSTA * 60000
      const gapMinutes = (block.startMs - lastEndMs) / 60000
      if (gapMinutes > 360) {
        score -= 50
      }
    }

    score -= blockSoftPenalty
    score += blockBonus

    candidates.push({ reg: ac.registration, score, violations: blockViolations, softPenalty: blockSoftPenalty })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.score - a.score)

  const best = candidates[0]

  if (best.violations.length > 0) {
    for (const f of block.flights) {
      const existing = ruleViolations.get(f.id) || []
      ruleViolations.set(f.id, [...existing, ...best.violations])
    }
    stats.softRulesBent += best.violations.filter((v) => v.enforcement === 'soft').length
    stats.totalPenaltyCost += best.softPenalty
  }

  for (const c of candidates) {
    if (c.reg === best.reg) continue
    for (const f of block.flights) {
      const flightRejections = rejections.get(f.id) || []
      flightRejections.push({
        registration: c.reg,
        icaoType: regs.find((r) => r.registration === c.reg)?.icaoType || '',
        reason: 'score',
        totalCost: c.softPenalty,
      })
      rejections.set(f.id, flightRejections)
    }
  }

  return best.reg
}

/** Compute gap minutes between aircraft's latest STA and the flight's STD. */
function computeGapFn(state: AircraftState, flight: AssignableFlight, flightDateMs: number): number {
  if (state.lastSTA === null || state.lastSTADate === null) return Infinity

  if (flightDateMs === state.lastSTADate) {
    return flight.stdMinutes - state.lastSTA
  }

  const dayDiffMs = flightDateMs - state.lastSTADate
  const dayDiff = Math.round(dayDiffMs / 86400000)
  return 1440 - state.lastSTA + (dayDiff - 1) * 1440 + flight.stdMinutes
}
