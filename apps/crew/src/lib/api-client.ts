import Constants from 'expo-constants'
import { secureTokenStorage } from './secure-token-storage'

/**
 * Resolve API base URL.
 *  - Set EXPO_PUBLIC_API_URL in .env (e.g. https://api.skyhub.com).
 *  - Dev fallback: derive from Expo host URI so iOS/Android sims hit the
 *    Mac/Windows host instead of localhost (which means the device).
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const hostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri
  if (hostUri) {
    const host = hostUri.split(':')[0]
    return `http://${host}:3002`
  }
  return 'http://localhost:3002'
}

export const API_BASE_URL = resolveBaseUrl()

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.auth !== false) {
    const token = secureTokenStorage.getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    throw new ApiError(res.status, body, (body as { error?: string } | null)?.error)
  }
  return body as T
}

// ── Endpoint wrappers ────────────────────────────────────────────────────

export interface OperatorOption {
  operatorId: string
  code: string
  name: string
  iataCode: string | null
  icaoCode: string | null
  accentColor: string
  logoUrl: string | null
  country: string | null
}

export interface CrewProfile {
  crewId: string
  operatorId: string
  employeeId: string
  firstName: string
  lastName: string
  position: string | null
  base: string | null
  photoUrl: string | null
  isScheduleVisible?: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  profile: CrewProfile
}

// ── Phase B types: server endpoints under /crew-app/me/* ──────────────

export interface FullProfile {
  identity: {
    firstName: string
    middleName: string | null
    lastName: string
    gender: string | null
    dateOfBirth: string | null
    nationality: string | null
    employeeId: string
    shortCode: string | null
    photoUrl: string | null
  }
  employment: {
    contractType: string | null
    base: string | null
    position: string | null
    employmentDate: string | null
    seniority: number | null
    seniorityGroup: number
    languages: string[]
    ratings: string[]
  }
  contact: {
    emailPrimary: string | null
    emailSecondary: string | null
    phones: { id: string; priority: number; type: string; number: string; smsEnabled: boolean }[]
    address: {
      line1: string | null
      line2: string | null
      city: string | null
      state: string | null
      zip: string | null
      country: string | null
    }
    emergency: { name: string | null; relationship: string | null; phone: string | null }
  }
  passports: {
    id: string
    number: string
    country: string
    nationality: string | null
    placeOfIssue: string | null
    issueDate: string | null
    expiry: string
    isActive: boolean
  }[]
  visas: {
    id: string
    country: string
    type: string | null
    number: string | null
    issueDate: string | null
    expiry: string
  }[]
  licenses: {
    id: string
    number: string
    type: string
    country: string | null
    placeOfIssue: string | null
    issueDate: string | null
    temporary: boolean
  }[]
  expiries: {
    id: string
    codeId: string
    codeShort: string | null
    codeLabel: string | null
    aircraftType: string | null
    expiryDate: string | null
    isExpired: boolean
    daysUntil: number | null
  }[]
  _ratings: string[]
}

export interface FdtlSummary {
  computedAtMs: number
  fdpUsedMinutes: number
  fdpLimitMinutes: number
  duty7DayMinutes: number
  duty7DayLimitMinutes: number
  duty28DayMinutes: number
  duty28DayLimitMinutes: number
  minRestMinutes: number
  restStartUtcMs: number | null
  restEndUtcMs: number | null
  nextReportUtcMs: number | null
}

export type StatsPeriod = 'month' | '28d' | 'year'

export interface CrewStats {
  period: StatsPeriod
  range: { fromIso: string; toIso: string }
  blockMinutes: number
  dutyMinutes: number
  sectors: number
  nightDuties: number
  daysOff: number
  avgBlockMinutesPerDay: number
  weekly: { weekLabel: string; blockMinutes: number }[]
  trends: { blockDeltaMinutes: number; dutyDeltaMinutes: number; sectorsDelta: number }
}

export interface PairingCrewMember {
  crewId: string
  firstName: string
  lastName: string
  employeeId: string
  positionCode: string | null
  positionLabel: string | null
  seatIndex: number
}

export interface LegWx {
  dep: string
  arr: string
  metarDep: string | null
  metarArr: string | null
  tafDep: string | null
  tafArr: string | null
  source: 'noaa'
  fetchedAtMs: number
}

export interface ActivityCodeMeta {
  id: string
  code: string
  name: string
  shortLabel: string | null
  color: string | null
  flags: string[]
}

export interface TopRoute {
  depIcao: string
  arrIcao: string
  sectors: number
  blockMinutes: number
}

export const crewApi = {
  listOperators: () => request<{ operators: OperatorOption[] }>('/crew-app/auth/operators', { auth: false }),

  login: (operatorId: string, employeeId: string, pin: string) =>
    request<AuthResponse>('/crew-app/auth/login', {
      method: 'POST',
      auth: false,
      body: { operatorId, employeeId, pin },
    }),

  fullProfile: () => request<FullProfile>('/crew-app/me/full-profile'),

  fdtl: (atIso?: string) =>
    request<FdtlSummary>(`/crew-app/me/fdtl${atIso ? `?atIso=${encodeURIComponent(atIso)}` : ''}`),

  stats: (period: StatsPeriod, atIso?: string) => {
    const qs = new URLSearchParams({ period })
    if (atIso) qs.set('atIso', atIso)
    return request<CrewStats>(`/crew-app/me/stats?${qs.toString()}`)
  },

  topRoutes: (period: StatsPeriod) =>
    request<{ routes: TopRoute[] }>(`/crew-app/me/stats/routes?period=${encodeURIComponent(period)}`),

  pairingCrew: (pairingId: string) =>
    request<{ pairingId: string; crew: PairingCrewMember[] }>(
      `/crew-app/pairings/${encodeURIComponent(pairingId)}/crew`,
    ),

  legWx: (dep: string, arr: string) =>
    request<LegWx>(`/crew-app/wx?dep=${encodeURIComponent(dep)}&arr=${encodeURIComponent(arr)}`),

  activityCodes: () => request<{ codes: ActivityCodeMeta[] }>('/crew-app/activity-codes'),

  setPin: (operatorId: string, employeeId: string, tempPin: string, newPin: string) =>
    request<AuthResponse>('/crew-app/auth/set-pin', {
      method: 'POST',
      auth: false,
      body: { operatorId, employeeId, tempPin, newPin },
    }),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>('/crew-app/auth/refresh', {
      method: 'POST',
      auth: false,
      body: { refreshToken },
    }),

  logout: (pushToken?: string) =>
    request<{ success: boolean }>('/crew-app/auth/logout', {
      method: 'POST',
      body: { pushToken },
    }),

  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    request<{ success: boolean }>('/crew-app/push-tokens/register', {
      method: 'POST',
      body: { token, platform },
    }),

  unregisterPushToken: (token: string) =>
    request<{ success: boolean }>('/crew-app/push-tokens', {
      method: 'DELETE',
      body: { token },
    }),
}

export { ApiError }
