import crypto from 'node:crypto'
import { validateCrewAssignment } from '@skyhub/logic/src/fdtl/crew-schedule-validator'
import { buildScheduleDuties, buildCandidateDuty, type PairingLike } from '@skyhub/logic/src/fdtl/schedule-duty-builder'
import type { SerializedRuleSet } from '@skyhub/logic/src/fdtl/engine-types'
import { Pairing } from '../models/Pairing.js'
import { CrewMember } from '../models/CrewMember.js'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewActivity } from '../models/CrewActivity.js'
import { ActivityCode } from '../models/ActivityCode.js'
import { AutoRosterRun } from '../models/AutoRosterRun.js'
import { OperatorSchedulingConfig } from '../models/OperatorSchedulingConfig.js'
import { CrewQualification } from '../models/CrewQualification.js'
import { CrewGroupAssignment } from '../models/CrewGroupAssignment.js'
import { Airport } from '../models/Airport.js'
import { loadSerializedRuleSet } from './fdtl-rule-set.js'

export type AutoRosterFilters = {
  base?: string | null
  position?: string | null
  acTypes?: string[] | null
  crewGroupIds?: string[] | null
}

async function resolveCrewIdsForFilters(operatorId: string, filters: AutoRosterFilters): Promise<string[] | null> {
  const sets: string[][] = []
  if (filters.acTypes && filters.acTypes.length > 0) {
    const quals = await CrewQualification.find(
      { operatorId, aircraftType: { $in: filters.acTypes } },
      { crewId: 1 },
    ).lean()
    sets.push(quals.map((q) => q.crewId))
  }
  if (filters.crewGroupIds && filters.crewGroupIds.length > 0) {
    const assigns = await CrewGroupAssignment.find(
      { operatorId, crewGroupId: { $in: filters.crewGroupIds } },
      { crewId: 1 },
    ).lean()
    sets.push(assigns.map((a) => a.crewId))
  }
  if (sets.length === 0) return null
  // Intersection of all filter-derived crewId sets
  return sets.reduce((acc, s) => {
    const cur = new Set(s)
    return acc.filter((id) => cur.has(id))
  })
}

const AUTO_ROSTER_SOLVER_URL = process.env.AUTO_ROSTER_SOLVER_URL ?? 'http://localhost:8082'

export type AutoRosterEvent =
  | { event: 'progress'; data: { pct: number; message: string; best_obj: number | null } }
  | {
      event: 'solution'
      data: { assignments: Array<{ crewId: string; pairingId: string }>; stats: Record<string, unknown> }
    }
  | { event: 'error'; data: { message: string } }
  | { event: 'committed'; data: { assignedCount: number; rejectedCount: number } }

/**
 * Full auto-roster orchestration pipeline for 4.1.6.1.
 *
 * Steps:
 *  1. Load pairings + crew + FDTL ruleset + scheduling config
 *  2. Build allowed[crewId][pairingId] matrix via FDTL pre-compile
 *  3. POST to Python CP-SAT service, proxy SSE progress events
 *  4. On solution: re-validate each assignment (safety net), commit survivors
 *  5. Update AutoRosterRun doc throughout
 */
export type AutoRosterMode = 'general' | 'daysOff' | 'standby' | 'longDuties'

