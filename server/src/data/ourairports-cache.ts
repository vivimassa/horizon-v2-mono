/**
 * OurAirports in-memory data cache.
 * Fetches airports.csv + runways.csv on server startup and builds ICAO lookup indexes.
 * Refreshes every 24 hours.
 */

const AIRPORTS_CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const RUNWAYS_CSV_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv'
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24h

export interface OARunway {
  identifier: string
  lengthFt: number | null
  lengthM: number | null
  widthFt: number | null
  widthM: number | null
  surface: string | null
  lighting: boolean
  status: string
}

export interface OAAirport {
  icaoCode: string
  iataCode: string | null
  name: string | null
  city: string | null
  country: string | null
  continent: string | null
  latitude: number | null
  longitude: number | null
  elevationFt: number | null
  type: string | null
  runways: OARunway[]
}

// ── In-memory indexes ──
let airportsByIcao = new Map<string, OAAirport>()
let loaded = false
let lastLoadTime = 0

export function isLoaded(): boolean {
  return loaded
}

export function lookupByIcao(icao: string): OAAirport | undefined {
  return airportsByIcao.get(icao.toUpperCase())
}

export function getStats(): { airports: number; loaded: boolean; lastLoadTime: number } {
  return { airports: airportsByIcao.size, loaded, lastLoadTime }
}

// ── CSV parser ──
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

// ── Load data ──
export async function loadOurAirportsData(): Promise<void> {
  try {
    console.log('  Fetching OurAirports airports CSV…')
    const airportsRes = await fetch(AIRPORTS_CSV_URL)
    if (!airportsRes.ok) throw new Error(`airports.csv HTTP ${airportsRes.status}`)
    const airportsRows = parseCSV(await airportsRes.text())

    console.log('  Fetching OurAirports runways CSV…')
    const runwaysRes = await fetch(RUNWAYS_CSV_URL)
    if (!runwaysRes.ok) throw new Error(`runways.csv HTTP ${runwaysRes.status}`)
    const runwaysRows = parseCSV(await runwaysRes.text())

    // Group runways by airport_ref (OurAirports internal ID)
    const runwaysByAirportId = new Map<string, typeof runwaysRows>()
    for (const row of runwaysRows) {
      const id = row.airport_ref
      if (!id) continue
      const arr = runwaysByAirportId.get(id)
      if (arr) arr.push(row)
      else runwaysByAirportId.set(id, [row])
    }

    // Build ICAO index
    const index = new Map<string, OAAirport>()
    for (const row of airportsRows) {
      const icao = row.ident?.toUpperCase()
      if (!icao || icao.length < 3) continue

      // Parse IATA from iata_code column
      const iata = row.iata_code?.trim() || null

      // Parse runways for this airport
      const rawRunways = runwaysByAirportId.get(row.id) ?? []
      const runways: OARunway[] = rawRunways.map(r => {
        const lengthFt = Number(r.length_ft) || null
        const widthFt = Number(r.width_ft) || null
        const leIdent = r.le_ident || ''
        const heIdent = r.he_ident || ''
        return {
          identifier: leIdent && heIdent ? `${leIdent}/${heIdent}` : leIdent || heIdent || 'Unknown',
          lengthFt,
          lengthM: lengthFt ? Math.round(lengthFt * 0.3048) : null,
          widthFt,
          widthM: widthFt ? Math.round(widthFt * 0.3048) : null,
          surface: r.surface || null,
          lighting: r.lighted === '1',
          status: r.closed === '1' ? 'closed' : 'active',
        }
      })

      index.set(icao, {
        icaoCode: icao,
        iataCode: iata,
        name: row.name || null,
        city: row.municipality || null,
        country: row.iso_country || null,
        continent: row.continent || null,
        latitude: row.latitude_deg ? Number(row.latitude_deg) : null,
        longitude: row.longitude_deg ? Number(row.longitude_deg) : null,
        elevationFt: row.elevation_ft ? Number(row.elevation_ft) : null,
        type: row.type || null,
        runways,
      })
    }

    airportsByIcao = index
    loaded = true
    lastLoadTime = Date.now()
    console.log(`  ✓ OurAirports cache loaded: ${index.size} airports, ${runwaysRows.length} runways`)
  } catch (err) {
    console.error('  ✗ Failed to load OurAirports data:', err)
    // Don't clear existing cache on refresh failure
  }
}

// ── Auto-refresh ──
let refreshTimer: ReturnType<typeof setInterval> | null = null

export function startAutoRefresh(): void {
  if (refreshTimer) return
  refreshTimer = setInterval(() => {
    console.log('OurAirports: refreshing cache…')
    loadOurAirportsData().catch(console.error)
  }, REFRESH_INTERVAL_MS)
}

export function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}
