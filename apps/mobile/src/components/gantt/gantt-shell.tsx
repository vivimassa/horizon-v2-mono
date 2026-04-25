// Mobile Gantt orchestrator. Composes toolbar + time header + row labels +
// canvas + filter sheet. Hooks the operatorId from auth and pushes container
// size into the store.

import { useEffect, useState } from 'react'
import { View, useWindowDimensions, ActivityIndicator, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { GanttScrollProvider } from './gantt-scroll-context'
import { GanttToolbar } from './gantt-toolbar'
import { GanttCanvas } from './gantt-canvas'
import { GanttTimeHeader } from './gantt-time-header'
import { GanttRowLabels } from './gantt-row-labels'
import { GanttFilterSheet } from './gantt-filter-sheet'
import { GanttDetailSheet } from './gantt-detail-sheet'
import { SelectionActionBar } from './selection-action-bar'

const ROW_LABELS_W = 96
const HEADER_H = 44

export function GanttShell() {
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const win = useWindowDimensions()
  const periodCommitted = useMobileGanttStore((s) => s.periodCommitted)
  const loading = useMobileGanttStore((s) => s.loading)
  const error = useMobileGanttStore((s) => s.error)
  const setIsDark = useMobileGanttStore((s) => s.setIsDark)
  const setFilterSheetOpen = useMobileGanttStore((s) => s.setFilterSheetOpen)
  const flightsCount = useMobileGanttStore((s) => s.flights.length)

  // Sync theme into store so layout colors recompute.
  useEffect(() => {
    setIsDark(isDark)
  }, [isDark, setIsDark])

  // Open filter sheet automatically the first time the user lands on the page.
  useEffect(() => {
    if (!periodCommitted) setFilterSheetOpen(true)
  }, [periodCommitted, setFilterSheetOpen])

  // Layout dimensions excluding sticky header + row labels.
  const [shellSize, setShellSize] = useState({ width: win.width, height: win.height })
  const bodyWidth = Math.max(1, shellSize.width - ROW_LABELS_W)
  const bodyHeight = Math.max(1, shellSize.height - HEADER_H - 50 /* toolbar */)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GanttScrollProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={['top']}>
          <GanttToolbar operatorId={operatorId} />

          <View
            style={{ flex: 1 }}
            onLayout={(e) => setShellSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            {/* Top row: corner spacer + time header */}
            <View style={{ flexDirection: 'row' }}>
              <View
                style={{
                  width: ROW_LABELS_W,
                  height: HEADER_H,
                  backgroundColor: palette.card,
                  borderBottomWidth: 1,
                  borderRightWidth: 1,
                  borderColor: palette.border,
                }}
              />
              <GanttTimeHeader width={bodyWidth} isDark={isDark} />
            </View>

            {/* Body row: row labels + canvas */}
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <GanttRowLabels height={bodyHeight} isDark={isDark} />
              <GanttCanvas width={bodyWidth} height={bodyHeight} accent={accent} />
            </View>

            {/* Overlays */}
            {loading && (
              <View
                style={{
                  position: 'absolute',
                  top: HEADER_H,
                  left: ROW_LABELS_W,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.25)',
                }}
                pointerEvents="none"
              >
                <ActivityIndicator color={accent} size="large" />
              </View>
            )}
            {!loading && periodCommitted && flightsCount === 0 && !error && (
              <CenterMsg color={palette.textSecondary} text="No flights in this period." />
            )}
            {error && <CenterMsg color="#ef4444" text={error} />}
            {!periodCommitted && !loading && (
              <CenterMsg color={palette.textSecondary} text="Pick a period and tap Go." />
            )}
          </View>

          <SelectionActionBar />
          <GanttFilterSheet operatorId={operatorId} />
          <GanttDetailSheet />
        </SafeAreaView>
      </GanttScrollProvider>
    </GestureHandlerRootView>
  )
}

function CenterMsg({ text, color }: { text: string; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: HEADER_H,
        left: ROW_LABELS_W,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Text style={{ fontSize: 14, color }}>{text}</Text>
    </View>
  )
}
