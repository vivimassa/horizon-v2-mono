import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { AircraftType } from './models/AircraftType.js'
import { AircraftRegistration } from './models/AircraftRegistration.js'
import { CrewComplement } from './models/CrewComplement.js'
import { Operator } from './models/Operator.js'
import { CrewPosition } from './models/CrewPosition.js'

async function main() {
  await connectDB(env.MONGODB_URI)
  const operatorId = process.env.SEED_OPERATOR_ID ?? (await Operator.findOne({ isActive: { $ne: false } }).lean())?._id
  console.log(`Operator: ${operatorId}\n`)

  const types = await AircraftType.find({ operatorId, isActive: { $ne: false } }).lean()
  console.log(`Aircraft types: ${types.length}`)
  for (const t of types) {
    const regs = await AircraftRegistration.countDocuments({ operatorId, aircraftTypeId: t._id })
    console.log(`  ${t.icaoType ?? '??'}  ${t.displayName ?? t.name ?? ''}  — ${regs} registrations`)
  }

  console.log(`\nCrew positions:`)
  const positions = await CrewPosition.find({ operatorId }).sort({ category: 1, rankOrder: 1 }).lean()
  for (const p of positions) console.log(`  ${p.code}  ${p.name}  [${p.category}]  rank ${p.rankOrder}`)

  console.log(`\nCrew complements (5.4.4):`)
  const complements = await CrewComplement.find({ operatorId }).lean()
  for (const c of complements) {
    const t = types.find((x) => x._id === c.aircraftTypeId)
    console.log(`  ${t?.icaoType ?? c.aircraftTypeId}  ${JSON.stringify(c.counts ?? {})}`)
  }
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
