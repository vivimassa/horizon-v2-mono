'use client'

import { useState, useEffect, useCallback } from 'react'
import { userApi, type UserData } from '@/lib/api'

interface UseUserReturn {
  user: UserData | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await userApi.getMe()
      setUser(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load user')
      console.error('useUser error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return { user, loading, error, refetch: fetchUser }
}
