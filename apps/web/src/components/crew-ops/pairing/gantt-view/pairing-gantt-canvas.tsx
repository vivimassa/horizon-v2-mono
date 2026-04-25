'use client'

import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, glass } from '@skyhub/ui/theme'
import { usePairingStore } from '@/stores/use-pairing-store'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'
import { ROW_HEIGHT_LEVELS } from '@/lib/gantt/types'
import { computePixelsPerHour, computeNowLineX, dateToMs } from '@/lib/gantt/time-axis'
import { hitTestBars } from '@/lib/gantt/hit-testing'
import {
  drawGrid,
  drawGroupHeaders,
  drawBars,
  drawNightstopLabels,
  drawNowLine,
  drawTatLabels,
  buildBarsByRow,
} from '@/lib/gantt/draw-helpers'
import { layoutPairings } from '@/lib/gantt/pairing-layout'
import { drawPairingPills, drawPairingZoneBg, drawPairingLaneRules } from '@/lib/gantt/pairing-draw-helpers'
import { hitTestPairingPill } from '@/lib/gantt/pairing-hit-testing'
import { PairingZoneResizer } from './pairing-zone/pairing-zone-resizer'
import { PairingZoneOverlay } from './pairing-zone/pairing-zone-overlay'
import { FlightTooltip, PairingTooltip } from './tooltips'
import { PairingPillContextMenu } from './pairing-zone/pairing-pill-context-menu'
import { PairingDetailsDialog } from '../dialogs/pairing-details-dialog'
import { useAssignedCrewForPairing } from '../use-assigned-crew'
import { DeletePairingDialog } from '../dialogs/delete-pairing-dialog'
import { ReplicatePairingDialog } from '../dialogs/replicate-pairing-dialog'
import { BulkDeletePairingDialog } from '../dialogs/bulk-delete-pairing-dialog'
import { FlightContextMenu } from './flight-context-menu'
import { SearchPill } from './search-pill'
import { computeFlightCoverage } from '@/lib/crew-coverage/compute-flight-coverage'
import { coverageBarColor } from '@/lib/crew-coverage/coverage-colors'
import { computeNextLegCandidates } from '@/lib/crew-coverage/compute-next-leg-candidates'
import type { BarLayout } from '@/lib/gantt/types'
import type { PairingFlight } from '../types'
import type { ReviewFilterMode, SmartFilters } from '@/stores/use-pairing-gantt-store'

const ROW_LABEL_W = 160

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Crew Pairing Gantt canvas — ported wholesale from Movement Control's
 * `GanttCanvas` (network/gantt/gantt-canvas.tsx) and refactored so:
 *
 *   • Layout + drawing primitives come straight from `lib/gantt/*` — same
 *     greedy rotation-block virtual placement, same bar / grid / nightstop
 *     drawing, same scroll-synced row-labels + header.
 *   • Reads from `usePairingGanttStore` (mirror of `useGanttStore`).
 *   • Adds a resizable Pairing Zone deck at the bottom with lane-packed
 *     duty pills + connector lines (pairing-specific overlay).
 *   • Drops Movement Control's recovery / swap / reschedule dialogs and
 *     swaps the context menus for pairing-aware variants (flight ctx menu,
 *     pairing-pill ctx menu).
 *   • Build-mode wiring: when the toolbar CTA is active, canvas clicks add
 *     flights to the in-progress pairing chain rather than plain selection.
 */
