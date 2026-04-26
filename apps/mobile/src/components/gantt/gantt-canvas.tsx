// Mobile Gantt Skia canvas with pan + pinch.
// Renders the timeline body. Time header + row labels are separate canvases
// pinned to the edges; they read the same scroll shared values for sync.

import { useEffect, useMemo, useState } from 'react'
import { View, useWindowDimensions } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Canvas, Group, Rect, RoundedRect } from '@shopify/react-native-skia'
import { useCanvasFont } from '../../lib/gantt/use-canvas-font'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue, useDerivedValue, useFrameCallback, runOnJS } from 'react-native-reanimated'
import { useGanttScroll } from './gantt-scroll-context'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { api } from '@skyhub/api'
import { hitTestBars, computeNowLineX, dateToMs, computePixelsPerHour, utcToX } from '@skyhub/logic'
import { useAuthStore } from '@skyhub/ui'
import { enqueuePending } from '../../lib/gantt/cache'
import { enqueuePendingToWmdb } from '../../lib/gantt/wmdb-bridge'
import { ROW_HEIGHT_LEVELS } from '@skyhub/types'
import {
  BarsLayer,
  GridLayer,
  GroupHeadersLayer,
  NowLineLayer,
  TatLabelsLayer,
  SlotRiskLayer,
  MissingTimesLayer,
  DelaysLayer,
  DragGhostLayer,
} from '../../lib/gantt/draw'

interface Props {
  width: number
  height: number
  accent: string
}

