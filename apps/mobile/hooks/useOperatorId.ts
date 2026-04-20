import { useState, useEffect } from 'react'
import { api } from '@skyhub/api'

let cachedId: string | null = null
let fetchPromise: Promise<string> | null = null

function resolveOperatorId(): Promise<string> {
  if (cachedId) return Promise.resolve(cachedId)
  if (fetchPromise) return fetchPromise
  fetchPromise = api
    .getOperators()
    .then((ops) => {
      cachedId = ops[0]?._id ?? ''
      return cachedId
    })
    .catch((err) => {
      // Critical: never leave this promise rejected. A bare `.then(setId)`
      // in a consumer would otherwise surface as an unhandled rejection and
      // crash dev-builds ("Uncaught (in promise, id: 4)"). 401s are handled
      // by the request() layer (it invokes onAuthFailure → logout); here we
      // just log + fall back to an empty id so the UI can show an error
      // banner instead of hanging silently.
      console.warn('[useOperatorId] getOperators failed:', err?.message ?? err)
      fetchPromise = null // allow a future retry after re-login
      cachedId = ''
      return ''
    })
  return fetchPromise
}

/**
 * Returns the current operator's _id (fetched once, then cached).
 * Use this instead of hardcoding 'horizon'.
 */
export function useOperatorId(): string {
  const [id, setId] = useState(cachedId ?? '')
  useEffect(() => {
    if (cachedId) {
      setId(cachedId)
      return
    }
    resolveOperatorId()
      .then(setId)
      .catch(() => {
        // resolveOperatorId already swallows its own errors, but catch here
        // too so any future .then chaining can't leak an unhandled rejection.
      })
  }, [])
  return id
}

/**
 * Get the cached operator ID synchronously (empty string if not yet loaded).
 * Prefer useOperatorId() in components.
 */
export function getOperatorId(): string {
  if (!cachedId && !fetchPromise) {
    // Kick off the fetch but swallow any errors — synchronous callers can't
    // await it anyway, they'll re-read once the cache is populated.
    resolveOperatorId().catch(() => {})
  }
  return cachedId ?? ''
}
