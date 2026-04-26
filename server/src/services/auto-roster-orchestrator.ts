import crypto from 'node:crypto'
import { Agent } from 'undici'
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
import { CrewPosition } from '../models/CrewPosition.js'
import { CrewComplement } from '../models/CrewComplement.js'
import { loadSerializedRuleSet } from './fdtl-rule-set.js'
import { setRosterRunPayload } from './roster-run-cache.js'
import { buildCrewSchedulePayload, type CrewScheduleQuery } from '../routes/crew-schedule.js'

/**
 * Pre-build the /crew-schedule aggregator payload and cache it under the
 * runId. Called fire-and-forget after a roster run completes so the
 * post-solve "Loading roster data…" UI fetch hits a warm payload via
 * GET /crew-schedule/from-run/:runId instead of paying the full
 * aggregator cost (was 30+s for 133 crew × 1 month).
 *
 * Errors are swallowed — the regular /crew-schedule endpoint remains the
 * source of truth, and the frontend falls back to it on cache miss.
 */
function prewarmRosterRunCache(
  runId: string,
  operatorId: string,
  periodFrom: string,
  periodTo: string,
  filters: AutoRosterFilters,
): void {
  const q: CrewScheduleQuery = { from: periodFrom, to: periodTo }
  if (filters.acTypes && filters.acTypes.length > 0) q.acType = filters.acTypes.join(',')
  if (filters.base) q.base = filters.base
  if (filters.position) q.position = filters.position
  if (filters.crewGroupIds && filters.crewGroupIds.length > 0) q.crewGroup = filters.crewGroupIds.join(',')
  void buildCrewSchedulePayload(operatorId, q)
    .then((payload) => setRosterRunPayload(runId, operatorId, payload))
    .catch((err) => {
      console.warn(`[auto-roster] ${runId} cache prewarm failed: ${(err as Error).message}`)
    })
}

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
// Disable undici's default 300s bodyTimeout — solver streams can run 30+ minutes.
const solverAgent = new Agent({ bodyTimeout: 0, headersTimeout: 300_000 })

function resolveMinRestMinutes(ruleSet: SerializedRuleSet | null): number {
  // Prefer MIN_REST_HOME_BASE; fall back to MIN_REST_AWAY, then any min-rest
  // rule. Default 12h (720 min) if the ruleset has none — conservative but
  // matches CAAV VAR 15 §15.037(a)(1).
  if (!ruleSet) return 720
  const candidates = ['MIN_REST_HOME_BASE', 'MIN_REST_AWAY', 'MIN_REST_ANY']
  for (const code of candidates) {
    const rule = ruleSet.rules.find((r) => r.code === code)
    if (!rule) continue
    const m = /^(\d+):(\d{2})$/.exec(rule.value.trim())
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    const n = parseInt(rule.value, 10)
    if (!Number.isNaN(n)) return n
  }
  return 720
}

/**
 * Extract rolling-window cumulative caps from the FDTL ruleset for the solver.
 * Recognised code families (N is an integer, unit D=days, M=months, Y=years):
 *   MAX_BLOCK_{N}{U} / MAX_FLIGHT_TIME_{N}{U}   → block  cap
 *   MAX_DUTY_{N}{U}  / MAX_DH_{N}{U}            → duty   cap
 *   MAX_LANDINGS_{N}{U} / MAX_SECTORS_{N}{U}    → landings cap
 * Months approximated as 30 days, years as 365 days — sufficient for 12M
 * annual flight-hour caps (CAAV 1000h/12M).
 */
function extractFdtlLimitsForSolver(
  ruleSet: SerializedRuleSet | null,
): Array<{ field: 'block' | 'duty' | 'landings'; window_ms: number; limit: number; code: string }> {
  if (!ruleSet) return []
  const out: Array<{ field: 'block' | 'duty' | 'landings'; window_ms: number; limit: number; code: string }> = []
  const DAY_MS = 86_400_000
  for (const rule of ruleSet.rules) {
    // Accept the same rule-code families the FDTL evaluator accepts so
    // that CAAV/EASA-style codes (MAX_BH_28D, MAX_FT_28D, MAX_FDP_*) are
    // handed to the solver too — previously only BLOCK/FLIGHT_TIME/DUTY/DH
    // matched, so e.g. MAX_BH_28D = 100:00 was ignored and the solver could
    // propose rosters breaching the monthly block-hour cap.
    const match = /^MAX_(BLOCK|FLIGHT_TIME|FT|BH|DUTY|DH|FDP|LANDINGS|SECTORS)_(\d+)([DHMY])$/.exec(rule.code)
    if (!match) continue
    const [, fieldToken, nStr, unit] = match
    const n = parseInt(nStr, 10)
    if (!Number.isFinite(n) || n <= 0) continue
    let days: number
    if (unit === 'D') days = n
    else if (unit === 'H') days = n / 24
    else if (unit === 'M') days = n * 30
    else days = n * 365
    const field: 'block' | 'duty' | 'landings' =
      fieldToken === 'BLOCK' || fieldToken === 'FLIGHT_TIME' || fieldToken === 'FT' || fieldToken === 'BH'
        ? 'block'
        : fieldToken === 'DUTY' || fieldToken === 'DH' || fieldToken === 'FDP'
          ? 'duty'
          : 'landings'
    // Parse value: "HH:MM" for time, bare integer for landings.
    let limitVal: number | null = null
    const hm = /^(\d+):(\d{2})$/.exec((rule.value ?? '').trim())
    if (field === 'landings') {
      const nn = parseInt(rule.value ?? '', 10)
      limitVal = Number.isFinite(nn) ? nn : null
    } else if (hm) {
      limitVal = parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10)
    } else {
      const nn = parseInt(rule.value ?? '', 10)
      if (Number.isFinite(nn)) limitVal = nn
    }
    if (limitVal == null || limitVal <= 0) continue
    out.push({ field, window_ms: days * DAY_MS, limit: limitVal, code: rule.code })
  }
  return out
}

/**
 * Extract planner-tunable soft consecutive-duty rules from the operator's
 * scheduling config. Disabled rules omitted. Solver treats each entry as a
 * sliding-window penalty in the objective.
 */
function extractSoftConsecDutyRules(
  cfg: { daysOff?: Record<string, unknown> | null } | null,
): Array<{ variant: 'any' | 'morning' | 'afternoon'; limit_days: number; weight: number }> {
  if (!cfg?.daysOff) return []
  const daysOff = cfg.daysOff as Record<string, unknown>
  const out: Array<{ variant: 'any' | 'morning' | 'afternoon'; limit_days: number; weight: number }> = []
  const pick = (ruleKey: string, limitKey: string, variant: 'any' | 'morning' | 'afternoon'): void => {
    const rule = daysOff[ruleKey] as { enabled?: boolean; weight?: number } | undefined
    const limit = daysOff[limitKey] as number | undefined
    if (!rule || rule.enabled === false) return
    if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return
    out.push({
      variant,
      limit_days: Math.max(1, Math.floor(limit as number)),
      weight: Math.max(1, Math.min(10, Math.floor(rule.weight ?? 5))),
    })
  }
  pick('maxConsecutiveDutyDaysRule', 'maxConsecutiveDutyDays', 'any')
  pick('maxConsecutiveMorningDutiesRule', 'maxConsecutiveMorningDuties', 'morning')
  pick('maxConsecutiveAfternoonDutiesRule', 'maxConsecutiveAfternoonDuties', 'afternoon')
  return out
}

/**
 * Extract the weekly (extended-recovery) rest requirement. CAAV: 36h continuous
 * rest within every 168h rolling window (§15.037(d)). Other templates use
 * MIN_EXTENDED_RECOVERY or WEEKLY_TIME_FREE. Returns minutes of continuous rest
 * required per window, and the window size in hours.
 */
function extractWeeklyRestForSolver(
  ruleSet: SerializedRuleSet | null,
): { rest_min: number; window_hours: number } | null {
  if (!ruleSet) return null
  const hmm = (v: string | null | undefined): number | null => {
    if (!v) return null
    const m = /^(\d+):(\d{2})$/.exec(v.trim())
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  }
  const restRule = ruleSet.rules.find((r) => r.code === 'MIN_EXTENDED_RECOVERY' || r.code === 'WEEKLY_TIME_FREE')
  if (!restRule) return null
  const restMin = hmm(restRule.value)
  if (restMin == null || restMin <= 0) return null
  const windowRule = ruleSet.rules.find((r) => r.code === 'MAX_BETWEEN_EXTENDED_RECOVERY')
  const windowMinutes = windowRule ? (hmm(windowRule.value) ?? 10080) : 10080 // default 168h
  return { rest_min: restMin, window_hours: Math.round(windowMinutes / 60) }
}

