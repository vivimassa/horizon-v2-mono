// Seed Vacation (VAC) activity for ALL CP + FO across ALL fleet.
// Pattern: 7 days VAC out of every 28 (21 work + 7 off).
// Offsets scattered evenly across crew to keep per-day leave headcount balanced.
//
// Usage:
//   tsx src/seed-vac-scatter.ts <operatorId> [--window=YYYY-MM-DD:YYYY-MM-DD] [--apply]
//   (default window 2026-04-01..2026-06-30, dry-run without --apply)

import 'dotenv/config'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { CrewMember } from './models/CrewMember.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewActivity } from './models/CrewActivity.js'
import { ActivityCode } from './models/ActivityCode.js'

const CYCLE_DAYS = 28
const LEAVE_LEN = 7

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function rangeDays(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z').getTime()
  const b = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.floor((b - a) / 86_400_000) + 1
}

async function main() {
  const [operatorId, ...flags] = process.argv.slice(2)
  const apply = flags.includes('--apply')
  const winFlag = flags.find((f) => f.startsWith('--window='))
  let winFrom = '2026-04-01'
  let winTo = '2026-06-30'
  if (winFlag) {
    const [f, t] = winFlag.slice('--window='.length).split(':')
    if (f && t) {
      winFrom = f
      winTo = t
    }
  }

  if (!operatorId) {
    console.log('Usage: tsx src/seed-vac-scatter.ts <operatorId> [--window=YYYY-MM-DD:YYYY-MM-DD] [--apply]')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)

  const vacCode = await ActivityCode.findOne({ operatorId, code: 'VAC' }).lean()
  if (!vacCode) {
    console.error(`No VAC ActivityCode found for operator ${operatorId}. Create it first.`)
    process.exit(1)
  }
  const vacCodeId = (vacCode as { _id: string })._id

  const positions = await CrewPosition.find({ operatorId, code: { $in: ['CP', 'FO'] } })
    .select('_id code')
    .lean()
  const positionIds = (positions as Array<{ _id: string; code: string }>).map((p) => p._id)
  if (positionIds.length === 0) {
    console.error('CP / FO positions not found')
    process.exit(1)
  }

  // ALL CP + FO, ALL fleet — no aircraft-qualification filter.
  const crew = await CrewMember.find({
    operatorId,
    status: { $in: ['active', 'suspended'] },
    position: { $in: positionIds },
  })
    .select('_id position')
    .sort({ _id: 1 })
    .lean()

  console.log(`\nTarget crew: ${crew.length} (ALL CP + FO, active/suspended, all fleet)`)
  console.log(`Window: ${winFrom} .. ${winTo} (${rangeDays(winFrom, winTo)} days)`)

  // Scatter offsets evenly across the 28-day cycle.
  // offset = floor(i * 28 / N) → spreads leave-start uniformly so on any
  // given day roughly (N * 7 / 28) = N/4 crew are on leave.
  const N = crew.length
  const windowDays = rangeDays(winFrom, winTo)
  const docs: Array<{
    _id: string
    operatorId: string
    scenarioId: null
    crewId: string
    activityCodeId: string
    startUtcIso: string
    endUtcIso: string
    dateIso: string
    notes: string | null
    assignedByUserId: string | null
    assignedAtUtc: string
    createdAt: string
    updatedAt: string
  }> = []

  const now = new Date().toISOString()
  const perDayLeave: Record<string, number> = {}

  crew.forEach((c, i) => {
    const offset = N > 0 ? Math.floor((i * CYCLE_DAYS) / N) : 0
    let startOffset = offset
    while (startOffset < windowDays) {
      for (let d = 0; d < LEAVE_LEN; d++) {
        const dayOffset = startOffset + d
        if (dayOffset >= windowDays) break
        const dayIso = addDays(winFrom, dayOffset)
        if (dayIso > winTo) break
        docs.push({
          _id: crypto.randomUUID(),
          operatorId,
          scenarioId: null,
          crewId: c._id as string,
          activityCodeId: vacCodeId,
          startUtcIso: `${dayIso}T00:00:00.000Z`,
          endUtcIso: `${dayIso}T23:59:59.999Z`,
          dateIso: dayIso,
          notes: null,
          assignedByUserId: null,
          assignedAtUtc: now,
          createdAt: now,
          updatedAt: now,
        })
        perDayLeave[dayIso] = (perDayLeave[dayIso] ?? 0) + 1
      }
      startOffset += CYCLE_DAYS
    }
  })

  const totalDays = docs.length
  const avgDaysPerCrew = N > 0 ? (totalDays / N).toFixed(2) : '0'
  console.log(`\nPlanned VAC day-rows: ${totalDays} (avg ${avgDaysPerCrew}/crew)`)
  const perDayValues = Object.values(perDayLeave)
  if (perDayValues.length > 0) {
    const min = Math.min(...perDayValues)
    const max = Math.max(...perDayValues)
    const avg = (perDayValues.reduce((a, b) => a + b, 0) / perDayValues.length).toFixed(1)
    console.log(`Per-day on-leave headcount — min ${min}, avg ${avg}, max ${max} (target ~${(N / 4).toFixed(1)})`)
  }

  if (!apply) {
    console.log('\n[dry-run] Re-run with --apply to insert into CrewActivity.')
    await mongoose.disconnect()
    return
  }

  const wipe = await CrewActivity.deleteMany({
    operatorId,
    crewId: { $in: crew.map((c) => c._id as string) },
    activityCodeId: vacCodeId,
    startUtcIso: { $lte: `${winTo}T23:59:59.999Z` },
    endUtcIso: { $gte: `${winFrom}T00:00:00.000Z` },
  })
  console.log(`Removed ${wipe.deletedCount} existing VAC activities in window.`)

  if (docs.length > 0) {
    await CrewActivity.insertMany(docs)
    console.log(`Inserted ${docs.length} VAC activities.`)
  }

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
