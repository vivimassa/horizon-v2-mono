import { useState, useRef, memo, useCallback } from 'react'
import { Text, View, FlatList, ScrollView, Pressable, TextInput } from 'react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import type { ScheduledFlightRef } from '@skyhub/api'
import { FrequencyDots } from './frequency-picker'

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  active: '#16a34a',
  suspended: '#f59e0b',
  cancelled: '#dc2626',
}

interface ColDef {
  key: string
  label: string
  width: number
  editable: boolean
  mono?: boolean
}

// Sticky columns (fixed left)
const STICKY_COLS: ColDef[] = [
  { key: 'flightNumber', label: 'FLIGHT', width: 75, editable: true, mono: true },
  { key: 'depStation', label: 'DEP', width: 55, editable: true, mono: true },
  { key: 'arrStation', label: 'ARR', width: 55, editable: true, mono: true },
]
const STICKY_WIDTH = STICKY_COLS.reduce((s, c) => s + c.width, 0)

// Scrollable columns
const SCROLL_COLS: ColDef[] = [
  { key: 'aircraftTypeIcao', label: 'AC TYPE', width: 65, editable: true, mono: true },
  { key: 'effectiveFrom', label: 'FROM', width: 90, editable: true, mono: true },
  { key: 'effectiveUntil', label: 'TO', width: 90, editable: true, mono: true },
  { key: 'stdUtc', label: 'STD', width: 60, editable: true, mono: true },
  { key: 'staUtc', label: 'STA', width: 60, editable: true, mono: true },
  { key: 'departureDayOffset', label: 'OFS', width: 40, editable: true, mono: true },
  { key: 'serviceType', label: 'SVC', width: 45, editable: true },
  { key: 'daysOfWeek', label: 'FREQ', width: 140, editable: true, mono: true },
  { key: 'blockMinutes', label: 'BLOCK', width: 60, editable: false, mono: true },
  { key: 'status', label: 'STATUS', width: 80, editable: false },
]
const SCROLL_WIDTH = SCROLL_COLS.reduce((s, c) => s + c.width, 0)

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 36

