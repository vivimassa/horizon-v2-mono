'use client'

import { memo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ActivityCodeRef, CrewActivityRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'

interface Props {
  activity: CrewActivityRef
  code: ActivityCodeRef | null
  clientX: number
  clientY: number
}

function formatTimeInTz(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso.slice(11, 16)
  }
}

function useFollowCursor(initialClientX: number, initialClientY: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    function reposition(x: number, y: number) {
      if (!el) return
      const tw = el.offsetWidth
      const th = el.offsetHeight
      const MARGIN = 14
      const EDGE_PAD = 8
      const vpW = window.innerWidth
      const vpH = window.innerHeight
      let left = x + MARGIN
      let top = y - MARGIN - th
      if (top < EDGE_PAD) top = y + MARGIN
      if (top + th > vpH - EDGE_PAD) top = vpH - th - EDGE_PAD
      if (top < EDGE_PAD) top = EDGE_PAD
      if (left + tw > vpW - EDGE_PAD) left = x - tw - MARGIN
      if (left < EDGE_PAD) left = EDGE_PAD
      el.style.left = left + 'px'
      el.style.top = top + 'px'
      el.style.visibility = 'visible'
    }
    reposition(initialClientX, initialClientY)
    const onMove = (e: MouseEvent) => reposition(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [initialClientX, initialClientY])
  return ref
}

export const ActivityHoverTooltip = memo(function ActivityHoverTooltip({ activity, code, clientX, clientY }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const operatorTz = useOperatorStore((s) => s.operator?.timezone ?? 'UTC')
  const ref = useFollowCursor(clientX, clientY)

  if (typeof document === 'undefined') return null

  const pillBg = code?.color ?? '#3E7BFA'
  const label = code?.shortLabel ?? code?.code ?? '—'
  const name = code?.name ?? 'Activity'
  const flags = (code?.flags ?? []) as string[]
  const isStandby =
    flags.includes('is_home_standby') ||
    flags.includes('is_airport_standby') ||
    flags.includes('is_reserve') ||
    code?.code === 'SBY'
  // Standby always shows its time window — min/max duration is policy, not
  // an all-day block. Other timed codes still gated by `requiresTime`.
  const hasWindow = (isStandby || code?.requiresTime) && !!activity.startUtcIso && !!activity.endUtcIso
  const from = hasWindow ? formatTimeInTz(activity.startUtcIso, operatorTz) : null
  const to = hasWindow ? formatTimeInTz(activity.endUtcIso, operatorTz) : null

  // Source label — prefer the structured `sourceRunId` field; fall back to
  // the legacy `notes: 'auto-roster:<runId>'` convention for rows written
  // before the schema field was added.
  const isAuto =
    !!(activity as { sourceRunId?: string | null }).sourceRunId ||
    (!!activity.notes && /^auto-roster:/.test(activity.notes))
  const sourceLabel = isAuto
    ? 'AUTO'
    : activity.assignedByUserId
      ? `ASSIGNED BY USER ${activity.assignedByUserId}`
      : null

  const bg = isDark ? 'rgba(244,244,245,0.92)' : 'rgba(24,24,27,0.88)'
  const border = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const heading = isDark ? '#18181b' : '#fafafa'
  const muted = isDark ? 'rgba(24,24,27,0.55)' : 'rgba(250,250,250,0.55)'

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        visibility: 'hidden',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        className="rounded-xl px-3 py-2.5 text-[13px]"
        style={{
          background: bg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          minWidth: 200,
          maxWidth: 320,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="font-bold text-[13px] px-2 py-0.5 rounded shrink-0 text-white tabular-nums"
            style={{ background: pillBg }}
          >
            {label}
          </span>
          <span className="font-medium truncate" style={{ color: heading }}>
            {name}
          </span>
        </div>
        {hasWindow && (
          <div className="mt-1.5 flex items-center gap-3 text-[12px] tabular-nums" style={{ color: muted }}>
            <span>
              <span className="uppercase tracking-wider text-[10px] font-semibold mr-1">From</span>
              <span style={{ color: heading }}>{from}</span>
            </span>
            <span>
              <span className="uppercase tracking-wider text-[10px] font-semibold mr-1">To</span>
              <span style={{ color: heading }}>{to}</span>
            </span>
          </div>
        )}
        {sourceLabel && (
          <div className="mt-1.5 text-[11px] font-medium tracking-wider uppercase" style={{ color: muted }}>
            {sourceLabel}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
})