export type AutoRosterEvent =
  | { event: 'progress'; data: { pct: number; message: string; best_obj: number | null } }
  | {
      event: 'solution'
      data: { assignments: Array<{ crewId: string; pairingId: string }>; stats: Record<string, unknown> }
    }
  | { event: 'error'; data: { message: string } }
  | {
      event: 'committed'
      data: {
        assignedCount: number
        rejectedCount: number
        /** Top rejection reasons by count — populated by general mode. */
        rejectionReasons?: Array<{ reason: string; count: number }>
      }
    }

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
  daysOffActivityCodeId: string | null = null,
): Promise<void> {
  const now = () => new Date().toISOString()

  await AutoRosterRun.updateOne({ _id: runId }, { status: 'running', startedAt: now(), updatedAt: now() })

  // Mode dispatch — daysOff/standby bypass CP-SAT entirely (they don't assign pairings).
  // Filters (base/position/acType/crewGroup) are forwarded so standalone runs
  // honour the same scope as the UI filter panel.
  if (mode === 'daysOff') {
    await runDaysOffAssignment(
      runId,
      operatorId,
      periodFrom,
      periodTo,
      onEvent,
      signal,
      userId,
      daysOffActivityCodeId,
      false,
      filters,
    )
    return
  }
  if (mode === 'standby') {
    await runStandbyAssignment(runId, operatorId, periodFrom, periodTo, onEvent, signal, userId, false, filters)
    return
  }

  try {
    onEvent({ event: 'progress', data: { pct: 2, message: 'Loading roster scope…', best_obj: null } })

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

    const [pairingsRaw, crew, existingAssignments, activities, schedulingConfig, allPositions, allComplements] =
      await Promise.all([
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
        CrewPosition.find({ operatorId }).lean(),
        CrewComplement.find({ operatorId, isActive: true }).lean(),
      ])

    // Seat-code compat: pairing.crewCounts uses CrewPosition.code as keys
    // (e.g. { CP: 1, FO: 1, CC: 3 }). Crew.position is a CrewPosition._id.
    // Pre-compile must reject pairs where the crew's rank doesn't match any
    // seat the pairing needs — otherwise solver emits proposals the commit
    // pass silently drops, appearing as "chaos" on the Gantt.
    const positionIdToCode = new Map<string, string>(
      allPositions.map((p) => [p._id as string, (p.code as string) ?? '']),
    )
    const complementBySig = new Map<string, Record<string, number>>()
    for (const c of allComplements) {
      const cc =
        c.counts instanceof Map
          ? (Object.fromEntries(c.counts) as Record<string, number>)
          : ((c.counts ?? {}) as Record<string, number>)
      complementBySig.set(`${c.aircraftTypeIcao}/${c.templateKey}`, cc)
    }
    const resolvePairingSeatCounts = (p: {
      crewCounts?: Record<string, number> | null
      aircraftTypeIcao?: string | null
      complementKey?: string | null
    }): Record<string, number> => {
      const own = (p.crewCounts ?? {}) as Record<string, number>
      if (own && Object.keys(own).length > 0) return own
      const key = `${p.aircraftTypeIcao ?? ''}/${p.complementKey ?? 'standard'}`
      return complementBySig.get(key) ?? {}
    }

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

    onEvent({ event: 'progress', data: { pct: 4, message: 'Scope loaded. Fetching FDTL ruleset…', best_obj: null } })

    const ruleSet = (await loadSerializedRuleSet(operatorId)) as SerializedRuleSet | null

    if (ruleSet) {
      onEvent({
        event: 'progress',
        data: {
          pct: 5,
          message: `Loaded ${ruleSet.frameworkName ?? ruleSet.frameworkCode} ruleset — ${crew.length} crew, ${pairings.length} pairings across ${enumerateDays(periodFrom, periodTo).length} days`,
          best_obj: null,
        },
      })
    }

    if (signal?.aborted) return

    onEvent({
      event: 'progress',
      data: {
        pct: 8,
        message: `Checking FDTL legality: ${crew.length} crew × ${pairings.length} pairings (${(crew.length * pairings.length).toLocaleString()} combinations)…`,
        best_obj: null,
      },
    })

    // Resolve crew.base (airport UUID) → IATA code. The FDTL validator
    // compares station strings (IATA), so passing a raw UUID as homeBase
    // causes evaluateBaseContinuity to flag every pairing as a mismatch.
    const crewBaseIds = [
      ...new Set(crew.map((c) => (c as { base?: string | null }).base).filter((v): v is string => !!v)),
    ]
    const crewBaseDocs =
      crewBaseIds.length > 0 ? await Airport.find({ _id: { $in: crewBaseIds } }, { _id: 1, iataCode: 1 }).lean() : []
    const baseIdToIata = new Map(
      crewBaseDocs.map((a) => [a._id as string, ((a.iataCode as string | null) ?? '').toUpperCase()]),
    )

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

    const activityCodes = await ActivityCode.find({ operatorId }, { _id: 1, code: 1, flags: 1 }).lean()
    const activityCodesById = new Map<string, { flags: string[] }>(
      activityCodes.map((c) => [c._id as string, { flags: (c.flags ?? []) as string[] }]),
    )
    const activityCodeStringById = new Map<string, string>(
      activityCodes.map((c) => [c._id as string, ((c as { code?: string }).code ?? '').toUpperCase()]),
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

    let seatIncompatSkipped = 0

    for (const crewMember of crew) {
      const crewId = crewMember._id as string
      const rawBase = (crewMember as { base?: string | null }).base ?? ''
      const homeBase = baseIdToIata.get(rawBase) || 'XXXX'

      const crewPositionId = (crewMember as { position?: string | null }).position ?? null
      const crewPositionCode = crewPositionId ? (positionIdToCode.get(crewPositionId) ?? null) : null

      const existingDuties = buildScheduleDuties({
        crewId,
        assignments: historyAssignments,
        activities: adaptActivities(historyActivities),
        pairingsById,
        activityCodesById,
      })

      const legalPairingIds: string[] = []

      // Hard block: candidate time-window must not overlap ANY existing
      // duty (pairing, rest, activity — including AL, OFF, training, sick).
      // FDTL evaluators intentionally ignore rest-kind blocks for rest /
      // duty-day math, so overlap filtering belongs at the caller layer.
      const OVERLAP_BUFFER_MIN = 0
      const existingWindows = existingDuties.map((d) => ({
        startMs: d.startUtcMs - OVERLAP_BUFFER_MIN * 60_000,
        endMs: d.endUtcMs + OVERLAP_BUFFER_MIN * 60_000,
      }))

      for (const pairing of pairings) {
        const pairingId = pairing._id as string

        // Rank/seat compatibility — pairing.crewCounts keys are CrewPosition
        // codes. Crew can only be assigned to a pairing seat matching their
        // own position code. Downrank flexibility (e.g. CP → FO) is out of
        // scope for auto-roster; planners handle it manually.
        if (crewPositionCode) {
          const seatCounts = resolvePairingSeatCounts(
            pairing as unknown as {
              crewCounts?: Record<string, number> | null
              aircraftTypeIcao?: string | null
              complementKey?: string | null
            },
          )
          const seatCodes = Object.keys(seatCounts).filter((k) => (seatCounts[k] ?? 0) > 0)
          if (seatCodes.length > 0 && !seatCodes.includes(crewPositionCode)) {
            seatIncompatSkipped++
            continue
          }
        }

        const candidate = buildCandidateDuty(pairing)
        if (!candidate) continue

        const overlaps = existingWindows.some((w) => candidate.startUtcMs < w.endMs && candidate.endUtcMs > w.startMs)
        if (overlaps) continue

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

      if (legalPairingIds.length === 0 && pairings.length > 0) {
        const samplePairing = pairings[0]
        const sampleCandidate = buildCandidateDuty(samplePairing)
        const sampleResult = sampleCandidate
          ? validateCrewAssignment({ candidate: sampleCandidate, existing: existingDuties, homeBase, ruleSet })
          : null
        const firstViolation = sampleResult?.checks.find((c) => c.status === 'violation')
        console.warn(
          `[auto-roster] ${runId} crew=${crewId} base=${homeBase}: 0/${pairings.length} legal.` +
            (firstViolation ? ` Sample: ${firstViolation.ruleCode} — ${firstViolation.shortReason}` : ''),
        )
      }

      if (legalPairingIds.length > 0) {
        allowed[crewId] = legalPairingIds
      }
    }

    if (signal?.aborted) return

    const totalLegalPairs = Object.values(allowed).reduce((s, arr) => s + arr.length, 0)
    const avgLegalPerCrew = crew.length > 0 ? Math.round(totalLegalPairs / crew.length) : 0
    const crewWithFewLegal = Object.values(allowed).filter((arr) => arr.length > 0 && arr.length < 10).length
    onEvent({
      event: 'progress',
      data: {
        pct: 15,
        message:
          `FDTL check done — ${totalLegalPairs.toLocaleString()} legal matches, avg ${avgLegalPerCrew}/crew` +
          (seatIncompatSkipped > 0 ? ` (${seatIncompatSkipped.toLocaleString()} skipped on position mismatch)` : ''),
        best_obj: null,
      },
    })

    if (crewWithFewLegal > 0 && crew.length > 0) {
      const pct = Math.round((crewWithFewLegal / crew.length) * 100)
      if (pct >= 20) {
        onEvent({
          event: 'progress',
          data: {
            pct: 15,
            message: `Warning — ${pct}% of crew have fewer than 10 legal pairings; coverage may be limited`,
            best_obj: null,
          },
        })
      }
    }

    if (totalLegalPairs === 0) {
      const msg = `No legal crew×pairing combinations found (${crew.length} crew × ${pairings.length} pairings). Check crew base airports, positions, and FDTL rules.`
      console.warn(`[auto-roster] ${runId} ${msg}`)
      await AutoRosterRun.updateOne(
        { _id: runId },
        { status: 'failed', completedAt: new Date().toISOString(), error: msg, updatedAt: new Date().toISOString() },
      )
      onEvent({ event: 'error', data: { message: msg } })
      return
    }

    // ── 3. Build solver payload ────────────────────────────────────────────
    const genderBalanceWeight = schedulingConfig?.objectives?.genderBalanceWeight ?? 80
    const priorityOrder = (schedulingConfig?.objectives?.priorityOrder ?? []) as string[]

    // Virtual-seat expansion. Each pairing needing N seats of one rank becomes
    // N virtual "pairings" sharing the parent's time window. CP-SAT's coverage
    // constraint (sum(x) + slack == 1) then applies per seat, producing correct
    // multi-seat coverage. Virtual id layout: `${pairingId}__${seatCode}__${i}`.
    type VirtualPairing = {
      id: string
      parent_pairing_id: string
      seat_code: string
      seat_index: number
      days: string[]
      bh_min: number
      duty_min: number
      landings: number
      layover_stations: string[]
      start_utc_ms: number
      end_utc_ms: number
      morning_flag: number
      afternoon_flag: number
    }
    const hourFromMs = (ms: number): number => (Number.isFinite(ms) && ms > 0 ? new Date(ms).getUTCHours() : -1)
    const morningFlag = (ms: number): number => {
      const h = hourFromMs(ms)
      return h >= 0 && h < 12 ? 1 : 0
    }
    const afternoonFlag = (ms: number): number => {
      const h = hourFromMs(ms)
      return h >= 12 && h < 18 ? 1 : 0
    }
    // When the planner filters by position (e.g. CP only), no crew in `crew`
    // can ever cover an FO/CC seat — those virtual seats would just become
    // slack and bloat the CP-SAT model with O(crew × wasted-seat) variables
    // and rest/overlap constraints. Restrict virtual-seat expansion to the
    // matching seat code so the solver gets ~Nx fewer positions to chew on.
    const filterSeatCode = filters.position ? (positionIdToCode.get(filters.position) ?? null) : null

    const virtualPairings: VirtualPairing[] = []
    const virtualByParent = new Map<string, VirtualPairing[]>()
    for (const p of pairings) {
      const days: string[] = []
      const start = new Date(p.startDate + 'T00:00:00Z')
      const end = new Date((p.endDate ?? p.startDate) + 'T00:00:00Z')
      for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(d.toISOString().slice(0, 10))
      }
      const candidate = buildCandidateDuty(p)
      const parentId = p._id as string
      const seatCounts = resolvePairingSeatCounts(
        p as unknown as {
          crewCounts?: Record<string, number> | null
          aircraftTypeIcao?: string | null
          complementKey?: string | null
        },
      )
      const siblings: VirtualPairing[] = []
      const allSeatEntries = Object.entries(seatCounts).filter(([, n]) => (n ?? 0) > 0)
      // When position filter is active, drop pairings that need no seat of the
      // selected rank — they're not assignable by the filtered crew anyway,
      // and shipping them as single-slot fallbacks would create unfillable
      // slack in the model.
      if (filterSeatCode && allSeatEntries.length > 0 && !allSeatEntries.some(([code]) => code === filterSeatCode)) {
        virtualByParent.set(parentId, siblings)
        continue
      }
      const seatEntries = filterSeatCode ? allSeatEntries.filter(([code]) => code === filterSeatCode) : allSeatEntries
      if (seatEntries.length === 0) {
        // Fallback: no seat breakdown available — emit single-slot virtual so
        // downstream code stays uniform. Legacy behaviour.
        const v: VirtualPairing = {
          id: parentId,
          parent_pairing_id: parentId,
          seat_code: '',
          seat_index: 0,
          days,
          bh_min: p.totalBlockMinutes ?? 0,
          duty_min: (p as { totalDutyMinutes?: number }).totalDutyMinutes ?? p.totalBlockMinutes ?? 0,
          landings: (p as { numberOfSectors?: number }).numberOfSectors ?? 0,
          layover_stations: (p as { layoverAirports?: string[] }).layoverAirports ?? [],
          start_utc_ms: candidate?.startUtcMs ?? 0,
          end_utc_ms: candidate?.endUtcMs ?? 0,
          morning_flag: morningFlag(candidate?.startUtcMs ?? 0),
          afternoon_flag: afternoonFlag(candidate?.startUtcMs ?? 0),
        }
        virtualPairings.push(v)
        siblings.push(v)
      } else {
        for (const [seatCode, n] of seatEntries) {
          const count = Math.max(1, Math.floor(n))
          for (let i = 0; i < count; i++) {
            const v: VirtualPairing = {
              id: `${parentId}__${seatCode}__${i}`,
              parent_pairing_id: parentId,
              seat_code: seatCode,
              seat_index: i,
              days,
              bh_min: p.totalBlockMinutes ?? 0,
              duty_min: (p as { totalDutyMinutes?: number }).totalDutyMinutes ?? p.totalBlockMinutes ?? 0,
              landings: (p as { numberOfSectors?: number }).numberOfSectors ?? 0,
              layover_stations: (p as { layoverAirports?: string[] }).layoverAirports ?? [],
              start_utc_ms: candidate?.startUtcMs ?? 0,
              end_utc_ms: candidate?.endUtcMs ?? 0,
              morning_flag: morningFlag(candidate?.startUtcMs ?? 0),
              afternoon_flag: afternoonFlag(candidate?.startUtcMs ?? 0),
            }
            virtualPairings.push(v)
            siblings.push(v)
          }
        }
      }
      virtualByParent.set(parentId, siblings)
    }

    // Re-map `allowed`: crew legal parent pairings → their compatible virtual
    // siblings only (seat_code matches crew's position code). Siblings share
    // the parent's time window, so the existing pairwise rest constraint in
    // CP-SAT already prevents a single crew from covering two seats on the
    // same pairing (no separate mutex needed).
    const allowedVirtual: Record<string, string[]> = {}
    for (const [crewId, legalParents] of Object.entries(allowed)) {
      const crewPosId =
        (crew.find((c) => (c._id as string) === crewId) as { position?: string | null } | undefined)?.position ?? null
      const crewPosCode = crewPosId ? (positionIdToCode.get(crewPosId) ?? null) : null
      const virtuals: string[] = []
      for (const parentId of legalParents) {
        const siblings = virtualByParent.get(parentId) ?? []
        if (siblings.length === 1 && siblings[0].seat_code === '') {
          // Legacy single-slot pairing — accept as-is.
          virtuals.push(siblings[0].id)
          continue
        }
        for (const v of siblings) {
          if (!crewPosCode || v.seat_code === crewPosCode) virtuals.push(v.id)
        }
      }
      if (virtuals.length > 0) allowedVirtual[crewId] = virtuals
    }
    // ── Quality of Life: birthday HARD ────────────────────────────────────
    // Strip pairings overlapping the crew member's birthday (MM-DD match) from
    // the per-crew allowed list before solver sees them. Hard rule = no
    // penalty negotiation, the slot is simply not assignable.
    const birthdayEnabled = Boolean(schedulingConfig?.qolBirthday?.enabled)
    if (birthdayEnabled) {
      const virtualById = new Map(virtualPairings.map((v) => [v.id, v]))
      const enumerateBirthdays = (mmdd: string): Set<string> => {
        // All ISO dates in [periodFrom, periodTo] whose MM-DD matches.
        const out = new Set<string>()
        const start = new Date(`${periodFrom}T00:00:00Z`)
        const end = new Date(`${periodTo}T00:00:00Z`)
        for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
          const iso = new Date(t).toISOString().slice(0, 10)
          if (iso.slice(5) === mmdd) out.add(iso)
        }
        return out
      }
      let stripped = 0
      for (const c of crew) {
        const dob = (c as { dateOfBirth?: string | null }).dateOfBirth ?? null
        if (!dob || dob.length < 10) continue
        const birthdays = enumerateBirthdays(dob.slice(5, 10))
        if (birthdays.size === 0) continue
        const cid = c._id as string
        const list = allowedVirtual[cid]
        if (!list) continue
        const filtered = list.filter((vid) => {
          const v = virtualById.get(vid)
          if (!v) return true
          return !v.days.some((d) => birthdays.has(d))
        })
        stripped += list.length - filtered.length
        if (filtered.length === 0) delete allowedVirtual[cid]
        else allowedVirtual[cid] = filtered
      }
      if (stripped > 0) {
        console.log(`[auto-roster] ${runId} QoL birthday hard rule stripped ${stripped} pairing×crew pairs`)
      }
    }

    // ── Quality of Life: wind-down / late-return SOFT ─────────────────────
    // For each enabled qolRule, find every crew × activity-date matching the
    // rule's activity codes, and emit a per-crew per-date cutoff sent to the
    // solver as a soft penalty.
    type QolSoftRulePayload = {
      crew_id: string
      kind: 'wind_down' | 'late_return'
      date: string
      cutoff_min: number
      weight: number
    }
    const qolSoftRules: QolSoftRulePayload[] = []
    const enabledQolRules = (schedulingConfig?.qolRules ?? []).filter((r) => r.enabled)
    if (enabledQolRules.length > 0) {
      const activitiesByCrew = new Map<string, Array<{ codeStr: string; startUtcIso: string }>>()
      for (const a of activities) {
        const codeStr = a.activityCodeId ? activityCodeStringById.get(a.activityCodeId) : null
        if (!codeStr) continue
        const entry = activitiesByCrew.get(a.crewId) ?? []
        entry.push({ codeStr, startUtcIso: a.startUtcIso })
        activitiesByCrew.set(a.crewId, entry)
      }
      const parseHHMM = (s: string): number => {
        const [h, m] = s.split(':').map((x) => parseInt(x, 10))
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
      }
      const shiftDate = (iso: string, deltaDays: number): string => {
        const t = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + deltaDays * 86_400_000
        return new Date(t).toISOString().slice(0, 10)
      }
      for (const rule of enabledQolRules) {
        const codes = new Set((rule.activityCodeIds ?? []).map((c) => c.toUpperCase()))
        if (codes.size === 0) continue
        const cutoff = parseHHMM(rule.timeHHMM ?? '12:00')
        const weight = Math.max(1, Math.min(10, Math.floor(rule.weight ?? 5)))
        const kind: 'wind_down' | 'late_return' = rule.direction === 'before_activity' ? 'wind_down' : 'late_return'
        const offset = kind === 'wind_down' ? -1 : 1
        for (const [crewId, list] of activitiesByCrew.entries()) {
          for (const a of list) {
            if (!codes.has(a.codeStr)) continue
            const targetDate = shiftDate(a.startUtcIso, offset)
            if (targetDate < periodFrom || targetDate > periodTo) continue
            qolSoftRules.push({ crew_id: crewId, kind, date: targetDate, cutoff_min: cutoff, weight })
          }
        }
      }
    }

    const totalVirtualLegalPairs = Object.values(allowedVirtual).reduce((s, arr) => s + arr.length, 0)

    onEvent({
      event: 'progress',
      data: {
        pct: 16,
        message: `Expanded ${pairings.length} pairings → ${virtualPairings.length} open positions (${totalVirtualLegalPairs.toLocaleString()} legal crew×position combinations)`,
        best_obj: null,
      },
    })

    const solverPayload = {
      run_id: runId,
      crew: crew.map((c) => ({
        id: c._id as string,
        gender: (c as { gender?: string | null }).gender ?? 'unknown',
      })),
      pairings: virtualPairings,
      allowed: allowedVirtual,
      config: {
        gender_balance_weight: genderBalanceWeight,
        destination_rules: schedulingConfig?.destinationRules?.filter((r) => r.enabled) ?? [],
        objective_priority: priorityOrder,
        min_rest_min: resolveMinRestMinutes(ruleSet),
        fdtl_limits: extractFdtlLimitsForSolver(ruleSet),
        weekly_rest: extractWeeklyRestForSolver(ruleSet),
        soft_consec_duty: extractSoftConsecDutyRules(
          schedulingConfig as {
            daysOff?: Record<string, unknown> | null
          } | null,
        ),
        qol_soft_rules: qolSoftRules,
      },
      time_limit_sec: timeLimitSec,
    }

    // ── 4. Call Python solver, proxy SSE events ────────────────────────────
    onEvent({
      event: 'progress',
      data: {
        pct: 18,
        message: `Optimizer starting — ${crew.length} crew, ${virtualPairings.length} open positions`,
        best_obj: null,
      },
    })

    let solverRes: Response
    try {
      solverRes = await fetch(`${AUTO_ROSTER_SOLVER_URL}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solverPayload),
        signal,
        // @ts-expect-error -- undici dispatcher accepted by Node's fetch
        dispatcher: solverAgent,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Node fetch surfaces ECONNREFUSED / DNS failure as generic "fetch failed".
      // Detect and surface friendlier message.
      const cause = (err as { cause?: { code?: string } })?.cause
      const code = cause?.code
      if (msg === 'fetch failed' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
        throw new Error('CP-SAT solver service not running')
      }
      throw err
    }

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

    // ── 5. Decode virtual-seat ids → (pairingId, seatCode, seatIndex) ─────
    // Solver returns {crewId, pairingId} but pairingId here is the virtual id
    // `${realPairingId}__${seatCode}__${seatIndex}`. Decode so commit writes
    // to the correct seat directly — no "first-open-slot" lookup needed.
    const decodedProposals = solutionData.assignments.map((a) => {
      const parts = a.pairingId.split('__')
      if (parts.length === 3) {
        const [realPairingId, seatCode, seatIdxStr] = parts
        return {
          crewId: a.crewId,
          pairingId: realPairingId,
          seatCode,
          seatIndex: parseInt(seatIdxStr, 10) || 0,
        }
      }
      // Legacy single-slot virtual — id == parentId, no seat info.
      return { crewId: a.crewId, pairingId: a.pairingId, seatCode: null, seatIndex: null }
    })

    // ── 6. Safety net re-validate + commit ────────────────────────────────
    onEvent({
      event: 'progress',
      data: {
        pct: 96,
        message: `Saving ${decodedProposals.length.toLocaleString()} assignments…`,
        best_obj: null,
      },
    })

    const { assignedCount, rejectedCount, rejectionReasons } = await commitAssignments(
      runId,
      operatorId,
      decodedProposals,
      pairingsById,
      ruleSet,
      crew,
      historyAssignments,
      adaptActivities(historyActivities),
      activityCodesById,
      baseIdToIata,
      userId ?? null,
    )

    if (rejectionReasons.length > 0) {
      const summary = rejectionReasons.map((r) => `${r.count}× ${r.reason}`).join('; ')
      console.warn(`[auto-roster] ${runId} rejection summary: ${summary}`)
      const topReason = rejectionReasons[0]
      onEvent({
        event: 'progress',
        data: {
          pct: 78,
          message: `Saved ${assignedCount.toLocaleString()} assignments, ${rejectedCount.toLocaleString()} rejected (top reason: ${topReason.reason})`,
          best_obj: null,
        },
      })
    } else {
      onEvent({
        event: 'progress',
        data: {
          pct: 78,
          message: `Saved ${assignedCount.toLocaleString()} assignments, 0 rejected`,
          best_obj: null,
        },
      })
    }

    // ── 7. Chain day-off + standby passes (general mode) ──────────────────
    // The solver only assigns pairings. General mode also populates the
    // non-duty calendar: day-offs per OperatorSchedulingConfig.daysOff quota,
    // then standby per .standby quota. Both passes call the existing
    // runDaysOffAssignment / runStandbyAssignment with chained=true so they
    // don't fight over AutoRosterRun status or emit their own 'committed'.
    let chainedDaysOff: { inserted: number; skippedCrew: number; errorCrew: number; crewErrors: string[] } | null = null
    let chainedStandby: { inserted: number; homeAssigned: number; airportAssigned: number } | null = null

    onEvent({
      event: 'progress',
      data: { pct: 80, message: 'Planning days off…', best_obj: null },
    })
    try {
      const res = await runDaysOffAssignment(
        runId,
        operatorId,
        periodFrom,
        periodTo,
        onEvent,
        signal,
        userId,
        null,
        true,
        filters,
        { from: 80, to: 90 },
      )
      if (res) chainedDaysOff = res
    } catch (chainErr) {
      console.warn(`[auto-roster] ${runId} chained day-off pass failed: ${(chainErr as Error).message}`)
    }

    if (!signal?.aborted) {
      onEvent({
        event: 'progress',
        data: { pct: 88, message: 'Planning standby…', best_obj: null },
      })
      try {
        const res = await runStandbyAssignment(
          runId,
          operatorId,
          periodFrom,
          periodTo,
          onEvent,
          signal,
          userId,
          true,
          filters,
          { from: 88, to: 93 },
        )
        if (res) chainedStandby = res
      } catch (chainErr) {
        console.warn(`[auto-roster] ${runId} chained standby pass failed: ${(chainErr as Error).message}`)
      }
    }

    // ── 8. Gap-fill remaining blank days ─────────────────────────────────
    // After pairings + day-off + standby, any calendar day still blank for
    // a crew gets filled with OFF (legacy carrier) or SBY (LCC). Planner
    // sees the full picture instead of gaps.
    let chainedGapFill: { inserted: number; code: string; offFallbacks: number } | null = null
    if (!signal?.aborted) {
      onEvent({
        event: 'progress',
        data: { pct: 93, message: 'Filling remaining blank days…', best_obj: null },
      })
      try {
        const res = await runGapFillPass(runId, operatorId, periodFrom, periodTo, onEvent, signal, userId, filters, {
          from: 93,
          to: 100,
        })
        if (res) chainedGapFill = res
      } catch (chainErr) {
        console.warn(`[auto-roster] ${runId} chained gap-fill pass failed: ${(chainErr as Error).message}`)
      }
    }

    const stats = {
      ...(solutionData.stats as object),
      assignedPairings: assignedCount,
      unassignedPairings: pairings.length - assignedCount,
      pairingsTotal: pairings.length,
      virtualSeatsTotal: virtualPairings.length,
      crewTotal: crew.length,
      daysOffInserted: chainedDaysOff?.inserted ?? 0,
      daysOffSkippedCrew: chainedDaysOff?.skippedCrew ?? 0,
      daysOffErroredCrew: chainedDaysOff?.errorCrew ?? 0,
      standbyInserted: chainedStandby?.inserted ?? 0,
      standbyHome: chainedStandby?.homeAssigned ?? 0,
      standbyAirport: chainedStandby?.airportAssigned ?? 0,
      gapFillInserted: chainedGapFill?.inserted ?? 0,
      gapFillCode: chainedGapFill?.code ?? null,
      gapFillOffFallbacks: chainedGapFill?.offFallbacks ?? 0,
    }

    onEvent({
      event: 'progress',
      data: {
        pct: 100,
        message: `Done — ${assignedCount.toLocaleString()} pairings, ${(chainedDaysOff?.inserted ?? 0).toLocaleString()} days off, ${(chainedStandby?.inserted ?? 0).toLocaleString()} standby blocks across ${crew.length.toLocaleString()} crew`,
        best_obj: null,
      },
    })

    await AutoRosterRun.updateOne(
      { _id: runId },
      {
        status: 'completed',
        completedAt: now(),
        stats,
        updatedAt: now(),
      },
    )

    prewarmRosterRunCache(runId, operatorId, periodFrom, periodTo, filters)

    onEvent({ event: 'committed', data: { assignedCount, rejectedCount, rejectionReasons } })
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
  proposals: Array<{
    crewId: string
    pairingId: string
    seatCode?: string | null
    seatIndex?: number | null
  }>,
  pairingsById: Map<string, CommitPairing>,
  ruleSet: SerializedRuleSet | null,
  crew: Array<{ _id: unknown; base?: string | null; position?: string | null }>,
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
  baseIdToIata: Map<string, string>,
  userId: string | null,
): Promise<{
  assignedCount: number
  rejectedCount: number
  rejectionReasons: Array<{ reason: string; count: number }>
}> {
  const crewById = new Map(crew.map((c) => [c._id as string, c]))
  let assignedCount = 0
  let rejectedCount = 0
  const rejectionCounts: Record<string, number> = {}
  const bumpReason = (r: string) => {
    rejectionCounts[r] = (rejectionCounts[r] ?? 0) + 1
  }
  const now = () => new Date().toISOString()

  // bulkWrite buffer — one round-trip per ~500 proposals instead of per-doc.
  type CommitOp = {
    updateOne: {
      filter: Record<string, unknown>
      update: Record<string, unknown>
      upsert: boolean
    }
  }
  const commitBuf: CommitOp[] = []
  const COMMIT_FLUSH = 500
  const flushCommit = async () => {
    if (commitBuf.length === 0) return
    const ops = commitBuf.splice(0, commitBuf.length)
    await CrewAssignment.bulkWrite(ops, { ordered: false })
  }

  // ── Seat-position resolution setup ─────────────────────────────────────
  // Load operator's CrewPosition master (by _id AND by code) and
  // CrewComplement fallback for pairings missing a denormalised crewCounts.
  const [allPositions, allComplements] = await Promise.all([
    CrewPosition.find({ operatorId }).lean(),
    CrewComplement.find({ operatorId, isActive: true }).lean(),
  ])
  const posById = new Map(allPositions.map((p) => [p._id as string, p]))
  const posByCode = new Map(allPositions.map((p) => [p.code as string, p]))
  const complementIndex = new Map<string, Record<string, number>>()
  for (const c of allComplements) {
    const cc =
      c.counts instanceof Map
        ? (Object.fromEntries(c.counts) as Record<string, number>)
        : ((c.counts ?? {}) as Record<string, number>)
    complementIndex.set(`${c.aircraftTypeIcao}/${c.templateKey}`, cc)
  }

  const resolveCounts = (
    p: CommitPairing & {
      aircraftTypeIcao?: string | null
      complementKey?: string | null
      crewCounts?: Record<string, number> | null
    },
  ): Record<string, number> => {
    const own = (p.crewCounts ?? {}) as Record<string, number>
    if (own && Object.keys(own).length > 0) return own
    const key = `${p.aircraftTypeIcao ?? ''}/${p.complementKey ?? 'standard'}`
    return complementIndex.get(key) ?? {}
  }

  // takenSeats[pairingId][seatPositionId] = Set<seatIndex>
  const takenSeats = new Map<string, Map<string, Set<number>>>()
  for (const a of existingAssignments) {
    if ((a.status ?? '') === 'cancelled') continue
    const seatId = (a as unknown as { seatPositionId?: string | null }).seatPositionId
    const seatIdx = (a as unknown as { seatIndex?: number }).seatIndex ?? 0
    if (!seatId) continue
    let pmap = takenSeats.get(a.pairingId)
    if (!pmap) {
      pmap = new Map()
      takenSeats.set(a.pairingId, pmap)
    }
    let set = pmap.get(seatId)
    if (!set) {
      set = new Set()
      pmap.set(seatId, set)
    }
    set.add(seatIdx)
  }

  // Running-batch snapshot: start from the static period snapshot passed in,
  // then append each proposal we ACCEPT so subsequent proposals for the same
  // crew see the accumulated load. Without this, rolling caps like
  // MAX_BH_28D were evaluated against the pre-run snapshot only, letting
  // solver batch commits breach cumulative limits crew-by-crew.
  const runningAssignments: Array<(typeof existingAssignments)[number]> = [...existingAssignments]

  for (const proposal of proposals) {
    const { crewId, pairingId } = proposal
    const pairing = pairingsById.get(pairingId)
    const crewMember = crewById.get(crewId)
    if (!pairing || !crewMember) {
      rejectedCount++
      bumpReason('unknown crew or pairing id')
      continue
    }

    const candidate = buildCandidateDuty(pairing)
    if (!candidate) {
      rejectedCount++
      bumpReason('candidate duty could not be built from pairing')
      continue
    }

    const existingDuties = buildScheduleDuties({
      crewId,
      assignments: runningAssignments,
      activities: existingActivities,
      pairingsById,
      activityCodesById,
    })

    const overlaps = existingDuties.some((d) => candidate.startUtcMs < d.endUtcMs && candidate.endUtcMs > d.startUtcMs)
    if (overlaps) {
      rejectedCount++
      bumpReason('overlaps existing duty/activity')
      console.warn(
        `[auto-roster] ${runId} safety-net rejected crew=${crewId} pairing=${pairingId}: overlaps existing duty/activity`,
      )
      continue
    }

    const rawBase = crewMember.base ?? ''
    const homeBase = baseIdToIata.get(rawBase) || 'XXXX'
    const result = validateCrewAssignment({
      candidate,
      existing: existingDuties,
      homeBase,
      ruleSet,
    })

    if (result.overall === 'violation') {
      rejectedCount++
      bumpReason(`FDTL: ${result.headline}`)
      console.warn(`[auto-roster] ${runId} safety-net rejected crew=${crewId} pairing=${pairingId}: ${result.headline}`)
      continue
    }

    // ── Resolve target seat ─────────────────────────────────────────────
    // If the caller pre-resolved seat (virtual-seat solver path), use it
    // directly. Else fall back to "crew.position + first-open-slot" lookup
    // (legacy single-slot path).
    const crewPosId = (crewMember as { position?: string | null }).position ?? null
    const crewPos = crewPosId ? posById.get(crewPosId) : null
    if (!crewPos) {
      rejectedCount++
      bumpReason('crew has no CrewPosition')
      console.warn(`[auto-roster] ${runId} rejected crew=${crewId} pairing=${pairingId}: crew has no CrewPosition`)
      continue
    }
    const counts = resolveCounts(
      pairing as CommitPairing & {
        aircraftTypeIcao?: string | null
        complementKey?: string | null
        crewCounts?: Record<string, number> | null
      },
    )

    let seatCode: string
    let seatIndex: number
    let seatPositionId: string

    if (proposal.seatCode && typeof proposal.seatIndex === 'number') {
      // Pre-resolved by virtual-seat expansion — trust solver.
      seatCode = proposal.seatCode
      seatIndex = proposal.seatIndex
      const seatPos = posByCode.get(seatCode)
      if (!seatPos) {
        rejectedCount++
        bumpReason('solver returned unknown seat code')
        console.warn(
          `[auto-roster] ${runId} rejected crew=${crewId} pairing=${pairingId}: solver returned unknown seat code ${seatCode}`,
        )
        continue
      }
      seatPositionId = seatPos._id as string
      // Sanity-check the seat is actually free (race with concurrent writes).
      let pairingTaken = takenSeats.get(pairingId)
      if (!pairingTaken) {
        pairingTaken = new Map()
        takenSeats.set(pairingId, pairingTaken)
      }
      let taken = pairingTaken.get(seatPositionId)
      if (!taken) {
        taken = new Set()
        pairingTaken.set(seatPositionId, taken)
      }
      if (taken.has(seatIndex)) {
        rejectedCount++
        bumpReason('seat already taken (race)')
        console.warn(
          `[auto-roster] ${runId} rejected crew=${crewId} pairing=${pairingId}: seat ${seatCode}#${seatIndex} already taken`,
        )
        continue
      }
      taken.add(seatIndex)
    } else {
      seatCode = crewPos.code as string
      const seatCap = counts[seatCode] ?? 0
      if (seatCap === 0) {
        rejectedCount++
        bumpReason(`pairing has no ${seatCode} seat`)
        console.warn(
          `[auto-roster] ${runId} rejected crew=${crewId} pairing=${pairingId}: pairing has no ${seatCode} seat`,
        )
        continue
      }
      const seatPos = posByCode.get(seatCode)
      if (!seatPos) {
        rejectedCount++
        bumpReason('seat code not in CrewPosition master')
        console.warn(
          `[auto-roster] ${runId} rejected crew=${crewId} pairing=${pairingId}: seat code ${seatCode} not in master`,
        )
        continue
      }
      seatPositionId = seatPos._id as string
      let pairingTaken = takenSeats.get(pairingId)
      if (!pairingTaken) {
        pairingTaken = new Map()
        takenSeats.set(pairingId, pairingTaken)
      }
      let taken = pairingTaken.get(seatPositionId)
      if (!taken) {
        taken = new Set()
        pairingTaken.set(seatPositionId, taken)
      }
      let idx = -1
      for (let i = 0; i < seatCap; i++) {
        if (!taken.has(i)) {
          idx = i
          break
        }
      }
      if (idx === -1) {
        rejectedCount++
        bumpReason(`all ${seatCode} seats filled`)
        console.warn(
          `[auto-roster] ${runId} rejected crew=${crewId} pairing=${pairingId}: all ${seatCap} ${seatCode} seat(s) filled`,
        )
        continue
      }
      seatIndex = idx
      taken.add(seatIndex)
    }

    // Compute UTC window from pairing
    const startUtcIso =
      pairing.reportTime ??
      (pairing.legs?.[0]?.stdUtcIso
        ? new Date(new Date(pairing.legs[0].stdUtcIso).getTime() - 60 * 60_000).toISOString()
        : pairing.startDate + 'T00:00:00.000Z')
    const lastLeg = pairing.legs?.[pairing.legs.length - 1]
    // Add 30-minute debrief to last-leg STA — matches the manual crew-schedule
    // route. Using raw STA starts the FDTL min-rest clock too early, leaving a
    // gap where SBY/next-duty could land inside the real post-duty rest window.
    const endUtcIso = lastLeg?.staUtcIso
      ? new Date(new Date(lastLeg.staUtcIso).getTime() + 30 * 60_000).toISOString()
      : (pairing.endDate ?? pairing.startDate) + 'T23:59:59.000Z'

    commitBuf.push({
      updateOne: {
        filter: { operatorId, crewId, pairingId },
        update: {
          $setOnInsert: {
            _id: crypto.randomUUID(),
            createdAt: now(),
            scenarioId: null,
          },
          $set: {
            operatorId,
            crewId,
            pairingId,
            seatPositionId,
            seatIndex,
            startUtcIso,
            endUtcIso,
            status: 'confirmed',
            sourceRunId: runId,
            assignedByUserId: userId ?? null,
            updatedAt: now(),
          },
        },
        upsert: true,
      },
    })
    if (commitBuf.length >= COMMIT_FLUSH) await flushCommit()
    assignedCount++
    // Register this commit so the NEXT proposal for this crew sees the
    // updated cumulative load. Without this, rolling-window caps slip past
    // the safety net when the solver proposes many pairings per crew.
    runningAssignments.push({
      _id: crypto.randomUUID(),
      crewId,
      pairingId,
      startUtcIso,
      endUtcIso,
      status: 'confirmed',
    })
  }
  await flushCommit()

  const rejectionReasons = Object.entries(rejectionCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return { assignedCount, rejectedCount, rejectionReasons }
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

/**
 * Resolve a SYS-namespace activity code by its code field. Falls back to flag
 * lookup if the canonical code isn't present (legacy operators may carry the
 * flag on a differently-named code). Auto-roster uses:
 *   OFF  → day off
 *   REST → post-duty rest
 *   SBY  → standby
 */
async function resolveSysActivityCode(
  operatorId: string,
  sysCode: 'OFF' | 'REST' | 'SBY',
): Promise<{ _id: string; code: string } | null> {
  const byCode = await ActivityCode.findOne({
    operatorId,
    code: sysCode,
    isActive: true,
    isArchived: { $ne: true },
  }).lean()
  if (byCode) return { _id: byCode._id as string, code: byCode.code as string }

  const fallbackFlags: Record<typeof sysCode, string[]> = {
    OFF: ['is_day_off'],
    REST: ['is_rest_period'],
    SBY: ['is_home_standby', 'is_airport_standby', 'is_reserve'],
  } as const
  const fallback = await pickActivityCode(operatorId, fallbackFlags[sysCode])
  if (fallback) {
    console.warn(
      `[auto-roster] SYS code '${sysCode}' not found for operator ${operatorId}, falling back to flag-based code '${fallback.code}'`,
    )
  }
  return fallback
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
  requestedActivityCodeId: string | null = null,
  chained = false,
  filters: AutoRosterFilters = {},
  progressBand: { from: number; to: number } | null = null,
): Promise<{ inserted: number; skippedCrew: number; errorCrew: number; crewErrors: string[] } | void> {
  const now = () => new Date().toISOString()

  // Remap a local 0-100 pct into the caller's assigned progress band.
  // Chained calls get tight bands (e.g. 80-90); standalone gets 0-100.
  const emitProgress = (localPct: number, message: string) => {
    const pct = progressBand
      ? Math.round(progressBand.from + (localPct / 100) * (progressBand.to - progressBand.from))
      : Math.round(localPct)
    onEvent({ event: 'progress', data: { pct, message, best_obj: null } })
  }

  try {
    emitProgress(4, 'Loading roster data…')

    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }

    // Build filter-derived crew ID allowlist. Same logic as general mode —
    // honours base/position/acTypes/crewGroup from the UI filter panel.
    const filterCrewIds = await resolveCrewIdsForFilters(operatorId, filters)
    const crewQuery: Record<string, unknown> = { operatorId, status: { $ne: 'inactive' } }
    if (filters.base) crewQuery.base = filters.base
    if (filters.position) crewQuery.position = filters.position
    if (filterCrewIds) crewQuery._id = { $in: filterCrewIds }

    const [crew, assignments, activities, schedulingConfig, activityCodes, pairingsForDemand, complementDocs] =
      await Promise.all([
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
        (async () => {
          if (userId) {
            const userDoc = await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean()
            if (userDoc) return userDoc
          }
          return OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
        })(),
        ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean(),
        Pairing.find(
          {
            operatorId,
            scenarioId: scenarioFilter,
            endDate: { $gte: periodFrom },
            startDate: { $lte: periodTo },
          },
          {
            startDate: 1,
            endDate: 1,
            crewCounts: 1,
            aircraftTypeIcao: 1,
            complementKey: 1,
          },
        ).lean(),
        CrewComplement.find({ operatorId, isActive: true }).lean(),
      ])

    if (signal?.aborted) return

    // Resolve day-off activity code. If the caller named one explicitly
    // (UI dropdown), verify it exists + is active + has is_day_off flag.
    // Otherwise fall back to first active SYSTEM OFF code.
    let dayOffCode: { _id: string; code: string } | null = null
    if (requestedActivityCodeId) {
      const doc = await ActivityCode.findOne({
        _id: requestedActivityCodeId,
        operatorId,
        isActive: true,
        isArchived: { $ne: true },
      }).lean()
      if (!doc) {
        throw new Error(`Requested day-off activity code ${requestedActivityCodeId} not found / inactive`)
      }
      dayOffCode = { _id: doc._id as string, code: doc.code as string }
    } else {
      dayOffCode = await resolveSysActivityCode(operatorId, 'OFF')
    }
    if (!dayOffCode) {
      throw new Error('No active SYS OFF activity code — cannot assign days off')
    }

    // Broad "rest" set — any non-duty day for demand/slack accounting.
    // Includes AL, sick, medical, OFF, REST — anything that means the crew
    // isn't available for pairings that day.
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

    // Narrow "day-off-qualifying" set — only SYS OFF + SYS REST codes count
    // toward the `minDaysOff` quota. Annual leave / sick / medical do NOT
    // — those are separate leave categories. Without this split, a crew with
    // plenty of AL would never receive an OFF assignment.
    const dayOffQualifyingIds = new Set<string>(
      activityCodes
        .filter((c) => {
          const flags = ((c.flags ?? []) as string[]) ?? []
          return flags.includes('is_day_off') || flags.includes('is_rest_period')
        })
        .map((c) => c._id as string),
    )
    // Always treat the resolved SYS OFF code as qualifying even if flags miss.
    dayOffQualifyingIds.add(dayOffCode._id)

    const minDaysOff = schedulingConfig?.daysOff?.minPerPeriodDays ?? 8
    const maxDaysOff = schedulingConfig?.daysOff?.maxPerPeriodDays ?? 10
    const maxConsecOff = schedulingConfig?.daysOff?.maxConsecutiveDaysOff ?? 3
    const periodDays = enumerateDays(periodFrom, periodTo)
    const totalCrew = crew.length

    console.log(
      `[auto-roster] ${runId} day-off pass starting — crew=${totalCrew} minOff=${minDaysOff} maxOff=${maxDaysOff} maxConsec=${maxConsecOff} periodDays=${periodDays.length} dayOffCode=${dayOffCode.code} qualifyingCodes=${dayOffQualifyingIds.size}`,
    )
    if (totalCrew === 0) {
      console.warn(`[auto-roster] ${runId} day-off pass aborting — 0 crew matched filters=${JSON.stringify(filters)}`)
    }

    emitProgress(15, `Planning days off — target ${minDaysOff}-${maxDaysOff} per crew over ${periodDays.length} days`)

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

    // Per-crew interval list for precise overlap check. Day-level busyByDay
    // misses pairings that spill past midnight (e.g. 23:30 → 01:00 next day
    // marks day X but not X+1), so a 24h OFF placed on X+1 would collide
    // with the pairing tail. Interval check catches this.
    //
    // OFF is not a duty — it doesn't need a min-rest buffer. A pairing 06:00
    // → 14:00 on day Y does NOT block OFF on day Y-1. Prior implementation
    // used the FDTL min-rest as a buffer here, which incorrectly rejected
    // truly free days adjacent to pairings → standalone Days-Off Only runs
    // placed nothing. Overlap-only keeps OFF and pairings from colliding
    // without sterilising the days around them.
    const dayOffIntervals = new Map<string, Array<{ startMs: number; endMs: number }>>()
    const addDayOffInterval = (crewId: string, startMs: number, endMs: number) => {
      let arr = dayOffIntervals.get(crewId)
      if (!arr) {
        arr = []
        dayOffIntervals.set(crewId, arr)
      }
      arr.push({ startMs, endMs })
    }
    for (const a of assignmentsAdapted) {
      const s = new Date(a.startUtcIso).getTime()
      const e = new Date(a.endUtcIso).getTime()
      if (Number.isFinite(s) && Number.isFinite(e)) addDayOffInterval(a.crewId, s, e)
    }
    for (const a of activitiesAdapted) {
      const s = new Date(a.startUtcIso).getTime()
      const e = new Date(a.endUtcIso).getTime()
      if (Number.isFinite(s) && Number.isFinite(e)) addDayOffInterval(a.crewId, s, e)
    }
    const canPlaceDayOff = (crewId: string, dayIso: string): boolean => {
      const arr = dayOffIntervals.get(crewId)
      if (!arr || arr.length === 0) return true
      const dayStart = new Date(`${dayIso}T00:00:00.000Z`).getTime()
      const dayEnd = new Date(`${dayIso}T23:59:59.999Z`).getTime()
      for (const itv of arr) {
        if (itv.startMs < dayEnd && itv.endMs > dayStart) return false
      }
      return true
    }

    // --- Demand map: crew needed to cover pairings per day ---
    // Demand per pairing = sum of all seat counts (cockpit + cabin + any extra
    // positions). Source of truth order:
    //   1. pairing.crewCounts — explicit per-seat map if the pairing has it
    //   2. CrewComplement lookup by `${aircraftTypeIcao}/${complementKey}`
    //      (falls through to `/standard` when key is null) — authoritative
    //      per-operator complement
    // CrewComplement is seeded per operator, so if both misses happen it's a
    // data gap worth surfacing, not a hidden default.
    const complementBySig = new Map<string, Record<string, number>>()
    for (const c of complementDocs) {
      const raw = (c as { counts?: unknown }).counts
      const cc: Record<string, number> =
        raw instanceof Map
          ? (Object.fromEntries(raw as Map<string, number>) as Record<string, number>)
          : ((raw ?? {}) as Record<string, number>)
      complementBySig.set(`${c.aircraftTypeIcao}/${c.templateKey}`, cc)
    }
    const sumCounts = (counts: Record<string, number> | null | undefined): number => {
      if (!counts) return 0
      let s = 0
      for (const k of Object.keys(counts)) s += Number(counts[k] ?? 0) || 0
      return s
    }
    const demandByDay: Record<string, number> = {}
    for (const d of periodDays) demandByDay[d] = 0
    let demandComplementMisses = 0
    for (const p of pairingsForDemand) {
      const own = (p as { crewCounts?: Record<string, number> | null }).crewCounts
      let pairingDemand = sumCounts(own)
      if (pairingDemand <= 0) {
        const ac = (p as { aircraftTypeIcao?: string | null }).aircraftTypeIcao ?? ''
        const key = (p as { complementKey?: string | null }).complementKey ?? 'standard'
        const comp = complementBySig.get(`${ac}/${key}`) ?? complementBySig.get(`${ac}/standard`)
        pairingDemand = sumCounts(comp)
        if (pairingDemand <= 0) demandComplementMisses++
      }
      const pStart = (p as { startDate: string }).startDate
      const pEnd = (p as { endDate: string }).endDate
      for (const d of periodDays) {
        if (d >= pStart && d <= pEnd) demandByDay[d] += pairingDemand
      }
    }
    if (demandComplementMisses > 0) {
      console.warn(
        `[auto-roster] ${runId} day-off demand: ${demandComplementMisses} pairing(s) had no crewCounts and no matching CrewComplement — contributing 0 demand. Seed CrewComplement for the affected aircraft types.`,
      )
    }

    // --- Current off-count per day (existing rest activities) ---
    const offByDay: Record<string, number> = {}
    for (const d of periodDays) offByDay[d] = 0
    for (const a of activitiesAdapted) {
      if (!a.activityCodeId || !restCodeIds.has(a.activityCodeId)) continue
      const s = new Date(a.startUtcIso),
        e = new Date(a.endUtcIso)
      for (const dt = new Date(s); dt <= e; dt.setUTCDate(dt.getUTCDate() + 1)) {
        const day = dt.toISOString().slice(0, 10)
        if (day in offByDay) offByDay[day]++
      }
    }

    // --- Busy map: crew is unavailable (assignment OR existing activity) ---
    const busyByDay: Record<string, Set<string>> = {}
    for (const d of periodDays) busyByDay[d] = new Set()
    for (const a of assignmentsAdapted) {
      const s = new Date(a.startUtcIso),
        e = new Date(a.endUtcIso)
      for (const dt = new Date(s); dt <= e; dt.setUTCDate(dt.getUTCDate() + 1)) {
        const day = dt.toISOString().slice(0, 10)
        if (day in busyByDay) busyByDay[day].add(a.crewId)
      }
    }
    for (const a of activitiesAdapted) {
      const s = new Date(a.startUtcIso),
        e = new Date(a.endUtcIso)
      for (const dt = new Date(s); dt <= e; dt.setUTCDate(dt.getUTCDate() + 1)) {
        const day = dt.toISOString().slice(0, 10)
        if (day in busyByDay) busyByDay[day].add(a.crewId)
      }
    }

    // Per-crew OFF-day set — existing rest activities that already count
    // toward the day-off quota. Used to enforce maxConsecutiveDaysOff cap:
    // before placing day D, walk neighbours to check the resulting streak
    // wouldn't exceed the cap.
    const offDaysByCrew = new Map<string, Set<string>>()
    for (const a of activitiesAdapted) {
      if (!a.activityCodeId || !dayOffQualifyingIds.has(a.activityCodeId)) continue
      let set = offDaysByCrew.get(a.crewId)
      if (!set) {
        set = new Set()
        offDaysByCrew.set(a.crewId, set)
      }
      const s = new Date(a.startUtcIso)
      const e = new Date(a.endUtcIso)
      for (const dt = new Date(s); dt <= e; dt.setUTCDate(dt.getUTCDate() + 1)) {
        set.add(dt.toISOString().slice(0, 10))
      }
    }
    const projectedOffStreak = (crewId: string, dayIso: string): number => {
      const set = offDaysByCrew.get(crewId) ?? new Set<string>()
      let back = 0
      const cur = new Date(`${dayIso}T00:00:00Z`)
      const prev = new Date(cur.getTime() - 86_400_000)
      while (set.has(prev.toISOString().slice(0, 10))) {
        back++
        prev.setUTCDate(prev.getUTCDate() - 1)
      }
      let forward = 0
      const next = new Date(cur.getTime() + 86_400_000)
      while (set.has(next.toISOString().slice(0, 10))) {
        forward++
        next.setUTCDate(next.getUTCDate() + 1)
      }
      return back + 1 + forward
    }

    // Availability = crew not busy. After N off, remaining = availability - off - N.
    // Require remaining >= demand before placing another off on that day.

    let inserted = 0
    let skippedCrew = 0
    let errorCrew = 0
    const crewErrors: string[] = []

    // Shuffle crew order deterministically by id so concentration on "early in array"
    // crew doesn't bias day picks. Simple stable sort by id hash.
    const crewOrdered = [...crew].sort((a, b) => String(a._id).localeCompare(String(b._id)))

    // bulkWrite buffer — one round-trip per ~500 ops instead of one per
    // off-day. For 7890 crew × 8 days = 63k ops, that's 126 round-trips
    // instead of 63k. Empirically ~10-30× faster.
    type DayOffOp = {
      updateOne: {
        filter: Record<string, unknown>
        update: Record<string, unknown>
        upsert: boolean
      }
    }
    const writeBuf: DayOffOp[] = []
    const FLUSH_THRESHOLD = 500
    const flushBuf = async () => {
      if (writeBuf.length === 0) return
      const ops = writeBuf.splice(0, writeBuf.length)
      await CrewActivity.bulkWrite(ops, { ordered: false })
    }

    for (let i = 0; i < crewOrdered.length; i++) {
      if (signal?.aborted) break
      const c = crewOrdered[i]
      const crewId = c._id as string

      try {
        const busy = buildBusyDays(crewId, assignmentsAdapted, activitiesAdapted)
        // Quota counts only OFF/REST — NOT annual leave / sick / medical.
        const currentRest = countRestDays(crewId, periodDays, activitiesAdapted, dayOffQualifyingIds)
        const need = Math.max(0, minDaysOff - currentRest)
        const cap = Math.max(0, maxDaysOff - currentRest)
        const toAssign = Math.min(need, cap)
        if (toAssign === 0) {
          skippedCrew++
          continue
        }

        // Rank free days by slack = availability - demand - offByDay[d].
        // Higher slack = safer to assign off. Break ties by spreading across period.
        // Interval check (canPlaceDayOff) rejects days where a pairing/activity
        // would overlap the 24h OFF window — catches late-night flights that
        // spill past midnight, which day-level busy map misses.
        // Consecutive-OFF cap (scheduling-config.maxConsecutiveDaysOff) prevents
        // placing a day that would extend an existing chain beyond the limit.
        type Candidate = { day: string; slack: number; pos: number }
        const candidates: Candidate[] = []
        for (let pos = 0; pos < periodDays.length; pos++) {
          const d = periodDays[pos]
          if (busy.has(d)) continue
          if (!canPlaceDayOff(crewId, d)) continue
          if (projectedOffStreak(crewId, d) > maxConsecOff) continue
          const availability = totalCrew - busyByDay[d].size
          const slack = availability - offByDay[d] - demandByDay[d]
          candidates.push({ day: d, slack, pos })
        }
        if (candidates.length === 0) {
          skippedCrew++
          continue
        }

        // Prefer positive-slack days. Among those, spread evenly.
        const safe = candidates.filter((c) => c.slack > 0)
        const pool = safe.length >= toAssign ? safe : candidates
        // Sort by slack desc; then take every Nth to spread.
        pool.sort((a, b) => b.slack - a.slack || a.pos - b.pos)

        // Greedy pick: walk pool in slack order, enforce min gap across period to spread.
        const minGap = Math.max(1, Math.floor(periodDays.length / Math.max(1, toAssign + 1)))
        const pickedPositions: number[] = []
        const picked: string[] = []
        // Mutable per-crew OFF set used for cap-check as we pick.
        const crewOffSet =
          offDaysByCrew.get(crewId) ??
          (() => {
            const s = new Set<string>()
            offDaysByCrew.set(crewId, s)
            return s
          })()
        const wouldExceedCap = (d: string): boolean => {
          crewOffSet.add(d)
          const streak = projectedOffStreak(crewId, d)
          crewOffSet.delete(d)
          return streak > maxConsecOff
        }
        for (const cand of pool) {
          if (picked.length >= toAssign) break
          if (pickedPositions.some((pp) => Math.abs(pp - cand.pos) < minGap)) continue
          if (wouldExceedCap(cand.day)) continue
          // Final demand check post-placement:
          const availability = totalCrew - busyByDay[cand.day].size
          if (availability - offByDay[cand.day] - 1 < demandByDay[cand.day]) {
            // Placing this would underrun demand — skip unless we have no alternative.
            if (safe.length >= toAssign) continue
          }
          picked.push(cand.day)
          pickedPositions.push(cand.pos)
          crewOffSet.add(cand.day)
        }
        // Fallback: if gap filter was too strict, pad without gap — still
        // honor the consecutive-OFF cap.
        if (picked.length < toAssign) {
          for (const cand of pool) {
            if (picked.length >= toAssign) break
            if (picked.includes(cand.day)) continue
            if (wouldExceedCap(cand.day)) continue
            picked.push(cand.day)
            crewOffSet.add(cand.day)
          }
        }

        // Bonus pass: extend OFFs from `need` (=minDaysOff) up to `cap`
        // (=maxDaysOff) ONLY on days with comfortable positive slack. Without
        // this, every crew lands at exactly minDaysOff because the objective
        // has no reward for extra OFFs in the [min, max] band — the max-cap
        // becomes dead config. Strict slack threshold (>= 2) keeps coverage
        // safe; days at zero or negative slack stay assigned to standby/duty
        // capacity. Honours the same consecutive-OFF cap and demand check.
        if (cap > toAssign) {
          for (const cand of pool) {
            if (picked.length >= cap) break
            if (picked.includes(cand.day)) continue
            if (cand.slack < 2) continue
            if (wouldExceedCap(cand.day)) continue
            const availability = totalCrew - busyByDay[cand.day].size
            if (availability - offByDay[cand.day] - 1 < demandByDay[cand.day]) continue
            picked.push(cand.day)
            crewOffSet.add(cand.day)
          }
        }

        for (const day of picked) {
          writeBuf.push({
            updateOne: {
              filter: { operatorId, crewId, dateIso: day, activityCodeId: dayOffCode._id },
              update: {
                $setOnInsert: {
                  _id: crypto.randomUUID(),
                  operatorId,
                  scenarioId: null,
                  crewId,
                  activityCodeId: dayOffCode._id,
                  startUtcIso: `${day}T00:00:00.000Z`,
                  endUtcIso: `${day}T23:59:59.999Z`,
                  dateIso: day,
                  notes: `auto-roster:${runId}`,
                  sourceRunId: runId,
                  assignedByUserId: userId ?? null,
                  createdAt: now(),
                },
                $set: { updatedAt: now() },
              },
              upsert: true,
            },
          })
          inserted++
          offByDay[day]++
          busyByDay[day].add(crewId)
          // Reserve this OFF window in the interval map so a later crew's
          // overlap check sees it (e.g. another rest activity spanning days).
          const offStart = new Date(`${day}T00:00:00.000Z`).getTime()
          const offEnd = new Date(`${day}T23:59:59.999Z`).getTime()
          addDayOffInterval(crewId, offStart, offEnd)
        }
        if (writeBuf.length >= FLUSH_THRESHOLD) await flushBuf()
      } catch (crewErr) {
        errorCrew++
        const msg = crewErr instanceof Error ? crewErr.message : String(crewErr)
        if (crewErrors.length < 10) crewErrors.push(`${crewId}: ${msg}`)
      }

      if (i % 100 === 0) {
        const localPct = 15 + Math.floor((i / totalCrew) * 80)
        const crewPct = totalCrew > 0 ? Math.round(((i + 1) / totalCrew) * 100) : 0
        emitProgress(localPct, `Placed days off for ${i + 1}/${totalCrew} crew (${crewPct}%)`)
      }
    }
    await flushBuf()

    if (signal?.aborted) {
      if (!chained) {
        await AutoRosterRun.updateOne({ _id: runId }, { status: 'cancelled', completedAt: now(), updatedAt: now() })
      }
      return
    }

    if (chained) {
      return { inserted, skippedCrew, errorCrew, crewErrors }
    }

    const stats = {
      mode: 'daysOff',
      daysOffInserted: inserted,
      crewProcessed: totalCrew,
      crewSkipped: skippedCrew,
      crewErrored: errorCrew,
      crewErrorSample: crewErrors,
      activityCode: dayOffCode.code,
    }

    await AutoRosterRun.updateOne({ _id: runId }, { status: 'completed', completedAt: now(), stats, updatedAt: now() })

    if (!chained) prewarmRosterRunCache(runId, operatorId, periodFrom, periodTo, filters)

    onEvent({ event: 'committed', data: { assignedCount: inserted, rejectedCount: 0 } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (chained) throw err
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
  chained = false,
  filters: AutoRosterFilters = {},
  progressBand: { from: number; to: number } | null = null,
): Promise<{ inserted: number; homeAssigned: number; airportAssigned: number } | void> {
  const now = () => new Date().toISOString()

  const emitProgress = (localPct: number, message: string) => {
    const pct = progressBand
      ? Math.round(progressBand.from + (localPct / 100) * (progressBand.to - progressBand.from))
      : Math.round(localPct)
    onEvent({ event: 'progress', data: { pct, message, best_obj: null } })
  }

  try {
    emitProgress(4, 'Loading roster data…')

    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }

    const filterCrewIds = await resolveCrewIdsForFilters(operatorId, filters)
    const crewQuery: Record<string, unknown> = { operatorId, status: { $ne: 'inactive' } }
    if (filters.base) crewQuery.base = filters.base
    if (filters.position) crewQuery.position = filters.position
    if (filterCrewIds) crewQuery._id = { $in: filterCrewIds }

    // Widen the assignment/activity fetch by minRestMs on each side. A pairing
    // ending the day BEFORE periodFrom still imposes rest into day 1 of the
    // roster — without this widening we'd never see it and could place SBY
    // inside that rest window. Same for pairings starting the day after
    // periodTo. Loaded sequentially so the query bounds know the buffer.
    const ruleSetForStbyRest = (await loadSerializedRuleSet(operatorId).catch(() => null)) as SerializedRuleSet | null
    const minRestMsForQuery = resolveMinRestMinutes(ruleSetForStbyRest) * 60_000
    const queryStartIso = new Date(new Date(`${periodFrom}T00:00:00.000Z`).getTime() - minRestMsForQuery).toISOString()
    const queryEndIso = new Date(new Date(`${periodTo}T23:59:59.999Z`).getTime() + minRestMsForQuery).toISOString()

    const [crew, assignments, activities, schedulingConfig, activityCodes, pairingsForDep] = await Promise.all([
      CrewMember.find(crewQuery).lean(),
      CrewAssignment.find({
        operatorId,
        scenarioId: scenarioFilter,
        status: { $ne: 'cancelled' },
        startUtcIso: { $lte: queryEndIso },
        endUtcIso: { $gte: queryStartIso },
      }).lean(),
      CrewActivity.find({
        operatorId,
        scenarioId: scenarioFilter,
        startUtcIso: { $lte: queryEndIso },
        endUtcIso: { $gte: queryStartIso },
      }).lean(),
      (async () => {
        if (userId) {
          const userDoc = await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean()
          if (userDoc) return userDoc
        }
        return OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
      })(),
      ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean(),
      Pairing.find(
        {
          operatorId,
          scenarioId: scenarioFilter,
          endDate: { $gte: periodFrom },
          startDate: { $lte: periodTo },
        },
        { baseAirport: 1, legs: 1, startDate: 1, endDate: 1 },
      ).lean(),
    ])

    if (signal?.aborted) return

    // Prefer the SYS 'SBY' code for both home & airport standby. Legacy
    // operators may split home/airport into separate flagged codes —
    // resolveSysActivityCode falls back to those when 'SBY' is absent.
    const sbyCode = await resolveSysActivityCode(operatorId, 'SBY')
    const airportStandbyCode = await pickActivityCode(operatorId, ['is_airport_standby', 'is_reserve'])
    const homeStandbyCode = sbyCode ?? (await pickActivityCode(operatorId, ['is_home_standby']))
    if (!homeStandbyCode && !airportStandbyCode) {
      throw new Error('No active SYS SBY activity code — cannot assign standby')
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

    const standbyCfg = schedulingConfig?.standby ?? null
    const usePct = standbyCfg?.usePercentage ?? true
    const minPct = standbyCfg?.minPerDayPct ?? 10
    const minFlat = standbyCfg?.minPerDayFlat ?? 2
    const homeRatio = standbyCfg?.homeStandbyRatioPct ?? 80
    const startTimeMode = (standbyCfg?.startTimeMode ?? 'auto') as 'auto' | 'fixed'
    const autoLeadMin = standbyCfg?.autoLeadTimeMin ?? 120
    const fixedStartTimes = (standbyCfg?.fixedStartTimes ?? []) as string[]
    const minDurationMin = standbyCfg?.minDurationMin ?? 360
    const maxDurationMin = standbyCfg?.maxDurationMin ?? 600
    const durationMin = Math.min(maxDurationMin, Math.max(minDurationMin, minDurationMin))

    // Build index: base IATA + day → earliest leg STD UTC (ms). Standby start
    // computed auto: firstDep - autoLeadMin. No leg that day → skip auto and
    // fall through to fixed or default.
    const firstDepMsByBaseDay = new Map<string, number>()
    for (const p of pairingsForDep) {
      const base = ((p as { baseAirport?: string }).baseAirport ?? '').toUpperCase()
      if (!base) continue
      const legs = (p as { legs?: Array<{ stdUtcIso?: string | null; depStation?: string | null }> }).legs ?? []
      for (const leg of legs) {
        if (!leg.stdUtcIso) continue
        const depStation = ((leg.depStation ?? '') as string).toUpperCase()
        // A leg departs from the base when its depStation matches the pairing's base.
        if (depStation && depStation !== base) continue
        const ms = new Date(leg.stdUtcIso).getTime()
        if (!Number.isFinite(ms)) continue
        const day = new Date(ms).toISOString().slice(0, 10)
        const key = `${base}|${day}`
        const prev = firstDepMsByBaseDay.get(key)
        if (prev === undefined || ms < prev) firstDepMsByBaseDay.set(key, ms)
      }
    }

    // Resolve crew.base (airport _id) → IATA for dep lookup.
    const crewBaseIds = [
      ...new Set(crew.map((c) => (c as { base?: string | null }).base).filter((v): v is string => !!v)),
    ]
    const crewBaseDocs =
      crewBaseIds.length > 0 ? await Airport.find({ _id: { $in: crewBaseIds } }, { _id: 1, iataCode: 1 }).lean() : []
    const baseIdToIata = new Map(
      crewBaseDocs.map((a) => [a._id as string, ((a.iataCode as string | null) ?? '').toUpperCase()]),
    )

    // Inter-pairing rest buffer — standby must NOT be placed within min-rest
    // minutes of the crew's adjacent pairing/activity. Day-level "is crew busy
    // today" check isn't enough: a pairing ending 23:00 doesn't touch next
    // day by the slice(0,10) loop, so we'd wrongly mark crew eligible for an
    // early-morning standby the following day with no rest.
    // Reuse ruleset already loaded for the query-bounds widening above.
    const minRestMs = minRestMsForQuery

    // Per-crew interval list of every existing commitment (assignments AND
    // all activities — including any standby just placed). Kept sorted so we
    // binary-search for neighbours when checking each candidate window.
    const crewIntervals = new Map<string, Array<{ startMs: number; endMs: number }>>()
    const addInterval = (crewId: string, startMs: number, endMs: number) => {
      let arr = crewIntervals.get(crewId)
      if (!arr) {
        arr = []
        crewIntervals.set(crewId, arr)
      }
      arr.push({ startMs, endMs })
    }
    for (const a of assignments) {
      const s = new Date(a.startUtcIso).getTime()
      const e = new Date(a.endUtcIso).getTime()
      if (Number.isFinite(s) && Number.isFinite(e)) addInterval(a.crewId, s, e)
    }
    for (const a of activities) {
      const s = new Date(a.startUtcIso).getTime()
      const e = new Date(a.endUtcIso).getTime()
      if (Number.isFinite(s) && Number.isFinite(e)) addInterval(a.crewId, s, e)
    }
    for (const arr of crewIntervals.values()) arr.sort((a, b) => a.startMs - b.startMs)

    const canPlaceStandby = (crewId: string, startMs: number, endMs: number): boolean => {
      const arr = crewIntervals.get(crewId)
      if (!arr) return true
      const reqStart = startMs - minRestMs
      const reqEnd = endMs + minRestMs
      // Simple linear scan — crewIntervals rarely exceed ~60 entries per run.
      for (const itv of arr) {
        // 1) Hard overlap with the standby window itself — always reject,
        //    even when minRestMs is 0 (missing FDTL ruleset).
        if (itv.startMs < endMs && itv.endMs > startMs) return false
        // 2) Reject if interval falls inside the rest-buffer window.
        if (itv.startMs < reqEnd && itv.endMs > reqStart) return false
      }
      return true
    }

    const resolveStandbyWindow = (crewBase: string, dayIso: string): { startIso: string; endIso: string } => {
      // Auto mode: relative to first departure.
      if (startTimeMode === 'auto' && crewBase) {
        const key = `${crewBase}|${dayIso}`
        const firstDepMs = firstDepMsByBaseDay.get(key)
        if (firstDepMs !== undefined) {
          const startMs = firstDepMs - autoLeadMin * 60_000
          const endMs = startMs + durationMin * 60_000
          return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() }
        }
      }
      // Fixed mode (or auto fallback): first HH:MM in fixedStartTimes
      // interpreted as UTC. A timezone-aware implementation is future work.
      const fallbackTime = fixedStartTimes[0] ?? '08:00'
      const hm = /^(\d{1,2}):(\d{2})$/.exec(fallbackTime.trim())
      const hh = hm ? Math.min(23, parseInt(hm[1], 10)) : 8
      const mm = hm ? Math.min(59, parseInt(hm[2], 10)) : 0
      const startMs = new Date(
        `${dayIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`,
      ).getTime()
      const endMs = startMs + durationMin * 60_000
      return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() }
    }

    const periodDays = enumerateDays(periodFrom, periodTo)
    const totalCrew = crew.length

    emitProgress(
      12,
      `Planning standby — ${durationMin}min blocks, ${autoLeadMin}min before first departure, ${homeRatio}% home ratio`,
    )

    // Build per-day busy/standby maps from existing data
    const busyByDay: Record<string, Set<string>> = {}
    const standbyByDay: Record<string, Set<string>> = {}
    const operatingByDay: Record<string, Set<string>> = {}
    for (const d of periodDays) {
      busyByDay[d] = new Set()
      standbyByDay[d] = new Set()
      operatingByDay[d] = new Set()
    }

    // Walk every UTC calendar day touched by [s, e]. Normalize to 00:00Z so
    // pairings crossing midnight (e.g. 22:00→05:00 UTC) tag BOTH days, not
    // just the start day. Without this, standby placed on day 2 wouldn't see
    // the crew as busy and could overlap the pairing tail.
    const walkUtcDays = (s: Date, e: Date, fn: (day: string) => void) => {
      const cursor = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()))
      while (cursor <= e) {
        fn(cursor.toISOString().slice(0, 10))
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }
    for (const a of assignments) {
      const s = new Date(a.startUtcIso)
      const e = new Date(a.endUtcIso)
      walkUtcDays(s, e, (day) => {
        if (day in busyByDay) {
          busyByDay[day].add(a.crewId)
          operatingByDay[day].add(a.crewId)
        }
      })
    }
    for (const a of activities) {
      const s = new Date(a.startUtcIso)
      const e = new Date(a.endUtcIso)
      const isStandby = a.activityCodeId && standbyCodeIds.has(a.activityCodeId as string)
      walkUtcDays(s, e, (day) => {
        if (!(day in busyByDay)) return
        busyByDay[day].add(a.crewId)
        if (isStandby) standbyByDay[day].add(a.crewId)
      })
    }

    let inserted = 0
    let homeAssigned = 0
    let airportAssigned = 0

    // Per-crew running tally of standby days assigned in this run. Used to
    // fan placements across the whole crew pool instead of piling them onto
    // the few crew that happen to be first in the `crew` array every day.
    // Seed with existing standby activities so prior runs don't re-hit the
    // same people.
    const sbyCountByCrew = new Map<string, number>()
    for (const a of activities) {
      if (a.activityCodeId && standbyCodeIds.has(a.activityCodeId as string)) {
        sbyCountByCrew.set(a.crewId, (sbyCountByCrew.get(a.crewId) ?? 0) + 1)
      }
    }
    // Stable tiebreak hash — scatters crew with equal counts instead of
    // always falling back to the array order (which would just re-introduce
    // the unfairness on day 1).
    const tieHash = (id: string): number => {
      let h = 0
      for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) | 0
      return h >>> 0
    }

    type StbyOp = {
      updateOne: {
        filter: Record<string, unknown>
        update: Record<string, unknown>
        upsert: boolean
      }
    }
    const stbyBuf: StbyOp[] = []
    const STBY_FLUSH = 500
    const flushStby = async () => {
      if (stbyBuf.length === 0) return
      const ops = stbyBuf.splice(0, stbyBuf.length)
      await CrewActivity.bulkWrite(ops, { ordered: false })
    }

    let stbyRestRejects = 0

    for (let i = 0; i < periodDays.length; i++) {
      if (signal?.aborted) break
      const day = periodDays[i]
      const operating = operatingByDay[day].size
      // Percentage is normally "% of operating crew". On a blank roster
      // (no pairings → operating = 0) that collapses to 0, which makes the
      // config slider feel broken (5% vs 25% → same result). Fall back to
      // "% of total crew pool" so the setting actually scales the placement
      // volume when there's no pairing context. Floor at minFlat so the
      // percentage can't accidentally underrun the configured minimum.
      const target = usePct
        ? operating > 0
          ? Math.ceil((minPct / 100) * operating)
          : Math.max(minFlat, Math.ceil((minPct / 100) * totalCrew))
        : minFlat
      const existing = standbyByDay[day].size
      const need = Math.max(0, target - existing)
      if (need === 0) continue

      // Candidate pool: crew not flagged busy that day AND whose proposed
      // standby window clears the FDTL min-rest buffer from every existing
      // commitment. Iterate until we've gathered `need` placements or the
      // pool is exhausted.
      const picks: Array<{
        c: (typeof crew)[number]
        startMs: number
        endMs: number
        startIso: string
        endIso: string
      }> = []
      // Order candidates by ascending standby count so lightly-loaded crew
      // are picked first. Ties broken by a hash of the id (stable but
      // not array-order) so day-to-day picks fan out across the pool.
      const crewOrderedForDay = [...crew].sort((a, b) => {
        const aId = a._id as string
        const bId = b._id as string
        const ac = sbyCountByCrew.get(aId) ?? 0
        const bc = sbyCountByCrew.get(bId) ?? 0
        if (ac !== bc) return ac - bc
        return tieHash(aId + day) - tieHash(bId + day)
      })
      for (const c of crewOrderedForDay) {
        if (picks.length >= need) break
        const crewId = c._id as string
        if (busyByDay[day].has(crewId)) continue
        const crewBase = baseIdToIata.get((c as { base?: string | null }).base ?? '') ?? ''
        const { startIso, endIso } = resolveStandbyWindow(crewBase, day)
        const startMs = new Date(startIso).getTime()
        const endMs = new Date(endIso).getTime()
        if (!canPlaceStandby(crewId, startMs, endMs)) {
          stbyRestRejects++
          continue
        }
        picks.push({ c, startMs, endMs, startIso, endIso })
      }
      if (picks.length === 0) continue

      const homeCount = Math.round((homeRatio / 100) * picks.length)
      for (let idx = 0; idx < picks.length; idx++) {
        const { c, startMs, endMs, startIso, endIso } = picks[idx]
        const crewId = c._id as string
        const useHome = idx < homeCount && !!homeStandbyCode
        const code = useHome ? homeStandbyCode! : (airportStandbyCode ?? homeStandbyCode!)
        // Reserve this window in the per-crew interval map so later picks
        // (same loop, later days) respect it.
        addInterval(crewId, startMs, endMs)
        stbyBuf.push({
          updateOne: {
            filter: { operatorId, crewId, dateIso: day, activityCodeId: code._id },
            update: {
              $setOnInsert: {
                _id: crypto.randomUUID(),
                operatorId,
                scenarioId: null,
                crewId,
                activityCodeId: code._id,
                startUtcIso: startIso,
                endUtcIso: endIso,
                dateIso: day,
                notes: `auto-roster:${runId}`,
                sourceRunId: runId,
                assignedByUserId: userId ?? null,
                createdAt: now(),
              },
              $set: { updatedAt: now() },
            },
            upsert: true,
          },
        })
        inserted++
        if (useHome) homeAssigned++
        else airportAssigned++
        // Mark so tomorrow's sort pushes this crew toward the back.
        sbyCountByCrew.set(crewId, (sbyCountByCrew.get(crewId) ?? 0) + 1)
      }
      if (stbyBuf.length >= STBY_FLUSH) await flushStby()

      if (i % 3 === 0) {
        const localPct = 12 + Math.floor((i / periodDays.length) * 82)
        const dayPct = periodDays.length > 0 ? Math.round(((i + 1) / periodDays.length) * 100) : 0
        emitProgress(localPct, `Placed standby — day ${i + 1}/${periodDays.length} (${dayPct}%)`)
      }
    }
    await flushStby()

    if (signal?.aborted) {
      if (!chained) {
        await AutoRosterRun.updateOne({ _id: runId }, { status: 'cancelled', completedAt: now(), updatedAt: now() })
      }
      return
    }

    if (chained) {
      return { inserted, homeAssigned, airportAssigned }
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

    if (!chained) prewarmRosterRunCache(runId, operatorId, periodFrom, periodTo, filters)

    onEvent({ event: 'committed', data: { assignedCount: inserted, rejectedCount: 0 } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (chained) throw err
    await AutoRosterRun.updateOne(
      { _id: runId },
      { status: 'failed', completedAt: now(), error: message, updatedAt: now() },
    )
    onEvent({ event: 'error', data: { message } })
  }
}

// ── Gap-fill pass (general mode final chain) ────────────────────────────────
//
// After pairing / day-off / standby commits, any remaining blank calendar day
// for a crew in the period gets stamped with OFF (legacy) or SBY (lcc) based
// on `OperatorSchedulingConfig.carrierMode`. Respects FDTL min-rest buffer,
// the `maxConsecutiveDaysOff` cap when fill is OFF, and scope filters.

async function runGapFillPass(
  runId: string,
  operatorId: string,
  periodFrom: string,
  periodTo: string,
  onEvent: (event: AutoRosterEvent) => void,
  signal?: AbortSignal,
  userId?: string | null,
  filters: AutoRosterFilters = {},
  progressBand: { from: number; to: number } | null = null,
): Promise<{ inserted: number; code: string; offFallbacks: number } | null> {
  const now = () => new Date().toISOString()
  const emitProgress = (localPct: number, message: string) => {
    const pct = progressBand
      ? Math.round(progressBand.from + (localPct / 100) * (progressBand.to - progressBand.from))
      : Math.round(localPct)
    onEvent({ event: 'progress', data: { pct, message, best_obj: null } })
  }

  const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }
  const filterCrewIds = await resolveCrewIdsForFilters(operatorId, filters)
  const crewQuery: Record<string, unknown> = { operatorId, status: { $ne: 'inactive' } }
  if (filters.base) crewQuery.base = filters.base
  if (filters.position) crewQuery.position = filters.position
  if (filterCrewIds) crewQuery._id = { $in: filterCrewIds }

  // Load ruleset first so the data fetch can widen by minRestMs on each side.
  // Pairings/activities ending the day BEFORE periodFrom still impose rest
  // into day 1 of the gap-fill horizon; without widening we wouldn't see them
  // and could place SBY inside that rest window. Same for the trailing edge.
  const ruleSet = (await loadSerializedRuleSet(operatorId).catch(() => null)) as SerializedRuleSet | null

  // Determine fill target now (carrierMode lives on the per-user config) so
  // we can skip the rest-buffer widening when filling OFF.
  const earlyConfig = await (async () => {
    if (userId) {
      const userDoc = await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean()
      if (userDoc) return userDoc
    }
    return OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
  })()
  const carrierMode = (earlyConfig?.carrierMode ?? 'lcc') as 'lcc' | 'legacy'
  const fillTarget: 'OFF' | 'SBY' = carrierMode === 'legacy' ? 'OFF' : 'SBY'
  const targetCode = await resolveSysActivityCode(operatorId, fillTarget)
  if (!targetCode) {
    emitProgress(100, `Gap-fill skipped — no SYS ${fillTarget} code configured`)
    return null
  }
  // SBY→OFF fallback target. When fillTarget is SBY but the resolved SBY
  // window can't clear the FDTL min-rest buffer from an adjacent flight,
  // OFF can still go on that day (OFF *is* rest, no buffer). This stops
  // gap-fill from leaving a blank day every time SBY collides with a
  // late-evening pairing's rest tail. Loaded eagerly so we don't pay the
  // round-trip per-rejection inside the hot loop.
  const offFallbackCode = fillTarget === 'SBY' ? await resolveSysActivityCode(operatorId, 'OFF') : null
  const maxDaysOffForFallback = earlyConfig?.daysOff?.maxPerPeriodDays ?? 10
  // SBY fill must honour FDTL min-rest from adjacent flight duties — standby
  // is a duty period (callable to operate), not rest. OFF fill stays at 0
  // because OFF *is* rest and may sit immediately next to a pairing.
  const minRestMs = fillTarget === 'SBY' ? resolveMinRestMinutes(ruleSet) * 60_000 : 0
  const queryStartIso = new Date(new Date(`${periodFrom}T00:00:00.000Z`).getTime() - minRestMs).toISOString()
  const queryEndIso = new Date(new Date(`${periodTo}T23:59:59.999Z`).getTime() + minRestMs).toISOString()

  const [crew, assignments, activities, schedulingConfig, activityCodes, pairingsForDep] = await Promise.all([
    CrewMember.find(crewQuery).lean(),
    CrewAssignment.find({
      operatorId,
      scenarioId: scenarioFilter,
      status: { $ne: 'cancelled' },
      startUtcIso: { $lte: queryEndIso },
      endUtcIso: { $gte: queryStartIso },
    }).lean(),
    CrewActivity.find({
      operatorId,
      scenarioId: scenarioFilter,
      startUtcIso: { $lte: queryEndIso },
      endUtcIso: { $gte: queryStartIso },
    }).lean(),
    Promise.resolve(earlyConfig),
    ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean(),
    Pairing.find(
      {
        operatorId,
        scenarioId: scenarioFilter,
        endDate: { $gte: periodFrom },
        startDate: { $lte: periodTo },
      },
      { baseAirport: 1, legs: 1, startDate: 1, endDate: 1 },
    ).lean(),
  ])

  // Standby window resolution for SBY fills. Honours scheduling-config
  // (min/max duration, start mode, lead time, fixed times) AND the FDTL
  // hard cap on standby duration (HOME_STANDBY_MAX_DURATION). OFF fills
  // keep the 24h window (OFF is a calendar day).
  const stbyCfg = schedulingConfig?.standby ?? null
  const stbyStartMode = (stbyCfg?.startTimeMode ?? 'auto') as 'auto' | 'fixed'
  const stbyAutoLeadMin = stbyCfg?.autoLeadTimeMin ?? 120
  const stbyFixedTimes = (stbyCfg?.fixedStartTimes ?? []) as string[]
  const stbyMinDur = stbyCfg?.minDurationMin ?? 360
  const stbyMaxDur = stbyCfg?.maxDurationMin ?? 600
  // FDTL hard cap — home standby max duration (minutes). Parsed from ruleset
  // HOME_STANDBY_MAX_DURATION if present; fall back to company max.
  let fdtlStbyCapMin = Number.POSITIVE_INFINITY
  if (ruleSet) {
    const stbyRule = ruleSet.rules.find((r) => r.code === 'HOME_STANDBY_MAX_DURATION')
    if (stbyRule) {
      const m = /^(\d+):(\d{2})$/.exec(stbyRule.value.trim())
      if (m) fdtlStbyCapMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
    }
  }
  const stbyDurationMin = Math.min(stbyMaxDur, Math.max(stbyMinDur, stbyMinDur), fdtlStbyCapMin)

  // base IATA + day → earliest leg STD UTC ms
  const firstDepMsByBaseDay = new Map<string, number>()
  for (const p of pairingsForDep) {
    const base = ((p as { baseAirport?: string }).baseAirport ?? '').toUpperCase()
    if (!base) continue
    const legs = (p as { legs?: Array<{ stdUtcIso?: string | null; depStation?: string | null }> }).legs ?? []
    for (const leg of legs) {
      if (!leg.stdUtcIso) continue
      const depStation = ((leg.depStation ?? '') as string).toUpperCase()
      if (depStation && depStation !== base) continue
      const ms = new Date(leg.stdUtcIso).getTime()
      if (!Number.isFinite(ms)) continue
      const day = new Date(ms).toISOString().slice(0, 10)
      const key = `${base}|${day}`
      const prev = firstDepMsByBaseDay.get(key)
      if (prev === undefined || ms < prev) firstDepMsByBaseDay.set(key, ms)
    }
  }
  // Crew base (_id) → IATA for dep lookup.
  const crewBaseIds = [
    ...new Set(crew.map((c) => (c as { base?: string | null }).base).filter((v): v is string => !!v)),
  ]
  const crewBaseDocs =
    crewBaseIds.length > 0 ? await Airport.find({ _id: { $in: crewBaseIds } }, { _id: 1, iataCode: 1 }).lean() : []
  const baseIdToIata = new Map(
    crewBaseDocs.map((a) => [a._id as string, ((a.iataCode as string | null) ?? '').toUpperCase()]),
  )

  const resolveFillWindow = (crewBase: string, dayIso: string): { startIso: string; endIso: string } => {
    if (fillTarget === 'OFF') {
      // Day-off = whole UTC day. Legacy carriers treat this as a paid off day.
      return { startIso: `${dayIso}T00:00:00.000Z`, endIso: `${dayIso}T23:59:59.999Z` }
    }
    // SBY: compute using scheduling-config rules.
    let startMs: number | null = null
    if (stbyStartMode === 'auto' && crewBase) {
      const firstDepMs = firstDepMsByBaseDay.get(`${crewBase}|${dayIso}`)
      if (firstDepMs !== undefined) startMs = firstDepMs - stbyAutoLeadMin * 60_000
    }
    if (startMs == null) {
      const t = stbyFixedTimes[0] ?? '08:00'
      const hm = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
      const hh = hm ? Math.min(23, parseInt(hm[1], 10)) : 8
      const mm = hm ? Math.min(59, parseInt(hm[2], 10)) : 0
      startMs = new Date(`${dayIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`).getTime()
    }
    const endMs = startMs + stbyDurationMin * 60_000
    return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() }
  }

  const periodDays = enumerateDays(periodFrom, periodTo)
  const totalCrew = crew.length
  emitProgress(4, `Gap-fill with ${fillTarget} (${carrierMode}) — ${totalCrew} crew × ${periodDays.length} days`)

  const crewIntervals = new Map<string, Array<{ startMs: number; endMs: number }>>()
  const offDaysByCrew = new Map<string, Set<string>>()
  const offFlagSet = new Set<string>(
    activityCodes
      .filter((c) => ((c.flags ?? []) as string[]).some((f) => f === 'is_day_off' || f === 'is_rest_period'))
      .map((c) => c._id as string),
  )

  const addInterval = (crewId: string, startMs: number, endMs: number) => {
    let arr = crewIntervals.get(crewId)
    if (!arr) {
      arr = []
      crewIntervals.set(crewId, arr)
    }
    arr.push({ startMs, endMs })
  }
  for (const a of assignments) {
    const s = new Date(a.startUtcIso).getTime()
    const e = new Date(a.endUtcIso).getTime()
    if (Number.isFinite(s) && Number.isFinite(e)) addInterval(a.crewId, s, e)
  }
  for (const a of activities) {
    const s = new Date(a.startUtcIso).getTime()
    const e = new Date(a.endUtcIso).getTime()
    if (Number.isFinite(s) && Number.isFinite(e)) addInterval(a.crewId, s, e)
    if (a.activityCodeId && offFlagSet.has(a.activityCodeId as string)) {
      let set = offDaysByCrew.get(a.crewId)
      if (!set) {
        set = new Set()
        offDaysByCrew.set(a.crewId, set)
      }
      const sd = new Date(a.startUtcIso)
      const ed = new Date(a.endUtcIso)
      for (const dt = new Date(sd); dt <= ed; dt.setUTCDate(dt.getUTCDate() + 1)) {
        set.add(dt.toISOString().slice(0, 10))
      }
    }
  }

  const busyByCrewDay = new Map<string, Set<string>>()
  const markBusy = (crewId: string, s: Date, e: Date) => {
    let set = busyByCrewDay.get(crewId)
    if (!set) {
      set = new Set()
      busyByCrewDay.set(crewId, set)
    }
    // Walk every UTC calendar day touched by [s, e]. Anchor at 00:00Z so
    // pairings crossing midnight (e.g. 22:00→05:00) tag BOTH days, not
    // just the start day. Anchoring at the raw start time loses interior
    // days when the end falls before the start's HH:MM on a later date.
    const cursor = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()))
    while (cursor <= e) {
      set.add(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  for (const a of assignments) markBusy(a.crewId, new Date(a.startUtcIso), new Date(a.endUtcIso))
  for (const a of activities) markBusy(a.crewId, new Date(a.startUtcIso), new Date(a.endUtcIso))

  // Gap-fill goal: NO BLANK DAYS. Day must be free of any existing
  // pairing/activity window. For SBY (a duty period), the resolved SBY
  // window must additionally clear the FDTL min-rest buffer from every
  // existing commitment — otherwise standby gets placed inside the rest
  // tail of a flight duty (e.g. SBY 03:00Z right after a pairing ending
  // 23:30Z previous day = ~3.5h gap, far below 10–12h rest).
  const canFillDay = (crewId: string, dayIso: string, sbyWindow?: { startMs: number; endMs: number }): boolean => {
    const busy = busyByCrewDay.get(crewId)
    if (busy?.has(dayIso)) return false
    const arr = crewIntervals.get(crewId)
    if (arr && arr.length > 0) {
      const dayStart = new Date(`${dayIso}T00:00:00.000Z`).getTime()
      const dayEnd = new Date(`${dayIso}T23:59:59.999Z`).getTime()
      for (const itv of arr) {
        if (itv.startMs < dayEnd && itv.endMs > dayStart) return false
      }
      // Hard overlap with the resolved SBY window itself — runs even when
      // minRestMs is 0. SBY can cross midnight (window > 24h or starting
      // late evening), in which case the dayIso scan doesn't see the
      // adjacent-day interval that the SBY tail collides with.
      if (sbyWindow) {
        for (const itv of arr) {
          if (itv.startMs < sbyWindow.endMs && itv.endMs > sbyWindow.startMs) return false
        }
        if (minRestMs > 0) {
          const reqStart = sbyWindow.startMs - minRestMs
          const reqEnd = sbyWindow.endMs + minRestMs
          for (const itv of arr) {
            if (itv.startMs < reqEnd && itv.endMs > reqStart) return false
          }
        }
      }
    }
    return true
  }
  const projectedOffStreak = (crewId: string, dayIso: string): number => {
    const set = offDaysByCrew.get(crewId) ?? new Set<string>()
    let back = 0
    const prev = new Date(new Date(`${dayIso}T00:00:00Z`).getTime() - 86_400_000)
    while (set.has(prev.toISOString().slice(0, 10))) {
      back++
      prev.setUTCDate(prev.getUTCDate() - 1)
    }
    let forward = 0
    const next = new Date(new Date(`${dayIso}T00:00:00Z`).getTime() + 86_400_000)
    while (set.has(next.toISOString().slice(0, 10))) {
      forward++
      next.setUTCDate(next.getUTCDate() + 1)
    }
    return back + 1 + forward
  }

  type Op = {
    updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean }
  }
  const buf: Op[] = []
  const FLUSH = 500
  const flush = async () => {
    if (buf.length === 0) return
    const ops = buf.splice(0, buf.length)
    await CrewActivity.bulkWrite(ops, { ordered: false })
  }

  let inserted = 0
  let offFallbacks = 0
  const crewOrdered = [...crew].sort((a, b) => String(a._id).localeCompare(String(b._id)))
  for (let i = 0; i < crewOrdered.length; i++) {
    if (signal?.aborted) break
    const c = crewOrdered[i]
    const crewId = c._id as string
    const crewBase = baseIdToIata.get((c as { base?: string | null }).base ?? '') ?? ''
    for (const day of periodDays) {
      // Resolve the SBY window first so the rest-buffer check inside
      // canFillDay knows the actual proposed time range. OFF doesn't
      // need this (OFF is rest, no buffer required).
      const { startIso, endIso } = resolveFillWindow(crewBase, day)
      const startMs = new Date(startIso).getTime()
      const endMs = new Date(endIso).getTime()
      const sbyWindow =
        fillTarget === 'SBY' && Number.isFinite(startMs) && Number.isFinite(endMs) ? { startMs, endMs } : undefined
      if (!canFillDay(crewId, day, sbyWindow)) {
        // SBY→OFF fallback: SBY rejected on this day. The most common cause
        // is the FDTL min-rest buffer extending from an adjacent flight
        // duty. OFF doesn't need that buffer (OFF *is* rest), so retry the
        // overlap check with no sbyWindow. If clean and crew is below
        // maxDaysOff, drop OFF here instead of leaving the day blank.
        if (
          fillTarget === 'SBY' &&
          offFallbackCode &&
          canFillDay(crewId, day) &&
          (offDaysByCrew.get(crewId)?.size ?? 0) < maxDaysOffForFallback
        ) {
          const offStartIso = `${day}T00:00:00.000Z`
          const offEndIso = `${day}T23:59:59.999Z`
          const offStartMs = new Date(offStartIso).getTime()
          const offEndMs = new Date(offEndIso).getTime()
          buf.push({
            updateOne: {
              filter: { operatorId, crewId, dateIso: day, activityCodeId: offFallbackCode._id },
              update: {
                $setOnInsert: {
                  _id: crypto.randomUUID(),
                  operatorId,
                  scenarioId: null,
                  crewId,
                  activityCodeId: offFallbackCode._id,
                  startUtcIso: offStartIso,
                  endUtcIso: offEndIso,
                  dateIso: day,
                  notes: `auto-roster:${runId}:sby-off-fallback`,
                  sourceRunId: runId,
                  assignedByUserId: userId ?? null,
                  createdAt: now(),
                },
                $set: { updatedAt: now() },
              },
              upsert: true,
            },
          })
          offFallbacks++
          inserted++
          addInterval(crewId, offStartMs, offEndMs)
          const offSet = offDaysByCrew.get(crewId) ?? new Set<string>()
          offSet.add(day)
          offDaysByCrew.set(crewId, offSet)
          const busy = busyByCrewDay.get(crewId) ?? new Set<string>()
          busy.add(day)
          busyByCrewDay.set(crewId, busy)
          console.log(`[auto-roster] ${runId} SBY→OFF fallback: crew=${crewId} day=${day} reason=insufficient_rest`)
          if (buf.length >= FLUSH) await flush()
        }
        continue
      }
      // Gap-fill intentionally ignores the max-consecutive-OFF cap. The cap
      // applies to the targeted day-off quota pass (shapes the spread of
      // OFFs across the period). Gap-fill covers leftover blank days so
      // every calendar day is accounted for — denying it on cap grounds
      // recreates the "blank day" problem the pass exists to solve.
      if (fillTarget === 'OFF') {
        const crewOffSet = offDaysByCrew.get(crewId) ?? new Set<string>()
        crewOffSet.add(day)
        offDaysByCrew.set(crewId, crewOffSet)
      }
      buf.push({
        updateOne: {
          filter: { operatorId, crewId, dateIso: day, activityCodeId: targetCode._id },
          update: {
            $setOnInsert: {
              _id: crypto.randomUUID(),
              operatorId,
              scenarioId: null,
              crewId,
              activityCodeId: targetCode._id,
              startUtcIso: startIso,
              endUtcIso: endIso,
              dateIso: day,
              notes: `auto-roster:${runId}:gap-fill`,
              sourceRunId: runId,
              assignedByUserId: userId ?? null,
              createdAt: now(),
            },
            $set: { updatedAt: now() },
          },
          upsert: true,
        },
      })
      inserted++
      addInterval(crewId, startMs, endMs)
      const busy = busyByCrewDay.get(crewId) ?? new Set<string>()
      busy.add(day)
      busyByCrewDay.set(crewId, busy)
    }
    if (buf.length >= FLUSH) await flush()
    if (i % 100 === 0) {
      const localPct = 4 + Math.floor((i / totalCrew) * 92)
      emitProgress(localPct, `Gap-fill ${i + 1}/${totalCrew} crew — ${inserted.toLocaleString()} ${fillTarget} placed`)
    }
  }
  await flush()
  const fallbackSuffix = offFallbacks > 0 ? ` (incl. ${offFallbacks.toLocaleString()} SBY→OFF fallbacks)` : ''
  emitProgress(
    100,
    `Gap-fill done — ${inserted.toLocaleString()} ${fillTarget} placed (${carrierMode})${fallbackSuffix}`,
  )
  return { inserted, code: targetCode.code, offFallbacks }
}
