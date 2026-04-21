import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { FdtlScheme } from './models/FdtlScheme.js'
import { FdtlRule } from './models/FdtlRule.js'
import { FdtlTable } from './models/FdtlTable.js'

async function main() {
  await connectDB(env.MONGODB_URI)
  const all = await FdtlScheme.find({}).lean()
  console.log(`FdtlScheme documents: ${all.length}`)
  for (const s of all) {
    console.log(
      `  operatorId=${s.operatorId}  framework=${s.frameworkCode}  report=${s.reportTimeMinutes}min  post=${s.postFlightMinutes}min  debrief=${s.debriefMinutes}min`,
    )
  }
  const OP = '20169cc0-c914-4662-a300-1dbbe20d1416'
  const rulesForOp = await FdtlRule.countDocuments({ operatorId: OP })
  const tablesForOp = await FdtlTable.countDocuments({ operatorId: OP })
  console.log(`\nOperator ${OP}:`)
  console.log(`  rules:  ${rulesForOp}`)
  console.log(`  tables: ${tablesForOp}`)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
