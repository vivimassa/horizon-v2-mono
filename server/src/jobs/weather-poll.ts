import crypto from 'node:crypto'
import { Airport } from '../models/Airport.js'
import { WeatherObservation } from '../models/WeatherObservation.js'
import { fetchMetars } from '../services/weather-client.js'

// Default cadence; override with WEATHER_POLL_INTERVAL_MINUTES env var.
const DEFAULT_INTERVAL_MIN = 15
// Batch size per NOAA AWC request (the API handles plenty but be polite).
const BATCH_SIZE = 40

function intervalMs(): number {
  const raw = process.env.WEATHER_POLL_INTERVAL_MINUTES
  const parsed = raw ? parseInt(raw, 10) : DEFAULT_INTERVAL_MIN
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MIN
  return minutes * 60_000
}

async function listMonitoredIcaos(): Promise<string[]> {
  const airports = await Airport.find(
    { isActive: true, weatherMonitored: true },
    { icaoCode: 1, weatherStation: 1 },
  ).lean()
  const set = new Set<string>()
  for (const a of airports as unknown as Array<{ icaoCode?: string; weatherStation?: string | null }>) {
    const code = (a.weatherStation || a.icaoCode || '').toUpperCase()
    if (code) set.add(code)
  }
  return Array.from(set)
}

export async function runWeatherPollOnce(): Promise<{ stations: number; saved: number }> {
  const icaos = await listMonitoredIcaos()
  if (icaos.length === 0) return { stations: 0, saved: 0 }

  let saved = 0
  for (let i = 0; i < icaos.length; i += BATCH_SIZE) {
    const batch = icaos.slice(i, i + BATCH_SIZE)
    try {
      const snapshots = await fetchMetars(batch)
      for (const s of snapshots) {
        await WeatherObservation.updateOne(
          { icao: s.icao, observedAt: s.parsed.observedAt },
          {
            $setOnInsert: {
              _id: crypto.randomUUID(),
              icao: s.icao,
              observedAt: s.parsed.observedAt,
              raw: s.raw,
              flightCategory: s.parsed.flightCategory,
              alertTier: s.alertTier,
              windDirectionDeg: s.parsed.windDirectionDeg,
              windSpeedKts: s.parsed.windSpeedKts,
              windGustKts: s.parsed.windGustKts,
              visibilityMeters: s.parsed.visibilityMeters,
              ceilingFeet: s.parsed.ceilingFeet,
              temperatureC: s.parsed.temperatureC,
              dewpointC: s.parsed.dewpointC,
              weatherPhenomena: s.parsed.weatherPhenomena,
              createdAt: new Date().toISOString(),
            },
          },
          { upsert: true },
        )
        saved += 1
      }
    } catch (err) {
      console.error('[weather-poll] batch failed:', err instanceof Error ? err.message : err)
    }
  }
  return { stations: icaos.length, saved }
}

let timer: NodeJS.Timeout | null = null

export function startWeatherPoll(): void {
  if (process.env.ENABLE_WEATHER_POLL === 'false') {
    console.log('[weather-poll] disabled via ENABLE_WEATHER_POLL=false')
    return
  }
  if (timer) return // already started

  const tick = async () => {
    try {
      const { stations, saved } = await runWeatherPollOnce()
      if (stations > 0) {
        console.log(`[weather-poll] polled ${stations} stations, saved ${saved} observations`)
      }
    } catch (err) {
      console.error('[weather-poll] tick failed:', err instanceof Error ? err.message : err)
    }
  }

  // Kick off immediately, then on interval.
  void tick()
  timer = setInterval(tick, intervalMs())
  console.log(`[weather-poll] started (every ${intervalMs() / 60_000} min)`)
}

export function stopWeatherPoll(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
