'use client'

import { useEffect, useMemo, useState } from 'react'
import { GitCompare, Plane } from 'lucide-react'
import { api, type PairingScheduleChangesRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'
import { DialogShell, DialogCancelButton } from './dialog-shell'
import { FlightChangesHero } from './dialog-heroes'

/**
 * Phase 4 — "Flight schedule changes" dialog, opened from the pairing
 * context menu. Lists per-leg STD/STA deltas between the pairing's
 * frozen leg times and the current FlightInstance docs.
 *
 * TODO: Today this is ad-hoc delta detection. A proper flight-amendment
 * audit log on the FlightInstance model should replace it, so we can
 * surface the individual change events (who, when, why) rather than
 * just the net diff.
 */
export function FlightScheduleChangesDialog() {
  const dialog = useCrewScheduleStore((s) => s.flightScheduleChangesDialog)
  const close = useCrewScheduleStore((s) => s.closeFlightScheduleChangesDialog)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [data, setData] = useState<PairingScheduleChangesRef | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const localPairing = useMemo(
    () => (dialog ? pairings.find((p) => p._id === dialog.pairingId) : null),
    [dialog, pairings],
  )

  useEffect(() => {
    if (!dialog) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    api
      .getPairingScheduleChanges(dialog.pairingId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dialog])

  if (!dialog) return null

  const pairingCode = data?.pairingCode ?? localPairing?.pairingCode ?? '?'
  const changedLegs = data?.changes.filter((c) => c.hasChange) ?? []

  return (
    <DialogShell
      title={`Flight schedule changes · ${pairingCode}`}
      heroEyebrow="Schedule delta"
      heroSubtitle={
        changedLegs.length === 0
          ? 'No deltas vs the frozen pairing'
          : `${changedLegs.length} leg${changedLegs.length === 1 ? '' : 's'} drifted vs the frozen pairing`
      }
      heroSvg={<FlightChangesHero />}
      onClose={close}
      width={640}
      footer={<DialogCancelButton onClick={close} label="Close" />}
    >
      {loading && (
        <div
          className="flex items-center justify-center py-10 text-[13px]"
          style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}
        >
          Loading schedule changes…
        </div>
      )}

      {!loading && error && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg text-[13px]"
          style={{
            background: 'rgba(230,53,53,0.10)',
            border: '1px solid rgba(230,53,53,0.35)',
            color: '#E63535',
          }}
        >
          <GitCompare className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Could not load schedule changes</div>
            <div className="text-[12px] opacity-80">{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && data && changedLegs.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-12 gap-2"
          style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}
        >
          <GitCompare className="w-8 h-8" />
          <div className="text-[13px] font-medium">No schedule changes since pairing commit</div>
          <div className="text-[12px]">Last committed: {fmtIso(data.pairingCommittedAt)}</div>
        </div>
      )}

      {!loading && !error && data && changedLegs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            className="text-[12px] rounded-md px-3 py-2 mb-1"
            style={{
              background: isDark ? 'rgba(255,136,0,0.10)' : 'rgba(255,136,0,0.12)',
              color: '#FF8800',
              border: '1px solid rgba(255,136,0,0.30)',
            }}
          >
            {changedLegs.length} of {data.changes.length} legs changed since this pairing was saved (
            {fmtIso(data.pairingCommittedAt)}).
          </div>
          {data.changes.map((leg) => (
            <LegRow key={`${leg.flightId}-${leg.flightDate}-${leg.legOrder}`} leg={leg} isDark={isDark} />
          ))}
        </div>
      )}
    </DialogShell>
  )
}

function LegRow({ leg, isDark }: { leg: PairingScheduleChangesRef['changes'][number]; isDark: boolean }) {
  const fmtDate = useDateFormat()
  const hasStdDelta = leg.stdDeltaMin !== null && leg.stdDeltaMin !== 0
  const hasStaDelta = leg.staDeltaMin !== null && leg.staDeltaMin !== 0
  const changed = hasStdDelta || hasStaDelta
  const missing = leg.instanceMissing

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        opacity: changed || missing ? 1 : 0.55,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Plane className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--module-accent)' }} />
        <div className="text-[13px] font-semibold">{leg.flightNumber}</div>
        <div className="text-[13px] tabular-nums" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
          {leg.depStation} → {leg.arrStation}
        </div>
        <div className="text-[13px] tabular-nums" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
          · {fmtDate(leg.flightDate)}
        </div>
      </div>

      {missing ? (
        <div className="text-[13px]" style={{ color: '#E63535' }}>
          Flight instance not found — may have been cancelled or re-keyed.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <TimeDelta
            label="STD"
            oldIso={leg.pairingStdUtcIso}
            newMs={leg.currentStdUtcMs}
            deltaMin={leg.stdDeltaMin}
            isDark={isDark}
          />
          <TimeDelta
            label="STA"
            oldIso={leg.pairingStaUtcIso}
            newMs={leg.currentStaUtcMs}
            deltaMin={leg.staDeltaMin}
            isDark={isDark}
          />
        </div>
      )}

      {leg.lastChangedAtMs !== null && (
        <div className="mt-1.5 text-[13px] tabular-nums" style={{ color: isDark ? '#6B6C7B' : '#9A9BA8' }}>
          Flight updated: {fmtMs(leg.lastChangedAtMs)}
        </div>
      )}
    </div>
  )
}

function TimeDelta({
  label,
  oldIso,
  newMs,
  deltaMin,
  isDark,
}: {
  label: string
  oldIso: string
  newMs: number | null
  deltaMin: number | null
  isDark: boolean
}) {
  const changed = deltaMin !== null && deltaMin !== 0
  const sign = deltaMin !== null && deltaMin > 0 ? '+' : ''
  const deltaColor = deltaMin === null ? undefined : deltaMin > 0 ? '#FF8800' : '#06C270'

  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[13px]" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="text-[13px] tabular-nums"
          style={{
            color: isDark ? '#A7A9B5' : '#6B6C7B',
            textDecoration: changed ? 'line-through' : 'none',
          }}
        >
          {fmtIso(oldIso)}
        </span>
        {changed && newMs !== null && (
          <>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
              {fmtMs(newMs)}
            </span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: deltaColor }}>
              {sign}
              {deltaMin}m
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function fmtIso(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return fmtDate(d)
}

function fmtMs(ms: number | null): string {
  if (ms === null) return '—'
  return fmtDate(new Date(ms))
}

function fmtDate(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mo}-${da} ${hh}:${mm}Z`
}
