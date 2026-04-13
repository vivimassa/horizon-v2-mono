import type { FastifyInstance } from 'fastify'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { MaintenanceEvent } from '../models/MaintenanceEvent.js'
import { MaintenanceCheckType } from '../models/MaintenanceCheckType.js'
import { AircraftCheckStatus } from '../models/AircraftCheckStatus.js'
import { AircraftCheckInterval } from '../models/AircraftCheckInterval.js'
import { AircraftCumulative } from '../models/AircraftCumulative.js'

// ── Constants ──

const LINE_CHECK_CODES = new Set(['TR', 'DY', 'WK'])
const DAY_MS = 86_400_000

// ── Helpers ──

/** Compute percent consumed for a check axis: (interval - remaining) / interval * 100 */
function pctConsumed(interval: number | null | undefined, remaining: number | null | undefined): number {
  if (!interval || interval <= 0) return 0
  if (remaining == null) return 0
  return Math.round(((interval - remaining) / interval) * 1000) / 10 // one decimal
}

/** Get the best (largest) percent consumed across all three axes for a check status row */
function bestPctConsumed(
  cs: { remainingHours?: number | null; remainingCycles?: number | null; remainingDays?: number | null },
  interval: { hoursInterval?: number | null; cyclesInterval?: number | null; daysInterval?: number | null },
): number {
  return Math.max(
    pctConsumed(interval.hoursInterval, cs.remainingHours),
    pctConsumed(interval.cyclesInterval, cs.remainingCycles),
    pctConsumed(interval.daysInterval, cs.remainingDays),
  )
}

// ── Routes ──

