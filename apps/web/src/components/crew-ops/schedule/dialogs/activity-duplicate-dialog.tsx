'use client'

import { useMemo, useState } from 'react'
import { api } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { DialogShell, DialogCancelButton, DialogPrimaryButton } from './dialog-shell'

interface Props {
  activityId: string
  onClose: () => void
  onAfterMutate: () => void
}

/**
 * Duplicate an activity across a date range. Uses the same activity code
 * as the source — "change the code too" is a separate workflow (Change
 * code dialog). Each generated date becomes a single-day activity via
 * POST /crew-schedule/activities/bulk.
 *
 * Defaults: from = day after the source's date, to = that + 6 days. User
 * can edit freely; range-length guard rail is enforced at 90 days to
 * prevent a runaway fat-finger.
 */
export function ActivityDuplicateDialog({ activityId, onClose, onAfterMutate }: Props) {
  const activity = useCrewScheduleStore((s) => s.activities.find((a) => a._id === activityId) ?? null)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)

  const sourceDate = activity?.dateIso ?? activity?.startUtcIso.slice(0, 10) ?? ''
  const [fromIso, setFromIso] = useState(() => addDays(sourceDate, 1))
  const [toIso, setToIso] = useState(() => addDays(sourceDate, 7))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dates = useMemo(() => {
    if (!fromIso || !toIso) return []
    const from = new Date(fromIso + 'T00:00:00Z').getTime()
    const to = new Date(toIso + 'T00:00:00Z').getTime()
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) return []
    const out: string[] = []
    for (let t = from; t <= to; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10))
    return out
  }, [fromIso, toIso])

  if (!activity) {
    return (
      <DialogShell
        title="Duplicate activity"
        onClose={onClose}
        footer={<DialogCancelButton onClick={onClose} label="Close" />}
      >
        <div className="text-[13px] text-hz-text-tertiary">Activity no longer exists.</div>
      </DialogShell>
    )
  }

  const code = activityCodes.find((c) => c._id === activity.activityCodeId)

  const confirm = async () => {
    if (dates.length === 0) {
      setError('Select a valid date range.')
      return
    }
    if (dates.length > 90) {
      setError('Range too large (max 90 days).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.createCrewActivitiesBulk({
        activities: dates.map((d) => ({
          crewId: activity.crewId,
          activityCodeId: activity.activityCodeId,
          dateIso: d,
          notes: activity.notes ?? null,
        })),
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
      title="Duplicate across dates"
      onClose={onClose}
      footer={
        <>
          <DialogCancelButton onClick={onClose} disabled={busy} />
          <DialogPrimaryButton
            onClick={confirm}
            disabled={busy || dates.length === 0}
            loading={busy}
            label={dates.length > 0 ? `Duplicate ${dates.length} day${dates.length === 1 ? '' : 's'}` : 'Duplicate'}
          />
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
          <div className="text-[13px] text-hz-text-tertiary mt-1">Source date: {sourceDate || '—'}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[13px] font-medium mb-1">From</div>
            <input
              type="date"
              value={fromIso}
              onChange={(e) => setFromIso(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)]"
            />
          </label>
          <label className="block">
            <div className="text-[13px] font-medium mb-1">To</div>
            <input
              type="date"
              value={toIso}
              onChange={(e) => setToIso(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)]"
            />
          </label>
        </div>

        <div className="text-[13px] text-hz-text-tertiary">
          {dates.length === 0
            ? 'Pick a valid from/to.'
            : `Will create ${dates.length} activit${dates.length === 1 ? 'y' : 'ies'}.`}
        </div>

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

function addDays(iso: string, days: number): string {
  if (!iso) return ''
  const t = new Date(iso + 'T00:00:00Z').getTime()
  if (Number.isNaN(t)) return ''
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10)
}
