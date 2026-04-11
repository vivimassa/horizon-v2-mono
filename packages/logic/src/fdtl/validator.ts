// ─── FDTL Runtime Validator — pure, client-safe ───────────────────────────────
// No server imports. Accepts a SerializedRuleSet loaded from DB and validates
// a pairing's flights against it, returning the same LegalityResult type used
// by the existing hardcoded checker.

// TODO: These types need to be defined or imported from the v2 types layer.
// In v1 they lived at @/components/workforce/pairing/pairing-types
export interface Flight {
  id: string
  departureAirport: string
  arrivalAirport: string
  aircraftType: string
  std: string // local ISO datetime
  sta: string // local ISO datetime
  stdUtc: string // UTC ISO datetime
  staUtc: string // UTC ISO datetime
  blockMinutes: number
}

export interface LegalityCheck {
  label: string
  actual: string
  limit: string
  status: 'pass' | 'warning' | 'violation'
  fdtlRef?: string
  isOperational?: boolean
}

export interface LegalityResult {
  overallStatus: 'pass' | 'warning' | 'violation'
  checks: LegalityCheck[]
  tableRef?: string
  openPairing?: boolean
  crossBase?: boolean
  augmentedSuggestion?: {
    complementKey: string
    cockpitCount: number
    facilityClass: string
    facilityLabel: string
    maxFdpMinutes: number
  }
  isMult?: boolean
}

export interface CrewConfig {
  complementKey: string
  cockpitCount: number
  facilityClass: string
  totalCabinCrew?: number
  minOperatingCabin?: number
}

import type { SerializedRuleSet } from './engine-types'
import { displayToMinutes, minutesToDisplay } from './utils'

// TODO: In v1 this was imported from @/lib/data/airport-countries.
// For v2, provide a local lookup or wire to a shared data module.
const AIRPORT_COUNTRY: Record<string, string> = {}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function fmt(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.round(Math.abs(minutes) % 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

function getRouteType(dep: string, arr: string): 'domestic' | 'international' {
  const depCountry = AIRPORT_COUNTRY[dep]
  const arrCountry = AIRPORT_COUNTRY[arr]
  if (depCountry && arrCountry && depCountry === arrCountry) return 'domestic'
  return 'international'
}

function buildReportingTimesMap(ruleSet: SerializedRuleSet): Map<string, number> {
  const m = new Map<string, number>()
  for (const rt of ruleSet.reportingTimes) {
    m.set(rt.key, rt.minutes)
  }
  return m
}

function getReportMinutes(
  rtMap: Map<string, number>,
  flight: Flight,
  isDeadhead: boolean,
  defaultMinutes: number,
): number {
  const routeType = getRouteType(flight.departureAirport, flight.arrivalAirport)
  const colKey = isDeadhead ? 'pax_air' : flight.aircraftType.toLowerCase()
  // Try specific aircraft type first, then generic
  return (
    rtMap.get(`report|${routeType}|${colKey}`) ??
    rtMap.get(`report|${routeType}|all`) ??
    rtMap.get(`report|all|${colKey}`) ??
    rtMap.get(`report|all|all`) ??
    defaultMinutes
  )
}

function getDebriefMinutes(rtMap: Map<string, number>, flight: Flight, defaultMinutes: number): number {
  const routeType = getRouteType(flight.departureAirport, flight.arrivalAirport)
  const colKey = flight.aircraftType.toLowerCase()
  return (
    rtMap.get(`debrief|${routeType}|${colKey}`) ??
    rtMap.get(`debrief|${routeType}|all`) ??
    rtMap.get(`debrief|all|${colKey}`) ??
    rtMap.get(`debrief|all|all`) ??
    defaultMinutes
  )
}

/**
 * Parse a row key like "0600-1329" or "1700-0459" (midnight-crossing).
 * Returns { startMin, endMin, crosses } in minutes since midnight.
 */
function parseRowKey(rowKey: string): { startMin: number; endMin: number; crosses: boolean } | null {
  const m = rowKey.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/)
  if (!m) return null
  const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  const endMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10)
  return { startMin, endMin, crosses: startMin > endMin }
}

