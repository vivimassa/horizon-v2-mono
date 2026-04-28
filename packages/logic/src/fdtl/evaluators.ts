// ─── FDTL Evaluator Registry — data-driven ────────────────────────────────────
// One generic function per computation_type. Validator dispatches rules
// by their computation_type. Adding a new regulator's rule = DB row with
// computation_type + params. No code change in the common case.

import type { RuleComputationType, SerializedRuleSet } from './engine-types'
import type { ScheduleDuty, ScheduleLegalityCheck, CheckStatus } from './crew-schedule-validator-types'

type SerializedRule = SerializedRuleSet['rules'][number]

export interface EvaluatorContext {
  candidate: ScheduleDuty
  existing: ScheduleDuty[]
  ruleSet: SerializedRuleSet
  homeBase: string
}

// ── Utilities ────────────────────────────────────────────────────────────────

function hmmToMinutes(v: string | undefined | null): number | null {
  if (!v) return null
  const s = v.trim()
  const m = s.match(/^(\d+):(\d{2})$/)
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 60) : null
}

function fmtMinutes(min: number): string {
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.round(Math.abs(min) % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function parseWindowToMs(spec: string): number | null {
  const m = spec
    .trim()
    .toUpperCase()
    .match(/^(\d+)([DHMY])$/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  const unit = m[2]
  if (unit === 'H') return n * 3_600_000
  if (unit === 'D') return n * 86_400_000
  if (unit === 'M') return n * 30 * 86_400_000
  if (unit === 'Y') return n * 365 * 86_400_000
  return null
}

function paramStr(params: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!params) return null
  const v = params[key]
  return typeof v === 'string' ? v : null
}

function paramBool(params: Record<string, unknown> | null | undefined, key: string): boolean {
  if (!params) return false
  return params[key] === true
}

// ── Auto-infer computation_type from rule code ──────────────────────────────

export function inferComputationType(
  code: string,
): { type: RuleComputationType; params: Record<string, unknown> } | null {
  // Rolling cumulative — every MAX_* with N{D|H|M|Y} suffix.
  // Subject tokens cover regulators that name block hours "flight time"
  // (CAAV §15.027, EASA ORO.FTL.210) as well as variants using DH/BH/FT.
  const rolling = code.match(/^MAX_(DUTY|DH|BLOCK|BH|FLIGHT_TIME|FT|FDP|LANDINGS|SECTORS)_(\d+)([DHMY])$/i)
  if (rolling) {
    const subject = rolling[1].toUpperCase()
    const fieldMap: Record<string, string> = {
      DUTY: 'duty',
      DH: 'duty',
      BLOCK: 'block',
      BH: 'block',
      FLIGHT_TIME: 'block',
      FT: 'block',
      FDP: 'fdp',
      LANDINGS: 'landings',
      SECTORS: 'landings',
    }
    return {
      type: 'rolling_cumulative',
      params: { window: `${rolling[2]}${rolling[3].toUpperCase()}`, field: fieldMap[subject] },
    }
  }

  // Commander discretion rolling cap — CMD_DISC_MAX_USES_{N}{D|M|Y}.
  const cmdDisc = code.match(/^CMD_DISC_MAX_USES_(\d+)([DHMY])$/i)
  if (cmdDisc) {
    return {
      type: 'commander_discretion_cap',
      params: { window: `${cmdDisc[1]}${cmdDisc[2].toUpperCase()}` },
    }
  }

  // Min rest between duties — location-aware.
  if (code === 'MIN_REST_HOME_BASE') return { type: 'min_rest_between_events', params: { context: 'home' } }
  if (code === 'MIN_REST_AWAY') return { type: 'min_rest_between_events', params: { context: 'away' } }
  if (
    code === 'MIN_REST_PRE_FDP' ||
    code === 'REDUCED_REST_MIN' ||
    code === 'MIN_REST_AFTER_DUTY' ||
    code === 'MIN_REST' ||
    code === 'REST_MIN_HOURS'
  )
    return { type: 'min_rest_between_events', params: { context: 'any' } }
  if (code === 'MIN_REST_EXTENDED') return { type: 'min_rest_between_events', params: { context: 'extended' } }

  // Min rest after augmented.
  if (code === 'MIN_REST_AFTER_AUGMENTED') return { type: 'min_rest_after_augmented', params: {} }

  // Weekly / extended recovery rest.
  if (code === 'MIN_EXTENDED_RECOVERY' || code === 'WEEKLY_TIME_FREE')
    return {
      type: 'min_rest_in_window',
      params: { windowRule: 'MAX_BETWEEN_EXTENDED_RECOVERY', defaultWindow: '168H' },
    }

  // Per-duty limits (landings/sectors per FDP).
  if (code === 'MAX_LANDINGS_PER_FDP' || code === 'MAX_SECTORS_PER_FDP')
    return { type: 'per_duty_limit', params: { field: 'landings' } }

  // Consecutive duty-day counts.
  if (code.startsWith('MAX_CONSECUTIVE_')) return { type: 'consecutive_count', params: {} }

  // Explicitly inert shapes — prevent false alarms from inference.
  // REDUCED_REST_MAX_7D, MAX_BH_365D handled by rolling regex above.

  return null
}

// ── Rule resolver ────────────────────────────────────────────────────────────

export interface ResolvedRule {
  rule: SerializedRule
  type: RuleComputationType
  params: Record<string, unknown>
}

export function resolveRule(rule: SerializedRule): ResolvedRule | null {
  if (rule.computationType === 'custom') return null
  if (rule.computationType) {
    return { rule, type: rule.computationType, params: rule.params ?? {} }
  }
  const inferred = inferComputationType(rule.code)
  if (!inferred) return null
  return { rule, type: inferred.type, params: inferred.params }
}

// ── Evaluators ───────────────────────────────────────────────────────────────

export function evaluateRollingCumulative(resolved: ResolvedRule, ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const field = paramStr(resolved.params, 'field') ?? 'duty'
  const isCount = field === 'landings'

  let limitNum: number | null
  if (isCount) {
    const n = parseInt(resolved.rule.value, 10)
    limitNum = Number.isFinite(n) ? n : null
  } else {
    limitNum = hmmToMinutes(resolved.rule.value)
  }
  if (limitNum == null) return []

  const windowSpec = paramStr(resolved.params, 'window')
  if (!windowSpec) return []
  const windowMs = parseWindowToMs(windowSpec)
  if (!windowMs) return []

  const pickField = (d: ScheduleDuty): number => {
    if (field === 'block') return d.blockMinutes
    if (field === 'fdp') return d.fdpMinutes
    if (field === 'landings') return d.landings
    return d.dutyMinutes
  }

  const pool = [...ctx.existing.filter((d) => d.id !== ctx.candidate.id), ctx.candidate]
  const refMs = pool.reduce((m, d) => (d.endUtcMs > m ? d.endUtcMs : m), ctx.candidate.endUtcMs)
  const floorMs = refMs - windowMs
  let total = 0
  for (const d of pool) {
    // Rest blocks (annual leave, day off, rest period) never contribute
    // to cumulative duty / block / FDP / landings counters.
    if (d.kind === 'rest') continue
    if (d.endUtcMs <= floorMs || d.startUtcMs >= refMs) continue
    const overlap = Math.max(0, Math.min(d.endUtcMs, refMs) - Math.max(d.startUtcMs, floorMs))
    const span = Math.max(1, d.endUtcMs - d.startUtcMs)
    if (isCount) {
      // Landings: count fully when the duty ends inside the window.
      if (d.endUtcMs > floorMs && d.endUtcMs <= refMs) total += pickField(d)
    } else {
      total += pickField(d) * (overlap / span)
    }
  }
  const totalNum = Math.round(total)
  const status: CheckStatus = totalNum > limitNum ? 'violation' : totalNum > limitNum * 0.92 ? 'warning' : 'pass'

  const fieldLabel = field === 'block' ? 'Block' : field === 'fdp' ? 'FDP' : field === 'landings' ? 'Landings' : 'Duty'
  const actualStr = isCount ? String(totalNum) : fmtMinutes(totalNum)
  const limitStr = isCount ? String(limitNum) : fmtMinutes(limitNum)
  return [
    {
      label: `${fieldLabel} in ${windowSpec}`,
      actual: actualStr,
      limit: limitStr,
      actualNum: totalNum,
      limitNum,
      status,
      ruleCode: resolved.rule.code,
      legalReference: resolved.rule.legalReference,
      windowFromIso: new Date(floorMs).toISOString(),
      windowToIso: new Date(refMs).toISOString(),
      windowLabel: windowSpec,
      shortReason:
        status === 'pass'
          ? `${fieldLabel} ${actualStr} / ${limitStr}`
          : `${fieldLabel} ${actualStr} > ${limitStr} (${windowSpec})`,
    },
  ]
}

export function evaluateMinRestBetween(resolved: ResolvedRule, ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const requiredMin = hmmToMinutes(resolved.rule.value)
  if (requiredMin == null) return []
  const context = paramStr(resolved.params, 'context') ?? 'any'
  const mustMatchDuty = paramBool(resolved.params, 'mustMatchPrecedingDuty')

  // Rest blocks (annual leave, day off, rest period) are not duty
  // endpoints — they ARE rest. Walk past them to find the actual prior /
  // next duty. The candidate itself, when emitted from a rest activity,
  // wouldn't reach this evaluator (skipped below).
  const others = ctx.existing.filter((d) => d.id !== ctx.candidate.id && d.kind !== 'rest')
  const out: ScheduleLegalityCheck[] = []
  if (ctx.candidate.kind === 'rest') return out

  const adjacencies: Array<{ prev: ScheduleDuty; next: ScheduleDuty }> = []
  const prev = others.filter((d) => d.endUtcMs <= ctx.candidate.startUtcMs).sort((a, b) => b.endUtcMs - a.endUtcMs)[0]
  if (prev) adjacencies.push({ prev, next: ctx.candidate })
  const next = others
    .filter((d) => d.startUtcMs >= ctx.candidate.endUtcMs)
    .sort((a, b) => a.startUtcMs - b.startUtcMs)[0]
  if (next) adjacencies.push({ prev: ctx.candidate, next })

  const hb = ctx.homeBase.toUpperCase()

  for (const { prev: p, next: n } of adjacencies) {
    const prevArr = p.arrivalStation?.toUpperCase() ?? null
    const atHome = !prevArr || !hb || prevArr === hb
    if (context === 'home' && !atHome) continue
    if (context === 'away' && atHome) continue

    const gapMin = Math.max(0, Math.floor((n.startUtcMs - p.endUtcMs) / 60_000))
    const effectiveRequired = mustMatchDuty ? Math.max(requiredMin, p.dutyMinutes) : requiredMin

    const status: CheckStatus =
      gapMin < effectiveRequired ? 'violation' : gapMin < effectiveRequired + 30 ? 'warning' : 'pass'
    const locLabel =
      context === 'home'
        ? hb
          ? `home base ${hb}`
          : 'home base'
        : context === 'away'
          ? `away at ${prevArr} (home ${hb})`
          : 'pre-FDP'
    out.push({
      label: `Rest ${p.label} → ${n.label}`,
      actual: fmtMinutes(gapMin),
      limit: fmtMinutes(effectiveRequired),
      actualNum: gapMin,
      limitNum: effectiveRequired,
      status,
      ruleCode: resolved.rule.code,
      legalReference: resolved.rule.legalReference,
      shortReason:
        status === 'pass'
          ? `Rest ${p.label}→${n.label}: ${fmtMinutes(gapMin)} ≥ ${fmtMinutes(effectiveRequired)} (${locLabel})`
          : `${p.label}→${n.label} rest ${fmtMinutes(gapMin)} < ${fmtMinutes(effectiveRequired)} req (${locLabel})`,
    })
  }
  return out
}

export function evaluateMinRestAfterAugmented(resolved: ResolvedRule, ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const requiredMin = hmmToMinutes(resolved.rule.value)
  if (requiredMin == null) return []
  const others = ctx.existing.filter((d) => d.id !== ctx.candidate.id)
  const out: ScheduleLegalityCheck[] = []

  const buildCheck = (aug: ScheduleDuty, follower: ScheduleDuty): ScheduleLegalityCheck => {
    const gapMin = Math.max(0, Math.floor((follower.startUtcMs - aug.endUtcMs) / 60_000))
    const status: CheckStatus = gapMin < requiredMin ? 'violation' : gapMin < requiredMin + 60 ? 'warning' : 'pass'
    return {
      label: `Rest after augmented ${aug.label}`,
      actual: fmtMinutes(gapMin),
      limit: fmtMinutes(requiredMin),
      actualNum: gapMin,
      limitNum: requiredMin,
      status,
      ruleCode: resolved.rule.code,
      legalReference: resolved.rule.legalReference,
      shortReason:
        status === 'pass'
          ? `Rest ${fmtMinutes(gapMin)} ≥ ${fmtMinutes(requiredMin)} (aug)`
          : `Rest ${fmtMinutes(gapMin)} < ${fmtMinutes(requiredMin)} required after augmented ${aug.label}`,
    }
  }

  const augBefore = others
    .filter((d) => d.endUtcMs <= ctx.candidate.startUtcMs && d.isAugmented)
    .sort((a, b) => b.endUtcMs - a.endUtcMs)[0]
  if (augBefore) out.push(buildCheck(augBefore, ctx.candidate))

  if (ctx.candidate.isAugmented) {
    const follower = others
      .filter((d) => d.startUtcMs >= ctx.candidate.endUtcMs)
      .sort((a, b) => a.startUtcMs - b.startUtcMs)[0]
    if (follower) out.push(buildCheck(ctx.candidate, follower))
  }
  return out
}

export function evaluateMinRestInWindow(resolved: ResolvedRule, ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const restMin = hmmToMinutes(resolved.rule.value)
  if (restMin == null) return []
  const windowRuleCode = paramStr(resolved.params, 'windowRule')
  const defaultWin = paramStr(resolved.params, 'defaultWindow') ?? '168H'
  const windowRuleValue = windowRuleCode
    ? hmmToMinutes(ctx.ruleSet.rules.find((r: SerializedRule) => r.code === windowRuleCode)?.value ?? null)
    : null
  const windowMin = windowRuleValue ?? hmmToMinutes(defaultWin) ?? 168 * 60
  const windowMs = windowMin * 60_000

  // Only DUTY blocks (pairings + duty-flagged activities) form the
  // "merged" intervals whose gaps we measure. Rest blocks ARE rest and
  // contribute to the gap by their absence from this list.
  const pool = [...ctx.existing.filter((d) => d.id !== ctx.candidate.id), ctx.candidate]
    .filter((d) => d.kind !== 'rest')
    .sort((a, b) => a.startUtcMs - b.startUtcMs)
  if (pool.length === 0) return []

  // ── EVERY rolling window must satisfy the rule, not just the latest ──
  // The prior implementation anchored a single window at `max(endUtcMs)`
  // across the whole roster. For mid-period candidates with later
  // pairings already proposed, the relevant window slid past — the
  // validator returned 'pass' while a window ending IN THE CANDIDATE'S
  // STRETCH had max-gap < required rest. Anchor a window at every
  // duty's end (and the candidate's end). The minimum max-gap across
  // those anchors decides the verdict — that's the worst rolling
  // window in the candidate's neighbourhood, and the only one that
  // matters for legality.
  const anchorSet = new Set<number>()
  for (const d of pool) anchorSet.add(d.endUtcMs)
  // Add anchors slightly after each duty start as well — captures the
  // moment a long prior-rest block falls out of the rolling window.
  for (const d of pool) anchorSet.add(d.startUtcMs + 1)
  const anchors = [...anchorSet].sort((a, b) => a - b)

  let worstAnchorRefMs = ctx.candidate.endUtcMs
  let worstAnchorFloorMs = worstAnchorRefMs - windowMs
  let worstMaxGapMs = Number.POSITIVE_INFINITY

  for (const refMs of anchors) {
    const floorMs = refMs - windowMs
    const merged: Array<{ s: number; e: number }> = []
    for (const d of pool) {
      const s = Math.max(d.startUtcMs, floorMs)
      const e = Math.min(d.endUtcMs, refMs)
      if (e <= s) continue
      const last = merged[merged.length - 1]
      if (last && s <= last.e) last.e = Math.max(last.e, e)
      else merged.push({ s, e })
    }
    let maxGapMs = 0
    if (merged.length === 0) maxGapMs = windowMs
    else {
      maxGapMs = merged[0].s - floorMs
      for (let i = 1; i < merged.length; i += 1) maxGapMs = Math.max(maxGapMs, merged[i].s - merged[i - 1].e)
      maxGapMs = Math.max(maxGapMs, refMs - merged[merged.length - 1].e)
    }
    if (maxGapMs < worstMaxGapMs) {
      worstMaxGapMs = maxGapMs
      worstAnchorRefMs = refMs
      worstAnchorFloorMs = floorMs
    }
    // Early exit — once we know SOME window already violates, no point
    // scanning further. Validator caller only cares about pass/violation.
    if (worstMaxGapMs / 60_000 < restMin) break
  }

  const maxGapMin = Math.floor(worstMaxGapMs / 60_000)
  // Binary: gap ≥ required rest = legal. Below = violation. No warning
  // band — being 50 min above the minimum is not "close to illegal", it
  // is simply legal. Anything that flags here blocks + audit.
  const status: CheckStatus = maxGapMin < restMin ? 'violation' : 'pass'
  return [
    {
      label: `Weekly rest in ${Math.round(windowMin / 60)}h`,
      actual: fmtMinutes(maxGapMin),
      limit: fmtMinutes(restMin),
      actualNum: maxGapMin,
      limitNum: restMin,
      status,
      ruleCode: resolved.rule.code,
      legalReference: resolved.rule.legalReference,
      windowFromIso: new Date(worstAnchorFloorMs).toISOString(),
      windowToIso: new Date(worstAnchorRefMs).toISOString(),
      windowLabel: `${Math.round(windowMin / 60)}H`,
      shortReason:
        status === 'pass'
          ? `Weekly rest ${fmtMinutes(maxGapMin)} ≥ ${fmtMinutes(restMin)}`
          : `No ${fmtMinutes(restMin)} continuous rest in last ${Math.round(windowMin / 60)}h (max gap ${fmtMinutes(maxGapMin)})`,
    },
  ]
}

export function evaluatePerDutyLimit(resolved: ResolvedRule, ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const field = paramStr(resolved.params, 'field') ?? 'landings'
  const n = parseInt(resolved.rule.value, 10)
  if (!Number.isFinite(n) || n <= 0) return []
  let value: number
  let label: string
  if (field === 'landings') {
    value = ctx.candidate.landings
    label = 'Landings'
  } else if (field === 'fdp') {
    value = ctx.candidate.fdpMinutes
    label = 'FDP'
  } else if (field === 'block') {
    value = ctx.candidate.blockMinutes
    label = 'Block'
  } else if (field === 'duty') {
    value = ctx.candidate.dutyMinutes
    label = 'Duty'
  } else {
    return []
  }
  const isCount = field === 'landings'
  const status: CheckStatus = value > n ? 'violation' : value === n ? 'warning' : 'pass'
  const actualStr = isCount ? String(value) : fmtMinutes(value)
  const limitStr = isCount ? String(n) : fmtMinutes(n)
  return [
    {
      label: `${label} per duty`,
      actual: actualStr,
      limit: limitStr,
      actualNum: value,
      limitNum: n,
      status,
      ruleCode: resolved.rule.code,
      legalReference: resolved.rule.legalReference,
      shortReason:
        status === 'pass' ? `${label} ${actualStr} ≤ ${limitStr}` : `${label} ${actualStr} > ${limitStr} per duty`,
    },
  ]
}

export function evaluateConsecutiveCount(resolved: ResolvedRule, ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const limit = parseInt(resolved.rule.value, 10)
  if (!Number.isFinite(limit) || limit <= 0) return []
  // Consecutive-DUTY-day count — rest blocks (leave/off/rest period)
  // must NOT extend the streak.
  const pool = [...ctx.existing.filter((d) => d.id !== ctx.candidate.id), ctx.candidate].filter(
    (d) => d.kind !== 'rest',
  )
  const days = new Set<string>()
  for (const d of pool) {
    let t = d.startUtcMs
    while (t < d.endUtcMs) {
      days.add(new Date(t).toISOString().slice(0, 10))
      t += 86_400_000
    }
    days.add(new Date(d.endUtcMs - 1).toISOString().slice(0, 10))
  }
  const sorted = Array.from(days).sort()
  let maxStreak = 0
  let streak = 0
  let prevDay: number | null = null
  for (const iso of sorted) {
    const t = new Date(iso + 'T00:00:00Z').getTime()
    if (prevDay != null && t - prevDay === 86_400_000) streak += 1
    else streak = 1
    maxStreak = Math.max(maxStreak, streak)
    prevDay = t
  }
  const status: CheckStatus = maxStreak > limit ? 'violation' : maxStreak === limit ? 'warning' : 'pass'
  return [
    {
      label: resolved.rule.label,
      actual: String(maxStreak),
      limit: String(limit),
      actualNum: maxStreak,
      limitNum: limit,
      status,
      ruleCode: resolved.rule.code,
      legalReference: resolved.rule.legalReference,
      shortReason:
        status === 'pass'
          ? `${maxStreak} consecutive day${maxStreak === 1 ? '' : 's'} ≤ ${limit}`
          : `${maxStreak} consecutive days > ${limit}`,
    },
  ]
}

/** Base continuity — every duty must depart from where the crew was
 *  previously left (either the prior duty's arrival or the crew's home
 *  base if no prior duty). Flags the gap as a violation: duty started
 *  in X but crew was positioned at Y.
 *
 *  Universal sanity check; doesn't need a regulator rule to enable.
 *  Runs unconditionally via `runAllEvaluators`. */
export function evaluateBaseContinuity(ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  if (!ctx.candidate.departureStation) return []
  const depStation = ctx.candidate.departureStation.toUpperCase()
  const others = ctx.existing.filter((d) => d.id !== ctx.candidate.id)

  // Locate the immediate prior duty with a known arrivalStation.
  const prev = others
    .filter((d) => d.endUtcMs <= ctx.candidate.startUtcMs && d.arrivalStation)
    .sort((a, b) => b.endUtcMs - a.endUtcMs)[0]

  const expectedStation = prev?.arrivalStation?.toUpperCase() ?? ctx.homeBase.toUpperCase()
  if (!expectedStation) return []
  if (expectedStation === depStation) return []

  const date = new Date(ctx.candidate.startUtcMs).toISOString().slice(0, 10)
  const context = prev ? `Crew ended ${prev.label} at ${expectedStation}` : `Crew member is at ${expectedStation}`
  return [
    {
      label: `Base mismatch ${ctx.candidate.label}`,
      actual: depStation,
      limit: expectedStation,
      actualNum: 0,
      limitNum: 0,
      status: 'violation',
      ruleCode: 'CONTINUITY_BASE_MATCH',
      legalReference: 'Roster continuity',
      shortReason: `Base Mismatch. Duty starts in ${depStation}. ${context} on ${date}.`,
    },
  ]
}

export function evaluateCommanderDiscretionCap(resolved: ResolvedRule, ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const limit = parseInt(resolved.rule.value, 10)
  if (!Number.isFinite(limit) || limit <= 0) return []
  const windowSpec = paramStr(resolved.params, 'window')
  if (!windowSpec) return []
  const windowMs = parseWindowToMs(windowSpec)
  if (!windowMs) return []

  const pool = [...ctx.existing.filter((d) => d.id !== ctx.candidate.id), ctx.candidate]
  const refMs = pool.reduce((m, d) => (d.endUtcMs > m ? d.endUtcMs : m), ctx.candidate.endUtcMs)
  const floorMs = refMs - windowMs

  let count = 0
  for (const d of pool) {
    if (!d.commanderDiscretion) continue
    if (d.endUtcMs <= floorMs || d.startUtcMs >= refMs) continue
    count += 1
  }
  const status: CheckStatus = count > limit ? 'violation' : count === limit ? 'warning' : 'pass'
  return [
    {
      label: `Commander discretion in ${windowSpec}`,
      actual: String(count),
      limit: String(limit),
      actualNum: count,
      limitNum: limit,
      status,
      ruleCode: resolved.rule.code,
      legalReference: resolved.rule.legalReference,
      windowFromIso: new Date(floorMs).toISOString(),
      windowToIso: new Date(refMs).toISOString(),
      windowLabel: windowSpec,
      shortReason:
        status === 'pass'
          ? `${count} / ${limit} uses in ${windowSpec}`
          : `${count} > ${limit} commander-discretion uses in ${windowSpec}`,
    },
  ]
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export function runAllEvaluators(ctx: EvaluatorContext): ScheduleLegalityCheck[] {
  const out: ScheduleLegalityCheck[] = []
  // Universal sanity checks — not driven by a DB rule row. Must run for
  // every operator regardless of framework.
  out.push(...evaluateBaseContinuity(ctx))

  // Kind-aware skip predicates — short-circuit evaluators that are
  // structurally guaranteed to pass for the given candidate kind. Speeds
  // up SBY/OFF candidate validation in auto-roster (called per-candidate
  // in tight loops) without weakening any safety check. ONLY skip when
  // the evaluator can't possibly fire for this candidate type — never
  // skip rules that might hold the regulator-required guard.
  const cand = ctx.candidate
  const candIsRest = cand.kind === 'rest'
  const candCountsDuty = cand.dutyMinutes > 0
  const candCountsBlock = cand.blockMinutes > 0
  const candCountsFdp = cand.fdpMinutes > 0
  const candHasLandings = cand.landings > 0
  const candCommanderDiscretion = cand.commanderDiscretion === true

  for (const rule of ctx.ruleSet.rules) {
    const resolved = resolveRule(rule)
    if (!resolved) continue
    switch (resolved.type) {
      case 'rolling_cumulative':
        out.push(...evaluateRollingCumulative(resolved, ctx))
        break
      case 'min_rest_between_events':
        out.push(...evaluateMinRestBetween(resolved, ctx))
        break
      case 'min_rest_after_augmented':
        // Only fires when the augmented duty is ADJACENT to the candidate
        // and rest before candidate is short. Rest candidates aren't duty
        // endpoints — augmented-rest rule semantically can't apply.
        if (candIsRest) break
        out.push(...evaluateMinRestAfterAugmented(resolved, ctx))
        break
      case 'min_rest_in_window':
        out.push(...evaluateMinRestInWindow(resolved, ctx))
        break
      case 'per_duty_limit':
        // Per-duty caps (FDP duration, max landings per FDP) measure the
        // candidate's OWN duty values. Rest candidates contribute 0 to
        // every measured field; rule cannot fire.
        if (candIsRest) break
        if (!candCountsDuty && !candCountsBlock && !candCountsFdp && !candHasLandings) break
        out.push(...evaluatePerDutyLimit(resolved, ctx))
        break
      case 'consecutive_count':
        out.push(...evaluateConsecutiveCount(resolved, ctx))
        break
      case 'commander_discretion_cap':
        // Only triggers when the candidate (or an existing duty) carries
        // the commander-discretion flag. Auto-placed SBY/OFF never carry
        // the flag; rule cannot fire on the candidate side.
        if (!candCommanderDiscretion) break
        out.push(...evaluateCommanderDiscretionCap(resolved, ctx))
        break
      case 'custom':
        break
    }
  }

  // Dedupe location-aware rest: if MIN_REST_HOME_BASE or MIN_REST_AWAY
  // fired on an adjacency, suppress any generic MIN_REST_PRE_FDP result
  // for the same pair.
  const seenAdjacency = new Set<string>()
  const filtered: ScheduleLegalityCheck[] = []
  for (const c of out) {
    if (c.ruleCode === 'MIN_REST_HOME_BASE' || c.ruleCode === 'MIN_REST_AWAY') {
      seenAdjacency.add(`rest|${c.label}`)
    }
  }
  for (const c of out) {
    if (c.ruleCode === 'MIN_REST_PRE_FDP' && seenAdjacency.has(`rest|${c.label}`)) continue
    filtered.push(c)
  }
  return filtered
}
