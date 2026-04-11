/**
 * API client for Sky Hub web app.
 * All calls go to the Fastify server via authedFetch, which attaches the
 * access token and auto-refreshes once on 401.
 */

import { authedFetch } from './authed-fetch'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await authedFetch(url, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API ${res.status}`)
  }
  return res.json()
}

// ── User API ──

export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  officePhone: string
  dateOfBirth: string
  gender: string
  department: string
  employeeId: string
  avatarUrl: string
  location: string
}

export interface UserSecurity {
  twoFactorEnabled: boolean
  biometricEnabled: boolean
  lastPasswordChange: string
  sessions: Array<{
    device: string
    browser: string
    location: string
    lastActive: string
    isCurrent: boolean
  }>
}

export interface UserPreferences {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  units: string
  numberFormat: string
}

export interface UserNotifications {
  pushEnabled: boolean
  emailEnabled: boolean
  inAppEnabled: boolean
  emailDigest: string
  quietHoursStart: string
  quietHoursEnd: string
  categories: {
    flightUpdates: boolean
    crewChanges: boolean
    systemAlerts: boolean
    maintenance: boolean
    reports: boolean
  }
}

export interface UserDisplay {
  textScale: string
  contrast: number
  brightness: number
  accentColor: string
  dynamicBackground: boolean
  backgroundPreset: string
  colorMode: string
}

export interface UserData {
  _id: string
  operatorId: string
  profile: UserProfile
  security: UserSecurity
  preferences: UserPreferences
  notifications: UserNotifications
  display: UserDisplay
  role: string
  isActive: boolean
  lastLoginUtc: string
  createdAt: string
  updatedAt: string
}

export const userApi = {
  getMe: () => apiFetch<UserData>('/users/me'),

  updateProfile: (data: Partial<UserProfile>) =>
    apiFetch<{ success: boolean; profile: UserProfile }>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateSecurity: (data: Record<string, any>) =>
    apiFetch<{ success: boolean; security: UserSecurity }>('/users/me/security', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updatePreferences: (data: Partial<UserPreferences>) =>
    apiFetch<{ success: boolean; preferences: UserPreferences }>('/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateNotifications: (data: Record<string, any>) =>
    apiFetch<{ success: boolean; notifications: UserNotifications }>('/users/me/notifications', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateDisplay: (data: Partial<UserDisplay>) =>
    apiFetch<{ success: boolean; display: UserDisplay }>('/users/me/display', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  revokeSession: (index: number) =>
    apiFetch<{ success: boolean; sessions: UserSecurity['sessions'] }>(`/users/me/sessions/${index}`, {
      method: 'DELETE',
    }),
}
