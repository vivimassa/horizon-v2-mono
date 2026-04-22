import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewActivity } from '../models/CrewActivity.js'
import { CrewMemo } from '../models/CrewMemo.js'
import { CrewSchedulePublication } from '../models/CrewSchedulePublication.js'
import { Pairing } from '../models/Pairing.js'
import { CrewMember } from '../models/CrewMember.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { ActivityCode, ActivityCodeGroup } from '../models/ActivityCode.js'
import { CrewComplement } from '../models/CrewComplement.js'
import { FdtlScheme } from '../models/FdtlScheme.js'
import { FdtlRule } from '../models/FdtlRule.js'
import { Airport } from '../models/Airport.js'
import { AssignmentViolationOverride } from '../models/AssignmentViolationOverride.js'
import { CrewQualification } from '../models/CrewQualification.js'
import { AircraftType } from '../models/AircraftType.js'
import { CrewTempBase } from '../models/CrewTempBase.js'
import { loadSerializedRuleSet } from '../services/fdtl-rule-set.js'
import { evaluateCrewRoster } from '../services/evaluate-crew-roster.js'
import { CrewLegalityIssue } from '../models/CrewLegalityIssue.js'

/** Parse an FDTL rule value like "12:00" / "10:30" / raw-number minutes
 *  into total minutes. Returns 0 on parse failure so the UI falls back
 *  to "no mandatory rest" rather than throwing. */
