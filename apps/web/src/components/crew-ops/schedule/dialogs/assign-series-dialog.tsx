'use client'

import { useMemo, useState } from 'react'
import { api, type ActivityCodeRef } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { ActivityCodePicker } from '../activity-code-picker'
import { DialogShell, DialogCancelButton, DialogPrimaryButton } from './dialog-shell'
import { AssignSeriesHero } from './dialog-heroes'

interface Props {
  fromIso: string
  toIso: string
  /** When null the series is scoped to the crew whose cell/block was clicked.
   *  Carried through from context because empty-cell and block menu items
   *  both identify a single crew row. */
  crewId: string | null
  onClose: () => void
  onAfterMutate: () => void
}

/**
 * "Assign series of duties" (AIMS §4.2 / §4.6). Bulk-creates a single
 * activity code across a date range for one crew member. If the crew
 * already has any activity on a given date, that date is skipped by
 * default so the user doesn't accidentally clobber an existing entry.
 */
export function AssignSeriesDialog({ fromIso, toIso, crewId, onClose, onAfterMutate }: Props) {
  const activities = useCrewScheduleStore((s) => s.activities)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const crew = useCrewScheduleStore((s) => s.crew)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const activityGroups = useCrewScheduleStore((s) => s.activityGroups)
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)

  const crewMember = useMemo(() => crew.find((c) => c._id === crewId) ?? null, [crew, crewId])

  const [from, setFrom] = useState(fromIso)
  const [to, setTo] = useState(toIso)
  const [skipExisting, setSkipExisting] = useState(true)
  const [picked, setPicked] = useState<ActivityCodeRef | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)

  const dates = useMemo(() => {
    const fromMs = new Date(from + 'T00:00:00Z').getTime()
    const toMs = new Date(to + 'T00:00:00Z').getTime()
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) return []
    const out: string[] = []
    for (let t = fromMs; t <= toMs; t += 86_400_000) {
      out.push(new Date(t).toISOString().slice(0, 10))
    }
    return out
  }, [from, to])

  /** Dates in the range where this crew already has ANY activity or
   *  assignment — used to pre-compute the "skipped" count and to trim
   *  the payload when `skipExisting` is on. */
  const existingDates = useMemo(() => {
    if (!crewId) return new Set<string>()
    const busyDates = new Set<string>()
    for (const a of activities) {
      if (a.crewId !== crewId) continue
      const d = a.dateIso ?? a.startUtcIso.slice(0, 10)
      busyDates.add(d)
    }
    for (const a of assignments) {
      if (a.crewId !== crewId || a.status === 'cancelled') continue
      const startMs = new Date(a.startUtcIso).getTime()
      const endMs = new Date(a.endUtcIso).getTime()
      for (let t = startMs; t <= endMs; t += 86_400_000) {
        busyDates.add(new Date(t).toISOString().slice(0, 10))
      }
    }
    return busyDates
  }, [activities, assignments, crewId])

  const effective = useMemo(() => {
    if (!skipExisting) return dates
    return dates.filter((d) => !existingDates.has(d))
  }, [dates, existingDates, skipExisting])

  const skipped = dates.length - effective.length

  const confirm = async () => {
    if (!crewId) {
      setError('No crew selected.')
      return
    }
    if (!picked) {
      setError('Pick an activity code.')
      return
    }
    if (effective.length === 0) {
      setError('No dates to assign after skipping.')
      return
    }
    if (effective.length > 90) {
      setError('Range too large (max 90 days).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.createCrewActivitiesBulk({
        activities: effective.map((d) => ({
          crewId,
          activityCodeId: picked._id,
          dateIso: d,
          notes: null,
        })),
      })
      await reconcilePeriod()
      onAfterMutate()
      setResult({ created: res.created.length, skipped })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Success view — small confirmation before the user closes.
  if (result) {
    return (
      <DialogShell
        title="Series assigned"
        onClose={onClose}
        width={440}
        footer={<DialogPrimaryButton onClick={onClose} label="Done" />}
      >
        <div className="space-y-2">
          <div className="text-[13px]">
            Created <span className="font-semibold">{result.created}</span> activit
            {result.created === 1 ? 'y' : 'ies'} across <span className="font-semibold">{dates.length}</span> day
            {dates.length === 1 ? '' : 's'} <span className="text-hz-text-tertiary">({result.skipped} skipped)</span>.
          </div>
        </div>
      </DialogShell>
    )
  }

  return (
    <DialogShell
      title="Assign series of duties"
      heroEyebrow="Bulk fill"
      heroSubtitle="Stamp the same activity across a date range"
      heroSvg={<AssignSeriesHero />}
      onClose={onClose}
      width={540}
      footer={
        <>
          <DialogCancelButton onClick={onClose} disabled={busy} />
          <DialogPrimaryButton
            onClick={confirm}
            disabled={busy || !picked || effective.length === 0 || !crewId}
            loading={busy}
            label={
              effective.length > 0 ? `Assign ${effective.length} day${effective.length === 1 ? '' : 's'}` : 'Assign'
            }
          />
        </>
      }
    >
      <div className="flex flex-col gap-4" style={{ minHeight: 420 }}>
        <div className="text-[13px] text-hz-text-secondary">
          Crew:{' '}
          <span className="font-semibold text-hz-text">
            {crewMember ? `${crewMember.lastName}, ${crewMember.firstName}` : crewId ? crewId.slice(0, 8) : '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[13px] font-medium mb-1">From</div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)]"
            />
          </label>
          <label className="block">
            <div className="text-[13px] font-medium mb-1">To</div>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)]"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-[13px] cursor-pointer">
          <input
            type="checkbox"
            checked={skipExisting}
            onChange={(e) => setSkipExisting(e.target.checked)}
            className="w-4 h-4 accent-[var(--module-accent)]"
          />
          <span>Skip days with existing activities or pairings</span>
        </label>

        <div className="text-[13px] text-hz-text-tertiary">
          {dates.length === 0
            ? 'Pick a valid from/to.'
            : `${effective.length} day${effective.length === 1 ? '' : 's'} will be assigned` +
              (skipped > 0 ? ` · ${skipped} skipped` : '') +
              '.'}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="text-[13px] font-medium mb-2">Activity code</div>
          <div className="flex-1 min-h-0 rounded-lg border border-hz-border/30 p-2" style={{ minHeight: 200 }}>
            <ActivityCodePicker
              activityCodes={activityCodes}
              activityGroups={activityGroups}
              crewPositionId={crewMember?.position ?? null}
              disabled={busy}
              onPick={(code) => setPicked(code)}
              searchPlaceholder="Search activity codes..."
              disableTimeEditor
            />
          </div>
          {picked && (
            <div className="mt-2 text-[13px]">
              Selected:{' '}
              <span className="font-semibold" style={{ color: picked.color ?? 'var(--module-accent)' }}>
                {picked.code}
              </span>
              <span className="text-hz-text-tertiary"> · {picked.name}</span>
            </div>
          )}
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