function fmtMinutes(min: number | null): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60),
    m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export const ScheduleTable = memo(function ScheduleTable({
  flights,
  dirtyMap,
  newIds,
  deletedIds,
  selectedId,
  onSelect,
  onCellEdit,
  onLongPress,
  palette,
  accent,
  isDark,
  sortKey,
  sortDir,
  onSort,
}: {
  flights: ScheduledFlightRef[]
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>
  newIds: Set<string>
  deletedIds: Set<string>
  selectedId: string | null
  onSelect: (id: string) => void
  onCellEdit: (id: string, key: string, value: any) => void
  onLongPress: (id: string) => void
  palette: Palette
  accent: string
  isDark: boolean
  sortKey: string
  sortDir: 'asc' | 'desc'
  onSort: (key: string) => void
}) {
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const scrollRef = useRef<ScrollView>(null)

  const commitEdit = useCallback(() => {
    if (editingCell) {
      onCellEdit(editingCell.id, editingCell.key, editValue)
      setEditingCell(null)
    }
  }, [editingCell, editValue, onCellEdit])

  const startEdit = useCallback((id: string, col: ColDef, currentVal: string) => {
    if (!col.editable) return
    setEditingCell({ id, key: col.key })
    setEditValue(currentVal)
  }, [])

  const getVal = useCallback(
    (flight: ScheduledFlightRef, key: string): string => {
      const dirty = dirtyMap.get(flight._id)
      const val = dirty && key in dirty ? (dirty as any)[key] : (flight as any)[key]
      if (key === 'blockMinutes') return fmtMinutes(val)
      return val != null ? String(val) : ''
    },
    [dirtyMap],
  )

  const renderCell = (flight: ScheduledFlightRef, col: ColDef) => {
    const isEditing = editingCell?.id === flight._id && editingCell?.key === col.key
    const val = getVal(flight, col.key)
    const isDeleted = deletedIds.has(flight._id)
    const isCancelled = flight.status === 'cancelled'

    if (col.key === 'daysOfWeek' && !isEditing) {
      return <FrequencyDots value={val} accent={accent} palette={palette} size={16} />
    }

    if (col.key === 'status') {
      const color = STATUS_COLORS[val] ?? palette.textTertiary
      return (
        <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20` }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color, textTransform: 'uppercase' }}>{val}</Text>
        </View>
      )
    }

    if (isEditing) {
      return (
        <TextInput
          value={editValue}
          onChangeText={setEditValue}
          onBlur={commitEdit}
          onSubmitEditing={commitEdit}
          autoFocus
          autoCapitalize="characters"
          keyboardType={
            col.key === 'departureDayOffset'
              ? 'numeric'
              : col.key === 'stdUtc' || col.key === 'staUtc'
                ? 'numbers-and-punctuation'
                : 'default'
          }
          style={{
            fontSize: 13,
            fontWeight: '600',
            fontFamily: col.mono ? 'monospace' : undefined,
            color: accent,
            textAlign: 'center',
            width: col.width - 8,
            height: ROW_HEIGHT - 8,
            borderWidth: 1,
            borderColor: accent,
            borderRadius: 4,
            backgroundColor: palette.card,
          }}
        />
      )
    }

    return (
      <Pressable onPress={() => (col.editable && !isDeleted ? startEdit(flight._id, col, val) : onSelect(flight._id))}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            fontFamily: col.mono ? 'monospace' : undefined,
            color: isDeleted ? palette.textTertiary : isCancelled ? '#dc2626' : palette.text,
            textDecorationLine: isDeleted || isCancelled ? 'line-through' : 'none',
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {val || '\u2014'}
        </Text>
      </Pressable>
    )
  }

  const renderHeaderCells = (cols: ColDef[]) => (
    <View
      className="flex-row"
      style={{ height: HEADER_HEIGHT, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
    >
      {cols.map((col) => (
        <Pressable
          key={col.key}
          onPress={() => onSort(col.key)}
          style={{
            width: col.width,
            justifyContent: 'center',
            alignItems: 'center',
            borderRightWidth: 1,
            borderBottomWidth: 1,
            borderColor: palette.cardBorder,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: sortKey === col.key ? accent : palette.textSecondary,
              textTransform: 'uppercase',
            }}
          >
            {col.label}
            {sortKey === col.key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  )

  const renderRow = ({ item: flight }: { item: ScheduledFlightRef }) => {
    const isSelected = selectedId === flight._id
    const isDirty = dirtyMap.has(flight._id)
    const isNew = newIds.has(flight._id)
    const isDeleted = deletedIds.has(flight._id)
    const hasSeparator = (flight.formatting as any)?.separatorBelow

    const rowBg = isSelected
      ? accentTint(accent, isDark ? 0.1 : 0.04)
      : isDeleted
        ? isDark
          ? 'rgba(220,38,38,0.06)'
          : 'rgba(220,38,38,0.03)'
        : flight.status === 'suspended'
          ? isDark
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.015)'
          : 'transparent'
    const rowOpacity = isDeleted ? 0.4 : flight.status === 'suspended' ? 0.6 : 1

    return (
      <View>
        <Pressable
          onPress={() => onSelect(flight._id)}
          onLongPress={() => onLongPress(flight._id)}
          className="flex-row"
          style={{
            height: ROW_HEIGHT,
            backgroundColor: rowBg,
            opacity: rowOpacity,
            borderLeftWidth: isDirty || isNew ? 3 : 0,
            borderLeftColor: isNew ? '#16a34a' : accent,
          }}
        >
          {/* Sticky columns */}
          {STICKY_COLS.map((col) => (
            <View
              key={col.key}
              style={{
                width: col.width,
                justifyContent: 'center',
                alignItems: 'center',
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: palette.cardBorder,
              }}
            >
              {renderCell(flight, col)}
            </View>
          ))}
          {/* Scrollable columns — rendered inside same row */}
          {SCROLL_COLS.map((col) => (
            <View
              key={col.key}
              style={{
                width: col.width,
                justifyContent: 'center',
                alignItems: 'center',
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: palette.cardBorder,
              }}
            >
              {renderCell(flight, col)}
            </View>
          ))}
        </Pressable>
        {hasSeparator && (
          <View style={{ height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }} />
        )}
      </View>
    )
  }

  // Total width of all columns
  const totalWidth = STICKY_WIDTH + SCROLL_WIDTH

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
      <View style={{ width: totalWidth }}>
        {/* Header */}
        <View className="flex-row">
          {renderHeaderCells(STICKY_COLS)}
          {renderHeaderCells(SCROLL_COLS)}
        </View>
        {/* Data rows */}
        <FlatList
          data={flights}
          keyExtractor={(f) => f._id}
          renderItem={renderRow}
          getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      </View>
    </ScrollView>
  )
})