function parseDurationToMinutes(raw: string | null | undefined): number {
  if (!raw) return 0
  const s = String(raw).trim()
  if (/^\d+$/.test(s)) return Number(s)
  const m = s.match(/^(\d{1,3}):(\d{2})$/)
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Resolve seat counts for a pairing. Truth source is the CrewComplement
 * master table keyed by (operatorId, aircraftTypeIcao, templateKey=complementKey).
 * The `pairing.crewCounts` field is a denormalised cache — many pairings
 * in production were generated without it populated, so we fall back to
 * the master lookup rather than treating empty as "no seats required".
 */
function resolveCrewCounts(
  pairing: {
    aircraftTypeIcao?: string | null
    complementKey?: string | null
    crewCounts?: Record<string, number> | null
  },
  complementIndex: Map<string, Record<string, number>>,
): Record<string, number> {
  const own = (pairing.crewCounts ?? {}) as Record<string, number>
  if (own && Object.keys(own).length > 0) return own
  const ac = pairing.aircraftTypeIcao ?? ''
  const tpl = pairing.complementKey ?? 'standard'
  return complementIndex.get(`${ac}/${tpl}`) ?? {}
}

/*
 * Module 4.1.6 Crew Schedule.
 *
 * One aggregator endpoint drives the Gantt + left panel + uncrewed tray in
 * a single roundtrip, plus CRUD on individual assignments. All endpoints
 * enforce the caller's operatorId via req.operatorId from the auth middleware.
 */

type PairingLean = {
  _id: string
  baseAirport: string
  aircraftTypeIcao: string | null
  crewCounts: Record<string, number> | null
  reportTime: string | null
  startDate: string
  endDate: string
  legs: Array<{ stdUtcIso: string; staUtcIso: string; arrStation: string }>
}

function computeAssignmentWindow(p: PairingLean): { startUtcIso: string; endUtcIso: string } {
  // Start = explicit report OR first leg STD − 60min (brief). Using STA
  // − 90 was a pre-existing bug: for long sectors STA comes hours after
  // STD, so the synthetic start was placed mid-flight. Rest / overlap
  // checks then fired incorrectly.
  const firstLeg = p.legs[0]
  const start = p.reportTime ?? (firstLeg ? addMinutesIso(firstLeg.stdUtcIso, -60) : `${p.startDate}T00:00:00.000Z`)
  const lastLeg = p.legs[p.legs.length - 1]
  const end = lastLeg ? addMinutesIso(lastLeg.staUtcIso, 30) : `${p.endDate}T23:59:00.000Z`
  return { startUtcIso: start, endUtcIso: end }
}

function addMinutesIso(iso: string, mins: number): string {
  const t = new Date(iso).getTime() + mins * 60_000
  return new Date(t).toISOString()
}

/**
 * Strict seat eligibility with downrank. Called on POST /assignments to
 * prevent an assignment that violates rank rules. Keep in sync with the
 * client-side copy in `apps/web/src/lib/crew-schedule/seat-eligibility.ts`.
 */
function isEligible(
  crewPosition: { _id: string; category: string; rankOrder: number; canDownrank: boolean } | null,
  seat: { _id: string; category: string; rankOrder: number } | null,
): boolean {
  if (!crewPosition || !seat) return false
  if (crewPosition.category !== seat.category) return false
  if (crewPosition._id === seat._id) return true
  // Lower rankOrder = higher rank. Higher-rank crew can downrank to fill a
  // lower-rank seat only when canDownrank is true.
  if (crewPosition.rankOrder < seat.rankOrder && crewPosition.canDownrank) return true
  return false
}

const createAssignmentSchema = z
  .object({
    pairingId: z.string().min(1),
    crewId: z.string().min(1),
    seatPositionId: z.string().min(1),
    seatIndex: z.number().int().min(0).default(0),
    status: z.enum(['planned', 'confirmed', 'rostered', 'cancelled']).default('planned'),
    notes: z.string().nullable().optional(),
    /** Rule violations the planner acknowledged and overrode. Each entry
     *  creates an `AssignmentViolationOverride` audit row for the future
     *  4.3.1 Schedule Legality Check report. */
    overrides: z
      .array(
        z
          .object({
            violationKind: z.string().min(1),
            messageSnapshot: z.string().nullable().optional(),
            detail: z.unknown().optional(),
            reason: z.string().nullable().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()

const patchAssignmentSchema = z
  .object({
    status: z.enum(['planned', 'confirmed', 'rostered', 'cancelled']).optional(),
    notes: z.string().nullable().optional(),
    /** Reassign to a different crew member (Move flow from 4.1.6 drag-and-drop).
     *  Server revalidates eligibility against the seat + blocks double-book. */
    crewId: z.string().min(1).optional(),
  })
  .strict()

export async function crewScheduleRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /crew-schedule — aggregator for a period ─────────────────────
  app.get('/crew-schedule', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.from || !q.to) return reply.code(400).send({ error: 'from and to are required (ISO date)' })

    const operatorId = req.operatorId
    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }

    const pairingFilter: Record<string, unknown> = {
      operatorId,
      scenarioId: scenarioFilter,
      endDate: { $gte: q.from },
      startDate: { $lte: q.to },
    }
    if (q.acType) pairingFilter.aircraftTypeIcao = q.acType
    if (q.baseAirport) pairingFilter.baseAirport = q.baseAirport

    const crewFilter: Record<string, unknown> = { operatorId, status: { $ne: 'inactive' } }
    if (q.base) crewFilter.base = q.base
    if (q.position) crewFilter.position = q.position

    const assignmentFilter: Record<string, unknown> = {
      operatorId,
      scenarioId: scenarioFilter,
      status: { $ne: 'cancelled' },
      startUtcIso: { $lte: `${q.to}T23:59:59.999Z` },
      endUtcIso: { $gte: `${q.from}T00:00:00.000Z` },
    }

    const activityFilter: Record<string, unknown> = {
      operatorId,
      scenarioId: scenarioFilter,
      startUtcIso: { $lte: `${q.to}T23:59:59.999Z` },
      endUtcIso: { $gte: `${q.from}T00:00:00.000Z` },
    }

    // Memo filter — pull every memo the period could touch:
    //   - pairing-scope memos whose pairing is in the loaded list (filtered post-fetch)
    //   - day-scope memos for dates inside [from, to]
    //   - crew-scope memos (no date constraint)
    // Keep it broad; client trims to what it renders.
    const memoFilter: Record<string, unknown> = {
      operatorId,
      scenarioId: { $in: [null, undefined] as Array<string | null | undefined> },
      $or: [{ scope: 'pairing' }, { scope: 'crew' }, { scope: 'day', dateIso: { $gte: q.from, $lte: q.to } }],
    }

    const [pairings, crew, rawAssignments, positions, activities, activityCodes, activityGroups, memos, complements] =
      await Promise.all([
        Pairing.find(pairingFilter).lean(),
        CrewMember.find(crewFilter).sort({ base: 1, seniority: 1, lastName: 1 }).lean(),
        CrewAssignment.find(assignmentFilter).lean(),
        CrewPosition.find({ operatorId }).lean(),
        CrewActivity.find(activityFilter).lean(),
        ActivityCode.find({ operatorId, isArchived: { $ne: true } }).lean(),
        ActivityCodeGroup.find({ operatorId }).sort({ sortOrder: 1 }).lean(),
        CrewMemo.find(memoFilter).lean(),
        CrewComplement.find({ operatorId, isActive: true }).lean(),
      ])

    // Recompute assignment windows from fresh pairing data. Older writes
    // that used the legs[0].staUtcIso-90 fallback stored bogus startUtcIso
    // values; rebuilding here means the client always sees corrected
    // windows without a data migration.
    const pairingWindowById = new Map<string, { startUtcIso: string; endUtcIso: string }>()
    for (const p of pairings) {
      pairingWindowById.set(p._id as string, computeAssignmentWindow(p as unknown as PairingLean))
    }
    const assignments = rawAssignments.map((a) => {
      const w = pairingWindowById.get(a.pairingId)
      if (!w) return a
      return { ...a, startUtcIso: w.startUtcIso, endUtcIso: w.endUtcIso }
    })

    // Build (aircraftType/templateKey) → counts lookup so we can fall back
    // when a pairing's denormalised crewCounts cache wasn't populated.
    const complementIndex = new Map<string, Record<string, number>>()
    for (const c of complements) {
      const counts =
        c.counts instanceof Map
          ? (Object.fromEntries(c.counts) as Record<string, number>)
          : ((c.counts ?? {}) as Record<string, number>)
      complementIndex.set(`${c.aircraftTypeIcao}/${c.templateKey}`, counts)
    }

    // Resolve each crew's base UUID to an airport IATA code so the client
    // renders "SGN" instead of the raw _id. Required by the left panel,
    // the Pairing Details dialog's Crew Assigned list, and any other
    // surface that reads `crew.baseLabel`.
    const crewBaseIds = [...new Set(crew.map((c) => c.base).filter((v): v is string => !!v))]
    const crewBaseDocs =
      crewBaseIds.length > 0 ? await Airport.find({ _id: { $in: crewBaseIds } }, { _id: 1, iataCode: 1 }).lean() : []
    const crewBaseLabel = new Map(crewBaseDocs.map((a) => [a._id as string, a.iataCode ?? null]))
    for (const c of crew) {
      ;(c as unknown as { baseLabel: string | null }).baseLabel = c.base ? (crewBaseLabel.get(c.base) ?? null) : null
    }

    // Hydrate pairings so downstream (uncrewed tray + client layout) sees
    // the resolved counts regardless of cache state.
    for (const p of pairings) {
      ;(p as unknown as { crewCounts: Record<string, number> }).crewCounts = resolveCrewCounts(
        p as unknown as {
          aircraftTypeIcao?: string | null
          complementKey?: string | null
          crewCounts?: Record<string, number> | null
        },
        complementIndex,
      )
    }

    // Derive uncrewed shortfall per pairing in the period.
    const assignmentsByPairing = new Map<string, Array<{ seatPositionId: string; seatIndex: number }>>()
    for (const a of assignments) {
      const arr = assignmentsByPairing.get(a.pairingId) ?? []
      arr.push({ seatPositionId: a.seatPositionId, seatIndex: a.seatIndex })
      assignmentsByPairing.set(a.pairingId, arr)
    }

    const posByCode = new Map(positions.map((p) => [p.code, p]))

    const uncrewed: Array<{
      pairingId: string
      pairingCode?: string
      startDate: string
      missing: Array<{ seatPositionId: string; seatCode: string; count: number }>
    }> = []
    for (const p of pairings) {
      const counts = (p.crewCounts ?? {}) as Record<string, number>
      if (!counts || Object.keys(counts).length === 0) continue
      const taken = assignmentsByPairing.get(p._id as string) ?? []
      const takenBySeatPos = new Map<string, number>()
      for (const t of taken) takenBySeatPos.set(t.seatPositionId, (takenBySeatPos.get(t.seatPositionId) ?? 0) + 1)

      const missing: Array<{ seatPositionId: string; seatCode: string; count: number }> = []
      for (const [seatCode, needed] of Object.entries(counts)) {
        const seat = posByCode.get(seatCode)
        if (!seat) continue
        const already = takenBySeatPos.get(seat._id as string) ?? 0
        const gap = needed - already
        if (gap > 0) missing.push({ seatPositionId: seat._id as string, seatCode, count: gap })
      }
      if (missing.length > 0) {
        uncrewed.push({
          pairingId: p._id as string,
          pairingCode: (p as unknown as { pairingCode?: string }).pairingCode,
          startDate: p.startDate,
          missing,
        })
      }
    }

    // FDTL scheme — drives visual brief/debrief padding on the uncrewed
    // tray (and anywhere the client needs to compute a duty window from
    // legs when reportTime/releaseTime is null). Default 45/45 mirrors
    // the FdtlScheme schema defaults.
    const scheme = await FdtlScheme.findOne({ operatorId }).lean()
    // Fallbacks are 0/0 (not schema defaults). If a user ever sees duty
    // windows collapse to STD/STA exactly, they immediately know the FDTL
    // scheme for this operator hasn't been seeded. Single failure mode.
    // Pull the two rest rules needed for client-side "mandatory rest
    // after duty" zebra strips. For CAAV VAR 15 these are MIN_REST_HOME_BASE
    // (12:00) and MIN_REST_AWAY (10:00). If the operator's framework uses
    // different codes, they fall back to 0 — the UI then renders no rest
    // strip, which is the least-surprising behaviour.
    const restRuleDocs = scheme
      ? await FdtlRule.find({
          operatorId,
          frameworkCode: scheme.frameworkCode,
          ruleCode: { $in: ['MIN_REST_HOME_BASE', 'MIN_REST_AWAY'] },
          isActive: { $ne: false },
        }).lean()
      : []
    const byCode: Record<string, string> = {}
    for (const r of restRuleDocs) byCode[r.ruleCode] = r.value
    const fdtl = {
      briefMinutes: scheme?.reportTimeMinutes ?? 0,
      // Debrief window on a pill = postFlight + debrief (total time the
      // crew is still on duty after the last STA).
      debriefMinutes: scheme ? (scheme.postFlightMinutes ?? 0) + (scheme.debriefMinutes ?? 0) : 0,
      restRules: {
        homeBaseMinMinutes: parseDurationToMinutes(byCode.MIN_REST_HOME_BASE),
        awayMinMinutes: parseDurationToMinutes(byCode.MIN_REST_AWAY),
      },
    }

    // Qualifications + aircraft types feed the client-side AC-type
    // hard-block check (crew not rated for the pairing's aircraft type,
    // with AC FAMILY fallback). Each qualification carries the
    // `acFamilyQualified` toggle from the crew profile; `aircraftTypes`
    // supplies the family each ICAO belongs to.
    const crewIdsForQuals = crew.map((c) => c._id as string)
    const [quals, acTypes] = await Promise.all([
      crewIdsForQuals.length > 0
        ? CrewQualification.find(
            { operatorId, crewId: { $in: crewIdsForQuals } },
            { crewId: 1, aircraftType: 1, acFamilyQualified: 1 },
          ).lean()
        : Promise.resolve([] as Array<{ crewId: string; aircraftType: string; acFamilyQualified?: boolean }>),
      AircraftType.find({ operatorId }, { icaoType: 1, family: 1 }).lean(),
    ])
    const qualsByCrew = new Map<string, Array<{ aircraftType: string; acFamilyQualified: boolean }>>()
    for (const q of quals) {
      if (!q.aircraftType) continue
      const arr = qualsByCrew.get(q.crewId) ?? []
      arr.push({ aircraftType: q.aircraftType, acFamilyQualified: !!q.acFamilyQualified })
      qualsByCrew.set(q.crewId, arr)
    }
    for (const c of crew) {
      ;(
        c as unknown as { qualifications: Array<{ aircraftType: string; acFamilyQualified: boolean }> }
      ).qualifications = qualsByCrew.get(c._id as string) ?? []
    }
    const aircraftTypes = acTypes.map((t) => ({ icaoType: t.icaoType, family: t.family ?? null }))

    // Crew temp-base assignments that overlap the visible window. Kept
    // simple (overlap check in JS) since the table is small per operator.
    const tempBaseDocs = await CrewTempBase.find({
      operatorId,
      fromIso: { $lte: q.to },
      toIso: { $gte: q.from },
    }).lean()
    const tempBases = tempBaseDocs.map((t) => ({
      _id: t._id as string,
      crewId: t.crewId,
      fromIso: t.fromIso,
      toIso: t.toIso,
      airportCode: t.airportCode,
    }))

    // Full SerializedRuleSet — powers the 4.1.6 FDTL-aware validator.
    // Same assembly path that /fdtl/rule-set returns, so every tweak in
    // /admin/fdt-rules flows here without a code change.
    const ruleSet = await loadSerializedRuleSet(operatorId)

    // Roster-level issues for the visible window. Cheap to read since
    // indexed by (operatorId, periodFromIso, periodToIso). Re-evaluation
    // is triggered separately (mutation-driven or nightly job), but we
    // also do a best-effort inline run when the cache is empty.
    let crewIssues = await CrewLegalityIssue.find({
      operatorId,
      periodFromIso: q.from,
      periodToIso: q.to,
    }).lean()
    if (crewIssues.length === 0 && ruleSet) {
      // First-time fetch for this window — run synchronously so the
      // planner sees findings on load. Subsequent calls hit the cache.
      try {
        await evaluateCrewRoster(operatorId, q.from, q.to)
        crewIssues = await CrewLegalityIssue.find({
          operatorId,
          periodFromIso: q.from,
          periodToIso: q.to,
        }).lean()
      } catch (err) {
        req.log.warn({ err }, 'Roster evaluation failed inline')
      }
    }

    return {
      pairings,
      crew,
      assignments,
      uncrewed,
      positions,
      activities,
      activityCodes,
      activityGroups,
      memos,
      fdtl,
      ruleSet,
      crewIssues,
      aircraftTypes,
      tempBases,
    }
  })

  // POST /crew-schedule/reevaluate-roster — on-demand roster FDTL sweep.
  // Returns aggregate counts; clients then refetch /crew-schedule to get
  // the updated issues. Safe to call after any mutation.
  app.post('/crew-schedule/reevaluate-roster', async (req, reply) => {
    const body = req.body as { operatorId?: string; from?: string; to?: string; scenarioId?: string | null }
    const operatorId = body.operatorId
    const from = body.from
    const to = body.to
    if (!operatorId || !from || !to) {
      return reply.code(400).send({ error: 'operatorId, from, to required' })
    }
    const result = await evaluateCrewRoster(operatorId, from, to, { scenarioId: body.scenarioId ?? null })
    return result
  })

  // ── GET /crew-schedule/pairings/:pairingId/crew ──────────────────────
  // Lightweight endpoint used by the shared PairingDetailsDialog when
  // opened from 4.1.5.1 / 4.1.5.2 (pairing module). Those callers don't
  // hydrate the schedule aggregator, so they can't derive the assigned
  // roster locally — this joins assignments → crew → positions on the
  // server and returns the display-ready rows in one roundtrip.
  app.get('/crew-schedule/pairings/:pairingId/crew', async (req, reply) => {
    const { pairingId } = req.params as { pairingId: string }
    if (!pairingId) return reply.code(400).send({ error: 'pairingId required' })
    const operatorId = req.operatorId

    const assignments = await CrewAssignment.find({
      operatorId,
      pairingId,
      status: { $ne: 'cancelled' },
    }).lean()
    if (assignments.length === 0) return { rows: [] }

    const crewIds = [...new Set(assignments.map((a) => a.crewId))]
    const seatIds = [...new Set(assignments.map((a) => a.seatPositionId))]
    const [members, positions] = await Promise.all([
      CrewMember.find({ operatorId, _id: { $in: crewIds } }).lean(),
      CrewPosition.find({ operatorId, _id: { $in: seatIds } }).lean(),
    ])
    const memberById = new Map(members.map((m) => [m._id as string, m]))
    const posById = new Map(positions.map((p) => [p._id as string, p]))
    const posByCode = new Map(positions.map((p) => [p.code, p]))

    // Resolve base UUID → airport IATA so the UI can render "SGN" instead
    // of the raw document id. Missing / unknown base falls back to null.
    const baseIds = [...new Set(members.map((m) => m.base).filter((v): v is string => !!v))]
    const baseDocs =
      baseIds.length > 0 ? await Airport.find({ _id: { $in: baseIds } }, { _id: 1, iataCode: 1 }).lean() : []
    const baseLabelById = new Map(baseDocs.map((a) => [a._id as string, a.iataCode ?? null]))

    type Row = {
      crewId: string
      firstName: string
      lastName: string
      employeeId: string
      positionCode: string
      positionColor: string | null
      baseLabel: string | null
      seniority: number | null
      status: string
    }
    const rows: Row[] = []
    for (const a of assignments) {
      const m = memberById.get(a.crewId)
      if (!m) continue
      const pos = posById.get(a.seatPositionId)
      rows.push({
        crewId: m._id as string,
        firstName: m.firstName ?? '',
        lastName: m.lastName ?? '',
        employeeId: m.employeeId ?? '',
        positionCode: pos?.code ?? '?',
        positionColor: pos?.color ?? null,
        baseLabel: m.base ? (baseLabelById.get(m.base) ?? null) : null,
        seniority: (m as unknown as { seniority?: number | null }).seniority ?? null,
        status: a.status,
      })
    }
    // Cockpit first, then by rankOrder, then by lastName — stable read.
    rows.sort((x, y) => {
      const px = posByCode.get(x.positionCode)
      const py = posByCode.get(y.positionCode)
      const cx = px?.category ?? 'zzz'
      const cy = py?.category ?? 'zzz'
      if (cx !== cy) return cx === 'cockpit' ? -1 : cy === 'cockpit' ? 1 : cx.localeCompare(cy)
      const rx = px?.rankOrder ?? 99
      const ry = py?.rankOrder ?? 99
      if (rx !== ry) return rx - ry
      return x.lastName.localeCompare(y.lastName)
    })
    return { rows }
  })

  // ── GET /crew-schedule/legality-overrides ────────────────────────────
  // Lightweight feed for the 4.1.6 "Legality Check" toolbar dialog.
  // Returns every `AssignmentViolationOverride` whose assignment is live
  // in the given period, enriched with crew name / employee id / pairing
  // code so the client can render rows without secondary fetches.
  //
  // Not the full 4.3.1 report — that will also re-run the FDTL engine
  // over the schedule. This endpoint only surfaces audit rows already
  // produced by planner overrides at assign time.
  app.get('/crew-schedule/legality-overrides', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.from || !q.to) return reply.code(400).send({ error: 'from and to are required' })
    const operatorId = req.operatorId

    // Find assignments live in [from, to] (non-cancelled).
    const assignments = await CrewAssignment.find({
      operatorId,
      status: { $ne: 'cancelled' },
      startUtcIso: { $lte: `${q.to}T23:59:59.999Z` },
      endUtcIso: { $gte: `${q.from}T00:00:00.000Z` },
    }).lean()
    if (assignments.length === 0) return { rows: [] }

    const assignmentIds = assignments.map((a) => a._id as string)
    const overrides = await AssignmentViolationOverride.find({
      operatorId,
      assignmentId: { $in: assignmentIds },
    })
      .sort({ overriddenAtUtc: -1 })
      .lean()
    if (overrides.length === 0) return { rows: [] }

    const crewIds = [...new Set(overrides.map((o) => o.crewId))]
    const pairingIds = [...new Set(overrides.map((o) => o.pairingId))]
    const [members, pairingDocs] = await Promise.all([
      CrewMember.find(
        { operatorId, _id: { $in: crewIds } },
        { _id: 1, firstName: 1, lastName: 1, employeeId: 1 },
      ).lean(),
      Pairing.find({ operatorId, _id: { $in: pairingIds } }, { _id: 1, pairingCode: 1 }).lean(),
    ])
    const memberById = new Map(members.map((m) => [m._id as string, m]))
    const pairingById = new Map(pairingDocs.map((p) => [p._id as string, p]))

    const rows = overrides.map((o) => {
      const m = memberById.get(o.crewId)
      const p = pairingById.get(o.pairingId)
      return {
        overrideId: o._id as string,
        violationKind: o.violationKind,
        messageSnapshot: o.messageSnapshot ?? null,
        detail: o.detail ?? null,
        crewId: o.crewId,
        crewName: m ? `${m.lastName ?? ''} ${m.firstName ?? ''}`.trim() : null,
        employeeId: m?.employeeId ?? null,
        pairingId: o.pairingId,
        pairingCode: p?.pairingCode ?? null,
        overriddenByUserId: o.overriddenByUserId,
        overriddenAtUtc: o.overriddenAtUtc,
      }
    })
    return { rows }
  })

  // ── Memos (AIMS Alt+M across §4.2 / §4.3 / §4.5) ────────────────────
  const memoSchema = z
    .object({
      scope: z.enum(['pairing', 'day', 'crew']),
      targetId: z.string().min(1),
      dateIso: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      text: z.string().min(1).max(4000),
      pinned: z.boolean().optional(),
    })
    .strict()
    .refine((d) => (d.scope === 'day' ? typeof d.dateIso === 'string' : true), {
      message: 'dateIso required for day-scope memos',
    })

  app.post('/crew-schedule/memos', async (req, reply) => {
    const parsed = memoSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const now = new Date().toISOString()
    const doc = await CrewMemo.create({
      _id: crypto.randomUUID(),
      operatorId: req.operatorId,
      scenarioId: null,
      scope: parsed.data.scope,
      targetId: parsed.data.targetId,
      dateIso: parsed.data.dateIso ?? null,
      text: parsed.data.text,
      pinned: parsed.data.pinned ?? false,
      authorUserId: req.userId || null,
      createdAt: now,
      updatedAt: now,
    })
    return reply.code(201).send(doc.toObject())
  })

  const memoPatchSchema = z
    .object({ text: z.string().min(1).max(4000).optional(), pinned: z.boolean().optional() })
    .strict()
  app.patch('/crew-schedule/memos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = memoPatchSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date().toISOString() }
    const updated = await CrewMemo.findOneAndUpdate(
      { _id: id, operatorId: req.operatorId },
      { $set: patch },
      { new: true },
    ).lean()
    if (!updated) return reply.code(404).send({ error: 'Memo not found' })
    return updated
  })

  app.delete('/crew-schedule/memos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const res = await CrewMemo.deleteOne({ _id: id, operatorId: req.operatorId })
    if (res.deletedCount === 0) return reply.code(404).send({ error: 'Memo not found' })
    return { success: true }
  })

  // ── Publications (AIMS F10 "Compare to Published") ──────────────────
  const publishSchema = z
    .object({
      periodFromIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodToIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().max(280).nullable().optional(),
    })
    .strict()

  /** Create a frozen snapshot of the current production crew schedule
   *  for the given period. Denormalises so the client doesn't need to
   *  reconcile against moving data when rendering the overlay. */
  app.post('/crew-schedule/publications', async (req, reply) => {
    const parsed = publishSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const { periodFromIso, periodToIso, note } = parsed.data
    const operatorId = req.operatorId
    const scenarioFilter = { $in: [null, undefined] as Array<string | null | undefined> }
    const windowFilter = {
      operatorId,
      scenarioId: scenarioFilter,
      startUtcIso: { $lte: `${periodToIso}T23:59:59.999Z` },
      endUtcIso: { $gte: `${periodFromIso}T00:00:00.000Z` },
    }
    const [assignments, activities] = await Promise.all([
      CrewAssignment.find({ ...windowFilter, status: { $ne: 'cancelled' } }).lean(),
      CrewActivity.find(windowFilter).lean(),
    ])
    const now = new Date().toISOString()
    const doc = await CrewSchedulePublication.create({
      _id: crypto.randomUUID(),
      operatorId,
      scenarioId: null,
      periodFromIso,
      periodToIso,
      publishedAtUtc: now,
      publishedByUserId: req.userId || null,
      note: note ?? null,
      assignments: assignments.map((a) => ({
        assignmentId: a._id,
        pairingId: a.pairingId,
        crewId: a.crewId,
        seatPositionId: a.seatPositionId,
        seatIndex: a.seatIndex,
        startUtcIso: a.startUtcIso,
        endUtcIso: a.endUtcIso,
        status: a.status,
      })),
      activities: activities.map((a) => ({
        activityId: a._id,
        crewId: a.crewId,
        activityCodeId: a.activityCodeId,
        startUtcIso: a.startUtcIso,
        endUtcIso: a.endUtcIso,
        dateIso: a.dateIso ?? null,
      })),
      createdAt: now,
      updatedAt: now,
    })
    return reply.code(201).send(doc.toObject())
  })

  /** Latest publication whose period overlaps the requested window. */
  app.get('/crew-schedule/publications/latest', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.from || !q.to) return reply.code(400).send({ error: 'from and to are required' })
    const doc = await CrewSchedulePublication.findOne({
      operatorId: req.operatorId,
      scenarioId: { $in: [null, undefined] as Array<string | null | undefined> },
      periodFromIso: { $lte: q.to },
      periodToIso: { $gte: q.from },
    })
      .sort({ publishedAtUtc: -1 })
      .lean()
    if (!doc) return reply.code(404).send({ error: 'No publication covers this period' })
    return doc
  })

  // ── POST /crew-schedule/activities — assign an activity code to a crew date ──
  const createActivitySchema = z
    .object({
      crewId: z.string().min(1),
      activityCodeId: z.string().min(1),
      /** Either a single YYYY-MM-DD (all-day) or explicit UTC ISO timestamps. */
      dateIso: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      startUtcIso: z.string().optional(),
      endUtcIso: z.string().optional(),
      notes: z.string().nullable().optional(),
    })
    .strict()

  app.post('/crew-schedule/activities', async (req, reply) => {
    const parsed = createActivitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const body = parsed.data
    const operatorId = req.operatorId

    const [crewMember, code] = await Promise.all([
      CrewMember.findOne({ _id: body.crewId, operatorId }).lean(),
      ActivityCode.findOne({ _id: body.activityCodeId, operatorId }).lean(),
    ])
    if (!crewMember) return reply.code(404).send({ error: 'Crew member not found' })
    if (!code) return reply.code(404).send({ error: 'Activity code not found' })

    // Resolve the window. If the caller supplied explicit UTC timestamps,
    // trust them; otherwise treat `dateIso` as an all-day activity with
    // the code's default start/end times (or 00:00 → 23:59 fallback).
    let startUtcIso: string
    let endUtcIso: string
    if (body.startUtcIso && body.endUtcIso) {
      startUtcIso = body.startUtcIso
      endUtcIso = body.endUtcIso
    } else if (body.dateIso) {
      const start = code.defaultStartTime ?? '00:00'
      const end = code.defaultEndTime ?? '23:59'
      startUtcIso = `${body.dateIso}T${start.padEnd(5, '0')}:00.000Z`
      endUtcIso = `${body.dateIso}T${end.padEnd(5, '0')}:00.000Z`
      // If defaults invert across midnight, push end to next day.
      if (new Date(endUtcIso).getTime() <= new Date(startUtcIso).getTime()) {
        const nextDay = new Date(new Date(body.dateIso + 'T00:00:00Z').getTime() + 86_400_000)
          .toISOString()
          .slice(0, 10)
        endUtcIso = `${nextDay}T${end.padEnd(5, '0')}:00.000Z`
      }
    } else {
      return reply.code(400).send({ error: 'Provide either dateIso or (startUtcIso, endUtcIso)' })
    }

    const now = new Date().toISOString()
    const doc = await CrewActivity.create({
      _id: crypto.randomUUID(),
      operatorId,
      scenarioId: null,
      crewId: body.crewId,
      activityCodeId: body.activityCodeId,
      startUtcIso,
      endUtcIso,
      dateIso: body.dateIso ?? null,
      notes: body.notes ?? null,
      assignedByUserId: req.userId || null,
      assignedAtUtc: now,
      createdAt: now,
      updatedAt: now,
    })
    return reply.code(201).send(doc.toObject())
  })

  // ── PATCH /crew-schedule/activities/:id — edit times / notes / code ──
  const patchActivitySchema = z
    .object({
      startUtcIso: z.string().optional(),
      endUtcIso: z.string().optional(),
      notes: z.string().nullable().optional(),
      activityCodeId: z.string().min(1).optional(),
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' })

  app.patch('/crew-schedule/activities/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = patchActivitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const body = parsed.data
    const operatorId = req.operatorId

    // If caller is changing the code, verify it exists under this operator.
    if (body.activityCodeId) {
      const code = await ActivityCode.findOne({ _id: body.activityCodeId, operatorId }).lean()
      if (!code) return reply.code(404).send({ error: 'Activity code not found' })
    }

    // Window validation: if either side is being edited, ensure end > start
    // against the merged document (new field or existing value).
    if (body.startUtcIso || body.endUtcIso) {
      const existing = await CrewActivity.findOne({ _id: id, operatorId }).lean()
      if (!existing) return reply.code(404).send({ error: 'Activity not found' })
      const start = body.startUtcIso ?? existing.startUtcIso
      const end = body.endUtcIso ?? existing.endUtcIso
      if (new Date(end).getTime() <= new Date(start).getTime()) {
        return reply.code(400).send({ error: 'endUtcIso must be after startUtcIso' })
      }
    }

    const patch: Record<string, unknown> = { ...body, updatedAt: new Date().toISOString() }
    const updated = await CrewActivity.findOneAndUpdate({ _id: id, operatorId }, { $set: patch }, { new: true }).lean()
    if (!updated) return reply.code(404).send({ error: 'Activity not found' })
    return updated
  })

  // ── DELETE /crew-schedule/activities/:id ──
  app.delete('/crew-schedule/activities/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const res = await CrewActivity.deleteOne({ _id: id, operatorId: req.operatorId })
    if (res.deletedCount === 0) return reply.code(404).send({ error: 'Activity not found' })
    return { success: true }
  })

  // ── POST /crew-schedule/assignments — create ────────────────────────
  app.post('/crew-schedule/assignments', async (req, reply) => {
    const parsed = createAssignmentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const body = parsed.data
    const operatorId = req.operatorId

    const [pairing, crew, seat, crewPosition] = await Promise.all([
      Pairing.findOne({ _id: body.pairingId, operatorId }).lean() as Promise<PairingLean | null>,
      CrewMember.findOne({ _id: body.crewId, operatorId }).lean(),
      CrewPosition.findOne({ _id: body.seatPositionId, operatorId }).lean(),
      CrewMember.findOne({ _id: body.crewId, operatorId })
        .lean()
        .then(async (m) => (m?.position ? CrewPosition.findOne({ _id: m.position, operatorId }).lean() : null)),
    ])
    if (!pairing) return reply.code(404).send({ error: 'Pairing not found' })
    if (!crew) return reply.code(404).send({ error: 'Crew member not found' })
    if (!seat) return reply.code(404).send({ error: 'Seat position not found' })

    if (
      !isEligible(
        crewPosition
          ? {
              _id: crewPosition._id as string,
              category: crewPosition.category,
              rankOrder: crewPosition.rankOrder,
              canDownrank: !!crewPosition.canDownrank,
            }
          : null,
        { _id: seat._id as string, category: seat.category, rankOrder: seat.rankOrder },
      )
    ) {
      return reply.code(400).send({
        error: 'Crew member not eligible for this seat',
        detail: 'Rank mismatch. Lower rank cannot cover higher; higher rank requires canDownrank=true.',
      })
    }

    // AC type qualification hard-block. Crew must either be rated on the
    // pairing's aircraft type, or rated on another type in the same
    // family with `acFamilyQualified=true`. Un-overridable — the client
    // never offers "Assign anyway" for this kind.
    const pairingAcIcao = (pairing as unknown as { aircraftTypeIcao?: string | null }).aircraftTypeIcao ?? null
    if (pairingAcIcao) {
      const [crewQuals, acTypeDocs] = await Promise.all([
        CrewQualification.find({ operatorId, crewId: body.crewId }, { aircraftType: 1, acFamilyQualified: 1 }).lean(),
        AircraftType.find({ operatorId }, { icaoType: 1, family: 1 }).lean(),
      ])
      const familyByIcao = new Map(acTypeDocs.map((t) => [t.icaoType, t.family ?? null]))
      const pairingFamily = familyByIcao.get(pairingAcIcao) ?? null
      const exact = crewQuals.some((q) => q.aircraftType === pairingAcIcao)
      const familyOk =
        !exact &&
        !!pairingFamily &&
        crewQuals.some((q) => q.acFamilyQualified && (familyByIcao.get(q.aircraftType) ?? null) === pairingFamily)
      if (!exact && !familyOk) {
        return reply.code(400).send({
          error: 'Crew not qualified on AC Type',
          code: 'ac_type_not_qualified',
          pairingAircraftType: pairingAcIcao,
        })
      }
    }

    // Seat capacity check — resolve via CrewComplement fallback when the
    // pairing's denormalised crewCounts cache is empty.
    const complements = await CrewComplement.find({ operatorId, isActive: true }).lean()
    const complementIndex = new Map<string, Record<string, number>>()
    for (const c of complements) {
      const ccCounts =
        c.counts instanceof Map
          ? (Object.fromEntries(c.counts) as Record<string, number>)
          : ((c.counts ?? {}) as Record<string, number>)
      complementIndex.set(`${c.aircraftTypeIcao}/${c.templateKey}`, ccCounts)
    }
    const counts = resolveCrewCounts(
      pairing as unknown as {
        aircraftTypeIcao?: string | null
        complementKey?: string | null
        crewCounts?: Record<string, number> | null
      },
      complementIndex,
    )
    const seatCap = counts[seat.code] ?? 0
    if (body.seatIndex >= seatCap) {
      // Structured error so the client can render a friendly dialog
      // without regex-parsing the message. `error` stays human-readable
      // for logs/legacy consumers.
      return reply.code(400).send({
        error: `Seat index ${body.seatIndex} exceeds capacity ${seatCap} for ${seat.code}`,
        code: 'capacity_exceeded',
        seatCode: seat.code,
        capacity: seatCap,
        attemptedIndex: body.seatIndex,
        pairingCode: (pairing as unknown as { pairingCode?: string }).pairingCode ?? null,
      })
    }

    // Prevent same crew being assigned twice to the same pairing.
    const dupe = await CrewAssignment.findOne({
      operatorId,
      pairingId: body.pairingId,
      crewId: body.crewId,
      status: { $ne: 'cancelled' },
    }).lean()
    if (dupe) return reply.code(409).send({ error: 'Crew member already assigned to this pairing' })

    const { startUtcIso, endUtcIso } = computeAssignmentWindow(pairing)
    const now = new Date().toISOString()

    try {
      const doc = await CrewAssignment.create({
        _id: crypto.randomUUID(),
        operatorId,
        scenarioId: null,
        pairingId: body.pairingId,
        crewId: body.crewId,
        seatPositionId: body.seatPositionId,
        seatIndex: body.seatIndex,
        status: body.status,
        startUtcIso,
        endUtcIso,
        assignedByUserId: req.userId || null,
        assignedAtUtc: now,
        notes: body.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      // Persist each acknowledged override as a separate audit row. Fire
      // & forget per row — a failed audit insert must never prevent the
      // assignment itself from succeeding (planner already confirmed).
      if (body.overrides && body.overrides.length > 0) {
        const rows = body.overrides.map((o) => ({
          _id: crypto.randomUUID(),
          operatorId,
          scenarioId: null,
          assignmentId: doc._id,
          pairingId: body.pairingId,
          crewId: body.crewId,
          violationKind: o.violationKind,
          detail: o.detail ?? null,
          messageSnapshot: o.messageSnapshot ?? null,
          reason: o.reason ?? null,
          overriddenByUserId: req.userId || null,
          overriddenAtUtc: now,
          createdAt: now,
          updatedAt: now,
        }))
        AssignmentViolationOverride.insertMany(rows).catch((e) =>
          req.log.error({ err: e }, 'Failed to persist assignment override audit'),
        )
      }
      return reply.code(201).send(doc.toObject())
    } catch (err) {
      // Unique-index collision on (operatorId, pairingId, seatPositionId, seatIndex)
      if ((err as { code?: number }).code === 11000) {
        return reply.code(409).send({ error: 'That seat is already filled' })
      }
      throw err
    }
  })

  // ── PATCH /crew-schedule/assignments/:id — status / notes / reassign ─
  app.patch('/crew-schedule/assignments/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = patchAssignmentSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const body = parsed.data
    const operatorId = req.operatorId

    // Reassignment path (Move): full eligibility + capacity revalidation.
    if (body.crewId) {
      const assignment = await CrewAssignment.findOne({ _id: id, operatorId }).lean()
      if (!assignment) return reply.code(404).send({ error: 'Assignment not found' })
      if (assignment.crewId === body.crewId) {
        // No-op; fall through to the normal patch below.
      } else {
        const [newCrew, seat, newCrewPosition] = await Promise.all([
          CrewMember.findOne({ _id: body.crewId, operatorId }).lean(),
          CrewPosition.findOne({ _id: assignment.seatPositionId, operatorId }).lean(),
          CrewMember.findOne({ _id: body.crewId, operatorId })
            .lean()
            .then((m) => (m?.position ? CrewPosition.findOne({ _id: m.position, operatorId }).lean() : null)),
        ])
        if (!newCrew) return reply.code(404).send({ error: 'Target crew member not found' })
        if (!seat) return reply.code(404).send({ error: 'Seat position not found' })

        if (
          !isEligible(
            newCrewPosition
              ? {
                  _id: newCrewPosition._id as string,
                  category: newCrewPosition.category,
                  rankOrder: newCrewPosition.rankOrder,
                  canDownrank: !!newCrewPosition.canDownrank,
                }
              : null,
            { _id: seat._id as string, category: seat.category, rankOrder: seat.rankOrder },
          )
        ) {
          return reply.code(400).send({
            error: 'Target crew not eligible for this seat',
            detail: 'Rank mismatch. Lower rank cannot cover higher; higher rank requires canDownrank=true.',
          })
        }

        // Prevent double-book: target crew already on this pairing?
        const existing = await CrewAssignment.findOne({
          operatorId,
          pairingId: assignment.pairingId,
          crewId: body.crewId,
          _id: { $ne: id },
          status: { $ne: 'cancelled' },
        }).lean()
        if (existing) return reply.code(409).send({ error: 'Target crew is already assigned to this pairing' })
      }
    }

    const patch: Record<string, unknown> = { ...body, updatedAt: new Date().toISOString() }
    try {
      const updated = await CrewAssignment.findOneAndUpdate(
        { _id: id, operatorId },
        { $set: patch },
        { new: true },
      ).lean()
      if (!updated) return reply.code(404).send({ error: 'Assignment not found' })
      return updated
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return reply.code(409).send({ error: 'Seat conflict — this seat is already filled for that crew' })
      }
      throw err
    }
  })

  // ── POST /crew-schedule/assignments/swap — atomic swap of crew on
  //    two assignments (AIMS §4.2 "Swap duties"). Each side revalidates
  //    the OTHER side's eligibility. Mongo doesn't give us multi-doc
  //    transactions here without a replica set, so we do it as two
  //    writes under a uniqueness guarantee: if either PATCH fails we
  //    roll back the first by re-applying the original crewId. ───────
  const swapSchema = z
    .object({
      assignmentAId: z.string().min(1),
      assignmentBId: z.string().min(1),
    })
    .strict()

  app.post('/crew-schedule/assignments/swap', async (req, reply) => {
    const parsed = swapSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const { assignmentAId, assignmentBId } = parsed.data
    if (assignmentAId === assignmentBId) {
      return reply.code(400).send({ error: 'Cannot swap an assignment with itself' })
    }
    const operatorId = req.operatorId

    const [a, b] = await Promise.all([
      CrewAssignment.findOne({ _id: assignmentAId, operatorId }).lean(),
      CrewAssignment.findOne({ _id: assignmentBId, operatorId }).lean(),
    ])
    if (!a || !b) return reply.code(404).send({ error: 'One or both assignments not found' })
    if (a.crewId === b.crewId) {
      return reply.code(400).send({ error: 'Both assignments are on the same crew — nothing to swap' })
    }

    // Load positions once.
    const [seatA, seatB, crewA, crewB] = await Promise.all([
      CrewPosition.findOne({ _id: a.seatPositionId, operatorId }).lean(),
      CrewPosition.findOne({ _id: b.seatPositionId, operatorId }).lean(),
      CrewMember.findOne({ _id: a.crewId, operatorId }).lean(),
      CrewMember.findOne({ _id: b.crewId, operatorId }).lean(),
    ])
    if (!seatA || !seatB || !crewA || !crewB) {
      return reply.code(404).send({ error: 'Missing seat or crew record' })
    }
    const [posA, posB] = await Promise.all([
      crewA.position ? CrewPosition.findOne({ _id: crewA.position, operatorId }).lean() : null,
      crewB.position ? CrewPosition.findOne({ _id: crewB.position, operatorId }).lean() : null,
    ])

    // Crew A must be eligible for Seat B, and vice versa.
    const aInB = isEligible(
      posA
        ? {
            _id: posA._id as string,
            category: posA.category,
            rankOrder: posA.rankOrder,
            canDownrank: !!posA.canDownrank,
          }
        : null,
      { _id: seatB._id as string, category: seatB.category, rankOrder: seatB.rankOrder },
    )
    const bInA = isEligible(
      posB
        ? {
            _id: posB._id as string,
            category: posB.category,
            rankOrder: posB.rankOrder,
            canDownrank: !!posB.canDownrank,
          }
        : null,
      { _id: seatA._id as string, category: seatA.category, rankOrder: seatA.rankOrder },
    )
    if (!aInB || !bInA) {
      return reply.code(400).send({
        error: 'Swap violates rank eligibility',
        detail: `${crewA.firstName} ${crewA.lastName} → ${seatB.code}: ${aInB ? 'ok' : 'no'}; ${crewB.firstName} ${crewB.lastName} → ${seatA.code}: ${bInA ? 'ok' : 'no'}`,
      })
    }

    // Perform the swap. Clear crewId on one side first to sidestep the
    // unique index on (pairingId, seatPositionId, seatIndex) when the
    // two assignments happen to be on the same pairing.
    const now = new Date().toISOString()
    const tempCrew = `__swap__${assignmentAId}__${Date.now()}`
    try {
      await CrewAssignment.updateOne({ _id: assignmentAId, operatorId }, { $set: { crewId: tempCrew, updatedAt: now } })
      await CrewAssignment.updateOne({ _id: assignmentBId, operatorId }, { $set: { crewId: a.crewId, updatedAt: now } })
      await CrewAssignment.updateOne({ _id: assignmentAId, operatorId }, { $set: { crewId: b.crewId, updatedAt: now } })
    } catch (err) {
      // Best-effort rollback: try to restore the original crewIds.
      await CrewAssignment.updateOne(
        { _id: assignmentAId, operatorId },
        { $set: { crewId: a.crewId, updatedAt: now } },
      ).catch(() => {})
      await CrewAssignment.updateOne(
        { _id: assignmentBId, operatorId },
        { $set: { crewId: b.crewId, updatedAt: now } },
      ).catch(() => {})
      if ((err as { code?: number }).code === 11000) {
        return reply.code(409).send({ error: 'Swap conflicts with an existing seat assignment' })
      }
      throw err
    }

    return { success: true, swappedAssignmentIds: [assignmentAId, assignmentBId] }
  })

  // ── POST /crew-schedule/assignments/swap-block — atomic swap of every
  //    assignment for two crew members that overlaps [fromIso, toIso].
  //    Used by the block-menu "Swap block with another crew" flow. Both
  //    sides are revalidated for rank eligibility against the OTHER side's
  //    seats. Same 3-phase sidestep as /swap so the unique seat index
  //    doesn't trip during the rewrite. ───────────────────────────────
  const swapBlockSchema = z
    .object({
      sourceCrewId: z.string().min(1),
      targetCrewId: z.string().min(1),
      fromIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      toIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .strict()

  app.post('/crew-schedule/assignments/swap-block', async (req, reply) => {
    const parsed = swapBlockSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const { sourceCrewId, targetCrewId, fromIso, toIso } = parsed.data
    if (sourceCrewId === targetCrewId) {
      return reply.code(400).send({ error: 'Source and target crew are the same' })
    }
    const operatorId = req.operatorId

    // Inclusive date-range overlap via ISO string compare (slice(0,10) is
    // lexicographically safe as YYYY-MM-DD).
    const rangeEndExclusiveIso = new Date(new Date(toIso + 'T00:00:00Z').getTime() + 86_400_000)
      .toISOString()
      .slice(0, 10)
    const overlapQuery = {
      operatorId,
      startUtcIso: { $lt: `${rangeEndExclusiveIso}T00:00:00.000Z` },
      endUtcIso: { $gte: `${fromIso}T00:00:00.000Z` },
      status: { $ne: 'cancelled' as const },
    }
    const [sourceList, targetList] = await Promise.all([
      CrewAssignment.find({ ...overlapQuery, crewId: sourceCrewId }).lean(),
      CrewAssignment.find({ ...overlapQuery, crewId: targetCrewId }).lean(),
    ])
    if (sourceList.length === 0 && targetList.length === 0) {
      return reply.code(400).send({ error: 'No assignments to swap in the selected range' })
    }

    // Eligibility check — preload positions for all seats + crew position.
    const seatIds = [
      ...new Set([...sourceList.map((a) => a.seatPositionId), ...targetList.map((a) => a.seatPositionId)]),
    ]
    const [sourceCrew, targetCrew, seats] = await Promise.all([
      CrewMember.findOne({ _id: sourceCrewId, operatorId }).lean(),
      CrewMember.findOne({ _id: targetCrewId, operatorId }).lean(),
      CrewPosition.find({ _id: { $in: seatIds }, operatorId }).lean(),
    ])
    if (!sourceCrew || !targetCrew) {
      return reply.code(404).send({ error: 'One or both crew members not found' })
    }
    const seatById = new Map(seats.map((s) => [s._id as string, s]))
    const [sourcePos, targetPos] = await Promise.all([
      sourceCrew.position ? CrewPosition.findOne({ _id: sourceCrew.position, operatorId }).lean() : null,
      targetCrew.position ? CrewPosition.findOne({ _id: targetCrew.position, operatorId }).lean() : null,
    ])
    const makePos = (p: typeof sourcePos) =>
      p
        ? {
            _id: p._id as string,
            category: p.category,
            rankOrder: p.rankOrder,
            canDownrank: !!p.canDownrank,
          }
        : null
    // Source crew must be eligible for every target-seat they'll move to.
    for (const a of targetList) {
      const seat = seatById.get(a.seatPositionId)
      if (!seat) continue
      if (
        !isEligible(makePos(sourcePos), {
          _id: seat._id as string,
          category: seat.category,
          rankOrder: seat.rankOrder,
        })
      ) {
        return reply.code(400).send({
          error: 'Source crew not eligible for a target seat',
          detail: `${sourceCrew.firstName} ${sourceCrew.lastName} → ${seat.code}`,
        })
      }
    }
    for (const a of sourceList) {
      const seat = seatById.get(a.seatPositionId)
      if (!seat) continue
      if (
        !isEligible(makePos(targetPos), {
          _id: seat._id as string,
          category: seat.category,
          rankOrder: seat.rankOrder,
        })
      ) {
        return reply.code(400).send({
          error: 'Target crew not eligible for a source seat',
          detail: `${targetCrew.firstName} ${targetCrew.lastName} → ${seat.code}`,
        })
      }
    }

    // Prevent double-book: if source crew is already on a pairing that
    // target also has in the range (or vice versa), the swap would collapse
    // two assignments onto one crew+pairing.
    const sourcePairingIds = new Set(sourceList.map((a) => a.pairingId))
    const targetPairingIds = new Set(targetList.map((a) => a.pairingId))
    for (const pid of sourcePairingIds) {
      if (targetPairingIds.has(pid)) {
        return reply.code(409).send({
          error: 'Swap would double-book both crew on the same pairing',
          detail: `Pairing ${pid} has assignments for both crew in the range`,
        })
      }
    }

    // Two-phase reassignment: park every swapped row on a temp crewId,
    // then repoint each side to the other's real crewId. Rolls back on
    // failure.
    const now = new Date().toISOString()
    const tempSrc = `__swapblock__src__${Date.now()}`
    const tempTgt = `__swapblock__tgt__${Date.now()}`
    const sourceIds = sourceList.map((a) => a._id)
    const targetIds = targetList.map((a) => a._id)
    try {
      if (sourceIds.length > 0) {
        await CrewAssignment.updateMany(
          { _id: { $in: sourceIds }, operatorId },
          { $set: { crewId: tempSrc, updatedAt: now } },
        )
      }
      if (targetIds.length > 0) {
        await CrewAssignment.updateMany(
          { _id: { $in: targetIds }, operatorId },
          { $set: { crewId: tempTgt, updatedAt: now } },
        )
      }
      if (sourceIds.length > 0) {
        await CrewAssignment.updateMany(
          { _id: { $in: sourceIds }, operatorId },
          { $set: { crewId: targetCrewId, updatedAt: now } },
        )
      }
      if (targetIds.length > 0) {
        await CrewAssignment.updateMany(
          { _id: { $in: targetIds }, operatorId },
          { $set: { crewId: sourceCrewId, updatedAt: now } },
        )
      }
    } catch (err) {
      // Best-effort rollback.
      await CrewAssignment.updateMany(
        { _id: { $in: sourceIds }, operatorId },
        { $set: { crewId: sourceCrewId, updatedAt: now } },
      ).catch(() => {})
      await CrewAssignment.updateMany(
        { _id: { $in: targetIds }, operatorId },
        { $set: { crewId: targetCrewId, updatedAt: now } },
      ).catch(() => {})
      if ((err as { code?: number }).code === 11000) {
        return reply.code(409).send({ error: 'Swap block conflicts with an existing seat assignment' })
      }
      throw err
    }

    return {
      success: true,
      swappedSourceCount: sourceIds.length,
      swappedTargetCount: targetIds.length,
    }
  })

  // ── DELETE /crew-schedule/assignments/:id ──────────────────────────
  app.delete('/crew-schedule/assignments/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const res = await CrewAssignment.deleteOne({ _id: id, operatorId: req.operatorId })
    if (res.deletedCount === 0) return reply.code(404).send({ error: 'Activity not found' })
    return { success: true }
  })

  // ── POST /crew-schedule/activities/bulk — assign one activity code to
  //    many dates at once (AIMS §6.1 "Assign series of duties"). Each
  //    entry resolves its own UTC window the same way the singular
  //    endpoint does. Best-effort insertMany (`ordered: false`) so a
  //    unique-index conflict on one day doesn't block the rest. ──
  const bulkActivitySchema = z
    .object({
      activities: z
        .array(
          z
            .object({
              crewId: z.string().min(1),
              activityCodeId: z.string().min(1),
              dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              notes: z.string().nullable().optional(),
            })
            .strict(),
        )
        .min(1)
        .max(366),
    })
    .strict()

  app.post('/crew-schedule/activities/bulk', async (req, reply) => {
    const parsed = bulkActivitySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const operatorId = req.operatorId
    const items = parsed.data.activities

    const codeIds = [...new Set(items.map((i) => i.activityCodeId))]
    const codes = await ActivityCode.find({ operatorId, _id: { $in: codeIds } }).lean()
    const codeById = new Map(codes.map((c) => [c._id as string, c]))

    const crewIds = [...new Set(items.map((i) => i.crewId))]
    const crewCount = await CrewMember.countDocuments({ operatorId, _id: { $in: crewIds } })
    if (crewCount !== crewIds.length) {
      return reply.code(400).send({ error: 'One or more crew IDs do not belong to this operator' })
    }

    const now = new Date().toISOString()
    const docs = items
      .map((it) => {
        const code = codeById.get(it.activityCodeId)
        if (!code) return null
        const start = code.defaultStartTime ?? '00:00'
        const end = code.defaultEndTime ?? '23:59'
        const startUtcIso = `${it.dateIso}T${start.padEnd(5, '0')}:00.000Z`
        let endUtcIso = `${it.dateIso}T${end.padEnd(5, '0')}:00.000Z`
        if (new Date(endUtcIso).getTime() <= new Date(startUtcIso).getTime()) {
          const nextDay = new Date(new Date(it.dateIso + 'T00:00:00Z').getTime() + 86_400_000)
            .toISOString()
            .slice(0, 10)
          endUtcIso = `${nextDay}T${end.padEnd(5, '0')}:00.000Z`
        }
        return {
          _id: crypto.randomUUID(),
          operatorId,
          scenarioId: null,
          crewId: it.crewId,
          activityCodeId: it.activityCodeId,
          startUtcIso,
          endUtcIso,
          dateIso: it.dateIso,
          notes: it.notes ?? null,
          assignedByUserId: req.userId || null,
          assignedAtUtc: now,
          createdAt: now,
          updatedAt: now,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)

    if (docs.length === 0) {
      return reply.code(400).send({ error: 'No valid activity code(s) supplied' })
    }

    try {
      await CrewActivity.insertMany(docs, { ordered: false })
      return reply.code(201).send({ created: docs, failed: 0 })
    } catch (err) {
      const writeErrors = (err as { writeErrors?: unknown[] }).writeErrors ?? []
      const failed = Array.isArray(writeErrors) ? writeErrors.length : 1
      const insertedIds = new Set(
        ((err as { insertedDocs?: Array<{ _id: string }> }).insertedDocs ?? []).map((d) => d._id),
      )
      const created = insertedIds.size > 0 ? docs.filter((d) => insertedIds.has(d._id)) : []
      return reply.code(201).send({ created, failed })
    }
  })

  // ── Crew temp bases ───────────────────────────────────────────────
  // Planner-defined temporary base re-assignments. Used to paint the
  // 4.1.6 Gantt yellow band and to suppress `base_mismatch` warnings on
  // pairings that operate out of the temp airport within the window.
  const tempBaseBodySchema = z.object({
    entries: z
      .array(
        z.object({
          crewId: z.string().min(1),
          fromIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          toIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          airportCode: z.string().regex(/^[A-Za-z]{3}$/),
        }),
      )
      .min(1),
  })

  app.post('/crew-schedule/temp-bases', async (req, reply) => {
    const operatorId = req.operatorId
    const parsed = tempBaseBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message })
    const userId = (req as { userId?: string | null }).userId ?? null
    const docs = parsed.data.entries.map((e) => ({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: e.crewId,
      fromIso: e.fromIso,
      toIso: e.toIso,
      airportCode: e.airportCode.toUpperCase(),
      createdByUserId: userId,
    }))
    await CrewTempBase.insertMany(docs)
    return reply.code(201).send({
      created: docs.map((d) => ({
        _id: d._id,
        crewId: d.crewId,
        fromIso: d.fromIso,
        toIso: d.toIso,
        airportCode: d.airportCode,
      })),
    })
  })

  const tempBasePatchSchema = z.object({
    fromIso: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    toIso: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    airportCode: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .optional(),
  })

  app.patch('/crew-schedule/temp-bases/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = tempBasePatchSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message })
    const patch: Record<string, string> = {}
    if (parsed.data.fromIso) patch.fromIso = parsed.data.fromIso
    if (parsed.data.toIso) patch.toIso = parsed.data.toIso
    if (parsed.data.airportCode) patch.airportCode = parsed.data.airportCode.toUpperCase()
    const doc = await CrewTempBase.findOneAndUpdate({ _id: id, operatorId }, patch, {
      new: true,
      lean: true,
    })
    if (!doc) return reply.code(404).send({ error: 'Not found' })
    return {
      _id: doc._id,
      crewId: doc.crewId,
      fromIso: doc.fromIso,
      toIso: doc.toIso,
      airportCode: doc.airportCode,
    }
  })

  app.delete('/crew-schedule/temp-bases/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const res = await CrewTempBase.deleteOne({ _id: id, operatorId })
    if (res.deletedCount === 0) return reply.code(404).send({ error: 'Not found' })
    return { success: true }
  })
}
