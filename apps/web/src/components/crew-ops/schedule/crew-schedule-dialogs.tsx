'use client'

import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { ActivityEditDialog } from './dialogs/activity-edit-dialog'
import { ActivityChangeCodeDialog } from './dialogs/activity-change-code-dialog'
import { ActivityDuplicateDialog } from './dialogs/activity-duplicate-dialog'
import { AssignPairingDialog } from './dialogs/assign-pairing-dialog'
import { AssignSeriesDialog } from './dialogs/assign-series-dialog'
import { GroupCrewDialog } from './dialogs/group-crew-dialog'
import { UncrewedFilterSheet } from './dialogs/uncrewed-filter-sheet'
import { FlightScheduleChangesDialog } from './dialogs/flight-schedule-changes-dialog'
import { CrewExtraInfoDialog } from './dialogs/crew-extra-info-dialog'

interface Props {
  onAfterMutate: () => void
}

/**
 * Dispatcher for the context-menu dialogs. Renders:
 *   - `openDialog` driven Phase 2 flows (activity edit/duplicate/etc.)
 *   - The uncrewed filter sheet (independent flag)
 *   - Phase 4 dialogs (flight schedule changes, crew extra info) which
 *     gate their own visibility on their own store slices.
 */
export function CrewScheduleDialogs({ onAfterMutate }: Props) {
  const openDialog = useCrewScheduleStore((s) => s.openDialog)
  const closeDialog = useCrewScheduleStore((s) => s.closeDialog)
  const uncrewedFilterSheetOpen = useCrewScheduleStore((s) => s.uncrewedFilterSheetOpen)
  const setUncrewedFilterSheetOpen = useCrewScheduleStore((s) => s.setUncrewedFilterSheetOpen)

  return (
    <>
      {uncrewedFilterSheetOpen && <UncrewedFilterSheet onClose={() => setUncrewedFilterSheetOpen(false)} />}

      {openDialog?.kind === 'activity-edit' && (
        <ActivityEditDialog activityId={openDialog.activityId} onClose={closeDialog} onAfterMutate={onAfterMutate} />
      )}
      {openDialog?.kind === 'activity-change-code' && (
        <ActivityChangeCodeDialog
          activityId={openDialog.activityId}
          onClose={closeDialog}
          onAfterMutate={onAfterMutate}
        />
      )}
      {openDialog?.kind === 'activity-duplicate' && (
        <ActivityDuplicateDialog
          activityId={openDialog.activityId}
          onClose={closeDialog}
          onAfterMutate={onAfterMutate}
        />
      )}
      {openDialog?.kind === 'assign-pairing' && (
        <AssignPairingDialog
          crewId={openDialog.crewId}
          dateIso={openDialog.dateIso}
          onClose={closeDialog}
          onAfterMutate={onAfterMutate}
        />
      )}
      {openDialog?.kind === 'assign-series' && (
        <AssignSeriesDialog
          fromIso={openDialog.fromIso}
          toIso={openDialog.toIso}
          crewId={openDialog.crewId}
          onClose={closeDialog}
          onAfterMutate={onAfterMutate}
        />
      )}
      {openDialog?.kind === 'group-crew' && <GroupCrewDialog dateIso={openDialog.dateIso} onClose={closeDialog} />}

      {/* Phase 4 — self-contained dialogs, read their own store slice. */}
      <FlightScheduleChangesDialog />
      <CrewExtraInfoDialog />
    </>
  )
}
