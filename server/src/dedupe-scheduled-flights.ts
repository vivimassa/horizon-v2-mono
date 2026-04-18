// De-duplicate ScheduledFlight patterns created by double-imports.
//
// Strategy per duplicate group (same flightNumber/dep/arr/effectiveFrom):
//   1. Score each candidate by how many FlightInstance rows reference it
//      AND have tail.registration set. Higher = "kept".
//   2. If scores tie, prefer the one with any FlightInstance at all.
//      Else keep the earliest createdAt / lexicographic _id.
//   3. Mark losers as isActive=false (soft delete — preserves audit trail).
//
// Safe to re-run (idempotent; losers already marked inactive are skipped).
//
//   Dry run:  npx tsx src/dedupe-scheduled-flights.ts <operatorId> --dry
//   Execute:  npx tsx src/dedupe-scheduled-flights.ts <operatorId>

import 'dotenv/config'
import mongoose from 'mongoose'

const DRY_RUN = process.argv.includes('--dry')
const operatorId = process.argv[2]

async function main() {
  if (!operatorId) {
    console.log('Usage: tsx dedupe-scheduled-flights.ts <operatorId> [--dry]')
    process.exit(1)
  }
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)

  const sfC = mongoose.connection.db!.collection('scheduledFlights')
  const fiC = mongoose.connection.db!.collection('flightInstances')

  console.log(`[dedupe-scheduled-flights] ${DRY_RUN ? 'DRY RUN' : 'EXECUTING'} for operator=${operatorId}`)

  // Pull all active non-cancelled SFs for this operator.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sfs = await sfC
    .find<any>({
      operatorId,
      isActive: { $ne: false },
      status: { $ne: 'cancelled' },
    })
    .toArray()

  console.log(`[dedupe-scheduled-flights] scanned ${sfs.length} active ScheduledFlights`)

  // Group by identity tuple.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = new Map<string, any[]>()
  for (const sf of sfs) {
    const key = [
      sf.flightNumber,
      sf.depStation,
      sf.arrStation,
      sf.effectiveFrom,
      sf.effectiveUntil,
      sf.stdUtc,
      sf.staUtc,
      sf.daysOfWeek,
    ].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(sf)
  }

  // Tally FlightInstance coverage per sfId in one shot.
  // Count BOTH total instances and instances-with-tail-set.
  const allSfIds = sfs.map((s) => s._id as string)
  const fiCounts = await fiC
    .aggregate([
      { $match: { operatorId, scheduledFlightId: { $in: allSfIds } } },
      {
        $group: {
          _id: '$scheduledFlightId',
          total: { $sum: 1 },
          tailed: { $sum: { $cond: [{ $eq: ['$tail.registration', null] }, 0, 1] } },
        },
      },
    ])
    .toArray()
  const coverage = new Map<string, { total: number; tailed: number }>()
  for (const c of fiCounts) coverage.set(c._id as string, { total: c.total as number, tailed: c.tailed as number })

  let dupeGroups = 0
  let losers = 0
  let singletons = 0
  const loserIds: string[] = []
  const sampleDecisions: string[] = []

  for (const [, members] of groups) {
    if (members.length === 1) {
      singletons++
      continue
    }
    dupeGroups++
    // Score each member
    const scored = members.map((m) => {
      const cov = coverage.get(m._id as string) ?? { total: 0, tailed: 0 }
      return { sf: m, tailed: cov.tailed, total: cov.total }
    })
    // Sort: highest tailed desc, then total desc, then _id asc (stable)
    scored.sort((a, b) => {
      if (b.tailed !== a.tailed) return b.tailed - a.tailed
      if (b.total !== a.total) return b.total - a.total
      return String(a.sf._id).localeCompare(String(b.sf._id))
    })
    const keeper = scored[0]
    for (let i = 1; i < scored.length; i++) {
      const loser = scored[i]
      losers++
      loserIds.push(loser.sf._id as string)
      if (sampleDecisions.length < 8) {
        sampleDecisions.push(
          `${keeper.sf.flightNumber} ${keeper.sf.depStation}-${keeper.sf.arrStation}: keep=${keeper.sf._id.slice(0, 8)} (tailed=${keeper.tailed}/${keeper.total})  drop=${loser.sf._id.slice(0, 8)} (tailed=${loser.tailed}/${loser.total})`,
        )
      }
    }
  }

  console.log(`[dedupe-scheduled-flights] singleton groups: ${singletons}`)
  console.log(`[dedupe-scheduled-flights] duplicate groups: ${dupeGroups}`)
  console.log(`[dedupe-scheduled-flights] losers (will deactivate): ${losers}`)
  console.log('\nSample decisions:')
  for (const d of sampleDecisions) console.log('  ', d)

  if (DRY_RUN) {
    console.log('\n[dedupe-scheduled-flights] DRY RUN — no writes performed.')
  } else if (loserIds.length === 0) {
    console.log('\n[dedupe-scheduled-flights] Nothing to do.')
  } else {
    console.log(`\n[dedupe-scheduled-flights] Deactivating ${loserIds.length} loser patterns…`)
    const res = await sfC.updateMany(
      { _id: { $in: loserIds } },
      { $set: { isActive: false, updatedAt: new Date().toISOString() } },
    )
    console.log(`[dedupe-scheduled-flights] ✔ modifiedCount: ${res.modifiedCount}`)
  }

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error('[dedupe-scheduled-flights] FAILED:', e)
  process.exit(1)
})
