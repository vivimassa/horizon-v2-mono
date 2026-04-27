import 'dotenv/config'
import mongoose from 'mongoose'
import { AutoRosterRun } from './models/AutoRosterRun.js'

async function main() {
  const runId = process.argv[2]
  if (!runId) {
    console.error('usage: tsx src/force-cancel-run.ts <runId>')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGODB_URI!)
  const r = await AutoRosterRun.updateOne(
    { _id: runId },
    {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: 'Cancelled via CLI (UI cancel was unresponsive)',
    },
  )
  console.log(`updated: matched=${r.matchedCount} modified=${r.modifiedCount}`)
  const doc = await AutoRosterRun.findById(runId).lean()
  console.log('status now:', (doc as { status?: string } | null)?.status)
  await mongoose.disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
