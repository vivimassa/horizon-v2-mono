import { useQuery } from '@tanstack/react-query'
import { crewApi, type CrewStats, type StatsPeriod } from '../lib/api-client'

export function useStats(period: StatsPeriod, atIso?: string) {
  return useQuery<CrewStats>({
    queryKey: ['stats', period, atIso ?? 'now'],
    queryFn: () => crewApi.stats(period, atIso),
    staleTime: 5 * 60_000,
  })
}
