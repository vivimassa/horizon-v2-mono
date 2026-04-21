'use client'

import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, StickyNote, Tag, User, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'
import { CrewScheduleMemoPanel } from './crew-schedule-memo-panel'

interface Props {
  onAfterMutate: () => void
}

/**
 * Shared memo modal invoked from the context menus' Alt+M items. Renders
 * the existing `<CrewScheduleMemoPanel>` with a scope-specific header
 * (pairing code · crew name · crew + date), so the composer flow is the
 * same across §4.2 (pairing), §4.3 (day), and §4.5 (crew).
 */
export function CrewScheduleMemoOverlay({ onAfterMutate }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const overlay = useCrewScheduleStore((s) => s.memoOverlay)
  const close = useCrewScheduleStore((s) => s.closeMemoOverlay)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const crew = useCrewScheduleStore((s) => s.crew)
  const fmtDate = useDateFormat()

  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlay, close])

  const header = useMemo(() => {
    if (!overlay) return null
    if (overlay.scope === 'pairing') {
      const p = pairings.find((pp) => pp._id === overlay.targetId)
      return { icon: Tag, title: 'Pairing memo', subtitle: p?.pairingCode ?? '—' }
    }
    if (overlay.scope === 'crew') {
      const c = crew.find((cc) => cc._id === overlay.targetId)
      return { icon: User, title: 'Crew memo', subtitle: c ? `${c.lastName} ${c.firstName}` : '—' }
    }
    const c = crew.find((cc) => cc._id === overlay.crewId)
    return {
      icon: CalendarDays,
      title: 'Day memo',
      subtitle: `${c ? `${c.lastName} ${c.firstName}` : '—'} · ${fmtDate(overlay.dateIso)}`,
    }
  }, [overlay, pairings, crew, fmtDate])

  if (!overlay || !header) return null
  const Icon = header.icon

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-[92vw] max-h-[75vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <StickyNote className="w-5 h-5 shrink-0" style={{ color: '#F9B429' }} />
            <div className="min-w-0">
              <div className="text-[15px] font-bold truncate">{header.title}</div>
              <div className="text-[11px] text-hz-text-secondary tabular-nums flex items-center gap-1.5">
                <Icon className="w-3 h-3" />
                {header.subtitle}
              </div>
            </div>
          </div>
          <button onClick={close} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-hz-border/20">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <CrewScheduleMemoPanel
            scope={overlay.scope}
            targetId={overlay.scope === 'day' ? overlay.crewId : overlay.targetId}
            dateIso={overlay.scope === 'day' ? overlay.dateIso : undefined}
            onAfterMutate={onAfterMutate}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
