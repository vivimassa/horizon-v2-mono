import { Q } from '@nozbe/watermelondb'
import type { Database } from '@nozbe/watermelondb'
import { runCrewSync } from '@skyhub/crew-db'
import type { CrewProfileRecord } from '@skyhub/crew-db'
import { API_BASE_URL } from '../lib/api-client'
import { secureTokenStorage } from '../lib/secure-token-storage'
import { useCrewAuthStore } from '../stores/use-crew-auth-store'
import { useSyncStore } from '../stores/use-sync-store'

let syncing = false
let lastSyncMs = 0
const MIN_INTERVAL_MS = 5_000

/**
 * Run a /crew-app/sync/pull → push round-trip. Throttled to one
 * concurrent run; callers (foreground, push received, manual refresh,
 * 5-min interval) can fire freely. Pushes status + counts into
 * useSyncStore so More can render real numbers, and refreshes the auth
 * store profile so labels (HAN base, CP position) update on every sync.
 */
export async function syncCrewData(database: Database, force = false): Promise<boolean> {
  if (syncing) return false
  if (!force && Date.now() - lastSyncMs < MIN_INTERVAL_MS) return false
  syncing = true
  useSyncStore.getState().setStarted()
  try {
    await runCrewSync({
      database,
      apiBaseUrl: API_BASE_URL,
      getAccessToken: () => secureTokenStorage.getAccessToken(),
      onAuthFailure: () => {
        secureTokenStorage.clearSession()
        useCrewAuthStore.getState().logout()
      },
    })

    // Count what we now have locally — proves to the user (via More)
    // whether sync actually delivered duties.
    const [aCount, pCount, lCount, actCount, mCount] = await Promise.all([
      database.get('crew_assignments').query().fetchCount(),
      database.get('pairings').query().fetchCount(),
      database.get('pairing_legs').query().fetchCount(),
      database.get('crew_activities').query().fetchCount(),
      database.get('crew_messages').query().fetchCount(),
    ])

    // Refresh auth-store profile from synced crew_profile row so labels
    // update (base ICAO, position code) even on the silent refresh-token
    // boot path where login didn't happen this session.
    try {
      const profileRows = (await database
        .get<CrewProfileRecord>('crew_profile')
        .query(Q.take(1))
        .fetch()) as CrewProfileRecord[]
      const p = profileRows[0]
      if (p) {
        useCrewAuthStore.getState().setSession({
          crewId: p.id,
          operatorId: secureTokenStorage.getOperatorId() ?? '',
          employeeId: p.employeeId,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position ?? null,
          base: p.base ?? null,
          photoUrl: p.photoUrl ?? null,
        })
      }
    } catch (err) {
      console.warn('[sync] profile refresh failed:', (err as Error).message)
    }

    lastSyncMs = Date.now()
    useSyncStore.getState().setSuccess({
      assignments: aCount,
      pairings: pCount,
      legs: lCount,
      activities: actCount,
      messages: mCount,
    })
    return true
  } catch (err) {
    const msg = (err as Error).message
    console.warn('[sync] failed:', msg)
    useSyncStore.getState().setError(msg)
    return false
  } finally {
    syncing = false
  }
}

/**
 * Wipe local WatermelonDB rows + reset Watermelon sync cursor, then full-
 * pull from server. Fresh-PIN-login auto-trigger and the More-tab "Reset
 * local data" recovery button both call this.
 */
export async function resetAndResync(database: Database): Promise<boolean> {
  await database.write(async () => {
    await database.unsafeResetDatabase()
  })
  lastSyncMs = 0
  return syncCrewData(database, true)
}
