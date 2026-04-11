import { useState, useEffect } from 'react'
import { api } from '@skyhub/api'

let cachedId: string | null = null
let fetchPromise: Promise<string> | null = null

function resolveOperatorId(): Promise<string> {
  if (cachedId) return Promise.resolve(cachedId)
  if (fetchPromise) return fetchPromise
  fetchPromise = api.getOperators().then((ops) => {
    cachedId = ops[0]?._id ?? ''
    return cachedId
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
    resolveOperatorId().then(setId)
  }, [])
  return id
}

/**
 * Get the cached operator ID synchronously (empty string if not yet loaded).
 * Prefer useOperatorId() in components.
 */
export function getOperatorId(): string {
  if (!cachedId && !fetchPromise) resolveOperatorId()
  return cachedId ?? ''
}
