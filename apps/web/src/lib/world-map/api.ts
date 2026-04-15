import { authedFetch } from '../authed-fetch'
import type { WorldMapFlight, WorldMapAirport } from '@/components/world-map/world-map-types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

export async function getWorldMapFlights(date: string): Promise<WorldMapFlight[]> {
  const res = await authedFetch(`${API_BASE}/world-map/flights?date=${encodeURIComponent(date)}`)
  if (!res.ok) throw new Error(`World map flights ${res.status}`)
  return res.json()
}

export async function getWorldMapAirports(): Promise<WorldMapAirport[]> {
  const res = await authedFetch(`${API_BASE}/world-map/airports`)
  if (!res.ok) throw new Error(`World map airports ${res.status}`)
  return res.json()
}

export async function getAircraftTypeColors(): Promise<Record<string, string>> {
  const res = await authedFetch(`${API_BASE}/world-map/aircraft-type-colors`)
  if (!res.ok) return {}
  return res.json()
}

export async function searchAirportsForClock(
  query: string,
): Promise<{ iata: string; name: string; timezone: string }[]> {
  if (!query || query.length < 2) return []
  const res = await authedFetch(`${API_BASE}/world-map/airport-search?q=${encodeURIComponent(query)}`)
  if (!res.ok) return []
  return res.json()
}
