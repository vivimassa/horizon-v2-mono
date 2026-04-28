import { CrewMember } from '../../models/CrewMember.js'
import { CrewAssignment } from '../../models/CrewAssignment.js'
import { CrewActivity } from '../../models/CrewActivity.js'
import { Pairing } from '../../models/Pairing.js'
import { ActivityCode } from '../../models/ActivityCode.js'
import { CrewRollingSnapshot } from '../../models/CrewRollingSnapshot.js'

/**
 * Task #1 — Daily Crew Activity Log.
 *
 * For each (crewId, snapshotIso) target, computes:
 *   bhMin28d / bhMin90d / bhMin365d   — block-time per leg, attributed to the
 *                                       leg's STD-UTC calendar day, summed over
 *                                       the rolling window ending at snapshotIso.
 *   dutyMin28d / 90d / 365d           — assignment duration overlapped per day,
 *                                       plus duty-flagged activities (training,
 *                                       sim, ground duty).
 *   landings/sectors{28d,90d,365d}    — non-deadhead leg count.
 *   bhMonthMin / bhYtdMin             — calendar slices for YTD fairness.
 *
 * Output: upsert one CrewRollingSnapshot per (crewId, snapshotIso). Idempotent
 * — manual reruns of a given date overwrite cleanly.
 *
 * Consumed by auto-roster pre-filter to enforce CAAV §15.037 rolling caps
 * (100h/28D, 300h/90D, 1000h/12M).
 */

const DAY_MS = 86_400_000
/** Activity-code flags that contribute to duty time but NOT block time. */
const DUTY_ACTIVITY_FLAGS = new Set(['TRAIN', 'SIM', 'TRAINING', 'GROUND_DUTY', 'CHECK', 'POSITIONING'])

export interface RunLog {
  (level: 'info' | 'warn' | 'error', message: string, pct?: number): void | Promise<void>
}

export interface DailyCrewActivityLogParams {
  /** YYYY-MM-DD target dates. If empty, defaults to yesterday (UTC). */
  snapshotDates?: string[]
  /** Optional crew filter — when omitted, all active crew are processed. */
  crewIds?: string[]
  /** Convenience for date ranges. Inclusive both ends. Expanded to snapshotDates. */
  fromIso?: string
  toIso?: string
  /**
   * Force the slow 365d full-recompute path even when the incremental path
   * would normally apply. Set on the periodic safety-net run (weekly) so any
   * drift caused by edits to historic flight data is corrected. Manual UI
   * reruns can also set this when the user wants a guaranteed-fresh result.
   */
  fullRecompute?: boolean
}

export interface DailyCrewActivityLogStats {
  crewProcessed: number
  snapshotsWritten: number
  daysCovered: number
  durationMs: number
}

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftIso(iso: string, deltaDays: number): string {
  const t = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  return new Date(t + deltaDays * DAY_MS).toISOString().slice(0, 10)
}

function dayIndexUtc(ms: number): number {
  return Math.floor(ms / DAY_MS)
}

function isoToDayIndex(iso: string): number {
  return dayIndexUtc(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))))
}

function endOfIsoMs(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + 1) - 1
}

function expandDateRange(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  let cur = fromIso
  let guard = 0
  while (cur <= toIso && guard++ < 4000) {
    out.push(cur)
    cur = shiftIso(cur, 1)
  }
  return out
}

function resolveSnapshotDates(params: DailyCrewActivityLogParams): string[] {
  if (params.snapshotDates && params.snapshotDates.length) {
    return [...params.snapshotDates].sort()
  }
  if (params.fromIso && params.toIso) {
    return expandDateRange(params.fromIso, params.toIso)
  }
  // Default: yesterday (so the early-morning cron always has a complete day to compute).
  return [shiftIso(todayIsoUtc(), -1)]
}

/**
 * Public entry. Routes between the cheap incremental path (single date,
 * prior snapshot exists) and the slow but exhaustive full-recompute path.
 */
