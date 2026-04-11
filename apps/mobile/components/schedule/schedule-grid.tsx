import { useCallback, useRef, useMemo, memo } from 'react'
import { Text, View, FlatList, ScrollView, Pressable } from 'react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import type { ScheduledFlightRef } from '@skyhub/api'
import { GRID_COLUMNS, TOTAL_WIDTH, ROW_HEIGHT, HEADER_HEIGHT } from './grid-columns'
import { EMPTY_BUFFER_ROWS, type CellAddress } from './types'
import { useScheduleGridStore } from '../../stores/useScheduleGridStore'
import { GridRow } from './grid-row'

interface ScheduleGridProps {
  flights: ScheduledFlightRef[]
  onLongPress: (id: string) => void
  palette: Palette
  accent: string
  isDark: boolean
  sortKey: string
  sortDir: 'asc' | 'desc'
  onSort: (key: string) => void
}

export const ScheduleGrid = memo(function ScheduleGrid({
  flights,
  onLongPress,
  palette,
  accent,
  isDark,
  sortKey,
  sortDir,
  onSort,
}: ScheduleGridProps) {
  const store = useScheduleGridStore()
  const headerScrollRef = useRef<ScrollView>(null)
  const bodyScrollRef = useRef<ScrollView>(null)
  const scrollXRef = useRef(0)

  // Sync horizontal scroll between header and body
  const handleBodyScroll = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x
    scrollXRef.current = x
    headerScrollRef.current?.scrollTo({ x, animated: false })
  }, [])

  const handleHeaderScroll = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x
    scrollXRef.current = x
    bodyScrollRef.current?.scrollTo({ x, animated: false })
  }, [])

  const handleCellTap = useCallback(
    (cell: CellAddress) => {
      // If format painter is active, apply it
      if (store.formatPainterSource) {
        const row = flights[cell.rowIdx]
        if (row) {
          store.setCellFormat(row._id, cell.colKey, store.formatPainterSource)
          store.cancelFormatPainter()
        }
        return
      }
      store.selectCell(cell)
    },
    [flights, store],
  )

  const handleCellDoubleTap = useCallback(
    (cell: CellAddress) => {
      const col = GRID_COLUMNS.find((c) => c.key === cell.colKey)
      if (!col?.editable) return
      const row = flights[cell.rowIdx]
      if (!row) return
      store.startEditing(cell)
    },
    [flights, store],
  )

  const handleEditChange = useCallback(
    (v: string) => {
      store.setEditValue(v)
    },
    [store],
  )

  // Precompute TAT map: flightId → minutes between prev STA and this STD
  // TAT displays on the SECOND flight (the one arriving after the turnaround)
  // Skip first flight of each rotation cycle
  const tatMap = useMemo(() => {
    const map = new Map<string, number>()
    const parseHHMM = (t: string): number => {
      if (!t) return -1
      const clean = t.replace(':', '')
      if (clean.length < 4) return -1
      return parseInt(clean.slice(0, 2)) * 60 + parseInt(clean.slice(2, 4))
    }
    for (let i = 1; i < flights.length; i++) {
      const prev = flights[i - 1]
      const cur = flights[i]
      // Skip if different rotation (new cycle)
      if (prev.rotationId !== cur.rotationId) continue
      const sta = parseHHMM(prev.staUtc)
      const std = parseHHMM(cur.stdUtc)
      if (sta >= 0 && std >= 0) {
        let diff = std - sta
        if (diff < 0) diff += 1440
        map.set(cur._id, diff)
      }
    }
    return map
  }, [flights])

  const handleCommitEdit = useCallback(() => {
    store.commitEdit()
  }, [store])

  const handleCancelEdit = useCallback(() => {
    store.cancelEdit()
  }, [store])

  // Build empty buffer rows for Excel-like scrolling
  const dataWithBuffer = flights

  const renderRow = useCallback(
    ({ item: flight, index }: { item: ScheduledFlightRef; index: number }) => (
      <GridRow
        flight={flight}
        rowIdx={index}
        dirtyMap={store.dirtyMap}
        selectedCell={store.selectedCell}
        editingCell={store.editingCell}
        editValue={store.editValue}
        selectionRange={store.selectionRange}
        clipboard={store.clipboard}
        cellFormats={store.cellFormats}
        tatMinutes={tatMap.get(flight._id) ?? null}
        isNew={store.newRowIds.has(flight._id)}
        isDirty={store.dirtyMap.has(flight._id)}
        isDeleted={store.deletedIds.has(flight._id)}
        hasSeparator={store.separatorAfter.has(flight._id)}
        onCellTap={handleCellTap}
        onCellDoubleTap={handleCellDoubleTap}
        onEditChange={handleEditChange}
        onCommitEdit={handleCommitEdit}
        onCancelEdit={handleCancelEdit}
        onLongPress={onLongPress}
        palette={palette}
        accent={accent}
        isDark={isDark}
      />
    ),
    [
      store.dirtyMap,
      store.selectedCell,
      store.editingCell,
      store.editValue,
      store.selectionRange,
      store.clipboard,
      store.cellFormats,
      store.newRowIds,
      store.deletedIds,
      store.separatorAfter,
      handleCellTap,
      handleCellDoubleTap,
      handleEditChange,
      handleCommitEdit,
      handleCancelEdit,
      onLongPress,
      palette,
      accent,
      isDark,
    ],
  )

  return (
    <View className="flex-1">
      {/* Header — synced horizontal scroll */}
      <ScrollView
        ref={headerScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleHeaderScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View
          className="flex-row"
          style={{
            height: HEADER_HEIGHT,
            minWidth: TOTAL_WIDTH,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderBottomWidth: 2,
            borderBottomColor: palette.border,
          }}
        >
          {GRID_COLUMNS.map((col) => {
            const isSorted = sortKey === col.key
            const isHighlighted = store.highlightedCol === GRID_COLUMNS.indexOf(col)
            return (
              <Pressable
                key={col.key}
                onPress={() => onSort(col.key)}
                style={{
                  width: col.width,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRightWidth: 1,
                  borderRightColor: palette.cardBorder,
                  backgroundColor: isHighlighted ? accentTint(accent, isDark ? 0.08 : 0.04) : undefined,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: isSorted ? accent : palette.textSecondary,
                    textTransform: 'uppercase',
                  }}
                >
                  {col.label}
                  {isSorted ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      {/* Body — synced horizontal scroll wrapping vertical FlatList */}
      <ScrollView
        ref={bodyScrollRef}
        horizontal
        showsHorizontalScrollIndicator={true}
        onScroll={handleBodyScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ minWidth: TOTAL_WIDTH }}>
          <FlatList
            data={dataWithBuffer}
            keyExtractor={(f) => f._id}
            renderItem={renderRow}
            getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 80 }}
            initialNumToRender={30}
            maxToRenderPerBatch={20}
            windowSize={11}
          />
        </View>
      </ScrollView>
    </View>
  )
})
