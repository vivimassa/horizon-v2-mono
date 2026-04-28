import { useQuery } from '@tanstack/react-query'
import { crewApi, type FdtlSummary } from '../lib/api-client'

export function useFdtl(atIso?: string) {
  return useQuery<FdtlSummary>({
    queryKey: ['fdtl', atIso ?? 'now'],
    queryFn: () => crewApi.fdtl(atIso),
    staleTime: 5 * 60_000,
  })
}
