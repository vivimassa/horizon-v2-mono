/**
 * Time + duration formatters for the crew app.
 *
 * Phase A: times render in DEVICE LOCAL using `toLocaleTimeString`. For
 * SkyHub Aviation (Vietnam UTC+7) device-local ≈ base-local for crew at
 * SGN/HAN/DAD bases. Phase B will introduce `fmtBaseLocal(utcMs, baseIcao)`
 * with a real airport→tz lookup from the master airports collection.
 */

const HM = { hour: '2-digit', minute: '2-digit', hour12: false } as const

export function fmtTime(utcMs: number | null | undefined): string {
  if (utcMs === null || utcMs === undefined) return '—'
  return new Date(utcMs).toLocaleTimeString(undefined, HM)
}

export function fmtTimeL(utcMs: number | null | undefined): string {
  return fmtTime(utcMs) + 'L'
}

export function fmtBlock(minutes: number | null | undefined): string {
  if (!minutes || minutes < 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function fmtBlockShort(minutes: number | null | undefined): string {
  if (!minutes || minutes < 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

export function fmtDateIso(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10)
}

export function fmtDateShort(utcMs: number): string {
  return new Date(utcMs).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export function fmtDayOfWeek(utcMs: number): string {
  return new Date(utcMs).toLocaleDateString(undefined, { weekday: 'short' })
}

export function fmtMonthYear(year: number, monthIdx0: number): string {
  return new Date(year, monthIdx0, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function fmtMonthShort(monthIdx0: number): string {
  return new Date(2000, monthIdx0, 1).toLocaleDateString(undefined, { month: 'short' })
}

export function startOfDayLocal(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDaysLocal(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

export function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  const a = (first ?? '').trim().charAt(0).toUpperCase()
  const b = (last ?? '').trim().charAt(0).toUpperCase()
  return a + b || '?'
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Working Late'
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}
