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

export async function runDailyCrewActivityLog(
  operatorId: string,
  params: DailyCrewActivityLogParams,
  log: RunLog,
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
