import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { CrewComplement } from './models/CrewComplement.js'
import { Pairing } from './models/Pairing.js'

const OPERATOR = '20169cc0-c914-4662-a300-1dbbe20d1416'

async function main() {
  await connectDB(env.MONGODB_URI)
  const comps = await CrewComplement.find({ operatorId: OPERATOR }).lean()
  console.log(`CrewComplement rows: ${comps.length}`)
  for (const c of comps) {
    const counts = c.counts instanceof Map ? Object.fromEntries(c.counts) : c.counts
    console.log(`  ${c.aircraftTypeIcao} / ${c.templateKey}  active=${c.isActive}  ${JSON.stringify(counts)}`)
  }

  const types = await Pairing.distinct('aircraftTypeIcao', {
    operatorId: OPERATOR,
    scenarioId: { $in: [null, undefined] },
    startDate: { $regex: '^2026-04-' },
  })
  console.log(`\nApril pairing aircraft types: ${JSON.stringify(types)}`)

  const keys = await Pairing.distinct('complementKey', {
    operatorId: OPERATOR,
    scenarioId: { $in: [null, undefined] },
    startDate: { $regex: '^2026-04-' },
  })
  console.log(`April pairing complementKeys: ${JSON.stringify(keys)}`)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