export async function runDailyCrewActivityLog(
  operatorId: string,
  params: DailyCrewActivityLogParams,
  log: RunLog,
  cancelled: () => boolean = () => false,
): Promise<DailyCrewActivityLogStats> {
  const t0 = Date.now()
  const snapshotDates = resolveSnapshotDates(params)
  if (snapshotDates.length === 0) {
    await log('warn', 'No snapshot dates resolved — nothing to do')
    return { crewProcessed: 0, snapshotsWritten: 0, daysCovered: 0, durationMs: Date.now() - t0 }
  }

  // ── Fast path: single date, no fullRecompute flag ─────────────────────
  // For the nightly cron this loads only 4 day-windows of source data per
  // crew (Y, Y-28, Y-90, Y-365) and combines with the prior day's snapshot.
  // Drops the cost from O(365 * crew) to O(4 * crew). Drift caused by edits
  // to historic flights is corrected by the periodic full-recompute run
  // (params.fullRecompute=true on a weekly schedule).
  if (snapshotDates.length === 1 && !params.fullRecompute) {
    const inc = await tryIncrementalDaily(operatorId, snapshotDates[0], params.crewIds, log, cancelled)
    if (inc) {
      if (inc.fallbackCrewIds.length === 0) return inc.stats
      await log(
        'info',
        `Falling back to full recompute for ${inc.fallbackCrewIds.length} crew without prior snapshot`,
        70,
      )
      const fullStats = await runFullCompute(operatorId, { ...params, crewIds: inc.fallbackCrewIds }, log, cancelled)
      return {
        crewProcessed: inc.stats.crewProcessed + fullStats.crewProcessed,
        snapshotsWritten: inc.stats.snapshotsWritten + fullStats.snapshotsWritten,
        daysCovered: 1,
        durationMs: Date.now() - t0,
      }
    }
    await log('info', 'Incremental path unavailable — falling back to full recompute', 5)
  }

  return runFullCompute(operatorId, params, log, cancelled)
}