export function PairingGanttCanvas() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const accentColor = useMemo(() => {
    if (typeof document === 'undefined') return '#1e40af'
    return getComputedStyle(document.documentElement).getPropertyValue('--module-accent').trim() || '#1e40af'
  }, [])

  // Refs
  const frameRef = useRef<HTMLDivElement>(null)
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const zoneWrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoneCanvasRef = useRef<HTMLCanvasElement>(null)
  const zoneScrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowLabelsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollState = useRef({ left: 0, top: 0 })
  const zoneScrollState = useRef({ top: 0 })
  const mousePosRef = useRef({ x: 0, y: 0 })
  const rafId = useRef(0)
  const zoneRafId = useRef(0)
  const lastHoverTime = useRef(0)

  // Pairing workspace (shared period / pairings / inspected id)
  const pairings = usePairingStore((s) => s.pairings)
  const complements = usePairingStore((s) => s.complements)
  const aircraftTypeFamilies = usePairingStore((s) => s.aircraftTypeFamilies)
  const activeComplementKey = usePairingStore((s) => s.activeComplementKey)
  const pairingFlightPool = usePairingStore((s) => s.flights)
  const positionFilter = usePairingStore((s) => s.filters.positionFilter)
  const baseAirports = usePairingStore((s) => s.filters.baseAirports)
  const aircraftTypeFilter = usePairingStore((s) => s.filters.aircraftTypes)
  const inspectedPairingId = usePairingStore((s) => s.inspectedPairingId)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)
  const bulkQueue = usePairingStore((s) => s.bulkQueue)

  // Gantt view-local state (mirrors Movement Control store)
  const layout = usePairingGanttStore((s) => s.layout)
  const flights = usePairingGanttStore((s) => s.flights)
  const selectedFlightIds = usePairingGanttStore((s) => s.selectedFlightIds)
  const hoveredFlightId = usePairingGanttStore((s) => s.hoveredFlightId)
  const hoveredPairingId = usePairingGanttStore((s) => s.hoveredPairingId)
  const setHoveredPairingId = usePairingGanttStore((s) => s.setHoveredPairingId)
  const periodFrom = usePairingGanttStore((s) => s.periodFrom)
  const periodTo = usePairingGanttStore((s) => s.periodTo)
  const containerWidth = usePairingGanttStore((s) => s.containerWidth)
  const zoomLevel = usePairingGanttStore((s) => s.zoomLevel)
  const collapsedTypes = usePairingGanttStore((s) => s.collapsedTypes)
  const rowHeightLevel = usePairingGanttStore((s) => s.rowHeightLevel)
  const barLabelMode = usePairingGanttStore((s) => s.barLabelMode)
  const scrollTargetMs = usePairingGanttStore((s) => s.scrollTargetMs)
  const zoneOpen = usePairingGanttStore((s) => s.zoneOpen)
  const zoneHeightRatio = usePairingGanttStore((s) => s.zoneHeightRatio)
  const zoneFilter = usePairingGanttStore((s) => s.zoneFilter)
  const reviewFilterMode = usePairingGanttStore((s) => s.reviewFilterMode)
  const smartFilters = usePairingGanttStore((s) => s.smartFilters)
  const buildMode = usePairingGanttStore((s) => s.buildMode)
  const setBuildMode = usePairingGanttStore((s) => s.setBuildMode)
  const deadheadFlightIds = usePairingGanttStore((s) => s.deadheadFlightIds)
  const proposalEnabled = usePairingGanttStore((s) => s.proposalEnabled)
  const proposalDays = usePairingGanttStore((s) => s.proposalDays)
  const proposalCandidateIds = usePairingGanttStore((s) => s.proposalCandidateIds)
  const setProposalCandidates = usePairingGanttStore((s) => s.setProposalCandidates)
  const aircraftTypesForProposal = usePairingGanttStore((s) => s.aircraftTypes)
  const showTat = usePairingGanttStore((s) => s.showTat)
  const centerTimebar = usePairingGanttStore((s) => s.centerTimebar)
  const searchHighlight = usePairingGanttStore((s) => s.searchHighlight)
  const toggleTypeCollapse = usePairingGanttStore((s) => s.toggleTypeCollapse)
  const setContainerWidth = usePairingGanttStore((s) => s.setContainerWidth)
  const consumeScrollTarget = usePairingGanttStore((s) => s.consumeScrollTarget)
  const setHovered = usePairingGanttStore((s) => s.setHovered)
  const selectFlight = usePairingGanttStore((s) => s.selectFlight)
  const clearSelection = usePairingGanttStore((s) => s.clearSelection)

  const rows = layout?.rows ?? []
  const ticks = layout?.ticks ?? []
  const totalWidth = layout?.totalWidth ?? 0
  const totalHeight = layout?.totalHeight ?? 0

  // Container size for zone height math
  const [containerHeight, setContainerHeight] = useState(0)
  const zoneHeightPx = useMemo(() => {
    if (!zoneOpen || containerHeight === 0) return 0
    return Math.round(containerHeight * zoneHeightRatio)
  }, [zoneOpen, zoneHeightRatio, containerHeight])

  // Pairing pill height tracks the flight-bar height so the zone pills read
  // 1:1 with the flight bars above them at every zoom level. Lane gutter is
  // a fixed 4px so vertical rhythm stays tight even at xlarge row height.
  const pairingPillHeight = ROW_HEIGHT_LEVELS[rowHeightLevel]?.barH ?? 22
  const pairingLaneHeight = pairingPillHeight + 4

  // Pre-sort bars by row for nightstop label drawing
  const barsByRowRef = useRef(new Map<number, import('@/lib/gantt/types').BarLayout[]>())
  useEffect(() => {
    barsByRowRef.current = layout ? buildBarsByRow(layout.bars) : new Map()
  }, [layout])

  // Flights queued in bulk mode — show as ocean-blue bars while staged for commit.
  const bulkQueuedFlightIds = useMemo(() => new Set(bulkQueue.flatMap((q) => q.flightIds)), [bulkQueue])

  // O(1) lookup for proposal chain building — rebuilt only when pool changes.
  const pairingFlightPoolById = useMemo(
    () => new Map<string, PairingFlight>(pairingFlightPool.map((f) => [f.id, f])),
    [pairingFlightPool],
  )

  // ── Phase 1: coverage state per bar — O(bars × pairings), expensive. ──
  // Does NOT depend on selectedFlightIds / proposalCandidateIds / bulkQueue so
  // it only recomputes when pairings/layout/complements actually change — not
  // on every flight click.
  const coverageBase = useMemo(() => {
    if (!layout) return []
    return layout.bars.map((bar) => {
      const pf = pairingFlightPoolById.get(bar.flightId)
      const { state, augmented } = computeFlightCoverage({
        flightId: bar.flightId,
        aircraftTypeIcao: bar.flight.aircraftTypeIcao,
        pairings,
        complementMaster: complements,
        positionFilter,
        pairingIdHint: pf?.pairingId ?? null,
      })
      const { bg, text } = coverageBarColor(state, isDark)
      return { bar, augmented, bg, text, state }
    })
  }, [layout, pairings, complements, isDark, positionFilter, pairingFlightPoolById])

  // ── Phase 2: apply selection/proposal/bulk/DH overlay colors — O(bars), cheap. ──
  // Only this memo re-runs on flight clicks, keeping the hot path fast.
  // Priority: deadhead > bulk-queued > selected > proposal > coverage.
  const coverageBars = useMemo<BarLayout[]>(() => {
    return coverageBase.map(({ bar, augmented, bg, text }) => {
      if (deadheadFlightIds.has(bar.flightId)) {
        // Dark slate — stripe overlay drawn separately in the RAF loop.
        return { ...bar, color: '#1E293B', textColor: '#94A3B8', augmented }
      }
      if (bulkQueuedFlightIds.has(bar.flightId)) {
        return { ...bar, color: '#0096C7', textColor: '#FFFFFF', augmented }
      }
      if (selectedFlightIds.has(bar.flightId)) {
        return { ...bar, color: '#FFCC00', textColor: '#1C1C28', augmented }
      }
      if (proposalCandidateIds.has(bar.flightId)) {
        return { ...bar, color: '#FDDD48', textColor: '#E63535', augmented }
      }
      return { ...bar, color: bg, textColor: text, augmented }
    })
  }, [coverageBase, selectedFlightIds, proposalCandidateIds, bulkQueuedFlightIds, deadheadFlightIds])

  // ── Coverage problem sets — derived from coverageBase for review filters 7-10.
  // under = flights without enough crew; over = flights with too many.
  const coverageProblemSets = useMemo(() => {
    const under = new Set<string>()
    const over = new Set<string>()
    for (const entry of coverageBase) {
      if (entry.state === 'under' || entry.state === 'uncovered') under.add(entry.bar.flightId)
      if (entry.state === 'over') over.add(entry.bar.flightId)
    }
    return { under, over }
  }, [coverageBase])

  // ── Review filter + smart filter — applied before layoutPairings so the
  // zone only renders pairings matching the active criteria.
  const reviewedPairings = useMemo(() => {
    let result = pairings

    if (baseAirports && baseAirports.length > 0) {
      const baseSet = new Set(baseAirports)
      result = result.filter((p) => baseSet.has(p.baseAirport))
    }

    if (aircraftTypeFilter && aircraftTypeFilter.length > 0) {
      const typeSet = new Set(aircraftTypeFilter)
      result = result.filter((p) => (p.aircraftTypeIcao ? typeSet.has(p.aircraftTypeIcao) : false))
    }

    const { under, over } = coverageProblemSets
    switch (reviewFilterMode) {
      case 'operating':
        result = result.filter((p) => p.legs.some((l) => !l.isDeadhead))
        break
      case 'unfinalized':
        result = result.filter((p) => p.workflowStatus !== 'committed')
        break
      case 'deadhead':
        result = result.filter((p) => p.deadheadFlightIds.length > 0)
        break
      case 'non_base_to_base':
        result = result.filter((p) => {
          const last = p.legs[p.legs.length - 1]
          return last ? last.arrStation !== p.baseAirport : false
        })
        break
      case 'illegal':
        result = result.filter((p) => p.status === 'violation')
        break
      case 'partial_uncovered':
        result = result.filter((p) => p.flightIds.some((id) => under.has(id)))
        break
      case 'over_covered':
        result = result.filter((p) => p.flightIds.some((id) => over.has(id)))
        break
      case 'over_and_under':
        result = result.filter((p) => p.flightIds.some((id) => under.has(id)) && p.flightIds.some((id) => over.has(id)))
        break
      case 'any_coverage':
        result = result.filter((p) => p.flightIds.some((id) => under.has(id) || over.has(id)))
        break
    }

    if (smartFilters) {
      const { logic, statuses, hasDeadhead, nonBaseToBase, routeLengthMin, routeLengthMax, positionCodes, dhStation } =
        smartFilters
      const tests: Array<(p: (typeof result)[0]) => boolean> = []
      if (statuses.length > 0) tests.push((p) => statuses.includes(p.status))
      if (hasDeadhead !== null)
        tests.push((p) => (hasDeadhead ? p.deadheadFlightIds.length > 0 : p.deadheadFlightIds.length === 0))
      if (nonBaseToBase !== null)
        tests.push((p) => {
          const last = p.legs[p.legs.length - 1]
          const isNonBTB = last ? last.arrStation !== p.baseAirport : false
          return nonBaseToBase ? isNonBTB : !isNonBTB
        })
      if (routeLengthMin !== null) tests.push((p) => p.pairingDays >= routeLengthMin)
      if (routeLengthMax !== null) tests.push((p) => p.pairingDays <= routeLengthMax)
      if (positionCodes.length > 0) tests.push((p) => positionCodes.some((code) => (p.crewCounts?.[code] ?? 0) > 0))
      if (dhStation)
        tests.push((p) =>
          p.legs.some((l) => l.isDeadhead && (l.depStation === dhStation || l.arrStation === dhStation)),
        )
      if (tests.length > 0)
        result = result.filter((p) => (logic === 'OR' ? tests.some((t) => t(p)) : tests.every((t) => t(p))))
    }

    return result
  }, [pairings, reviewFilterMode, smartFilters, coverageProblemSets, baseAirports, aircraftTypeFilter])

  // Pairing zone layout — depends on reviewedPairings (post-filter) + view params.
  const zoneLayout = useMemo(() => {
    if (!layout || !reviewedPairings.length) return null
    const pph = computePixelsPerHour(containerWidth, zoomLevel)
    const startMs = dateToMs(periodFrom)
    const scoped =
      positionFilter && positionFilter.length > 0
        ? reviewedPairings.filter((p) => positionFilter.some((code) => (p.crewCounts?.[code] ?? 0) > 0))
        : reviewedPairings
    const sorted = inspectedPairingId
      ? [...scoped].sort((a, b) => {
          if (a.id === inspectedPairingId) return -1
          if (b.id === inspectedPairingId) return 1
          return 0
        })
      : scoped
    return layoutPairings({ pairings: sorted, filter: zoneFilter, startMs, pph, baseAirports })
  }, [
    reviewedPairings,
    zoneFilter,
    periodFrom,
    containerWidth,
    zoomLevel,
    baseAirports,
    layout,
    positionFilter,
    inspectedPairingId,
  ])

  // Proposal: compute next-leg candidates, debounced so rapid chain edits
  // batch into one update. NOTE: `proposalCandidateIds` is intentionally NOT
  // in deps — the effect writes it, reading it would create an infinite loop.
  // Screen position is preserved — no auto-scroll; user scrolls manually.
  useEffect(() => {
    const run = () => {
      const currentIds = usePairingGanttStore.getState().proposalCandidateIds
      if (!proposalEnabled || !buildMode) {
        if (currentIds.size > 0) setProposalCandidates(new Set(), null)
        return
      }
      const chain = (Array.from(selectedFlightIds) as string[])
        .map((id) => pairingFlightPoolById.get(id))
        .filter((f): f is PairingFlight => f != null)
        .sort((a, b) => Date.parse(a.stdUtc) - Date.parse(b.stdUtc))
      if (chain.length === 0) {
        if (currentIds.size > 0) setProposalCandidates(new Set(), null)
        return
      }
      const fdpLimitMinutes =
        activeComplementKey === 'aug2'
          ? 900
          : activeComplementKey === 'aug1'
            ? 780
            : activeComplementKey === 'custom'
              ? 780
              : 600
      const { candidateIds, nearestRegistration } = computeNextLegCandidates({
        chain,
        pool: pairingFlightPool,
        aircraftTypeFamilies,
        aircraftTypes: aircraftTypesForProposal,
        daysAhead: proposalDays,
        fdpLimitMinutes,
      })
      setProposalCandidates(candidateIds, nearestRegistration)
    }
    const t = setTimeout(run, 120)
    return () => clearTimeout(t)
  }, [
    proposalEnabled,
    buildMode,
    proposalDays,
    selectedFlightIds,
    pairingFlightPool,
    pairingFlightPoolById,
    aircraftTypeFamilies,
    aircraftTypesForProposal,
    activeComplementKey,
    setProposalCandidates,
  ])

  // ── Main grid draw (verbatim from Movement Control with swap/TAT/slot stripped) ──
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
    drawBars(ctx, coverageBars, selectedFlightIds, hoveredFlightId, sx, sy, vw, vh)

    // Augmentation glyph — asterisk inset into each augmented bar's top-right.
    const visR = sx + vw
    const visB = sy + vh
    ctx.save()
    ctx.font = 'bold 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 2
    for (const bar of coverageBars) {
      if (!bar.augmented) continue
      if (bar.x + bar.width < sx || bar.x > visR) continue
      if (bar.y + bar.height < sy || bar.y > visB) continue
      ctx.fillText('*', bar.x + bar.width - 4, bar.y + 2)
    }
    ctx.restore()

    // Deadhead stripe overlay — diagonal light lines on #1E293B bars.
    if (deadheadFlightIds.size > 0) {
      const off = document.createElement('canvas')
      off.width = 8
      off.height = 8
      const sCtx = off.getContext('2d')
      if (sCtx) {
        sCtx.strokeStyle = 'rgba(255,255,255,0.45)'
        sCtx.lineWidth = 2
        sCtx.beginPath()
        sCtx.moveTo(0, 8)
        sCtx.lineTo(8, 0)
        sCtx.moveTo(-4, 8)
        sCtx.lineTo(4, 0)
        sCtx.moveTo(4, 8)
        sCtx.lineTo(12, 0)
        sCtx.stroke()
        const pattern = ctx.createPattern(off, 'repeat')
        if (pattern) {
          for (const bar of coverageBars) {
            if (!deadheadFlightIds.has(bar.flightId)) continue
            if (bar.x + bar.width < sx || bar.x > visR) continue
            if (bar.y + bar.height < sy || bar.y > visB) continue
            ctx.save()
            ctx.beginPath()
            ctx.roundRect(bar.x + 1, bar.y + 1, bar.width - 2, bar.height - 2, 3)
            ctx.clip()
            ctx.fillStyle = pattern
            ctx.fillRect(bar.x, bar.y, bar.width, bar.height)
            ctx.restore()
          }
        }
      }
    }

    if (showTat) drawTatLabels(ctx, barsByRowRef.current, sx, sy, vw, vh, isDark)
    drawNightstopLabels(ctx, barsByRowRef.current, sx, sy, vw, vh, isDark)

    // Tail-search highlight band — yellow bg on the pinned aircraft row
    if (searchHighlight) {
      const row = layout.rows.find((r) => r.type === 'aircraft' && r.registration === searchHighlight.registration)
      if (row) {
        const alpha = searchHighlight.phase < 0.8 ? 0.32 : Math.max(0, 0.32 * (1 - (searchHighlight.phase - 0.8) / 0.2))
        if (alpha > 0) {
          ctx.fillStyle = `rgba(245,158,11,${alpha})`
          ctx.fillRect(sx, row.y, vw, row.height)
        }
      }
    }

    // Now-line
    const pph = computePixelsPerHour(containerWidth, zoomLevel)
    const startMs = dateToMs(periodFrom)
    const endMs = dateToMs(periodTo) + 86_400_000
    const periodDays = Math.round((endMs - startMs) / 86_400_000)
    const nowX = computeNowLineX(startMs, periodDays, pph)
    if (nowX !== null) drawNowLine(ctx, nowX, layout.totalHeight)

    ctx.restore()
  }, [
    layout,
    coverageBars,
    selectedFlightIds,
    hoveredFlightId,
    isDark,
    accentColor,
    periodFrom,
    periodTo,
    containerWidth,
    zoomLevel,
    searchHighlight,
    showTat,
    deadheadFlightIds,
  ])

  // Center-timebar: auto-scroll to now every 30s while active (matches MC)
  useEffect(() => {
    if (!centerTimebar) return
    const id = setInterval(() => {
      usePairingGanttStore.setState({ scrollTargetMs: Date.now() })
    }, 30_000)
    return () => clearInterval(id)
  }, [centerTimebar])

  const drawRef = useRef(draw)
  drawRef.current = draw

  // ── Zone canvas draw ──
  const drawZone = useCallback(() => {
    const canvas = zoneCanvasRef.current
    if (!canvas || !zoneLayout || zoneHeightPx === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const vw = canvas.width / dpr
    const vh = canvas.height / dpr
    const sx = scrollState.current.left

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw, vh)

    drawPairingZoneBg(ctx, vw, vh, isDark)

    ctx.save()
    const sy = zoneScrollState.current.top
    ctx.translate(-sx, -sy)
    drawPairingLaneRules(ctx, sx, vw, zoneLayout.maxLane, 6, isDark, pairingLaneHeight)
    drawPairingPills(ctx, zoneLayout.packed, sx, vw, 6, {
      inspectedPairingId,
      hoveredPairingId,
      isDark,
      accentColor,
      labelMode: barLabelMode,
      pillHeight: pairingPillHeight,
      laneHeight: pairingLaneHeight,
    })
    ctx.restore()
  }, [
    zoneLayout,
    zoneHeightPx,
    inspectedPairingId,
    hoveredPairingId,
    isDark,
    accentColor,
    barLabelMode,
    pairingPillHeight,
    pairingLaneHeight,
  ])

  const drawZoneRef = useRef(drawZone)
  drawZoneRef.current = drawZone

  // ── Resize observer (canvas immediate, layout debounced) ──
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
      const dpr = window.devicePixelRatio || 1
      // Guard: assignments to canvas.width/height clear the pixel buffer,
      // so skip if the size is already correct. Without this, the RO would
      // re-clear the canvas the useLayoutEffect just redrew, and the next
      // paint would show an empty frame (flicker during resize drag).
      const targetW = w * dpr
      const targetH = h * dpr
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
      }

      // Zone canvas size — same idempotence guard.
      const zoneCanvas = zoneCanvasRef.current
      if (zoneCanvas) {
        const zh = zoneHeightPx
        if (zh > 0) {
          const zTargetH = zh * dpr
          if (zoneCanvas.width !== targetW || zoneCanvas.height !== zTargetH) {
            zoneCanvas.width = targetW
            zoneCanvas.height = zTargetH
            zoneCanvas.style.width = w + 'px'
            zoneCanvas.style.height = zh + 'px'
          }
        }
      }

      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        drawRef.current()
        drawZoneRef.current()
      })

      if (resizeTimer.current) clearTimeout(resizeTimer.current)
      resizeTimer.current = setTimeout(() => {
        if (w > 0) setContainerWidth(w)
      }, 200)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [setContainerWidth, zoneHeightPx])

  // Frame-height observer — independent of the grid/zone split. We used to
  // drive `containerHeight` from the GRID area RO, but the grid area shrinks
  // when the zone grows, so `zoneHeightPx = containerHeight * ratio` formed a
  // feedback loop (each drag tick recomputed a slightly different zoneHeightPx,
  // bounced layout again, flickered). Observing the outer frame instead keeps
  // `containerHeight` stable during a zone-resize drag.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight)
    })
    ro.observe(el)
    setContainerHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // ── Scroll sync — key fix: row labels + header translate with scroll ──
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    scrollState.current = { left: el.scrollLeft, top: el.scrollTop }
    if (rowLabelsRef.current) rowLabelsRef.current.style.transform = `translateY(-${el.scrollTop}px)`
    if (headerRef.current) headerRef.current.style.transform = `translateX(-${el.scrollLeft}px)`
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      drawRef.current()
      drawZoneRef.current()
    })
  }, [])

  // ── Rubberband selection (Movement Control style, trimmed — no drag&drop) ──
  const dragRef = useRef<{
    startX: number
    startY: number
    dragging: boolean
    ctrlKey: boolean
    hitBarId: string | null
  } | null>(null)
  const rubberbandRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || !layout) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top
      const hitBarId = hitTestBars(x, y, layout.bars)
      dragRef.current = { startX: x, startY: y, dragging: false, ctrlKey: e.ctrlKey || e.metaKey, hitBarId }
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

      // Rubberband (only if drag started on empty space)
      if (dragRef.current && !dragRef.current.hitBarId) {
        const dx = Math.abs(x - dragRef.current.startX)
        const dy = Math.abs(y - dragRef.current.startY)
        if (dx > 5 || dy > 5) {
          dragRef.current.dragging = true
          const rx = Math.min(dragRef.current.startX, x)
          const ry = Math.min(dragRef.current.startY, y)
          const rw = Math.abs(x - dragRef.current.startX)
          const rh = Math.abs(y - dragRef.current.startY)
          const rb = rubberbandRef.current
          if (rb) {
            rb.style.display = 'block'
            rb.style.left = `${rx}px`
            rb.style.top = `${ry}px`
            rb.style.width = `${rw}px`
            rb.style.height = `${rh}px`
          }
        }
      }

      // Hover — throttled to 50ms to avoid thousands of hit-tests per second
      const now = performance.now()
      if (now - lastHoverTime.current > 50) {
        lastHoverTime.current = now
        const newHovered = hitTestBars(x, y, layout.bars)
        if (newHovered !== usePairingGanttStore.getState().hoveredFlightId) {
          setHovered(newHovered)
          cancelAnimationFrame(rafId.current)
          rafId.current = requestAnimationFrame(() => drawRef.current())
        }
      }
    },
    [layout, setHovered],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!layout || e.button !== 0) return
      const drag = dragRef.current
      dragRef.current = null
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top

      if (rubberbandRef.current) rubberbandRef.current.style.display = 'none'
      if (drag?.dragging) {
        // Rubberband — bars within the rectangle.
        // Build mode: UNION with existing chain so a partial drag extends it.
        // Otherwise: replace viewport selection.
        const rx = Math.min(drag.startX, x)
        const ry = Math.min(drag.startY, y)
        const rw = Math.abs(x - drag.startX)
        const rh = Math.abs(y - drag.startY)
        const hit = new Set<string>()
        for (const bar of layout.bars) {
          const barRight = bar.x + bar.width
          const barBottom = bar.y + bar.height
          if (bar.x < rx + rw && barRight > rx && bar.y < ry + rh && barBottom > ry) {
            hit.add(bar.flightId)
          }
        }
        if (hit.size > 0) {
          if (buildMode) {
            const current = usePairingGanttStore.getState().selectedFlightIds
            const merged = new Set(current)
            for (const id of hit) merged.add(id)
            usePairingGanttStore.setState({ selectedFlightIds: merged })
          } else {
            usePairingGanttStore.setState({ selectedFlightIds: hit })
          }
        }
      } else {
        // Simple click — AIMS-style: inspect/select only, never touches chain.
        // Chain edits happen exclusively via double-click.
        if (buildMode) return
        const hit = hitTestBars(x, y, layout.bars)
        if (hit) {
          selectFlight(hit, drag?.ctrlKey ?? false)
          const flight = flights.find((f) => f.id === hit)
          const pairing = pairings.find((p) => p.flightIds.includes(hit))
          if (flight && pairing) inspectPairing(pairing.id)
        } else {
          clearSelection()
          if (inspectedPairingId) inspectPairing(null)
        }
      }
    },
    [layout, buildMode, flights, pairings, selectFlight, clearSelection, inspectPairing, inspectedPairingId],
  )

  // Double-click a flight bar — AIMS-style pairing construction.
  //   • Chain empty → enable build mode, seed first leg.
  //   • Chain non-empty → toggle this flight's chain membership (add / remove).
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!layout) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top
      const hit = hitTestBars(x, y, layout.bars)
      if (!hit) return
      e.preventDefault()
      const store = usePairingGanttStore.getState()
      if (!store.buildMode) store.setBuildMode(true)
      // `selectFlight(id, true)` toggles membership when multi=true.
      store.selectFlight(hit, true)
    },
    [layout],
  )

  // ── Context menus ──
  const [flightCtxMenu, setFlightCtxMenu] = useState<{ x: number; y: number; flightId: string } | null>(null)
  const [pairingCtxMenu, setPairingCtxMenu] = useState<{ x: number; y: number; pairingId: string } | null>(null)
  const [detailsPairingId, setDetailsPairingId] = useState<string | null>(null)
  const [replicatePairingId, setReplicatePairingId] = useState<string | null>(null)
  const [bulkDeletePairingId, setBulkDeletePairingId] = useState<string | null>(null)

  // Seed build-mode state from a pairing so the planner can re-edit its legs
  // and complement. Persists `editingPairingId` so the save handler PATCHes
  // instead of POSTs.
  const startEditPairing = useCallback((pairingId: string) => {
    const ps = usePairingStore.getState()
    const pairing = ps.pairings.find((p) => p.id === pairingId)
    if (!pairing) return
    const sortedLegs = [...pairing.legs].sort((a, b) => a.legOrder - b.legOrder)
    const operatingIds = new Set(sortedLegs.filter((l) => !l.isDeadhead).map((l) => l.flightId))
    const gantt = usePairingGanttStore.getState()
    if (!gantt.buildMode) gantt.setBuildMode(true)
    usePairingGanttStore.setState({ selectedFlightIds: operatingIds })
    const key = pairing.complementKey as 'standard' | 'aug1' | 'aug2' | 'custom'
    ps.setComplement(key === 'standard' || key === 'aug1' || key === 'aug2' || key === 'custom' ? key : 'standard')
    if (pairing.crewCounts) ps.setCustomCrewCounts(pairing.crewCounts)
    // Order matters: `inspectPairing(null)` nulls out `editingPairingId`
    // in the store, so set the edit target AFTER clearing inspect state.
    ps.inspectPairing(null)
    ps.setEditingPairing(pairingId)
  }, [])
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    pairingCode: string
    legs: number
    routeChain: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Ctrl+F1 — open Pairing Details for the currently inspected pairing.
  // (F1 alone is reserved globally for Help — see project memory.)
  //
  // preventDefault runs BEFORE the inspected-id bail so the browser doesn't
  // reload/save/print on Ctrl+R / Ctrl+S / Ctrl+P etc. while the planner is
  // working in this view. Shortcuts are capture-phase so default browser
  // behavior never wins, even if a focused input handled the event first.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      const k = e.key
      const isE = k === 'e' || k === 'E'
      const isR = k === 'r' || k === 'R'
      const isC = k === 'c' || k === 'C'
      const isD = k === 'd' || k === 'D'
      const isP = k === 'p' || k === 'P'
      const isF1 = k === 'F1'
      if (!isE && !isR && !isC && !isD && !isP && !isF1) return

      // Preserve native copy in form fields — never hijack Ctrl+C when the
      // planner is typing. Outside form fields, Ctrl+C routes to Replicate.
      if (isC && isTypingTarget(e.target)) return

      e.preventDefault()
      e.stopPropagation()

      if (isF1) {
        const id = usePairingStore.getState().inspectedPairingId
        if (!id) return
        setDetailsPairingId(id)
        return
      }
      if (isE) {
        const id = usePairingStore.getState().inspectedPairingId
        if (!id) return
        startEditPairing(id)
        return
      }
      if (isR || isC) {
        // Prefer inspected pairing. Fall back to the pairing pill the cursor
        // is hovering so the planner doesn't have to click-then-shortcut.
        const id = usePairingStore.getState().inspectedPairingId ?? usePairingGanttStore.getState().hoveredPairingId
        if (!id) return
        setReplicatePairingId(id)
        return
      }
      if (isD) {
        const id = usePairingStore.getState().inspectedPairingId
        if (!id) return
        setBulkDeletePairingId(id)
        return
      }
      if (isP) {
        const hovered = usePairingGanttStore.getState().hoveredFlightId
        if (!hovered) return
        const store = usePairingStore.getState()
        const pf = store.flights.find((fl) => fl.id === hovered)
        if (!pf) return
        const covering = store.pairings.find(
          (p) => (p.flightIds.includes(pf.id) || p.id === pf.pairingId) && !p.deadheadFlightIds.includes(pf.id),
        )
        if (!covering) return
        store.inspectPairing(covering.id)
      }
    }
    // Some browsers still clipboard-copy on the subsequent `copy` event even
    // when keydown was prevented. Swallow the copy event too (outside form
    // fields) so nothing lands on the clipboard when the planner intends
    // Replicate.
    const onCopy = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('copy', onCopy, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions)
      window.removeEventListener('copy', onCopy, { capture: true } as EventListenerOptions)
    }
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!layout) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollState.current.left
      const y = e.clientY - rect.top + scrollState.current.top
      const hit = hitTestBars(x, y, layout.bars)
      if (hit) setFlightCtxMenu({ x: e.clientX, y: e.clientY, flightId: hit })
    },
    [layout],
  )

  // ── Zone mouse handling ──
  // Events fire on the transparent scroll overlay, so localY must include
  // the zone's own vertical scroll offset (separate from the grid's) to map
  // correctly onto the canvas content.
  const handleZoneMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!zoneLayout) return
      const rect = e.currentTarget.getBoundingClientRect()
      const localX = e.clientX - rect.left + scrollState.current.left
      const localY = e.clientY - rect.top + zoneScrollState.current.top
      const hit = hitTestPairingPill(localX, localY, zoneLayout.packed, 6, pairingPillHeight, pairingLaneHeight)
      setHoveredPairingId(hit?.pairingId ?? null)
      cancelAnimationFrame(zoneRafId.current)
      zoneRafId.current = requestAnimationFrame(() => drawZoneRef.current())
    },
    [zoneLayout, setHoveredPairingId, pairingPillHeight, pairingLaneHeight],
  )

  const handleZoneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!zoneLayout) return
      const rect = e.currentTarget.getBoundingClientRect()
      const localX = e.clientX - rect.left + scrollState.current.left
      const localY = e.clientY - rect.top + zoneScrollState.current.top
      const hit = hitTestPairingPill(localX, localY, zoneLayout.packed, 6, pairingPillHeight, pairingLaneHeight)
      if (!hit) return
      // Left-click on a committed pairing pill always shows it in the
      // inspector. If build mode is on (Inspector showing the blank chain),
      // exit build + clear any in-progress selection so the pairing view
      // takes over the panel.
      if (buildMode) {
        setBuildMode(false)
        clearSelection()
      }
      inspectPairing(inspectedPairingId === hit.pairingId ? null : hit.pairingId)
    },
    [
      zoneLayout,
      inspectedPairingId,
      inspectPairing,
      pairingPillHeight,
      pairingLaneHeight,
      buildMode,
      setBuildMode,
      clearSelection,
    ],
  )

  const handleZoneContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!zoneLayout) return
      const rect = e.currentTarget.getBoundingClientRect()
      const localX = e.clientX - rect.left + scrollState.current.left
      const localY = e.clientY - rect.top + zoneScrollState.current.top
      const hit = hitTestPairingPill(localX, localY, zoneLayout.packed, 6, pairingPillHeight, pairingLaneHeight)
      if (hit) setPairingCtxMenu({ x: e.clientX, y: e.clientY, pairingId: hit.pairingId })
    },
    [zoneLayout, pairingPillHeight, pairingLaneHeight],
  )

  const handleZoneScroll = useCallback(() => {
    const el = zoneScrollRef.current
    if (!el) return
    zoneScrollState.current = { top: el.scrollTop }
    cancelAnimationFrame(zoneRafId.current)
    zoneRafId.current = requestAnimationFrame(() => drawZoneRef.current())
  }, [])

  // Reset internal zone scroll state when the zone re-mounts — the DOM's
  // scrollTop starts at 0 again, but our ref would still hold the last
  // saved offset otherwise.
  useEffect(() => {
    if (zoneOpen) zoneScrollState.current = { top: 0 }
  }, [zoneOpen])

  // Cursor
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.style.cursor = hoveredFlightId ? 'pointer' : 'default'
  }, [hoveredFlightId])

  // Imperative drag handler for the zone resizer. Bypasses React entirely
  // during the drag: styles are mutated via refs, canvas buffers resized in
  // place, redraw called synchronously. No setState → no re-render → no
  // flashing. Only the final ratio is committed to the store on mouseup.
  const onZoneDragResize = useCallback((nextRatio: number) => {
    const frame = frameRef.current
    const gridBody = gridBodyRef.current
    const zoneWrapper = zoneWrapperRef.current
    const scroll = scrollRef.current
    if (!frame || !gridBody || !zoneWrapper || !scroll) return
    const frameH = frame.clientHeight
    if (frameH <= 0) return
    const nextZonePx = Math.round(frameH * nextRatio)

    // Mutate heights directly — no React state update.
    gridBody.style.height = `calc(100% - 44px - ${nextZonePx + 32 + 6}px)`
    zoneWrapper.style.height = `${nextZonePx}px`

    // Resize canvases synchronously. `canvas.width = x` clears the buffer;
    // calling draw immediately after means the browser never paints a
    // cleared frame.
    const dpr = window.devicePixelRatio || 1
    const w = scroll.clientWidth
    if (w <= 0) return
    const gridCanvas = canvasRef.current
    const gridH = gridBody.clientHeight
    if (gridCanvas && gridH > 0) {
      const targetW = w * dpr
      const targetH = gridH * dpr
      if (gridCanvas.width !== targetW || gridCanvas.height !== targetH) {
        gridCanvas.width = targetW
        gridCanvas.height = targetH
        gridCanvas.style.width = w + 'px'
        gridCanvas.style.height = gridH + 'px'
      }
      drawRef.current()
    }
    const zoneCanvas = zoneCanvasRef.current
    if (zoneCanvas && nextZonePx > 0) {
      const zTargetW = w * dpr
      const zTargetH = nextZonePx * dpr
      if (zoneCanvas.width !== zTargetW || zoneCanvas.height !== zTargetH) {
        zoneCanvas.width = zTargetW
        zoneCanvas.height = zTargetH
        zoneCanvas.style.width = w + 'px'
        zoneCanvas.style.height = nextZonePx + 'px'
      }
      drawZoneRef.current()
    }
  }, [])

  // Keep BOTH canvas buffer dimensions in lockstep with `zoneHeightPx`
  // during a resize drag. Done in a useLayoutEffect (runs after DOM commit
  // but BEFORE the browser paints) so the user never sees a mid-drag frame
  // where a canvas buffer has just been cleared by `canvas.width = …` but
  // the redraw hasn't happened yet — which was the source of the "flash to
  // empty" during the resize-handle drag. Previously the ResizeObserver
  // handled this a frame late, so the user saw a cleared canvas on every
  // frame the drag fired.
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const dpr = window.devicePixelRatio || 1
    const w = scroll.clientWidth
    const h = scroll.clientHeight
    if (w <= 0) return

    const gridCanvas = canvasRef.current
    if (gridCanvas && h > 0) {
      gridCanvas.width = w * dpr
      gridCanvas.height = h * dpr
      gridCanvas.style.width = w + 'px'
      gridCanvas.style.height = h + 'px'
      drawRef.current()
    }

    const zoneCanvas = zoneCanvasRef.current
    if (zoneCanvas && zoneHeightPx > 0) {
      zoneCanvas.width = w * dpr
      zoneCanvas.height = zoneHeightPx * dpr
      zoneCanvas.style.width = w + 'px'
      zoneCanvas.style.height = zoneHeightPx + 'px'
      drawZoneRef.current()
    }
  }, [zoneHeightPx, pairingLaneHeight, pairingPillHeight])

  // Redraw on data/view changes
  useEffect(() => {
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      drawRef.current()
      drawZoneRef.current()
    })
  }, [layout, coverageBars, selectedFlightIds, isDark, zoneLayout, zoneHeightPx, inspectedPairingId])

  // Now-line timer (every minute)
  useEffect(() => {
    const id = setInterval(() => {
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => drawRef.current())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Scroll to target — horizontal to the target UTC ms, vertical to the row
  // containing the first currently-selected flight (used by "Show Flights"
  // on a pairing pill to bring its aircraft row into view).
  useEffect(() => {
    if (scrollTargetMs === null || !scrollRef.current) return
    const startMs = new Date(periodFrom + 'T00:00:00Z').getTime()
    const pph = computePixelsPerHour(containerWidth, zoomLevel)
    const targetX = ((scrollTargetMs - startMs) / 3_600_000) * pph
    const el = scrollRef.current
    el.scrollLeft = Math.max(0, targetX - el.clientWidth / 2)

    // Vertical: find the earliest bar among selected flights (top-most in
    // chronological order), park it near the top of the viewport with a
    // small breathing margin so the user immediately sees the pairing's
    // aircraft row on arrival.
    if (layout && selectedFlightIds.size > 0) {
      let topBar: { y: number; height: number } | null = null
      for (const b of layout.bars) {
        if (!selectedFlightIds.has(b.flightId)) continue
        if (!topBar || b.y < topBar.y) topBar = { y: b.y, height: b.height }
      }
      if (topBar) {
        const topMargin = 24
        el.scrollTop = Math.max(0, topBar.y - topMargin)
      }
    }

    consumeScrollTarget()
  }, [scrollTargetMs, periodFrom, containerWidth, zoomLevel, consumeScrollTarget, layout, selectedFlightIds])

  // Ensure the pairing zone is open when a pairing is inspected — otherwise
  // "Show Pairing" from a flight / pairing-pill menu can't surface the pill.
  useEffect(() => {
    if (!inspectedPairingId) return
    if (!usePairingGanttStore.getState().zoneOpen) {
      usePairingGanttStore.getState().toggleZoneOpen()
    }
  }, [inspectedPairingId])

  // Auto-scroll the zone vertically so the inspected pairing's pill is in
  // view. Without this, users must manually hunt for the pill after "Show
  // Pairing". zoneLayout sorts inspected first → lane 0 → y = 6, so this
  // usually collapses to "scroll to top", but compute defensively in case
  // sort order changes.
  useEffect(() => {
    if (!inspectedPairingId || !zoneLayout || !zoneOpen) return
    const el = zoneScrollRef.current
    if (!el) return
    const packed = zoneLayout.packed.find((p) => p.pairingId === inspectedPairingId)
    if (!packed) return
    const laneTop = 6 + packed.lane * pairingLaneHeight
    const laneBottom = laneTop + pairingPillHeight
    const vpTop = el.scrollTop
    const vpBottom = vpTop + el.clientHeight
    const margin = 8
    if (laneTop < vpTop + margin) {
      el.scrollTo({ top: Math.max(0, laneTop - margin), behavior: 'smooth' })
    } else if (laneBottom > vpBottom - margin) {
      el.scrollTo({ top: Math.max(0, laneBottom - el.clientHeight + margin), behavior: 'smooth' })
    }
  }, [inspectedPairingId, zoneLayout, zoneOpen, pairingLaneHeight, pairingPillHeight])

  // Hovered flight for tooltip
  const hoveredFlight = useMemo(() => {
    if (!hoveredFlightId || flightCtxMenu || pairingCtxMenu) return null
    return flights.find((f) => f.id === hoveredFlightId) ?? null
  }, [hoveredFlightId, flights, flightCtxMenu, pairingCtxMenu])

  // Hovered pairing for tooltip
  const hoveredPairing = useMemo(() => {
    if (!hoveredPairingId || pairingCtxMenu) return null
    return pairings.find((p) => p.id === hoveredPairingId) ?? null
  }, [hoveredPairingId, pairings, pairingCtxMenu])

  // Pass the found pairing flights (from the workspace store) to the tooltip —
  // pairing has flight IDs + leg data, tooltip reads pairing.* directly.

  const palette = isDark ? colors.dark : colors.light
  const headerBg = isDark ? glass.panel : 'rgba(255,255,255,0.90)'
  const labelBg = isDark ? palette.backgroundSecondary : palette.card
  const frameBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const frameBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div
      ref={frameRef}
      className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl relative"
      style={{
        background: frameBg,
        border: `1px solid ${frameBorder}`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* ── Time header ── */}
      <div
        className="shrink-0 flex"
        style={{ height: 44, borderBottom: `1px solid ${palette.border}`, background: headerBg }}
      >
        <div
          className="shrink-0 flex items-end justify-center pb-1"
          style={{ width: ROW_LABEL_W, borderRight: `1px solid ${palette.border}` }}
        >
          <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: palette.textTertiary }}>
            Aircraft
          </span>
        </div>
        <div className="flex-1 overflow-hidden relative">
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
                  <div className="h-6 relative">
                    {ticks
                      .filter((t) => t.isMajor)
                      .map((t) => (
                        <span
                          key={t.x}
                          className="absolute top-1 text-[13px] font-bold whitespace-nowrap text-center"
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            left: t.x,
                            width: dayW,
                            color: palette.text,
                          }}
                        >
                          {t.label}
                        </span>
                      ))}
                  </div>
                  <div className="h-[18px] relative">
                    {ticks
                      .filter((t) => !t.isMajor)
                      .map((t) => (
                        <span
                          key={t.x}
                          className="absolute top-0 text-[13px] font-mono"
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

      {/* ── Body: row labels + canvas ── */}
      <div
        ref={gridBodyRef}
        className="flex-1 min-h-0 flex overflow-hidden"
        style={{ height: `calc(100% - 44px - ${zoneOpen ? zoneHeightPx + 32 + 6 : 32}px)` }}
      >
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
                    <span className="text-[13px] font-bold truncate" style={{ color: palette.text }}>
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
                    <span className="text-[13px] font-medium truncate" style={{ color: palette.textSecondary }}>
                      {row.label}
                    </span>
                  </div>
                )
              }
              // aircraft row — registration + AC type line
              const isPinned = searchHighlight?.registration === row.registration
              return (
                <div
                  key={`a${i}`}
                  className="flex flex-col justify-center px-3 select-none"
                  style={{
                    height: row.height,
                    borderLeft: isPinned ? `3px solid #F59E0B` : `3px solid ${row.color ?? 'transparent'}`,
                    background: isPinned
                      ? `rgba(245,158,11,${Math.max(0, 0.3 - (searchHighlight?.phase ?? 0) * 0.3)})`
                      : undefined,
                    transition: 'background 200ms ease',
                  }}
                >
                  <span
                    className="font-mono font-bold leading-tight"
                    style={{
                      color: palette.text,
                      fontSize: ROW_HEIGHT_LEVELS[rowHeightLevel].fontSize + 2,
                    }}
                  >
                    {row.registration}
                  </span>
                  <span
                    className="font-mono leading-tight truncate"
                    style={{
                      color: palette.textTertiary,
                      fontSize: ROW_HEIGHT_LEVELS[rowHeightLevel].fontSize,
                    }}
                  >
                    {row.aircraftTypeName ?? row.aircraftTypeIcao}
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
            className="absolute inset-0"
            style={{ overflow: 'scroll', zIndex: 1 }}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveDrag}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onMouseLeave={() => setHovered(null)}
            onContextMenu={handleContextMenu}
          >
            <div style={{ width: totalWidth, height: totalHeight }} />
            <div
              ref={rubberbandRef}
              className="absolute pointer-events-none"
              style={{
                display: 'none',
                background: 'rgba(30,64,175,0.08)',
                border: '2px solid rgba(30,64,175,0.35)',
                borderRadius: 2,
                zIndex: 2,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Pairing zone ── */}
      {zoneOpen && <PairingZoneResizer frameHeight={containerHeight} onDragResize={onZoneDragResize} />}
      {/* Overlay: full-width 32px header — rendered as a block-level child of the
          frame flex-col so it naturally spans the full width. When open it sits
          between the resizer and the canvas row; when closed it is the only zone
          element (collapsed chevron). The gridBody calc formula already reserves
          32px for this element (the "+32" term), so it must stay OUTSIDE the
          zoneWrapperRef div. */}
      {zoneOpen ? (
        <>
          <PairingZoneOverlay
            width={ROW_LABEL_W}
            visibleCount={zoneLayout?.visibleCount ?? 0}
            totalCount={zoneLayout?.totalCount ?? 0}
          />
          {/* Canvas row — gutter spacer + canvas. Height = zoneHeightPx (canvas
              area only; the 32px overlay is accounted for separately above). */}
          <div ref={zoneWrapperRef} className="shrink-0 flex" style={{ height: zoneHeightPx }}>
            <div style={{ width: ROW_LABEL_W, flexShrink: 0 }} />
            <div className="flex-1 relative overflow-hidden">
              <canvas ref={zoneCanvasRef} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 0 }} />
              <div
                ref={zoneScrollRef}
                className="absolute inset-0 cursor-pointer"
                style={{ overflowY: 'scroll', overflowX: 'hidden', zIndex: 1 }}
                onScroll={handleZoneScroll}
                onMouseMove={handleZoneMouseMove}
                onMouseLeave={() => setHoveredPairingId(null)}
                onClick={handleZoneClick}
                onContextMenu={handleZoneContextMenu}
              >
                <div
                  style={{
                    width: 1,
                    height: 12 + (zoneLayout?.maxLane ?? 0) * pairingLaneHeight,
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <PairingZoneOverlay
          width={ROW_LABEL_W}
          visibleCount={zoneLayout?.visibleCount ?? 0}
          totalCount={zoneLayout?.totalCount ?? 0}
          collapsed
        />
      )}

      {/* Flight hover tooltip */}
      {hoveredFlight && <FlightTooltipWrapper flightId={hoveredFlightId} mousePosRef={mousePosRef} />}
      {hoveredPairing && <PairingTooltipWrapper pairingId={hoveredPairingId} mousePosRef={mousePosRef} />}

      {/* Context menus */}
      {flightCtxMenu && (
        <FlightContextMenu
          x={flightCtxMenu.x}
          y={flightCtxMenu.y}
          flightId={flightCtxMenu.flightId}
          onClose={() => setFlightCtxMenu(null)}
        />
      )}
      {pairingCtxMenu && (
        <PairingPillContextMenu
          x={pairingCtxMenu.x}
          y={pairingCtxMenu.y}
          pairingId={pairingCtxMenu.pairingId}
          onClose={() => setPairingCtxMenu(null)}
          onShowDetails={(id) => setDetailsPairingId(id)}
          onReplicate={(id) => setReplicatePairingId(id)}
          onBulkDelete={(id) => setBulkDeletePairingId(id)}
          onEdit={(id) => startEditPairing(id)}
          onRequestDelete={(id) => {
            const p = pairings.find((x) => x.id === id)
            if (!p) return
            setPendingDelete({
              id: p.id,
              pairingCode: p.pairingCode,
              legs: p.flightIds.length,
              routeChain: p.routeChain,
            })
          }}
        />
      )}

      {replicatePairingId &&
        (() => {
          const p = pairings.find((x) => x.id === replicatePairingId)
          if (!p) return null
          return <ReplicatePairingDialog source={p} onClose={() => setReplicatePairingId(null)} />
        })()}

      {bulkDeletePairingId &&
        (() => {
          const p = pairings.find((x) => x.id === bulkDeletePairingId)
          if (!p) return null
          return <BulkDeletePairingDialog source={p} onClose={() => setBulkDeletePairingId(null)} />
        })()}

      {detailsPairingId &&
        (() => {
          const p = pairings.find((x) => x.id === detailsPairingId)
          if (!p) return null
          return <PairingDetailsDialogWithCrew pairing={p} onClose={() => setDetailsPairingId(null)} />
        })()}

      {pendingDelete && (
        <DeletePairingDialog
          pairingCode={pendingDelete.pairingCode}
          detail={`${pendingDelete.legs} legs · ${pendingDelete.routeChain}`}
          busy={deleting}
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={async () => {
            setDeleting(true)
            try {
              await api.deletePairing(pendingDelete.id)
              usePairingStore.getState().removePairing(pendingDelete.id)
              setPendingDelete(null)
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to delete pairing'
              usePairingStore.getState().setError(msg)
            } finally {
              setDeleting(false)
            }
          }}
        />
      )}

      <SearchPill />
    </div>
  )
}

