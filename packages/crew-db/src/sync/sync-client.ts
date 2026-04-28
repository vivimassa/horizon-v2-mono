import { synchronize } from '@nozbe/watermelondb/sync'
import type { Database } from '@nozbe/watermelondb'

interface SyncOptions {
  database: Database
  apiBaseUrl: string
  getAccessToken: () => string | null
  onAuthFailure?: () => void
}

/**
 * WatermelonDB ↔ /crew-app/sync/* bridge.
 *
 * Pull: GET /crew-app/sync/pull?lastPulledAt=<ms> → { changes, timestamp }
 * Push: POST /crew-app/sync/push body { changes, lastPulledAt }
 *
 * Server enforces crewId via JWT. The local DB has no operatorId/crewId
 * columns because the entire local DB belongs to one logged-in crew.
 */
export async function runCrewSync(opts: SyncOptions): Promise<void> {
  const { database, apiBaseUrl, getAccessToken, onAuthFailure } = opts

  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const token = getAccessToken()
      if (!token) throw new Error('No crew access token')
      const res = await fetch(`${apiBaseUrl}/crew-app/sync/pull?lastPulledAt=${lastPulledAt ?? 0}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401 || res.status === 403) {
        onAuthFailure?.()
        throw new Error(`Sync auth failed: ${res.status}`)
      }
      if (!res.ok) {
        throw new Error(`Sync pull failed: ${res.status}`)
      }
      const json = (await res.json()) as { changes: Record<string, unknown>; timestamp: number }
      return { changes: json.changes as never, timestamp: json.timestamp }
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const token = getAccessToken()
      if (!token) throw new Error('No crew access token')
      const res = await fetch(`${apiBaseUrl}/crew-app/sync/push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes, lastPulledAt }),
      })
      if (res.status === 401 || res.status === 403) {
        onAuthFailure?.()
        throw new Error(`Sync auth failed: ${res.status}`)
      }
      if (!res.ok) {
        throw new Error(`Sync push failed: ${res.status}`)
      }
    },
    sendCreatedAsUpdated: true,
    // Schema started at v1 and the SQLiteAdapter has no migrations
    // registered. Setting `migrationsEnabledAtVersion` requires a
    // migrations array on the adapter; without it, synchronize() throws
    // "Migration syncs cannot be enabled on a database that does not
    // support migrations" before any data is applied. Drop until/unless
    // we bump schema version and wire migrations.
  })
}