async function runFullCompute(
  operatorId: string,
  params: DailyCrewActivityLogParams,
  log: RunLog,
  cancelled: () => boolean = () => false,
): Promise<DailyCrewActivityLogStats> {
  const t0 = Date.now()
  const snapshotDates = resolveSnapshotDates(params)
  if (snapshotDates.length === 0) {
    await log('warn', 'No snapshot dates resolved — nothing to do')
    return { crewProcessed: 0, snapshotsWritten: 0, daysCovered: 0, durationMs: Date.now() - t0 }
  }

  const earliestSnapshot = snapshotDates[0]
  const latestSnapshot = snapshotDates[snapshotDates.length - 1]
  // Pull a 365d look-back from the earliest snapshot date so 365D rolling
  // sums for the earliest date have full coverage.
  const windowFromIso = shiftIso(earliestSnapshot, -365)
  const windowFromMs = Date.UTC(
    Number(windowFromIso.slice(0, 4)),
    Number(windowFromIso.slice(5, 7)) - 1,
    Number(windowFromIso.slice(8, 10)),
  )
  const windowToMs = endOfIsoMs(latestSnapshot)
  const windowToIso = latestSnapshot
  // Full-day-bucket arrays span [earliest-365 .. latest], inclusive both.
  const dayIndexBase = dayIndexUtc(windowFromMs)
  const totalDays = isoToDayIndex(latestSnapshot) - dayIndexBase + 1

  await log(
    'info',
    `Window ${windowFromIso} → ${windowToIso} (${totalDays} days) — ${snapshotDates.length} snapshot date(s)`,
    1,
  )

  // ── Crew scope ─────────────────────────────────────────────────────────
  const crewQuery: Record<string, unknown> = { operatorId, status: 'active' }
  if (params.crewIds && params.crewIds.length) crewQuery._id = { $in: params.crewIds }
  const crew = await CrewMember.find(crewQuery, { _id: 1 }).lean()
  const crewIds = crew.map((c) => c._id as string)
  if (crewIds.length === 0) {
    await log('warn', 'No active crew matched filter — nothing to do')
    return { crewProcessed: 0, snapshotsWritten: 0, daysCovered: snapshotDates.length, durationMs: Date.now() - t0 }
  }
  await log('info', `Resolved ${crewIds.length} active crew`, 3)
  if (cancelled()) {
    await log('warn', 'Cancelled by user before data load')
    return { crewProcessed: 0, snapshotsWritten: 0, daysCovered: snapshotDates.length, durationMs: Date.now() - t0 }
  }

  // ── Pull source data once ──────────────────────────────────────────────
  // Assignments overlapping the window. Filtered by crewIds even when the run
  // is operator-wide so MongoDB can hit the (operatorId, crewId, startUtcIso)
  // index for large cabin operators.
  const windowFromUtcIso = new Date(windowFromMs).toISOString()
  const windowToUtcIso = new Date(windowToMs + 1).toISOString()
  const assignments = await CrewAssignment.find(
    {
      operatorId,
      crewId: { $in: crewIds },
      scenarioId: null,
      status: { $ne: 'cancelled' },
      startUtcIso: { $lt: windowToUtcIso },
      endUtcIso: { $gt: windowFromUtcIso },
    },
    { crewId: 1, pairingId: 1, startUtcIso: 1, endUtcIso: 1 },
  ).lean()

  const pairingIds = Array.from(new Set(assignments.map((a) => a.pairingId)))
  const pairings = pairingIds.length
    ? await Pairing.find({ operatorId, _id: { $in: pairingIds } }, { legs: 1 }).lean()
    : []
  const pairingById = new Map<
    string,
    { legs: Array<{ stdUtcIso?: string; blockMinutes?: number; isDeadhead?: boolean }> }
  >()
  for (const p of pairings) {
    pairingById.set(
      p._id as string,
      p as unknown as { legs: Array<{ stdUtcIso?: string; blockMinutes?: number; isDeadhead?: boolean }> },
    )
  }

  const activities = await CrewActivity.find(
    {
      operatorId,
      crewId: { $in: crewIds },
      scenarioId: null,
      startUtcIso: { $lt: windowToUtcIso },
      endUtcIso: { $gt: windowFromUtcIso },
    },
    { crewId: 1, activityCodeId: 1, startUtcIso: 1, endUtcIso: 1 },
  ).lean()

  // Activity-code flag map — decides which activity types contribute to duty.
  const activityCodes = await ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean()
  const dutyContributingCodes = new Set<string>()
  for (const c of activityCodes) {
    const flags = (c.flags ?? []) as string[]
    if (flags.some((f) => DUTY_ACTIVITY_FLAGS.has(f.toUpperCase()))) {
      dutyContributingCodes.add(c._id as string)
    }
  }

  await log(
    'info',
    `Loaded ${assignments.length.toLocaleString()} assignments, ${pairings.length.toLocaleString()} pairings, ${activities.length.toLocaleString()} activities`,
    8,
  )
  if (cancelled()) {
    await log('warn', 'Cancelled by user after data load')
    return { crewProcessed: 0, snapshotsWritten: 0, daysCovered: snapshotDates.length, durationMs: Date.now() - t0 }
  }

  // ── Per-crew daily buckets ─────────────────────────────────────────────
  type DailyBuckets = {
    bh: Float64Array
    duty: Float64Array
    sectors: Int32Array
  }
  const buckets = new Map<string, DailyBuckets>()
  const bucketsFor = (crewId: string): DailyBuckets => {
    let b = buckets.get(crewId)
    if (!b) {
      b = {
        bh: new Float64Array(totalDays),
        duty: new Float64Array(totalDays),
        sectors: new Int32Array(totalDays),
      }
      buckets.set(crewId, b)
    }
    return b
  }

  // Block + sectors from pairing legs (attributed to leg STD-UTC day).
  for (const a of assignments) {
    const p = pairingById.get(a.pairingId)
    if (!p) continue
    const b = bucketsFor(a.crewId)
    for (const leg of p.legs ?? []) {
      if (leg.isDeadhead) continue
      const stdMs = leg.stdUtcIso ? Date.parse(leg.stdUtcIso) : NaN
      if (!Number.isFinite(stdMs) || stdMs < windowFromMs || stdMs > windowToMs) continue
      const dayIdx = dayIndexUtc(stdMs) - dayIndexBase
      if (dayIdx < 0 || dayIdx >= totalDays) continue
      b.bh[dayIdx] += leg.blockMinutes ?? 0
      b.sectors[dayIdx] += 1
    }
  }

  // Duty from assignment windows — overlap minutes per calendar day.
  const addOverlapDuty = (b: DailyBuckets, startMs: number, endMs: number): void => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return
    const lo = Math.max(startMs, windowFromMs)
    const hi = Math.min(endMs, windowToMs + 1)
    if (hi <= lo) return
    let cursor = lo
    while (cursor < hi) {
      const dayIdxAbs = dayIndexUtc(cursor)
      const dayEnd = (dayIdxAbs + 1) * DAY_MS
      const sliceEnd = Math.min(hi, dayEnd)
      const dayIdx = dayIdxAbs - dayIndexBase
      if (dayIdx >= 0 && dayIdx < totalDays) {
        b.duty[dayIdx] += (sliceEnd - cursor) / 60_000
      }
      cursor = sliceEnd
    }
  }

  for (const a of assignments) {
    const startMs = Date.parse(a.startUtcIso ?? '')
    const endMs = Date.parse(a.endUtcIso ?? '')
    addOverlapDuty(bucketsFor(a.crewId), startMs, endMs)
  }

  // Duty from training/sim/ground-duty activities (block stays 0).
  for (const act of activities) {
    if (!dutyContributingCodes.has(act.activityCodeId)) continue
    const startMs = Date.parse(act.startUtcIso ?? '')
    const endMs = Date.parse(act.endUtcIso ?? '')
    addOverlapDuty(bucketsFor(act.crewId), startMs, endMs)
  }

  await log('info', `Built per-day buckets for ${buckets.size.toLocaleString()} crew with activity`, 12)

  // ── Compute snapshots ──────────────────────────────────────────────────
  const sumWindow = (arr: Float64Array | Int32Array, snapDayIdx: number, windowDays: number): number => {
    const startIdx = Math.max(0, snapDayIdx - windowDays + 1)
    let sum = 0
    for (let i = startIdx; i <= snapDayIdx; i++) sum += arr[i] as number
    return sum
  }
  const sumRange = (arr: Float64Array | Int32Array, startIdx: number, endIdx: number): number => {
    let sum = 0
    const lo = Math.max(0, startIdx)
    const hi = Math.min(arr.length - 1, endIdx)
    for (let i = lo; i <= hi; i++) sum += arr[i] as number
    return sum
  }

  let snapshotsWritten = 0
  const totalUnits = crewIds.length * snapshotDates.length
  let unitsDone = 0
  const progressEvery = Math.max(1, Math.floor(totalUnits / 20))

  const empty: DailyBuckets = {
    bh: new Float64Array(totalDays),
    duty: new Float64Array(totalDays),
    sectors: new Int32Array(totalDays),
  }

  for (const crewId of crewIds) {
    if (cancelled()) {
      await log(
        'warn',
        `Cancelled by user — wrote ${snapshotsWritten.toLocaleString()} of ${totalUnits.toLocaleString()} snapshots`,
      )
      return {
        crewProcessed: crewIds.length,
        snapshotsWritten,
        daysCovered: snapshotDates.length,
        durationMs: Date.now() - t0,
      }
    }
    const b = buckets.get(crewId) ?? empty
    for (const snapshotIso of snapshotDates) {
      const snapDayIdx = isoToDayIndex(snapshotIso) - dayIndexBase
      if (snapDayIdx < 0 || snapDayIdx >= totalDays) continue

      const bhMin28d = Math.round(sumWindow(b.bh, snapDayIdx, 28))
      const bhMin90d = Math.round(sumWindow(b.bh, snapDayIdx, 90))
      const bhMin365d = Math.round(sumWindow(b.bh, snapDayIdx, 365))
      const dutyMin28d = Math.round(sumWindow(b.duty, snapDayIdx, 28))
      const dutyMin90d = Math.round(sumWindow(b.duty, snapDayIdx, 90))
      const dutyMin365d = Math.round(sumWindow(b.duty, snapDayIdx, 365))
      const sectors28d = sumWindow(b.sectors, snapDayIdx, 28)
      const sectors90d = sumWindow(b.sectors, snapDayIdx, 90)
      const sectors365d = sumWindow(b.sectors, snapDayIdx, 365)

      // Calendar buckets — month-to-date and year-to-date through snapshotIso.
      const year = Number(snapshotIso.slice(0, 4))
      const month = Number(snapshotIso.slice(5, 7))
      const monthStartDayIdx = dayIndexUtc(Date.UTC(year, month - 1, 1)) - dayIndexBase
      const yearStartDayIdx = dayIndexUtc(Date.UTC(year, 0, 1)) - dayIndexBase
      const bhMonthMin = Math.round(sumRange(b.bh, monthStartDayIdx, snapDayIdx))
      const bhYtdMin = Math.round(sumRange(b.bh, yearStartDayIdx, snapDayIdx))
      const dutyMonthMin = Math.round(sumRange(b.duty, monthStartDayIdx, snapDayIdx))
      const dutyYtdMin = Math.round(sumRange(b.duty, yearStartDayIdx, snapDayIdx))

      const _id = `${operatorId}__${crewId}__${snapshotIso}`
      await CrewRollingSnapshot.updateOne(
        { _id },
        {
          $set: {
            operatorId,
            crewId,
            snapshotIso,
            snapshotMs: endOfIsoMs(snapshotIso),
            bhMin28d,
            bhMin90d,
            bhMin365d,
            dutyMin28d,
            dutyMin90d,
            dutyMin365d,
            landings28d: sectors28d,
            landings90d: sectors90d,
            landings365d: sectors365d,
            sectors28d,
            sectors90d,
            sectors365d,
            bhMonthMin,
            bhYtdMin,
            dutyMonthMin,
            dutyYtdMin,
            sourceVersion: 1,
            computedAtUtc: new Date().toISOString(),
          },
        },
        { upsert: true },
      )
      snapshotsWritten++
      unitsDone++
      if (unitsDone % progressEvery === 0) {
        const pct = 12 + Math.round((unitsDone / totalUnits) * 86)
        await log('info', `Snapshots ${unitsDone.toLocaleString()}/${totalUnits.toLocaleString()}`, pct)
      }
    }
  }

  const durationMs = Date.now() - t0
  await log(
    'info',
    `Done — ${snapshotsWritten.toLocaleString()} snapshots written across ${crewIds.length.toLocaleString()} crew × ${snapshotDates.length} day(s) in ${durationMs}ms`,
    99,
  )

  return {
    crewProcessed: crewIds.length,
    snapshotsWritten,
    daysCovered: snapshotDates.length,
    durationMs,
  }
}

