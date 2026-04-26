'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { api, type ApiError } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { dispatchTargetPicker } from '@/lib/crew-schedule/target-picker-dispatch'
import type {
  ActivityBarLayout,
  AssignmentBarLayout,
  CrewScheduleLayout,
  CrewRowLayout,
} from '@/lib/crew-schedule/layout'
import { computeDropLegality } from '@/lib/crew-schedule/drop-legality'
import { checkAssignmentViolations, partitionViolations } from '@/lib/crew-schedule/violations'
import { ActivityHoverTooltip } from './activity-hover-tooltip'
import { PairingHoverTooltip } from './pairing-hover-tooltip'

const HEADER_H = 48

interface CrewScheduleCanvasProps {
  layout: CrewScheduleLayout
}

/**
 * Canvas2D rendering of the crew Gantt grid. Matches the Claude design —
 * 42px rows, 28px bars, accent-blue flight fill, 135° diagonal stripes
 * for rest periods (no "Rest" text), weekend shading, now-line.
 */
export function CrewScheduleCanvas({ layout }: CrewScheduleCanvasProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const accentColor = useMemo(() => {
    if (typeof document === 'undefined') return '#3E7BFA'
    return getComputedStyle(document.documentElement).getPropertyValue('--module-accent').trim() || '#3E7BFA'
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stripePatternRef = useRef<CanvasPattern | null>(null)

  /** Shift-drag range-select state. Lives in a ref so mousemove doesn't
   *  re-render; commits to the store on change so the canvas redraws. */
  const dragSelectRef = useRef<{
    anchorDateIso: string
    anchorCrewId: string
    anchorRowIdx: number
    active: boolean
  } | null>(null)
  /** Flag that onClick uses to suppress selection immediately after a
   *  shift-drag or bar-drag ends — otherwise the click that fires on
   *  mouseup would clear the range / deselect the bar. */
  const justFinishedDragRef = useRef(false)

  /** Pending bar-drag — mouse is down on a bar but not yet moved enough
   *  to cross the drag threshold. Lives here (not in store) because it
   *  transitions very frequently during a single mousedown. */
  const pendingBarDragRef = useRef<{
    assignmentId: string
    pairingId: string
    crewId: string
    label: string
    startX: number
    startY: number
  } | null>(null)
  const DRAG_THRESHOLD_PX = 5

  /** rAF-coalesce store writes during an active bar drag. High-Hz mice
   *  fire mousemove 120–500× per second; without coalescing, each event
   *  would push a new `dragState` into the store → re-render canvas →
   *  full Gantt repaint. We instead buffer the latest event into a ref
   *  and flush once per frame. Cursor-only moves (same dropCrewId +
   *  legality + mode) skip the store write entirely. */
  const dragRafRef = useRef(0)
  const pendingDragUpdateRef = useRef<{
    clientX: number
    clientY: number
    row: CrewRowLayout | null
    ctrlOrMeta: boolean
  } | null>(null)
  /** Cached legality result keyed by `${targetCrewId}|${mode}`. Skips
   *  the O(assignments) recompute on every mousemove when the cursor
   *  stays in the same row. Cleared when drag ends. */
  const legalityCacheRef = useRef<
    Map<
      string,
      {
        level: 'legal' | 'warning' | 'violation'
        reason: string
        checks?: Array<{ label: string; actual: string; limit: string; status: 'warning' | 'violation' }>
        overridable?: boolean
      }
    >
  >(new Map())

  const selectedAssignmentId = useCrewScheduleStore((s) => s.selectedAssignmentId)
  const selectedActivityId = useCrewScheduleStore((s) => s.selectedActivityId)
  const selectedCrewId = useCrewScheduleStore((s) => s.selectedCrewId)
  const selectedDateIso = useCrewScheduleStore((s) => s.selectedDateIso)
  const cellSelectMode = useCrewScheduleStore((s) => s.cellSelectMode)
  const hoveredAssignmentId = useCrewScheduleStore((s) => s.hoveredAssignmentId)
  const hoveredActivityId = useCrewScheduleStore((s) => s.hoveredActivityId)
  const activities = useCrewScheduleStore((s) => s.activities)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const [activityHoverPos, setActivityHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [pairingHoverPos, setPairingHoverPos] = useState<{ x: number; y: number } | null>(null)
  const rangeSelection = useCrewScheduleStore((s) => s.rangeSelection)
  const dragState = useCrewScheduleStore((s) => s.dragState)
  const tempBases = useCrewScheduleStore((s) => s.tempBases)
  const selectAssignment = useCrewScheduleStore((s) => s.selectAssignment)
  const selectPairing = useCrewScheduleStore((s) => s.selectPairing)
  const selectActivity = useCrewScheduleStore((s) => s.selectActivity)
  const selectCrew = useCrewScheduleStore((s) => s.selectCrew)
  const selectDateCell = useCrewScheduleStore((s) => s.selectDateCell)
  const setHover = useCrewScheduleStore((s) => s.setHover)
  const setActivityHover = useCrewScheduleStore((s) => s.setActivityHover)
  const openContextMenu = useCrewScheduleStore((s) => s.openContextMenu)
  const setRangeSelection = useCrewScheduleStore((s) => s.setRangeSelection)
  const clearRangeSelection = useCrewScheduleStore((s) => s.clearRangeSelection)
  const setDragState = useCrewScheduleStore((s) => s.setDragState)
  const clearDragState = useCrewScheduleStore((s) => s.clearDragState)
  const setExportCanvasRef = useCrewScheduleStore((s) => s.setExportCanvasRef)

  // Register the canvas element with the store so Export (P4.3) can
  // grab its pixels. Unregisters on unmount.
  useEffect(() => {
    setExportCanvasRef(canvasRef.current)
    return () => setExportCanvasRef(null)
  }, [setExportCanvasRef])
  const setContainerWidth = useCrewScheduleStore((s) => s.setContainerWidth)
  const setScroll = useCrewScheduleStore((s) => s.setScroll)

  // Escape clears range-select OR cancels an active drag. Separate from
  // the shell's Delete shortcut so clearing never deletes by accident.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useCrewScheduleStore.getState()
      if (s.dragState) {
        pendingBarDragRef.current = null
        if (dragRafRef.current) {
          cancelAnimationFrame(dragRafRef.current)
          dragRafRef.current = 0
        }
        pendingDragUpdateRef.current = null
        legalityCacheRef.current.clear()
        clearDragState()
        return
      }
      if (s.swapPicker) {
        s.clearSwapPicker()
        return
      }
      if (s.targetPickerMode) {
        s.clearTargetPickerMode()
        return
      }
      if (s.rangeSelection) clearRangeSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearRangeSelection, clearDragState])

  // Window-level mouseup catches releases outside the canvas bounds. If
  // we don't do this, a user who drags off the viewport is stranded with
  // a stuck drag ghost until they click somewhere inside. Cancel = no-op
  // drop (no target); the store drag state clears either way.
  useEffect(() => {
    const onUp = () => {
      const s = useCrewScheduleStore.getState()
      if (s.dragState) {
        pendingBarDragRef.current = null
        if (dragRafRef.current) {
          cancelAnimationFrame(dragRafRef.current)
          dragRafRef.current = 0
        }
        pendingDragUpdateRef.current = null
        legalityCacheRef.current.clear()
        clearDragState()
      }
      if (dragSelectRef.current?.active) {
        dragSelectRef.current = null
      }
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [clearDragState])

  // Track container width via ResizeObserver.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [setContainerWidth])

  // Build the rest-strip pattern once per theme change.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pc = document.createElement('canvas')
    pc.width = 12
    pc.height = 12
    const pctx = pc.getContext('2d')
    if (!pctx) return
    // Prominent zebra so the mandatory-rest strip reads clearly on both
    // themes. Base fill is a muted neutral tint; diagonal stripes are
    // strong enough to survive against the dark page bg.
    pctx.fillStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(110,110,130,0.14)'
    pctx.fillRect(0, 0, 12, 12)
    pctx.strokeStyle = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(90,90,110,0.55)'
    pctx.lineWidth = 1.6
    pctx.beginPath()
    for (let i = -12; i <= 24; i += 6) {
      pctx.moveTo(i, 12)
      pctx.lineTo(i + 12, 0)
    }
    pctx.stroke()
    stripePatternRef.current = ctx.createPattern(pc, 'repeat')
  }, [isDark])

  // Redraw on layout or selection/hover changes.
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const scroll = scrollRef.current
    const container = containerRef.current
    if (!canvas || !scroll || !container) return
    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const sx = scroll.scrollLeft
    const sy = scroll.scrollTop
    const visX0 = sx
    const visX1 = sx + w
    const visY0 = sy
    const visY1 = sy + (h - HEADER_H)

    // ── Header ─────────────────────────────
    drawHeader(ctx, layout, sx, w, isDark)

    // Offset content below header
    ctx.save()
    ctx.translate(0, HEADER_H)

    // Alternating row backgrounds (zebra stripes) — makes row height
    // changes visible even when a crew has no bars. Matches MC's pattern.
    // Smart Filter highlight mode paints a subtle accent wash instead.
    for (let i = 0; i < layout.rows.length; i += 1) {
      const r = layout.rows[i]
      const y = r.y - sy
      if (y + r.height < 0 || y > h - HEADER_H) continue
      if (r.smartMatch) {
        ctx.fillStyle = hexToRgba(accentColor, 0.1)
        ctx.fillRect(0, y, w, r.height)
        // Left accent strip so the match reads even without scrolling.
        ctx.fillStyle = accentColor
        ctx.fillRect(0, y, 3, r.height)
      } else if (i % 2 === 1) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)'
        ctx.fillRect(0, y, w, r.height)
      }
    }

    // Weekend shading + day gridlines
    drawGrid(ctx, layout, visX0, visX1, sy, h - HEADER_H, isDark)

    // Row separators
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 0.5
    for (const r of layout.rows) {
      const y = r.y + r.height - sy
      if (y < 0 || y > h - HEADER_H) continue
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Temp base bands — subtle dark-yellow fill spanning the assigned
    // period for each crew row with an active assignment. Painted above
    // gridlines/zebra but below bars so duty pills remain legible.
    if (tempBases.length > 0) {
      const tempBaseFill = isDark ? 'rgba(217,160,35,0.18)' : 'rgba(217,160,35,0.22)'
      const tempBaseBorder = isDark ? 'rgba(217,160,35,0.55)' : 'rgba(176,128,20,0.7)'
      const tempBaseLabel = isDark ? '#F2C14E' : '#8A6310'
      const byCrew = new Map<string, typeof tempBases>()
      for (const t of tempBases) {
        const arr = byCrew.get(t.crewId) ?? []
        arr.push(t)
        byCrew.set(t.crewId, arr)
      }
      ctx.save()
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      for (const row of layout.rows) {
        const entries = byCrew.get(row.crewId)
        if (!entries) continue
        const y = row.y - sy
        if (y + row.height < 0 || y > h - HEADER_H) continue
        for (const t of entries) {
          const fromMs = new Date(t.fromIso + 'T00:00:00Z').getTime()
          const toMs = new Date(t.toIso + 'T00:00:00Z').getTime() + 86_400_000
          const x0 = ((fromMs - layout.periodStartMs) / 3_600_000) * layout.pph - sx
          const x1 = ((toMs - layout.periodStartMs) / 3_600_000) * layout.pph - sx
          if (x1 < 0 || x0 > w) continue
          const width = x1 - x0
          ctx.fillStyle = tempBaseFill
          ctx.fillRect(x0, y, width, row.height)
          ctx.strokeStyle = tempBaseBorder
          ctx.lineWidth = 1
          ctx.strokeRect(x0 + 0.5, y + 0.5, width - 1, row.height - 1)

          // Adaptive label: pick the longest variant that fits, drop
          // entirely when the band is narrower than the shortest form.
          const long = `TEMPORARY ${t.airportCode} BASE`
          const mid = `TEMP BASE ${t.airportCode}`
          const short = `TEMP ${t.airportCode}`
          ctx.fillStyle = tempBaseLabel
          let label: string | null = null
          for (const candidate of [long, mid, short]) {
            if (ctx.measureText(candidate).width + 16 <= width) {
              label = candidate
              break
            }
          }
          if (label) {
            const cx = Math.max(x0 + 8, Math.min(x0 + width / 2, x1 - 8))
            ctx.textAlign = 'center'
            ctx.fillText(label, cx, y + row.height / 2)
          }
        }
      }
      ctx.restore()
    }

    // Rest strips first (beneath bars so bars appear on top at edges).
    // Drawn with a SQUARE left edge + rounded right edge so the strip
    // visually reads as a continuation of the duty bar it sits next to,
    // not a separate floating pill. Border painted on the top / right /
    // bottom only — the left side butts flush against the duty pill.
    if (stripePatternRef.current) {
      const restBorder = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(90,90,110,0.40)'
      const R = 5
      for (const rs of layout.restStrips) {
        const x = rs.x - sx
        const y = rs.y - sy
        if (x + rs.width < 0 || x > w) continue
        if (y + rs.height < visY0 - sy || y > visY1 - sy) continue

        // Overlap 1 px into the preceding duty bar so antialiasing never
        // leaves a visible seam when the page is zoomed.
        const sx0 = x - 1
        const sw = rs.width + 1
        const rad = Math.min(R, sw / 2, rs.height / 2)

        // Fill — right-rounded rectangle.
        ctx.fillStyle = stripePatternRef.current
        ctx.beginPath()
        ctx.moveTo(sx0, y)
        ctx.lineTo(sx0 + sw - rad, y)
        ctx.quadraticCurveTo(sx0 + sw, y, sx0 + sw, y + rad)
        ctx.lineTo(sx0 + sw, y + rs.height - rad)
        ctx.quadraticCurveTo(sx0 + sw, y + rs.height, sx0 + sw - rad, y + rs.height)
        ctx.lineTo(sx0, y + rs.height)
        ctx.closePath()
        ctx.fill()

        // Border — top, right, bottom only (no left edge).
        ctx.strokeStyle = restBorder
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(sx0, y + 0.5)
        ctx.lineTo(sx0 + sw - rad, y + 0.5)
        ctx.quadraticCurveTo(sx0 + sw - 0.5, y + 0.5, sx0 + sw - 0.5, y + rad)
        ctx.lineTo(sx0 + sw - 0.5, y + rs.height - rad)
        ctx.quadraticCurveTo(sx0 + sw - 0.5, y + rs.height - 0.5, sx0 + sw - rad, y + rs.height - 0.5)
        ctx.lineTo(sx0, y + rs.height - 0.5)
        ctx.stroke()
      }
    }

    // Published-overlay ghost bars (removed assignments). Painted
    // beneath the live layer so live bars still win on overlap.
    if (layout.ghostBars.length > 0) {
      for (const g of layout.ghostBars) {
        const x = g.x - sx
        const y = g.y - sy
        if (x + g.width < 0 || x > w) continue
        if (y + g.height < 0 || y > h - HEADER_H) continue
        drawGhostBar(ctx, g, x, y)
      }
    }

    // Activity bars first (so pairing bars paint on top on overlap).
    for (const ab of layout.activityBars) {
      const x = ab.x - sx
      const y = ab.y - sy
      if (x + ab.width < 0 || x > w) continue
      if (y + ab.height < 0 || y > h - HEADER_H) continue
      drawActivityBar(ctx, ab, x, y, ab.activityId === selectedActivityId, ab.activityId === hoveredActivityId)
    }

    // Pairing bars
    for (const b of layout.bars) {
      const x = b.x - sx
      const y = b.y - sy
      if (x + b.width < 0 || x > w) continue
      if (y + b.height < 0 || y > h - HEADER_H) continue
      drawBar(
        ctx,
        b,
        x,
        y,
        accentColor,
        b.assignmentId === selectedAssignmentId,
        b.assignmentId === hoveredAssignmentId,
      )
    }

    // Drag drop-target row tint (AIMS §5.3 / P2.5). Green / orange / red
    // depending on legality. Drawn behind the range-selection so a range
    // that spans the drag target still shows through.
    if (dragState && dragState.dropCrewId) {
      const row = layout.rows.find((r) => r.crewId === dragState.dropCrewId)
      if (row) {
        const tint =
          dragState.dropLegality === 'violation'
            ? 'rgba(230,53,53,0.18)'
            : dragState.dropLegality === 'warning'
              ? 'rgba(255,136,0,0.18)'
              : 'rgba(6,194,112,0.18)'
        const stroke =
          dragState.dropLegality === 'violation'
            ? '#E63535'
            : dragState.dropLegality === 'warning'
              ? '#FF8800'
              : '#06C270'
        const rowY = row.y - sy
        ctx.fillStyle = tint
        ctx.fillRect(0, rowY, w, row.height)
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1.5
        ctx.strokeRect(0.75, rowY + 0.75, w - 1.5, row.height - 1.5)
      }
    }

    // Range-selection highlight (AIMS §4.6 block). Drawn after bars so
    // the tint is visible on top of duties without obscuring them.
    if (rangeSelection && rangeSelection.crewIds.length > 0) {
      const fromMs = new Date(rangeSelection.fromIso + 'T00:00:00Z').getTime()
      const toMs = new Date(rangeSelection.toIso + 'T00:00:00Z').getTime() + 86_400_000
      const x0 = ((fromMs - layout.periodStartMs) / 3_600_000) * layout.pph - sx
      const x1 = ((toMs - layout.periodStartMs) / 3_600_000) * layout.pph - sx
      const idxSet = new Set(rangeSelection.crewIds)
      ctx.fillStyle = hexToRgba(accentColor, 0.12)
      for (const row of layout.rows) {
        if (!idxSet.has(row.crewId)) continue
        ctx.fillRect(x0, row.y - sy, x1 - x0, row.height)
      }
      // Single outline around the contiguous block. Compute min/max y.
      const sorted = layout.rows.filter((r) => idxSet.has(r.crewId))
      if (sorted.length > 0) {
        const topY = sorted[0].y - sy
        const bottom = sorted[sorted.length - 1]
        const botY = bottom.y + bottom.height - sy
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 1.5
        ctx.strokeRect(x0 + 0.75, topY + 0.75, x1 - x0 - 1.5, botY - topY - 1.5)
      }
    }

    // Double-click cell selection border. Painted above range + temp-base
    // so the user's freshest pick reads clearly; color tracks the global
    // accent color (operator branding / user override).
    if (selectedCrewId && selectedDateIso) {
      const row = layout.rows.find((r) => r.crewId === selectedCrewId)
      if (row) {
        const dayMs = new Date(selectedDateIso + 'T00:00:00Z').getTime()
        const dayIdx = Math.round((dayMs - layout.periodStartMs) / 86_400_000)
        if (dayIdx >= 0 && dayIdx < layout.periodDays) {
          const x0 = dayIdx * 24 * layout.pph - sx
          const x1 = (dayIdx + 1) * 24 * layout.pph - sx
          const y = row.y - sy
          // 'assign' mode = red (armed for assign/replace). Default = accent.
          const isAssignMode = cellSelectMode === 'assign'
          const strokeColor = isAssignMode ? '#E63535' : accentColor
          const fillRgba = isAssignMode ? 'rgba(230,53,53,0.10)' : hexToRgba(accentColor, 0.08)
          ctx.save()
          ctx.fillStyle = fillRgba
          ctx.fillRect(x0, y, x1 - x0, row.height)
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 1.5
          ctx.strokeRect(x0 + 0.75, y + 0.75, x1 - x0 - 1.5, row.height - 1.5)
          ctx.restore()
        }
      }
    }

    // Now-line
    drawNowLine(ctx, layout, sx, h - HEADER_H)

    ctx.restore()
  }, [
    layout,
    isDark,
    accentColor,
    selectedAssignmentId,
    selectedActivityId,
    selectedCrewId,
    selectedDateIso,
    cellSelectMode,
    hoveredAssignmentId,
    hoveredActivityId,
    rangeSelection,
    dragState,
    tempBases,
  ])

  useEffect(() => {
    draw()
  }, [draw])

  // Redraw on scroll — coalesce to one store update + one paint per frame.
  // Without throttling, 60+ scroll events per second each push a zustand
  // update, which cascades to re-rendering every subscriber (left panel,
  // right panel, etc). With 8000+ crew rows that's the dominant jank source.
  const scrollRafRef = useRef(0)
  const onScroll = useCallback(() => {
    if (scrollRafRef.current) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0
      const s = scrollRef.current
      if (!s) return
      setScroll(s.scrollLeft, s.scrollTop)
      draw()
    })
  }, [draw, setScroll])

  /** Convert a pointer event's client coords into `(x, y)` inside the
   *  scrollable content (above the time header, already in layout space). */
  const pointerToContent = useCallback((e: ReactMouseEvent) => {
    const s = scrollRef.current
    const container = containerRef.current
    if (!s || !container) return null
    const rect = container.getBoundingClientRect()
    const rawX = e.clientX - rect.left + s.scrollLeft
    const rawY = e.clientY - rect.top + s.scrollTop
    return { rawX, rawY, x: rawX, y: rawY - HEADER_H }
  }, [])

  /** Resolve the crew row + day-index + dateIso at a content coordinate. */
  const resolveCellAt = useCallback(
    (x: number, y: number): { crewId: string; dateIso: string } | null => {
      const row = hitTestRow(layout.rows, y)
      if (!row) return null
      const dayIdx = Math.max(0, Math.min(layout.periodDays - 1, Math.floor(x / (layout.pph * 24))))
      const dayMs = layout.periodStartMs + dayIdx * 86_400_000
      return { crewId: row.crewId, dateIso: new Date(dayMs).toISOString().slice(0, 10) }
    },
    [layout],
  )

  // ── Shift-drag range select (AIMS §4.6) + plain-drag on bars (§5.3) ──
  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (e.button !== 0) return
      const p = pointerToContent(e)
      if (!p) return
      if (p.y < 0) return // ignore clicks in the time header

      // Priority 1: Shift-drag = range select.
      if (e.shiftKey) {
        if (hitTestBar(layout.bars, p.x, p.y)) return
        if (hitTestActivityBar(layout.activityBars, p.x, p.y)) return
        const cell = resolveCellAt(p.x, p.y)
        if (!cell) return
        e.preventDefault()
        const anchorRowIdx = layout.rows.findIndex((r) => r.crewId === cell.crewId)
        dragSelectRef.current = {
          anchorDateIso: cell.dateIso,
          anchorCrewId: cell.crewId,
          anchorRowIdx: anchorRowIdx < 0 ? 0 : anchorRowIdx,
          active: true,
        }
        setRangeSelection({ crewIds: [cell.crewId], fromIso: cell.dateIso, toIso: cell.dateIso })
        return
      }

      // Priority 2: plain mousedown on a pairing bar → pending drag. The
      // drag doesn't actually start until the cursor moves beyond the
      // threshold, so a bar click still works normally.
      const pairingHit = hitTestBar(layout.bars, p.x, p.y)
      if (pairingHit) {
        pendingBarDragRef.current = {
          assignmentId: pairingHit.assignmentId,
          pairingId: pairingHit.pairingId,
          crewId: pairingHit.crewId,
          label: pairingHit.label,
          startX: e.clientX,
          startY: e.clientY,
        }
      }
    },
    [layout, pointerToContent, resolveCellAt, setRangeSelection],
  )

  const onMouseUp = useCallback(
    (e: ReactMouseEvent) => {
      // ── Bar drag drop (if active) ──
      const drag = useCrewScheduleStore.getState().dragState
      if (drag) {
        // Assign-from-uncrewed drops are owned by the tray's window-level
        // handler (runs in capture phase before this). If that already
        // cleared the drag state, `drag` would be null; reaching here with
        // assign-uncrewed mode means the tray hasn't handled it yet — bail
        // so we don't corrupt state by treating it as move/copy.
        if (drag.mode === 'assign-uncrewed') return
        const mode = drag.mode
        const level = drag.dropLegality
        const targetCrewId = drag.dropCrewId
        const sourceAssignmentId: string | null = drag.sourceAssignmentId
        const sourceCrewId: string | null = drag.sourceCrewId
        if (sourceAssignmentId === null || sourceCrewId === null) return
        // Suppress the click that browsers fire after mouseup.
        justFinishedDragRef.current = true
        setTimeout(() => {
          justFinishedDragRef.current = false
        }, 0)
        pendingBarDragRef.current = null
        if (dragRafRef.current) {
          cancelAnimationFrame(dragRafRef.current)
          dragRafRef.current = 0
        }
        pendingDragUpdateRef.current = null
        legalityCacheRef.current.clear()
        clearDragState()

        if (!targetCrewId) return
        // Hard block only. FDTL violations are overridable — let them through
        // to the optimistic update + API, which records an override audit
        // row. Drag-ghost already showed the Legality Check inline.
        if (level === 'violation' && !drag.dropOverridable) {
          useCrewScheduleStore
            .getState()
            .setDropRejection(drag.dropReason ? `Drop rejected — ${drag.dropReason}` : 'Drop rejected')
          return
        }
        if (mode === 'move' && targetCrewId === sourceCrewId) return

        // Hard-block check — AC type qualification (un-overridable). The
        // planner already saw these inline via the drag-time Legality
        // Check panel, so we just abort silently instead of popping a
        // dialog (user preference: no button clicks required during
        // drag-drop).
        {
          const s = useCrewScheduleStore.getState()
          const targetCrew = s.crew.find((c) => c._id === targetCrewId)
          const pairing = s.pairings.find((p) => p._id === drag.pairingId)
          if (targetCrew && pairing) {
            const { hardBlocks } = partitionViolations(
              checkAssignmentViolations({
                crew: targetCrew,
                pairing,
                aircraftTypes: s.aircraftTypes,
                tempBases: s.tempBases.filter((t) => t.crewId === targetCrewId),
                assignments: s.assignments,
                activities: s.activities,
                activityCodes: s.activityCodes,
                pairings: s.pairings,
                ruleSet: s.ruleSet,
              }),
            )
            if (hardBlocks.length > 0) {
              useCrewScheduleStore
                .getState()
                .setDropRejection(`Drop rejected — ${hardBlocks[0].message || hardBlocks[0].title}`)
              return
            }
          }
        }

        // Optimistic update — bar jumps immediately so the drop feels
        // instant. Server response + commitPeriod() reconcile the local
        // state with authoritative data in the background. On failure we
        // still re-fetch so the bar snaps back to truth.
        const storeApi = useCrewScheduleStore.getState()
        const srcAssignment = storeApi.assignments.find((a) => a._id === sourceAssignmentId)
        let optimisticCopyId: string | null = null
        let optimisticSeatIndex = 0
        if (mode === 'move') {
          storeApi.applyOptimisticReassign({
            kind: 'move',
            assignmentId: sourceAssignmentId,
            targetCrewId,
          })
        } else if (srcAssignment) {
          const pairingAssignments = storeApi.assignments.filter(
            (a) =>
              a.pairingId === drag.pairingId &&
              a.seatPositionId === srcAssignment.seatPositionId &&
              a.status !== 'cancelled',
          )
          const usedIndices = new Set(pairingAssignments.map((a) => a.seatIndex))
          while (usedIndices.has(optimisticSeatIndex)) optimisticSeatIndex += 1
          optimisticCopyId = `__optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          storeApi.applyOptimisticReassign({
            kind: 'copy',
            synthetic: {
              ...srcAssignment,
              _id: optimisticCopyId,
              crewId: targetCrewId,
              seatIndex: optimisticSeatIndex,
            },
          })
        }

        void (async () => {
          try {
            if (mode === 'copy') {
              if (!srcAssignment) return
              await api.createCrewAssignment({
                pairingId: drag.pairingId,
                crewId: targetCrewId,
                seatPositionId: srcAssignment.seatPositionId,
                seatIndex: optimisticSeatIndex,
                status: 'planned',
              })
            } else {
              await api.patchCrewAssignment(sourceAssignmentId, { crewId: targetCrewId })
            }
            // Silent reconcile — optimistic state already painted the
            // new bar. Avoid commitPeriod() here so the runway loading
            // overlay doesn't flash on successful drops.
            void useCrewScheduleStore.getState().reconcilePeriod()
          } catch (err) {
            // Capacity-exceeded: structured payload from the server drives
            // a friendly dialog instead of surfacing the raw API message.
            const apiErr = err as ApiError
            const payload = apiErr?.payload as
              | {
                  code?: string
                  seatCode?: string
                  capacity?: number
                  attemptedIndex?: number
                  pairingCode?: string | null
                }
              | null
              | undefined
            if (
              payload &&
              payload.code === 'capacity_exceeded' &&
              typeof payload.seatCode === 'string' &&
              typeof payload.capacity === 'number' &&
              typeof payload.attemptedIndex === 'number'
            ) {
              useCrewScheduleStore.getState().setCapacityError({
                seatCode: payload.seatCode,
                capacity: payload.capacity,
                attemptedIndex: payload.attemptedIndex,
                pairingCode: payload.pairingCode ?? null,
              })
              // Revert the optimistic update silently — the capacity
              // dialog is already open, no need for a full-screen spinner.
              void useCrewScheduleStore.getState().reconcilePeriod()
              return
            }
            console.error('Drag-drop failed:', err)
            void useCrewScheduleStore.getState().reconcilePeriod()
          }
        })()
        return
      }

      // ── Shift-drag range-select end ──
      if (dragSelectRef.current?.active) {
        dragSelectRef.current = null
        justFinishedDragRef.current = true
        setTimeout(() => {
          justFinishedDragRef.current = false
        }, 0)
      }

      // Mousedown-without-drag → clear pending state so the click can select.
      pendingBarDragRef.current = null
      void e
    },
    [clearDragState],
  )

  // Hit-test on hover — pairing bars win over activity bars on overlap
  // because pairings paint on top. Handles three live drag modes:
  //   1. range-select (shift-drag empty cells)
  //   2. bar drag (plain drag from a pairing bar)
  //   3. plain hover (no drag)
  const onMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      const p = pointerToContent(e)
      const container = containerRef.current
      if (!p || !container) return

      // Drag-select in progress: extend the range across both dates and
      // rows. Anchor + current row indices define the vertical span; any
      // crew in that span is included in `crewIds`.
      if (dragSelectRef.current?.active) {
        const cell = resolveCellAt(p.x, p.y)
        if (!cell) return
        const anchor = dragSelectRef.current.anchorDateIso
        const from = anchor < cell.dateIso ? anchor : cell.dateIso
        const to = anchor < cell.dateIso ? cell.dateIso : anchor
        const currentRowIdx = layout.rows.findIndex((r) => r.crewId === cell.crewId)
        const anchorIdx = dragSelectRef.current.anchorRowIdx
        const a = Math.min(anchorIdx, currentRowIdx < 0 ? anchorIdx : currentRowIdx)
        const b = Math.max(anchorIdx, currentRowIdx < 0 ? anchorIdx : currentRowIdx)
        const crewIds = layout.rows.slice(a, b + 1).map((r) => r.crewId)
        setRangeSelection({ crewIds, fromIso: from, toIso: to })
        container.style.cursor = 'crosshair'
        return
      }

      // Bar drag — if pending, check if we've crossed the threshold.
      const pending = pendingBarDragRef.current
      const currentDrag = useCrewScheduleStore.getState().dragState
      if (pending && !currentDrag) {
        const dx = e.clientX - pending.startX
        const dy = e.clientY - pending.startY
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
        // Start the drag.
        setDragState({
          sourceAssignmentId: pending.assignmentId,
          sourceCrewId: pending.crewId,
          pairingId: pending.pairingId,
          ghostLabel: pending.label,
          cursorX: e.clientX,
          cursorY: e.clientY,
          dropCrewId: null,
          dropLegality: null,
          dropReason: '',
          mode: e.ctrlKey || e.metaKey ? 'copy' : 'move',
        })
      }

      // Bar drag — active: resolve drop target + legality.
      // rAF-coalesced: 120–500 Hz mice collapse to one store write per
      // frame, and cursor-only moves (same row+mode) skip the store
      // write entirely so the canvas doesn't repaint.
      if (useCrewScheduleStore.getState().dragState) {
        const row = hitTestRow(layout.rows, p.y)
        pendingDragUpdateRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          row,
          ctrlOrMeta: e.ctrlKey || e.metaKey,
        }
        if (dragRafRef.current) return
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = 0
          const pending = pendingDragUpdateRef.current
          pendingDragUpdateRef.current = null
          if (!pending) return
          const s = useCrewScheduleStore.getState()
          const dragging = s.dragState
          if (!dragging) return
          // Assign-from-uncrewed drags are owned by the tray's window handler.
          // Canvas mousemove must not touch them — its move/copy legality
          // calc assumes a source assignment exists, which isn't true here.
          if (dragging.mode === 'assign-uncrewed') return
          const mode: 'move' | 'copy' = pending.ctrlOrMeta ? 'copy' : 'move'
          if (!pending.row) {
            setDragState({
              ...dragging,
              cursorX: pending.clientX,
              cursorY: pending.clientY,
              dropCrewId: null,
              dropLegality: null,
              dropReason: 'Release over a crew row',
              mode,
            })
            container.style.cursor = 'not-allowed'
            return
          }
          const src = s.assignments.find((a) => a._id === dragging.sourceAssignmentId)
          const pairing = s.pairings.find((pp) => pp._id === dragging.pairingId)
          const targetCrew = s.crew.find((c) => c._id === pending.row!.crewId)
          if (!src || !pairing || !targetCrew) return
          // Memoize by (targetCrewId, mode). Same row = same legality as
          // long as the underlying assignments haven't changed, which they
          // don't during a drag (drag is read-only until drop).
          const cacheKey = `${pending.row.crewId}|${mode}`
          let legality = legalityCacheRef.current.get(cacheKey)
          if (!legality) {
            const positionsById = new Map(s.positions.map((pp) => [pp._id, pp]))
            const pairingsById = new Map(s.pairings.map((pp) => [pp._id, pp]))
            const full = computeDropLegality({
              targetCrew,
              pairing,
              seatPositionId: src.seatPositionId,
              mode,
              sourceCrewId: dragging.sourceCrewId ?? '',
              positionsById,
              assignments: s.assignments,
              pairingsById,
              activities: s.activities,
              activityCodes: s.activityCodes,
              ruleSet: s.ruleSet,
            })
            legality = { level: full.level, reason: full.reason, checks: full.checks, overridable: full.overridable }
            legalityCacheRef.current.set(cacheKey, legality)
          }
          setDragState({
            ...dragging,
            cursorX: pending.clientX,
            cursorY: pending.clientY,
            dropCrewId: pending.row.crewId,
            dropLegality: legality.level,
            dropReason: legality.reason,
            dropChecks: legality.checks,
            dropOverridable: legality.overridable ?? false,
            mode,
          })
          container.style.cursor =
            legality.level === 'violation' ? 'not-allowed' : mode === 'copy' ? 'copy' : 'grabbing'
        })
        return
      }

      const pairingHit = hitTestBar(layout.bars, p.x, p.y)
      if (pairingHit) {
        setHover(pairingHit.assignmentId)
        setActivityHover(null)
        setActivityHoverPos(null)
        setPairingHoverPos({ x: e.clientX, y: e.clientY })
        container.style.cursor = 'grab'
        return
      }
      const activityHit = hitTestActivityBar(layout.activityBars, p.x, p.y)
      if (activityHit) {
        setHover(null)
        setActivityHover(activityHit.activityId)
        setActivityHoverPos({ x: e.clientX, y: e.clientY })
        setPairingHoverPos(null)
        container.style.cursor = 'pointer'
        return
      }
      setHover(null)
      setActivityHover(null)
      setActivityHoverPos(null)
      setPairingHoverPos(null)
      container.style.cursor = e.shiftKey ? 'crosshair' : 'default'
    },
    [layout, pointerToContent, resolveCellAt, setHover, setActivityHover, setRangeSelection, setDragState],
  )

  const onClick = useCallback(
    (e: ReactMouseEvent) => {
      // A click that's really the tail of a shift-drag — don't clear the
      // range the user just drew.
      if (justFinishedDragRef.current) return
      const s = useCrewScheduleStore.getState()

      // Target-picker modes (copy-pairing, copy-block, move-block, swap-block).
      // Resolve the clicked row and dispatch the mode handler. All four modes
      // ignore clicks outside a crew row and clicks on the source crew itself.
      if (s.targetPickerMode) {
        const p = pointerToContent(e)
        if (!p || p.y < 0) return
        const row = hitTestRow(layout.rows, p.y)
        if (!row) return
        dispatchTargetPicker(row.crewId)
        return
      }

      // Swap-picker mode: the next bar-click fills `targetAssignmentId`
      // on the swap state, which opens the confirm dialog.
      if (s.swapPicker && !s.swapPicker.targetAssignmentId && s.hoveredAssignmentId) {
        if (s.hoveredAssignmentId === s.swapPicker.sourceAssignmentId) return // clicked source again = no-op
        s.setSwapPicker({ ...s.swapPicker, targetAssignmentId: s.hoveredAssignmentId })
        return
      }
      // Swap-picker active but clicked empty: cancel the swap mode.
      if (s.swapPicker && !s.swapPicker.targetAssignmentId && !s.hoveredAssignmentId && !s.hoveredActivityId) {
        s.clearSwapPicker()
        return
      }

      if (s.hoveredAssignmentId) {
        const bar = layout.bars.find((b) => b.assignmentId === s.hoveredAssignmentId)
        if (!bar) return
        selectAssignment(bar.assignmentId)
        selectPairing(bar.pairingId)
        selectCrew(bar.crewId)
        selectActivity(null)
        clearRangeSelection()
        // Single-click on a pairing bar = Duty inspector. Assign tab is
        // reserved for double-click (armed Replace mode).
        s.setInspectorTab('duty')
        return
      }
      if (s.hoveredActivityId) {
        const ab = layout.activityBars.find((b) => b.activityId === s.hoveredActivityId)
        if (!ab) return
        selectActivity(ab.activityId)
        selectCrew(ab.crewId)
        selectAssignment(null)
        selectPairing(null)
        clearRangeSelection()
        return
      }
      // Click landed on empty canvas — clear any active range, and mark
      // the clicked cell in 'view' mode so user sees the accent border.
      clearRangeSelection()
      const p = pointerToContent(e)
      if (!p || p.y < 0) return
      const row = hitTestRow(layout.rows, p.y)
      if (!row) return
      const dayIdx = Math.floor(p.x / (layout.pph * 24))
      if (dayIdx < 0 || dayIdx >= layout.periodDays) return
      const dayMs = layout.periodStartMs + dayIdx * 86_400_000
      const dateIso = new Date(dayMs).toISOString().slice(0, 10)
      selectDateCell(row.crewId, dateIso, 'view')
    },
    [
      layout,
      selectAssignment,
      selectPairing,
      selectActivity,
      selectCrew,
      selectDateCell,
      clearRangeSelection,
      pointerToContent,
    ],
  )

  // Right-click → target-dispatched context menu. The menu rendered in
  // the shell branches on `menu.kind`. Kinds handled here:
  //   - pairing bar (§4.2)
  //   - activity bar (custom)
  //   - date-header (§4.4 — top HEADER_H strip)
  //   - empty cell (§4.3 — fell through all other hit tests)
  // Crew-name (§4.5) lives on the left panel (owned by left-panel.tsx).
  const onContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      // If a bar drag is in progress, right-click cancels the drag and
      // swallows the event — no context menu appears.
      const store = useCrewScheduleStore.getState()
      if (store.dragState) {
        e.preventDefault()
        pendingBarDragRef.current = null
        clearDragState()
        return
      }

      const s = scrollRef.current
      const container = containerRef.current
      if (!s || !container) return
      const rect = container.getBoundingClientRect()
      const rawX = e.clientX - rect.left + s.scrollLeft
      const rawY = e.clientY - rect.top + s.scrollTop
      // Viewport-relative Y — the date-header strip is painted fixed at
      // the top of the canvas (it does NOT scroll with content), so we
      // must test against viewport coords, not scrolled content coords.
      const viewportY = e.clientY - rect.top

      // Date-header strip sits above the main content. Hit-test first so
      // crew rows below can never swallow a right-click on the header.
      if (viewportY < HEADER_H) {
        const dayIdx = Math.floor(rawX / (layout.pph * 24))
        if (dayIdx < 0 || dayIdx >= layout.periodDays) return
        const dayMs = layout.periodStartMs + dayIdx * 86_400_000
        const dateIso = new Date(dayMs).toISOString().slice(0, 10)
        e.preventDefault()
        openContextMenu({ kind: 'date-header', dateIso, pageX: e.clientX, pageY: e.clientY })
        return
      }

      const x = rawX
      const y = rawY - HEADER_H

      const pairingHit = hitTestBar(layout.bars, x, y)
      if (pairingHit) {
        e.preventDefault()
        selectAssignment(pairingHit.assignmentId)
        selectPairing(pairingHit.pairingId)
        selectCrew(pairingHit.crewId)
        selectActivity(null)
        openContextMenu({
          kind: 'pairing',
          targetId: pairingHit.assignmentId,
          crewId: pairingHit.crewId,
          pageX: e.clientX,
          pageY: e.clientY,
        })
        return
      }
      const activityHit = hitTestActivityBar(layout.activityBars, x, y)
      if (activityHit) {
        e.preventDefault()
        selectActivity(activityHit.activityId)
        selectCrew(activityHit.crewId)
        selectAssignment(null)
        selectPairing(null)
        openContextMenu({
          kind: 'activity',
          targetId: activityHit.activityId,
          crewId: activityHit.crewId,
          pageX: e.clientX,
          pageY: e.clientY,
        })
        return
      }

      // Empty cell on a crew row (§4.3).
      const row = hitTestRow(layout.rows, y)
      if (!row) return
      const dayIdx = Math.floor(x / (layout.pph * 24))
      if (dayIdx < 0 || dayIdx >= layout.periodDays) return
      const dayMs = layout.periodStartMs + dayIdx * 86_400_000
      const dateIso = new Date(dayMs).toISOString().slice(0, 10)

      // Temp-base band hit — one item "Modify Temp Assignment…".
      const tb = useCrewScheduleStore
        .getState()
        .tempBases.find((t) => t.crewId === row.crewId && t.fromIso <= dateIso && t.toIso >= dateIso)
      if (tb) {
        e.preventDefault()
        openContextMenu({
          kind: 'temp-base',
          tempBaseId: tb._id,
          crewId: row.crewId,
          dateIso,
          pageX: e.clientX,
          pageY: e.clientY,
        })
        return
      }

      // Is this empty cell inside an active range selection? If so,
      // open the block menu (§4.6) — keeps the range visible.
      const range = useCrewScheduleStore.getState().rangeSelection
      if (range && range.crewIds.includes(row.crewId) && dateIso >= range.fromIso && dateIso <= range.toIso) {
        e.preventDefault()
        openContextMenu({
          kind: 'block',
          crewIds: range.crewIds,
          fromIso: range.fromIso,
          toIso: range.toIso,
          pageX: e.clientX,
          pageY: e.clientY,
        })
        return
      }

      e.preventDefault()
      openContextMenu({
        kind: 'empty-cell',
        crewId: row.crewId,
        dateIso,
        pageX: e.clientX,
        pageY: e.clientY,
      })
    },
    [layout, openContextMenu, selectAssignment, selectPairing, selectActivity, selectCrew, clearDragState],
  )

  // Double-click an empty cell → open activity picker for that crew+date.
  // Matches V1 3.1.7 behaviour. Single-click falls through to `onClick`
  // which inspects a bar (if any) — the two handlers are complementary.
  const onDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      const s = scrollRef.current
      const container = containerRef.current
      if (!s || !container) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + s.scrollLeft
      const y = e.clientY - rect.top + s.scrollTop - HEADER_H

      // Pairing bar double-click → open Assign tab (replace-mode). Single-
      // click keeps Duty tab so planners can inspect without accidentally
      // opening the activity picker.
      const barHit = hitTestBar(layout.bars, x, y)
      if (barHit) {
        const store = useCrewScheduleStore.getState()
        const assign = store.assignments.find((a) => a._id === barHit.assignmentId)
        if (!assign) return
        const dateIso = new Date(assign.startUtcIso).toISOString().slice(0, 10)
        store.selectDateCell(barHit.crewId, dateIso, 'assign')
        store.setRightPanelOpen(true)
        store.setInspectorTab('assign')
        return
      }

      // Activity bar double-click: arm replace-mode on the Assign tab so
      // the next picked code swaps in place (delete + create).
      const activityHit = hitTestActivityBar(layout.activityBars, x, y)
      if (activityHit) {
        const store = useCrewScheduleStore.getState()
        const act = store.activities.find((a) => a._id === activityHit.activityId)
        const dateIso = act?.dateIso ?? (act ? new Date(act.startUtcIso).toISOString().slice(0, 10) : null)
        if (!dateIso) return
        store.startReplaceActivity({
          activityId: activityHit.activityId,
          crewId: activityHit.crewId,
          dateIso,
        })
        store.setRightPanelOpen(true)
        store.setInspectorTab('assign')
        return
      }

      const row = hitTestRow(layout.rows, y)
      if (!row) return

      const dayIdx = Math.floor(x / (layout.pph * 24))
      if (dayIdx < 0 || dayIdx >= layout.periodDays) return
      const dayMs = layout.periodStartMs + dayIdx * 86_400_000
      const dateIso = new Date(dayMs).toISOString().slice(0, 10)
      selectDateCell(row.crewId, dateIso, 'assign')
      useCrewScheduleStore.getState().setRightPanelOpen(true)
      useCrewScheduleStore.getState().setInspectorTab('assign')
    },
    [layout, selectDateCell],
  )

  return (
    <div ref={containerRef} className="relative h-full min-h-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        data-crew-canvas
        className="pointer-events-none absolute inset-0"
        onMouseMove={onMouseMove}
        onClick={onClick}
      />
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto"
        onScroll={onScroll}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        onMouseLeave={() => {
          setHover(null)
          setActivityHover(null)
          setActivityHoverPos(null)
          setPairingHoverPos(null)
        }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <div style={{ width: layout.totalWidth, height: layout.totalHeight + HEADER_H }} />
      </div>

      {/* Ghost bar + legality tooltip that follows the cursor while the
          user is dragging a pairing. Rendered outside the scroll div so
          scroll-wheel events while dragging still reach the canvas. */}
      <DragGhost />
      <CapacityErrorDialog />
      {hoveredActivityId &&
        activityHoverPos &&
        (() => {
          const act = activities.find((a) => a._id === hoveredActivityId)
          if (!act) return null
          const code = activityCodes.find((c) => c._id === act.activityCodeId) ?? null
          return (
            <ActivityHoverTooltip
              activity={act}
              code={code}
              clientX={activityHoverPos.x}
              clientY={activityHoverPos.y}
            />
          )
        })()}
      {hoveredAssignmentId &&
        pairingHoverPos &&
        !dragState &&
        (() => {
          const store = useCrewScheduleStore.getState()
          const assign = store.assignments.find((a) => a._id === hoveredAssignmentId)
          if (!assign) return null
          const pairing = store.pairings.find((p) => p._id === assign.pairingId)
          if (!pairing) return null
          return (
            <PairingHoverTooltip
              pairing={pairing}
              positions={store.positions}
              assignments={store.assignments}
              assignment={assign}
              clientX={pairingHoverPos.x}
              clientY={pairingHoverPos.y}
            />
          )
        })()}
    </div>
  )
}

/** Friendly dialog for Ctrl-drag Copy that hits a full seat. Replaces
 *  the previous raw `API 400: Seat index X exceeds capacity Y` toast
 *  with a clear statement of the constraint. */
function CapacityErrorDialog() {
  const err = useCrewScheduleStore((s) => s.capacityError)
  const clearCapacityError = useCrewScheduleStore((s) => s.clearCapacityError)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  useEffect(() => {
    if (!err) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        clearCapacityError()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [err, clearCapacityError])
  if (!err) return null
  const used = err.capacity // seat is full → used = capacity
  const pairingLabel = err.pairingCode ? ` on pairing ${err.pairingCode}` : ''
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={clearCapacityError}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl overflow-hidden w-[420px] max-w-[92vw]"
        style={{
          background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,1)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(96,97,112,0.18)',
        }}
      >
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-[15px] font-semibold" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
            Exceeds crew complement
          </h3>
        </div>
        <div className="px-5 pb-4">
          <p className="text-[13px] leading-[1.5]" style={{ color: isDark ? '#A7A9B5' : '#4A4C5A' }}>
            The <strong>{err.seatCode}</strong> seat{pairingLabel} is already filled ({used}/{err.capacity}). Copy
            cancelled.
          </p>
        </div>
        <div
          className="px-5 py-3 flex justify-end"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <button
            autoFocus
            onClick={clearCapacityError}
            className="h-8 px-4 rounded-lg text-[13px] font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
            style={{ backgroundColor: 'var(--module-accent, #3E7BFA)' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

/** Floating overlay rendered in a portal-like pattern within the canvas
 *  container. Shows a semi-transparent copy of the bar plus the drop
 *  legality reason. Position is client-space so we don't have to worry
 *  about the scroll offset. */
function DragGhost() {
  const dragState = useCrewScheduleStore((s) => s.dragState)
  const accentColor = useMemo(() => {
    if (typeof document === 'undefined') return '#3E7BFA'
    return getComputedStyle(document.documentElement).getPropertyValue('--module-accent').trim() || '#3E7BFA'
  }, [])
  if (!dragState || typeof document === 'undefined') return null
  const badgeColor =
    dragState.dropLegality === 'violation' ? '#E63535' : dragState.dropLegality === 'warning' ? '#FF8800' : '#06C270'
  const checks = dragState.dropChecks ?? []
  const hasChecks = checks.length > 0
  // Portal to <body> so `position: fixed` is always anchored to the
  // viewport. An ancestor with `transform/filter/perspective` would
  // otherwise become the containing block for fixed descendants and
  // push the ghost away from the cursor.
  return createPortal(
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left: dragState.cursorX,
        top: dragState.cursorY,
        // Nudge just below-right of the tip of the cursor (macOS/Win
        // cursor hotspot is top-left). 10 keeps the badge tight without
        // sitting *on* the cursor.
        transform: 'translate(10px, 10px)',
        zIndex: 10000,
      }}
    >
      <div
        className="rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
        style={{ backgroundColor: accentColor, opacity: 0.85 }}
      >
        {dragState.mode === 'copy' ? '+ ' : ''}
        {dragState.ghostLabel}
      </div>
      {dragState.dropCrewId && hasChecks && (
        <div
          className="mt-1 min-w-[240px] max-w-[320px] rounded-lg overflow-hidden shadow-xl"
          style={{
            background: 'rgba(25,25,33,0.96)',
            border: `1px solid ${badgeColor}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
            style={{ background: badgeColor }}
          >
            Legality Check
          </div>
          <div className="px-2.5 py-1.5 space-y-1">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-white/90 truncate">{c.label}</span>
                <span
                  className="tabular-nums font-semibold shrink-0"
                  style={{ color: c.status === 'violation' ? '#FF6B6B' : '#FFB347' }}
                >
                  {c.actual} / {c.limit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {dragState.dropCrewId && !hasChecks && (
        <div
          className="mt-1 inline-block px-2 py-0.5 rounded text-[11px] font-medium text-white shadow"
          style={{ backgroundColor: badgeColor }}
        >
          {dragState.mode === 'copy' ? 'Copy' : 'Move'} · {dragState.dropReason}
        </div>
      )}
    </div>,
    document.body,
  )
}

function drawHeader(ctx: CanvasRenderingContext2D, layout: CrewScheduleLayout, sx: number, w: number, isDark: boolean) {
  ctx.fillStyle = isDark ? '#191921' : '#FFFFFF'
  ctx.fillRect(0, 0, w, HEADER_H)
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : '#E4E4EB'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, HEADER_H)
  ctx.lineTo(w, HEADER_H)
  ctx.stroke()

  ctx.font = '600 11px Inter, system-ui, sans-serif'
  ctx.fillStyle = isDark ? '#A7A9B5' : '#6B6C7B'
  ctx.textBaseline = 'middle'

  const days = layout.periodDays
  const dayW = layout.pph * 24
  for (let i = 0; i < days; i += 1) {
    const x = i * dayW - sx
    if (x + dayW < 0 || x > w) continue
    const dayMs = layout.periodStartMs + i * 86_400_000
    const d = new Date(dayMs)
    const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getUTCDay()]
    const label = `${dow} ${String(d.getUTCDate()).padStart(2, '0')}`
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
    if (isWeekend) {
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
      ctx.fillRect(x, 0, dayW, HEADER_H)
      ctx.fillStyle = isDark ? '#A7A9B5' : '#6B6C7B'
    }
    ctx.fillText(label, x + 8, HEADER_H / 2)
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: CrewScheduleLayout,
  visX0: number,
  visX1: number,
  sy: number,
  h: number,
  isDark: boolean,
) {
  const days = layout.periodDays
  const dayW = layout.pph * 24
  for (let i = 0; i < days; i += 1) {
    const x = i * dayW - visX0
    if (x + dayW < 0 || x > visX1 - visX0) continue
    const dayMs = layout.periodStartMs + i * 86_400_000
    const d = new Date(dayMs)
    const jsDay = d.getUTCDay()
    if (jsDay === 0 || jsDay === 6) {
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
      ctx.fillRect(x, 0, dayW, h)
    }
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  bar: AssignmentBarLayout,
  x: number,
  y: number,
  accentColor: string,
  isSelected: boolean,
  isHovered: boolean,
) {
  // Match the uncrewed tray pill shape so assigned and
  // uncrewed bars read as the same visual element.
  const r = 3
  // Fill — colour-coded by the pairing's aircraft type (falls back to
  // accent when the pairing is unassigned-type or AC type is unknown).
  // Saturation knocked down to 70% so the palette reads calmer against
  // dense rosters without losing hue identity between AC types.
  let fill = bar.color ? desaturateHex(bar.color, 0.7) : accentColor
  if (bar.status === 'cancelled') fill = '#9A9BA8'
  ctx.fillStyle = fill
  drawRoundedRect(ctx, x, y, bar.width, bar.height, r)
  ctx.fill()

  // Deadhead stripe overlay
  if (bar.hasDeadhead) {
    ctx.save()
    drawRoundedRect(ctx, x, y, bar.width, bar.height, r)
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 6
    for (let i = -bar.height; i < bar.width; i += 12) {
      ctx.beginPath()
      ctx.moveTo(x + i, y + bar.height)
      ctx.lineTo(x + i + bar.height, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(x + 1, y + 1, bar.width - 2, bar.height * 0.35)

  // Only real violations get a red border. Warnings are suppressed —
  // the duty is still legal, so the bar stays neutral.
  if (bar.fdtlStatus === 'violation') {
    ctx.strokeStyle = '#FF3B3B'
    ctx.lineWidth = 2
    drawRoundedRect(ctx, x, y, bar.width, bar.height, r)
    ctx.stroke()
  }

  // Published-overlay diff indicator (AIMS F10). Dashed outline:
  //   green  = assignment added since publish
  //   orange = same assignment, different crew (reassigned)
  if (bar.diff === 'added' || bar.diff === 'reassigned') {
    ctx.save()
    ctx.strokeStyle = bar.diff === 'added' ? '#06C270' : '#FF8800'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    drawRoundedRect(ctx, x - 1, y - 1, bar.width + 2, bar.height + 2, r + 1)
    ctx.stroke()
    ctx.restore()
  }

  // Selection / hover ring
  if (isSelected) {
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    drawRoundedRect(ctx, x - 1, y - 1, bar.width + 2, bar.height + 2, r + 1)
    ctx.stroke()
  } else if (isHovered) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    drawRoundedRect(ctx, x, y, bar.width, bar.height, r)
    ctx.fill()
  }

  // Memo indicator — small yellow dot in the top-right corner of bars
  // with an attached memo (AIMS Alt+M). Uses a warm yellow so it reads
  // distinct from the accent + destructive palette.
  if (bar.hasMemo && bar.width >= 12 && bar.height >= 14) {
    ctx.fillStyle = '#F9B429'
    ctx.beginPath()
    ctx.arc(x + bar.width - 5, y + 5, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 4.1.7.1 Crew Check-In indicator — green tick on the left side of
  // bars whose assignment has been checked-in via /assignments/:id/check-in.
  // Reads as "crew has reported" at a glance during day-of-ops.
  if (bar.checkInUtcMs && bar.width >= 14 && bar.height >= 14) {
    const cx = x + 6
    const cy = y + bar.height - 6
    ctx.fillStyle = '#06C270'
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(cx - 2, cy)
    ctx.lineTo(cx - 0.5, cy + 1.5)
    ctx.lineTo(cx + 2, cy - 1.5)
    ctx.stroke()
  }

  // Label
  if (bar.width >= 30) {
    ctx.font = '600 11px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.textBaseline = 'middle'
    const maxW = bar.width - 12
    let label = bar.label
    if (ctx.measureText(label).width > maxW) {
      for (let n = label.length - 1; n > 0; n -= 1) {
        const t = label.slice(0, n) + '…'
        if (ctx.measureText(t).width <= maxW) {
          label = t
          break
        }
      }
    }
    ctx.fillText(label, x + 6, y + bar.height / 2)
  }
}

function drawGhostBar(
  ctx: CanvasRenderingContext2D,
  bar: { x: number; y: number; width: number; height: number; label: string },
  x: number,
  y: number,
) {
  const r = 3
  // Pale fill at low opacity + red dashed strike-through outline to read
  // as "this was here but is no longer".
  ctx.save()
  ctx.fillStyle = 'rgba(230,53,53,0.10)'
  drawRoundedRect(ctx, x, y, bar.width, bar.height, r)
  ctx.fill()
  ctx.strokeStyle = '#E63535'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 3])
  drawRoundedRect(ctx, x + 0.75, y + 0.75, bar.width - 1.5, bar.height - 1.5, r)
  ctx.stroke()
  ctx.restore()

  if (bar.width >= 30) {
    ctx.font = '600 11px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#E63535'
    ctx.textBaseline = 'middle'
    const maxW = bar.width - 12
    let label = bar.label
    if (ctx.measureText(label).width > maxW) {
      for (let n = label.length - 1; n > 0; n -= 1) {
        const t = label.slice(0, n) + '…'
        if (ctx.measureText(t).width <= maxW) {
          label = t
          break
        }
      }
    }
    ctx.fillText(label, x + 6, y + bar.height / 2)
  }
}

function drawNowLine(ctx: CanvasRenderingContext2D, layout: CrewScheduleLayout, sx: number, h: number) {
  const now = Date.now()
  const endMs = layout.periodStartMs + layout.periodDays * 86_400_000
  if (now < layout.periodStartMs || now > endMs) return
  const x = ((now - layout.periodStartMs) / 3_600_000) * layout.pph - sx
  ctx.strokeStyle = '#FF3B3B'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, h)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

function hitTestBar(bars: AssignmentBarLayout[], x: number, y: number): AssignmentBarLayout | null {
  for (const b of bars) {
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return b
  }
  return null
}

function hitTestActivityBar(bars: ActivityBarLayout[], x: number, y: number): ActivityBarLayout | null {
  for (const b of bars) {
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return b
  }
  return null
}

function hitTestRow(rows: CrewRowLayout[], y: number): CrewRowLayout | null {
  for (const r of rows) {
    if (y >= r.y && y <= r.y + r.height) return r
  }
  return null
}

function drawActivityBar(
  ctx: CanvasRenderingContext2D,
  bar: ActivityBarLayout,
  x: number,
  y: number,
  isSelected: boolean,
  isHovered: boolean,
) {
  const r = 3
  // Fill with activity code colour at slightly reduced opacity so it
  // reads as "background duty state" rather than a primary pairing bar.
  ctx.fillStyle = hexToRgba(bar.color, 0.75)
  drawRoundedRect(ctx, x, y, bar.width, bar.height, r)
  ctx.fill()

  // Subtle top highlight for depth
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(x + 1, y + 1, bar.width - 2, bar.height * 0.35)

  // Border in the saturated colour
  ctx.strokeStyle = bar.color
  ctx.lineWidth = 1
  drawRoundedRect(ctx, x + 0.5, y + 0.5, bar.width - 1, bar.height - 1, r)
  ctx.stroke()

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    drawRoundedRect(ctx, x - 1, y - 1, bar.width + 2, bar.height + 2, r + 1)
    ctx.stroke()
  } else if (isHovered) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    drawRoundedRect(ctx, x, y, bar.width, bar.height, r)
    ctx.fill()
  }

  // Label — monochrome for contrast on any activity colour
  if (bar.width >= 24) {
    ctx.font = '600 11px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.textBaseline = 'middle'
    const maxW = bar.width - 12
    let label = bar.label
    if (ctx.measureText(label).width > maxW) {
      for (let n = label.length - 1; n > 0; n -= 1) {
        const t = label.slice(0, n) + '…'
        if (ctx.measureText(t).width <= maxW) {
          label = t
          break
        }
      }
    }
    ctx.fillText(label, x + 6, y + bar.height / 2)
  }
}

/**
 * Desaturate a hex colour by scaling its HSL saturation. 1 = original,
 * 0 = fully grayscale. Used on pairing bars so the AC-type palette reads
 * calmer against the dark Gantt canvas — the raw palette hues were too
 * loud for dense rosters. Returns the input untouched if the parse fails.
 */
function desaturateHex(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const full =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1]
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  s *= factor
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const nr = Math.round(hue2rgb(p, q, h + 1 / 3) * 255)
  const ng = Math.round(hue2rgb(p, q, h) * 255)
  const nb = Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function hexToRgba(hex: string, alpha: number): string {
  // Accepts "#RGB" or "#RRGGBB"; falls back to the raw input.
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const full =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1]
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
