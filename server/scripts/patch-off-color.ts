import 'dotenv/config'
import mongoose from 'mongoose'
import { ActivityCode } from '../src/models/ActivityCode'

const OPERATOR_ID = '20169cc0-c914-4662-a300-1dbbe20d1416'
const NEW_COLOR = '#0063F7'

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri)
  const res = await ActivityCode.updateOne(
    { operatorId: OPERATOR_ID, code: 'OFF', isSystem: true },
    { $set: { color: NEW_COLOR, updatedAt: new Date().toISOString() } },
  )
  console.log('matched:', res.matchedCount, 'modified:', res.modifiedCount)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
