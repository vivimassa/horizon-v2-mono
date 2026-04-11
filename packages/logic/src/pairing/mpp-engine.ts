/**
 * lib/mpp-engine.ts
 * Pure computation engine for 3.1.4 Manpower Planning.
 * NO Supabase imports — all functions are deterministic transforms on plain data.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-crew-position BH target + non-availability breakdown. */
export interface MppPositionSettings {
  positionId: string
  bhTarget: number
  naSick: number
  naAnnual: number
  naTraining: number
  naMaternity: number
  naAttrition: number
  naOther: number
}

/** Plan-level settings (position-level settings live in MppPositionSettings). */
export interface MppPlanSettings {
  wetLeaseActive: boolean
  /** When true, naOther is treated as a permanent headcount drain (like attrition),
   *  not a temporary capacity reducer. Default false = absence. */
  naOtherIsDrain: boolean
}

export interface MppFleetOverride {
  id: string
  planId: string
  aircraftTypeIcao: string
  monthIndex: number
  planYear: number
  acCount: number
}

export type MppEventType = 'AOC' | 'CUG' | 'CCQ' | 'ACMI' | 'DRY' | 'DOWNSIZE' | 'RESIGN' | 'DELIVERY'

export interface MppEvent {
  id: string
  planId: string
  eventType: MppEventType
  monthIndex: number
  planYear: number
  count: number
  fleetIcao: string | null
  positionName: string | null
  leadMonths: number
  notes: string | null
}

export interface MppPlan {
  id: string
  name: string
  color: string
  isBasePlan: boolean
  sortOrder: number
  settings: MppPlanSettings
}

export interface MppAircraftType {
  id: string
  icaoType: string
  name: string
  family: string | null
}

export interface MppCrewPosition {
  id: string
  code: string
  name: string
  category: string // 'cockpit' | 'cabin'
  rankOrder: number
  color: string
}

export interface GapCell {
  month: string
  monthIndex: number
  available: number
  required: number
  gap: number
}