function lookupMaxFDP(
  ruleSet: SerializedRuleSet,
  dutyStartMins: number, // minutes since midnight of report time
  opSectors: number,
): { maxFdpMinutes: number; rowKey: string; colKey: string } {
  const { fdpTable } = ruleSet
  if (!fdpTable) return { maxFdpMinutes: 660, rowKey: '—', colKey: '—' }
  const cellMap = new Map<string, number>()
  for (const c of fdpTable.cells) cellMap.set(c.key, c.minutes)

  // Find matching row
  let matchedRowKey = fdpTable.rowKeys[fdpTable.rowKeys.length - 1] // fallback: last row
  for (const rowKey of fdpTable.rowKeys) {
    const parsed = parseRowKey(rowKey)
    if (!parsed) continue
    const { startMin, endMin, crosses } = parsed
    const d = ((dutyStartMins % 1440) + 1440) % 1440
    const matches = crosses ? d >= startMin || d < endMin : d >= startMin && d < endMin
    if (matches) {
      matchedRowKey = rowKey
      break
    }
  }

  // Find matching col: colKeys like ['1-2', '3', '4', ..., '10+']
  let matchedColKey = fdpTable.colKeys[fdpTable.colKeys.length - 1] // fallback: last col
  for (const colKey of fdpTable.colKeys) {
    if (colKey.includes('+')) {
      // e.g. '10+' — match if opSectors >= threshold
      const threshold = parseInt(colKey, 10)
      if (opSectors >= threshold) {
        matchedColKey = colKey
        break
      }
    } else if (colKey.includes('-')) {
      // e.g. '1-2' — range
      const [lo, hi] = colKey.split('-').map(Number)
      if (opSectors >= lo && opSectors <= hi) {
        matchedColKey = colKey
        break
      }
    } else {
      // exact integer
      if (opSectors === parseInt(colKey, 10)) {
        matchedColKey = colKey
        break
      }
    }
  }

  const maxFdpMinutes = cellMap.get(`${matchedRowKey}|${matchedColKey}`) ?? 660 // 11:00 safe fallback

  return { maxFdpMinutes, rowKey: matchedRowKey, colKey: matchedColKey }
}

/**
 * Look up minimum cabin crew in-flight rest from the cabin rest table (Table 05).
 * Matches actual FDP to an FDP band row, returns required rest for the facility class.
 */
function lookupCabinRestMinimum(
  table: NonNullable<SerializedRuleSet['cabinRestTable']>,
  fdpMinutes: number,
  facilityClass: string,
): { minutes: number; rowKey: string } | null {
  const cellMap = new Map<string, number>()
  for (const c of table.cells) cellMap.set(c.key, c.minutes)

  // Find matching row: 'fdp_lte_HHMM' or 'fdp_HHMM_HHMM'
  const matchedRowKey = table.rowKeys.find((rowKey) => {
    if (rowKey.startsWith('fdp_lte_')) {
      const capHHMM = rowKey.slice(-4)
      const capMin = parseInt(capHHMM.slice(0, 2)) * 60 + parseInt(capHHMM.slice(2, 4))
      return fdpMinutes <= capMin
    }
    const parts = rowKey.match(/fdp_(\d{4})_(\d{4})/)
    if (!parts) return false
    const lo = parseInt(parts[1].slice(0, 2)) * 60 + parseInt(parts[1].slice(2, 4))
    const hi = parseInt(parts[2].slice(0, 2)) * 60 + parseInt(parts[2].slice(2, 4))
    return fdpMinutes >= lo && fdpMinutes <= hi
  })

  if (!matchedRowKey) return null

  const minutes = cellMap.get(`${matchedRowKey}|${facilityClass}`)
  if (minutes === undefined) return null

  return { minutes, rowKey: matchedRowKey }
}

function lookupRule(ruleSet: SerializedRuleSet, code: string): string | null {
  const r = ruleSet.rules.find((r) => r.code === code)
  return r?.value ?? null
}

