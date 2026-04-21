import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { CrewPosition } from './models/CrewPosition.js'
import { ActivityCode } from './models/ActivityCode.js'
import { ExpiryCode } from './models/ExpiryCode.js'

async function main() {
  const codes = process.argv.slice(2).map((c) => c.trim().toUpperCase())
  if (codes.length === 0) {
    console.error('Provide codes to probe')
    process.exit(1)
  }
  await connectDB(env.MONGODB_URI)

  for (const Model of [CrewPosition, ActivityCode, ExpiryCode] as const) {
    const name = Model.modelName
    const docs = await Model.find({ code: { $in: codes } }).lean()
    console.log(`\n[${name}] ${docs.length} match(es):`)
    for (const d of docs) {
      console.log(
        `  operatorId=${d.operatorId}  code=${(d as { code?: string }).code}  name=${(d as { name?: string }).name}  _id=${d._id}`,
      )
    }
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
