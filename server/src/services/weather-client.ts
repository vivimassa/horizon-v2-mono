import { parseMetar, type ParsedMetar } from '@skyhub/logic/src/weather/metar-parser'
import { computeAlertTier, type WeatherAlertTier } from '@skyhub/logic/src/weather/weather-config'

export interface WeatherSnapshot {
  icao: string
  raw: string
  parsed: ParsedMetar
  alertTier: WeatherAlertTier
}

// NOAA AWC API — free, no key, capped at ~15 days of history (fine for live ops).
const NOAA_METAR_URL = 'https://aviationweather.gov/api/data/metar'

/**
 * Fetch the latest METAR for each ICAO and return parsed snapshots with
 * flight category + alert tier. Silently drops stations that fail to
 * parse so one bad obs doesn't sink the whole batch.
 */
export async function fetchMetars(icaos: string[]): Promise<WeatherSnapshot[]> {
  const unique = Array.from(new Set(icaos.map((c) => c.toUpperCase()).filter(Boolean)))
  if (unique.length === 0) return []

  const params = new URLSearchParams({
    ids: unique.join(','),
    format: 'raw',
    taf: 'false',
    hours: '2',
  })
  const url = `${NOAA_METAR_URL}?${params.toString()}`

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`NOAA AWC responded ${res.status}`)
  const text = await res.text()

  const snapshots: WeatherSnapshot[] = []
  const latestByIcao = new Map<string, string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = line.match(/^([A-Z]{4})\s/)
    if (!match) continue
    const icao = match[1]
    // Keep only the first (latest) line per station in the response.
    if (!latestByIcao.has(icao)) latestByIcao.set(icao, line)
  }

  for (const [icao, raw] of latestByIcao) {
    try {
      const parsed = parseMetar(raw)
      const tier = computeAlertTier(
        parsed.flightCategory,
        parsed.windSpeedKts,
        parsed.windGustKts,
        parsed.visibilityMeters,
        parsed.ceilingFeet,
        parsed.weatherPhenomena,
      )
      snapshots.push({ icao, raw, parsed, alertTier: tier })
    } catch {
      // skip unparseable line
    }
  }

  return snapshots
}
