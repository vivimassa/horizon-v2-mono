/**
 * In-process cache for the assembled /crew-schedule payload, keyed by
 * AutoRosterRun._id. Populated by the orchestrator at solve completion
 * so the post-solve "Loading roster data…" fetch can hit a warm payload
 * instead of paying the full aggregator cost again.
 *
 * Bounded LRU + TTL — no Redis dependency. The cache is intentionally
 * stale once any roster mutation lands (assign/swap/delete); the UI
 * will re-render via the regular /crew-schedule endpoint after those
 * mutations, so we don't try to keep entries in sync.
 *
 * Multi-tenant isolation: each entry stores its operatorId and the
 * getter requires the caller to pass the requesting operatorId. A
 * mismatch returns null (treated as cache miss by the route) so we
 * never serve cross-tenant payloads even on runId collision.
 */
const TTL_MS = 60 * 60 * 1000 // 1h
const MAX_ENTRIES = 16

type Entry = {
  runId: string
  operatorId: string
  expiresAtMs: number
  payload: unknown
}

const entries = new Map<string, Entry>()

export function setRosterRunPayload(runId: string, operatorId: string, payload: unknown): void {
  if (entries.size >= MAX_ENTRIES) {
    // Evict oldest insertion (Map iteration is insertion order).
    const oldestKey = entries.keys().next().value
    if (oldestKey) entries.delete(oldestKey)
  }
  entries.set(runId, {
    runId,
    operatorId,
    expiresAtMs: Date.now() + TTL_MS,
    payload,
  })
}

export function getRosterRunPayload(runId: string, operatorId: string): unknown | null {
  const e = entries.get(runId)
  if (!e) return null
  if (e.expiresAtMs < Date.now()) {
    entries.delete(runId)
    return null
  }
  // Multi-tenant guard — never serve a cached payload to a different
  // tenant, even on runId collision. Treat as cache miss.
  if (e.operatorId !== operatorId) return null
  // LRU touch: re-insert moves to most-recently-used.
  entries.delete(runId)
  entries.set(runId, e)
  return e.payload
}

export function clearRosterRunPayload(runId: string): void {
  entries.delete(runId)
}
