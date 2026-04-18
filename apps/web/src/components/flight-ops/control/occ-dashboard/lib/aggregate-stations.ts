import type { GanttFlight } from '@/lib/gantt/types'

export interface StationPerformance {
  icao: string
  delayMinutes: number
  movements: number
  minutesPerMovement: number
}

/** Group flights by departure station and sum observed delay minutes (atd − std, floored at 0). */
export function aggregateStations(flights: GanttFlight[], topN = 10): StationPerformance[] {
  const byStation = new Map<string, { delay: number; mv: number }>()

  for (const f of flights) {
    const cur = byStation.get(f.depStation) ?? { delay: 0, mv: 0 }
    cur.mv += 1
    if (typeof f.atdUtc === 'number') {
      const delay = Math.max(0, f.atdUtc - f.stdUtc) / 60_000
      cur.delay += delay
    } else if (typeof f.etdUtc === 'number') {
      const delay = Math.max(0, f.etdUtc - f.stdUtc) / 60_000
      cur.delay += delay
    }
    byStation.set(f.depStation, cur)
  }

  const rows: StationPerformance[] = []
  for (const [icao, { delay, mv }] of byStation) {
    if (mv === 0) continue
    rows.push({
      icao,
      delayMinutes: Math.round(delay),
      movements: mv,
      minutesPerMovement: mv > 0 ? delay / mv : 0,
    })
  }

  rows.sort((a, b) => b.delayMinutes - a.delayMinutes)
  return rows.slice(0, topN)
}
