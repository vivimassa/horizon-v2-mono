'use client'

import { ChevronDown, ChevronUp, Route } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'

interface PairingZoneOverlayProps {
  width: number
  visibleCount: number
  totalCount: number
  collapsed?: boolean
}

export function PairingZoneOverlay({ collapsed = false }: PairingZoneOverlayProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const toggleZoneOpen = usePairingGanttStore((s) => s.toggleZoneOpen)

  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div
      className="shrink-0 flex items-center justify-between px-3"
      style={{
        height: 32,
        width: '100%',
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
        borderTop: `1px solid ${border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Route size={14} className="text-hz-text-tertiary" />
        <span className="text-[13px] font-semibold text-hz-text">Completed Pairings</span>
      </div>
      <button
        type="button"
        onClick={toggleZoneOpen}
        className="p-1 rounded hover:bg-hz-border/30 transition-colors"
        aria-label={collapsed ? 'Expand pairing zone' : 'Collapse pairing zone'}
      >
        {collapsed ? (
          <ChevronUp size={14} className="text-hz-text-tertiary" />
        ) : (
          <ChevronDown size={14} className="text-hz-text-tertiary" />
        )}
      </button>
    </div>
  )
}
