import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'
import { CrewMember } from './models/CrewMember.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewAssignment } from './models/CrewAssignment.js'
import { CrewComplement } from './models/CrewComplement.js'

/**
 * One-off: create N crew assignments on pairings that start in the
 * middle of a specific month (days 10–20). Uses distinct crew members
 * across the batch so the Gantt shows bars spread across ~N crew rows.
 *
 * Usage:   tsx server/src/seed-bulk-assignments.ts [--count=10] [--month=2026-04] [--operator=<id>]
 * Default month: 2026-04.
 */

const DEFAULT_OPERATOR = '20169cc0-c914-4662-a300-1dbbe20d1416'
const DEFAULT_MONTH = '2026-04'

function matchesMidOfMonth(iso: string, yyyymm: string): boolean {
  if (!iso.startsWith(yyyymm + '-')) return false
  const d = parseInt(iso.slice(8, 10), 10)
  return d >= 10 && d <= 20
}

async function main() {
  const args = process.argv.slice(2)
  const operatorArg = args.find((a) => a.startsWith('--operator='))
  const operatorId = operatorArg ? operatorArg.split('=')[1] : DEFAULT_OPERATOR
  const countArg = args.find((a) => a.startsWith('--count='))
  const targetCount = countArg ? Math.max(1, Math.min(100, parseInt(countArg.split('=')[1], 10))) : 10
  const monthArg = args.find((a) => a.startsWith('--month='))
  const month = monthArg ? monthArg.split('=')[1] : DEFAULT_MONTH

  await connectDB(env.MONGODB_URI)
  console.log(`Operator:    ${operatorId}`)
  console.log(`Month:       ${month}  (days 10–20)`)
  console.log(`Target:      ${targetCount} assignments`)

  // Scan every production pairing — seat counts are resolved from the
  // CrewComplement master below, so an empty pairing.crewCounts cache is
  // fine. Previously we filtered on that field and missed the real data.
  const allPairings = await Pairing.find({
    operatorId,
    scenarioId: { $in: [null, undefined] },
  })
    .sort({ startDate: 1 })
    .lean()

  const complements = await CrewComplement.find({ operatorId, isActive: true }).lean()
  const complementIndex = new Map<string, Record<string, number>>()
  for (const c of complements) {
    const ccCounts =
      c.counts instanceof Map
        ? (Object.fromEntries(c.counts) as Record<string, number>)
        : ((c.counts ?? {}) as Record<string, number>)
    complementIndex.set(`${c.aircraftTypeIcao}/${c.templateKey}`, ccCounts)
  }
  const resolveCounts = (p: {
    aircraftTypeIcao?: string | null
    complementKey?: string | null
    crewCounts?: Record<string, number> | null
  }) => {
    const own = (p.crewCounts ?? {}) as Record<string, number>
    if (own && Object.keys(own).length > 0) return own
    return complementIndex.get(`${p.aircraftTypeIcao ?? ''}/${p.complementKey ?? 'standard'}`) ?? {}
  }

  const midMonthPairings = allPairings.filter((p) => matchesMidOfMonth(p.startDate, month))
  if (midMonthPairings.length === 0) {
    console.error(`No pairings found starting in ${month} days 10–20. Scanned ${allPairings.length} total.`)
    process.exit(1)
  }
  console.log(`Pool:        ${midMonthPairings.length} matching pairings available`)

  const positions = await CrewPosition.find({ operatorId }).lean()
  const posByCode = new Map(positions.map((p) => [p.code, p]))
  const downrankableByCategory = new Map<string, string[]>()
  for (const p of positions) {
    if (!p.canDownrank) continue
    const arr = downrankableByCategory.get(p.category) ?? []
    arr.push(p._id as string)
    downrankableByCategory.set(p.category, arr)
  }

  const usedCrew = new Set<string>()
  const created: Array<{ pairing: string; crew: string; seat: string; idx: number; window: string }> = []

  outer: for (const pairing of midMonthPairings) {
    if (created.length >= targetCount) break
    const counts = resolveCounts(
      pairing as unknown as {
        aircraftTypeIcao?: string | null
        complementKey?: string | null
        crewCounts?: Record<string, number> | null
      },
    )
    for (const [seatCode, needed] of Object.entries(counts)) {
      if (!needed || needed <= 0) continue
      const seat = posByCode.get(seatCode)
      if (!seat) continue

      const existing = await CrewAssignment.find({
        operatorId,
        pairingId: pairing._id as string,
        seatPositionId: seat._id as string,
        status: { $ne: 'cancelled' },
      }).lean()
      const usedIndices = new Set(existing.map((a) => a.seatIndex))
      if (usedIndices.size >= needed) continue
      let seatIndex = 0
      while (usedIndices.has(seatIndex)) seatIndex += 1

      // Preferred: exact position match. Then: downrank fallback.
      const candidatePositionIds = [seat._id as string]
      const dr = downrankableByCategory.get(seat.category) ?? []
      for (const id of dr) {
        if (!candidatePositionIds.includes(id)) candidatePositionIds.push(id)
      }

      const crew = await CrewMember.findOne({
        operatorId,
        position: { $in: candidatePositionIds },
        status: { $ne: 'inactive' },
        _id: { $nin: Array.from(usedCrew) },
      }).lean()
      if (!crew) continue

      const legs = pairing.legs ?? []
      const startUtcIso =
        (pairing as unknown as { reportTime?: string | null }).reportTime ??
        (legs[0]
          ? new Date(new Date(legs[0].staUtcIso).getTime() - 90 * 60_000).toISOString()
          : `${pairing.startDate}T00:00:00.000Z`)
      const endUtcIso = legs.length
        ? new Date(new Date(legs[legs.length - 1].staUtcIso).getTime() + 30 * 60_000).toISOString()
        : `${pairing.endDate}T23:59:00.000Z`

      const now = new Date().toISOString()
      await CrewAssignment.create({
        _id: crypto.randomUUID(),
        operatorId,
        scenarioId: null,
        pairingId: pairing._id,
        crewId: crew._id,
        seatPositionId: seat._id,
        seatIndex,
        status: 'planned',
        startUtcIso,
        endUtcIso,
        assignedByUserId: null,
        assignedAtUtc: now,
        createdAt: now,
        updatedAt: now,
      })
      usedCrew.add(crew._id as string)
      created.push({
        pairing: pairing.pairingCode,
        crew: `${crew.lastName} ${crew.firstName} (${crew.employeeId})`,
        seat: `${seat.code}#${seatIndex}`,
        idx: seatIndex,
        window: `${startUtcIso.slice(0, 16)}Z → ${endUtcIso.slice(0, 16)}Z`,
      })
      if (created.length >= targetCount) break outer
    }
  }

  console.log('')
  console.log(`✓ Created ${created.length} assignment(s):`)
  for (const c of created) {
    console.log(`  ${c.pairing.padEnd(8)} ${c.seat.padEnd(6)}  ${c.crew.padEnd(36)}  ${c.window}`)
  }
  if (created.length < targetCount) {
    console.log('')
    console.log(`⚠ Wanted ${targetCount} but only created ${created.length}.`)
    console.log('  Likely reasons: not enough distinct eligible crew, or pairings already fully staffed.')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