/** Wraps `PairingDetailsDialog` with a lazy fetch for the live assigned-
 *  crew roster so 4.1.5.2's dialog shows the same "Crew Assigned" list
 *  that 4.1.6 shows. Fetch runs once per pairingId, cached 30s. */
function PairingDetailsDialogWithCrew({ pairing, onClose }: React.ComponentProps<typeof PairingDetailsDialog>) {
  const { data: assignedCrew } = useAssignedCrewForPairing(pairing.id)
  return <PairingDetailsDialog pairing={pairing} onClose={onClose} assignedCrew={assignedCrew ?? []} />
}

// ── Tooltip wrappers: read PairingFlight / Pairing from pairing-store ──

function FlightTooltipWrapper({
  flightId,
  mousePosRef,
}: {
  flightId: string | null
  mousePosRef: React.MutableRefObject<{ x: number; y: number }>
}) {
  const flights = usePairingStore((s) => s.flights)
  const pairings = usePairingStore((s) => s.pairings)
  const complements = usePairingStore((s) => s.complements)
  const positions = usePairingStore((s) => s.positions)
  const positionFilter = usePairingStore((s) => s.filters.positionFilter)
  const f = flightId ? (flights.find((fl) => fl.id === flightId) ?? null) : null
  if (!f) return null
  const { state, deltas } = computeFlightCoverage({
    flightId: f.id,
    aircraftTypeIcao: f.aircraftType || null,
    pairings,
    complementMaster: complements,
    positionFilter,
    pairingIdHint: f.pairingId ?? null,
  })
  // Order deltas by crew-position rankOrder so the row reads CP → FO → PU → FA.
  const order = new Map(positions.map((p) => [p.code, p.rankOrder]))
  const sortedDeltas = [...deltas].sort((a, b) => (order.get(a.code) ?? 999) - (order.get(b.code) ?? 999))
  return (
    <FlightTooltip
      flight={f}
      clientX={mousePosRef.current.x}
      clientY={mousePosRef.current.y}
      coverageState={state}
      coverageDeltas={sortedDeltas}
    />
  )
}

function PairingTooltipWrapper({
  pairingId,
  mousePosRef,
}: {
  pairingId: string | null
  mousePosRef: React.MutableRefObject<{ x: number; y: number }>
}) {
  const pairings = usePairingStore((s) => s.pairings)
  const p = pairingId ? (pairings.find((pr) => pr.id === pairingId) ?? null) : null
  if (!p) return null
  return <PairingTooltip pairing={p} clientX={mousePosRef.current.x} clientY={mousePosRef.current.y} />
}