/* ── Incremental daily path ───────────────────────────────────────────────
 *
 * Given today's snapshotIso=Y and yesterday's snapshot at Y-1, today's
 * rolling sums are:
 *
 *   bhMin28d(Y)  = bhMin28d(Y-1)  + block_on(Y) - block_on(Y-28)
 *   bhMin90d(Y)  = bhMin90d(Y-1)  + block_on(Y) - block_on(Y-90)
 *   bhMin365d(Y) = bhMin365d(Y-1) + block_on(Y) - block_on(Y-365)
 *
 * So we only need to know totals on 4 specific days: Y, Y-28, Y-90, Y-365.
 * That's a 91× cost reduction vs a full 365d load on a 7000-crew operator.
 *
 * Calendar buckets fold the previous snapshot's value if same period:
 *   bhMonthMin(Y) = (sameMonth ? prior.bhMonthMin : 0) + block_on(Y)
 *   bhYtdMin(Y)  = (sameYear  ? prior.bhYtdMin   : 0) + block_on(Y)
 *
 * Drift: if a flight from 200 days ago is edited, today's incremental run
 * doesn't see it. The periodic full-recompute task (params.fullRecompute=
 * true on a weekly schedule) corrects any such drift.
 */

interface DayTotals {
  bh: number
  duty: number
  sectors: number
}

