import type { MxEventRow, MxGanttAircraftRow } from '@skyhub/api'

export interface MaintenanceRollup {
  /** Unique a/c count currently out of service (in_progress or deferred past due). */
  aogCount: number
  /** In-progress maintenance (not necessarily AOG but unavailable now). */
  inProgressCount: number
  /** Deferred MEL items. */
  deferredCount: number
  /** A-check events with planned start within next 48h. */
  checkDue48hCount: number
  /** Top rows for the Maintenance Alerts table — most recent / most urgent first. */
  rows: (MxEventRow & { urgency: 'aog' | 'in_progress' | 'deferred' | 'upcoming' })[]
}

/** Collapse MxGanttAircraftRow[] (events nested per aircraft) into a dashboard rollup. */
export function rollupMaintenance(rows: MxGanttAircraftRow[], nowMs = Date.now()): MaintenanceRollup {
  const aogAircraft = new Set<string>()
  let inProgressCount = 0
  let deferredCount = 0
  let checkDue48hCount = 0
  const flat: (MxEventRow & { urgency: 'aog' | 'in_progress' | 'deferred' | 'upcoming' })[] = []

  const in48h = nowMs + 48 * 60 * 60 * 1000

  for (const row of rows) {
    for (const ev of row.events) {
      const plannedStartMs = Date.parse(ev.plannedStart)
      const plannedEndMs = ev.plannedEnd ? Date.parse(ev.plannedEnd) : null
      const actualStartMs = ev.actualStart ? Date.parse(ev.actualStart) : null
      const actualEndMs = ev.actualEnd ? Date.parse(ev.actualEnd) : null

      const isInProgress = ev.status === 'in_progress' || (actualStartMs && !actualEndMs)
      const isAog = isInProgress && (plannedEndMs == null || plannedEndMs < nowMs)
      const isDeferred = ev.status === 'deferred'
      const isUpcoming = ev.status === 'planned' && plannedStartMs >= nowMs && plannedStartMs <= in48h

      if (isAog) aogAircraft.add(row.aircraftId)
      if (isInProgress) inProgressCount += 1
      if (isDeferred) deferredCount += 1
      if (isUpcoming) checkDue48hCount += 1

      if (isAog || isInProgress || isDeferred || isUpcoming) {
        flat.push({
          ...ev,
          urgency: isAog ? 'aog' : isInProgress ? 'in_progress' : isDeferred ? 'deferred' : 'upcoming',
        })
      }
    }
  }

  // Urgency ordering for the table.
  const order: Record<'aog' | 'in_progress' | 'deferred' | 'upcoming', number> = {
    aog: 0,
    in_progress: 1,
    upcoming: 2,
    deferred: 3,
  }
  flat.sort((a, b) => order[a.urgency] - order[b.urgency] || Date.parse(a.plannedStart) - Date.parse(b.plannedStart))

  return {
    aogCount: aogAircraft.size,
    inProgressCount,
    deferredCount,
    checkDue48hCount,
    rows: flat,
  }
}