export async function aircraftStatusBoardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/aircraft-status-board', async (req) => {
    const q = req.query as Record<string, string>
    const operatorId = q.operatorId || req.operatorId
    if (!operatorId) {
      return { aircraft: [], kpis: emptyKpis(), filterOptions: { aircraftTypes: [], bases: [], checkTypes: [] } }
    }

    const date = q.date || new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // ────────────────────────────────────────────────
    // 1. Fetch all active aircraft + supporting reference data
    // ────────────────────────────────────────────────
    const [aircraft, acTypes, checkTypes] = await Promise.all([
      AircraftRegistration.find({ operatorId, isActive: true })
        .select('_id registration aircraftTypeId homeBaseIcao status')
        .sort({ registration: 1 })
        .lean(),
      AircraftType.find({ operatorId }).select('_id icaoType name color').lean(),
      MaintenanceCheckType.find({ operatorId, isActive: true })
        .select('_id code name color sortOrder defaultHoursInterval defaultCyclesInterval defaultDaysInterval')
        .lean(),
    ])

    if (aircraft.length === 0) {
      return {
        aircraft: [],
        kpis: emptyKpis(),
        filterOptions: buildFilterOptions(acTypes, aircraft, checkTypes),
      }
    }

    const aircraftIds = aircraft.map((a) => a._id)
    const acTypeMap = new Map(acTypes.map((t) => [t._id, t]))
    const ctMap = new Map(checkTypes.map((c) => [c._id, c]))

    // ────────────────────────────────────────────────
    // 2. Batch-fetch all data we need in parallel
    // ────────────────────────────────────────────────
    const [flights, mxEvents, checkStatuses, intervals, cumulatives] = await Promise.all([
      // Today's flights for all aircraft (match by tail.registration)
      FlightInstance.find({
        operatorId,
        operatingDate: date,
        status: { $ne: 'cancelled' },
      }).lean(),

      // All non-cancelled maintenance events for these aircraft
      MaintenanceEvent.find({
        operatorId,
        aircraftId: { $in: aircraftIds },
        status: { $ne: 'cancelled' },
      }).lean(),

      // Check status records
      AircraftCheckStatus.find({
        operatorId,
        aircraftId: { $in: aircraftIds },
      }).lean(),

      // Per-aircraft check intervals (overrides)
      AircraftCheckInterval.find({
        operatorId,
        aircraftId: { $in: aircraftIds },
      }).lean(),

      // Cumulative FH/FC
      AircraftCumulative.find({
        operatorId,
        aircraftId: { $in: aircraftIds },
      }).lean(),
    ])

    // ────────────────────────────────────────────────
    // 3. Index data by aircraft
    // ────────────────────────────────────────────────

    // Flights indexed by tail registration (since FlightInstance uses tail.registration, not aircraftId)
    const regToAcId = new Map(aircraft.map((a) => [a.registration, a._id]))
    const flightsByAcId = new Map<string, typeof flights>()
    for (const f of flights) {
      const reg = f.tail?.registration
      if (!reg) continue
      const acId = regToAcId.get(reg)
      if (!acId) continue
      const list = flightsByAcId.get(acId) || []
      list.push(f)
      flightsByAcId.set(acId, list)
    }

    // Maintenance events by aircraft
    const mxByAcId = new Map<string, typeof mxEvents>()
    for (const ev of mxEvents) {
      const list = mxByAcId.get(ev.aircraftId) || []
      list.push(ev)
      mxByAcId.set(ev.aircraftId, list)
    }

    // Check statuses by aircraft
    const csByAcId = new Map<string, typeof checkStatuses>()
    for (const cs of checkStatuses) {
      const list = csByAcId.get(cs.aircraftId) || []
      list.push(cs)
      csByAcId.set(cs.aircraftId, list)
    }

    // Intervals by aircraft+checkType key
    const intervalMap = new Map(intervals.map((i) => [`${i.aircraftId}:${i.checkTypeId}`, i]))

    // Cumulatives by aircraft
    const cumMap = new Map(cumulatives.map((c) => [c.aircraftId, c]))

    // ────────────────────────────────────────────────
    // 4. KPI accumulators
    // ────────────────────────────────────────────────
    let serviceableCount = 0
    let attentionCount = 0
    let criticalCount = 0
    let inCheckCount = 0
    const upcomingChecks = { within7d: 0, within14d: 0, within30d: 0, within60d: 0 }
    const activeMaintenance = { arrived: 0, inducted: 0, inWork: 0, qa: 0, released: 0 }
    let aogCount = 0
    let deferralCount = 0
    let oldestDeferralDays: number | null = null

    // Count deferred events + active maintenance phases globally
    const now = Date.now()
    for (const ev of mxEvents) {
      if (ev.status === 'deferred') {
        deferralCount++
        if (ev.plannedStartUtc) {
          const daysAgo = Math.floor((now - new Date(ev.plannedStartUtc).getTime()) / DAY_MS)
          if (oldestDeferralDays === null || daysAgo > oldestDeferralDays) {
            oldestDeferralDays = daysAgo
          }
        }
      }
      if (ev.status === 'in_progress' && ev.phase) {
        if (ev.phase === 'arrived') activeMaintenance.arrived++
        else if (ev.phase === 'inducted') activeMaintenance.inducted++
        else if (ev.phase === 'in_work') activeMaintenance.inWork++
        else if (ev.phase === 'qa') activeMaintenance.qa++
        else if (ev.phase === 'released') activeMaintenance.released++
      }
    }

    // Count checks due within N days (from check statuses with forecastDueDate)
    for (const cs of checkStatuses) {
      if (!cs.forecastDueDate) continue
      const ct = ctMap.get(cs.checkTypeId)
      if (ct && LINE_CHECK_CODES.has(ct.code)) continue // skip line checks
      const daysUntil = Math.floor((new Date(cs.forecastDueDate).getTime() - now) / DAY_MS)
      if (daysUntil <= 60) upcomingChecks.within60d++
      if (daysUntil <= 30) upcomingChecks.within30d++
      if (daysUntil <= 14) upcomingChecks.within14d++
      if (daysUntil <= 7) upcomingChecks.within7d++
    }

    // ────────────────────────────────────────────────
    // 5. Build per-aircraft data
    // ────────────────────────────────────────────────
    const aircraftRows = aircraft.map((ac) => {
      const acType = acTypeMap.get(ac.aircraftTypeId)
      const acFlights = flightsByAcId.get(ac._id) || []
      const acMxEvents = mxByAcId.get(ac._id) || []
      const acCheckStatuses = csByAcId.get(ac._id) || []
      const cum = cumMap.get(ac._id)

      // ── Operational Status ──
      const hasAirborne = acFlights.some((f) => f.actual?.atdUtc != null && f.actual?.ataUtc == null)
      const hasInProgressMx = acMxEvents.some((ev) => ev.status === 'in_progress')
      const operationalStatus: 'AIRBORNE' | 'MAINTENANCE' | 'ON_GROUND' = hasAirborne
        ? 'AIRBORNE'
        : hasInProgressMx
          ? 'MAINTENANCE'
          : 'ON_GROUND'

      if (hasInProgressMx) inCheckCount++

      // ── Health Status ──
      let healthStatus: 'serviceable' | 'attention' | 'critical' = 'serviceable'

      for (const cs of acCheckStatuses) {
        const ct = ctMap.get(cs.checkTypeId)
        if (!ct) continue
        const isLineCheck = LINE_CHECK_CODES.has(ct.code)
        const ovKey = `${ac._id}:${cs.checkTypeId}`
        const ov = intervalMap.get(ovKey)
        const hoursInt = ov?.hoursInterval ?? ct.defaultHoursInterval ?? 0
        const cyclesInt = ov?.cyclesInterval ?? ct.defaultCyclesInterval ?? 0
        const daysInt = ov?.daysInterval ?? ct.defaultDaysInterval ?? 0
        const pct = bestPctConsumed(cs, { hoursInterval: hoursInt, cyclesInterval: cyclesInt, daysInterval: daysInt })
        const remDays = cs.remainingDays

        if (!isLineCheck) {
          // Critical: consumed >= 100% OR remaining <= 7 days
          if (pct >= 100 || (remDays != null && remDays <= 7)) {
            healthStatus = 'critical'
            break // can't get worse
          }
          // Attention: consumed >= 80% OR remaining <= 14 days
          if (pct >= 80 || (remDays != null && remDays <= 14)) {
            healthStatus = 'attention'
            // don't break — might find critical
          }
        }
      }

      if (healthStatus === 'serviceable') serviceableCount++
      else if (healthStatus === 'attention') attentionCount++
      else if (healthStatus === 'critical') criticalCount++

      // AOG: aircraft with status 'aog' or critical health + in maintenance
      if (ac.status === 'aog' || (healthStatus === 'critical' && operationalStatus === 'MAINTENANCE')) {
        aogCount++
      }

      // ── Rotation Flights ──
      const sorted = [...acFlights].sort((a, b) => (a.schedule?.stdUtc ?? 0) - (b.schedule?.stdUtc ?? 0))
      const completed = sorted.filter((f) => f.actual?.ataUtc != null)
      const upcoming = sorted.filter((f) => f.actual?.ataUtc == null)
      const last2 = completed.slice(-2)
      const next4 = upcoming.slice(0, 4)
      const rotationFlights = [...last2, ...next4].map((f) => ({
        id: f._id,
        flightNumber: f.flightNumber,
        depIcao: f.dep?.icao || '',
        arrIcao: f.arr?.icao || '',
        stdUtc: f.schedule?.stdUtc ?? 0,
        staUtc: f.schedule?.staUtc ?? 0,
        status: f.actual?.ataUtc
          ? 'completed'
          : f.actual?.atdUtc
            ? 'airborne'
            : f.status === 'cancelled'
              ? 'cancelled'
              : 'future',
      }))

      // ── Accumulated Delays ──
      let accumulatedDelayMinutes = 0
      for (const f of acFlights) {
        if (f.delays && Array.isArray(f.delays)) {
          for (const d of f.delays) {
            accumulatedDelayMinutes += d.minutes || 0
          }
        }
      }

      // ── Urgent Check ──
      // The AircraftCheckStatus with smallest remaining (across hours, cycles, or days)
      let urgentCheck: {
        checkCode: string
        checkName: string
        color: string | null
        remainingHours: number | null
        remainingCycles: number | null
        remainingDays: number | null
        percentConsumed: number
      } | null = null
      let urgentSmallestRemaining = Infinity

      for (const cs of acCheckStatuses) {
        const ct = ctMap.get(cs.checkTypeId)
        if (!ct) continue
        const ovKey = `${ac._id}:${cs.checkTypeId}`
        const ov = intervalMap.get(ovKey)
        const hoursInt = ov?.hoursInterval ?? ct.defaultHoursInterval ?? 0
        const cyclesInt = ov?.cyclesInterval ?? ct.defaultCyclesInterval ?? 0
        const daysInt = ov?.daysInterval ?? ct.defaultDaysInterval ?? 0
        const pct = bestPctConsumed(cs, { hoursInterval: hoursInt, cyclesInterval: cyclesInt, daysInterval: daysInt })

        // Normalize remaining to a comparable "days equivalent"
        // Use the smallest non-null remaining value
        const candidates: number[] = []
        if (cs.remainingDays != null) candidates.push(cs.remainingDays)
        if (cs.remainingHours != null) candidates.push(cs.remainingHours / 24) // rough days equiv
        if (cs.remainingCycles != null) candidates.push(cs.remainingCycles / 3) // rough days equiv (avg ~3 cycles/day)

        const smallest = candidates.length > 0 ? Math.min(...candidates) : Infinity
        if (smallest < urgentSmallestRemaining) {
          urgentSmallestRemaining = smallest
          urgentCheck = {
            checkCode: ct.code,
            checkName: ct.name,
            color: ct.color || null,
            remainingHours: cs.remainingHours ?? null,
            remainingCycles: cs.remainingCycles ?? null,
            remainingDays: cs.remainingDays ?? null,
            percentConsumed: pct,
          }
        }
      }

      // ── Next Event ──
      const plannedOrConfirmed = acMxEvents
        .filter((ev) => ev.status === 'planned' || ev.status === 'confirmed')
        .sort((a, b) => (a.plannedStartUtc || '').localeCompare(b.plannedStartUtc || ''))
      const nextEvRaw = plannedOrConfirmed[0] || null
      let nextEvent: { checkName: string; station: string; plannedStartUtc: string } | null = null
      if (nextEvRaw) {
        const ct = ctMap.get(nextEvRaw.checkTypeId)
        nextEvent = {
          checkName: ct?.name || 'Check',
          station: nextEvRaw.station,
          plannedStartUtc: nextEvRaw.plannedStartUtc,
        }
      }

      // ── FH / Cycles ──
      const totalFlightHours = cum?.totalFlightHours ?? 0
      const totalCycles = cum?.totalCycles ?? 0

      return {
        id: ac._id,
        registration: ac.registration,
        icaoType: acType?.icaoType || '',
        typeName: acType?.name || '',
        homeBase: ac.homeBaseIcao || null,
        currentLocation: null,
        operationalStatus,
        healthStatus,
        rotationFlights,
        accumulatedDelayMinutes,
        urgentCheck: urgentCheck
          ? { ...urgentCheck, checkTypeId: '', code: urgentCheck.checkCode, name: urgentCheck.checkName }
          : null,
        nextEvent,
        flightHours: totalFlightHours,
        cycles: totalCycles,
      }
    })

    // ────────────────────────────────────────────────
    // 6. Assemble KPIs
    // ────────────────────────────────────────────────
    const totalActive = aircraft.length
    const technicalReliability = totalActive > 0 ? Math.round((serviceableCount / totalActive) * 1000) / 10 : 0

    const kpis = {
      totalActive,
      serviceable: serviceableCount,
      attention: attentionCount,
      critical: criticalCount,
      inCheck: inCheckCount,
      technicalReliability,
      upcomingChecks,
      activeMaintenance,
      aogCount,
      deferralCount,
      oldestDeferralDays,
    }

    // ────────────────────────────────────────────────
    // 7. Filter options
    // ────────────────────────────────────────────────
    const filterOptions = buildFilterOptions(acTypes, aircraft, checkTypes)

    return { aircraft: aircraftRows, kpis, filterOptions }
  })
}

// ── Helpers ──

function emptyKpis() {
  return {
    totalActive: 0,
    serviceable: 0,
    attention: 0,
    critical: 0,
    inCheck: 0,
    technicalReliability: 0,
    upcomingChecks: { within7d: 0, within14d: 0, within30d: 0, within60d: 0 },
    activeMaintenance: { arrived: 0, inducted: 0, inWork: 0, qa: 0, released: 0 },
    aogCount: 0,
    deferralCount: 0,
    oldestDeferralDays: null,
  }
}

function buildFilterOptions(
  acTypes: { _id: unknown; icaoType: string; name: string }[],
  aircraft: { homeBaseIcao?: string | null }[],
  checkTypes: { _id: unknown; code: string; name: string }[],
) {
  const basesSet = new Set<string>()
  for (const a of aircraft) {
    if (a.homeBaseIcao) basesSet.add(a.homeBaseIcao)
  }

  return {
    aircraftTypes: acTypes.map((t) => ({ id: t._id, icaoType: t.icaoType, name: t.name })),
    bases: Array.from(basesSet).sort(),
    checkTypes: checkTypes.map((c) => ({ id: c._id, code: c.code, name: c.name })),
  }
}