export interface GapRow {
  position: string
  positionCode: string
  positionColor: string
  cells: GapCell[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Fallback BH per AC per day when no fleet/schedule data is available. */
const DEFAULT_BH_PER_AC_DAY = 12

export const DEFAULT_SETTINGS: MppPlanSettings = {
  wetLeaseActive: false,
  naOtherIsDrain: false,
}

/** Default per-position settings — BH target varies by crew category. */
export function defaultPositionSettings(pos: MppCrewPosition): MppPositionSettings {
  return {
    positionId: pos.id,
    bhTarget: pos.category === 'cockpit' ? 75 : 70,
    naSick: 3,
    naAnnual: 10,
    naTraining: 6,
    naMaternity: 1.5,
    naAttrition: 4,
    naOther: 1,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(monthIndex: number, year: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * Compute BH per AC per day from real schedule data and fleet count.
 * Falls back to a default when no data is available.
 */
function bhPerAcDay(
  icaoType: string,
  scheduleBH: Record<string, number[]>,
  fleetCount: Record<string, number>,
  monthIndex: number,
  year: number,
): number {
  const fc = fleetCount[icaoType] ?? 0
  const monthBH = scheduleBH[icaoType]?.[monthIndex] ?? 0
  const days = daysInMonth(monthIndex, year)
  if (fc > 0 && monthBH > 0 && days > 0) return monthBH / (fc * days)
  return DEFAULT_BH_PER_AC_DAY
}

// ─── Engine Functions ──────────────────────────────────────────────────────────

/**
 * Compute effective monthly block hours per fleet.
 *
 * - Base Plan: uses schedule BH as primary source
 * - Scenarios: uses AC count x utilization as primary source
 * - Both: hybrid fallback — schedule if exists, otherwise util x count x days
 *
 * Fleet overrides (from Fleet Plan tab) replace AC count for the overridden months.
 */
export function computeMonthlyBH(
  scheduleBH: Record<string, number[]>,
  overrides: MppFleetOverride[],
  activeFleets: string[],
  fleetCount: Record<string, number> = {},
  year = 2026,
  options?: {
    isBase?: boolean
    monthlyAcCount?: Record<string, number[]>
    utilization?: Map<string, number>
  },
): Record<string, number[]> {
  const isBase = options?.isBase ?? true
  const monthlyAcCount = options?.monthlyAcCount ?? {}
  const utilization = options?.utilization ?? new Map<string, number>()

  const result: Record<string, number[]> = {}
  for (const icaoType of activeFleets) {
    const schedBH = scheduleBH[icaoType] ?? new Array(12).fill(0)
    const acCount = monthlyAcCount[icaoType] ?? new Array(12).fill(fleetCount[icaoType] ?? 0)
    const dailyUtil = utilization.get(icaoType) ?? DEFAULT_BH_PER_AC_DAY

    result[icaoType] = Array.from({ length: 12 }, (_, m) => {
      const override = overrides.find((o) => o.aircraftTypeIcao === icaoType && o.monthIndex === m)
      const hasSchedule = schedBH[m] > 0
      const days = daysInMonth(m, year)

      if (isBase) {
        // Base Plan: schedule BH is the source of truth
        // Fleet overrides use schedule-derived BH per AC per day
        if (override !== undefined) {
          const perAcDay = bhPerAcDay(icaoType, scheduleBH, fleetCount, m, year)
          return override.acCount * perAcDay * days
        }
        if (hasSchedule) return schedBH[m]
        // Fallback only when no schedule at all
        return acCount[m] * dailyUtil * days
      } else {
        // Scenarios: utilization-based is the primary source
        if (override !== undefined) {
          return override.acCount * dailyUtil * days
        }
        if (acCount[m] > 0) return acCount[m] * dailyUtil * days
        // Fallback to schedule if no AC count data
        if (hasSchedule) return schedBH[m]
        return 0
      }
    })
  }
  return result
}

/**
 * Compute required headcount per position per month.
 *
 * Each crew position has its own BH target and non-availability breakdown.
 * positionSettings is keyed by position.id; falls back to category defaults.
 *
 * Cockpit positions use total fleet BH (1 pilot per flight regardless of type):
 *   required[m] = CEIL( totalBH[m] / (bhTarget x effectiveAvail) )
 *
 * Cabin positions are weighted by the standard complement per aircraft type
 * (e.g. A320 needs 3 CA, A330 needs 5 CA — same BH produces different duty loads):
 *   weightedBH[m] = sum_type( monthlyBH[type][m] x complement[type][pos.code] )
 *   required[m]   = CEIL( weightedBH[m] / (bhTarget x effectiveAvail) )
 *
 * @param standardComplements - { icaoType: { posCode: count } } from 4.5.5 Standard row.
 *                              If omitted, cabin positions fall back to cockpit formula.
 */
export function computeRequired(
  monthlyBH: Record<string, number[]>,
  positionSettings: Record<string, MppPositionSettings>, // keyed by positionId
  positions: MppCrewPosition[],
  standardComplements?: Record<string, Record<string, number>>,
  naOtherIsDrain = false,
): Record<string, number[]> {
  // Sum BH across all active fleets (used by cockpit positions)
  const totalBH = new Array(12).fill(0) as number[]
  for (const bh of Object.values(monthlyBH)) {
    bh.forEach((v, m) => {
      totalBH[m] += v
    })
  }

  const result: Record<string, number[]> = {}
  for (const pos of positions) {
    const ps = positionSettings[pos.id] ?? defaultPositionSettings(pos)
    // Attrition (and naOther if classified as drain) are modelled as a headcount
    // drain in computeAvailable — they must NOT also reduce effective availability
    // here, otherwise the same loss is double-counted.
    const tempNAPct = ps.naSick + ps.naAnnual + ps.naTraining + ps.naMaternity + (naOtherIsDrain ? 0 : ps.naOther)
    const effectiveAvail = Math.max(0.01, 1 - tempNAPct / 100)

    let bhSource: number[]
    if (pos.category === 'cabin' && standardComplements && Object.keys(standardComplements).length > 0) {
      // Weight monthly BH by how many of this cabin position each aircraft type requires
      const weighted = new Array(12).fill(0) as number[]
      for (const [icao, bh] of Object.entries(monthlyBH)) {
        const factor = standardComplements[icao]?.[pos.code] ?? 0
        if (factor > 0)
          bh.forEach((v, m) => {
            weighted[m] += v * factor
          })
      }
      bhSource = weighted
    } else {
      bhSource = totalBH
    }

    result[pos.name] = bhSource.map((bh) => (ps.bhTarget <= 0 ? 0 : Math.ceil(bh / (ps.bhTarget * effectiveAvail))))
  }
  return result
}

/**
 * Compute available headcount per position per month with full cascade.
 *
 * Rules:
 *   AOC  -> +count at pos after leadMonths
 *   CUG  -> FO -count immediately, Captain +count after leadMonths
 *   CCQ  -> pos -count immediately (from source fleet), pos +count after leadMonths
 *   DOWNSIZE / RESIGN -> pos -count immediately
 *   ACMI / DRY / DELIVERY -> fleet-level only, no position effect
 *
 * startingHeadcount: { positionName: { fleetIcao: n } }
 * Derived from live crew_members data — see getMppCrewHeadcount() in actions.
 */
export function computeAvailable(
  events: MppEvent[],
  startingHeadcount: Record<string, Record<string, number[]>>,
  positions: MppCrewPosition[],
  positionSettings?: Record<string, MppPositionSettings>,
  naOtherIsDrain = false,
  activeFleets?: string[],
): Record<string, number[]> {
  const delta: Record<string, number[]> = {}
  for (const pos of positions) {
    delta[pos.name] = new Array(12).fill(0)
  }

  for (const evt of events) {
    const mi = Math.max(0, Math.min(11, evt.monthIndex))
    const lagMi = Math.min(11, mi + Math.max(0, evt.leadMonths))
    const n = evt.count

    switch (evt.eventType) {
      case 'AOC':
        if (evt.positionName && delta[evt.positionName]) {
          delta[evt.positionName][lagMi] += n
        }
        break

      case 'CUG':
        if (delta['First Officer']) delta['First Officer'][mi] -= n
        if (delta['Captain']) delta['Captain'][lagMi] += n
        for (const pos of positions) {
          const n2 = pos.name.toLowerCase()
          if (!delta['Captain'] && (n2.includes('captain') || n2.includes('cpt'))) delta[pos.name][lagMi] += n
          if (!delta['First Officer'] && (n2.includes('officer') || n2.includes('fo'))) delta[pos.name][mi] -= n
        }
        break

      case 'CCQ':
        if (evt.positionName && delta[evt.positionName]) {
          delta[evt.positionName][mi] -= n
          delta[evt.positionName][lagMi] += n
        }
        break

      case 'DOWNSIZE':
      case 'RESIGN':
        if (evt.positionName && delta[evt.positionName]) {
          delta[evt.positionName][mi] -= n
        }
        break

      default:
        break
    }
  }

  const result: Record<string, number[]> = {}
  for (const pos of positions) {
    const fleetMonthly = startingHeadcount[pos.name] ?? {}

    // Sum per-month headcount across active fleets
    const monthlyBase = new Array(12).fill(0) as number[]
    if (activeFleets && activeFleets.length > 0) {
      for (const f of activeFleets) {
        const arr = fleetMonthly[f]
        if (arr)
          arr.forEach((v, m) => {
            monthlyBase[m] += v
          })
      }
    } else {
      for (const arr of Object.values(fleetMonthly)) {
        arr.forEach((v, m) => {
          monthlyBase[m] += v
        })
      }
    }

    // Monthly attrition drain: (naAttrition + naOther-if-drain) / 100 / 12
    const ps = positionSettings?.[pos.id]
    const annualDrainPct = (ps?.naAttrition ?? 0) + (naOtherIsDrain ? (ps?.naOther ?? 0) : 0)
    const monthlyAttritionRate = annualDrainPct / 100 / 12

    // Roll forward: each month starts from the base headcount for that month,
    // but cumulative attrition and events carry over.
    let cumulativeAdj = 0 // net cumulative adjustment from attrition + events
    result[pos.name] = new Array(12).fill(0)
    for (let m = 0; m < 12; m++) {
      const baseThisMonth = monthlyBase[m]
      const current = Math.max(0, baseThisMonth + cumulativeAdj)
      const attritionLoss = Math.round(current * monthlyAttritionRate)
      cumulativeAdj += delta[pos.name][m] - attritionLoss
      result[pos.name][m] = Math.max(0, baseThisMonth + cumulativeAdj)
    }
  }
  return result
}

/**
 * Build the gap table: available - required per position per month.
 */
export function computeGap(
  required: Record<string, number[]>,
  available: Record<string, number[]>,
  positions: MppCrewPosition[],
): GapRow[] {
  return positions.map((pos) => ({
    position: pos.name,
    positionCode: pos.code,
    positionColor: pos.color,
    cells: MONTHS.map((month, m) => {
      const avail = available[pos.name]?.[m] ?? 0
      const req = required[pos.name]?.[m] ?? 0
      return { month, monthIndex: m, available: avail, required: req, gap: avail - req }
    }),
  }))
}

/**
 * Sum required headcount across all positions per month (for bar chart).
 */
export function computeTotalRequired(required: Record<string, number[]>): number[] {
  const total = new Array(12).fill(0) as number[]
  for (const monthly of Object.values(required)) {
    monthly.forEach((v, m) => {
      total[m] += v
    })
  }
  return total
}

/**
 * Compute monthly attrition headcount drain per position.
 * Returns negative numbers representing crew lost each month due to attrition.
 * Used for display only — computeAvailable already bakes this in.
 */
export function computeAttritionDrain(
  startingHeadcount: Record<string, Record<string, number[]>>,
  positions: MppCrewPosition[],
  positionSettings: Record<string, MppPositionSettings>,
  naOtherIsDrain: boolean,
): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  for (const pos of positions) {
    const ps = positionSettings[pos.id]
    const annualDrainPct = (ps?.naAttrition ?? 0) + (naOtherIsDrain ? (ps?.naOther ?? 0) : 0)
    const rate = annualDrainPct / 100 / 12

    // Sum monthly headcount across all fleets
    const fleetMonthly = startingHeadcount[pos.name] ?? {}
    const monthlyBase = new Array(12).fill(0) as number[]
    for (const arr of Object.values(fleetMonthly)) {
      arr.forEach((v, m) => {
        monthlyBase[m] += v
      })
    }

    result[pos.name] = []
    for (let m = 0; m < 12; m++) {
      const loss = Math.round(monthlyBase[m] * rate)
      result[pos.name][m] = -loss
    }
  }
  return result
}

/**
 * Look up default lead months for an event type from lead time items.
 */
export function getDefaultLeadMonths(
  eventType: MppEventType,
  positionName: string,
  leadTimeItems: { label: string; valueMonths: number }[],
): number {
  const pos = positionName.toLowerCase()
  const find = (keywords: string[]): number | undefined =>
    leadTimeItems.find((i) => keywords.every((k) => i.label.toLowerCase().includes(k)))?.valueMonths

  switch (eventType) {
    case 'CUG':
      return find(['cug']) ?? find(['upgrade', 'captain']) ?? 4
    case 'CCQ':
      return find(['ccq']) ?? find(['cross']) ?? 3
    case 'AOC':
      if (pos.includes('captain') || pos.includes('cpt')) return find(['captain', 'aoc']) ?? find(['captain']) ?? 6
      if (pos.includes('officer') || pos.includes('fo')) return find(['officer', 'aoc']) ?? find(['officer']) ?? 5
      return find(['cabin', 'initial']) ?? find(['cabin']) ?? 2
    default:
      return 0
  }
}
