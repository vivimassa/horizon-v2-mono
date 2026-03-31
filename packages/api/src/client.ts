/**
 * Sky Hub — API Client
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
  countryId: string | null
  timezone: string
  latitude: number | null
  longitude: number | null
  countryFlag: string | null
  countryName: string | null
  countryIso2: string | null
  isActive: boolean
  isHomeBase: boolean
  isCrewBase: boolean
}

export interface AircraftTypeRef {
  _id: string
  operatorId: string
  icaoType: string
  iataType: string | null
  name: string
  family: string | null
  category: string
  manufacturer: string | null
  paxCapacity: number | null
  color: string | null
  isActive: boolean
}

export interface CountryRef {
  _id: string
  isoCode2: string
  isoCode3: string
  name: string
  officialName: string | null
  region: string | null
  subRegion: string | null
  icaoPrefix: string | null
  flagEmoji: string | null
  isActive: boolean
}

export interface DelayCodeRef {
  _id: string
  operatorId: string
  code: string
  category: string
  name: string
  description: string | null
  isIataStandard: boolean
  isActive: boolean
}

export interface CrewPositionRef {
  _id: string
  operatorId: string
  code: string
  name: string
  category: 'cockpit' | 'cabin'
  rankOrder: number
  isPic: boolean
  color: string | null
  description: string | null
  isActive: boolean
}

export interface ExpiryCodeCategoryRef {
  _id: string
  operatorId: string
  key: string
  label: string
  description: string | null
  color: string
  sortOrder: number
}

export interface ExpiryCodeRef {
  _id: string
  operatorId: string
  categoryId: string
  code: string
  name: string
  description: string | null
  crewCategory: 'both' | 'cockpit' | 'cabin'
  formula: string
  acTypeScope: 'none' | 'family' | 'variant'
  warningDays: number | null
  isActive: boolean
  sortOrder: number
}

export interface FlightServiceTypeRef {
  _id: string
  operatorId: string
  code: string
  name: string
  description: string | null
  color: string | null
  isActive: boolean
}

export interface OperatorRef {
  _id: string
  code: string
  name: string
  icaoCode: string | null
  iataCode: string | null
  callsign: string | null
  country: string | null
  timezone: string
  accentColor: string
  isActive: boolean
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
  getAirports: (params?: { search?: string; crewBase?: boolean; country?: string }) => {
    let path = '/airports?active=true'
    if (params?.search) path += `&search=${encodeURIComponent(params.search)}`
    if (params?.crewBase) path += '&crewBase=true'
    if (params?.country) path += `&country=${encodeURIComponent(params.country)}`
    return request<AirportRef[]>(path)
  },

  getAircraftTypes: (operatorId = 'horizon') =>
    request<AircraftTypeRef[]>(`/aircraft-types?operatorId=${operatorId}`),

  getCountries: (params?: { region?: string; search?: string }) => {
    let path = '/countries'
    const qs: string[] = []
    if (params?.region) qs.push(`region=${encodeURIComponent(params.region)}`)
    if (params?.search) qs.push(`search=${encodeURIComponent(params.search)}`)
    if (qs.length) path += `?${qs.join('&')}`
    return request<CountryRef[]>(path)
  },

  getDelayCodes: (operatorId = 'horizon') =>
    request<DelayCodeRef[]>(`/delay-codes?operatorId=${operatorId}`),

  getCrewPositions: (operatorId = 'horizon') =>
    request<CrewPositionRef[]>(`/crew-positions?operatorId=${operatorId}`),

  getExpiryCodeCategories: (operatorId = 'horizon') =>
    request<ExpiryCodeCategoryRef[]>(`/expiry-code-categories?operatorId=${operatorId}`),

  getExpiryCodes: (operatorId = 'horizon') =>
    request<ExpiryCodeRef[]>(`/expiry-codes?operatorId=${operatorId}`),

  getFlightServiceTypes: (operatorId = 'horizon') =>
    request<FlightServiceTypeRef[]>(`/flight-service-types?operatorId=${operatorId}`),

  getOperators: () => request<OperatorRef[]>('/operators'),

  getReferenceStats: () => request<ReferenceStats>('/reference/stats'),

  // Health
  health: () => request<{ status: string }>('/health'),
}
