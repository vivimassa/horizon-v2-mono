import { useQuery } from '@tanstack/react-query'
import { crewApi, type FullProfile } from '../lib/api-client'

export function useFullProfile() {
  return useQuery<FullProfile>({
    queryKey: ['full-profile'],
    queryFn: () => crewApi.fullProfile(),
    staleTime: 30 * 60_000,
  })
}
