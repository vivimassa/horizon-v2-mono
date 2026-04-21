/**
 * One-shot migration: convert 2-letter country codes to ISO-3 (3-letter) on
 * CrewMember.{nationality,addressCountry} and CrewPassport.{country,nationality}.
 *
 * Safe to re-run — already-3-letter values are left alone.
 */
import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { CrewMember } from './models/CrewMember.js'
import { CrewPassport } from './models/CrewPassport.js'

const ISO2_TO_ISO3: Record<string, string> = {
  VN: 'VNM',
  US: 'USA',
  GB: 'GBR',
  TH: 'THA',
  RU: 'RUS',
  ES: 'ESP',
  IT: 'ITA',
  BR: 'BRA',
  DE: 'DEU',
  FR: 'FRA',
}

function convert(v: string | null | undefined): string | null {
  if (!v) return null
  if (v.length === 3) return v.toUpperCase()
  const up = v.toUpperCase()
  return ISO2_TO_ISO3[up] ?? up
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

  // ─── CrewMember ───────────────────────────────────────────────────────────
  const crew = await CrewMember.find({ operatorId }, { _id: 1, nationality: 1, addressCountry: 1 }).lean()
  const now = new Date().toISOString()

  const crewOps: Array<{ updateOne: { filter: { _id: string }; update: { $set: Record<string, unknown> } } }> = []
  for (const c of crew) {
    const nat = convert(c.nationality as string | null)
    const country = convert(c.addressCountry as string | null)
    const set: Record<string, unknown> = {}
    if (nat && nat !== c.nationality) set.nationality = nat
    if (country && country !== c.addressCountry) set.addressCountry = country
    if (Object.keys(set).length === 0) continue
    set.updatedAt = now
    crewOps.push({ updateOne: { filter: { _id: c._id as string }, update: { $set: set } } })
  }
  console.log(`CrewMember: ${crewOps.length} of ${crew.length} to update.`)
  for (let i = 0; i < crewOps.length; i += 500) {
    const res = await CrewMember.bulkWrite(crewOps.slice(i, i + 500), { ordered: false })
    console.log(`  crew batch ${i / 500 + 1}: modified=${res.modifiedCount}`)
  }

  // ─── CrewPassport ─────────────────────────────────────────────────────────
  const passports = await CrewPassport.find({ operatorId }, { _id: 1, country: 1, nationality: 1 }).lean()
  const ppOps: Array<{ updateOne: { filter: { _id: string }; update: { $set: Record<string, unknown> } } }> = []
  for (const p of passports) {
    const country = convert(p.country as string | null)
    const nat = convert(p.nationality as string | null)
    const set: Record<string, unknown> = {}
    if (country && country !== p.country) set.country = country
    if (nat && nat !== p.nationality) set.nationality = nat
    if (Object.keys(set).length === 0) continue
    set.updatedAt = now
    ppOps.push({ updateOne: { filter: { _id: p._id as string }, update: { $set: set } } })
  }
  console.log(`CrewPassport: ${ppOps.length} of ${passports.length} to update.`)
  for (let i = 0; i < ppOps.length; i += 500) {
    const res = await CrewPassport.bulkWrite(ppOps.slice(i, i + 500), { ordered: false })
    console.log(`  passport batch ${i / 500 + 1}: modified=${res.modifiedCount}`)
  }

  console.log('─────────────────────────────────────────────')
  console.log(`  ISO-3 migration complete`)
  console.log('─────────────────────────────────────────────')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
