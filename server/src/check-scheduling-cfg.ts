import 'dotenv/config'
import mongoose from 'mongoose'
import { OperatorSchedulingConfig } from './models/OperatorSchedulingConfig.js'

const OPID = '20169cc0-c914-4662-a300-1dbbe20d1416'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  const doc = await OperatorSchedulingConfig.findOne({ operatorId: OPID }).lean()
  console.log(JSON.stringify(doc, null, 2))
  await mongoose.disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
