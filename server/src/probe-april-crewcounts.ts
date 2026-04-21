import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Pairing } from './models/Pairing.js'

const OPERATOR = '20169cc0-c914-4662-a300-1dbbe20d1416'

async function main() {
  await connectDB(env.MONGODB_URI)
  const april = await Pairing.find({
    operatorId: OPERATOR,
    scenarioId: { $in: [null, undefined] },
    startDate: { $regex: '^2026-04-' },
  }).lean()

  console.log(`April production pairings: ${april.length}`)
  let withCounts = 0
  let empty = 0
  const seatTotals = new Map<string, number>()
  for (const p of april) {
    const c = (p as unknown as { crewCounts?: Record<string, number> | null }).crewCounts
    if (!c || Object.keys(c).length === 0) {
      empty += 1
      continue
    }
    withCounts += 1
    for (const [k, v] of Object.entries(c)) {
      seatTotals.set(k, (seatTotals.get(k) ?? 0) + (v as number))
    }
  }
  console.log(`  with populated crewCounts: ${withCounts}`)
  console.log(`  empty / null crewCounts:   ${empty}`)
  console.log(`  seat totals across month:`)
  for (const [k, v] of [...seatTotals.entries()].sort()) console.log(`    ${k}: ${v}`)

  // Mid-month (days 10-20) with populated crewCounts
  const mid = april.filter((p) => {
    const d = parseInt(p.startDate.slice(8, 10), 10)
    const c = (p as unknown as { crewCounts?: Record<string, number> | null }).crewCounts
    return d >= 10 && d <= 20 && c && Object.keys(c).length > 0
  })
  console.log(`\nMid-April (days 10-20) with seats:  ${mid.length}`)
  for (const p of mid.slice(0, 15)) {
    console.log(
      `  ${p.startDate}  ${p.pairingCode.padEnd(10)}  ${JSON.stringify((p as unknown as { crewCounts?: Record<string, number> }).crewCounts)}`,
    )
  }
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
