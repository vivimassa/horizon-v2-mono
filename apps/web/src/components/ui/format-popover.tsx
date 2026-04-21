'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/components/theme-provider'

/**
 * Shared Format popover — renders row-height, range, and (optionally)
 * refresh-interval steppers with identical styling across Gantt pages
 * (2.1.1 Movement Control, 4.1.6 Crew Schedule).
 *
 * Controlled: caller owns `open` + the anchor ref; the popover reads the
 * anchor's bounding rect once on open and positions itself below it.
 * Closes on outside-click or Escape.
 */
export interface FormatPopoverRowHeight {
  /** Display label, e.g. `44` for "44 px" — the popover shows raw value. */
  displayValue: string | number
  canDecrement: boolean
  canIncrement: boolean
  onDecrement: () => void
  onIncrement: () => void
}

export interface FormatPopoverRange {
  /** Display label, e.g. "3D" or "M". */
  displayValue: string
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

export interface FormatPopoverRefreshInterval {
  valueMins: number
  minMins?: number
  maxMins?: number
  onChange: (mins: number) => void
}

export interface FormatPopoverProps {
  open: boolean
  onClose: () => void
  /** The ref of the button that triggers this popover. */
  anchorRef: RefObject<HTMLElement | null>
  rowHeight: FormatPopoverRowHeight
  range: FormatPopoverRange
  /** Omit to hide the refresh-interval stepper (pages without auto-refresh). */
  refreshInterval?: FormatPopoverRefreshInterval
  /** Popover width in px. Default 200. */
  width?: number
}

export function FormatPopover({
  open,
  onClose,
  anchorRef,
  rowHeight,
  range,
  refreshInterval,
  width = 200,
}: FormatPopoverProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  const dropRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Position below the anchor whenever it opens.
  useEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left })
  }, [open, anchorRef])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const refreshMin = refreshInterval?.minMins ?? 5
  const refreshMax = refreshInterval?.maxMins ?? 59

  return createPortal(
    <div
      ref={dropRef}
      className="fixed z-[9999] rounded-xl p-3 select-none space-y-3"
      style={{
        top: pos.top,
        left: pos.left,
        width,
        background: panelBg,
        border: `1px solid ${panelBorder}`,
        backdropFilter: 'blur(24px)',
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
      }}
    >
      <Stepper
        label="Row Height"
        value={String(rowHeight.displayValue)}
        onDecrement={rowHeight.onDecrement}
        onIncrement={rowHeight.onIncrement}
        canDecrement={rowHeight.canDecrement}
        canIncrement={rowHeight.canIncrement}
        panelBorder={panelBorder}
        hoverBg={hoverBg}
      />
      <Stepper
        label="Range"
        value={range.displayValue}
        onDecrement={range.onPrev}
        onIncrement={range.onNext}
        canDecrement={range.canPrev}
        canIncrement={range.canNext}
        panelBorder={panelBorder}
        hoverBg={hoverBg}
      />
      {refreshInterval && (
        <Stepper
          label="Refresh Interval"
          value={`${refreshInterval.valueMins}m`}
          onDecrement={() => refreshInterval.onChange(Math.max(refreshMin, refreshInterval.valueMins - 1))}
          onIncrement={() => refreshInterval.onChange(Math.min(refreshMax, refreshInterval.valueMins + 1))}
          canDecrement={refreshInterval.valueMins > refreshMin}
          canIncrement={refreshInterval.valueMins < refreshMax}
          panelBorder={panelBorder}
          hoverBg={hoverBg}
        />
      )}
    </div>,
    document.body,
  )
}

interface StepperProps {
  label: string
  value: string
  onDecrement: () => void
  onIncrement: () => void
  canDecrement: boolean
  canIncrement: boolean
  panelBorder: string
  hoverBg: string
}

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  canDecrement,
  canIncrement,
  panelBorder,
  hoverBg,
}: StepperProps) {
  return (
    <div>
      <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">{label}</div>
      <div className="flex items-center justify-center">
        <button
          onClick={onDecrement}
          disabled={!canDecrement}
          className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30"
          style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
          onMouseEnter={(e) => {
            if (canDecrement) e.currentTarget.style.background = hoverBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          −
        </button>
        <div
          className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text"
          style={{
            width: 56,
            height: 36,
            borderTop: `1px solid ${panelBorder}`,
            borderBottom: `1px solid ${panelBorder}`,
          }}
        >
          {value}
        </div>
        <button
          onClick={onIncrement}
          disabled={!canIncrement}
          className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30"
          style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
          onMouseEnter={(e) => {
            if (canIncrement) e.currentTarget.style.background = hoverBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
