import { useQuery } from '@tanstack/react-query'
import { crewApi, type PairingCrewMember } from '../lib/api-client'

export function usePairingCrew(pairingId: string | null | undefined) {
  return useQuery<{ pairingId: string; crew: PairingCrewMember[] }>({
    queryKey: ['pairing-crew', pairingId ?? ''],
    queryFn: () => crewApi.pairingCrew(pairingId!),
    enabled: !!pairingId,
    staleTime: 30 * 60_000,
  })
}
