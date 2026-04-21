'use client'

import { useState } from 'react'
import { CheckCircle2, GitCompare, Loader2, Upload, X } from 'lucide-react'
import { api } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface Props {
  onAfterPublish: () => void
}

/**
 * Lightweight top-banner that shows the current publication state:
 *
 *   - When the overlay is NOT active: no banner (keeps the canvas clean).
 *   - When active + a snapshot is loaded: shows the publish time plus a
 *     legend (added / reassigned / removed) and a close button.
 *   - When active but no snapshot exists for the period: shows an
 *     informative banner with a Publish button so the planner can
 *     create the first baseline for this period.
 */
export function CrewSchedulePublishBanner({ onAfterPublish }: Props) {
  const overlay = useCrewScheduleStore((s) => s.publishedOverlay)
  const visible = useCrewScheduleStore((s) => s.publishedOverlayVisible)
  const togglePublishedOverlay = useCrewScheduleStore((s) => s.togglePublishedOverlay)
  const periodFromIso = useCrewScheduleStore((s) => s.periodFromIso)
  const periodToIso = useCrewScheduleStore((s) => s.periodToIso)
  const [busy, setBusy] = useState(false)

  if (!visible) return null

  const publish = async () => {
    setBusy(true)
    try {
      await api.publishCrewSchedule({ periodFromIso, periodToIso })
      await useCrewScheduleStore.getState().togglePublishedOverlay() // close stale overlay
      await useCrewScheduleStore.getState().togglePublishedOverlay() // reopen with fresh snapshot
      onAfterPublish()
    } catch (e) {
      console.error('Publish failed:', e)
    } finally {
      setBusy(false)
    }
  }

  if (!overlay) {
    return (
      <div
        className="px-4 py-2 rounded-xl shrink-0 flex items-center gap-3 mx-3 mt-3"
        style={{
          background: 'rgba(255,136,0,0.12)',
          border: '1px solid rgba(255,136,0,0.35)',
          color: '#FF8800',
        }}
      >
        <GitCompare className="w-4 h-4 shrink-0" />
        <span className="text-[13px] font-medium flex-1">
          No publication covers this period yet. Publish to create a baseline.
        </span>
        <button
          onClick={publish}
          disabled={busy}
          className="h-8 px-3 rounded-md text-[12px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ backgroundColor: '#FF8800' }}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Publish now
        </button>
        <button
          onClick={togglePublishedOverlay}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="px-4 py-2 rounded-xl shrink-0 flex items-center gap-3 mx-3 mt-3"
      style={{
        background: 'rgba(62,123,250,0.10)',
        border: '1px solid rgba(62,123,250,0.35)',
        color: 'var(--module-accent)',
      }}
    >
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span className="text-[13px] font-medium shrink-0">
        Comparing to published{' '}
        <strong className="tabular-nums">
          {overlay.publishedAtUtc.slice(0, 10)} {overlay.publishedAtUtc.slice(11, 16)}Z
        </strong>
      </span>
      <div className="flex items-center gap-3 text-[11px] font-medium">
        <LegendDot color="#06C270" label="Added" />
        <LegendDot color="#FF8800" label="Reassigned" />
        <LegendDot color="#E63535" label="Removed" />
      </div>
      <div className="flex-1" />
      <button
        onClick={publish}
        disabled={busy}
        className="h-8 px-3 rounded-md text-[12px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
        style={{ backgroundColor: 'var(--module-accent)' }}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        Re-publish
      </button>
      <button
        onClick={togglePublishedOverlay}
        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-black/10"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm border"
        style={{ borderColor: color, borderStyle: 'dashed', background: `${color}20` }}
      />
      {label}
    </span>
  )
}
