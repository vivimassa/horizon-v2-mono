/**
 * Web-local `fetch` wrapper that attaches the Bearer token from localStorage
 * and auto-refreshes once on 401.
 *
 * Use this instead of raw `fetch()` anywhere in apps/web that needs to hit
 * a protected server route but does NOT go through @skyhub/api's client
 * (e.g. the Gantt module and the avatar upload in profile).
 *
 * @skyhub/api's request() has its own auto-refresh; this helper is for
 * the handful of places that bypass the api client.
 */

const ACCESS_KEY = 'skyhub.accessToken'
const REFRESH_KEY = 'skyhub.refreshToken'
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACCESS_KEY)
  } catch {
    return null
  }
}

function readRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

function writeTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACCESS_KEY, access)
    window.localStorage.setItem(REFRESH_KEY, refresh)
  } catch {}
}

function clearTokens() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ACCESS_KEY)
    window.localStorage.removeItem(REFRESH_KEY)
  } catch {}
}

// Single-flight refresh so a burst of concurrent 401s produces one
// /auth/refresh call, not N of them.
let _refreshInFlight: Promise<{ accessToken: string; refreshToken: string } | null> | null = null

async function refreshOnce(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refresh = readRefreshToken()
  if (!refresh) return null

  if (!_refreshInFlight) {
    _refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
        })
        if (!res.ok) {
          clearTokens()
          return null
        }
        const pair = (await res.json()) as { accessToken: string; refreshToken: string }
        writeTokens(pair.accessToken, pair.refreshToken)
        return pair
      } catch {
        clearTokens()
        return null
      }
    })().finally(() => {
      _refreshInFlight = null
    })
  }

  return _refreshInFlight
}

/**
 * Fetch that automatically attaches the current access token and retries
 * once on 401 after refreshing the pair. On permanent failure, throws
 * like normal — the caller decides what to do.
 */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = readAccessToken()
  const headers = new Headers(init.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res = await fetch(input, { ...init, headers })

  if (res.status === 401) {
    const pair = await refreshOnce()
    if (pair) {
      headers.set('Authorization', `Bearer ${pair.accessToken}`)
      res = await fetch(input, { ...init, headers })
    }
  }

  return res
}