/** Compute per-(crewId, day) totals for a single calendar day. */
async function computeDayTotalsForCrew(
  operatorId: string,
  crewIds: string[],
  dateIso: string,
  dutyContributingCodes: Set<string>,
): Promise<Map<string, DayTotals>> {
  const dayStartMs = Date.UTC(
    Number(dateIso.slice(0, 4)),
    Number(dateIso.slice(5, 7)) - 1,
    Number(dateIso.slice(8, 10)),
  )
  const dayEndMs = endOfIsoMs(dateIso)
  const dayStartIso = new Date(dayStartMs).toISOString()
  const dayEndIso = new Date(dayEndMs + 1).toISOString()

  const assignments = await CrewAssignment.find(
    {
      operatorId,
      crewId: { $in: crewIds },
      scenarioId: null,
      status: { $ne: 'cancelled' },
      startUtcIso: { $lt: dayEndIso },
      endUtcIso: { $gt: dayStartIso },
    },
    { crewId: 1, pairingId: 1, startUtcIso: 1, endUtcIso: 1 },
  ).lean()

  const pairingIds = Array.from(new Set(assignments.map((a) => a.pairingId)))
  const pairings = pairingIds.length
    ? await Pairing.find({ operatorId, _id: { $in: pairingIds } }, { legs: 1 }).lean()
    : []
  const pairingById = new Map<
    string,
    { legs: Array<{ stdUtcIso?: string; blockMinutes?: number; isDeadhead?: boolean }> }
  >()
  for (const p of pairings) {
    pairingById.set(
      p._id as string,
      p as unknown as { legs: Array<{ stdUtcIso?: string; blockMinutes?: number; isDeadhead?: boolean }> },
    )
  }

  const activities = await CrewActivity.find(
    {
      operatorId,
      crewId: { $in: crewIds },
      scenarioId: null,
      startUtcIso: { $lt: dayEndIso },
      endUtcIso: { $gt: dayStartIso },
    },
    { crewId: 1, activityCodeId: 1, startUtcIso: 1, endUtcIso: 1 },
  ).lean()

  const out = new Map<string, DayTotals>()
  const ensure = (id: string): DayTotals => {
    let v = out.get(id)
    if (!v) {
      v = { bh: 0, duty: 0, sectors: 0 }
      out.set(id, v)
    }
    return v
  }

  // Block + sectors from non-deadhead legs whose STD-UTC falls on this day.
  for (const a of assignments) {
    const p = pairingById.get(a.pairingId)
    if (!p) continue
    const totals = ensure(a.crewId)
    for (const leg of p.legs ?? []) {
      if (leg.isDeadhead) continue
      const stdMs = leg.stdUtcIso ? Date.parse(leg.stdUtcIso) : NaN
      if (!Number.isFinite(stdMs)) continue
      if (stdMs < dayStartMs || stdMs > dayEndMs) continue
      totals.bh += leg.blockMinutes ?? 0
      totals.sectors += 1
    }
  }

  // Duty from assignment overlap with this day.
  for (const a of assignments) {
    const startMs = Date.parse(a.startUtcIso ?? '')
    const endMs = Date.parse(a.endUtcIso ?? '')
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    const lo = Math.max(startMs, dayStartMs)
    const hi = Math.min(endMs, dayEndMs + 1)
    if (hi > lo) ensure(a.crewId).duty += (hi - lo) / 60_000
  }

  // Duty from training/sim/ground-duty activities overlap with this day.
  for (const act of activities) {
    if (!dutyContributingCodes.has(act.activityCodeId)) continue
    const startMs = Date.parse(act.startUtcIso ?? '')
    const endMs = Date.parse(act.endUtcIso ?? '')
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    const lo = Math.max(startMs, dayStartMs)
    const hi = Math.min(endMs, dayEndMs + 1)
    if (hi > lo) ensure(act.crewId).duty += (hi - lo) / 60_000
  }

  return out
}

