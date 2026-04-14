/**
 * Airport lookup by IATA code, using the public OurAirports dataset as
 * source of truth. Used by SSIM Import to auto-create missing airports
 * when the SSIM file references stations the operator hasn't configured.
 *
 * Ported from V1 (app/actions/airport-inquiry.ts:lookupAirportByIATA).
 *
 * The dataset is cached on disk so repeated imports don't hammer GitHub.
 * Cache lives at process.cwd() + '/.cache/ourairports/airports.csv' and is
 * considered fresh for 24 hours.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const AIRPORTS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv'
const CACHE_DIR = path.join(process.cwd(), '.cache', 'ourairports')
const CACHE_FILE = path.join(CACHE_DIR, 'airports.csv')
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface AirportLookupResult {
  iataCode: string
  icaoCode: string | null
  name: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  elevationFt: number | null
  type: string | null
}

/** Standards-compliant CSV line parser (handles quoted fields with embedded commas). */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') {
        out.push(cur.trim())
        cur = ''
      } else cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

async function getAirportsCsv(): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  if (fs.existsSync(CACHE_FILE)) {
    const ageMs = Date.now() - fs.statSync(CACHE_FILE).mtimeMs
    if (ageMs < CACHE_TTL_MS) return fs.readFileSync(CACHE_FILE, 'utf-8')
  }
  const res = await fetch(AIRPORTS_URL)
  if (!res.ok) throw new Error(`OurAirports fetch failed: ${res.status} ${res.statusText}`)
  const text = await res.text()
  try {
    fs.writeFileSync(CACHE_FILE, text)
  } catch {
    // Cache write is best-effort; non-fatal on read-only filesystems.
  }
  return text
}

/**
 * Return basic information about the airport with the given IATA code, or
 * null if not found. Case-insensitive; accepts 3-character IATA codes only.
 */
export async function lookupAirportByIata(iata: string): Promise<AirportLookupResult | null> {
  const code = iata.toUpperCase().trim()
  if (code.length !== 3) return null

  const csv = await getAirportsCsv()
  const lines = csv.split('\n')
  if (lines.length < 2) return null
  const headers = parseCsvLine(lines[0])
  const idx = (name: string) => headers.indexOf(name)

  const iataIdx = idx('iata_code')
  if (iataIdx < 0) return null

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw || !raw.includes(code)) continue
    const cols = parseCsvLine(raw)
    if (cols[iataIdx] !== code) continue
    const num = (key: string): number | null => {
      const v = cols[idx(key)]
      if (!v) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    return {
      iataCode: code,
      icaoCode: cols[idx('ident')] || null,
      name: cols[idx('name')] || null,
      city: cols[idx('municipality')] || null,
      country: cols[idx('iso_country')] || null,
      latitude: num('latitude_deg'),
      longitude: num('longitude_deg'),
      elevationFt: num('elevation_ft'),
      type: cols[idx('type')] || null,
    }
  }
  return null
}
