'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Moon, Minus, Plus, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'

/**
 * Floating chip that replaces the right-click menu in-place after the planner
 * picks "Layover at {ARR}". Shows the station + a `− N +` night stepper + a
 * close button. The chip dismisses itself when:
 *  - Escape is pressed
 *  - The user clicks outside the chip
 *  - The next flight is added to the selection (handled in `flight-pool-panel`)
 *
 * Anchors to the viewport coords of the originating right-click so the chip
 * replaces the menu exactly where the planner last interacted.
 */
export function LayoverChip() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const mode = usePairingStore((s) => s.layoverMode)
  const setLayoverDays = usePairingStore((s) => s.setLayoverDays)
  const clearLayover = usePairingStore((s) => s.clearLayover)

  useEffect(() => {
    if (!mode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearLayover()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // Note: we intentionally do NOT dismiss on click-outside. The chip is
    // meant to stay alive across the next flight-grid click (Ctrl+click to
    // add the return leg) — the grow-selection effect in `flight-pool-panel`
    // clears the mode once the second flight lands. Dismissing here would
    // race with the swap logic and lose the layover intent.
  }, [mode, clearLayover])

  if (!mode || typeof document === 'undefined') return null

  const chipW = 280
  const chipH = 56
  const left = Math.min(mode.anchorX, window.innerWidth - chipW - 8)
  const top = Math.min(mode.anchorY, window.innerHeight - chipH - 8)

  const bg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const accent = '#7c3aed'

  return createPortal(
    <div
      data-layover-chip
      className="fixed rounded-lg overflow-hidden flex items-center"
      style={{
        left,
        top,
        width: chipW,
        height: chipH,
        background: bg,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.55)' : '0 12px 40px rgba(96,97,112,0.25)',
        backdropFilter: 'blur(18px)',
        zIndex: 1000,
        paddingLeft: 10,
        paddingRight: 8,
        gap: 10,
      }}
    >
      <Moon size={16} strokeWidth={2} style={{ color: accent, flexShrink: 0 }} />

      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: textMuted }}>
          Layover
        </span>
        <span className="text-[13px] font-semibold tabular-nums truncate" style={{ color: textPrimary }}>
          at {mode.station} · {mode.days} night{mode.days === 1 ? '' : 's'}
        </span>
      </div>

      <div
        className="inline-flex items-center rounded-md overflow-hidden"
        style={{ border: `1px solid ${border}`, height: 28 }}
      >
        <button
          type="button"
          onClick={() => setLayoverDays(mode.days - 1)}
          disabled={mode.days <= 1}
          className="w-7 h-7 inline-flex items-center justify-center transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            color: textPrimary,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
          }}
          aria-label="Decrease layover nights"
        >
          <Minus size={13} strokeWidth={2.4} />
        </button>
        <span
          className="inline-flex items-center justify-center tabular-nums font-bold text-[13px]"
          style={{ width: 26, color: textPrimary }}
        >
          {mode.days}
        </span>
        <button
          type="button"
          onClick={() => setLayoverDays(mode.days + 1)}
          className="w-7 h-7 inline-flex items-center justify-center transition-colors"
          style={{
            color: textPrimary,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
          }}
          aria-label="Increase layover nights"
        >
          <Plus size={13} strokeWidth={2.4} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => clearLayover()}
        className="p-1 rounded-md transition-colors hover:bg-black/10 shrink-0"
        style={{ color: textMuted }}
        aria-label="Cancel layover"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>,
    document.body,
  )
}
