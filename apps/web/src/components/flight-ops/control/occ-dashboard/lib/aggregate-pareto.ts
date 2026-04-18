import type { GanttFlight } from '@/lib/gantt/types'

export interface ParetoCode {
  code: string
  minutes: number
}

export interface ParetoGroup {
  category: string
  totalMinutes: number
  codes: ParetoCode[]
}

/**
 * Flatten all `GanttFlight.delays[]` entries, group by category, aggregate minutes per code.
 * Category falls back to "Other" so unknown labels still show up somewhere.
 */
export function aggregateParetoByCategory(flights: GanttFlight[]): ParetoGroup[] {
  const groups = new Map<string, Map<string, number>>()

  for (const f of flights) {
    if (!f.delays?.length) continue
    for (const d of f.delays) {
      if (!d.code) continue
      const category = d.category?.trim() || 'Other'
      if (!groups.has(category)) groups.set(category, new Map())
      const inner = groups.get(category)!
      inner.set(d.code, (inner.get(d.code) ?? 0) + (Number.isFinite(d.minutes) ? d.minutes : 0))
    }
  }

  const out: ParetoGroup[] = []
  for (const [category, inner] of groups) {
    const codes: ParetoCode[] = Array.from(inner, ([code, minutes]) => ({ code, minutes })).sort(
      (a, b) => b.minutes - a.minutes,
    )
    const totalMinutes = codes.reduce((acc, c) => acc + c.minutes, 0)
    out.push({ category, totalMinutes, codes })
  }

  out.sort((a, b) => b.totalMinutes - a.totalMinutes)
  return out
}
