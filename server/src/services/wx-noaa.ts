/**
 * NOAA aviationweather.gov free public METAR/TAF proxy.
 *
 * Endpoint shape:
 *   GET https://aviationweather.gov/api/data/metar?ids=<ICAO>&format=json
 *   GET https://aviationweather.gov/api/data/taf?ids=<ICAO>&format=json
 *
 * Each returns an array; we take [0] (most recent obs/forecast). Cache
 * raw text per ICAO in-memory for 10 min — Phase C may swap to Redis.
 */

interface CacheEntry {
  raw: string | null
  fetchedAtMs: number
}

const TTL_MS = 10 * 60 * 1000
const metarCache = new Map<string, CacheEntry>()
const tafCache = new Map<string, CacheEntry>()

async function fetchOne(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8_000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'SkyHubCrew/0.1' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function getMetar(icao: string): Promise<{ raw: string | null; fetchedAtMs: number }> {
  const upper = icao.toUpperCase()
  const cached = metarCache.get(upper)
  const now = Date.now()
  if (cached && now - cached.fetchedAtMs < TTL_MS) return cached
  const data = await fetchOne(`https://aviationweather.gov/api/data/metar?ids=${upper}&format=json`)
  let raw: string | null = null
  if (Array.isArray(data) && data.length > 0) {
    const r = data[0] as { rawOb?: string; rawText?: string }
    raw = r.rawOb ?? r.rawText ?? null
  }
  const entry: CacheEntry = { raw, fetchedAtMs: now }
  metarCache.set(upper, entry)
  return entry
}

export async function getTaf(icao: string): Promise<{ raw: string | null; fetchedAtMs: number }> {
  const upper = icao.toUpperCase()
  const cached = tafCache.get(upper)
  const now = Date.now()
  if (cached && now - cached.fetchedAtMs < TTL_MS) return cached
  const data = await fetchOne(`https://aviationweather.gov/api/data/taf?ids=${upper}&format=json`)
  let raw: string | null = null
  if (Array.isArray(data) && data.length > 0) {
    const r = data[0] as { rawTAF?: string; rawText?: string }
    raw = r.rawTAF ?? r.rawText ?? null
  }
  const entry: CacheEntry = { raw, fetchedAtMs: now }
  tafCache.set(upper, entry)
  return entry
}
