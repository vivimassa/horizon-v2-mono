import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'

async function main() {
  await connectDB(env.MONGODB_URI)
  const all = await Pairing.find({}).lean()
  console.log(`Total pairings (any operator / any scenario): ${all.length}`)

  const operators = [...new Set(all.map((p) => p.operatorId))]
  console.log(`Distinct operatorIds: ${operators.length}`)
  for (const op of operators) console.log(`  ${op}`)

  const scenarios = [...new Set(all.map((p) => p.scenarioId ?? '(null)'))]
  console.log(`Distinct scenarioIds: ${scenarios.length}`)
  for (const s of scenarios) {
    const n = all.filter((p) => (p.scenarioId ?? '(null)') === s).length
    console.log(`  ${s}  — ${n} pairing(s)`)
  }

  // Month breakdown
  const byMonth = new Map<string, number>()
  for (const p of all) {
    const key = p.startDate.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
  }
  console.log('\nPairings by startDate month:')
  for (const [k, v] of [...byMonth.entries()].sort()) console.log(`  ${k}  ${v}`)

  // April 2026 detail
  const april = all.filter((p) => p.startDate.startsWith('2026-04-'))
  console.log(`\nApril 2026 pairings: ${april.length}`)
  const aprilByDay = new Map<string, number>()
  for (const p of april) {
    const day = p.startDate.slice(8, 10)
    aprilByDay.set(day, (aprilByDay.get(day) ?? 0) + 1)
  }
  for (const [day, n] of [...aprilByDay.entries()].sort()) console.log(`  Apr ${day}:  ${n}`)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
