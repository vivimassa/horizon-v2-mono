import type { Database } from '@nozbe/watermelondb'
import { runCrewSync } from '@skyhub/crew-db'
import { API_BASE_URL } from '../lib/api-client'
import { secureTokenStorage } from '../lib/secure-token-storage'
import { useCrewAuthStore } from '../stores/use-crew-auth-store'

let syncing = false
let lastSyncMs = 0
const MIN_INTERVAL_MS = 5_000

/**
 * Run a /crew-app/sync/pull → push round-trip. Throttled to one
 * concurrent run; callers (foreground, push received, manual refresh,
 * 5-min interval) can fire freely.
 */
export async function syncCrewData(database: Database, force = false): Promise<boolean> {
  if (syncing) return false
  if (!force && Date.now() - lastSyncMs < MIN_INTERVAL_MS) return false
  syncing = true
  try {
    await runCrewSync({
      database,
      apiBaseUrl: API_BASE_URL,
      getAccessToken: () => secureTokenStorage.getAccessToken(),
      onAuthFailure: () => {
        // Server says our crew JWT is dead. Bounce to login — the auth
        // gate will let the crew re-enter PIN / biometric and try again.
        secureTokenStorage.clearSession()
        useCrewAuthStore.getState().logout()
      },
    })
    lastSyncMs = Date.now()
    return true
  } catch (err) {
    console.warn('[sync] failed:', (err as Error).message)
    return false
  } finally {
    syncing = false
  }
}
