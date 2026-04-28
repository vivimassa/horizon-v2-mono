import { useQuery } from '@tanstack/react-query'
import { crewApi, type StatsPeriod, type TopRoute } from '../lib/api-client'

export function useTopRoutes(period: StatsPeriod) {
  return useQuery<{ routes: TopRoute[] }>({
    queryKey: ['top-routes', period],
    queryFn: () => crewApi.topRoutes(period),
    staleTime: 5 * 60_000,
  })
}
