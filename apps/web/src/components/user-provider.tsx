'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { userApi, type UserData } from '@/lib/api'
import { useAuth } from './auth-provider'

interface UserContextValue {
  user: UserData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const UserCtx = createContext<UserContextValue>({
  user: null,
  loading: true,
  error: null,
  refetch: async () => {},
})

export function useUser() {
  return useContext(UserCtx)
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await userApi.getMe()
      setUser(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch (or re-fetch) when auth state changes
  useEffect(() => {
    if (isAuthenticated) refetch()
    else setUser(null)
  }, [isAuthenticated, refetch])

  return <UserCtx.Provider value={{ user, loading, error, refetch }}>{children}</UserCtx.Provider>
}
