import crypto from 'node:crypto'
import { validateCrewAssignment } from '@skyhub/logic/src/fdtl/crew-schedule-validator'
import { buildScheduleDuties } from '@skyhub/logic/src/fdtl/schedule-duty-builder'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewActivity } from '../models/CrewActivity.js'
import { ActivityCode } from '../models/ActivityCode.js'
import { CrewMember } from '../models/CrewMember.js'
import { Pairing } from '../models/Pairing.js'
import { CrewLegalityIssue } from '../models/CrewLegalityIssue.js'
import { AssignmentViolationOverride } from '../models/AssignmentViolationOverride.js'
import { Airport } from '../models/Airport.js'
import { loadSerializedRuleSet } from './fdtl-rule-set.js'

/**
 * Roster-level FDTL evaluator.
 *
 * For each crew: build ScheduleDuty[] via the canonical builder, annotate
 * each assignment with commanderDiscretion when a matching override audit
 * row exists, then pass to validateCrewAssignment. Findings upserted into
 * CrewLegalityIssue. Stale issues (not re-emitted this run) pruned.
 *
 * CMD_DISC_MAX_USES_* is now handled by the evaluator registry via the
 * `commander_discretion_cap` computation_type — the inference map picks
 * it up from the rule code suffix.
 */
export async function evaluateCrewRoster(
  operatorId: string,
  fromIso: string,
  toIso: string,
  options: { scenarioId?: string | null } = {},
): Promise<{ total: number; warnings: number; violations: number }> {
  const scenarioId = options.scenarioId ?? null
  const ruleSet = await loadSerializedRuleSet(operatorId)
  if (!ruleSet) return { total: 0, warnings: 0, violations: 0 }

  const fromMs = new Date(fromIso + 'T00:00:00Z').getTime()
  const toMs = new Date(toIso + 'T23:59:59Z').getTime()
  const historyFromMs = fromMs - 30 * 86_400_000
  const historyFromIso = new Date(historyFromMs).toISOString().slice(0, 10)

  const [crewList, pairings, assignments, activities, activityCodes, overrides] = await Promise.all([
    CrewMember.find({ operatorId }, { _id: 1, base: 1 }).lean(),
    Pairing.find({ operatorId }).lean(),
    CrewAssignment.find({
      operatorId,
      scenarioId,
      endUtcIso: { $gte: historyFromIso },
      startUtcIso: { $lte: toIso + 'T23:59:59Z' },
      status: { $ne: 'cancelled' },
    }).lean(),
    CrewActivity.find({
      operatorId,
      scenarioId,
      endUtcIso: { $gte: historyFromIso },
      startUtcIso: { $lte: toIso + 'T23:59:59Z' },
    }).lean(),
    ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean(),
    AssignmentViolationOverride.find({
      operatorId,
      scenarioId,
      overriddenAtUtc: { $gte: new Date(historyFromMs).toISOString() },
    }).lean(),
  ])

  const activityCodesById = new Map<string, { flags: string[] }>(
    activityCodes.map((c) => [c._id as string, { flags: (c.flags ?? []) as string[] }]),
  )

  // Resolve crew.base (airport UUID) → IATA code. The validator compares
  // station strings (IATA) so a raw UUID in `homeBase` would spuriously
  // flag every pairing as a base mismatch.
  const baseIds = [...new Set(crewList.map((c) => c.base).filter((v): v is string => !!v))]
  const baseDocs =
    baseIds.length > 0 ? await Airport.find({ _id: { $in: baseIds } }, { _id: 1, iataCode: 1 }).lean() : []
  const baseIataById = new Map(baseDocs.map((a) => [a._id as string, (a.iataCode as string | null) ?? null]))

  // Build a Set of assignmentIds that were authorized under commander
  // discretion — the evaluator's CMD_DISC cap reads this flag.
  const cmdDiscAssignIds = new Set<string>()
  for (const o of overrides) {
    const det = o.detail as { commanderDiscretion?: boolean } | null | undefined
    if (!det?.commanderDiscretion) continue
    if (o.assignmentId) cmdDiscAssignIds.add(o.assignmentId)
  }

  // Annotate assignments with commanderDiscretion so the shared builder
  // propagates it through to ScheduleDuty.
  type AssignLike = (typeof assignments)[number] & { commanderDiscretion?: boolean }
  const annotatedAssigns: AssignLike[] = assignments.map((a) => ({
    ...a,
    commanderDiscretion: cmdDiscAssignIds.has(a._id as string),
  }))

  const pairingsById = new Map(
    pairings.map((p) => [
      p._id as string,
      {
        _id: p._id as string,
        pairingCode: (p.pairingCode ?? null) as string | null,
        totalDutyMinutes: (p.totalDutyMinutes ?? null) as number | null,
        totalBlockMinutes: (p.totalBlockMinutes ?? null) as number | null,
        complementKey: (p.complementKey ?? null) as string | null,
        legs: (p.legs ?? []) as Array<{ arrStation?: string | null; stdUtcIso?: string; staUtcIso?: string }>,
      },
    ]),
  )

  const assignsByCrew = new Map<string, AssignLike[]>()
  const actsByCrew = new Map<string, typeof activities>()
  for (const a of annotatedAssigns) {
    const arr = assignsByCrew.get(a.crewId) ?? []
    arr.push(a)
    assignsByCrew.set(a.crewId, arr)
  }
  for (const a of activities) {
    const arr = actsByCrew.get(a.crewId) ?? []
    arr.push(a)
    actsByCrew.set(a.crewId, arr)
  }

  const detectedAtUtc = new Date().toISOString()
  let warnings = 0
  let violations = 0

  for (const crew of crewList) {
    const homeBase = String(baseIataById.get(crew.base as string) ?? '').toUpperCase()
    const crewAssigns = assignsByCrew.get(crew._id as string) ?? []
    const crewActs = actsByCrew.get(crew._id as string) ?? []

    const allDuties = buildScheduleDuties({
      crewId: crew._id as string,
      assignments: crewAssigns.map((a) => ({
        _id: a._id as string,
        crewId: a.crewId,
        pairingId: a.pairingId,
        startUtcIso: a.startUtcIso,
        endUtcIso: a.endUtcIso,
        status: a.status,
        commanderDiscretion: a.commanderDiscretion,
      })),
      activities: crewActs.map((x) => ({
        _id: x._id as string,
        crewId: x.crewId,
        startUtcIso: x.startUtcIso,
        endUtcIso: x.endUtcIso,
        activityCodeId: (x as { activityCodeId?: string | null }).activityCodeId ?? null,
      })),
      pairingsById,
      activityCodesById,
    })

    allDuties.sort((a, b) => a.startUtcMs - b.startUtcMs)

    for (const candidate of allDuties) {
      if (candidate.endUtcMs < fromMs || candidate.startUtcMs > toMs) continue
      const existing = allDuties.filter((d) => d.id !== candidate.id)
      const result = validateCrewAssignment({
        candidate,
        existing,
        homeBase,
        ruleSet: ruleSet as Parameters<typeof validateCrewAssignment>[0]['ruleSet'],
      })
      for (const chk of result.checks) {
        if (chk.status !== 'violation' && chk.status !== 'warning') continue
        if (!chk.ruleCode) continue
        const anchorUtc = new Date(candidate.startUtcMs).toISOString()
        const key = `${operatorId}|${crew._id}|${chk.ruleCode}|${anchorUtc}`
        const _id = crypto.createHash('sha1').update(key).digest('hex')
        await CrewLegalityIssue.updateOne(
          { _id },
          {
            $set: {
              operatorId,
              scenarioId,
              crewId: crew._id as string,
              ruleCode: chk.ruleCode,
              status: chk.status,
              label: chk.label,
              actual: chk.actual,
              limit: chk.limit,
              actualNum: chk.actualNum,
              limitNum: chk.limitNum,
              windowFromIso: chk.windowFromIso ?? null,
              windowToIso: chk.windowToIso ?? null,
              windowLabel: chk.windowLabel ?? null,
              legalReference: chk.legalReference ?? null,
              shortReason: chk.shortReason,
              assignmentIds: [candidate.id],
              activityIds: [],
              periodFromIso: fromIso,
              periodToIso: toIso,
              anchorUtc,
              detectedAtUtc,
            },
          },
          { upsert: true },
        )
        if (chk.status === 'violation') violations += 1
        else warnings += 1
      }
    }
  }

  // Prune stale issues for this period that were NOT re-detected.
  const stale = await CrewLegalityIssue.find({
    operatorId,
    scenarioId,
    periodFromIso: fromIso,
    periodToIso: toIso,
    detectedAtUtc: { $ne: detectedAtUtc },
  }).lean()
  const staleIds = stale.map((s) => s._id as string)
  if (staleIds.length > 0) {
    await CrewLegalityIssue.deleteMany({ _id: { $in: staleIds } })
  }

  return { total: warnings + violations, warnings, violations }
}
