'use client'

import { useState } from 'react'
import { api } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { DialogShell, DialogCancelButton, DialogPrimaryButton } from './dialog-shell'

interface Props {
  activityId: string
  onClose: () => void
  onAfterMutate: () => void
}

/**
 * Edit an activity's UTC window and notes. `activityCodeId` is changed
 * through the separate Change-code dialog; this one only covers the
 * times + notes fields.
 *
 * The inputs use native `datetime-local` with 'YYYY-MM-DDTHH:MM' format.
 * We store UTC ISO in the database — so on open we slice the ISO's
 * "YYYY-MM-DDTHH:MM" prefix (already UTC), and on save we append
 * ':00.000Z'. This makes the UI "UTC edit" rather than local-timezone
 * translation, which matches how the rest of the module presents times.
 */
export function ActivityEditDialog({ activityId, onClose, onAfterMutate }: Props) {
  const activity = useCrewScheduleStore((s) => s.activities.find((a) => a._id === activityId) ?? null)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)

  // Keep inputs uncontrolled of store updates — only initialise once.
  const [startLocal, setStartLocal] = useState(() => toInput(activity?.startUtcIso))
  const [endLocal, setEndLocal] = useState(() => toInput(activity?.endUtcIso))
  const [notes, setNotes] = useState(() => activity?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!activity) {
    // Activity vanished (deleted elsewhere, period changed) — bail out.
    return (
      <DialogShell
        title="Edit activity"
        onClose={onClose}
        footer={<DialogCancelButton onClick={onClose} label="Close" />}
      >
        <div className="text-[13px] text-hz-text-tertiary">Activity no longer exists.</div>
      </DialogShell>
    )
  }

  const code = activityCodes.find((c) => c._id === activity.activityCodeId)

  const save = async () => {
    const startUtcIso = fromInput(startLocal)
    const endUtcIso = fromInput(endLocal)
    if (!startUtcIso || !endUtcIso) {
      setError('Both start and end times are required.')
      return
    }
    if (new Date(endUtcIso).getTime() <= new Date(startUtcIso).getTime()) {
      setError('End time must be after start time.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.patchCrewActivity(activityId, {
        startUtcIso,
        endUtcIso,
        notes: notes.trim() === '' ? null : notes,
      })
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
    <DialogShell
      title="Edit activity"
      onClose={onClose}
      footer={
        <>
          <DialogCancelButton onClick={onClose} disabled={busy} />
          <DialogPrimaryButton onClick={save} disabled={busy} loading={busy} label="Save" />
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-[13px] text-hz-text-secondary">
          Code:{' '}
          <span className="font-semibold" style={{ color: code?.color ?? 'var(--module-accent)' }}>
            {code?.code ?? '—'}
          </span>
          {code?.name && <span className="text-hz-text-tertiary"> · {code.name}</span>}
        </div>

        <label className="block">
          <div className="text-[13px] font-medium mb-1">Start (UTC)</div>
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)]"
          />
        </label>

        <label className="block">
          <div className="text-[13px] font-medium mb-1">End (UTC)</div>
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)]"
          />
        </label>

        <label className="block">
          <div className="text-[13px] font-medium mb-1">Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)] resize-none"
          />
        </label>

        {error && (
          <div
            className="p-2 rounded-md text-[13px]"
            style={{ backgroundColor: 'rgba(255,59,59,0.18)', color: '#FF6A6A' }}
          >
            {error}
          </div>
        )}
      </div>
    </DialogShell>
  )
}

function toInput(iso: string | undefined): string {
  if (!iso) return ''
  // Truncate to minute precision: "2026-04-21T07:30"
  return iso.slice(0, 16)
}

function fromInput(local: string): string | null {
  if (!local) return null
  return `${local}:00.000Z`
}
