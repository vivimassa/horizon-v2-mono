import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AutoRosterRun } from '../models/AutoRosterRun.js'
import { Airport } from '../models/Airport.js'
import { CrewMember } from '../models/CrewMember.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { CrewQualification } from '../models/CrewQualification.js'
import { CrewGroup } from '../models/CrewGroup.js'
import { CrewGroupAssignment } from '../models/CrewGroupAssignment.js'
import { Pairing } from '../models/Pairing.js'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewActivity } from '../models/CrewActivity.js'
import { ActivityCode } from '../models/ActivityCode.js'
import { CrewComplement } from '../models/CrewComplement.js'
import { OperatorSchedulingConfig } from '../models/OperatorSchedulingConfig.js'
import { runAutoRoster, type AutoRosterEvent } from '../services/auto-roster-orchestrator.js'

const LEAVE_FLAGS = ['is_annual_leave', 'is_sick_leave', 'is_medical']
const DAYOFF_FLAGS = ['is_day_off', 'is_rest_period']
const STANDBY_HOME_FLAGS = ['is_home_standby']
const STANDBY_AIRPORT_FLAGS = ['is_airport_standby', 'is_reserve']
const STANDBY_FLAGS = [...STANDBY_HOME_FLAGS, ...STANDBY_AIRPORT_FLAGS]
const TRAINING_FLAGS = ['is_training', 'is_simulator']
const GROUND_DUTY_FLAGS = ['is_ground_duty']

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

// In-flight run registry: runId → AbortController
const activeRuns = new Map<string, AbortController>()

// Per-run event fan-out: orchestrator emits here, SSE subscribers receive.
// Keeps a short ring buffer so a late SSE connection replays recent events.
type RunBus = {
  subscribers: Set<(e: AutoRosterEvent) => void>
  recent: AutoRosterEvent[]
  done: boolean
}
const runBuses = new Map<string, RunBus>()
const RING_SIZE = 64

function getOrCreateBus(runId: string): RunBus {
  let bus = runBuses.get(runId)
  if (!bus) {
    bus = { subscribers: new Set(), recent: [], done: false }
    runBuses.set(runId, bus)
  }
  return bus
}

function emitToBus(runId: string, event: AutoRosterEvent): void {
  const bus = getOrCreateBus(runId)
  bus.recent.push(event)
  if (bus.recent.length > RING_SIZE) bus.recent.shift()
  console.log(`[auto-roster bus] ${runId.slice(0, 8)} ${event.event} subs=${bus.subscribers.size}`, event.data)
  for (const fn of bus.subscribers) {
    try {
      fn(event)
    } catch (err) {
      console.error('[auto-roster bus] subscriber threw', err)
    }
  }
  // Persist latest progress snapshot to the run doc so a late-arriving client
  // (screen refresh, second planner opening Step 3) can paint the UI at the
  // right pct + message without waiting for the next SSE tick. Also
  // keeps lastProgressAt current for stale-lock sweep.
  if (event.event === 'progress') {
    const data = event.data as { pct?: number; message?: string } | undefined
    void AutoRosterRun.updateOne(
      { _id: runId },
      {
        lastProgressAt: new Date().toISOString(),
        lastProgressPct: Math.round(data?.pct ?? 0),
        lastProgressMessage: data?.message ?? null,
        updatedAt: new Date().toISOString(),
      },
    ).catch(() => null)
  }
  if (event.event === 'committed' || event.event === 'error') {
    bus.done = true
    setTimeout(() => runBuses.delete(runId), 30_000)
  }
}

