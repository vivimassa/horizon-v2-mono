/**
 * Reassigns globally-unique seniority 1..N across all crew for the operator.
 * Order: earliest employmentDate first; ties broken by _id. Active crew come
 * before non-active so active numbers stay contiguous at the top.
 *
 * Run:  pnpm --filter server exec tsx src/reseed-seniority.ts
 */
import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { CrewMember } from './models/CrewMember.js'

async function main() {
  console.log('Connecting to Mongo…')
  await connectDB(env.MONGODB_URI)

  const operatorId = process.env.SEED_OPERATOR_ID ?? (await Operator.findOne({ isActive: { $ne: false } }).lean())?._id
  if (!operatorId) {
    console.error('No operator found.')
    process.exit(1)
  }
  console.log(`Operator: ${operatorId}`)

  const crew = await CrewMember.find({ operatorId }, { _id: 1, employmentDate: 1, status: 1, seniority: 1 }).lean()

  // Active first, then by employmentDate asc, then _id.
  crew.sort((a, b) => {
    const activeA = a.status === 'active' ? 0 : 1
    const activeB = b.status === 'active' ? 0 : 1
    if (activeA !== activeB) return activeA - activeB
    const dA = (a.employmentDate as string) ?? '9999-12-31'
    const dB = (b.employmentDate as string) ?? '9999-12-31'
    if (dA !== dB) return dA.localeCompare(dB)
    return (a._id as string).localeCompare(b._id as string)
  })

  const now = new Date().toISOString()
  const ops: Array<{ updateOne: { filter: { _id: string }; update: { $set: Record<string, unknown> } } }> = []
  crew.forEach((c, i) => {
    const newSen = i + 1
    if (c.seniority === newSen) return
    ops.push({
      updateOne: {
        filter: { _id: c._id as string },
        update: { $set: { seniority: newSen, updatedAt: now } },
      },
    })
  })

  console.log(`${ops.length} of ${crew.length} crew need seniority update.`)
  for (let i = 0; i < ops.length; i += 500) {
    const res = await CrewMember.bulkWrite(ops.slice(i, i + 500), { ordered: false })
    console.log(`  batch ${i / 500 + 1}: modified=${res.modifiedCount}`)
  }

  // Sanity check
  const dupes = await CrewMember.aggregate([
    { $match: { operatorId } },
    { $group: { _id: '$seniority', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ])
  console.log('─────────────────────────────────────────────')
  console.log(`  Seniority reseed complete (1..${crew.length}).  Duplicate check: ${dupes.length} collisions.`)
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
