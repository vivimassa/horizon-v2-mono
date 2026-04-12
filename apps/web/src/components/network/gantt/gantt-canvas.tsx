'use client'

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors, glass } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { ROW_HEIGHT_LEVELS } from '@/lib/gantt/types'
import { computePixelsPerHour, computeNowLineX, dateToMs, xToUtc } from '@/lib/gantt/time-axis'
import { hitTestBars, hitTestRow } from '@/lib/gantt/hit-testing'
import {
  drawGrid,
  drawGroupHeaders,
  drawBars,
  drawTatLabels,
  drawNightstopLabels,
  drawNowLine,
  drawDragGhosts,
  drawDraggedBars,
  drawDropTarget,
  buildBarsByRow,
  drawSlotLines,
  drawMissingTimeFlags,
} from '@/lib/gantt/draw-helpers'
import { FlightTooltip } from './gantt-flight-tooltip'
import { GanttContextMenu } from './gantt-context-menu'
import { AircraftContextMenu } from './aircraft-context-menu'
import { AircraftPopover } from './aircraft-popover'
import { DayContextMenu } from './day-context-menu'
import { DailySummaryPopover } from './daily-summary-popover'
import { RowContextMenu } from './row-context-menu'
import { RotationPopover } from './rotation-popover'
import { AssignPopover } from './assign-popover'
import { GanttSwapDialog } from './gantt-swap-dialog'
import { GanttCancelDialog } from './gantt-cancel-dialog'

