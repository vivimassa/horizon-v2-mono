import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewActivity } from '../models/CrewActivity.js'
import { Pairing } from '../models/Pairing.js'
import { ActivityCode } from '../models/ActivityCode.js'

const DAY_MS = 86_400_000

export type StatsPeriod = 'month' | '28d' | 'year'

export interface CrewStats {
  period: StatsPeriod
  range: { fromIso: string; toIso: string }
  blockMinutes: number
  dutyMinutes: number
  sectors: number
  nightDuties: number
  daysOff: number
  avgBlockMinutesPerDay: number
  weekly: { weekLabel: string; blockMinutes: number }[]
  trends: {
    blockDeltaMinutes: number
    dutyDeltaMinutes: number
    sectorsDelta: number
  }
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
  // year
  const from = new Date(at.getFullYear(), 0, 1)
  const to = new Date(at.getFullYear() + 1, 0, 1)
  return { from: from.getTime(), to: to.getTime() }
}

export async function computeCrewStats(
  operatorId: string,
  crewId: string,
  period: StatsPeriod,
  atMs: number,
): Promise<CrewStats> {
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

  // Hydrate pairings for legs (block minutes per leg)
  const pairingIds = Array.from(new Set(assignments.map((a) => a.pairingId)))
  const pairings = pairingIds.length
    ? await Pairing.find({ operatorId, _id: { $in: pairingIds } }, { legs: 1, numberOfSectors: 1 }).lean()
    : []
  const pairingById = new Map(pairings.map((p) => [p._id as string, p]))

  let blockMinutes = 0
  let dutyMinutes = 0
  let sectors = 0
  let nightDuties = 0

  for (const a of assignments) {
    const startMs = a.startUtcIso ? Date.parse(a.startUtcIso) : 0
    const endMs = a.endUtcIso ? Date.parse(a.endUtcIso) : 0
    if (!startMs || !endMs) continue

    const overlapMin = Math.max(0, Math.min(endMs, to) - Math.max(startMs, from)) / 60_000
    dutyMinutes += overlapMin

    const p = pairingById.get(a.pairingId)
    if (!p) continue
    for (const leg of p.legs ?? []) {
      const stdMs = leg.stdUtcIso ? Date.parse(leg.stdUtcIso) : NaN
      if (!Number.isFinite(stdMs) || stdMs < from || stdMs >= to) continue
      blockMinutes += leg.blockMinutes ?? 0
      sectors += 1
      // Night = STD-UTC hour 22..05. Phase C: tz-aware.
      const hour = new Date(stdMs).getUTCHours()
      if (hour >= 22 || hour < 6) nightDuties += 1
    }
  }

  // Days off = days in range with NO assignment + activity rest
  const dayOffActivities = await CrewActivity.find({
    operatorId,
    crewId,
    scenarioId: null,
    startUtcIso: { $lt: toIso },
    endUtcIso: { $gt: fromIso },
  }).lean()
  const dayOffCodeIds = new Set<string>()
  if (dayOffActivities.length) {
    const codes = await ActivityCode.find({
      operatorId,
      _id: { $in: Array.from(new Set(dayOffActivities.map((a) => a.activityCodeId))) },
    }).lean()
    for (const c of codes) {
      if (c.code === 'OFF' || c.code === 'DOFF' || /OFF/i.test(c.code)) dayOffCodeIds.add(c._id as string)
    }
  }
  const daysOffSet = new Set<string>()
  for (const act of dayOffActivities) {
    if (!dayOffCodeIds.has(act.activityCodeId)) continue
    if (act.dateIso) daysOffSet.add(act.dateIso)
  }
  const daysOff = daysOffSet.size

  const days = Math.max(1, Math.round((Math.min(to, atMs + DAY_MS) - from) / DAY_MS))
  const avgBlockMinutesPerDay = blockMinutes / days

  // Weekly bars — simple ISO week labels W1..W4
  const weekly: { weekLabel: string; blockMinutes: number }[] = []
  const totalDays = Math.round((to - from) / DAY_MS)
  const weeks = Math.max(1, Math.ceil(totalDays / 7))
  for (let w = 0; w < weeks; w++) {
    const wStart = from + w * 7 * DAY_MS
    const wEnd = Math.min(to, wStart + 7 * DAY_MS)
    let wb = 0
    for (const a of assignments) {
      const p = pairingById.get(a.pairingId)
      if (!p) continue
      for (const leg of p.legs ?? []) {
        const stdMs = leg.stdUtcIso ? Date.parse(leg.stdUtcIso) : NaN
        if (!Number.isFinite(stdMs) || stdMs < wStart || stdMs >= wEnd) continue
        wb += leg.blockMinutes ?? 0
      }
    }
    weekly.push({ weekLabel: `W${w + 1}`, blockMinutes: wb })
  }

  // Trends — compare to prior period of same length
  const priorTo = from
  const priorFrom = priorTo - (to - from)
  const priorAssignments = await CrewAssignment.find({
    operatorId,
    crewId,
    scenarioId: null,
    status: { $ne: 'cancelled' },
    startUtcIso: { $lt: new Date(priorTo).toISOString() },
    endUtcIso: { $gt: new Date(priorFrom).toISOString() },
  }).lean()
  const priorPairingIds = Array.from(new Set(priorAssignments.map((a) => a.pairingId)))
  const priorPairings = priorPairingIds.length
    ? await Pairing.find({ operatorId, _id: { $in: priorPairingIds } }, { legs: 1 }).lean()
    : []
  const priorPairingById = new Map(priorPairings.map((p) => [p._id as string, p]))
  let priorBlock = 0
  let priorDuty = 0
  let priorSectors = 0
  for (const a of priorAssignments) {
    const startMs = a.startUtcIso ? Date.parse(a.startUtcIso) : 0
    const endMs = a.endUtcIso ? Date.parse(a.endUtcIso) : 0
    if (startMs && endMs) {
      priorDuty += Math.max(0, Math.min(endMs, priorTo) - Math.max(startMs, priorFrom)) / 60_000
    }
    const p = priorPairingById.get(a.pairingId)
    if (!p) continue
    for (const leg of p.legs ?? []) {
      const stdMs = leg.stdUtcIso ? Date.parse(leg.stdUtcIso) : NaN
      if (!Number.isFinite(stdMs) || stdMs < priorFrom || stdMs >= priorTo) continue
      priorBlock += leg.blockMinutes ?? 0
      priorSectors += 1
    }
  }

  return {
    period,
    range: { fromIso, toIso },
    blockMinutes: Math.round(blockMinutes),
    dutyMinutes: Math.round(dutyMinutes),
    sectors,
    nightDuties,
    daysOff,
    avgBlockMinutesPerDay: Math.round(avgBlockMinutesPerDay),
    weekly,
    trends: {
      blockDeltaMinutes: Math.round(blockMinutes - priorBlock),
      dutyDeltaMinutes: Math.round(dutyMinutes - priorDuty),
      sectorsDelta: sectors - priorSectors,
    },
  }
}
