import 'dotenv/config'
import mongoose from 'mongoose'
import { Pairing } from './models/Pairing.js'
import { CrewComplement } from './models/CrewComplement.js'

const OPID = '20169cc0-c914-4662-a300-1dbbe20d1416'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)

  // Pairing complementKey distribution
  const pairingAgg = await Pairing.aggregate([
    { $match: { operatorId: OPID, scenarioId: null } },
    { $group: { _id: { k: '$complementKey', ac: '$aircraftTypeIcao' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ])
  console.log('\nPairing complementKey distribution:')
  for (const r of pairingAgg) console.log(`  ${(r._id.ac ?? '—').padEnd(6)} ${(r._id.k ?? 'null').padEnd(12)} ${r.n}`)

  // Sample pairing.crewCounts — how many have populated cache?
  const total = await Pairing.countDocuments({ operatorId: OPID, scenarioId: null })
  const withCnt = await Pairing.countDocuments({
    operatorId: OPID,
    scenarioId: null,
    crewCounts: { $ne: null, $exists: true },
  })
  console.log(`\nPairings: total=${total}, with crewCounts cache populated=${withCnt}`)

  // CrewComplement table
  const comps = await CrewComplement.find({ operatorId: OPID, isActive: true })
    .select('aircraftTypeIcao templateKey counts')
    .lean()
  console.log('\nCrewComplement rows:')
  for (const c of comps as any[]) {
    const counts = c.counts instanceof Map ? Object.fromEntries(c.counts) : (c.counts ?? {})
    console.log(
      `  ${String(c.aircraftTypeIcao).padEnd(6)} ${String(c.templateKey).padEnd(12)} ${JSON.stringify(counts)}`,
    )
  }

  await mongoose.disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
