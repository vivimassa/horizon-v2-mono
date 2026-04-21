/**
 * Idempotent seed: ensures every CrewMember has one primary Mobile phone.
 * Skips crew that already have a phone row.
 *
 * Run:  pnpm --filter server exec tsx src/seed-crew-phones.ts
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { CrewMember } from './models/CrewMember.js'
import { CrewPhone } from './models/CrewPhone.js'

function hashInt(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h | 0)
}

function phoneFor(nat: string | null | undefined, seed: number): string {
  const n = (seed % 9000000) + 1000000
  switch ((nat ?? '').toUpperCase()) {
    case 'VNM':
    case 'VN':
      return `+84 9${String(seed % 100).padStart(2, '0')} ${String(n).slice(0, 3)} ${String(n).slice(3)}`
    case 'USA':
    case 'US':
      return `+1 (415) ${String(n).slice(0, 3)}-${String(n).slice(3)}`
    case 'GBR':
    case 'GB':
      return `+44 20 ${String(n).slice(0, 4)} ${String(n).slice(4)}`
    case 'THA':
    case 'TH':
      return `+66 8${String(seed % 10)} ${String(n).slice(0, 3)} ${String(n).slice(3)}`
    case 'RUS':
    case 'RU':
      return `+7 9${String(seed % 100).padStart(2, '0')} ${String(n).slice(0, 3)}-${String(n).slice(3, 5)}-${String(n).slice(5)}`
    default:
      return `+1 (415) ${String(n).slice(0, 3)}-${String(n).slice(3)}`
  }
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

  const crew = await CrewMember.find({ operatorId }, { _id: 1, employeeId: 1, nationality: 1 }).lean()
  const existing = await CrewPhone.find(
    { operatorId, crewId: { $in: crew.map((c) => c._id as string) } },
    { crewId: 1 },
  ).lean()
  const hasPhone = new Set(existing.map((p) => p.crewId))
  console.log(`${hasPhone.size} of ${crew.length} crew already have a phone — skipping.`)

  const now = new Date().toISOString()
  const docs: Array<Record<string, unknown>> = []
  for (const c of crew) {
    if (hasPhone.has(c._id as string)) continue
    const seed = hashInt(String(c.employeeId ?? c._id))
    docs.push({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: c._id,
      priority: 1,
      type: 'Mobile',
      number: phoneFor(c.nationality as string | null, seed),
      smsEnabled: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  console.log(`Inserting ${docs.length} phones in batches of 500…`)
  for (let i = 0; i < docs.length; i += 500) {
    const slice = docs.slice(i, i + 500)
    await CrewPhone.insertMany(slice, { ordered: false })
    console.log(`  batch ${i / 500 + 1}: +${slice.length}`)
  }

  console.log('─────────────────────────────────────────────')
  console.log(`  Phone seed complete: ${docs.length} inserted`)
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
