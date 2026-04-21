/**
 * Idempotent seed: ensures every CrewMember has exactly one active passport.
 *
 * Strategy:
 *   - If the crew already has an active passport row, skip.
 *   - Otherwise insert one with deterministic number/dates derived from the
 *     crew's employeeId, so re-running yields the same synthetic record.
 *
 * Fields populated on CrewPassport:
 *   - number, country, nationality, placeOfIssue, issueDate, expiry, isActive
 *
 * Run:  pnpm --filter server exec tsx src/seed-crew-passports.ts
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { CrewMember } from './models/CrewMember.js'
import { CrewPassport } from './models/CrewPassport.js'

const PLACE_OF_ISSUE: Record<string, string> = {
  VN: 'Ho Chi Minh City',
  US: 'New York',
  GB: 'London',
  TH: 'Bangkok',
  RU: 'Moscow',
  ES: 'Madrid',
  IT: 'Rome',
  BR: 'Sao Paulo',
  DE: 'Berlin',
  FR: 'Paris',
}

function hashInt(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h | 0)
}

function addYearsIso(iso: string, years: number): string {
  const d = new Date(iso)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

function issueDateFor(seed: number): string {
  // Any date in the last ~6 years so expiry (issue + 10y) is always in the future.
  const today = new Date()
  const daysBack = seed % (6 * 365)
  const d = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function passportNumberFor(country: string, employeeId: string | number): string {
  // Common country prefix letter + 8-digit ID, zero-padded.
  const prefix = (country || 'X').slice(0, 1).toUpperCase()
  return `${prefix}${String(employeeId).padStart(8, '0')}`
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
  console.log(`Found ${crew.length} crew.`)

  // Find crew that already have an active passport — skip those.
  const activePassports = await CrewPassport.find(
    { operatorId, isActive: true, crewId: { $in: crew.map((c) => c._id as string) } },
    { crewId: 1 },
  ).lean()
  const hasActive = new Set(activePassports.map((p) => p.crewId))
  console.log(`${hasActive.size} crew already have an active passport — skipping.`)

  const now = new Date().toISOString()
  const docs: Array<Record<string, unknown>> = []

  for (const c of crew) {
    if (hasActive.has(c._id as string)) continue
    const nat = (c.nationality as string) || 'VN'
    const seed = hashInt(String(c.employeeId ?? c._id))
    const issueDate = issueDateFor(seed)
    docs.push({
      _id: crypto.randomUUID(),
      operatorId,
      crewId: c._id,
      number: passportNumberFor(nat, c.employeeId as string),
      country: nat,
      nationality: nat,
      placeOfIssue: PLACE_OF_ISSUE[nat] ?? PLACE_OF_ISSUE.VN,
      issueDate,
      expiry: addYearsIso(issueDate, 10),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  console.log(`Inserting ${docs.length} passports in batches of 500…`)
  for (let i = 0; i < docs.length; i += 500) {
    const slice = docs.slice(i, i + 500)
    await CrewPassport.insertMany(slice, { ordered: false })
    console.log(`  batch ${i / 500 + 1}: +${slice.length}`)
  }

  console.log('─────────────────────────────────────────────')
  console.log(`  Passport seed complete: ${docs.length} inserted, ${hasActive.size} preserved`)
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