export async function runAutoRoster(
  runId: string,
  operatorId: string,
  periodFrom: string,
  periodTo: string,
  timeLimitSec: number,
  onEvent: (event: AutoRosterEvent) => void,
  signal?: AbortSignal,
  userId?: string | null,
  mode: AutoRosterMode = 'general',
  longDutiesMinDays: number = 2,
  filters: AutoRosterFilters = {},
): Promise<void> {
  const now = () => new Date().toISOString()

  await AutoRosterRun.updateOne({ _id: runId }, { status: 'running', startedAt: now(), updatedAt: now() })

  // Mode dispatch — daysOff/standby bypass CP-SAT entirely (they don't assign pairings)
  if (mode === 'daysOff') {
    return runDaysOffAssignment(runId, operatorId, periodFrom, periodTo, onEvent, signal, userId)
  }
  if (mode === 'standby') {
    return runStandbyAssignment(runId, operatorId, periodFrom, periodTo, onEvent, signal, userId)
  }

  try {
    onEvent({ event: 'progress', data: { pct: 2, message: 'Loading pairings and crew…', best_obj: null } })

    // ── 1. Load data ───────────────────────────────────────────────────────
    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }

    // Build filter-derived crew ID allowlist (intersection across acTypes/crewGroup filters).
    const filterCrewIds = await resolveCrewIdsForFilters(operatorId, filters)

    const crewQuery: Record<string, unknown> = { operatorId, status: { $ne: 'inactive' } }
    if (filters.base) crewQuery.base = filters.base
    if (filters.position) crewQuery.position = filters.position
    if (filterCrewIds) crewQuery._id = { $in: filterCrewIds }

    // Pairing.baseAirport stores IATA; crew filter passes airport _id (UUID).
    // Resolve UUID → IATA so we can narrow the pairing pool to the same base.
    let pairingBaseIata: string | null = null
    if (filters.base) {
      const airport = await Airport.findOne({ _id: filters.base }, { iataCode: 1 }).lean()
      pairingBaseIata = (airport as { iataCode?: string } | null)?.iataCode ?? null
    }

    const pairingQuery: Record<string, unknown> = {
      operatorId,
      scenarioId: scenarioFilter,
      endDate: { $gte: periodFrom },
      startDate: { $lte: periodTo },
    }
    if (filters.acTypes && filters.acTypes.length > 0) {
      pairingQuery.aircraftTypeIcao = { $in: filters.acTypes }
    }
    if (pairingBaseIata) {
      pairingQuery.baseAirport = pairingBaseIata
    }

    const [pairingsRaw, crew, existingAssignments, activities, schedulingConfig] = await Promise.all([
      Pairing.find(pairingQuery).lean(),
      CrewMember.find(crewQuery).lean(),
      CrewAssignment.find({
        operatorId,
        scenarioId: scenarioFilter,
        status: { $ne: 'cancelled' },
        startUtcIso: { $lte: `${periodTo}T23:59:59.999Z` },
        endUtcIso: { $gte: `${periodFrom}T00:00:00.000Z` },
      }).lean(),
      CrewActivity.find({
        operatorId,
        scenarioId: scenarioFilter,
        startUtcIso: { $lte: `${periodTo}T23:59:59.999Z` },
        endUtcIso: { $gte: `${periodFrom}T00:00:00.000Z` },
      }).lean(),
      // Per-user config takes precedence; operator default is fallback.
      (async () => {
        if (userId) {
          const userDoc = await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean()
          if (userDoc) return userDoc
        }
        return OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
      })(),
    ])

    if (signal?.aborted) return

    // Long-pairings filter: narrow pairings to those spanning ≥ N days (start→end).
    const pairings =
      mode === 'longDuties'
        ? pairingsRaw.filter((p) => {
            const startMs = new Date(p.startDate + 'T00:00:00Z').getTime()
            const endMs = new Date((p.endDate ?? p.startDate) + 'T00:00:00Z').getTime()
            const dayCount = Math.floor((endMs - startMs) / 86_400_000) + 1
            return dayCount >= longDutiesMinDays
          })
        : pairingsRaw

    if (mode === 'longDuties') {
      onEvent({
        event: 'progress',
        data: {
          pct: 4,
          message: `Long-pairing filter (≥${longDutiesMinDays} days): ${pairings.length} of ${pairingsRaw.length} pairings retained`,
          best_obj: null,
        },
      })
    }

    onEvent({ event: 'progress', data: { pct: 5, message: 'Loading FDTL ruleset…', best_obj: null } })

    const ruleSet = (await loadSerializedRuleSet(operatorId)) as SerializedRuleSet | null

    if (signal?.aborted) return

    onEvent({
      event: 'progress',
      data: {
        pct: 8,
        message: `Pre-compiling FDTL legality for ${crew.length} crew × ${pairings.length} pairings…`,
        best_obj: null,
      },
    })

    // ── 2. FDTL pre-compile ────────────────────────────────────────────────
    const pairingsById = new Map(
      pairings.map((p) => [
        p._id as string,
        p as unknown as PairingLike & { startDate: string; endDate?: string | null; layoverAirports?: string[] },
      ]),
    )
    const allowed: Record<string, string[]> = {}

    // For each crew, build their existing duties from assignments in history
    // (30-day look-back matches evaluateCrewRoster window)
    const historyFromMs = new Date(periodFrom + 'T00:00:00Z').getTime() - 30 * 86_400_000
    const historyFromIso = new Date(historyFromMs).toISOString().slice(0, 10)

    const historyAssignments = await CrewAssignment.find({
      operatorId,
      scenarioId: scenarioFilter,
      status: { $ne: 'cancelled' },
      endUtcIso: { $gte: historyFromIso },
    }).lean()

    const historyActivities = await CrewActivity.find({
      operatorId,
      scenarioId: scenarioFilter,
      endUtcIso: { $gte: historyFromIso },
    }).lean()

    const activityCodes = await ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean()
    const activityCodesById = new Map<string, { flags: string[] }>(
      activityCodes.map((c) => [c._id as string, { flags: (c.flags ?? []) as string[] }]),
    )

    const adaptActivities = (
      acts: Array<{
        _id: unknown
        crewId: string
        startUtcIso: string
        endUtcIso: string
        activityCodeId?: string | null
      }>,
    ) =>
      acts.map((x) => ({
        _id: x._id as string,
        crewId: x.crewId,
        startUtcIso: x.startUtcIso,
        endUtcIso: x.endUtcIso,
        activityCodeId: x.activityCodeId ?? null,
      }))

    for (const crewMember of crew) {
      const crewId = crewMember._id as string
      const homeBase = (crewMember as { base?: string | null }).base ?? 'XXXX'

      const existingDuties = buildScheduleDuties({
        crewId,
        assignments: historyAssignments,
        activities: adaptActivities(historyActivities),
        pairingsById,
        activityCodesById,
      })

      const legalPairingIds: string[] = []

      for (const pairing of pairings) {
        const pairingId = pairing._id as string
        const candidate = buildCandidateDuty(pairing)
        if (!candidate) continue

        const result = validateCrewAssignment({
          candidate,
          existing: existingDuties,
          homeBase,
          ruleSet,
        })

        if (result.overall !== 'violation') {
          legalPairingIds.push(pairingId)
        }
      }

      if (legalPairingIds.length > 0) {
        allowed[crewId] = legalPairingIds
      }
    }

    if (signal?.aborted) return

    const totalLegalPairs = Object.values(allowed).reduce((s, arr) => s + arr.length, 0)
    onEvent({
      event: 'progress',
      data: {
        pct: 15,
        message: `FDTL pre-compile done — ${totalLegalPairs.toLocaleString()} legal crew×pairing combinations`,
        best_obj: null,
      },
    })

    // ── 3. Build solver payload ────────────────────────────────────────────
    const genderBalanceWeight = schedulingConfig?.objectives?.genderBalanceWeight ?? 80
    const priorityOrder = (schedulingConfig?.objectives?.priorityOrder ?? []) as string[]

    const solverPayload = {
      run_id: runId,
      crew: crew.map((c) => ({
        id: c._id as string,
        gender: (c as { gender?: string | null }).gender ?? 'unknown',
      })),
      pairings: pairings.map((p) => {
        // Build day list from startDate → endDate
        const days: string[] = []
        const start = new Date(p.startDate + 'T00:00:00Z')
        const end = new Date((p.endDate ?? p.startDate) + 'T00:00:00Z')
        for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          days.push(d.toISOString().slice(0, 10))
        }
        return {
          id: p._id as string,
          days,
          bh_min: p.totalBlockMinutes ?? 0,
          layover_stations: (p as { layoverAirports?: string[] }).layoverAirports ?? [],
        }
      }),
      allowed,
      config: {
        gender_balance_weight: genderBalanceWeight,
        destination_rules: schedulingConfig?.destinationRules?.filter((r) => r.enabled) ?? [],
        objective_priority: priorityOrder,
      },
      time_limit_sec: timeLimitSec,
    }

    // ── 4. Call Python solver, proxy SSE events ────────────────────────────
    onEvent({ event: 'progress', data: { pct: 18, message: 'Sending to CP-SAT solver…', best_obj: null } })

    const solverRes = await fetch(`${AUTO_ROSTER_SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solverPayload),
      signal,
    })

    if (!solverRes.ok || !solverRes.body) {
      throw new Error(`Solver HTTP ${solverRes.status}: ${await solverRes.text()}`)
    }

    // Parse SSE stream from Python
    type SolutionPayload = { assignments: Array<{ crewId: string; pairingId: string }>; stats: Record<string, unknown> }
    let solutionData: SolutionPayload | null = null

    const reader = solverRes.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let currentEvent = 'message'

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (signal?.aborted) {
        await reader.cancel()
        break
      }

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim()
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            if (currentEvent === 'progress') {
              onEvent({
                event: 'progress',
                data: {
                  pct: Math.max(18, Math.min(95, 18 + ((parsed.pct as number) ?? 0) * 0.77)),
                  message: (parsed.message as string) ?? 'Solving…',
                  best_obj: (parsed.best_obj as number | null) ?? null,
                },
              })
            } else if (currentEvent === 'solution') {
              solutionData = parsed as SolutionPayload
            } else if (currentEvent === 'error') {
              throw new Error((parsed.message as string) ?? 'Solver error')
            }
          } catch {
            // ignore parse errors on non-JSON lines
          }
          currentEvent = 'message'
        }
      }
    }

    if (signal?.aborted) {
      await AutoRosterRun.updateOne({ _id: runId }, { status: 'cancelled', completedAt: now(), updatedAt: now() })
      return
    }

    if (!solutionData) {
      throw new Error('Solver completed without emitting a solution event')
    }

    onEvent({ event: 'solution', data: solutionData })

    // ── 5. Safety net re-validate + commit ────────────────────────────────
    onEvent({ event: 'progress', data: { pct: 96, message: 'Committing assignments…', best_obj: null } })

    const { assignedCount, rejectedCount } = await commitAssignments(
      runId,
      operatorId,
      solutionData.assignments,
      pairingsById,
      ruleSet,
      crew,
      historyAssignments,
      adaptActivities(historyActivities),
      activityCodesById,
    )

    const stats = {
      ...(solutionData.stats as object),
      assignedPairings: assignedCount,
      unassignedPairings: pairings.length - assignedCount,
      pairingsTotal: pairings.length,
      crewTotal: crew.length,
    }

    await AutoRosterRun.updateOne(
      { _id: runId },
      {
        status: 'completed',
        completedAt: now(),
        stats,
        updatedAt: now(),
      },
    )

    onEvent({ event: 'committed', data: { assignedCount, rejectedCount } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await AutoRosterRun.updateOne(
      { _id: runId },
      { status: 'failed', completedAt: now(), error: message, updatedAt: now() },
    )
    onEvent({ event: 'error', data: { message } })
  }
}

/**
 * Re-validate each proposed assignment before writing to DB.
 * Assignments that still pass FDTL are committed; those that fail (race
 * condition with other writes) are logged and skipped.
 */
type CommitPairing = PairingLike & {
  startDate: string
  endDate?: string | null
  reportTime?: string | null
  layoverAirports?: string[]
}

async function commitAssignments(
  runId: string,
  operatorId: string,
  proposals: Array<{ crewId: string; pairingId: string }>,
  pairingsById: Map<string, CommitPairing>,
  ruleSet: SerializedRuleSet | null,
  crew: Array<{ _id: unknown; base?: string | null }>,
  existingAssignments: Array<{
    _id: string
    crewId: string
    pairingId: string
    startUtcIso: string
    endUtcIso: string
    status: string
    commanderDiscretion?: boolean
  }>,
  existingActivities: Array<{
    _id: string
    crewId: string
    startUtcIso: string
    endUtcIso: string
    activityCodeId?: string | null
  }>,
  activityCodesById: Map<string, { flags: string[] }>,
): Promise<{ assignedCount: number; rejectedCount: number }> {
  const crewById = new Map(crew.map((c) => [c._id as string, c]))
  let assignedCount = 0
  let rejectedCount = 0
  const now = () => new Date().toISOString()

  for (const proposal of proposals) {
    const { crewId, pairingId } = proposal
    const pairing = pairingsById.get(pairingId)
    const crewMember = crewById.get(crewId)
    if (!pairing || !crewMember) {
      rejectedCount++
      continue
    }

    const candidate = buildCandidateDuty(pairing)
    if (!candidate) {
      rejectedCount++
      continue
    }

    const existingDuties = buildScheduleDuties({
      crewId,
      assignments: existingAssignments,
      activities: existingActivities,
      pairingsById,
      activityCodesById,
    })

    const result = validateCrewAssignment({
      candidate,
      existing: existingDuties,
      homeBase: crewMember.base ?? 'XXXX',
      ruleSet,
    })

    if (result.overall === 'violation') {
      rejectedCount++
      console.warn(`[auto-roster] ${runId} safety-net rejected crew=${crewId} pairing=${pairingId}: ${result.headline}`)
      continue
    }

    // Compute UTC window from pairing
    const startUtcIso =
      pairing.reportTime ??
      (pairing.legs?.[0]?.stdUtcIso
        ? new Date(new Date(pairing.legs[0].stdUtcIso).getTime() - 60 * 60_000).toISOString()
        : pairing.startDate + 'T00:00:00.000Z')
    const lastLeg = pairing.legs?.[pairing.legs.length - 1]
    const endUtcIso = lastLeg?.staUtcIso ?? (pairing.endDate ?? pairing.startDate) + 'T23:59:59.000Z'

    await CrewAssignment.findOneAndUpdate(
      { operatorId, crewId, pairingId },
      {
        $setOnInsert: {
          _id: crypto.randomUUID(),
          createdAt: now(),
        },
        $set: {
          operatorId,
          crewId,
          pairingId,
          seatPositionId: null,
          seatIndex: 0,
          startUtcIso,
          endUtcIso,
          status: 'confirmed',
          sourceRunId: runId,
          updatedAt: now(),
        },
      },
      { upsert: true },
    )
    assignedCount++
  }

  return { assignedCount, rejectedCount }
}

// ── Day-Off / Standby runners ────────────────────────────────────────────────
//
// These modes do NOT assign pairings. They fill NON-pairing days with rest
// or standby activities. No CP-SAT involvement — deterministic greedy algorithm
// respecting Min/Max caps and avoiding existing busy days.

/** YYYY-MM-DD inclusive day list between two dates. */
function enumerateDays(fromIso: string, toIso: string): string[] {
  const days: string[] = []
  const from = new Date(fromIso + 'T00:00:00Z')
  const to = new Date(toIso + 'T00:00:00Z')
  for (const d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

/** Pick first active activity code matching any of the given flags. */
async function pickActivityCode(operatorId: string, flagsAny: string[]): Promise<{ _id: string; code: string } | null> {
  const doc = await ActivityCode.findOne({
    operatorId,
    isActive: true,
    isArchived: { $ne: true },
    flags: { $in: flagsAny },
  }).lean()
  return doc ? { _id: doc._id as string, code: doc.code as string } : null
}

/** Build a busy-day set for one crew in [periodFrom, periodTo]. */
function buildBusyDays(
  crewId: string,
  assignments: Array<{ crewId: string; startUtcIso: string; endUtcIso: string }>,
  activities: Array<{ crewId: string; startUtcIso: string; endUtcIso: string }>,
): Set<string> {
  const busy = new Set<string>()
  const addRange = (startIso: string, endIso: string) => {
    const s = new Date(startIso)
    const e = new Date(endIso)
    for (const d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
      busy.add(d.toISOString().slice(0, 10))
    }
  }
  for (const a of assignments) if (a.crewId === crewId) addRange(a.startUtcIso, a.endUtcIso)
  for (const a of activities) if (a.crewId === crewId) addRange(a.startUtcIso, a.endUtcIso)
  return busy
}

/** Count days in `days` already covered by rest-flagged activities for this crew. */
function countRestDays(
  crewId: string,
  days: string[],
  activities: Array<{ crewId: string; startUtcIso: string; activityCodeId?: string | null }>,
  restCodeIds: Set<string>,
): number {
  let count = 0
  for (const a of activities) {
    if (a.crewId !== crewId) continue
    if (!a.activityCodeId || !restCodeIds.has(a.activityCodeId)) continue
    const day = a.startUtcIso.slice(0, 10)
    if (days.includes(day)) count++
  }
  return count
}

async function runDaysOffAssignment(
  runId: string,
  operatorId: string,
  periodFrom: string,
  periodTo: string,
  onEvent: (event: AutoRosterEvent) => void,
  signal?: AbortSignal,
  userId?: string | null,
): Promise<void> {
  const now = () => new Date().toISOString()
  try {
    onEvent({ event: 'progress', data: { pct: 4, message: 'Loading crew and activities…', best_obj: null } })

    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }
    const [crew, assignments, activities, schedulingConfig, activityCodes] = await Promise.all([
      CrewMember.find({ operatorId, status: { $ne: 'inactive' } }).lean(),
      CrewAssignment.find({
        operatorId,
        scenarioId: scenarioFilter,
        status: { $ne: 'cancelled' },
        startUtcIso: { $lte: `${periodTo}T23:59:59.999Z` },
        endUtcIso: { $gte: `${periodFrom}T00:00:00.000Z` },
      }).lean(),
      CrewActivity.find({
        operatorId,
        scenarioId: scenarioFilter,
        startUtcIso: { $lte: `${periodTo}T23:59:59.999Z` },
        endUtcIso: { $gte: `${periodFrom}T00:00:00.000Z` },
      }).lean(),
      (async () => {
        if (userId) {
          const userDoc = await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean()
          if (userDoc) return userDoc
        }
        return OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
      })(),
      ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean(),
    ])

    if (signal?.aborted) return

    const dayOffCode = await pickActivityCode(operatorId, ['is_day_off', 'is_rest_period'])
    if (!dayOffCode) {
      throw new Error('No active activity code with is_day_off or is_rest_period flag — cannot assign days off')
    }

    const restCodeIds = new Set(
      activityCodes
        .filter((c) =>
          ((c.flags ?? []) as string[]).some(
            (f) =>
              f === 'is_day_off' ||
              f === 'is_rest_period' ||
              f === 'is_annual_leave' ||
              f === 'is_sick_leave' ||
              f === 'is_medical',
          ),
        )
        .map((c) => c._id as string),
    )

    const minDaysOff = schedulingConfig?.daysOff?.minPerPeriodDays ?? 8
    const maxDaysOff = schedulingConfig?.daysOff?.maxPerPeriodDays ?? 10
    const periodDays = enumerateDays(periodFrom, periodTo)

    onEvent({
      event: 'progress',
      data: {
        pct: 15,
        message: `Assigning days off — Min ${minDaysOff} Max ${maxDaysOff} over ${periodDays.length} days × ${crew.length} crew`,
        best_obj: null,
      },
    })

    const assignmentsAdapted = assignments.map((a) => ({
      crewId: a.crewId,
      startUtcIso: a.startUtcIso,
      endUtcIso: a.endUtcIso,
    }))
    const activitiesAdapted = activities.map((a) => ({
      crewId: a.crewId,
      startUtcIso: a.startUtcIso,
      endUtcIso: a.endUtcIso,
      activityCodeId: a.activityCodeId as string | null | undefined,
    }))

    let inserted = 0
    let skippedCrew = 0
    const totalCrew = crew.length

    for (let i = 0; i < crew.length; i++) {
      if (signal?.aborted) break
      const c = crew[i]
      const crewId = c._id as string

      const busy = buildBusyDays(crewId, assignmentsAdapted, activitiesAdapted)
      const currentRest = countRestDays(crewId, periodDays, activitiesAdapted, restCodeIds)
      const need = Math.max(0, minDaysOff - currentRest)
      const cap = Math.max(0, maxDaysOff - currentRest)
      const toAssign = Math.min(need, cap)
      if (toAssign === 0) {
        skippedCrew++
        continue
      }

      // Spread picks: evenly space free days across period.
      const free = periodDays.filter((d) => !busy.has(d))
      if (free.length === 0) {
        skippedCrew++
        continue
      }
      const step = Math.max(1, Math.floor(free.length / toAssign))
      const picked: string[] = []
      for (let idx = 0; idx < free.length && picked.length < toAssign; idx += step) {
        picked.push(free[idx])
      }

      for (const day of picked) {
        await CrewActivity.updateOne(
          { operatorId, crewId, dateIso: day, activityCodeId: dayOffCode._id },
          {
            $setOnInsert: {
              _id: crypto.randomUUID(),
              operatorId,
              crewId,
              activityCodeId: dayOffCode._id,
              startUtcIso: `${day}T00:00:00.000Z`,
              endUtcIso: `${day}T23:59:59.999Z`,
              dateIso: day,
              notes: `auto-roster:${runId}`,
              createdAt: now(),
            },
            $set: { updatedAt: now() },
          },
          { upsert: true },
        )
        inserted++
      }

      if (i % 25 === 0) {
        const pct = 15 + Math.floor((i / totalCrew) * 80)
        onEvent({
          event: 'progress',
          data: { pct, message: `Day-off assignment ${i + 1}/${totalCrew} crew`, best_obj: null },
        })
      }
    }

    if (signal?.aborted) {
      await AutoRosterRun.updateOne({ _id: runId }, { status: 'cancelled', completedAt: now(), updatedAt: now() })
      return
    }

    const stats = {
      mode: 'daysOff',
      daysOffInserted: inserted,
      crewProcessed: crew.length,
      crewSkipped: skippedCrew,
      activityCode: dayOffCode.code,
    }

    await AutoRosterRun.updateOne({ _id: runId }, { status: 'completed', completedAt: now(), stats, updatedAt: now() })

    onEvent({ event: 'committed', data: { assignedCount: inserted, rejectedCount: 0 } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await AutoRosterRun.updateOne(
      { _id: runId },
      { status: 'failed', completedAt: now(), error: message, updatedAt: now() },
    )
    onEvent({ event: 'error', data: { message } })
  }
}

async function runStandbyAssignment(
  runId: string,
  operatorId: string,
  periodFrom: string,
  periodTo: string,
  onEvent: (event: AutoRosterEvent) => void,
  signal?: AbortSignal,
  userId?: string | null,
): Promise<void> {
  const now = () => new Date().toISOString()
  try {
    onEvent({ event: 'progress', data: { pct: 4, message: 'Loading crew and coverage data…', best_obj: null } })

    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }
    const [crew, assignments, activities, schedulingConfig, activityCodes] = await Promise.all([
      CrewMember.find({ operatorId, status: { $ne: 'inactive' } }).lean(),
      CrewAssignment.find({
        operatorId,
        scenarioId: scenarioFilter,
        status: { $ne: 'cancelled' },
        startUtcIso: { $lte: `${periodTo}T23:59:59.999Z` },
        endUtcIso: { $gte: `${periodFrom}T00:00:00.000Z` },
      }).lean(),
      CrewActivity.find({
        operatorId,
        scenarioId: scenarioFilter,
        startUtcIso: { $lte: `${periodTo}T23:59:59.999Z` },
        endUtcIso: { $gte: `${periodFrom}T00:00:00.000Z` },
      }).lean(),
      (async () => {
        if (userId) {
          const userDoc = await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean()
          if (userDoc) return userDoc
        }
        return OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
      })(),
      ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean(),
    ])

    if (signal?.aborted) return

    const homeStandbyCode = await pickActivityCode(operatorId, ['is_home_standby'])
    const airportStandbyCode = await pickActivityCode(operatorId, ['is_airport_standby', 'is_reserve'])
    if (!homeStandbyCode && !airportStandbyCode) {
      throw new Error('No active activity code with is_home_standby / is_airport_standby flag — cannot assign standby')
    }

    const standbyCodeIds = new Set(
      activityCodes
        .filter((c) =>
          ((c.flags ?? []) as string[]).some(
            (f) => f === 'is_home_standby' || f === 'is_airport_standby' || f === 'is_reserve',
          ),
        )
        .map((c) => c._id as string),
    )

    const usePct = schedulingConfig?.standby?.usePercentage ?? true
    const minPct = schedulingConfig?.standby?.minPerDayPct ?? 10
    const minFlat = schedulingConfig?.standby?.minPerDayFlat ?? 2
    const homeRatio = schedulingConfig?.standby?.homeStandbyRatioPct ?? 80

    const periodDays = enumerateDays(periodFrom, periodTo)
    const totalCrew = crew.length

    onEvent({
      event: 'progress',
      data: {
        pct: 12,
        message: `Assigning standby — ${usePct ? `${minPct}% of operating` : `${minFlat} flat`}, ${homeRatio}% home ratio`,
        best_obj: null,
      },
    })

    // Build per-day busy/standby maps from existing data
    const busyByDay: Record<string, Set<string>> = {}
    const standbyByDay: Record<string, Set<string>> = {}
    const operatingByDay: Record<string, Set<string>> = {}
    for (const d of periodDays) {
      busyByDay[d] = new Set()
      standbyByDay[d] = new Set()
      operatingByDay[d] = new Set()
    }

    for (const a of assignments) {
      const s = new Date(a.startUtcIso),
        e = new Date(a.endUtcIso)
      for (const d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.toISOString().slice(0, 10)
        if (day in busyByDay) {
          busyByDay[day].add(a.crewId)
          operatingByDay[day].add(a.crewId)
        }
      }
    }
    for (const a of activities) {
      const s = new Date(a.startUtcIso),
        e = new Date(a.endUtcIso)
      const isStandby = a.activityCodeId && standbyCodeIds.has(a.activityCodeId as string)
      for (const d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.toISOString().slice(0, 10)
        if (!(day in busyByDay)) continue
        busyByDay[day].add(a.crewId)
        if (isStandby) standbyByDay[day].add(a.crewId)
      }
    }

    let inserted = 0
    let homeAssigned = 0
    let airportAssigned = 0

    for (let i = 0; i < periodDays.length; i++) {
      if (signal?.aborted) break
      const day = periodDays[i]
      const operating = operatingByDay[day].size
      const target = usePct ? Math.ceil((minPct / 100) * operating) : minFlat
      const existing = standbyByDay[day].size
      const need = Math.max(0, target - existing)
      if (need === 0) continue

      const pool = crew.filter((c) => !busyByDay[day].has(c._id as string))
      if (pool.length === 0) continue
      const picks = pool.slice(0, need)

      const homeCount = Math.round((homeRatio / 100) * picks.length)
      for (let idx = 0; idx < picks.length; idx++) {
        const c = picks[idx]
        const crewId = c._id as string
        const useHome = idx < homeCount && !!homeStandbyCode
        const code = useHome ? homeStandbyCode! : (airportStandbyCode ?? homeStandbyCode!)
        await CrewActivity.updateOne(
          { operatorId, crewId, dateIso: day, activityCodeId: code._id },
          {
            $setOnInsert: {
              _id: crypto.randomUUID(),
              operatorId,
              crewId,
              activityCodeId: code._id,
              startUtcIso: `${day}T00:00:00.000Z`,
              endUtcIso: `${day}T23:59:59.999Z`,
              dateIso: day,
              notes: `auto-roster:${runId}`,
              createdAt: now(),
            },
            $set: { updatedAt: now() },
          },
          { upsert: true },
        )
        inserted++
        if (useHome) homeAssigned++
        else airportAssigned++
      }

      if (i % 3 === 0) {
        const pct = 12 + Math.floor((i / periodDays.length) * 82)
        onEvent({
          event: 'progress',
          data: { pct, message: `Standby assignment day ${i + 1}/${periodDays.length}`, best_obj: null },
        })
      }
    }

    if (signal?.aborted) {
      await AutoRosterRun.updateOne({ _id: runId }, { status: 'cancelled', completedAt: now(), updatedAt: now() })
      return
    }

    const stats = {
      mode: 'standby',
      standbyInserted: inserted,
      homeAssigned,
      airportAssigned,
      crewTotal: totalCrew,
      daysProcessed: periodDays.length,
    }

    await AutoRosterRun.updateOne({ _id: runId }, { status: 'completed', completedAt: now(), stats, updatedAt: now() })

    onEvent({ event: 'committed', data: { assignedCount: inserted, rejectedCount: 0 } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await AutoRosterRun.updateOne(
      { _id: runId },
      { status: 'failed', completedAt: now(), error: message, updatedAt: now() },
    )
    onEvent({ event: 'error', data: { message } })
  }
}
