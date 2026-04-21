/**
 * Seeds CrewExpiryDate rows for every crew, one per applicable ExpiryCode
 * (and per aircraft type when the code is scoped to family/variant), with
 * an expiryDate chosen from a deterministic distribution:
 *
 *   - 5%  EXPIRED       →  2025-10-21 .. 2026-04-20  (last ~6 months)
 *   - 15% SOON-TO-EXPIRE →  2026-04-22 .. 2026-06-30 (end April / May / June)
 *   - 80% VALID         →  2026-10-01 .. 2028-04-21  (6..24 months out)
 *
 * Applies the same filtering as services/sync-crew-expiries.ts:
 *   - crewCategory respected only when set to 'cockpit'/'cabin'
 *   - applicablePositions checked against the crew's position
 *   - acTypeScope === 'none' → one row with aircraftType = ''
 *   - acTypeScope === 'family'|'variant' → one row per crew aircraft type
 *
 * Idempotent: skips rows that already exist for (crewId, expiryCodeId,
 * aircraftType) so existing manual overrides are preserved.
 *
 * Run:  pnpm --filter server exec tsx src/seed-crew-expiries.ts
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { CrewMember } from './models/CrewMember.js'
import { CrewQualification } from './models/CrewQualification.js'
import { CrewPosition } from './models/CrewPosition.js'
import { CrewExpiryDate } from './models/CrewExpiryDate.js'
import { ExpiryCode } from './models/ExpiryCode.js'

// Today = 2026-04-21 per project clock.
const TODAY = new Date('2026-04-21T00:00:00Z')
const MS_DAY = 86_400_000

function hashInt(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h | 0)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Pick expiryDate from a seeded bucket: 5% expired, 15% soon, 80% valid. */
function pickExpiryDate(seed: number): string {
  const bucket = seed % 100
  if (bucket < 5) {
    // EXPIRED: 1..180 days before today
    const days = 1 + (seed % 180)
    return isoDate(new Date(TODAY.getTime() - days * MS_DAY))
  }
  if (bucket < 20) {
    // SOON: 1..70 days after today (covers rest of April, May, June)
    const days = 1 + (seed % 70)
    return isoDate(new Date(TODAY.getTime() + days * MS_DAY))
  }
  // VALID: 163..900 days after today (~5.5..29 months)
  const days = 163 + (seed % 738)
  return isoDate(new Date(TODAY.getTime() + days * MS_DAY))
}

type Code = {
  _id: string
  crewCategory?: string | null
  applicablePositions?: string[] | null
  acTypeScope?: string | null
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

  const [codesRaw, crew, quals, positions, existingRows] = await Promise.all([
    ExpiryCode.find({ operatorId, isActive: true }).lean(),
    CrewMember.find({ operatorId }, { _id: 1, employeeId: 1, position: 1 }).lean(),
    CrewQualification.find({ operatorId }, { crewId: 1, aircraftType: 1 }).lean(),
    CrewPosition.find({ operatorId }, { _id: 1, code: 1, category: 1 }).lean(),
    CrewExpiryDate.find({ operatorId }, { crewId: 1, expiryCodeId: 1, aircraftType: 1 }).lean(),
  ])
  const codes = codesRaw as Code[]
  console.log(
    `Codes: ${codes.length}  Crew: ${crew.length}  Quals: ${quals.length}  Existing rows: ${existingRows.length}`,
  )

  // Position → category (cockpit/cabin) for crewCategory filter.
  const posCat = new Map<string, string>()
  for (const p of positions) {
    const cat = (p as { category?: string }).category
    if (cat) posCat.set(p._id as string, cat)
  }

  // crewId → aircraft types
  const acByCrew = new Map<string, Set<string>>()
  for (const q of quals) {
    const s = acByCrew.get(q.crewId as string) ?? new Set<string>()
    if (q.aircraftType) s.add(q.aircraftType as string)
    acByCrew.set(q.crewId as string, s)
  }

  // Existing row keys so we skip duplicates.
  const existingKey = new Set<string>()
  for (const r of existingRows) {
    existingKey.add(`${r.crewId}::${r.expiryCodeId}::${r.aircraftType ?? ''}`)
  }

  const now = new Date().toISOString()
  const docs: Array<Record<string, unknown>> = []

  for (const c of crew) {
    const crewId = c._id as string
    const posId = c.position as string | null
    const crewAc = acByCrew.get(crewId) ?? new Set<string>()
    const crewCat = posId ? posCat.get(posId) : undefined

    for (const code of codes) {
      if (code.crewCategory === 'cockpit' && crewCat && crewCat !== 'cockpit') continue
      if (code.crewCategory === 'cabin' && crewCat && crewCat !== 'cabin') continue
      const appliesPos =
        !code.applicablePositions ||
        code.applicablePositions.length === 0 ||
        (typeof posId === 'string' && code.applicablePositions.includes(posId))
      if (!appliesPos) continue

      const rows: string[] = code.acTypeScope === 'none' || crewAc.size === 0 ? [''] : Array.from(crewAc)
      for (const acType of rows) {
        const k = `${crewId}::${code._id}::${acType}`
        if (existingKey.has(k)) continue
        const seed = hashInt(k)
        const expiryDate = pickExpiryDate(seed)
        docs.push({
          _id: crypto.randomUUID(),
          operatorId,
          crewId,
          expiryCodeId: code._id,
          aircraftType: acType,
          lastDone: null,
          baseMonth: null,
          expiryDate,
          nextPlanned: null,
          notes: null,
          isManualOverride: false,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
  }

  console.log(`Inserting ${docs.length} expiry rows in batches of 1000…`)
  let expiredCount = 0
  let soonCount = 0
  let validCount = 0
  const todayIso = isoDate(TODAY)
  const soonCutoff = '2026-06-30'
  for (const d of docs) {
    const exp = d.expiryDate as string
    if (exp < todayIso) expiredCount++
    else if (exp <= soonCutoff) soonCount++
    else validCount++
  }

  for (let i = 0; i < docs.length; i += 1000) {
    const slice = docs.slice(i, i + 1000)
    await CrewExpiryDate.insertMany(slice, { ordered: false })
    console.log(`  batch ${i / 1000 + 1}: +${slice.length}`)
  }

  console.log('─────────────────────────────────────────────')
  console.log(`  Expiry seed complete: ${docs.length} rows inserted`)
  console.log(`  Expired: ${expiredCount}  (${((expiredCount * 100) / docs.length).toFixed(1)}%)`)
  console.log(`  Soon   : ${soonCount}  (${((soonCount * 100) / docs.length).toFixed(1)}%)`)
  console.log(`  Valid  : ${validCount}  (${((validCount * 100) / docs.length).toFixed(1)}%)`)
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
