import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { crewApi, type ActivityCodeMeta } from '../lib/api-client'

/**
 * Fetch the operator's full ActivityCode catalog so the crew app can
 * map a roster row's `activityCodeId` (UUID) → human label / color.
 * 30-min staleTime since these rarely change.
 */
export function useActivityCodes() {
  const q = useQuery<{ codes: ActivityCodeMeta[] }>({
    queryKey: ['activity-codes'],
    queryFn: () => crewApi.activityCodes(),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })

  const byId = useMemo(() => {
    const m = new Map<string, ActivityCodeMeta>()
    for (const c of q.data?.codes ?? []) m.set(c.id, c)
    return m
  }, [q.data])

  return { byId, isLoading: q.isLoading, error: q.error }
}
