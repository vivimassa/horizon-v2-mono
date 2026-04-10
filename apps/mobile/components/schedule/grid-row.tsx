import { memo, useCallback } from 'react'
import { View, Pressable } from 'react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import type { ScheduledFlightRef } from '@skyhub/api'
import type { CellAddress, CellFormat, ClipboardData } from './types'
import { GRID_COLUMNS, ROW_HEIGHT } from './grid-columns'
import { GridCell } from './grid-cell'
import { getConditionalFormat } from './conditional-format-rules'

interface GridRowProps {
  flight: ScheduledFlightRef
  rowIdx: number
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>
  selectedCell: CellAddress | null
  editingCell: CellAddress | null
  editValue: string
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null
  clipboard: ClipboardData | null
  cellFormats: Map<string, CellFormat>
  tatMinutes: number | null
  isNew: boolean
  isDirty: boolean
  isDeleted: boolean
  hasSeparator: boolean
  onCellTap: (cell: CellAddress) => void
  onCellDoubleTap: (cell: CellAddress) => void
  onEditChange: (v: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onLongPress: (id: string) => void
  palette: Palette
  accent: string
  isDark: boolean
}

export const GridRow = memo(function GridRow({
  flight, rowIdx, dirtyMap, selectedCell, editingCell, editValue,
  selectionRange, clipboard, cellFormats, tatMinutes,
  isNew, isDirty, isDeleted, hasSeparator,
  onCellTap, onCellDoubleTap, onEditChange, onCommitEdit, onCancelEdit, onLongPress,
  palette, accent, isDark,
}: GridRowProps) {
  const isCancelled = flight.status === 'cancelled'
  const isSuspended = flight.status === 'suspended'
  const isRowSelected = selectedCell?.rowIdx === rowIdx

  // Row-level background
  const rowBg = isDeleted
    ? (isDark ? 'rgba(220,38,38,0.06)' : 'rgba(220,38,38,0.03)')
    : isCancelled
    ? (isDark ? 'rgba(220,38,38,0.04)' : 'rgba(220,38,38,0.02)')
    : isSuspended
    ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)')
    : isDirty
    ? (isDark ? 'rgba(255,136,0,0.04)' : 'rgba(255,136,0,0.02)')
    : undefined

  const getVal = useCallback((colKey: string): string => {
    // TAT is computed externally
    if (colKey === 'tat') return tatMinutes != null ? String(tatMinutes) : ''

    const dirty = dirtyMap.get(flight._id)
    const val = dirty && colKey in dirty ? (dirty as any)[colKey] : (flight as any)[colKey]

    // Compute BLOCK from STD/STA if not stored
    if (colKey === 'blockMinutes' && (val == null || val === 0)) {
      const std = dirty?.stdUtc ?? flight.stdUtc
      const sta = dirty?.staUtc ?? flight.staUtc
      if (std && sta) {
        const stdClean = String(std).replace(':', '')
        const staClean = String(sta).replace(':', '')
        if (stdClean.length >= 4 && staClean.length >= 4) {
          const stdMin = parseInt(stdClean.slice(0, 2)) * 60 + parseInt(stdClean.slice(2, 4))
          const staMin = parseInt(staClean.slice(0, 2)) * 60 + parseInt(staClean.slice(2, 4))
          let diff = staMin - stdMin
          if (diff < 0) diff += 1440
          return String(diff)
        }
      }
    }

    return val != null ? String(val) : ''
  }, [flight, dirtyMap])

  const isInRange = useCallback((colIdx: number): boolean => {
    if (!selectionRange) return false
    const r1 = Math.min(selectionRange.startRow, selectionRange.endRow)
    const r2 = Math.max(selectionRange.startRow, selectionRange.endRow)
    const c1 = Math.min(selectionRange.startCol, selectionRange.endCol)
    const c2 = Math.max(selectionRange.startCol, selectionRange.endCol)
    return rowIdx >= r1 && rowIdx <= r2 && colIdx >= c1 && colIdx <= c2
  }, [rowIdx, selectionRange])

  const isClipboardCell = useCallback((colKey: string): boolean => {
    if (!clipboard) return false
    return clipboard.rowIds.includes(flight._id) && clipboard.colKeys.includes(colKey)
  }, [flight._id, clipboard])

  return (
    <View>
      <View className="flex-row" style={{
        height: ROW_HEIGHT,
        backgroundColor: rowBg,
        borderLeftWidth: isDirty || isNew ? 3 : 0,
        borderLeftColor: isNew ? '#16a34a' : accent,
        opacity: isDeleted ? 0.4 : isSuspended ? 0.6 : 1,
        flex: 1,
      }}>
        {GRID_COLUMNS.map((col, colIdx) => {
          const isSel = selectedCell?.rowIdx === rowIdx && selectedCell?.colKey === col.key
          const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === col.key
          const cellFmt = cellFormats.get(`${flight._id}:${col.key}`)
          const condFmt = getConditionalFormat(flight, col.key)

          return (
            <GridCell
              key={col.key}
              flight={flight}
              col={col}
              value={getVal(col.key)}
              isEditing={isEditing}
              editValue={editValue}
              onEditChange={onEditChange}
              isSelected={isSel}
              isInRange={isInRange(colIdx)}
              isClipboard={isClipboardCell(col.key)}
              clipboardMode={clipboard?.mode ?? null}
              cellFormat={cellFmt}
              condFormat={condFmt}
              onTap={() => onCellTap({ rowIdx, colKey: col.key })}
              onDoubleTap={() => onCellDoubleTap({ rowIdx, colKey: col.key })}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              palette={palette}
              accent={accent}
              isDark={isDark}
              isDeleted={isDeleted}
              isCancelled={isCancelled}
            />
          )
        })}
      </View>
      {hasSeparator && (
        <View style={{
          height: 12,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }} />
      )}
    </View>
  )
}, (prev, next) => {
  // Custom equality — only re-render if row-relevant state changed
  if (prev.flight !== next.flight) return false
  if (prev.rowIdx !== next.rowIdx) return false
  if (prev.isDirty !== next.isDirty) return false
  if (prev.isNew !== next.isNew) return false
  if (prev.isDeleted !== next.isDeleted) return false
  if (prev.hasSeparator !== next.hasSeparator) return false
  if (prev.isDark !== next.isDark) return false
  // Check if this row has selection
  const prevHasSel = prev.selectedCell?.rowIdx === prev.rowIdx
  const nextHasSel = next.selectedCell?.rowIdx === next.rowIdx
  if (prevHasSel !== nextHasSel) return false
  if (nextHasSel && prev.selectedCell?.colKey !== next.selectedCell?.colKey) return false
  // Check editing
  const prevEditing = prev.editingCell?.rowIdx === prev.rowIdx
  const nextEditing = next.editingCell?.rowIdx === next.rowIdx
  if (prevEditing !== nextEditing) return false
  if (nextEditing && prev.editValue !== next.editValue) return false
  // Check range
  if (prev.selectionRange !== next.selectionRange) return false
  // Check clipboard
  if (prev.clipboard !== next.clipboard) return false
  return true
})
