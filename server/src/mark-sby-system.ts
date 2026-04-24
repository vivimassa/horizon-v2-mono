// One-shot: normalize SBY activity code for auto-roster solver use.
// - Moves SBY into SYS group
// - Sets isSystem: true (locks from user edits)
// - Sets flag is_home_standby
// - Sets defaultDurationMin: 480 (8h)
// - Clears fixed start/end times (solver governs from config)
//
// Usage:
//   tsx src/mark-sby-system.ts <operatorId>

import 'dotenv/config'
import mongoose from 'mongoose'
import { ActivityCode, ActivityCodeGroup } from './models/ActivityCode.js'

async function main() {
  const [operatorId] = process.argv.slice(2)
  if (!operatorId) {
    console.error('Missing operatorId')
    process.exit(1)
  }
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set')
    process.exit(1)
  }
  await mongoose.connect(uri)

  const sysGroup = await ActivityCodeGroup.findOne({ operatorId, code: 'SYS' }).lean()
  if (!sysGroup) {
    console.error('SYS group not found for operator — seed activity codes first')
    process.exit(1)
  }

  const res = await ActivityCode.updateOne(
    { operatorId, code: 'SBY' },
    {
      $set: {
        groupId: sysGroup._id,
        isSystem: true,
        flags: ['is_home_standby'],
        defaultDurationMin: 480,
        defaultStartTime: null,
        defaultEndTime: null,
        requiresTime: false,
        updatedAt: new Date().toISOString(),
      },
    },
  )
  console.log(`matched=${res.matchedCount} modified=${res.modifiedCount} group=SYS(${sysGroup._id})`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