interface IncrementalResult {
  stats: DailyCrewActivityLogStats
  /** Crew lacking a prior snapshot — caller must run full path for these. */
  fallbackCrewIds: string[]
}

/**
 * Cheap path. Returns null when incremental cannot help (no prior snapshots
 * at all). Returns IncrementalResult including the list of crew that still
 * need full recompute (no prior snapshot of their own).
 */
async function tryIncrementalDaily(
  operatorId: string,
  snapshotIso: string,
  crewFilter: string[] | undefined,
  log: RunLog,
  cancelled: () => boolean,
): Promise<IncrementalResult | null> {
  const t0 = Date.now()
  const Y_1 = shiftIso(snapshotIso, -1)
  const Y_28 = shiftIso(snapshotIso, -28)
  const Y_90 = shiftIso(snapshotIso, -90)
  const Y_365 = shiftIso(snapshotIso, -365)

  // 1. Active crew scope
  const crewQuery: Record<string, unknown> = { operatorId, status: 'active' }
  if (crewFilter && crewFilter.length) crewQuery._id = { $in: crewFilter }
  const crew = await CrewMember.find(crewQuery, { _id: 1 }).lean()
  const crewIds = crew.map((c) => c._id as string)
  if (crewIds.length === 0) {
    await log('warn', 'No active crew matched filter — nothing to do')
    return {
      stats: { crewProcessed: 0, snapshotsWritten: 0, daysCovered: 1, durationMs: Date.now() - t0 },
      fallbackCrewIds: [],
    }
  }

  // 2. Prior snapshots — keyed by Y-1
  const priorDocs = await CrewRollingSnapshot.find(
    { operatorId, crewId: { $in: crewIds }, snapshotIso: Y_1 },
    {
      crewId: 1,
      bhMin28d: 1,
      bhMin90d: 1,
      bhMin365d: 1,
      dutyMin28d: 1,
      dutyMin90d: 1,
      dutyMin365d: 1,
      sectors28d: 1,
      sectors90d: 1,
      sectors365d: 1,
      bhMonthMin: 1,
      bhYtdMin: 1,
      dutyMonthMin: 1,
      dutyYtdMin: 1,
    },
  ).lean()

  if (priorDocs.length === 0) {
    await log('info', `No prior snapshots at ${Y_1} — incremental path unavailable`)
    return null
  }

  const priorByCrew = new Map(priorDocs.map((p) => [p.crewId, p]))
  const incrementalCrew = crewIds.filter((id) => priorByCrew.has(id))
  const fallbackCrewIds = crewIds.filter((id) => !priorByCrew.has(id))

  await log(
    'info',
    `Incremental path — ${incrementalCrew.length} crew with prior snapshot at ${Y_1}, ${fallbackCrewIds.length} need full recompute`,
    8,
  )

  if (cancelled()) {
    await log('warn', 'Cancelled before incremental day-totals load')
    return {
      stats: { crewProcessed: 0, snapshotsWritten: 0, daysCovered: 1, durationMs: Date.now() - t0 },
      fallbackCrewIds: [],
    }
  }

  // 3. Activity-code duty-flag map
  const activityCodes = await ActivityCode.find({ operatorId }, { _id: 1, flags: 1 }).lean()
  const dutyContributingCodes = new Set<string>()
  for (const c of activityCodes) {
    const flags = (c.flags ?? []) as string[]
    if (flags.some((f) => DUTY_ACTIVITY_FLAGS.has(f.toUpperCase()))) {
      dutyContributingCodes.add(c._id as string)
    }
  }

  // 4. Load day-totals for the 4 reference dates (Y, Y-28, Y-90, Y-365).
  // Dates may collide (e.g. Y-28 == Y-90 never; but cache anyway for safety).
  const refDates = [snapshotIso, Y_28, Y_90, Y_365]
  const totalsByDate = new Map<string, Map<string, DayTotals>>()
  for (const date of refDates) {
    if (cancelled()) {
      await log('warn', 'Cancelled mid day-totals load')
      return {
        stats: { crewProcessed: 0, snapshotsWritten: 0, daysCovered: 1, durationMs: Date.now() - t0 },
        fallbackCrewIds: [],
      }
    }
    if (totalsByDate.has(date)) continue
    const map = await computeDayTotalsForCrew(operatorId, incrementalCrew, date, dutyContributingCodes)
    totalsByDate.set(date, map)
  }
  await log('info', `Loaded day totals for ${totalsByDate.size} reference dates`, 30)

  // 5. Apply formulas, upsert
  const sameMonth = snapshotIso.slice(0, 7) === Y_1.slice(0, 7)
  const sameYear = snapshotIso.slice(0, 4) === Y_1.slice(0, 4)
  const empty: DayTotals = { bh: 0, duty: 0, sectors: 0 }
  const get = (date: string, crewId: string): DayTotals => totalsByDate.get(date)?.get(crewId) ?? empty

  let snapshotsWritten = 0
  const total = incrementalCrew.length
  const progressEvery = Math.max(1, Math.floor(total / 20))
  for (let i = 0; i < incrementalCrew.length; i++) {
    if (cancelled()) {
      await log(
        'warn',
        `Cancelled — wrote ${snapshotsWritten.toLocaleString()} of ${total.toLocaleString()} incremental snapshots`,
      )
      return {
        stats: {
          crewProcessed: total,
          snapshotsWritten,
          daysCovered: 1,
          durationMs: Date.now() - t0,
        },
        fallbackCrewIds: [],
      }
    }
    const crewId = incrementalCrew[i]
    const prior = priorByCrew.get(crewId) as {
      bhMin28d?: number
      bhMin90d?: number
      bhMin365d?: number
      dutyMin28d?: number
      dutyMin90d?: number
      dutyMin365d?: number
      sectors28d?: number
      sectors90d?: number
      sectors365d?: number
      bhMonthMin?: number
      bhYtdMin?: number
      dutyMonthMin?: number
      dutyYtdMin?: number
    }

    const Y = get(snapshotIso, crewId)
    const T28 = get(Y_28, crewId)
    const T90 = get(Y_90, crewId)
    const T365 = get(Y_365, crewId)

    const bhMin28d = Math.max(0, Math.round((prior.bhMin28d ?? 0) + Y.bh - T28.bh))
    const bhMin90d = Math.max(0, Math.round((prior.bhMin90d ?? 0) + Y.bh - T90.bh))
    const bhMin365d = Math.max(0, Math.round((prior.bhMin365d ?? 0) + Y.bh - T365.bh))
    const dutyMin28d = Math.max(0, Math.round((prior.dutyMin28d ?? 0) + Y.duty - T28.duty))
    const dutyMin90d = Math.max(0, Math.round((prior.dutyMin90d ?? 0) + Y.duty - T90.duty))
    const dutyMin365d = Math.max(0, Math.round((prior.dutyMin365d ?? 0) + Y.duty - T365.duty))
    const sectors28d = Math.max(0, (prior.sectors28d ?? 0) + Y.sectors - T28.sectors)
    const sectors90d = Math.max(0, (prior.sectors90d ?? 0) + Y.sectors - T90.sectors)
    const sectors365d = Math.max(0, (prior.sectors365d ?? 0) + Y.sectors - T365.sectors)

    const bhMonthMin = Math.round((sameMonth ? (prior.bhMonthMin ?? 0) : 0) + Y.bh)
    const bhYtdMin = Math.round((sameYear ? (prior.bhYtdMin ?? 0) : 0) + Y.bh)
    const dutyMonthMin = Math.round((sameMonth ? (prior.dutyMonthMin ?? 0) : 0) + Y.duty)
    const dutyYtdMin = Math.round((sameYear ? (prior.dutyYtdMin ?? 0) : 0) + Y.duty)

    await CrewRollingSnapshot.updateOne(
      { _id: `${operatorId}__${crewId}__${snapshotIso}` },
      {
        $set: {
          operatorId,
          crewId,
          snapshotIso,
          snapshotMs: endOfIsoMs(snapshotIso),
          bhMin28d,
          bhMin90d,
          bhMin365d,
          dutyMin28d,
          dutyMin90d,
          dutyMin365d,
          landings28d: sectors28d,
          landings90d: sectors90d,
          landings365d: sectors365d,
          sectors28d,
          sectors90d,
          sectors365d,
          bhMonthMin,
          bhYtdMin,
          dutyMonthMin,
          dutyYtdMin,
          sourceVersion: 1,
          computedAtUtc: new Date().toISOString(),
        },
      },
      { upsert: true },
    )
    snapshotsWritten++
    if ((i + 1) % progressEvery === 0) {
      const pct = 30 + Math.round(((i + 1) / total) * 60)
      await log('info', `Incremental ${i + 1}/${total}`, pct)
    }
  }

  const durationMs = Date.now() - t0
  await log(
    'info',
    `Incremental done — ${snapshotsWritten.toLocaleString()} snapshots in ${durationMs}ms` +
      (fallbackCrewIds.length > 0 ? ` (${fallbackCrewIds.length} crew need full recompute)` : ''),
    fallbackCrewIds.length > 0 ? 65 : 99,
  )

  return {
    stats: {
      crewProcessed: total,
      snapshotsWritten,
      daysCovered: 1,
      durationMs,
    },
    fallbackCrewIds,
  }
}

