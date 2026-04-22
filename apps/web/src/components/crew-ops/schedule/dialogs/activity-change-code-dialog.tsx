'use client'

import { useState } from 'react'
import { api } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { ActivityCodePicker } from '../activity-code-picker'
import { DialogShell } from './dialog-shell'

interface Props {
  activityId: string
  onClose: () => void
  onAfterMutate: () => void
}

/**
 * Change the activity code on an existing activity. Picking a code
 * fires the PATCH and closes the dialog — no separate Save button.
 * Mirrors the single-click behavior of the Assign tab's picker.
 */
export function ActivityChangeCodeDialog({ activityId, onClose, onAfterMutate }: Props) {
  const activity = useCrewScheduleStore((s) => s.activities.find((a) => a._id === activityId) ?? null)
  const crew = useCrewScheduleStore((s) => (activity ? (s.crew.find((c) => c._id === activity.crewId) ?? null) : null))
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const activityGroups = useCrewScheduleStore((s) => s.activityGroups)
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (code: { _id: string }) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.patchCrewActivity(activityId, { activityCodeId: code._id })
      await reconcilePeriod()
      onAfterMutate()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell title="Change activity code" onClose={onClose} width={480} bodyPadding={false}>
      <div className="flex flex-col h-[60vh] min-h-[360px] px-5 py-4">
        {error && (
          <div
            className="mb-3 p-2 rounded-md text-[13px] shrink-0"
            style={{ backgroundColor: 'rgba(255,59,59,0.18)', color: '#FF6A6A' }}
          >
            {error}
          </div>
        )}
        <div className="flex-1 min-h-0">
          <ActivityCodePicker
            activityCodes={activityCodes}
            activityGroups={activityGroups}
            crewPositionId={crew?.position ?? null}
            disabled={busy}
            onPick={onPick}
            disableTimeEditor
          />
        </div>
      </div>
    </DialogShell>
  )
}