const ROW_LABEL_W = 160

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function GanttCanvas() {
  const { theme, moduleTheme } = useTheme()
  const isDark = theme === 'dark'
  const accentColor = moduleTheme?.accent ?? '#1e40af'

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowLabelsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollState = useRef({ left: 0, top: 0 })
  const mousePosRef = useRef({ x: 0, y: 0 })
  const rafId = useRef(0)
  const lastHoverTime = useRef(0)

  // Store
  const layout = useGanttStore((s) => s.layout)
  const flights = useGanttStore((s) => s.flights)
  const selectedFlightIds = useGanttStore((s) => s.selectedFlightIds)
  const hoveredFlightId = useGanttStore((s) => s.hoveredFlightId)
  const swapMode = useGanttStore((s) => s.swapMode)
  const showTat = useGanttStore((s) => s.showTat)
  const showSlots = useGanttStore((s) => s.showSlots)
  const showMissingTimes = useGanttStore((s) => s.showMissingTimes)
  const oooiGraceMins = useGanttStore((s) => s.oooiGraceMins)
  const scenarioId = useGanttStore((s) => s.scenarioId)
  const periodFrom = useGanttStore((s) => s.periodFrom)
  const periodTo = useGanttStore((s) => s.periodTo)
  const containerWidth = useGanttStore((s) => s.containerWidth)
  const zoomLevel = useGanttStore((s) => s.zoomLevel)
  const collapsedTypes = useGanttStore((s) => s.collapsedTypes)
  const rowHeightLevel = useGanttStore((s) => s.rowHeightLevel)
  const scrollTargetMs = useGanttStore((s) => s.scrollTargetMs)
  const toggleTypeCollapse = useGanttStore((s) => s.toggleTypeCollapse)
  const setContainerWidth = useGanttStore((s) => s.setContainerWidth)
  const consumeScrollTarget = useGanttStore((s) => s.consumeScrollTarget)

  const rows = layout?.rows ?? []
  const ticks = layout?.ticks ?? []
  const totalWidth = layout?.totalWidth ?? 0
  const totalHeight = layout?.totalHeight ?? 0

  // Flight drag & drop active flag (declared early so draw callback can depend on it)
  const [dragActive, setDragActive] = useState(false)

  // Pre-sort bars by row once per layout change (not per frame) — stored in ref to avoid draw callback dependency
  const barsByRowRef = useRef(new Map<number, import('@/lib/gantt/types').BarLayout[]>())
  useEffect(() => {
    barsByRowRef.current = layout ? buildBarsByRow(layout.bars) : new Map()
  }, [layout])

  // ── Draw ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !layout) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const vw = canvas.width / dpr
    const vh = canvas.height / dpr
    const { left: sx, top: sy } = scrollState.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw, vh)

    // Scenario mode: yellow background tint
    if (scenarioId) {
      ctx.fillStyle = isDark ? 'rgba(255,170,50,0.20)' : 'rgba(255,170,50,0.40)'
      ctx.fillRect(0, 0, vw, vh)
    }

    ctx.save()
    ctx.translate(-sx, -sy)

    drawGrid(ctx, layout.ticks, layout.rows, sx, sy, vw, vh, isDark, accentColor)
    drawGroupHeaders(ctx, layout.rows, sx, sy, vw, vh, isDark)
    const swapSourceIds = swapMode ? new Set(swapMode.sourceFlightIds) : undefined
    drawBars(ctx, layout.bars, selectedFlightIds, hoveredFlightId, sx, sy, vw, vh, swapSourceIds)
    if (showSlots) drawSlotLines(ctx, layout.bars, sx, sy, vw, vh)
    if (showMissingTimes) drawMissingTimeFlags(ctx, layout.bars, sx, sy, vw, vh, oooiGraceMins)
    if (showTat) drawTatLabels(ctx, barsByRowRef.current, sx, sy, vw, vh, isDark)
    drawNightstopLabels(ctx, barsByRowRef.current, sx, sy, vw, vh, isDark)

    // Drag & drop visuals
    const df = dragFlightRef.current
    if (df?.active && df.flightIds.size > 0) {
      const deltaY = df.currentY - df.startY
      const validity =
        df.targetRowIdx >= 0
          ? df.targetReg === df.sourceReg
            ? ('invalid' as const)
            : df.targetType && df.sourceType && df.targetType !== df.sourceType
              ? ('cross-type' as const)
              : ('valid' as const)
          : ('invalid' as const)
      drawDropTarget(ctx, layout.rows, df.targetRowIdx, validity, sx, vw)
      drawDragGhosts(ctx, layout.bars, df.flightIds, sx, sy, vw, vh)
      drawDraggedBars(ctx, layout.bars, df.flightIds, deltaY, sx, sy, vw, vh)
    }

    // Now-line
    const pph = computePixelsPerHour(containerWidth, zoomLevel)
    const startMs = dateToMs(periodFrom)
    const endMs = dateToMs(periodTo) + 86_400_000
    const periodDays = Math.round((endMs - startMs) / 86_400_000)
    const nowX = computeNowLineX(startMs, periodDays, pph)
    if (nowX !== null) drawNowLine(ctx, nowX, layout.totalHeight)

    ctx.restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    layout,
    selectedFlightIds,
    hoveredFlightId,
    isDark,
    periodFrom,
    periodTo,
    containerWidth,
    zoomLevel,
    swapMode,
    dragActive,
    showTat,
    showSlots,
    showMissingTimes,
    oooiGraceMins,
    scenarioId,
  ])

  const drawRef = useRef(draw)
  drawRef.current = draw

  // ── Resize observer ──
  // Canvas resize is immediate (visual), but layout recompute is debounced (expensive)
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const scroll = scrollRef.current
      const canvas = canvasRef.current
      if (!scroll || !canvas) return
      const w = scroll.clientWidth
      const h = scroll.clientHeight
      // Resize canvas immediately (visual — no flicker)
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => drawRef.current())
      // Debounce the expensive layout recompute — wait for resize to settle
      if (resizeTimer.current) clearTimeout(resizeTimer.current)
      resizeTimer.current = setTimeout(() => {
        if (w > 0) setContainerWidth(w)
      }, 200)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [setContainerWidth])

  // ── Scroll sync ──
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    scrollState.current = { left: el.scrollLeft, top: el.scrollTop }
    if (rowLabelsRef.current) rowLabelsRef.current.style.transform = `translateY(-${el.scrollTop}px)`
    if (headerRef.current) headerRef.current.style.transform = `translateX(-${el.scrollLeft}px)`
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => drawRef.current())
  }, [])

  // ── Rubberband drag selection + flight drag & drop ──
  const dragRef = useRef<{
    startX: number
    startY: number
    dragging: boolean
    ctrlKey: boolean
    hitBarId: string | null
  } | null>(null)
  const [rubberband, setRubberband] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // Flight drag & drop state
  const DRAG_HOLD_MS = 50
  const dragFlightRef = useRef<{
    active: boolean
    timerId: ReturnType<typeof setTimeout> | null
    flightIds: Set<string>
    sourceReg: string | null
    sourceType: string | null
    startY: number
    currentY: number
    targetRowIdx: number
    targetReg: string | null
    targetType: string | null
  } | null>(null)
  // dragActive state declared above (before draw callback)

  const cancelDragFlight = useCallback(() => {
    if (dragFlightRef.current?.timerId) clearTimeout(dragFlightRef.current.timerId)
    dragFlightRef.current = null
    setDragActive(false)
    if (scrollRef.current) scrollRef.current.style.cursor = 'default'
  }, [])

  // Escape cancels flight drag
  useEffect(() => {
    if (!dragActive) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDragFlight()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dragActive, cancelDragFlight])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || !layout) return
      const s = useGanttStore.getState()
      if (s.swapMode) return // don't interfere with swap mode
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top
      const hitBarId = hitTestBars(x, y, layout.bars)

      dragRef.current = { startX: x, startY: y, dragging: false, ctrlKey: e.ctrlKey || e.metaKey, hitBarId }

      // If mousedown is on a bar, arm the drag-flight timer
      if (hitBarId) {
        const bar = layout.bars.find((b) => b.flightId === hitBarId)
        const row = bar ? layout.rows[bar.row] : null
        const sourceReg = row?.registration ?? null
        const sourceType = row?.aircraftTypeIcao ?? null

        const timerId = setTimeout(() => {
          if (!dragFlightRef.current) return
          // Timer fired — activate drag mode
          const sel = useGanttStore.getState().selectedFlightIds
          let flightIds: Set<string>
          if (sel.has(hitBarId) && sel.size > 1) {
            flightIds = new Set(sel) // drag all selected
          } else {
            flightIds = new Set([hitBarId]) // drag just this one
          }
          dragFlightRef.current.active = true
          dragFlightRef.current.flightIds = flightIds
          setDragActive(true)
          if (scrollRef.current) scrollRef.current.style.cursor = 'grabbing'
        }, DRAG_HOLD_MS)

        dragFlightRef.current = {
          active: false,
          timerId,
          flightIds: new Set(),
          sourceReg,
          sourceType,
          startY: y,
          currentY: y,
          targetRowIdx: -1,
          targetReg: null,
          targetType: null,
        }
      }
    },
    [layout],
  )

  const handleMouseMoveDrag = useCallback(
    (e: React.MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      if (!layout) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top

      // Flight drag mode — bar follows cursor Y
      if (dragFlightRef.current?.active) {
        dragFlightRef.current.currentY = y
        // Hit-test target row
        const rowIdx = hitTestRow(y, layout.rows)
        dragFlightRef.current.targetRowIdx = rowIdx
        if (rowIdx >= 0) {
          const row = layout.rows[rowIdx]
          dragFlightRef.current.targetReg = row.registration ?? null
          dragFlightRef.current.targetType = row.aircraftTypeIcao ?? null
        } else {
          dragFlightRef.current.targetReg = null
          dragFlightRef.current.targetType = null
        }
        cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(() => drawRef.current())
        return // skip rubberband + hover during flight drag
      }

      // Rubberband drag (only if started on empty space)
      if (dragRef.current && !dragRef.current.hitBarId) {
        const dx = Math.abs(x - dragRef.current.startX)
        const dy = Math.abs(y - dragRef.current.startY)
        if (dx > 5 || dy > 5) {
          dragRef.current.dragging = true
          const rx = Math.min(dragRef.current.startX, x)
          const ry = Math.min(dragRef.current.startY, y)
          const rw = Math.abs(x - dragRef.current.startX)
          const rh = Math.abs(y - dragRef.current.startY)
          setRubberband({ x: rx, y: ry, w: rw, h: rh })
        }
      } else if (dragRef.current?.hitBarId && !dragFlightRef.current?.active) {
        // Mouse moved before drag timer fired — check if we should cancel the arm and start rubberband
        const dx = Math.abs(x - dragRef.current.startX)
        const dy = Math.abs(y - dragRef.current.startY)
        if (dx > 5 || dy > 5) {
          // Moved too far before hold timer — cancel flight drag, start rubberband
          if (dragFlightRef.current?.timerId) clearTimeout(dragFlightRef.current.timerId)
          dragFlightRef.current = null
          dragRef.current.hitBarId = null // convert to rubberband
          dragRef.current.dragging = true
          const rx = Math.min(dragRef.current.startX, x)
          const ry = Math.min(dragRef.current.startY, y)
          const rw = Math.abs(x - dragRef.current.startX)
          const rh = Math.abs(y - dragRef.current.startY)
          setRubberband({ x: rx, y: ry, w: rw, h: rh })
        }
      }

      // Hover — throttled to 50ms to avoid 60+ hit-tests/sec on thousands of bars
      const now = performance.now()
      if (now - lastHoverTime.current > 50) {
        lastHoverTime.current = now
        const newHovered = hitTestBars(x, y, layout.bars)
        if (newHovered !== useGanttStore.getState().hoveredFlightId) {
          useGanttStore.getState().setHovered(newHovered)
          cancelAnimationFrame(rafId.current)
          rafId.current = requestAnimationFrame(() => drawRef.current())
        }
      }
    },
    [layout],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!layout || e.button !== 0) return

      // ── Flight drag drop ──
      if (dragFlightRef.current?.active) {
        const df = dragFlightRef.current
        const targetRow = df.targetRowIdx >= 0 ? layout.rows[df.targetRowIdx] : null

        if (targetRow?.registration && targetRow.registration !== df.sourceReg) {
          const flightIds = [...df.flightIds]
          const draggedFlights = flights.filter((f) => flightIds.includes(f.id))
          const dragDates = new Set(draggedFlights.map((f) => f.operatingDate))

          // Find flights on the target row for the same dates (fill the blank)
          const targetFlightIds = layout.bars
            .filter((b) => {
              const row = layout.rows[b.row]
              return row?.registration === targetRow.registration && dragDates.has(b.flight.operatingDate)
            })
            .map((b) => b.flightId)
            .filter((id) => !flightIds.includes(id))

          // Visual rearrange only — no DB writes, just swap virtual placements
          useGanttStore
            .getState()
            .rearrangeVirtualPlacements(flightIds, df.sourceReg, targetFlightIds, targetRow.registration)
        }

        cancelDragFlight()
        dragRef.current = null
        setRubberband(null)
        return
      }

      // ── Cancel flight drag arm if timer hasn't fired ──
      if (dragFlightRef.current?.timerId) {
        clearTimeout(dragFlightRef.current.timerId)
        dragFlightRef.current = null
      }

      const drag = dragRef.current
      dragRef.current = null
      setRubberband(null)

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top

      if (drag?.dragging) {
        // Rubberband complete — select all bars within rectangle
        const rx = Math.min(drag.startX, x)
        const ry = Math.min(drag.startY, y)
        const rw = Math.abs(x - drag.startX)
        const rh = Math.abs(y - drag.startY)

        const selected = new Set<string>()
        for (const bar of layout.bars) {
          const barRight = bar.x + bar.width
          const barBottom = bar.y + bar.height
          if (bar.x < rx + rw && barRight > rx && bar.y < ry + rh && barBottom > ry) {
            selected.add(bar.flightId)
          }
        }
        if (selected.size > 0) {
          useGanttStore.setState({ selectedFlightIds: selected })
        }
      } else {
        // Simple click
        const s = useGanttStore.getState()
        s.closeContextMenu()
        const hit = hitTestBars(x, y, layout.bars)

        // In swap mode, clicking a flight picks the swap target
        if (s.swapMode && hit) {
          s.pickSwapTarget(hit)
          return
        }

        if (hit) s.selectFlight(hit, drag?.ctrlKey ?? false)
        else s.clearSelection()
      }
    },
    [layout, cancelDragFlight],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      // Cancel flight drag on right-click
      if (dragFlightRef.current?.active) {
        cancelDragFlight()
        return
      }
      if (!layout) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top
      const hit = hitTestBars(x, y, layout.bars)
      if (hit) {
        // Preserve multi-select if right-clicked flight is already selected
        const s = useGanttStore.getState()
        if (!s.selectedFlightIds.has(hit)) {
          s.selectFlight(hit, false)
        }
        s.openContextMenu(e.clientX, e.clientY, hit)
      } else {
        // No flight bar hit — check if we're on an aircraft row
        const s = useGanttStore.getState()
        const row = layout.rows.find((r) => r.type === 'aircraft' && y >= r.y && y < r.y + r.height)
        if (row?.registration) {
          const pph = computePixelsPerHour(s.containerWidth || 1200, s.zoomLevel)
          const startMs = dateToMs(s.periodFrom)
          const clickMs = xToUtc(x, startMs, pph)
          const clickDate = new Date(clickMs).toISOString().slice(0, 10)
          s.openRowContextMenu(e.clientX, e.clientY, row.registration, row.aircraftTypeIcao ?? '', clickDate)
        }
      }
    },
    [layout],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!layout) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top
      const hit = hitTestBars(x, y, layout.bars)
      if (hit) useGanttStore.getState().openFlightInfo(hit)
    },
    [layout],
  )

  // Cursor
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.style.cursor = dragActive
        ? 'grabbing'
        : swapMode
          ? 'crosshair'
          : hoveredFlightId
            ? 'grab'
            : 'default'
  }, [hoveredFlightId])

  // Redraw on data/view changes (hover excluded — handled by mouse move rAF)
  useEffect(() => {
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => drawRef.current())
  }, [layout, selectedFlightIds, isDark, showTat, showSlots, showMissingTimes, oooiGraceMins])

  // Now-line timer
  useEffect(() => {
    const id = setInterval(() => {
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => drawRef.current())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Scroll to target (nav arrows / Today / search)
  useEffect(() => {
    if (scrollTargetMs === null || !scrollRef.current) return
    const startMs = new Date(periodFrom + 'T00:00:00Z').getTime()
    const pph = computePixelsPerHour(containerWidth, zoomLevel)
    const targetX = ((scrollTargetMs - startMs) / 3_600_000) * pph
    const el = scrollRef.current
    // Center horizontally
    const centerX = Math.max(0, targetX - el.clientWidth / 2)
    el.scrollLeft = centerX

    // Also center vertically if we can find the bar
    const selectedIds = useGanttStore.getState().selectedFlightIds
    if (selectedIds.size === 1 && layout) {
      const [selectedId] = selectedIds
      const bar = layout.bars.find((b) => b.flightId === selectedId)
      if (bar) {
        const centerY = Math.max(0, bar.y - el.clientHeight / 2 + bar.height / 2)
        el.scrollTop = centerY
      }
    }

    consumeScrollTarget()
  }, [scrollTargetMs, periodFrom, containerWidth, zoomLevel, consumeScrollTarget, layout])

  // ── Hovered flight for tooltip (hide when any overlay is open) ──
  const contextMenu = useGanttStore((s) => s.contextMenu)
  const aircraftCtxMenu = useGanttStore((s) => s.aircraftContextMenu)
  const dayCtxMenu = useGanttStore((s) => s.dayContextMenu)
  const rowCtxMenu = useGanttStore((s) => s.rowContextMenu)
  const flightInfoDialogId = useGanttStore((s) => s.flightInfoDialogId)
  const aircraftPopover = useGanttStore((s) => s.aircraftPopover)
  const dailySummary = useGanttStore((s) => s.dailySummaryPopover)
  const rotationPop = useGanttStore((s) => s.rotationPopover)
  const assignPop = useGanttStore((s) => s.assignPopover)
  const hoveredFlight = useMemo(() => {
    if (
      !hoveredFlightId ||
      contextMenu ||
      aircraftCtxMenu ||
      dayCtxMenu ||
      rowCtxMenu ||
      flightInfoDialogId ||
      aircraftPopover ||
      dailySummary ||
      rotationPop ||
      assignPop
    )
      return null
    return flights.find((f) => f.id === hoveredFlightId) ?? null
  }, [
    hoveredFlightId,
    flights,
    contextMenu,
    aircraftCtxMenu,
    dayCtxMenu,
    rowCtxMenu,
    flightInfoDialogId,
    aircraftPopover,
    dailySummary,
    rotationPop,
    assignPop,
  ])

  // ── Theme ──
  const palette = isDark ? colors.dark : colors.light
  const headerBg = isDark ? glass.panel : 'rgba(255,255,255,0.90)'
  const labelBg = isDark ? palette.backgroundSecondary : palette.card

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ── Time header ── */}
      <div
        className="shrink-0 flex"
        style={{ height: 44, borderBottom: `1px solid ${palette.border}`, background: headerBg }}
      >
        <div
          className="shrink-0 flex items-end justify-center pb-1"
          style={{ width: ROW_LABEL_W, borderRight: `1px solid ${palette.border}` }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: palette.textTertiary }}>
            Aircraft
          </span>
        </div>
        <div
          className="flex-1 overflow-hidden relative"
          onContextMenu={(e) => {
            e.preventDefault()
            // Find the closest date from click position
            if (!ticks) return
            const rect = e.currentTarget.getBoundingClientRect()
            const clickX = e.clientX - rect.left + (headerRef.current?.parentElement?.scrollLeft ?? 0)
            const pph = computePixelsPerHour(containerWidth, zoomLevel)
            const dayW = pph * 24
            const majorTick = ticks.filter((t) => t.isMajor && t.date).find((t) => clickX >= t.x && clickX < t.x + dayW)
            if (majorTick?.date) useGanttStore.getState().openDayContextMenu(e.clientX, e.clientY, majorTick.date)
          }}
        >
          <div ref={headerRef} className="absolute left-0 top-0 h-full" style={{ width: totalWidth || '100%' }}>
            {(() => {
              const dayW = computePixelsPerHour(containerWidth, zoomLevel) * 24
              const weekendBg = accentColor
                ? hexToRgba(accentColor, 0.15)
                : isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)'
              return (
                <>
                  {/* Weekend header shading */}
                  {ticks
                    .filter((t) => t.isMajor && t.date)
                    .map((t) => {
                      const jsDay = new Date(t.date! + 'T12:00:00Z').getUTCDay()
                      if (jsDay !== 0 && jsDay !== 6) return null
                      return (
                        <div
                          key={`wk${t.x}`}
                          className="absolute top-0 h-full"
                          style={{ left: t.x, width: dayW, background: weekendBg }}
                        />
                      )
                    })}
                  {/* Day labels */}
                  <div className="h-6 relative">
                    {ticks
                      .filter((t) => t.isMajor)
                      .map((t) => (
                        <span
                          key={t.x}
                          className="absolute top-1 text-[13px] font-bold whitespace-nowrap cursor-pointer text-center"
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            left: t.x,
                            width: dayW,
                            color: palette.text,
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            if (t.date) useGanttStore.getState().openDayContextMenu(e.clientX, e.clientY, t.date)
                          }}
                        >
                          {t.label}
                        </span>
                      ))}
                  </div>
                  {/* Hour labels */}
                  <div className="h-[18px] relative">
                    {ticks
                      .filter((t) => !t.isMajor)
                      .map((t) => (
                        <span
                          key={t.x}
                          className="absolute top-0 text-[11px] font-mono"
                          style={{ left: t.x + 2, color: palette.textTertiary }}
                        >
                          {t.label}
                        </span>
                      ))}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Row labels */}
        <div
          className="shrink-0 overflow-hidden"
          style={{ width: ROW_LABEL_W, background: labelBg, borderRight: `1px solid ${palette.border}` }}
        >
          <div ref={rowLabelsRef} style={{ height: totalHeight }}>
            {rows.map((row, i) => {
              if (row.type === 'group_header') {
                const isCollapsed = collapsedTypes.has(row.aircraftTypeIcao!)
                return (
                  <div
                    key={`g${i}`}
                    className="flex items-center gap-1.5 px-2 cursor-pointer select-none transition-colors duration-150"
                    style={{
                      height: row.height,
                      borderLeft: `3px solid ${row.color ?? 'transparent'}`,
                      background: row.color ? `${row.color}08` : undefined,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = palette.backgroundHover)}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = row.color ? `${row.color}08` : 'transparent')
                    }
                    onClick={() => toggleTypeCollapse(row.aircraftTypeIcao!)}
                  >
                    <ChevronDown
                      size={12}
                      className={`shrink-0 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                      style={{ color: palette.textSecondary }}
                    />
                    <span className="text-[11px] font-bold truncate" style={{ color: palette.text }}>
                      {row.label}
                    </span>
                  </div>
                )
              }
              if (row.type === 'unassigned') {
                return (
                  <div
                    key={`u${i}`}
                    className="flex items-center px-3 select-none"
                    style={{ height: row.height, borderLeft: `3px solid ${palette.textTertiary}` }}
                  >
                    <span className="text-[11px] font-medium truncate" style={{ color: palette.textSecondary }}>
                      {row.label}
                    </span>
                  </div>
                )
              }
              return (
                <div
                  key={`a${i}`}
                  className="flex flex-col justify-center px-3 cursor-pointer"
                  style={{ height: row.height, borderLeft: `3px solid ${row.color ?? 'transparent'}` }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (row.registration) {
                      useGanttStore
                        .getState()
                        .openAircraftContextMenu(e.clientX, e.clientY, row.registration, row.aircraftTypeIcao ?? '')
                    }
                  }}
                >
                  <span
                    className="font-mono font-bold leading-tight"
                    style={{ color: palette.text, fontSize: ROW_HEIGHT_LEVELS[rowHeightLevel].fontSize + 2 }}
                  >
                    {row.registration}
                  </span>
                  <span
                    className="font-mono leading-tight"
                    style={{ color: palette.textTertiary, fontSize: ROW_HEIGHT_LEVELS[rowHeightLevel].fontSize }}
                  >
                    {row.seatConfig ?? row.aircraftTypeName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Canvas + scroll sentinel */}
        <div ref={containerRef} className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
          <canvas ref={canvasRef} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 0 }} />
          <div
            ref={scrollRef}
            className="gantt-scroll absolute inset-0"
            style={{ overflow: 'scroll', zIndex: 1 }}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveDrag}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => useGanttStore.getState().setHovered(null)}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          >
            <div style={{ width: totalWidth, height: totalHeight }} />
            {/* Rubberband selection rectangle */}
            {rubberband && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: rubberband.x,
                  top: rubberband.y,
                  width: rubberband.w,
                  height: rubberband.h,
                  background: 'rgba(30,64,175,0.08)',
                  border: '2px solid rgba(30,64,175,0.35)',
                  borderRadius: 2,
                  zIndex: 2,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Flight hover tooltip — portaled to body */}
      <FlightTooltip flight={hoveredFlight} mousePosRef={mousePosRef} isDark={isDark} />

      {/* Right-click context menus */}
      <GanttContextMenu />
      <AircraftContextMenu />

      {/* Aircraft registration popover */}
      <AircraftPopover />

      {/* Day header context menu + summary */}
      <DayContextMenu />
      <DailySummaryPopover />

      {/* Empty row context menu + rotation */}
      <RowContextMenu />
      <RotationPopover />

      {/* Assign aircraft popover */}
      <AssignPopover />

      {/* Swap dialog */}
      <GanttSwapDialog />

      {/* Cancel dialog */}
      <GanttCancelDialog />
    </div>
  )
}
