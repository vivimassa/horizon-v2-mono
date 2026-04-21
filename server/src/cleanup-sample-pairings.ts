import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'
import { CrewAssignment } from './models/CrewAssignment.js'

async function main() {
  await connectDB(env.MONGODB_URI)
  const samples = await Pairing.find({ pairingCode: { $regex: '^__sample__' } }).lean()
  const ids = samples.map((p) => p._id as string)
  console.log(`Sample pairings: ${ids.length}`)
  const asmtRes = await CrewAssignment.deleteMany({ pairingId: { $in: ids } })
  console.log(`Deleted assignments: ${asmtRes.deletedCount}`)
  const pRes = await Pairing.deleteMany({ _id: { $in: ids } })
  console.log(`Deleted pairings:    ${pRes.deletedCount}`)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
