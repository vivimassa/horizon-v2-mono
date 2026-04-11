import { memo, useCallback } from 'react'
import { Text, View, Pressable, TextInput } from 'react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import type { ScheduledFlightRef } from '@skyhub/api'
import type { CellFormat } from './types'
import type { GridColumn } from './grid-columns'
import { fmtMinutes } from './grid-columns'
import { getConditionalFormat } from './conditional-format-rules'
import { FrequencyDots } from './frequency-picker'

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  active: '#16a34a',
  suspended: '#f59e0b',
  cancelled: '#dc2626',
}

export const GridCell = memo(function GridCell({
  flight,
  col,
  value,
  isEditing,
  editValue,
  onEditChange,
  isSelected,
  isInRange,
  isClipboard,
  clipboardMode,
  cellFormat,
  condFormat,
  onTap,
  onDoubleTap,
  onCommit,
  onCancel,
  palette,
  accent,
  isDark,
  isDeleted,
  isCancelled,
}: {
  flight: ScheduledFlightRef
  col: GridColumn
  value: string
  isEditing: boolean
  editValue: string
  onEditChange: (v: string) => void
  isSelected: boolean
  isInRange: boolean
  isClipboard: boolean
  clipboardMode: 'copy' | 'cut' | null
  cellFormat: CellFormat | undefined
  condFormat: CellFormat | null
  onTap: () => void
  onDoubleTap: () => void
  onCommit: () => void
  onCancel: () => void
  palette: Palette
  accent: string
  isDark: boolean
  isDeleted: boolean
  isCancelled: boolean
}) {
  // Merge formatting: conditional > cell > defaults
  const fmt = { ...condFormat, ...cellFormat }

  // ── Frequency dots ──
  if (col.key === 'daysOfWeek' && !isEditing) {
    return (
      <Pressable
        onPress={onTap}
        onLongPress={onDoubleTap}
        style={cellContainerStyle(col, isSelected, isInRange, isClipboard, clipboardMode, fmt, palette, accent, isDark)}
      >
        <FrequencyDots value={value} accent={accent} palette={palette} size={15} />
      </Pressable>
    )
  }

  // ── Status badge ──
  if (col.key === 'status') {
    const color = STATUS_COLORS[value] ?? palette.textTertiary
    return (
      <View
        style={cellContainerStyle(col, isSelected, isInRange, isClipboard, clipboardMode, fmt, palette, accent, isDark)}
      >
        <View style={{ backgroundColor: `${color}20`, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color, textTransform: 'uppercase' }}>{value}</Text>
        </View>
      </View>
    )
  }

  // ── Edit mode ──
  if (isEditing) {
    return (
      <View style={cellContainerStyle(col, true, false, false, null, fmt, palette, accent, isDark)}>
        <TextInput
          value={editValue}
          onChangeText={onEditChange}
          onBlur={onCommit}
          onSubmitEditing={onCommit}
          autoFocus
          autoCapitalize="characters"
          keyboardType={
            col.key === 'departureDayOffset' ? 'numeric' : col.type === 'time' ? 'numbers-and-punctuation' : 'default'
          }
          maxLength={col.maxLength}
          style={{
            fontSize: 13,
            fontWeight: '600',
            fontFamily: col.mono ? 'monospace' : undefined,
            color: accent,
            textAlign: 'center',
            width: col.width - 6,
            height: 34,
            borderWidth: 1.5,
            borderColor: accent,
            borderRadius: 3,
            backgroundColor: palette.card,
            paddingHorizontal: 4,
          }}
        />
      </View>
    )
  }

  // ── Display mode ──
  const displayVal =
    col.key === 'blockMinutes' || col.key === 'tat' ? fmtMinutes(Number(value) || null) : value || '\u2014'

  return (
    <Pressable
      onPress={onTap}
      onLongPress={onDoubleTap}
      style={cellContainerStyle(col, isSelected, isInRange, isClipboard, clipboardMode, fmt, palette, accent, isDark)}
    >
      <Text
        style={{
          fontSize: fmt.fontSize ?? 13,
          fontWeight: fmt.bold ? '700' : '500',
          fontStyle: fmt.italic ? 'italic' : 'normal',
          fontFamily: fmt.fontFamily === 'Mono' ? 'monospace' : col.mono ? 'monospace' : undefined,
          color: isDeleted ? palette.textTertiary : isCancelled ? '#dc2626' : (fmt.textColor ?? palette.text),
          textDecorationLine: (isDeleted || isCancelled ? 'line-through' : fmt.underline ? 'underline' : 'none') as any,
          textAlign: (fmt.textAlign ?? col.align) as any,
        }}
        numberOfLines={1}
      >
        {displayVal}
      </Text>
    </Pressable>
  )
})

function cellContainerStyle(
  col: GridColumn,
  isSelected: boolean,
  isInRange: boolean,
  isClipboard: boolean,
  clipboardMode: 'copy' | 'cut' | null,
  fmt: Partial<CellFormat>,
  palette: Palette,
  accent: string,
  isDark: boolean,
) {
  return {
    width: col.width,
    height: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: isSelected ? 2 : isClipboard ? 1.5 : 1,
    borderColor: isSelected
      ? accent
      : isClipboard
        ? clipboardMode === 'cut'
          ? '#dc2626'
          : accent
        : palette.cardBorder,
    borderStyle: (isClipboard && clipboardMode === 'cut' ? 'dashed' : 'solid') as any,
    backgroundColor:
      fmt.bgColor ??
      (isSelected
        ? accentTint(accent, isDark ? 0.12 : 0.06)
        : isInRange
          ? accentTint(accent, isDark ? 0.06 : 0.03)
          : undefined),
  }
}