// ── CLI entry ─────────────────────────────────────────────────────────────
// Usage:
//   pnpm --filter server tsx src/jobs/tasks/daily-crew-activity-log.ts \
//     --operator=20169cc0-c914-4662-a300-1dbbe20d1416 [--from=YYYY-MM-DD --to=YYYY-MM-DD]
// Defaults to yesterday when --from/--to omitted.
async function cliMain(): Promise<void> {
  const args = process.argv.slice(2)
  const flag = (name: string): string | null => {
    const found = args.find((a) => a.startsWith(`--${name}=`))
    return found ? found.slice(name.length + 3) : null
  }
  const operatorId = flag('operator')
  if (!operatorId) {
    console.error('Missing --operator=<operatorId>')
    process.exit(2)
  }
  const fromIso = flag('from')
  const toIso = flag('to')
  const crewIds = flag('crew')?.split(',').filter(Boolean)

  const { default: mongoose } = await import('mongoose')
  const mongoUrl = process.env.MONGODB_URI ?? process.env.MONGO_URL
  if (!mongoUrl) {
    console.error('Missing MONGODB_URI / MONGO_URL env')
    process.exit(2)
  }
  await mongoose.connect(mongoUrl)
  const log: RunLog = (level, message, pct) => {
    const tag = pct != null ? `[${pct}%] ` : ''
    if (level === 'error') console.error(tag + message)
    else if (level === 'warn') console.warn(tag + message)
    else console.log(tag + message)
  }
  const stats = await runDailyCrewActivityLog(
    operatorId,
    {
      fromIso: fromIso ?? undefined,
      toIso: toIso ?? undefined,
      crewIds,
    },
    log,
  )
  console.log('STATS', JSON.stringify(stats, null, 2))
  await mongoose.disconnect()
}

if (
  process.argv[1]?.endsWith('daily-crew-activity-log.ts') ||
  process.argv[1]?.endsWith('daily-crew-activity-log.js')
) {
  void cliMain().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
