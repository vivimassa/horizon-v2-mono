/**
 * Horizon V2 — API Client
 * Platform-agnostic. Base URL is injected by the consuming app.
 */

let _baseUrl = 'http://localhost:3001'

/** Call once at app startup to set the API base URL */
export function setApiBaseUrl(url: string) {
  _baseUrl = url.replace(/\/$/, '') // strip trailing slash
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }

  return res.json()
}

// ─── Flight types ─────────────────────────────────────────
export interface Flight {
  _id: string
  operatorId: string
  flightNumber: string
  operatingDate: string
  dep: { icao: string; iata: string }
  arr: { icao: string; iata: string }
  schedule: { stdUtc: number; staUtc: number }
  actual: { atdUtc: number | null; ataUtc: number | null }
  tail: { registration: string | null; icaoType: string | null }
  crew: { employeeId: string; role: string; name: string }[]
  delays: { code: string; minutes: number; reason: string }[]
  status: 'scheduled' | 'departed' | 'onTime' | 'delayed' | 'cancelled' | 'diverted'
  syncMeta: { updatedAt: number; version: number }
}

// ─── Reference types ──────────────────────────────────────
export interface AirportRef {
  _id: string
  icaoCode: string
  iataCode: string | null
  name: string
  city: string | null
  country: string | null
  timezone: string
  latitude: number | null
  longitude: number | null
  countryFlag: string | null
}

export interface AircraftTypeRef {
  _id: string
  icaoType: string
  name: string
  family: string | null
  category: string
  paxCapacity: number | null
  color: string | null
}

export interface ReferenceStats {
  operators: number
  airports: number
  aircraftTypes: number
  countries: number
  delayCodes: number
  flightServiceTypes: number
  crewPositions: number
  expiryCodeCategories: number
  expiryCodes: number
  total: number
}

// ─── API methods ──────────────────────────────────────────

export const api = {
  // Flights
  getFlights: (operatorId = 'horizon', from?: string, to?: string) => {
    let path = `/flights?operatorId=${operatorId}`
    if (from) path += `&from=${from}`
    if (to) path += `&to=${to}`
    return request<Flight[]>(path)
  },

  getFlight: (id: string) => request<Flight>(`/flights/${id}`),

  // Reference data
  getAirports: (params?: { search?: string; crewBase?: boolean }) => {
    let path = '/airports?active=true'
    if (params?.search) path += `&search=${encodeURIComponent(params.search)}`
    if (params?.crewBase) path += '&crewBase=true'
    return request<AirportRef[]>(path)
  },

  getAircraftTypes: (operatorId = 'horizon') =>
    request<AircraftTypeRef[]>(`/aircraft-types?operatorId=${operatorId}`),

  getReferenceStats: () => request<ReferenceStats>('/reference/stats'),

  // Health
  health: () => request<{ status: string }>('/health'),
}
