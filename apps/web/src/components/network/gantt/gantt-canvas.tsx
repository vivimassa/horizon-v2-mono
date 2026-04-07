"use client"

import { useRef, useCallback, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors, glass } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { computePixelsPerHour, computeNowLineX, dateToMs } from '@/lib/gantt/time-axis'
import { hitTestBars } from '@/lib/gantt/hit-testing'
import { drawGrid, drawGroupHeaders, drawBars, drawTatLabels, drawNowLine } from '@/lib/gantt/draw-helpers'

const ROW_LABEL_W = 160

export function GanttCanvas() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowLabelsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollState = useRef({ left: 0, top: 0 })
  const rafId = useRef(0)

  // Store
  const layout = useGanttStore(s => s.layout)
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

    drawGrid(ctx, layout.ticks, layout.rows, sx, sy, vw, vh, isDark)
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

  // ── Mouse events ──
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!layout) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left + scrollState.current.left
    const y = e.clientY - rect.top + scrollState.current.top
    useGanttStore.getState().setHovered(hitTestBars(x, y, layout.bars))
  }, [layout])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!layout) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left + scrollState.current.left
    const y = e.clientY - rect.top + scrollState.current.top
    const hit = hitTestBars(x, y, layout.bars)
    if (hit) useGanttStore.getState().selectFlight(hit, e.ctrlKey || e.metaKey)
    else useGanttStore.getState().clearSelection()
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
            <div className="h-6 relative">
              {ticks.filter(t => t.isMajor).map(t => (
                <span key={t.x} className="absolute top-1 text-[13px] font-bold font-mono whitespace-nowrap"
                  style={{ left: t.x + 4, color: palette.text }}>{t.label}</span>
              ))}
            </div>
            <div className="h-[18px] relative">
              {ticks.filter(t => !t.isMajor).map(t => (
                <span key={t.x} className="absolute top-0 text-[11px] font-mono"
                  style={{ left: t.x + 2, color: palette.textTertiary }}>{t.label}</span>
              ))}
            </div>
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
                <div key={`a${i}`} className="flex flex-col justify-center px-3"
                  style={{ height: row.height, borderLeft: `3px solid ${row.color ?? 'transparent'}` }}>
                  <span className="text-[13px] font-mono font-bold leading-tight" style={{ color: palette.text }}>{row.registration}</span>
                  <span className="text-[11px] font-mono leading-tight" style={{ color: palette.textTertiary }}>{row.aircraftTypeName}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Canvas + scroll sentinel */}
        <div ref={containerRef} className="flex-1 relative" style={{ minHeight: 0, minWidth: 0 }}>
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          <div ref={scrollRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto' }}
            onScroll={handleScroll} onMouseMove={handleMouseMove} onClick={handleClick}>
            <div style={{ width: totalWidth, height: totalHeight }} />
          </div>
        </div>
      </div>
    </div>
  )
}
