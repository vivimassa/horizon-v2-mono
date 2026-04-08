"use client"

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors, glass } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { computePixelsPerHour, computeNowLineX, dateToMs, xToUtc } from '@/lib/gantt/time-axis'
import { hitTestBars } from '@/lib/gantt/hit-testing'
import { drawGrid, drawGroupHeaders, drawBars, drawTatLabels, drawNowLine } from '@/lib/gantt/draw-helpers'
import { FlightTooltip } from './gantt-flight-tooltip'
import { GanttContextMenu } from './gantt-context-menu'
import { AircraftContextMenu } from './aircraft-context-menu'
import { AircraftPopover } from './aircraft-popover'
import { DayContextMenu } from './day-context-menu'
import { DailySummaryPopover } from './daily-summary-popover'
import { RowContextMenu } from './row-context-menu'
import { RotationPopover } from './rotation-popover'
import { AssignPopover } from './assign-popover'

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

  // Store
  const layout = useGanttStore(s => s.layout)
  const flights = useGanttStore(s => s.flights)
  const selectedFlightIds = useGanttStore(s => s.selectedFlightIds)
  const hoveredFlightId = useGanttStore(s => s.hoveredFlightId)
  const periodFrom = useGanttStore(s => s.periodFrom)
  const periodTo = useGanttStore(s => s.periodTo)
  const containerWidth = useGanttStore(s => s.containerWidth)
  const zoomLevel = useGanttStore(s => s.zoomLevel)
  const collapsedTypes = useGanttStore(s => s.collapsedTypes)
  const scrollTargetMs = useGanttStore(s => s.scrollTargetMs)
  const toggleTypeCollapse = useGanttStore(s => s.toggleTypeCollapse)
  const setContainerWidth = useGanttStore(s => s.setContainerWidth)
  const consumeScrollTarget = useGanttStore(s => s.consumeScrollTarget)

  const rows = layout?.rows ?? []
  const ticks = layout?.ticks ?? []
  const totalWidth = layout?.totalWidth ?? 0
  const totalHeight = layout?.totalHeight ?? 0

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
    ctx.save()
    ctx.translate(-sx, -sy)

    drawGrid(ctx, layout.ticks, layout.rows, sx, sy, vw, vh, isDark, accentColor)
    drawGroupHeaders(ctx, layout.rows, sx, sy, vw, vh, isDark)
    drawBars(ctx, layout.bars, selectedFlightIds, hoveredFlightId, sx, sy, vw, vh)
    drawTatLabels(ctx, layout.bars, sx, vw, isDark)

    // Now-line
    const pph = computePixelsPerHour(containerWidth, zoomLevel)
    const startMs = dateToMs(periodFrom)
    const endMs = dateToMs(periodTo) + 86_400_000
    const periodDays = Math.round((endMs - startMs) / 86_400_000)
    const nowX = computeNowLineX(startMs, periodDays, pph)
    if (nowX !== null) drawNowLine(ctx, nowX, layout.totalHeight)

    ctx.restore()
  }, [layout, selectedFlightIds, hoveredFlightId, isDark, periodFrom, periodTo, containerWidth, zoomLevel])

  const drawRef = useRef(draw)
  drawRef.current = draw

  // ── Resize observer ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const scroll = scrollRef.current
      const canvas = canvasRef.current
      if (!scroll || !canvas) return
      const w = scroll.clientWidth
      const h = scroll.clientHeight
      if (w > 0) setContainerWidth(w)
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => drawRef.current())
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

  // ── Rubberband drag selection + mouse events ──
  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean; ctrlKey: boolean } | null>(null)
  const [rubberband, setRubberband] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !layout) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left + scrollState.current.left
    const y = e.clientY - rect.top + scrollState.current.top
    dragRef.current = { startX: x, startY: y, dragging: false, ctrlKey: e.ctrlKey || e.metaKey }
  }, [layout])

  const handleMouseMoveDrag = useCallback((e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY }
    if (!layout) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left + scrollState.current.left
    const y = e.clientY - rect.top + scrollState.current.top

    // Rubberband drag
    if (dragRef.current) {
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
    }

    // Hover
    useGanttStore.getState().setHovered(hitTestBars(x, y, layout.bars))
  }, [layout])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!layout || e.button !== 0) return
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
      useGanttStore.getState().closeContextMenu()
      const hit = hitTestBars(x, y, layout.bars)
      if (hit) useGanttStore.getState().selectFlight(hit, drag?.ctrlKey ?? false)
      else useGanttStore.getState().clearSelection()
    }
  }, [layout])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
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
      const row = layout.rows.find(r => r.type === 'aircraft' && y >= r.y && y < r.y + r.height)
      if (row?.registration) {
        const pph = computePixelsPerHour(s.containerWidth || 1200, s.zoomLevel)
        const startMs = dateToMs(s.periodFrom)
        const clickMs = xToUtc(x, startMs, pph)
        const clickDate = new Date(clickMs).toISOString().slice(0, 10)
        s.openRowContextMenu(e.clientX, e.clientY, row.registration, row.aircraftTypeIcao ?? '', clickDate)
      }
    }
  }, [layout])

  // Cursor
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.style.cursor = hoveredFlightId ? 'pointer' : 'default'
  }, [hoveredFlightId])

  // Redraw on data/view changes
  useEffect(() => {
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => drawRef.current())
  }, [layout, selectedFlightIds, hoveredFlightId, isDark])

  // Now-line timer
  useEffect(() => {
    const id = setInterval(() => {
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => drawRef.current())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Scroll to target (nav arrows / Today button)
  useEffect(() => {
    if (scrollTargetMs === null || !scrollRef.current) return
    const startMs = new Date(periodFrom + 'T00:00:00Z').getTime()
    const pph = computePixelsPerHour(containerWidth, zoomLevel)
    const targetX = ((scrollTargetMs - startMs) / 3_600_000) * pph
    scrollRef.current.scrollLeft = Math.max(0, targetX)
    consumeScrollTarget()
  }, [scrollTargetMs, periodFrom, containerWidth, zoomLevel, consumeScrollTarget])

  // ── Hovered flight for tooltip (hide when any overlay is open) ──
  const contextMenu = useGanttStore(s => s.contextMenu)
  const aircraftCtxMenu = useGanttStore(s => s.aircraftContextMenu)
  const dayCtxMenu = useGanttStore(s => s.dayContextMenu)
  const rowCtxMenu = useGanttStore(s => s.rowContextMenu)
  const flightInfoDialogId = useGanttStore(s => s.flightInfoDialogId)
  const aircraftPopover = useGanttStore(s => s.aircraftPopover)
  const dailySummary = useGanttStore(s => s.dailySummaryPopover)
  const rotationPop = useGanttStore(s => s.rotationPopover)
  const assignPop = useGanttStore(s => s.assignPopover)
  const hoveredFlight = useMemo(() => {
    if (!hoveredFlightId || contextMenu || aircraftCtxMenu || dayCtxMenu || rowCtxMenu || flightInfoDialogId || aircraftPopover || dailySummary || rotationPop || assignPop) return null
    return flights.find(f => f.id === hoveredFlightId) ?? null
  }, [hoveredFlightId, flights, contextMenu, aircraftCtxMenu, dayCtxMenu, rowCtxMenu, flightInfoDialogId, aircraftPopover, dailySummary, rotationPop, assignPop])

  // ── Theme ──
  const palette = isDark ? colors.dark : colors.light
  const headerBg = isDark ? glass.panel : 'rgba(255,255,255,0.90)'
  const labelBg = isDark ? palette.backgroundSecondary : palette.card

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ── Time header ── */}
      <div className="shrink-0 flex" style={{ height: 44, borderBottom: `1px solid ${palette.border}`, background: headerBg }}>
        <div className="shrink-0 flex items-end justify-center pb-1" style={{ width: ROW_LABEL_W, borderRight: `1px solid ${palette.border}` }}>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: palette.textTertiary }}>Aircraft</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div ref={headerRef} className="absolute left-0 top-0 h-full" style={{ width: totalWidth || '100%' }}>
            {(() => {
              const dayW = computePixelsPerHour(containerWidth, zoomLevel) * 24
              const weekendBg = accentColor
                ? hexToRgba(accentColor, 0.15)
                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
              return (
                <>
                  {/* Weekend header shading */}
                  {ticks.filter(t => t.isMajor && t.date).map(t => {
                    const jsDay = new Date(t.date! + 'T12:00:00Z').getUTCDay()
                    if (jsDay !== 0 && jsDay !== 6) return null
                    return <div key={`wk${t.x}`} className="absolute top-0 h-full" style={{ left: t.x, width: dayW, background: weekendBg }} />
                  })}
                  {/* Day labels */}
                  <div className="h-6 relative">
                    {ticks.filter(t => t.isMajor).map(t => (
                      <span key={t.x} className="absolute top-1 text-[13px] font-bold whitespace-nowrap cursor-pointer text-center"
                        style={{ fontFamily: 'Inter, system-ui, sans-serif', left: t.x, width: dayW, color: palette.text }}
                        onContextMenu={e => {
                          e.preventDefault()
                          if (t.date) useGanttStore.getState().openDayContextMenu(e.clientX, e.clientY, t.date)
                        }}>{t.label}</span>
                    ))}
                  </div>
                  {/* Hour labels */}
                  <div className="h-[18px] relative">
                    {ticks.filter(t => !t.isMajor).map(t => (
                      <span key={t.x} className="absolute top-0 text-[11px] font-mono"
                        style={{ left: t.x + 2, color: palette.textTertiary }}>{t.label}</span>
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
        <div className="shrink-0 overflow-hidden" style={{ width: ROW_LABEL_W, background: labelBg, borderRight: `1px solid ${palette.border}` }}>
          <div ref={rowLabelsRef} style={{ height: totalHeight }}>
            {rows.map((row, i) => {
              if (row.type === 'group_header') {
                const isCollapsed = collapsedTypes.has(row.aircraftTypeIcao!)
                return (
                  <div key={`g${i}`}
                    className="flex items-center gap-1.5 px-2 cursor-pointer select-none transition-colors duration-150"
                    style={{ height: row.height, borderLeft: `3px solid ${row.color ?? 'transparent'}`, background: row.color ? `${row.color}08` : undefined }}
                    onMouseEnter={e => (e.currentTarget.style.background = palette.backgroundHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = row.color ? `${row.color}08` : 'transparent')}
                    onClick={() => toggleTypeCollapse(row.aircraftTypeIcao!)}>
                    <ChevronDown size={12} className={`shrink-0 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} style={{ color: palette.textSecondary }} />
                    <span className="text-[11px] font-bold truncate" style={{ color: palette.text }}>{row.label}</span>
                  </div>
                )
              }
              if (row.type === 'unassigned') {
                return (
                  <div key={`u${i}`} className="flex items-center px-3 select-none"
                    style={{ height: row.height, borderLeft: `3px solid ${palette.textTertiary}` }}>
                    <span className="text-[11px] font-medium truncate" style={{ color: palette.textSecondary }}>{row.label}</span>
                  </div>
                )
              }
              return (
                <div key={`a${i}`} className="flex flex-col justify-center px-3 cursor-pointer"
                  style={{ height: row.height, borderLeft: `3px solid ${row.color ?? 'transparent'}` }}
                  onContextMenu={e => {
                    e.preventDefault()
                    if (row.registration) {
                      useGanttStore.getState().openAircraftContextMenu(e.clientX, e.clientY, row.registration, row.aircraftTypeIcao ?? '')
                    }
                  }}>
                  <span className="text-[13px] font-mono font-bold leading-tight" style={{ color: palette.text }}>{row.registration}</span>
                  <span className="text-[11px] font-mono leading-tight" style={{ color: palette.textTertiary }}>{row.aircraftTypeName}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Canvas + scroll sentinel */}
        <div ref={containerRef} className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
          <canvas ref={canvasRef} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 0 }} />
          <div ref={scrollRef} className="gantt-scroll absolute inset-0" style={{ overflow: 'scroll', zIndex: 1 }}
            onScroll={handleScroll} onMouseDown={handleMouseDown} onMouseMove={handleMouseMoveDrag} onMouseUp={handleMouseUp} onContextMenu={handleContextMenu}>
            <div style={{ width: totalWidth, height: totalHeight }} />
            {/* Rubberband selection rectangle */}
            {rubberband && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: rubberband.x, top: rubberband.y,
                  width: rubberband.w, height: rubberband.h,
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
    </div>
  )
}