function lookupRuleMinutes(ruleSet: SerializedRuleSet, code: string, fallbackMinutes: number): number {
  const val = lookupRule(ruleSet, code)
  if (!val) return fallbackMinutes
  const mins = displayToMinutes(val)
  return isNaN(mins) ? fallbackMinutes : mins
}

/** Split ordered flights into duty days (gap > 8h = new duty day) — uses UTC for accuracy */
function splitDutyDays(flights: Flight[]): Flight[][] {
  if (flights.length === 0) return []
  const days: Flight[][] = []
  let current: Flight[] = [flights[0]]
  for (let i = 1; i < flights.length; i++) {
    const gap = (new Date(flights[i].stdUtc).getTime() - new Date(flights[i - 1].staUtc).getTime()) / 60000
    if (gap > 8 * 60) {
      days.push(current)
      current = []
    }
    current.push(flights[i])
  }
  days.push(current)
  return days
}

// ─── Public timing helpers (used by buildSegments for display) ────────────────

/** Resolve the effective report time for a single flight using the DB lookup cascade. */
export function resolveReportMinutes(ruleSet: SerializedRuleSet, flight: Flight, isDeadhead: boolean): number {
  const rtMap = buildReportingTimesMap(ruleSet)
  return getReportMinutes(rtMap, flight, isDeadhead, ruleSet.defaultReportMinutes)
}

/** Resolve the effective debrief time for a single flight using the DB lookup cascade. */
export function resolveDebriefMinutes(ruleSet: SerializedRuleSet, flight: Flight): number {
  const rtMap = buildReportingTimesMap(ruleSet)
  return getDebriefMinutes(rtMap, flight, ruleSet.defaultDebriefMinutes)
}

// ─── Main validator ───────────────────────────────────────────────────────────

