/**
 * Pure helpers for computing the next firing instant of a ScheduledTask
 * given its `schedule` policy in the operator's IANA timezone.
 *
 * Kept dep-free so the same module can be imported into the web client
 * for "Next Run" display.
 */

export type SchedulePolicy = {
  frequency: 'daily' | 'weekly' | 'monthly'
  daysOfWeek?: number[] // 0=Sun..6=Sat
  dayOfMonth?: number | null
  timesOfDayLocal: string[] // "HH:mm"
  timezone: string // IANA, e.g. 'Asia/Ho_Chi_Minh'
}

interface WallClock {
  year: number
  month: number // 1..12
  day: number
  hour: number
  minute: number
  weekday: number // 0..6, Sun=0
  utcMs: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function wallClockInTz(utcMs: number, tz: string): WallClock {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(new Date(utcMs))) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === '24' ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    utcMs,
  }
}

/** Convert a wall-clock instant in `tz` to UTC ms, DST-aware. */
function tzWallToUtcMs(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(new Date(guess))) parts[p.type] = p.value
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === '24' ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  const offsetMs = guess - wall
  return guess + offsetMs
}

function parseHHmm(s: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s)
  if (!m) return null
  return { hour: Number(m[1]), minute: Number(m[2]) }
}

function shiftDays(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const t = Date.UTC(year, month - 1, day) + deltaDays * 86_400_000
  const d = new Date(t)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/**
 * Returns the next UTC ms when this schedule should fire, strictly after `afterUtcMs`.
 * Returns null when policy is malformed.
 */
export function computeNextRunMs(policy: SchedulePolicy, afterUtcMs: number): number | null {
  const tz = policy.timezone || 'UTC'
  const slots = policy.timesOfDayLocal
    .map(parseHHmm)
    .filter((x): x is { hour: number; minute: number } => x != null)
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute)
  if (slots.length === 0) return null

  let cursor = wallClockInTz(afterUtcMs, tz)
  // Walk forward up to 366 days searching for a matching slot.
  for (let i = 0; i < 367; i++) {
    const matchesFrequency = (() => {
      if (policy.frequency === 'daily') return true
      if (policy.frequency === 'weekly') {
        const days = policy.daysOfWeek ?? []
        if (days.length === 0) return true
        return days.includes(cursor.weekday)
      }
      // monthly
      const target = policy.dayOfMonth ?? 1
      return cursor.day === target
    })()

    if (matchesFrequency) {
      for (const slot of slots) {
        const candidateMs = tzWallToUtcMs(cursor.year, cursor.month, cursor.day, slot.hour, slot.minute, tz)
        if (candidateMs > afterUtcMs) return candidateMs
      }
    }
    const next = shiftDays(cursor.year, cursor.month, cursor.day, 1)
    cursor = wallClockInTz(tzWallToUtcMs(next.year, next.month, next.day, 0, 0, tz), tz)
  }
  return null
}

/** Human one-line summary of the schedule, e.g. "Daily 00:30 (Asia/Ho_Chi_Minh)". */
export function summariseSchedule(policy: SchedulePolicy): string {
  const slots = policy.timesOfDayLocal.join(', ')
  const tz = policy.timezone || 'UTC'
  if (policy.frequency === 'daily') return `Daily ${slots} (${tz})`
  if (policy.frequency === 'weekly') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const days = (policy.daysOfWeek ?? []).map((d) => names[d] ?? '?').join('/')
    return `Weekly ${days || '—'} ${slots} (${tz})`
  }
  return `Monthly day ${policy.dayOfMonth ?? '?'} ${slots} (${tz})`
}
