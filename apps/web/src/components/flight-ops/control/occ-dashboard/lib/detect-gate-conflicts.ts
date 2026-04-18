import type { GanttFlight } from '@/lib/gantt/types'

/** Gate-occupancy window: 30 min centered on the later of STD/ETD (or STA/ETA for arrivals). */
const OCCUPANCY_MS = 30 * 60 * 1000

export interface GateConflict {
  station: string
  gate: string
  /** Composite `id` of flights sharing the gate in an overlapping window. */
  flightIds: string[]
}

/**
 * Returns conflicts keyed by `${station}|${gate}`. A flight is flagged when another flight shares
 * the same station + gate and its occupancy window overlaps by any amount.
 *
 * `side` picks between departure gate (default) and arrival gate.
 */
export function detectGateConflicts(flights: GanttFlight[], side: 'dep' | 'arr' = 'dep'): Map<string, GateConflict> {
  type Occ = { id: string; start: number; end: number; station: string; gate: string }
  const slots: Occ[] = []

  for (const f of flights) {
    const gate = side === 'dep' ? f.depGate : f.arrGate
    if (!gate) continue
    const station = side === 'dep' ? f.depStation : f.arrStation
    const anchor = side === 'dep' ? (f.etdUtc ?? f.stdUtc) : (f.etaUtc ?? f.staUtc)
    if (typeof anchor !== 'number') continue
    slots.push({
      id: f.id,
      start: anchor - OCCUPANCY_MS / 2,
      end: anchor + OCCUPANCY_MS / 2,
      station,
      gate,
    })
  }

  // Bucket by station|gate so we only compare within the same bay.
  const byBay = new Map<string, Occ[]>()
  for (const slot of slots) {
    const key = `${slot.station}|${slot.gate}`
    if (!byBay.has(key)) byBay.set(key, [])
    byBay.get(key)!.push(slot)
  }

  const conflicts = new Map<string, GateConflict>()
  for (const [key, bay] of byBay) {
    if (bay.length < 2) continue
    bay.sort((a, b) => a.start - b.start)
    const colliding = new Set<string>()
    for (let i = 0; i < bay.length; i++) {
      for (let j = i + 1; j < bay.length; j++) {
        if (bay[j].start >= bay[i].end) break
        colliding.add(bay[i].id)
        colliding.add(bay[j].id)
      }
    }
    if (colliding.size > 0) {
      const [station, gate] = key.split('|')
      conflicts.set(key, { station, gate, flightIds: Array.from(colliding) })
    }
  }

  return conflicts
}

/** Flat set of flight IDs involved in any gate conflict — for quick row tagging. */
export function flightIdsWithConflict(conflicts: Map<string, GateConflict>): Set<string> {
  const ids = new Set<string>()
  for (const c of conflicts.values()) for (const id of c.flightIds) ids.add(id)
  return ids
}
