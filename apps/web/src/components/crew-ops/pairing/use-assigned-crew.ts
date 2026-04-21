'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@skyhub/api'
import type { AssignedCrewRow } from './dialogs/pairing-details-dialog'

/**
 * Fetch the live assigned-crew roster for a single pairing. Used by the
 * shared PairingDetailsDialog when opened from 4.1.5.1 / 4.1.5.2 (which
 * don't hydrate the 4.1.6 schedule aggregator). 4.1.6 has the data on
 * hand and passes `assignedCrew` directly, bypassing this hook.
 */
export function useAssignedCrewForPairing(pairingId: string | null) {
  return useQuery<AssignedCrewRow[]>({
    queryKey: ['pairings', 'assigned-crew', pairingId],
    queryFn: async () => {
      if (!pairingId) return []
      const res = await api.getAssignedCrewForPairing(pairingId)
      return res.rows
    },
    enabled: !!pairingId,
    staleTime: 30 * 1000,
  })
}
