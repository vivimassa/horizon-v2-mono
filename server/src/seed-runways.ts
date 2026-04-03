/**
 * Seed runway data for all existing airports.
 * Uses OurAirports open data (CSV) — covers 28k+ airports worldwide.
 *
 * Usage: npx tsx src/seed-runways.ts
 */

import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { Airport } from './models/Airport.js'

import 'dotenv/config'
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/horizon'

// OurAirports CSV URLs
const AIRPORTS_CSV = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const RUNWAYS_CSV = 'https://davidmegginson.github.io/ourairports-data/runways.csv'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += ch
    }
    values.push(current.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
    return obj
  })
}

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  // 1. Fetch OurAirports data
  console.log('Fetching OurAirports airports CSV…')
  const airportsCsvRes = await fetch(AIRPORTS_CSV)
  const airportsCsv = parseCSV(await airportsCsvRes.text())
  console.log(`  Parsed ${airportsCsv.length} airports from OurAirports`)

  // Build ICAO → OurAirports ID map
  const icaoToOaId = new Map<string, string>()
  for (const row of airportsCsv) {
    if (row.ident) icaoToOaId.set(row.ident, row.id)
  }

  console.log('Fetching OurAirports runways CSV…')
  const runwaysCsvRes = await fetch(RUNWAYS_CSV)
  const runwaysCsv = parseCSV(await runwaysCsvRes.text())
  console.log(`  Parsed ${runwaysCsv.length} runways from OurAirports`)

  // Group runways by airport_ref (OurAirports ID)
  const oaIdToRunways = new Map<string, typeof runwaysCsv>()
  for (const row of runwaysCsv) {
    const id = row.airport_ref
    if (!id) continue
    const arr = oaIdToRunways.get(id)
    if (arr) arr.push(row)
    else oaIdToRunways.set(id, [row])
  }

  // 2. Update airports in DB
  const airports = await Airport.find({ isActive: true }).sort({ icaoCode: 1 }).lean()
  console.log(`\nFound ${airports.length} active airports in DB`)

  let updated = 0
  let skipped = 0
  let noData = 0

  for (const airport of airports) {
    const existing = (airport as any).runways ?? []
    if (existing.length > 0) {
      console.log(`  SKIP ${airport.icaoCode} — already has ${existing.length} runways`)
      skipped++
      continue
    }

    const oaId = icaoToOaId.get(airport.icaoCode)
    const rawRunways = oaId ? oaIdToRunways.get(oaId) : undefined

    if (!rawRunways || rawRunways.length === 0) {
      console.log(`  MISS ${airport.icaoCode} — no runway data in OurAirports`)
      noData++
      continue
    }

    const runways = rawRunways.map(r => {
      const lengthFt = Number(r.length_ft) || null
      const widthFt = Number(r.width_ft) || null
      const leIdent = r.le_ident || ''
      const heIdent = r.he_ident || ''
      const identifier = leIdent && heIdent ? `${leIdent}/${heIdent}` : leIdent || heIdent || 'Unknown'

      return {
        _id: crypto.randomUUID(),
        identifier,
        lengthM: lengthFt ? Math.round(lengthFt * 0.3048) : null,
        lengthFt,
        widthM: widthFt ? Math.round(widthFt * 0.3048) : null,
        widthFt,
        surface: r.surface || null,
        ilsCategory: null,
        lighting: r.lighted === '1',
        status: r.closed === '1' ? 'closed' : 'active',
        notes: null,
      }
    })

    const active = runways.filter(r => r.status !== 'closed')
    const longestFt = active.reduce((max, r) => {
      const ft = r.lengthFt ?? 0
      return ft > max ? ft : max
    }, 0)

    await Airport.findByIdAndUpdate(airport._id, {
      $set: {
        runways,
        numberOfRunways: active.length,
        longestRunwayFt: longestFt || null,
      },
    })

    const ids = runways.map(r => r.identifier).join(', ')
    console.log(`  OK   ${airport.icaoCode} — ${runways.length} runways: ${ids}`)
    updated++
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, No data: ${noData}`)
  await mongoose.disconnect()
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
