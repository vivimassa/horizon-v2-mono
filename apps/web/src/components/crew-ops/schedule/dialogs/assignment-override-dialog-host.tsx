'use client'

import { useState } from 'react'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { AssignmentOverrideDialog } from './assignment-override-dialog'

/**
 * Host that wires the store's `assignmentOverridePending` slice to the
 * `AssignmentOverrideDialog`. Sits in the shell so any drag source
 * (today: uncrewed tray; later: canvas drag-copy / context-menu flows)
 * can park a violation-check through the same surface.
 */
export function AssignmentOverrideDialogHost() {
  const pending = useCrewScheduleStore((s) => s.assignmentOverridePending)
  const clear = useCrewScheduleStore((s) => s.clearAssignmentOverridePending)
  const [busy, setBusy] = useState(false)

  if (!pending) return null

  return (
    <AssignmentOverrideDialog
      violations={pending.violations}
      busy={busy}
      onCancel={() => {
        if (busy) return
        clear()
      }}
      onConfirm={async (ack) => {
        setBusy(true)
        try {
          await pending.proceed(ack)
        } finally {
          setBusy(false)
          clear()
        }
      }}
    />
  )
}