export function validatePairingClient(
  ruleSet: SerializedRuleSet,
  flights: Flight[],
  deadheadIds: Set<string>,
  homeBase: string,
  crewConfig?: CrewConfig,
  baseAirports?: string[],
  icaoToFamily?: Record<string, string>,
): LegalityResult {
  if (flights.length === 0) return { overallStatus: 'pass', checks: [] }

  const checks: LegalityCheck[] = []
  const dutyDays = splitDutyDays(flights)
  const rtMap = buildReportingTimesMap(ruleSet)
  let primaryTableRef: string | undefined
  const fdpMinutesForDay: number[] = [] // tracked for augmented suggestion computation

  // Derive effective cockpit count: complementKey is the authoritative signal when
  // cockpitCount was not stored yet or loaded as the DB default (2).
  const effectiveCockpitCount = (() => {
    if (!crewConfig) return 2
    if (crewConfig.complementKey === 'aug2' && crewConfig.cockpitCount <= 2) return 4
    if (crewConfig.complementKey === 'aug1' && crewConfig.cockpitCount <= 2) return 3
    return crewConfig.cockpitCount
  })()
  const isAugmented =
    crewConfig &&
    crewConfig.facilityClass &&
    (effectiveCockpitCount > 2 || crewConfig.complementKey === 'aug1' || crewConfig.complementKey === 'aug2')

  for (let di = 0; di < dutyDays.length; di++) {
    const day = dutyDays[di]
    const firstFlight = day[0]
    const isDeadheadFirst = deadheadIds.has(firstFlight.id)
    const reportMin = getReportMinutes(rtMap, firstFlight, isDeadheadFirst, ruleSet.defaultReportMinutes)

    // FDP math uses UTC — correct across timezone boundaries
    const reportTime = new Date(new Date(firstFlight.stdUtc).getTime() - reportMin * 60000)

    const opFlights = day.filter((f) => !deadheadIds.has(f.id))
    const lastOpFlight = opFlights.length > 0 ? opFlights[opFlights.length - 1] : day[day.length - 1]
    const debriefMin = getDebriefMinutes(rtMap, lastOpFlight, ruleSet.defaultDebriefMinutes)
    // FDP ends at chocks-on (STA) of last operating sector per CAAV VAR 15 — debrief is NOT included.
    const fdpMinutes = (new Date(lastOpFlight.staUtc).getTime() - reportTime.getTime()) / 60000
    const debriefTime = new Date(new Date(lastOpFlight.staUtc).getTime() + debriefMin * 60000)
    const opSectors = opFlights.length
    fdpMinutesForDay.push(fdpMinutes)

    // FDP limit check — branch on crew complement
    if (ruleSet.fdpTable || isAugmented) {
      if (isAugmented && crewConfig) {
        // ── AUGMENTED FDP LIMIT ──────────────────────────────────────────────
        // Look up from augmentedLimits by crew count + facility class.
        // Use effectiveCockpitCount (derived from complementKey when stored count is wrong).
        const exactLimit = ruleSet.augmentedLimits.find(
          (a) => a.crewCount === effectiveCockpitCount && a.facilityClass === crewConfig.facilityClass,
        )
        // Fallback: cap crew count at 4 if the table only has entries up to 4
        const effectiveLimit =
          exactLimit ??
          ruleSet.augmentedLimits.find(
            (a) => a.crewCount === Math.min(effectiveCockpitCount, 4) && a.facilityClass === crewConfig.facilityClass,
          )

        // CAAV VAR 15 safe defaults when no augmented limits are seeded:
        // 3 pilots: CLASS_3=14:00(840), CLASS_2=15:00(900), CLASS_1=16:00(960)
        // 4 pilots: CLASS_3=15:00(900), CLASS_2=16:00(960), CLASS_1=17:00(1020)
        const FALLBACK_AUG: Record<string, Record<string, number>> = {
          CLASS_1: { '3': 960, '4': 1020 },
          CLASS_2: { '3': 900, '4': 960 },
          CLASS_3: { '3': 840, '4': 900 },
        }
        const fc = crewConfig.facilityClass ?? ''
        const fallbackMinutes =
          FALLBACK_AUG[fc]?.[String(Math.min(effectiveCockpitCount, 4))] ?? (effectiveCockpitCount >= 4 ? 1020 : 960)

        const maxFdpMinutes = effectiveLimit?.maxFdpMinutes ?? fallbackMinutes

        if (!effectiveLimit) {
          console.warn(
            `[FDTL] No augmented limits in ruleSet for ${effectiveCockpitCount} pilots / ${fc}. ` +
              `Using fallback ${fmt(maxFdpMinutes)}. Seed FDTL augmented limits to fix.`,
          )
        }

        const ref = effectiveLimit
          ? `Augmented · ${effectiveCockpitCount} pilots, ${effectiveLimit.facilityLabel} → ${fmt(maxFdpMinutes)} max`
          : `Augmented · ${effectiveCockpitCount} pilots → ${fmt(maxFdpMinutes)} max (fallback)`
        if (di === 0) primaryTableRef = ref

        const fdpStatus: LegalityCheck['status'] =
          fdpMinutes > maxFdpMinutes ? 'violation' : fdpMinutes > maxFdpMinutes * 0.92 ? 'warning' : 'pass'

        checks.push({
          label: `FDP Day ${di + 1}`,
          actual: fmt(fdpMinutes),
          limit: fmt(maxFdpMinutes),
          status: fdpStatus,
          fdtlRef: ref,
        })
      } else if (ruleSet.fdpTable) {
        // ── STANDARD FDP LIMIT — Table 01 lookup ────────────────────────────
        // Band lookup uses LOCAL report time at departure airport (CAAV §15.025)
        const reportDayMins = (() => {
          const stdLocal = firstFlight.std.slice(11, 16) // "HH:MM"
          const [h, m] = stdLocal.split(':').map(Number)
          return (((h * 60 + m - reportMin) % 1440) + 1440) % 1440
        })()
        const { maxFdpMinutes, rowKey, colKey } = lookupMaxFDP(ruleSet, reportDayMins, opSectors)

        const ref = `Table ${ruleSet.fdpTable.tableCode} · Row ${rowKey}, Col ${colKey} → ${fmt(maxFdpMinutes)} max`
        if (di === 0) primaryTableRef = ref

        const fdpStatus: LegalityCheck['status'] =
          fdpMinutes > maxFdpMinutes ? 'violation' : fdpMinutes > maxFdpMinutes * 0.92 ? 'warning' : 'pass'

        checks.push({
          label: `FDP Day ${di + 1}`,
          actual: fmt(fdpMinutes),
          limit: fmt(maxFdpMinutes),
          status: fdpStatus,
          fdtlRef: ref,
        })
      }
    }

    // Sector check
    const maxSectorsInt = (() => {
      const r = ruleSet.rules.find((r) => r.code === 'MAX_DAILY_SECTORS')
      if (!r) return 10
      const v = parseInt(r.value, 10)
      return isNaN(v) ? 10 : v
    })()
    checks.push({
      label: `Op. Sectors Day ${di + 1}`,
      actual: String(opSectors),
      limit: String(maxSectorsInt),
      status: opSectors > maxSectorsInt ? 'violation' : opSectors >= maxSectorsInt - 2 ? 'warning' : 'pass',
    })
  }

  // ── Cabin crew in-flight rest validation ─────────────────────────────────────
  // For augmented operations: compute available cruise time per duty day, derive
  // how much rest each cabin crew member can actually get, and compare against
  // the regulatory minimum from Table 05 (cabinRestTable).
  if (isAugmented && ruleSet.cabinRestTable && crewConfig) {
    const totalCabin = crewConfig.totalCabinCrew ?? 0
    const minOpCabin = crewConfig.minOperatingCabin ?? 0
    const restAtOnce = totalCabin - minOpCabin // how many cabin crew can rest simultaneously

    if (totalCabin > 0 && minOpCabin > 0 && restAtOnce > 0) {
      const { taxiOutMinutes, taxiInMinutes, climbMinutes, descentMinutes } = ruleSet.cruiseTimeDeductions
      const totalDeduction = taxiOutMinutes + taxiInMinutes + climbMinutes + descentMinutes
      const restRotations = Math.ceil(totalCabin / restAtOnce)

      const cabinCellMap = new Map<string, number>()
      for (const c of ruleSet.cabinRestTable.cells) cabinCellMap.set(c.key, c.minutes)

      for (let di = 0; di < dutyDays.length; di++) {
        const day = dutyDays[di]
        const opFlights = day.filter((f) => !deadheadIds.has(f.id))
        if (opFlights.length === 0) continue

        // Total block time across all operating sectors in this duty day
        const totalBlockMinutes = opFlights.reduce((sum, f) => sum + f.blockMinutes, 0)
        const availableCruise = Math.max(0, totalBlockMinutes - totalDeduction)
        const actualRestPerPerson = Math.floor(availableCruise / restRotations)

        // Look up minimum required rest from Table 05 using actual FDP
        const actualFdp = fdpMinutesForDay[di] ?? 0
        const requiredRest = lookupCabinRestMinimum(ruleSet.cabinRestTable, actualFdp, crewConfig.facilityClass ?? '')

        if (requiredRest) {
          const restStatus: LegalityCheck['status'] =
            requiredRest.minutes === -1
              ? 'violation'
              : actualRestPerPerson < requiredRest.minutes
                ? 'violation'
                : actualRestPerPerson < requiredRest.minutes * 1.1
                  ? 'warning'
                  : 'pass'

          const deductionDetail = `Block ${fmt(totalBlockMinutes)} − ${fmt(totalDeduction)} deductions = ${fmt(availableCruise)} cruise`
          const crewDetail = `${totalCabin} crew, ${minOpCabin} min operating → ${restAtOnce} rest at once, ${restRotations} rotations`

          checks.push({
            label: `Cabin rest Day ${di + 1}`,
            actual: fmt(actualRestPerPerson),
            limit: requiredRest.minutes === -1 ? 'N/A' : fmt(requiredRest.minutes),
            status: restStatus,
            fdtlRef:
              requiredRest.minutes === -1
                ? `Cabin crew in-flight rest not allowed for FDP ${fmt(actualFdp)} with ${crewConfig.facilityClass?.replace('CLASS_1', 'Class 1').replace('CLASS_2', 'Class 2').replace('CLASS_3', 'Class 3')} (Table 05). ${deductionDetail}. ${crewDetail}`
                : `Cabin crew rest: ${fmt(actualRestPerPerson)} per person (need ${fmt(requiredRest.minutes)} min). ${deductionDetail}. ${crewDetail}`,
          })
        }
      }
    }
  }

  // ── Operational base checks ───────────────────────────────────────────────
  const first = flights[0]
  const last = flights[flights.length - 1]
  const bases = baseAirports ?? (homeBase ? [homeBase] : [])
  const depIsBase = bases.length === 0 || bases.includes(first.departureAirport)
  const arrIsBase = bases.length === 0 || bases.includes(last.arrivalAirport)
  const openPairing = bases.length > 0 && (!depIsBase || !arrIsBase)
  const crossBase = depIsBase && arrIsBase && first.departureAirport !== last.arrivalAirport

  checks.push({
    label: 'Returns to base',
    actual: last.arrivalAirport,
    limit: first.departureAirport,
    status: first.departureAirport === last.arrivalAirport ? 'pass' : 'warning',
    isOperational: openPairing,
  })

  // ── Aircraft family / variant check ─────────────────────────────────────────
  let isMult = false
  if (icaoToFamily && Object.keys(icaoToFamily).length > 0) {
    const opFlightsAll = flights.filter((f) => !deadheadIds.has(f.id))
    if (opFlightsAll.length > 1) {
      const families = new Set(opFlightsAll.map((f) => icaoToFamily[f.aircraftType] ?? f.aircraftType))
      const types = new Set(opFlightsAll.map((f) => f.aircraftType))
      if (families.size > 1) {
        const typeList = [...types].join(', ')
        checks.push({
          label: 'Aircraft type',
          actual: typeList,
          limit: 'Single family',
          status: 'violation',
          fdtlRef: `Operating legs span multiple aircraft families (${typeList}). Crew type endorsements do not cover cross-family operations.`,
          isOperational: true,
        })
      } else if (types.size > 1) {
        isMult = true
      }
    }
  }

  const overallStatus: LegalityResult['overallStatus'] = checks.some((c) => c.status === 'violation')
    ? 'violation'
    : checks.some((c) => c.status === 'warning') || isMult
      ? 'warning'
      : 'pass'

  // ── Augmented suggestion — only for standard crew with FDP violations ──────
  let augmentedSuggestion: LegalityResult['augmentedSuggestion']
  const hasFdpViolation = checks.some((c) => c.label.startsWith('FDP') && c.status === 'violation')

  if ((!crewConfig || effectiveCockpitCount <= 2) && hasFdpViolation && ruleSet.augmentedLimits.length > 0) {
    const maxActualFdp = Math.max(...fdpMinutesForDay)

    // Only suggest limits compatible with the aircraft's rest facility class
    const acFacility = crewConfig?.facilityClass ?? null
    const compatible = acFacility
      ? ruleSet.augmentedLimits.filter((a) => a.facilityClass === acFacility)
      : ruleSet.augmentedLimits

    const sorted = [...compatible].sort((a, b) => a.crewCount - b.crewCount || a.maxFdpMinutes - b.maxFdpMinutes)

    for (const aug of sorted) {
      if (aug.maxFdpMinutes >= maxActualFdp) {
        augmentedSuggestion = {
          complementKey: aug.crewCount === 3 ? 'aug1' : 'aug2',
          cockpitCount: aug.crewCount,
          facilityClass: aug.facilityClass,
          facilityLabel: aug.facilityLabel,
          maxFdpMinutes: aug.maxFdpMinutes,
        }
        break
      }
    }
  }

  return {
    overallStatus,
    checks,
    tableRef: primaryTableRef,
    openPairing,
    crossBase,
    augmentedSuggestion,
    isMult: isMult || undefined,
  }
}
