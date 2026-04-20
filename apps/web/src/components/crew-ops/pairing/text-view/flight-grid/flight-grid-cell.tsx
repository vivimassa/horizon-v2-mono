'use client'

import { memo, type MouseEvent } from 'react'
import type { FlightGridColumn, FlightGridColumnKey } from './flight-grid-columns'
import { SELECTION_COLOR, cellBorder, rangeBg, columnHighlightBg } from './flight-grid-columns'

interface FlightGridCellProps {
  column: FlightGridColumn
  value: string
  isActive: boolean
  isInRange: boolean
  isColumnHighlighted: boolean
  /** Covered row = already in a pairing; force a more muted look. */
  isCovered: boolean
  isDark: boolean
  rowIdx: number
  onMouseDown: (rowIdx: number, col: FlightGridColumnKey, e: MouseEvent) => void
  onMouseEnter: (rowIdx: number, col: FlightGridColumnKey, e: MouseEvent) => void
  /** Status cell uses colored text (Active=green, Suspended=orange, etc). */
  statusColor?: string | null
  /** Render text in the module accent (used by tail + pairing cells with a value). */
  accentText?: boolean
}

/**
 * Read-only cell for the Flight Pool grid. No editing, no double-click.
 * Excel-style focus outline (inset 2px green), range wash in violet, column
 * highlight when the whole column is selected, greyed text when covered.
 */
function FlightGridCellInner({
  column,
  value,
  isActive,
  isInRange,
  isColumnHighlighted,
  isCovered,
  isDark,
  rowIdx,
  onMouseDown,
  onMouseEnter,
  statusColor,
  accentText,
}: FlightGridCellProps) {
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textMuted = isDark ? '#8F90A6' : '#8F90A6'
  const text = isCovered ? textMuted : (statusColor ?? (accentText ? '#7c3aed' : textPrimary))

  // Layered background: column highlight (bottom), range wash (middle).
  // Active outline is drawn via `outline` so it doesn't bump layout.
  let background = 'transparent'
  if (isInRange) background = rangeBg(isDark)
  else if (isColumnHighlighted) background = columnHighlightBg(isDark)

  return (
    <td
      data-col-key={column.key}
      onMouseDown={(e) => onMouseDown(rowIdx, column.key, e)}
      onMouseEnter={(e) => onMouseEnter(rowIdx, column.key, e)}
      className="select-none"
      style={{
        width: column.width,
        border: cellBorder(isDark),
        padding: '0 6px',
        textAlign: column.align,
        background,
        color: text,
        fontFamily: column.mono ? "'JetBrains Mono', ui-monospace, monospace" : 'Inter, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: accentText ? 600 : 400,
        lineHeight: '28px',
        cursor: 'cell',
        outline: isActive ? `2px solid ${SELECTION_COLOR}` : 'none',
        outlineOffset: -2,
        position: 'relative',
      }}
    >
      {value}
    </td>
  )
}

export const FlightGridCell = memo(FlightGridCellInner)
