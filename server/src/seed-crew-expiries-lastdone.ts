/**
 * Fills in `lastDone` on every CrewExpiryDate row that has an expiryDate but
 * no lastDone. Rule:
 *   - fixed_validity with validity_months → lastDone = expiryDate − validity_months
 *   - otherwise                           → lastDone = expiryDate − 12 months
 *
 * Skips manual overrides. Idempotent.
 *
 * Run:  pnpm --filter server exec tsx src/seed-crew-expiries-lastdone.ts
 */
import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { CrewExpiryDate } from './models/CrewExpiryDate.js'
import { ExpiryCode } from './models/ExpiryCode.js'

function subMonthsIso(iso: string, months: number): string {
  const d = new Date(iso)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

async function main() {
  console.log('Connecting to Mongo…')
  await connectDB(env.MONGODB_URI)

  const operatorId = process.env.SEED_OPERATOR_ID ?? (await Operator.findOne({ isActive: { $ne: false } }).lean())?._id
  if (!operatorId) {
    console.error('No operator found.')
    process.exit(1)
  }
  console.log(`Operator: ${operatorId}`)

  const codes = await ExpiryCode.find({ operatorId }, { _id: 1, formula: 1, formulaParams: 1 }).lean()
  const validityByCode = new Map<string, number>()
  for (const c of codes) {
    const months = Number((c.formulaParams as Record<string, unknown>)?.validity_months ?? 0)
    validityByCode.set(c._id as string, c.formula === 'fixed_validity' && months > 0 ? months : 12)
  }

  const rows = await CrewExpiryDate.find(
    { operatorId, expiryDate: { $ne: null }, isManualOverride: { $ne: true } },
    { _id: 1, expiryCodeId: 1, expiryDate: 1, lastDone: 1 },
  ).lean()
  console.log(`Found ${rows.length} rows with expiryDate.`)

  const now = new Date().toISOString()
  const ops: Array<{ updateOne: { filter: { _id: string }; update: { $set: Record<string, unknown> } } }> = []
  for (const r of rows) {
    if (r.lastDone) continue
    const months = validityByCode.get(r.expiryCodeId as string) ?? 12
    const lastDone = subMonthsIso(r.expiryDate as string, months)
    ops.push({
      updateOne: {
        filter: { _id: r._id as string },
        update: { $set: { lastDone, updatedAt: now } },
      },
    })
  }

  console.log(`${ops.length} rows need lastDone. Writing in batches of 1000…`)
  for (let i = 0; i < ops.length; i += 1000) {
    const res = await CrewExpiryDate.bulkWrite(ops.slice(i, i + 1000), { ordered: false })
    console.log(`  batch ${i / 1000 + 1}: modified=${res.modifiedCount}`)
  }

  console.log('─────────────────────────────────────────────')
  console.log(`  lastDone seed complete: ${ops.length} rows updated`)
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
