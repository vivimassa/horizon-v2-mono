// Mobile Gantt search sheet — flight number / route / aircraft. Tap result
// jumps the body scroll to center the bar in the viewport and opens the
// detail sheet on the Flight tab.

import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { Search } from 'lucide-react-native'
import { Icon } from '@skyhub/ui'
import { utcToX, dateToMs, computePixelsPerHour, getDisplayTimes } from '@skyhub/logic'
import type { GanttFlight } from '@skyhub/types'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useGanttScroll } from './gantt-scroll-context'

const MAX_RESULTS = 60

export function GanttSearchSheet() {
  const { palette, isDark, accent } = useAppTheme()
  const ref = useRef<BottomSheet>(null)
  const open = useMobileGanttStore((s) => s.searchSheetOpen)
  const setOpen = useMobileGanttStore((s) => s.setSearchSheetOpen)
  const flights = useMobileGanttStore((s) => s.flights)
  const periodFrom = useMobileGanttStore((s) => s.periodFrom)
  const zoom = useMobileGanttStore((s) => s.zoom)
  const containerWidth = useMobileGanttStore((s) => s.containerWidth)
  const layout = useMobileGanttStore((s) => s.layout)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)
  const { scrollX, scrollY } = useGanttScroll()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) ref.current?.snapToIndex(0)
    else {
      ref.current?.close()
      setQuery('')
    }
  }, [open])

  const snapPoints = useMemo(() => ['85%'], [])

  const results = useMemo<GanttFlight[]>(() => {
    const q = query.trim().toUpperCase()
    if (!q) return flights.slice(0, MAX_RESULTS)
    return flights
      .filter((f) => {
        if (f.flightNumber.toUpperCase().includes(q)) return true
        if (f.depStation?.toUpperCase().includes(q)) return true
        if (f.arrStation?.toUpperCase().includes(q)) return true
        if (f.aircraftReg?.toUpperCase().includes(q)) return true
        const sector = `${f.depStation}-${f.arrStation}`.toUpperCase()
        if (sector.includes(q)) return true
        return false
      })
      .slice(0, MAX_RESULTS)
  }, [flights, query])

  const handlePick = (f: GanttFlight) => {
    setOpen(false)
    openDetailSheet({ kind: 'flight', flightId: f.id })
    if (containerWidth <= 0 || !layout) return
    const startMs = dateToMs(periodFrom)
    const pph = computePixelsPerHour(containerWidth, zoom)
    const { depMs } = getDisplayTimes(f)
    const xCenter = utcToX(depMs, startMs, pph) - containerWidth / 2
    const maxX = Math.max(0, layout.totalWidth - containerWidth)
    scrollX.value = Math.max(0, Math.min(maxX, xCenter))
    // Center on the row of the matching bar if found
    const bar = layout.bars.find((b) => b.flightId === f.id)
    if (bar) {
      const targetY = bar.y - 100
      const maxY = Math.max(0, layout.totalHeight - 200)
      scrollY.value = Math.max(0, Math.min(maxY, targetY))
    }
  }

  return (
    <BottomSheet
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      index={-1}
      onClose={() => setOpen(false)}
      backgroundStyle={{ backgroundColor: palette.card }}
      handleIndicatorStyle={{ backgroundColor: palette.textTertiary }}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 12 }}>Search</Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 40,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.background,
            paddingHorizontal: 10,
            marginBottom: 12,
          }}
        >
          <Icon icon={Search} size="sm" color={palette.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Flight, route, registration..."
            placeholderTextColor={palette.textTertiary}
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: palette.text }}
          />
        </View>

        {results.length === 0 ? (
          <Text style={{ fontSize: 13, color: palette.textTertiary, textAlign: 'center', marginTop: 24 }}>
            No matches.
          </Text>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(f) => f.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <ResultRow
                flight={item}
                onPress={() => handlePick(item)}
                palette={palette}
                accent={accent}
                isDark={isDark}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: palette.border }} />}
          />
        )}
      </BottomSheetView>
    </BottomSheet>
  )
}

function ResultRow({
  flight,
  onPress,
  palette,
  accent,
  isDark,
}: {
  flight: GanttFlight
  onPress: () => void
  palette: { text: string; textSecondary: string; textTertiary: string; backgroundHover: string }
  accent: string
  isDark: boolean
}) {
  const std = new Date(flight.stdUtc)
  const std$ = `${String(std.getUTCHours()).padStart(2, '0')}:${String(std.getUTCMinutes()).padStart(2, '0')}`
  const date = std.toISOString().slice(5, 10)
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 10,
        paddingHorizontal: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : 'transparent',
      })}
    >
      <View style={{ minWidth: 64 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, fontFamily: 'monospace' }}>
          {flight.flightNumber}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace' }}>
          {flight.depStation} → {flight.arrStation}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>
          {date} · {std$}Z · {flight.aircraftReg ?? 'unassigned'}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: accent,
        }}
      >
        <Text style={{ fontSize: 13, color: accent, fontWeight: '600' }}>{flight.status}</Text>
      </View>
    </Pressable>
  )
}
