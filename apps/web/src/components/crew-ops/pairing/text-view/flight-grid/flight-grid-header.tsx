'use client'

import { memo, type MouseEvent } from 'react'
import {
  FLIGHT_GRID_COLUMNS,
  HEADER_HEIGHT,
  ROW_NUMBER_WIDTH,
  cellBorder,
  columnHighlightBg,
  type FlightGridColumnKey,
} from './flight-grid-columns'

interface FlightGridHeaderProps {
  isDark: boolean
  highlightedCol: FlightGridColumnKey | null
  allSelected: boolean
  someSelected: boolean
  onSelectAll: (e: MouseEvent) => void
  onSelectColumn: (col: FlightGridColumnKey, e: MouseEvent) => void
}

/**
 * Sticky column-header row. Clicking a column header selects the whole column
 * (visual highlight only — does not change row selection). Clicking the
 * top-left cell toggles "select all rows".
 */
function FlightGridHeaderInner({
  isDark,
  highlightedCol,
  allSelected,
  someSelected,
  onSelectAll,
  onSelectColumn,
}: FlightGridHeaderProps) {
  const headerBg = isDark ? 'rgba(30,30,38,0.98)' : 'rgba(247,247,250,0.98)'
  const textColor = isDark ? '#E4E4EB' : '#1C1C28'
  const borderDivider = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const selectAllBg = allSelected
    ? '#7c3aed'
    : someSelected
      ? isDark
        ? 'rgba(124,58,237,0.35)'
        : 'rgba(124,58,237,0.18)'
      : isDark
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(15,23,42,0.04)'
  return (
    <thead
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: headerBg,
        backdropFilter: 'blur(12px)',
        boxShadow: `inset 0 -1px 0 ${borderDivider}`,
      }}
    >
      <tr style={{ height: HEADER_HEIGHT }}>
        {/* Row-num gutter header — click to toggle select-all */}
        <th
          onMouseDown={onSelectAll}
          style={{
            width: ROW_NUMBER_WIDTH,
            border: cellBorder(isDark),
            background: selectAllBg,
            color: allSelected ? '#fff' : textColor,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: `${HEADER_HEIGHT}px`,
          }}
          title="Select all rows"
        >
          {allSelected ? '✓' : '#'}
        </th>
        {FLIGHT_GRID_COLUMNS.map((col) => {
          const highlighted = highlightedCol === col.key
          return (
            <th
              key={col.key}
              onMouseDown={(e) => onSelectColumn(col.key, e)}
              className="select-none"
              style={{
                width: col.width,
                border: cellBorder(isDark),
                background: highlighted ? columnHighlightBg(isDark) : 'transparent',
                color: textColor,
                textAlign: col.align,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: '0 6px',
                lineHeight: `${HEADER_HEIGHT}px`,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}
              title={`Select column ${col.label}`}
            >
              {col.label}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

export const FlightGridHeader = memo(FlightGridHeaderInner)