export async function autoRosterRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /auto-roster/filter-options — distinct bases, positions, acTypes, groups ─
  app.get('/auto-roster/filter-options', async (req, reply) => {
    const operatorId = (req.query as Record<string, string>).operatorId ?? req.operatorId
    const crewFilter = { operatorId, status: { $in: ['active', 'suspended'] } }
    const [baseIds, positionIds, acTypes, crewGroups] = await Promise.all([
      CrewMember.distinct('base', { ...crewFilter, base: { $ne: null } }),
      CrewMember.distinct('position', { ...crewFilter, position: { $ne: null } }),
      CrewQualification.distinct('aircraftType', { operatorId }),
      CrewGroup.find({ operatorId, isActive: true }).select('_id name').sort({ sortOrder: 1, name: 1 }).lean(),
    ])
    // Resolve UUID references → human-readable codes
    const [airports, crewPositions] = await Promise.all([
      Airport.find({ _id: { $in: baseIds } })
        .select('_id iataCode icaoCode')
        .lean(),
      CrewPosition.find({ _id: { $in: positionIds }, operatorId })
        .select('_id code')
        .lean(),
    ])
    const airportCodeMap = new Map(
      (airports as { _id: string; iataCode?: string; icaoCode: string }[]).map((a) => [
        a._id,
        a.iataCode || a.icaoCode,
      ]),
    )
    const positionCodeMap = new Map((crewPositions as { _id: string; code: string }[]).map((p) => [p._id, p.code]))
    const bases = (baseIds as string[])
      .map((id) => airportCodeMap.get(id))
      .filter(Boolean)
      .sort() as string[]
    const positions = (positionIds as string[])
      .map((id) => positionCodeMap.get(id))
      .filter(Boolean)
      .sort() as string[]
    return reply.send({
      bases,
      positions,
      acTypes: (acTypes as string[]).filter(Boolean).sort(),
      crewGroups: (crewGroups as { _id: string; name: string }[]).map((g) => ({ id: String(g._id), name: g.name })),
    })
  })

  // ── GET /auto-roster/period-breakdown — per-day crew state + aggregate ─
  app.get('/auto-roster/period-breakdown', async (req, reply) => {
    const raw = req.query as Record<string, string | string[] | undefined>
    // Normalize scalars + arrays (Fastify gives `?x=a&x=b` as array, `?x=a` as scalar).
    const asArray = (v: string | string[] | undefined): string[] => {
      if (v == null) return []
      return Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []
    }
    const asString = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))

    const operatorId = asString(raw.operatorId) || req.operatorId
    const periodFrom = asString(raw.periodFrom)
    const periodTo = asString(raw.periodTo)
    const baseList = asArray(raw.base)
    const positionList = asArray(raw.position)
    const acTypeList = asArray(raw.acType)
    const crewGroupList = asArray(raw.crewGroup)

    if (!periodFrom || !periodTo) {
      return reply.code(400).send({ error: 'periodFrom and periodTo required (YYYY-MM-DD)' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(periodTo)) {
      return reply.code(400).send({ error: 'periodFrom and periodTo must be YYYY-MM-DD' })
    }

    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }
    const periodStart = `${periodFrom}T00:00:00.000Z`
    const periodEnd = `${periodTo}T23:59:59.999Z`

    // Resolve base / position lists. Accepts airport _id (UUID) or IATA/ICAO
    // code, and position _id (UUID) or code — so the UI may pass whichever key.
    const [baseAirports, crewPositionDocs] = await Promise.all([
      baseList.length > 0
        ? Airport.find({
            $or: [{ _id: { $in: baseList } }, { iataCode: { $in: baseList } }, { icaoCode: { $in: baseList } }],
          })
            .select('_id iataCode icaoCode')
            .lean()
        : [],
      positionList.length > 0
        ? CrewPosition.find({ operatorId, $or: [{ _id: { $in: positionList } }, { code: { $in: positionList } }] })
            .select('_id code')
            .lean()
        : [],
    ])
    const baseIds = (baseAirports as Array<{ _id: string }>).map((b) => b._id)
    const positionIds = (crewPositionDocs as Array<{ _id: string }>).map((p) => p._id)

    // Build crew filter from optional query params
    const crewBaseFilter: Record<string, unknown> = { operatorId, status: { $in: ['active', 'suspended'] } }
    if (baseList.length > 0) crewBaseFilter.base = { $in: baseIds.length ? baseIds : ['__no_match__'] }
    if (positionList.length > 0) crewBaseFilter.position = { $in: positionIds.length ? positionIds : ['__no_match__'] }

    // Pairing-side filter values (IATA codes).
    const baseIataList = (baseAirports as Array<{ iataCode?: string; icaoCode?: string }>)
      .map((b) => b.iataCode ?? b.icaoCode ?? null)
      .filter((x): x is string => !!x)
    const positionCodeList = (crewPositionDocs as Array<{ code: string }>).map((p) => p.code)
    // Single values kept for legacy "pairing-narrow-by-one-position" demand math.
    const positionCode = positionCodeList.length === 1 ? positionCodeList[0] : null

    // Resolve acType + crewGroup id filters (intersection when both set).
    let idFilter: Set<string> | null = null
    if (acTypeList.length > 0) {
      const ids = (await CrewQualification.distinct('crewId', {
        operatorId,
        aircraftType: { $in: acTypeList },
      })) as string[]
      idFilter = new Set(ids)
    }
    if (crewGroupList.length > 0) {
      const ids = (await CrewGroupAssignment.distinct('crewId', {
        operatorId,
        groupId: { $in: crewGroupList },
      })) as string[]
      idFilter = idFilter ? new Set(ids.filter((id) => idFilter!.has(id))) : new Set(ids)
    }
    if (idFilter !== null) {
      crewBaseFilter._id = { $in: [...idFilter] }
    }

    // Phase 1: resolve code IDs + crew total + scheduling config
    const [
      leaveCodeIds,
      dayoffCodeIds,
      standbyHomeCodeIds,
      standbyAirportCodeIds,
      trainingCodeIds,
      groundDutyCodeIds,
      crewTotal,
      schedulingConfig,
    ] = await Promise.all([
      ActivityCode.find({ operatorId, flags: { $in: LEAVE_FLAGS } }).distinct('_id'),
      ActivityCode.find({ operatorId, flags: { $in: DAYOFF_FLAGS } }).distinct('_id'),
      ActivityCode.find({ operatorId, flags: { $in: STANDBY_HOME_FLAGS } }).distinct('_id'),
      ActivityCode.find({ operatorId, flags: { $in: STANDBY_AIRPORT_FLAGS } }).distinct('_id'),
      ActivityCode.find({ operatorId, flags: { $in: TRAINING_FLAGS } }).distinct('_id'),
      ActivityCode.find({ operatorId, flags: { $in: GROUND_DUTY_FLAGS } }).distinct('_id'),
      CrewMember.countDocuments(crewBaseFilter),
      (async () => {
        // Mirror orchestrator scope: per-user config wins, operator default is fallback.
        // Prevents slider edits from looking ignored when the user has their own override.
        if (req.userId) {
          const userDoc = await OperatorSchedulingConfig.findOne({ operatorId, userId: req.userId }).lean()
          if (userDoc) return userDoc
        }
        return OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
      })(),
    ])
    const standbyCodeIds = [...standbyHomeCodeIds, ...standbyAirportCodeIds]

    // Projection knobs from scheduling config (fallbacks match schema defaults).
    const minDaysOffPerPeriod =
      (schedulingConfig as { daysOff?: { minPerPeriodDays?: number } } | null)?.daysOff?.minPerPeriodDays ?? 8
    const standbyCfg =
      (
        schedulingConfig as {
          standby?: { usePercentage?: boolean; minPerDayFlat?: number; minPerDayPct?: number }
        } | null
      )?.standby ?? {}
    const standbyUsePct = standbyCfg.usePercentage !== false
    const standbyMinFlat = standbyCfg.minPerDayFlat ?? 2
    const standbyMinPct = standbyCfg.minPerDayPct ?? 10

    const allCodeIds = [
      ...new Set([...leaveCodeIds, ...dayoffCodeIds, ...standbyCodeIds, ...trainingCodeIds, ...groundDutyCodeIds]),
    ]

    // When filters active, restrict activities/assignments to filtered crew
    const anyCrewFilter =
      baseList.length > 0 || positionList.length > 0 || acTypeList.length > 0 || crewGroupList.length > 0
    const filteredCrewIds = anyCrewFilter ? ((await CrewMember.distinct('_id', crewBaseFilter)) as string[]) : null

    // Phase 2: fetch all data in period
    const activityCrewFilter = filteredCrewIds ? { crewId: { $in: filteredCrewIds } } : {}
    const [activities, assignments, pairingDocs] = await Promise.all([
      allCodeIds.length > 0
        ? CrewActivity.find({
            operatorId,
            ...activityCrewFilter,
            activityCodeId: { $in: allCodeIds },
            startUtcIso: { $lte: periodEnd },
            endUtcIso: { $gte: periodStart },
          })
            .select('crewId activityCodeId startUtcIso endUtcIso')
            .lean()
        : Promise.resolve([]),
      CrewAssignment.find({
        operatorId,
        ...activityCrewFilter,
        scenarioId: scenarioFilter,
        status: { $ne: 'cancelled' },
        startUtcIso: { $lte: periodEnd },
        endUtcIso: { $gte: periodStart },
      })
        .select('crewId pairingId startUtcIso endUtcIso')
        .lean(),
      (() => {
        const pairingFilter: Record<string, unknown> = {
          operatorId,
          scenarioId: scenarioFilter,
          startDate: { $lte: periodTo },
          endDate: { $gte: periodFrom },
        }
        if (baseList.length > 0) {
          pairingFilter.baseAirport = baseIataList.length > 0 ? { $in: baseIataList } : '__no_match__'
        }
        if (acTypeList.length > 0) {
          pairingFilter.aircraftTypeIcao = { $in: acTypeList }
        }
        return Pairing.find(pairingFilter)
          .select('_id startDate endDate workflowStatus totalBlockMinutes aircraftTypeIcao complementKey crewCounts')
          .lean()
      })(),
    ])

    // Load complements once (needed for seat counts + optional position narrow).
    const complements = await CrewComplement.find({ operatorId, isActive: true })
      .select('aircraftTypeIcao templateKey counts')
      .lean()
    const complementIndex = new Map<string, Record<string, number>>()
    for (const c of complements) {
      const counts =
        c.counts instanceof Map
          ? (Object.fromEntries(c.counts) as Record<string, number>)
          : ((c.counts ?? {}) as Record<string, number>)
      complementIndex.set(`${c.aircraftTypeIcao}/${c.templateKey}`, counts)
    }

    // Resolve per-pairing seat demand (respects position filter).
    //   - Position filter set → seats = sum of counts for EACH selected position
    //   - Position unset      → seats = sum(all counts) = total crew needed
    type PairingDocRaw = {
      _id: unknown
      startDate: string
      endDate: string
      workflowStatus?: string
      totalBlockMinutes?: number
      aircraftTypeIcao?: string | null
      complementKey?: string | null
      crewCounts?: Record<string, number> | null
    }
    const seatsByPairingId = new Map<string, number>()
    for (const p of pairingDocs as PairingDocRaw[]) {
      const counts =
        p.crewCounts && Object.keys(p.crewCounts).length > 0
          ? p.crewCounts
          : (complementIndex.get(`${p.aircraftTypeIcao}/${p.complementKey ?? 'standard'}`) ?? {})
      const seats =
        positionCodeList.length > 0
          ? positionCodeList.reduce((s, code) => s + (counts[code] ?? 0), 0)
          : Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0)
      seatsByPairingId.set(String(p._id), seats)
    }

    // Position filter: drop pairings that don't require ANY selected position.
    let pairingDocsFiltered = pairingDocs as PairingDocRaw[]
    if (positionList.length > 0) {
      if (positionCodeList.length === 0) {
        pairingDocsFiltered = []
      } else {
        pairingDocsFiltered = pairingDocsFiltered.filter((p) => (seatsByPairingId.get(String(p._id)) ?? 0) > 0)
      }
    }

    // Build lookup sets
    const leaveSet = new Set(leaveCodeIds.map(String))
    const dayoffSet = new Set(dayoffCodeIds.map(String))
    const standbyHomeSet = new Set(standbyHomeCodeIds.map(String))
    const standbyAirportSet = new Set(standbyAirportCodeIds.map(String))
    const trainingSet = new Set(trainingCodeIds.map(String))
    const groundDutySet = new Set(groundDutyCodeIds.map(String))
    const assignedPairingIds = new Set(assignments.map((a) => String((a as { pairingId: unknown }).pairingId)))

    // Build day list
    const dayList: string[] = []
    const cur = new Date(periodFrom + 'T00:00:00Z')
    const endDt = new Date(periodTo + 'T00:00:00Z')
    while (cur <= endDt) {
      dayList.push(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

    type Activity = { crewId: unknown; activityCodeId: unknown; startUtcIso: string; endUtcIso: string }
    type Assignment = { crewId: unknown; pairingId: unknown; startUtcIso: string; endUtcIso: string }
    type PairingDoc = {
      _id: unknown
      startDate: string
      endDate: string
      workflowStatus?: string
      totalBlockMinutes?: number
    }

    // Projected day-off distribution: each crew needs minDaysOffPerPeriod off.
    // Spread evenly across the period (ceil so no day is under-resourced).
    const periodDayCount = dayList.length
    const dayOffProjectedPerDay = periodDayCount > 0 ? Math.ceil((crewTotal * minDaysOffPerPeriod) / periodDayCount) : 0

    const days = dayList.map((day) => {
      const assignedCrew = new Set<string>()
      const leaveCrew = new Set<string>()
      const dayoffCrew = new Set<string>() // actual from activities
      const standbyHomeCrew = new Set<string>()
      const standbyAirportCrew = new Set<string>()
      const trainingCrew = new Set<string>()
      const groundDutyCrew = new Set<string>()

      for (const a of assignments as Assignment[]) {
        if (a.startUtcIso.slice(0, 10) <= day && a.endUtcIso.slice(0, 10) >= day) assignedCrew.add(String(a.crewId))
      }
      for (const a of activities as Activity[]) {
        if (a.startUtcIso.slice(0, 10) <= day && a.endUtcIso.slice(0, 10) >= day) {
          const cid = String(a.activityCodeId)
          const uid = String(a.crewId)
          if (leaveSet.has(cid)) leaveCrew.add(uid)
          else if (dayoffSet.has(cid)) dayoffCrew.add(uid)
          else if (standbyHomeSet.has(cid)) standbyHomeCrew.add(uid)
          else if (standbyAirportSet.has(cid)) standbyAirportCrew.add(uid)
          else if (trainingSet.has(cid)) trainingCrew.add(uid)
          else if (groundDutySet.has(cid)) groundDutyCrew.add(uid)
        }
      }

      // Projection = pre-roster reference only. Once actuals exist (post
      // auto-roster or manual placement), report what is actually on the
      // roster. Taking Math.max here previously hid real numbers behind the
      // projection floor whenever the solver placed fewer OFF/SBY than the
      // quota target — chart looked untouched after a run.
      const dayOffEffective = dayoffCrew.size > 0 ? dayoffCrew.size : dayOffProjectedPerDay

      const dayPairings = (pairingDocsFiltered as PairingDoc[]).filter((p) => p.startDate <= day && p.endDate >= day)
      const seatsDemandDay = dayPairings.reduce((sum, p) => sum + (seatsByPairingId.get(String(p._id)) ?? 0), 0)

      // "Crew operating that day" = crew filling flight duties that day.
      // For the pre-solver projection this equals seatsDemand. Standby = %
      // of operating crew (per scheduling-config). Flat mode = absolute N.
      // On a blank roster (no pairings → seatsDemand = 0) the percentage
      // path collapses to 0, making the config slider look broken. Fall
      // back to "% of pool available that day" so changing the % actually
      // scales the projected standby.
      const standbyActual = standbyHomeCrew.size + standbyAirportCrew.size
      const poolAvailableDay = Math.max(
        0,
        crewTotal - leaveCrew.size - trainingCrew.size - groundDutyCrew.size - dayOffEffective,
      )
      const standbyProjected = standbyUsePct
        ? seatsDemandDay > 0
          ? Math.ceil(seatsDemandDay * (standbyMinPct / 100))
          : Math.max(standbyMinFlat, Math.ceil(poolAvailableDay * (standbyMinPct / 100)))
        : standbyMinFlat
      const standbyTotal = standbyActual > 0 ? standbyActual : standbyProjected
      const homeRatio = ((standbyCfg as { homeStandbyRatioPct?: number }).homeStandbyRatioPct ?? 80) / 100
      const standbyHomeEffective = standbyActual > 0 ? standbyHomeCrew.size : Math.round(standbyTotal * homeRatio)
      const standbyAirportEffective = standbyActual > 0 ? standbyAirportCrew.size : standbyTotal - standbyHomeEffective

      // Operating pool = crew not on leave/training/day-off/ground-duty.
      // Standby is drawn from this pool and can't fly regular pairings.
      const operatingCrew = Math.max(
        0,
        crewTotal - leaveCrew.size - trainingCrew.size - groundDutyCrew.size - dayOffEffective,
      )
      const availableCrewDay = Math.max(0, operatingCrew - standbyTotal)
      return {
        date: day,
        dayOfWeek: DOW[new Date(day + 'T00:00:00Z').getUTCDay()],
        assigned: assignedCrew.size,
        onLeave: leaveCrew.size,
        onDayOff: dayOffEffective,
        onStandby: standbyTotal,
        onStandbyHome: standbyHomeEffective,
        onStandbyAirport: standbyAirportEffective,
        inTraining: trainingCrew.size,
        onGroundDuty: groundDutyCrew.size,
        pairingsDemand: dayPairings.length,
        pairingsUnassigned: dayPairings.filter((p) => !assignedPairingIds.has(String(p._id))).length,
        seatsDemand: seatsDemandDay,
        availableCrew: availableCrewDay,
      }
    })

    // Crew-days math: the only honest way to judge "shortage or not".
    //   crewDaysDemand = Σ seats required by pairings active on each day
    //   crewDaysSupply = Σ crew available (pool − leave − training − day-off) per day
    // Coverage = supply / demand. Below 100% = shortage.
    const crewDaysDemand = days.reduce((s, d) => s + d.seatsDemand, 0)
    const crewDaysSupply = days.reduce((s, d) => s + d.availableCrew, 0)

    // Aggregate summary (reuse data already loaded)
    const pairingTotal = pairingDocsFiltered.length
    const pairingCommitted = (pairingDocsFiltered as PairingDoc[]).filter(
      (p) => p.workflowStatus === 'committed',
    ).length
    const alreadyAssigned = assignedPairingIds.size
    const totalBlockHours = Math.round(
      (pairingDocsFiltered as PairingDoc[]).reduce((s, p) => s + (p.totalBlockMinutes ?? 0), 0) / 60,
    )

    // Aggregate leave/training across period (distinct crew in any day)
    const periodLeaveCrew = new Set<string>()
    const periodTrainingCrew = new Set<string>()
    for (const a of activities as Activity[]) {
      const cid = String(a.activityCodeId)
      const uid = String(a.crewId)
      if (leaveSet.has(cid)) periodLeaveCrew.add(uid)
      if (trainingSet.has(cid)) periodTrainingCrew.add(uid)
    }

    return reply.send({
      crewTotal,
      summary: {
        crew: {
          total: crewTotal,
          onLeave: periodLeaveCrew.size,
          inTraining: periodTrainingCrew.size,
          available: Math.max(0, crewTotal - periodLeaveCrew.size - periodTrainingCrew.size),
          crewDaysSupply,
        },
        pairings: {
          total: pairingTotal,
          committed: pairingCommitted,
          draft: pairingTotal - pairingCommitted,
          alreadyAssigned,
          unassigned: Math.max(0, pairingTotal - alreadyAssigned),
          totalBlockHours,
          crewDaysDemand,
        },
      },
      days,
    })
  })

  // ── GET /auto-roster/period-summary — lightweight aggregate (kept for compat) ─
  app.get('/auto-roster/period-summary', async (req, reply) => {
    const q = req.query as Record<string, string>
    const operatorId = q.operatorId ?? req.operatorId
    if (!q.periodFrom || !q.periodTo) return reply.code(400).send({ error: 'periodFrom and periodTo required' })

    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }
    const periodStart = `${q.periodFrom}T00:00:00.000Z`
    const periodEnd = `${q.periodTo}T23:59:59.999Z`

    const [leaveCodeIds, trainingCodeIds] = await Promise.all([
      ActivityCode.find({ operatorId, flags: { $in: LEAVE_FLAGS } }).distinct('_id'),
      ActivityCode.find({ operatorId, flags: { $in: TRAINING_FLAGS } }).distinct('_id'),
    ])
    const [crewTotal, onLeaveIds, inTrainingIds, pairingDocs, assignedPairingIds] = await Promise.all([
      CrewMember.countDocuments({ operatorId, status: { $in: ['active', 'suspended'] } }),
      leaveCodeIds.length > 0
        ? CrewActivity.distinct('crewId', {
            operatorId,
            activityCodeId: { $in: leaveCodeIds },
            startUtcIso: { $lte: periodEnd },
            endUtcIso: { $gte: periodStart },
          })
        : Promise.resolve([] as string[]),
      trainingCodeIds.length > 0
        ? CrewActivity.distinct('crewId', {
            operatorId,
            activityCodeId: { $in: trainingCodeIds },
            startUtcIso: { $lte: periodEnd },
            endUtcIso: { $gte: periodStart },
          })
        : Promise.resolve([] as string[]),
      Pairing.find({
        operatorId,
        scenarioId: scenarioFilter,
        startDate: { $lte: q.periodTo },
        endDate: { $gte: q.periodFrom },
      })
        .select('workflowStatus totalBlockMinutes')
        .lean(),
      CrewAssignment.distinct('pairingId', {
        operatorId,
        scenarioId: scenarioFilter,
        status: { $ne: 'cancelled' },
        startUtcIso: { $lte: periodEnd },
        endUtcIso: { $gte: periodStart },
      }),
    ])
    const pairingTotal = pairingDocs.length
    const pairingCommitted = pairingDocs.filter(
      (p) => (p as { workflowStatus?: string }).workflowStatus === 'committed',
    ).length
    return reply.send({
      crew: {
        total: crewTotal,
        onLeave: onLeaveIds.length,
        inTraining: inTrainingIds.length,
        available: Math.max(0, crewTotal - onLeaveIds.length - inTrainingIds.length),
      },
      pairings: {
        total: pairingTotal,
        committed: pairingCommitted,
        draft: pairingTotal - pairingCommitted,
        alreadyAssigned: assignedPairingIds.length,
        unassigned: Math.max(0, pairingTotal - assignedPairingIds.length),
        totalBlockHours: Math.round(
          pairingDocs.reduce((s, p) => s + ((p as { totalBlockMinutes?: number }).totalBlockMinutes ?? 0), 0) / 60,
        ),
      },
    })
  })

  // ── POST /auto-roster/run — start a new auto-roster run ───────────────
  app.post('/auto-roster/run', { preHandler: requireOpsRole }, async (req, reply) => {
    const body = req.body as {
      operatorId?: string
      periodFrom?: string
      periodTo?: string
      timeLimitSec?: number
      mode?: 'general' | 'daysOff' | 'standby' | 'longDuties' | 'training'
      longDutiesMinDays?: number
      daysOffActivityCodeId?: string | null
      base?: string | null
      position?: string | null
      acType?: string | string[] | null
      crewGroup?: string | string[] | null
    }

    const operatorId = body.operatorId ?? req.operatorId
    if (!body.periodFrom || !body.periodTo) {
      return reply.code(400).send({ error: 'periodFrom and periodTo required (YYYY-MM-DD)' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.periodFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(body.periodTo)) {
      return reply.code(400).send({ error: 'periodFrom and periodTo must be YYYY-MM-DD' })
    }

    const mode = body.mode ?? 'general'
    const validModes = ['general', 'daysOff', 'standby', 'longDuties', 'training'] as const
    if (!validModes.includes(mode as (typeof validModes)[number])) {
      return reply.code(400).send({ error: `mode must be one of: ${validModes.join(', ')}` })
    }
    if (mode === 'training') {
      return reply.code(501).send({ error: 'Training assignment mode not yet implemented' })
    }
    const longDutiesMinDays = Math.min(14, Math.max(1, body.longDutiesMinDays ?? 2))

    const timeLimitSec = Math.min(7200, Math.max(10, body.timeLimitSec ?? 1800))
    const runId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Sweep stale locks — if a prior run's process died without writing a
    // terminal state, its row is still `running`. Age-out based on
    // lastProgressAt (or startedAt if no progress event was recorded).
    // 5 min idle window is comfortable for normal solver ticks (~1/s).
    const staleCutoff = new Date(Date.now() - 5 * 60_000).toISOString()
    await AutoRosterRun.updateMany(
      {
        operatorId,
        status: 'running',
        $or: [{ lastProgressAt: { $lt: staleCutoff } }, { lastProgressAt: null, startedAt: { $lt: staleCutoff } }],
      },
      {
        status: 'failed',
        error: 'Stale lock — orchestrator did not emit progress for 5 min',
        completedAt: now,
        updatedAt: now,
      },
    )

    // Single-run lock per operator. Another planner's run in flight → 409.
    const existing = await AutoRosterRun.findOne({
      operatorId,
      status: { $in: ['queued', 'running'] },
    }).lean()
    if (existing) {
      return reply.code(409).send({
        error: 'Another auto-roster run is already in progress for this operator',
        runId: existing._id,
        startedByUserId: (existing as { startedByUserId?: string | null }).startedByUserId ?? null,
        startedByUserName: (existing as { startedByUserName?: string | null }).startedByUserName ?? null,
        startedAt: existing.startedAt,
        pct: (existing as { lastProgressPct?: number }).lastProgressPct ?? 0,
        message: (existing as { lastProgressMessage?: string | null }).lastProgressMessage ?? null,
      })
    }

    // Resolve the caller's display name once so the lock banner other
    // planners see has something friendlier than a UUID.
    const userName = (req as { userName?: string | null }).userName ?? null

    await AutoRosterRun.create({
      _id: runId,
      operatorId,
      periodFrom: body.periodFrom,
      periodTo: body.periodTo,
      status: 'queued',
      startedAt: null,
      completedAt: null,
      startedByUserId: req.userId ?? null,
      startedByUserName: userName,
      lastProgressAt: now,
      lastProgressPct: 0,
      lastProgressMessage: 'Starting…',
      stats: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    })

    // Fire-and-forget — progress streamed via GET /:runId/stream.
    // Events flow through an in-memory bus so late SSE subscribers can
    // catch up via the ring buffer.
    const ac = new AbortController()
    activeRuns.set(runId, ac)
    getOrCreateBus(runId)

    const toArr = (v: string | string[] | null | undefined): string[] | null =>
      v == null ? null : Array.isArray(v) ? v : [v]

    void runAutoRoster(
      runId,
      operatorId,
      body.periodFrom,
      body.periodTo,
      timeLimitSec,
      (event) => emitToBus(runId, event),
      ac.signal,
      req.userId ?? null,
      mode as 'general' | 'daysOff' | 'standby' | 'longDuties',
      longDutiesMinDays,
      {
        base: body.base ?? null,
        position: body.position ?? null,
        acTypes: toArr(body.acType),
        crewGroupIds: toArr(body.crewGroup),
      },
      body.daysOffActivityCodeId ?? null,
    ).finally(() => activeRuns.delete(runId))

    return reply.code(202).send({ runId })
  })

  // ── GET /auto-roster/:runId/stream — SSE progress stream ─────────────
  app.get('/auto-roster/:runId/stream', async (req, reply) => {
    const { runId } = req.params as { runId: string }
    const operatorId = req.operatorId

    const doc = await AutoRosterRun.findOne({ _id: runId, operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Run not found' })

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    })

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    // If already terminal, send final state immediately
    if (doc.status === 'completed' || doc.status === 'failed' || doc.status === 'cancelled') {
      send(doc.status === 'completed' ? 'solution' : 'error', {
        status: doc.status,
        stats: doc.stats,
        error: doc.error,
      })
      reply.raw.end()
      return reply
    }

    // Subscribe to the in-memory event bus for live events
    const bus = getOrCreateBus(runId)
    let ended = false
    const endStream = () => {
      if (ended) return
      ended = true
      bus.subscribers.delete(forward)
      reply.raw.end()
    }

    const forward = (event: AutoRosterEvent) => {
      if (ended) return
      send(event.event, event.data)
      if (event.event === 'committed' || event.event === 'error') endStream()
    }

    // Replay any events the orchestrator already emitted before subscribe
    for (const event of bus.recent) send(event.event, event.data)
    if (bus.done) {
      endStream()
      return reply
    }

    bus.subscribers.add(forward)
    req.socket.on('close', endStream)

    // If orchestrator isn't running (e.g. server restart lost state),
    // re-drive it and wire its events through the bus.
    if (!activeRuns.has(runId)) {
      const newAc = new AbortController()
      activeRuns.set(runId, newAc)

      void runAutoRoster(
        runId,
        operatorId,
        doc.periodFrom,
        doc.periodTo,
        60,
        (event: AutoRosterEvent) => emitToBus(runId, event),
        newAc.signal,
        req.userId ?? null,
      ).finally(() => activeRuns.delete(runId))
    }

    // Heartbeat so proxies / EventSource don't drop the connection on long
    // FDTL pre-compiles with no orchestrator progress yet.
    const heartbeat = setInterval(() => {
      if (ended) {
        clearInterval(heartbeat)
        return
      }
      reply.raw.write(`: ping\n\n`)
    }, 15_000)
    req.socket.on('close', () => clearInterval(heartbeat))

    return reply
  })

  // ── GET /auto-roster/:runId — fetch a single run doc ─────────────────
  app.get('/auto-roster/:runId', async (req, reply) => {
    const { runId } = req.params as { runId: string }
    const doc = await AutoRosterRun.findOne({ _id: runId, operatorId: req.operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Run not found' })
    return doc
  })

  // ── DELETE /auto-roster/:runId — cancel an in-flight run ─────────────
  app.delete('/auto-roster/:runId', { preHandler: requireOpsRole }, async (req, reply) => {
    const { runId } = req.params as { runId: string }
    const doc = await AutoRosterRun.findOne({ _id: runId, operatorId: req.operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Run not found' })
    if (doc.status !== 'queued' && doc.status !== 'running') {
      return reply.code(409).send({ error: `Run is already ${doc.status}` })
    }

    const ac = activeRuns.get(runId)
    if (ac) {
      ac.abort()
      activeRuns.delete(runId)
    }

    await AutoRosterRun.updateOne(
      { _id: runId },
      { status: 'cancelled', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    )

    return { success: true }
  })

  // ── GET /auto-roster/active — return the currently running run (if any)
  // for this operator. Used by Step 3 on mount to reattach after a refresh,
  // and to show a "locked by X" banner to other planners.
  app.get('/auto-roster/active', async (req, reply) => {
    const operatorId = (req.query as Record<string, string>).operatorId ?? req.operatorId

    // Age out stale locks first so a dead orchestrator doesn't keep the UI
    // locked forever. Same 5-min idle window as POST /run.
    const staleCutoff = new Date(Date.now() - 5 * 60_000).toISOString()
    const nowIso = new Date().toISOString()
    await AutoRosterRun.updateMany(
      {
        operatorId,
        status: 'running',
        $or: [{ lastProgressAt: { $lt: staleCutoff } }, { lastProgressAt: null, startedAt: { $lt: staleCutoff } }],
      },
      {
        status: 'failed',
        error: 'Stale lock — orchestrator did not emit progress for 5 min',
        completedAt: nowIso,
        updatedAt: nowIso,
      },
    )

    const active = await AutoRosterRun.findOne({
      operatorId,
      status: { $in: ['queued', 'running'] },
    }).lean()
    if (!active) return reply.send({ active: null })
    return reply.send({
      active: {
        runId: active._id,
        status: active.status,
        startedAt: active.startedAt,
        startedByUserId: (active as { startedByUserId?: string | null }).startedByUserId ?? null,
        startedByUserName: (active as { startedByUserName?: string | null }).startedByUserName ?? null,
        pct: (active as { lastProgressPct?: number }).lastProgressPct ?? 0,
        message: (active as { lastProgressMessage?: string | null }).lastProgressMessage ?? null,
        periodFrom: active.periodFrom,
        periodTo: active.periodTo,
        lockedForYou: (active as { startedByUserId?: string | null }).startedByUserId !== (req.userId ?? null),
      },
    })
  })

  // ── GET /auto-roster/history — list runs for operator ─────────────────
  app.get('/auto-roster/history', async (req, reply) => {
    const q = req.query as { operatorId?: string; limit?: string }
    const operatorId = q.operatorId ?? req.operatorId
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10)))

    const runs = await AutoRosterRun.find({ operatorId }).sort({ createdAt: -1 }).limit(limit).lean()

    return runs
  })
}
