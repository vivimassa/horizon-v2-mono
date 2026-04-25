import Constants from 'expo-constants'
import { setApiBaseUrl } from '@skyhub/api'
import { validateClientEnv } from '@skyhub/env/client'

const API_PORT = 3002

/**
 * Auto-detect the API base URL from Expo's dev server host.
 * In dev, Expo knows the machine's LAN IP — we reuse it for the API.
 * In production, override via EXPO_PUBLIC_API_URL env var (validated by Zod).
 */
function resolveApiBaseUrl(): string {
  // Explicit override wins — validated via @skyhub/env
  if (process.env.EXPO_PUBLIC_API_URL) {
    const env = validateClientEnv({ API_URL: process.env.EXPO_PUBLIC_API_URL })
    return env.API_URL
  }

  // Dev: extract LAN IP from Expo's debugger host (e.g. "192.168.1.4:8081").
  // Works across laptops because each `expo start` bakes the bundler's own
  // LAN IP into hostUri at session start.
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.experienceUrl ?? ''
  const host = debuggerHost.split(':')[0]

  // Reject tunnel hosts (e.g. *.exp.direct) — those resolve from the phone
  // but the API at :3002 isn't proxied through them.
  const isLanIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
  if (isLanIp) {
    const url = `http://${host}:${API_PORT}`
    console.log('[api-url] auto-detected LAN API:', url)
    return url
  }

  if (host) {
    console.warn('[api-url] non-LAN host detected:', host, '— set EXPO_PUBLIC_API_URL in apps/mobile/.env')
  }
  return `http://localhost:${API_PORT}`
}

// Call once at import time — this module is imported early by the app
setApiBaseUrl(resolveApiBaseUrl())
