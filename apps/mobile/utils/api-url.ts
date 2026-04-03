import Constants from 'expo-constants'
import { setApiBaseUrl } from '@skyhub/api'

const API_PORT = 3002

/**
 * Auto-detect the API base URL from Expo's dev server host.
 * In dev, Expo knows the machine's LAN IP — we reuse it for the API.
 * In production, override via EXPO_PUBLIC_API_URL env var.
 */
function getApiBaseUrl(): string {
  // Explicit override wins
  const envUrl = process.env.EXPO_PUBLIC_API_URL
  if (envUrl) return envUrl

  // Dev: extract LAN IP from Expo's debugger host (e.g. "192.168.1.4:8081")
  const debuggerHost =
    Constants.expoConfig?.hostUri ?? Constants.experienceUrl ?? ''
  const lanIp = debuggerHost.split(':')[0]

  if (lanIp) return `http://${lanIp}:${API_PORT}`

  // Fallback
  return `http://localhost:${API_PORT}`
}

// Call once at import time — this module is imported early by the app
setApiBaseUrl(getApiBaseUrl())
