'use client'

import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { LegalityCheckDialog } from './legality-check-dialog'

/**
 * Subscribes to the store's `legalityCheck` scope and drives the
 * scope-aware `LegalityCheckDialog`. Sits in the shell so the toolbar
 * button and every right-click menu item can dispatch through the same
 * surface.
 */
export function LegalityCheckDialogHost() {
  const scope = useCrewScheduleStore((s) => s.legalityCheck)
  const close = useCrewScheduleStore((s) => s.closeLegalityCheck)
  const periodFromIso = useCrewScheduleStore((s) => s.periodFromIso)
  const periodToIso = useCrewScheduleStore((s) => s.periodToIso)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const crew = useCrewScheduleStore((s) => s.crew)
  const selectPairing = useCrewScheduleStore((s) => s.selectPairing)
  const selectCrew = useCrewScheduleStore((s) => s.selectCrew)

  return (
    <LegalityCheckDialog
      scope={scope}
      periodFromIso={periodFromIso}
      periodToIso={periodToIso}
      pairings={pairings}
      assignments={assignments}
      crew={crew}
      onClose={close}
      onJumpToPairing={(pairingId, crewId) => {
        selectPairing(pairingId)
        if (crewId) selectCrew(crewId)
        close()
      }}
    />
  )
}
