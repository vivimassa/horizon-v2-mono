import { CrewAssignment } from '../models/CrewAssignment.js'
import { Pairing } from '../models/Pairing.js'

const DAY_MS = 86_400_000

export type StatsPeriod = 'month' | '28d' | 'year'

export interface TopRoute {
  depIcao: string
  arrIcao: string
  sectors: number
  blockMinutes: number
}

function rangeFor(period: StatsPeriod, atMs: number): { from: number; to: number } {
  const at = new Date(atMs)
  if (period === 'month') {
    const from = new Date(at.getFullYear(), at.getMonth(), 1)
    const to = new Date(at.getFullYear(), at.getMonth() + 1, 1)
    return { from: from.getTime(), to: to.getTime() }
  }
  if (period === '28d') {
    return { from: atMs - 28 * DAY_MS, to: atMs }
  }
  const from = new Date(at.getFullYear(), 0, 1)
  const to = new Date(at.getFullYear() + 1, 0, 1)
  return { from: from.getTime(), to: to.getTime() }
}

/**
 * Aggregates the crew member's flown legs in the period by route (dep ⇄ arr,
 * direction-agnostic — HAN→BKK and BKK→HAN both counted as "HAN ⇄ BKK").
 * Returns top N by sector count.
 */
export async function computeTopRoutes(
  operatorId: string,
  crewId: string,
  period: StatsPeriod,
  atMs: number,
  limit = 5,
): Promise<TopRoute[]> {
  const { from, to } = rangeFor(period, atMs)
  const fromIso = new Date(from).toISOString()
  const toIso = new Date(to).toISOString()

  const assignments = await CrewAssignment.find({
    operatorId,
    crewId,
    scenarioId: null,
    status: { $ne: 'cancelled' },
    startUtcIso: { $lt: toIso },
    endUtcIso: { $gt: fromIso },
  }).lean()

  const pairingIds = Array.from(new Set(assignments.map((a) => a.pairingId)))
  if (pairingIds.length === 0) return []

  const pairings = await Pairing.find({ operatorId, _id: { $in: pairingIds } }, { legs: 1 }).lean()

  const buckets = new Map<string, TopRoute>()
  for (const p of pairings) {
    for (const leg of p.legs ?? []) {
      const stdMs = leg.stdUtcIso ? Date.parse(leg.stdUtcIso) : NaN
      if (!Number.isFinite(stdMs) || stdMs < from || stdMs >= to) continue
      const dep = (leg.depStation ?? '').toUpperCase()
      const arr = (leg.arrStation ?? '').toUpperCase()
      if (!dep || !arr) continue
      // Normalize direction: alphabetical pair
      const [a, b] = dep < arr ? [dep, arr] : [arr, dep]
      const key = `${a}-${b}`
      const existing = buckets.get(key)
      if (existing) {
        existing.sectors += 1
        existing.blockMinutes += leg.blockMinutes ?? 0
      } else {
        buckets.set(key, { depIcao: a, arrIcao: b, sectors: 1, blockMinutes: leg.blockMinutes ?? 0 })
      }
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.sectors - a.sectors || b.blockMinutes - a.blockMinutes)
    .slice(0, limit)
}
