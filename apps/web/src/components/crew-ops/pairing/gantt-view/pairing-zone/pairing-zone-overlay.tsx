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

/**
 * Left-overlay panel for the Pairing Zone. Always visible at the leftmost
 * 180px of the zone (matching the grid's axis gutter). Shows:
 *   - Pairings count pill
 *   - Collapse chevron
 *
 * When the whole zone is collapsed (caller sets `collapsed=true`), only the
 * count row + chevron render — saves 32px of real estate at the bottom of
 * the frame.
 */
export function PairingZoneOverlay({ width, visibleCount, totalCount, collapsed = false }: PairingZoneOverlayProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const toggleZoneOpen = usePairingGanttStore((s) => s.toggleZoneOpen)

  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  if (collapsed) {
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
          <span className="text-[13px] font-medium text-hz-text-secondary">Pairings</span>
          <span
            className="px-2 py-0.5 rounded-full text-[13px] font-semibold tabular-nums"
            style={{
              background:
                totalCount > 0 ? 'color-mix(in srgb, var(--module-accent, #1e40af) 15%, transparent)' : 'transparent',
              color: totalCount > 0 ? 'var(--module-accent, #1e40af)' : 'var(--hz-text-tertiary)',
            }}
          >
            {totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleZoneOpen}
          className="p-1 rounded hover:bg-hz-border/30 transition-colors"
          aria-label="Expand pairing zone"
        >
          <ChevronUp size={14} className="text-hz-text-tertiary" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="shrink-0 flex flex-col overflow-hidden"
      style={{
        width,
        borderRight: `1px solid ${border}`,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{ height: 32, borderBottom: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-1.5">
          <Route size={14} className="text-hz-text-tertiary" />
          <span className="text-[13px] font-semibold text-hz-text">Pairings</span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[13px] font-bold tabular-nums"
            style={{
              background: 'color-mix(in srgb, var(--module-accent, #1e40af) 15%, transparent)',
              color: 'var(--module-accent, #1e40af)',
            }}
          >
            {visibleCount}
            {visibleCount !== totalCount && `/${totalCount}`}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleZoneOpen}
          className="p-1 rounded hover:bg-hz-border/30 transition-colors"
          aria-label="Collapse pairing zone"
        >
          <ChevronDown size={14} className="text-hz-text-tertiary" />
        </button>
      </div>
    </div>
  )
}
