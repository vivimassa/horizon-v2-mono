// Seed Annual Leave (AL) activity for all CP + FO qualified on A320.
// Pattern: 7 days AL out of every 28 (21 work + 7 off).
// Offsets scattered across crew so blocks don't start/end together.
//
// Usage:
//   tsx src/seed-al-scatter.ts <operatorId> [--window=YYYY-MM-DD:YYYY-MM-DD] [--apply]
//   (default window 2026-04-01..2026-06-30, dry-run without --apply)

import 'dotenv/config'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { CrewMember } from './models/CrewMember.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewQualification } from './models/CrewQualification.js'
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
    console.log('Usage: tsx src/seed-al-scatter.ts <operatorId> [--window=YYYY-MM-DD:YYYY-MM-DD] [--apply]')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)

  // Resolve AL activity code (prefer code === 'AL', fall back to any code
  // carrying `is_annual_leave` flag).
  const alCode =
    (await ActivityCode.findOne({ operatorId, code: 'AL' }).lean()) ??
    (await ActivityCode.findOne({ operatorId, flags: { $in: ['is_annual_leave'] } }).lean())
  if (!alCode) {
    console.error(`No AL / is_annual_leave ActivityCode found for operator ${operatorId}`)
    process.exit(1)
  }
  const alCodeId = (alCode as { _id: string })._id

  // Resolve CP + FO position ids.
  const positions = await CrewPosition.find({ operatorId, code: { $in: ['CP', 'FO'] } })
    .select('_id code')
    .lean()
  const positionIds = (positions as Array<{ _id: string; code: string }>).map((p) => p._id)
  if (positionIds.length === 0) {
    console.error('CP / FO positions not found')
    process.exit(1)
  }

  // Crew qualified on A320 → intersected with CP/FO active/suspended.
  const a320CrewIds = (await CrewQualification.distinct('crewId', {
    operatorId,
    aircraftType: 'A320',
  })) as string[]
  const crew = await CrewMember.find({
    operatorId,
    status: { $in: ['active', 'suspended'] },
    position: { $in: positionIds },
    _id: { $in: a320CrewIds },
  })
    .select('_id position')
    .sort({ _id: 1 })
    .lean()

  console.log(`\nTarget crew: ${crew.length} (A320 CP + FO, active/suspended)`)
  console.log(`Window: ${winFrom} .. ${winTo} (${rangeDays(winFrom, winTo)} days)`)

  // Scatter offsets evenly across the 28-day cycle.
  // offset = floor(i * 28 / N) → spreads leave-start uniformly.
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
    dateIso: null
    notes: string | null
    assignedByUserId: string | null
    assignedAtUtc: string
    createdAt: string
    updatedAt: string
  }> = []

  const now = new Date().toISOString()
  const perCrewCounts: number[] = []

  crew.forEach((c, i) => {
    const offset = N > 0 ? Math.floor((i * CYCLE_DAYS) / N) : 0
    let startOffset = offset
    let count = 0
    while (startOffset < windowDays) {
      // Emit ONE activity row per day in the 7-day leave block.
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
          activityCodeId: alCodeId,
          startUtcIso: `${dayIso}T00:00:00.000Z`,
          endUtcIso: `${dayIso}T23:59:59.999Z`,
          dateIso: dayIso,
          notes: null,
          assignedByUserId: null,
          assignedAtUtc: now,
          createdAt: now,
          updatedAt: now,
        })
        count += 1
      }
      startOffset += CYCLE_DAYS
    }
    perCrewCounts.push(count)
  })

  const totalDays = docs.length
  const avgDaysPerCrew = N > 0 ? (totalDays / N).toFixed(2) : '0'
  console.log(`\nPlanned AL day-rows: ${totalDays} (avg ${avgDaysPerCrew} day-rows/crew, 1-day each)`)

  if (!apply) {
    console.log('\n[dry-run] Re-run with --apply to insert into CrewActivity.')
    await mongoose.disconnect()
    return
  }

  // Wipe any previous AL activities for these crew in window, then insert.
  const wipe = await CrewActivity.deleteMany({
    operatorId,
    crewId: { $in: crew.map((c) => c._id as string) },
    activityCodeId: alCodeId,
    startUtcIso: { $lte: `${winTo}T23:59:59.999Z` },
    endUtcIso: { $gte: `${winFrom}T00:00:00.000Z` },
  })
  console.log(`Removed ${wipe.deletedCount} existing AL activities in window.`)

  if (docs.length > 0) {
    await CrewActivity.insertMany(docs)
    console.log(`Inserted ${docs.length} AL activities.`)
  }

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
