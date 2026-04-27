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

export const crewApi = {
  listOperators: () => request<{ operators: OperatorOption[] }>('/crew-app/auth/operators', { auth: false }),

  login: (operatorId: string, employeeId: string, pin: string) =>
    request<AuthResponse>('/crew-app/auth/login', {
      method: 'POST',
      auth: false,
      body: { operatorId, employeeId, pin },
    }),

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