export function GanttCanvas({ width, height, accent }: Props) {
  const layout = useMobileGanttStore((s) => s.layout)
  const isDark = useMobileGanttStore((s) => s.isDark)
  const selectedIds = useMobileGanttStore((s) => s.selectedFlightIds)
  const periodFrom = useMobileGanttStore((s) => s.periodFrom)
  const periodTo = useMobileGanttStore((s) => s.periodTo)
  const zoom = useMobileGanttStore((s) => s.zoom)
  const rowHeightLevel = useMobileGanttStore((s) => s.rowHeightLevel)
  const setContainerSize = useMobileGanttStore((s) => s.setContainerSize)
  const cycleZoom = useMobileGanttStore((s) => s.cycleZoom)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)
  const detailSheet = useMobileGanttStore((s) => s.detailSheet)
  const selectionMode = useMobileGanttStore((s) => s.selectionMode)
  const selectionRotationId = useMobileGanttStore((s) => s.selectionRotationId)
  const selectionConfirmed = useMobileGanttStore((s) => s.selectionConfirmed)
  const enterSelection = useMobileGanttStore((s) => s.enterSelection)
  const toggleSelection = useMobileGanttStore((s) => s.toggleSelection)
  const showTat = useMobileGanttStore((s) => s.showTat)
  const showSlots = useMobileGanttStore((s) => s.showSlots)
  const showMissingTimes = useMobileGanttStore((s) => s.showMissingTimes)
  const showDelays = useMobileGanttStore((s) => s.showDelays)
  const oooiGraceMins = useMobileGanttStore((s) => s.oooiGraceMins)
  const considerableDelayMins = useMobileGanttStore((s) => s.considerableDelayMins)
  const applyOptimisticPlacement = useMobileGanttStore((s) => s.applyOptimisticPlacement)
  const revertOptimisticPlacement = useMobileGanttStore((s) => s.revertOptimisticPlacement)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refreshPendingCount = useMobileGanttStore((s) => s.refreshPendingCount)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const win = useWindowDimensions()
  const isTablet = win.width >= 768

  // Scroll shared values come from context — header + row labels read them too.
  const { scrollX, scrollY } = useGanttScroll()
  const startScrollX = useSharedValue(0)
  const startScrollY = useSharedValue(0)
  const pinchAccum = useSharedValue(0)

  // Drag-to-assign state — set in panGesture.onStart when starting on a selected bar.
  const dragActive = useSharedValue(false)
  const dragDeltaX = useSharedValue(0)
  const dragDeltaY = useSharedValue(0)

  // Push container width to the store so layout recomputes at the right pph.
  useEffect(() => {
    setContainerSize(width, height)
  }, [width, height, setContainerSize])

  const rowConfig = ROW_HEIGHT_LEVELS[rowHeightLevel] ?? ROW_HEIGHT_LEVELS[1]
  const font = useGanttFont(rowConfig.fontSize)
  const smallFont = useGanttFont(Math.max(9, rowConfig.fontSize - 2))

  // 60s tick — drives now-line + missing-time recompute.
  const [nowTick, setNowTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const totalWidth = layout?.totalWidth ?? width
  const totalHeight = layout?.totalHeight ?? height

  // ── Now line X (recomputed every minute) ──
  const startMs = useMemo(() => dateToMs(periodFrom), [periodFrom])
  const periodDays = useMemo(() => {
    return Math.round((dateToMs(periodTo) + 86_400_000 - startMs) / 86_400_000)
  }, [periodTo, startMs])
  const pph = useMemo(() => computePixelsPerHour(width, zoom), [width, zoom])
  const nowX = useMemo(
    () => computeNowLineX(startMs, periodDays, pph),
    // nowTick forces recompute every minute; eslint disabled because that's intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startMs, periodDays, pph, nowTick],
  )

  // ── Gestures ──

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart((e) => {
      startScrollX.value = scrollX.value
      startScrollY.value = scrollY.value
      const tx = e.x + scrollX.value
      const ty = e.y + scrollY.value
      const state = useMobileGanttStore.getState()
      if (state.selectionMode && state.selectionConfirmed) {
        const bars = state.layout?.bars ?? []
        const flightId = hitTestBars(tx, ty, bars)
        if (flightId && state.selectedFlightIds.has(flightId)) {
          dragActive.value = true
          dragDeltaX.value = 0
          dragDeltaY.value = 0
        }
      }
    })
    .onUpdate((e) => {
      if (dragActive.value) {
        dragDeltaX.value = e.translationX
        dragDeltaY.value = e.translationY
        return
      }
      const maxX = Math.max(0, totalWidth - width)
      const maxY = Math.max(0, totalHeight - height)
      scrollX.value = clamp(startScrollX.value - e.translationX, 0, maxX)
      scrollY.value = clamp(startScrollY.value - e.translationY, 0, maxY)
    })
    .onEnd(() => {
      if (dragActive.value) {
        const dx = dragDeltaX.value
        const dy = dragDeltaY.value
        dragActive.value = false
        dragDeltaX.value = 0
        dragDeltaY.value = 0
        handleDragEnd(dx, dy)
      }
    })

  function handleDragEnd(deltaX: number, deltaY: number) {
    const state = useMobileGanttStore.getState()
    const layoutState = state.layout
    if (!layoutState || !operatorId) return
    const selected = [...state.selectedFlightIds]
    if (selected.length === 0) return
    // Use the first selected bar as the anchor for hit-testing the drop row.
    const firstBar = layoutState.bars.find((b) => b.flightId === selected[0])
    if (!firstBar) return
    const dropY = firstBar.y + firstBar.height / 2 + deltaY
    const targetRow = layoutState.rows.find((r) => r.type === 'aircraft' && dropY >= r.y && dropY < r.y + r.height)
    if (!targetRow || !targetRow.registration) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      return
    }
    const targetReg = targetRow.registration
    const sourceFlight = state.flights.find((f) => f.id === selected[0])
    // Type compatibility: target row's icaoType must match the dragged flights' AC type.
    if (
      sourceFlight?.aircraftTypeIcao &&
      targetRow.aircraftTypeIcao &&
      sourceFlight.aircraftTypeIcao !== targetRow.aircraftTypeIcao
    ) {
      showToast('error', `Type mismatch: ${sourceFlight.aircraftTypeIcao} cannot be assigned to ${targetReg}.`)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
    applyOptimisticPlacement(selected, targetReg)
    api
      .ganttAssignFlights(operatorId, selected, targetReg)
      .then(() => {
        showToast('success', `Assigned ${selected.length} flight${selected.length > 1 ? 's' : ''} to ${targetReg}.`)
      })
      .catch((err: unknown) => {
        // Keep the optimistic placement and queue the mutation so the user
        // doesn't lose their work. Will reconcile on next refresh.
        const payload = { operatorId, flightIds: selected, registration: targetReg }
        void enqueuePending({ kind: 'assign', payload })
        void enqueuePendingToWmdb(operatorId, 'assign', payload)
        void refreshPendingCount()
        showToast('info', err instanceof Error ? `Queued: ${err.message}` : 'Queued for sync.')
        void revertOptimisticPlacement // keep import live without action
      })
  }

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchAccum.value = 0
    })
    .onUpdate((e) => {
      // Accumulate scale beyond simple thresholds — > 1.4 zooms in, < 0.7 zooms out.
      pinchAccum.value = e.scale
    })
    .onEnd(() => {
      if (pinchAccum.value > 1.4) {
        runOnJS(cycleZoom)(-1) // zoom in = fewer days visible
      } else if (pinchAccum.value < 0.7) {
        runOnJS(cycleZoom)(1)
      }
      pinchAccum.value = 0
    })

  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .onEnd((e) => {
      'worklet'
      const tapX = e.x + scrollX.value
      const tapY = e.y + scrollY.value
      runOnJS(handleTap)(tapX, tapY)
    })

  function handleTap(x: number, y: number) {
    const state = useMobileGanttStore.getState()
    const bars = state.layout?.bars ?? []
    const flightId = hitTestBars(x, y, bars)
    if (!flightId) return
    if (state.selectionMode) {
      toggleSelection(flightId)
    } else {
      openDetailSheet({ kind: 'flight', flightId })
    }
  }

  function handleLongPress(x: number, y: number) {
    const state = useMobileGanttStore.getState()
    const bars = state.layout?.bars ?? []
    const flightId = hitTestBars(x, y, bars)
    if (!flightId) return
    const flight = state.flights.find((f) => f.id === flightId)
    if (!flight) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    // Phone variant: long-press → detail sheet only (no selection mode).
    if (!isTablet) {
      openDetailSheet({ kind: 'flight', flightId })
      return
    }
    const rotationId = flight.rotationId ?? `__solo_${flight.id}`
    const siblings = state.flights.filter((f) => (f.rotationId ?? `__solo_${f.id}`) === rotationId).map((f) => f.id)
    enterSelection(rotationId, siblings, flight.operatingDate)
  }

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(10)
    .onStart((e) => {
      'worklet'
      const px = e.x + scrollX.value
      const py = e.y + scrollY.value
      runOnJS(handleLongPress)(px, py)
    })

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, longPressGesture, tapGesture)

  // ── Skia transform ──
  const transform = useDerivedValue(() => [{ translateX: -scrollX.value }, { translateY: -scrollY.value }])

  const viewport = useMemo(() => ({ scrollX: 0, scrollY: 0, width, height }), [width, height])

  // Jiggle clock — advances continuously while jiggling, idle otherwise.
  const jiggleClock = useSharedValue(0)
  const jiggleActive = selectionMode && !selectionConfirmed
  useFrameCallback((info) => {
    'worklet'
    if (jiggleActive) jiggleClock.value = (info.timeSinceFirstFrame ?? 0) / 1000
  }, true)
  const jiggleAngle = useDerivedValue(() => {
    'worklet'
    if (!jiggleActive) return 0
    // ±1.5° at 3 Hz = sin(2π·3·t) · (1.5° in radians)
    return Math.sin(jiggleClock.value * 18.84955592153876) * 0.026179938779914945
  })

  // Focus highlights driven by detail sheet target.
  const focusedFlight =
    detailSheet?.kind === 'flight' ? (layout?.bars.find((b) => b.flightId === detailSheet.flightId) ?? null) : null
  const focusedRow =
    detailSheet?.kind === 'aircraft'
      ? (layout?.rows.find((r) => r.type === 'aircraft' && r.registration === detailSheet.registration) ?? null)
      : null
  const focusedDayX = detailSheet?.kind === 'day' && layout ? utcToX(dateToMs(detailSheet.date), startMs, pph) : null
  const dayWidth = layout && layout.ticks.length > 1 ? (layout.ticks.find((t) => t.isMajor && t.x > 0)?.x ?? 0) : 0

  return (
    <GestureDetector gesture={composed}>
      <View style={{ width, height, overflow: 'hidden' }}>
        <Canvas style={{ width, height }}>
          <Group transform={transform}>
            {layout && (
              <>
                <GridLayer
                  ticks={layout.ticks}
                  rows={layout.rows}
                  totalWidth={totalWidth}
                  totalHeight={totalHeight}
                  isDark={isDark}
                  viewport={viewport}
                />
                <GroupHeadersLayer
                  rows={layout.rows}
                  totalWidth={totalWidth}
                  isDark={isDark}
                  font={font}
                  viewport={viewport}
                />
                <BarsLayer
                  bars={layout.bars}
                  rowConfig={rowConfig}
                  font={font}
                  viewport={viewport}
                  selectedIds={selectedIds}
                  accent={accent}
                  jiggleAngle={jiggleAngle}
                  jiggleRotationId={jiggleActive ? selectionRotationId : null}
                  selectionConfirmed={selectionConfirmed}
                />
                {showSlots && <SlotRiskLayer bars={layout.bars} viewport={viewport} />}
                {showMissingTimes && (
                  <MissingTimesLayer
                    bars={layout.bars}
                    graceMins={oooiGraceMins}
                    nowTick={nowTick}
                    viewport={viewport}
                  />
                )}
                {showTat && <TatLabelsLayer bars={layout.bars} font={smallFont} isDark={isDark} viewport={viewport} />}
                {showDelays && (
                  <DelaysLayer
                    bars={layout.bars}
                    considerableMins={considerableDelayMins}
                    font={smallFont}
                    viewport={viewport}
                  />
                )}
                <DragGhostLayer
                  bars={layout.bars}
                  draggedIds={selectedIds}
                  deltaX={dragDeltaX}
                  deltaY={dragDeltaY}
                  active={dragActive}
                  accent={accent}
                />
                <NowLineLayer x={nowX} totalHeight={totalHeight} />

                {/* Focus overlays — driven by detail sheet target */}
                {focusedRow && (
                  <Rect x={0} y={focusedRow.y} width={totalWidth} height={focusedRow.height} color={`${accent}22`} />
                )}
                {focusedDayX != null && dayWidth > 0 && (
                  <Rect x={focusedDayX} y={0} width={dayWidth || 80} height={totalHeight} color={`${accent}14`} />
                )}
                {focusedFlight && (
                  <RoundedRect
                    x={focusedFlight.x - 3}
                    y={focusedFlight.y - 3}
                    width={focusedFlight.width + 6}
                    height={focusedFlight.height + 6}
                    r={6}
                    color={accent}
                    style="stroke"
                    strokeWidth={3}
                  />
                )}
              </>
            )}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  )
}

function clamp(v: number, min: number, max: number): number {
  'worklet'
  return Math.max(min, Math.min(max, v))
}

const useGanttFont = useCanvasFont
