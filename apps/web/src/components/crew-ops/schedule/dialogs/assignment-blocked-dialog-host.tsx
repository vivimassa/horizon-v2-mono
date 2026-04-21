'use client'

import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { AssignmentBlockedDialog } from './assignment-blocked-dialog'

/** Wires the store's `assignmentBlocked` slice to the hard-block dialog. */
export function AssignmentBlockedDialogHost() {
  const pending = useCrewScheduleStore((s) => s.assignmentBlocked)
  const clear = useCrewScheduleStore((s) => s.clearAssignmentBlocked)

  if (!pending) return null

  return <AssignmentBlockedDialog violations={pending.violations} onClose={clear} />
}
