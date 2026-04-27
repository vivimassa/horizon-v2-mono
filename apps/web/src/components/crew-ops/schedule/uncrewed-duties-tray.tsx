'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Loader2 } from 'lucide-react'
import type { CrewPositionRef, PairingRef, UncrewedPairingRef } from '@skyhub/api'
import { api, type ApiError } from '@skyhub/api'
import { useCrewScheduleStore, type UncrewedFilterState } from '@/stores/use-crew-schedule-store'
import { buildUncrewedLayout, type UncrewedWorkBar, type UncrewedRestStrip } from '@/lib/crew-schedule/uncrewed-layout'
import type { BarLabelMode, CrewRowLayout } from '@/lib/crew-schedule/layout'
import { computeAssignFromUncrewedLegality } from '@/lib/crew-schedule/drop-legality'
import { checkAssignmentViolations, partitionViolations } from '@/lib/crew-schedule/violations'
import { PairingHoverTooltip } from './pairing-hover-tooltip'

const DRAG_THRESHOLD_PX = 5
const DATE_HEADER_PX = 48

/** Apply the user's uncrewed-duty customization (AIMS §4.4) over the
 *  raw uncrewed list. Filtering is client-side so edits apply instantly
 *  without a re-fetch. */
function applyUncrewedFilter(
  uncrewed: UncrewedPairingRef[],
  pairingsById: Map<string, PairingRef>,
  filter: UncrewedFilterState,
): UncrewedPairingRef[] {
  return uncrewed.filter((u) => {
    const missingTotal = u.missing.reduce((sum, m) => sum + m.count, 0)
    if (missingTotal < filter.minMissingCount) return false
    if (filter.seatCodes.length > 0) {
      const hasAny = u.missing.some((m) => filter.seatCodes.includes(m.seatCode))
      if (!hasAny) return false
    }
    if (filter.baseAirport || filter.aircraftTypeIcao) {
      const p = pairingsById.get(u.pairingId)
      if (!p) return false
      if (filter.baseAirport && p.baseAirport !== filter.baseAirport) return false
      if (filter.aircraftTypeIcao && p.aircraftTypeIcao !== filter.aircraftTypeIcao) return false
    }
    return true
  })
}

/** Visual constants — lane height tuned to fit a 24px pill plus padding. */
const LANE_H = 32
const BAR_H = 24
const HEADER_H = 36
const MAX_LANES = 6

interface Props {
  uncrewed: UncrewedPairingRef[]
  pairingsById: Map<string, PairingRef>
  positionsById: Map<string, CrewPositionRef>
  /** Period start in ms (UTC 00:00 of periodFromIso). Mirrors canvas. */
  periodStartMs: number
  pph: number
  totalWidth: number
  /** Width of the left column that hosts the crew list — the tray
   *  reserves the same gutter so day columns line up with the canvas. */
  leftColumnWidth: number
  /** FDTL scheme — brief/debrief padding around leg-derived duty windows. */
  briefMinutes: number
  debriefMinutes: number
  /** Which label to render inside pills — mirrors the main canvas toolbar. */
  barLabelMode: BarLabelMode
  /** Crew rows in the current canvas layout. Needed for drag-to-assign
   *  hit-testing from the tray. */
  rows: CrewRowLayout[]
  /** Row height px (from `CREW_ROW_HEIGHT_LEVELS[rowHeightLevel]`). */
  rowH: number
}

/**
 * 4.1.6 Crew Schedule — Uncrewed Duties tray.
 *
 * A Gantt-aligned strip that shares the main canvas axis. Each uncrewed
 * pairing renders as:
 *   • QTA (1 duty day, no layover)   → single pill report→release
 *   • Layover pairing (N duty days)  → N pills joined by zebra-hatched
 *                                      rest strips labelled `Rest · XXX`
 *
 * Bars are absolutely positioned DOM nodes (not canvas) so they can carry
 * native click / hover / context-menu semantics. Horizontal scroll is
 * synced with the main canvas via `scrollLeft` in the store (canvas
 * broadcasts on scroll; we mirror imperatively).
 */
export const UncrewedDutiesTray = memo(function UncrewedDutiesTray({
  uncrewed,
  pairingsById,
  positionsById,
  periodStartMs,
  pph,
  totalWidth,
  leftColumnWidth,
  briefMinutes,
  debriefMinutes,
  barLabelMode,
  rows,
  rowH,
}: Props) {
  const selectPairing = useCrewScheduleStore((s) => s.selectPairing)
  const uncrewedLoading = useCrewScheduleStore((s) => s.uncrewedLoading)
  const selectedPairingId = useCrewScheduleStore((s) => s.selectedPairingId)
  const canvasScrollLeft = useCrewScheduleStore((s) => s.scrollLeft)
  const uncrewedFilter = useCrewScheduleStore((s) => s.uncrewedFilter)
  const positions = useCrewScheduleStore((s) => s.positions)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const dragSourcePairingId = useCrewScheduleStore((s) =>
    s.dragState && s.dragState.mode === 'assign-uncrewed' ? s.dragState.pairingId : null,
  )

  const uncrewedTrayHeight = useCrewScheduleStore((s) => s.uncrewedTrayHeight)
  const [hover, setHover] = useState<{ pairingId: string; x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Drag-from-tray state ─────────────────────────────────────────────
  // Mousedown on a WorkBar captures pending info here. Window mousemove
  // crosses the threshold and activates dragState in the store; window
  // mouseup handles the drop (assign + optimistic decrement + API).
  const pendingDragRef = useRef<{
    pairingId: string
    label: string
    startX: number
    startY: number
  } | null>(null)
  const dragActiveRef = useRef(false)
  /** Set to true in the mouseup handler when a drag actually fired. Read
   *  by the WorkBar onClick (which fires AFTER mouseup) to suppress the
   *  selection toggle that would otherwise occur on the source bar. */
  const justDraggedRef = useRef(false)

  const handleBarMouseDown = useCallback((e: ReactMouseEvent, pairingId: string, label: string) => {
    // Only left-click starts a drag; right-click is suppressed elsewhere.
    if (e.button !== 0) return
    pendingDragRef.current = {
      pairingId,
      label,
      startX: e.clientX,
      startY: e.clientY,
    }
  }, [])

  useEffect(() => {
    const storeApi = useCrewScheduleStore
    const getCanvasEl = (): HTMLCanvasElement | null =>
      document.querySelector('canvas[data-crew-canvas]') as HTMLCanvasElement | null

    function resolveTargetCrewId(clientX: number, clientY: number): string | null {
      // 1. DOM crew row in the left panel.
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
      if (el) {
        const row = el.closest('[data-crew-row]') as HTMLElement | null
        if (row) {
          const id = row.getAttribute('data-crew-row')
          if (id) return id
        }
      }
      // 2. Canvas hit-test via bounding rect + store scrollTop + layout rows.
      const canvas = getCanvasEl()
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return null
      }
      const scrollTop = storeApi.getState().scrollTop
      const contentY = clientY - rect.top + scrollTop - DATE_HEADER_PX
      if (contentY < 0) return null
      const idx = Math.floor(contentY / rowH)
      if (idx < 0 || idx >= rows.length) return null
      return rows[idx].crewId
    }

    const onMove = (ev: MouseEvent) => {
      const pending = pendingDragRef.current
      const s = storeApi.getState()
      const active = s.dragState && s.dragState.mode === 'assign-uncrewed'

      if (pending && !active) {
        const dx = ev.clientX - pending.startX
        const dy = ev.clientY - pending.startY
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
        // Cross threshold — activate drag.
        const u = storeApi.getState().uncrewed.find((x) => x.pairingId === pending.pairingId)
        const missing = u ? u.missing.map((m) => ({ ...m })) : []
        s.setDragState({
          sourceAssignmentId: null,
          sourceCrewId: null,
          pairingId: pending.pairingId,
          ghostLabel: pending.label,
          cursorX: ev.clientX,
          cursorY: ev.clientY,
          dropCrewId: null,
          dropLegality: null,
          dropReason: '',
          mode: 'assign-uncrewed',
          sourceMissingSeats: missing,
        })
        dragActiveRef.current = true
        document.body.style.userSelect = 'none'
        return
      }

      if (!active) return

      // Drag active — resolve drop target + legality.
      const targetCrewId = resolveTargetCrewId(ev.clientX, ev.clientY)
      const dragging = s.dragState!
      if (!targetCrewId) {
        s.setDragState({
          ...dragging,
          cursorX: ev.clientX,
          cursorY: ev.clientY,
          dropCrewId: null,
          dropLegality: null,
          dropReason: 'Release over a crew row',
        })
        document.body.style.cursor = 'not-allowed'
        return
      }
      const positionsById = new Map(s.positions.map((p) => [p._id, p]))
      const pairingsById = new Map(s.pairings.map((p) => [p._id, p]))
      const pairing = pairingsById.get(dragging.pairingId)
      const targetCrew = s.crew.find((c) => c._id === targetCrewId)
      if (!pairing || !targetCrew) {
        s.setDragState({
          ...dragging,
          cursorX: ev.clientX,
          cursorY: ev.clientY,
          dropCrewId: targetCrewId,
          dropLegality: 'violation',
          dropReason: 'Unknown crew or pairing',
        })
        return
      }
      const legality = computeAssignFromUncrewedLegality({
        targetCrew,
        pairing,
        missingSeats: dragging.sourceMissingSeats ?? [],
        positionsById,
        assignments: s.assignments,
        pairingsById,
        activities: s.activities,
        activityCodes: s.activityCodes,
        ruleSet: s.ruleSet,
      })
      s.setDragState({
        ...dragging,
        cursorX: ev.clientX,
        cursorY: ev.clientY,
        dropCrewId: targetCrewId,
        dropLegality: legality.level,
        dropReason: legality.reason,
        dropChecks: legality.checks,
        dropOverridable: legality.overridable ?? false,
      })
      document.body.style.cursor = legality.level === 'violation' ? 'not-allowed' : 'grabbing'
    }

    const onUp = (ev: MouseEvent) => {
      const s = storeApi.getState()
      const dragging = s.dragState
      const wasActive = dragActiveRef.current
      pendingDragRef.current = null
      dragActiveRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (!wasActive || !dragging || dragging.mode !== 'assign-uncrewed') {
        return
      }
      justDraggedRef.current = true
      setTimeout(() => {
        justDraggedRef.current = false
      }, 0)
      // Resolve final target + legality.
      const targetCrewId = resolveTargetCrewId(ev.clientX, ev.clientY)
      s.clearDragState()
      if (!targetCrewId) return
      const pairing = s.pairings.find((p) => p._id === dragging.pairingId)
      const targetCrew = s.crew.find((c) => c._id === targetCrewId)
      if (!pairing || !targetCrew) return
      const positionsById = new Map(s.positions.map((p) => [p._id, p]))
      const pairingsById = new Map(s.pairings.map((p) => [p._id, p]))
      const legality = computeAssignFromUncrewedLegality({
        targetCrew,
        pairing,
        missingSeats: dragging.sourceMissingSeats ?? [],
        positionsById,
        assignments: s.assignments,
        pairingsById,
        activities: s.activities,
        activityCodes: s.activityCodes,
        ruleSet: s.ruleSet,
      })
      // Hard block only. FDTL violations overridable — proceed to assign
      // (server records override audit row).
      if ((legality.level === 'violation' && !legality.overridable) || !legality.pickedSeat) {
        storeApi.getState().setDropRejection(legality.reason ? `Drop rejected — ${legality.reason}` : 'Drop rejected')
        return
      }

      const pickedSeat = legality.pickedSeat

      // Reusable API-call + optimistic-apply closure. Runs either
      // immediately (no violations) or after the planner confirms via
      // the AssignmentOverrideDialog.
      const performAssign = async (
        overrides: import('@/lib/crew-schedule/violations').AssignmentViolation[],
        ack?: { reason: string; commanderDiscretion: boolean },
      ) => {
        const optimisticId = `__optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const startUtcIso =
          pairing.reportTime ??
          (pairing.legs[0]
            ? new Date(new Date(pairing.legs[0].stdUtcIso).getTime() - 90 * 60_000).toISOString()
            : `${pairing.startDate}T00:00:00.000Z`)
        const lastLeg = pairing.legs[pairing.legs.length - 1]
        const endUtcIso = lastLeg
          ? new Date(new Date(lastLeg.staUtcIso).getTime() + 30 * 60_000).toISOString()
          : `${pairing.endDate}T23:59:00.000Z`
        const nowIso = new Date().toISOString()
        const synthetic = {
          _id: optimisticId,
          operatorId: targetCrew.operatorId,
          scenarioId: null,
          pairingId: pairing._id,
          crewId: targetCrew._id,
          seatPositionId: pickedSeat.seatPositionId,
          seatIndex: pickedSeat.seatIndex,
          status: 'planned' as const,
          startUtcIso,
          endUtcIso,
          assignedByUserId: null,
          assignedAtUtc: nowIso,
          legalityResult: null,
          lastLegalityCheckUtcIso: null,
          notes: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
        storeApi.getState().applyOptimisticAssignFromUncrewed({
          pairingId: pairing._id,
          seatPositionId: pickedSeat.seatPositionId,
          synthetic,
        })
        try {
          await api.createCrewAssignment({
            pairingId: pairing._id,
            crewId: targetCrew._id,
            seatPositionId: pickedSeat.seatPositionId,
            seatIndex: pickedSeat.seatIndex,
            status: 'planned',
            overrides:
              overrides.length > 0
                ? overrides.map((v) => ({
                    violationKind: v.kind,
                    messageSnapshot: v.message,
                    detail: { ...(v.detail ?? {}), commanderDiscretion: !!ack?.commanderDiscretion },
                    reason: ack?.reason ?? null,
                  }))
                : undefined,
          })
          void storeApi.getState().reconcilePeriod()
        } catch (err) {
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
            storeApi.getState().setCapacityError({
              seatCode: payload.seatCode,
              capacity: payload.capacity,
              attemptedIndex: payload.attemptedIndex,
              pairingCode: payload.pairingCode ?? null,
            })
            void storeApi.getState().reconcilePeriod()
            return
          }
          console.error('Assign-from-uncrewed failed:', err)
          void storeApi.getState().reconcilePeriod()
        }
      }

      // Check rule violations BEFORE the optimistic apply. Hard-blocks
      // (e.g. AC type not qualified) abort with an OK-only dialog — no
      // API call. Overridables park on the store for the override dialog.
      const storeState = storeApi.getState()
      const aircraftTypes = storeState.aircraftTypes
      const tempBases = storeState.tempBases.filter((t) => t.crewId === targetCrew._id)
      const violations = checkAssignmentViolations({
        crew: targetCrew,
        pairing,
        aircraftTypes,
        tempBases,
        assignments: storeState.assignments,
        activities: storeState.activities,
        activityCodes: storeState.activityCodes,
        pairings: storeState.pairings,
        flightBookings: storeState.flightBookings,
        ruleSet: storeState.ruleSet,
      })
      // Drag-drop: drop feedback was already shown inline via the
      // Legality Check panel. Abort without a dialog, but surface a
      // brief toast so the planner gets feedback that the drop did
      // NOT take effect (otherwise "nothing happens" is confusing).
      const { hardBlocks, overridable } = partitionViolations(violations)
      if (hardBlocks.length > 0) {
        storeApi.getState().setDropRejection(`Drop rejected — ${hardBlocks[0].message || hardBlocks[0].title}`)
        return
      }
      // Overridable (FDTL warnings / base mismatch) → proceed with the
      // assign. Server persists the overrides as audit rows. User saw the
      // reasons inline via the drag-time Legality Check panel.
      void performAssign(overridable)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = storeApi.getState()
      if (s.dragState && s.dragState.mode === 'assign-uncrewed') {
        s.clearDragState()
        pendingDragRef.current = null
        dragActiveRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup', onUp, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mouseup', onUp, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [rows, rowH])

  // AIMS §4.4 customization — filter the raw list BEFORE layout so lanes
  // only account for bars the user wants to see.
  const filteredUncrewed = useMemo(
    () => applyUncrewedFilter(uncrewed, pairingsById, uncrewedFilter),
    [uncrewed, pairingsById, uncrewedFilter],
  )
  const filterActive =
    uncrewedFilter.seatCodes.length > 0 ||
    !!uncrewedFilter.baseAirport ||
    !!uncrewedFilter.aircraftTypeIcao ||
    uncrewedFilter.minMissingCount > 1

  const layout = useMemo(
    () =>
      buildUncrewedLayout({
        uncrewed: filteredUncrewed,
        pairingsById,
        periodStartMs,
        pph,
        totalWidth,
        // No lane cap — every pairing renders. User scrolls vertically
        // within the store-driven tray height; resizer lets them grow it.
        maxLanes: 9999,
        briefMinutes,
        debriefMinutes,
        barLabelMode,
      }),
    [filteredUncrewed, pairingsById, periodStartMs, pph, totalWidth, briefMinutes, debriefMinutes, barLabelMode],
  )

  // Sync horizontal scroll from main canvas → tray. One-way: the tray
  // tracks the canvas. We don't push tray-scroll back so wheel events on
  // the tray strip (which shouldn't normally happen — it's narrow) stay
  // local. Canvas remains the source of truth.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollLeft !== canvasScrollLeft) el.scrollLeft = canvasScrollLeft
  }, [canvasScrollLeft])

  // Total height of the bars-region (doesn't include the 36px header).
  const HEADER_PX = 36
  const barsAreaHeight = Math.max(LANE_H, uncrewedTrayHeight - HEADER_PX)
  const contentHeight = layout.lanes * LANE_H + 8

  return (
    <div
      data-uncrewed-tray
      className="bg-white dark:bg-[#191921] border-t border-[#E4E4EB] dark:border-white/[0.06] shrink-0 flex flex-col"
      style={{ height: uncrewedTrayHeight }}
    >
      {/* Header strip — fixed height, doesn't scroll. */}
      <div className="flex items-center h-9 border-b border-[#E4E4EB] dark:border-white/[0.06] shrink-0">
        <div
          className="flex items-center h-full px-4 text-[13px] font-semibold uppercase tracking-wider text-[#6B6C7B] dark:text-[#A7A9B5]"
          style={{ width: leftColumnWidth }}
        >
          <span
            className="mr-2 inline-block w-[3px] h-[14px] rounded-sm"
            style={{ backgroundColor: 'var(--module-accent, #3E7BFA)' }}
          />
          Uncrewed ·{' '}
          {uncrewedLoading ? (
            <span className="inline-flex items-center gap-1.5 ml-0.5">
              <Loader2 size={12} className="animate-spin text-[#9A9BA8]" />
              <span className="text-[#9A9BA8] normal-case tracking-normal text-[12px]">Loading…</span>
            </span>
          ) : filterActive && filteredUncrewed.length !== uncrewed.length ? (
            `${filteredUncrewed.length} / ${uncrewed.length}`
          ) : (
            uncrewed.length
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0" style={{ height: barsAreaHeight }}>
        {/* Left gutter keeps the tray aligned with the crew-list column. */}
        <div
          className="shrink-0 border-r border-[#E4E4EB] dark:border-white/[0.06]"
          style={{ width: leftColumnWidth }}
        />
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto relative">
          <div className="relative" style={{ width: totalWidth, height: contentHeight }}>
            {uncrewedLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-black/30 backdrop-blur-[1px] text-[13px] text-[#A7A9B5]">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading uncrewed duties…</span>
              </div>
            )}
            {!uncrewedLoading && filteredUncrewed.length === 0 && (
              <div className="absolute inset-0 flex items-center px-3 text-[13px] text-[#9A9BA8]">
                {uncrewed.length === 0 ? 'No uncrewed duties.' : 'No uncrewed duties match the current filter.'}
              </div>
            )}
            {/* Rest strips first so work pills paint on top. */}
            {layout.restStrips.map((rs) => (
              <RestStripBar key={rs.key} rs={rs} laneY={rs.laneIndex * LANE_H + (LANE_H - BAR_H) / 2} />
            ))}
            {layout.workBars.map((wb) => {
              const isSelected = selectedPairingId === wb.pairingId
              const y = wb.laneIndex * LANE_H + (LANE_H - BAR_H) / 2
              return (
                <WorkBar
                  key={wb.key}
                  wb={wb}
                  y={y}
                  isSelected={isSelected}
                  isDragSource={dragSourcePairingId === wb.pairingId}
                  onSelect={() => {
                    if (justDraggedRef.current) return
                    selectPairing(wb.pairingId)
                  }}
                  onMouseDown={(e) => handleBarMouseDown(e, wb.pairingId, wb.label)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                  }}
                  onHoverEnter={(e) => setHover({ pairingId: wb.pairingId, x: e.clientX, y: e.clientY })}
                  onHoverMove={(e) => setHover({ pairingId: wb.pairingId, x: e.clientX, y: e.clientY })}
                  onHoverLeave={() => setHover(null)}
                />
              )
            })}
          </div>
        </div>
      </div>
      {hover &&
        (() => {
          const p = pairingsById.get(hover.pairingId)
          if (!p) return null
          return (
            <PairingHoverTooltip
              pairing={p}
              positions={positions}
              assignments={assignments}
              clientX={hover.x}
              clientY={hover.y}
            />
          )
        })()}
    </div>
  )
})

/** Single work-day pill. Accent-tinted fill with accent border, the
 *  currently-toggled label (pairing code / sector / flight number) centered
 *  inside. No chips, no dots — crew complement and missing-seat details
 *  live in the hover tooltip. */
function WorkBar({
  wb,
  y,
  isSelected,
  isDragSource,
  onSelect,
  onMouseDown,
  onContextMenu,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
}: {
  wb: UncrewedWorkBar
  y: number
  isSelected: boolean
  isDragSource: boolean
  onSelect: () => void
  onMouseDown: (e: ReactMouseEvent) => void
  onContextMenu: (e: ReactMouseEvent) => void
  onHoverEnter: (e: ReactMouseEvent) => void
  onHoverMove: (e: ReactMouseEvent) => void
  onHoverLeave: () => void
}) {
  const showLabel = wb.width >= 44
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onMouseEnter={onHoverEnter}
      onMouseMove={onHoverMove}
      onMouseLeave={onHoverLeave}
      className="absolute flex items-center justify-center px-2 rounded-[5px] border text-left transition-colors hover:brightness-110"
      style={{
        transform: `translate3d(${wb.x}px, ${y}px, 0)`,
        width: wb.width,
        height: BAR_H,
        backgroundColor: 'rgba(62,123,250,0.12)',
        borderColor: isSelected ? 'var(--module-accent, #3E7BFA)' : 'rgba(62,123,250,0.45)',
        boxShadow: isSelected ? '0 0 0 2px rgba(62,123,250,0.35)' : undefined,
        cursor: isDragSource ? 'grabbing' : 'grab',
        opacity: isDragSource ? 0.55 : 1,
      }}
    >
      {showLabel && (
        <span
          className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis tabular-nums"
          style={{ color: 'var(--module-accent, #3E7BFA)' }}
        >
          {wb.label}
        </span>
      )}
    </button>
  )
}

/** Zebra-hatched rest strip between two work days. Label `Rest · XXX`
 *  is centered when space allows. */
function RestStripBar({ rs, laneY }: { rs: UncrewedRestStrip; laneY: number }) {
  const showLabel = rs.width >= 60
  return (
    <div
      className="absolute flex items-center justify-center rounded-[6px] border pointer-events-none"
      style={{
        transform: `translate3d(${rs.x}px, ${laneY}px, 0)`,
        width: rs.width,
        height: BAR_H,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(142,142,160,0.22) 0 6px, rgba(142,142,160,0) 6px 12px)',
        backgroundColor: 'rgba(142,142,160,0.06)',
        borderColor: 'rgba(142,142,160,0.28)',
      }}
    >
      {showLabel && (
        <span className="text-[13px] font-medium text-[#6B6C7B] dark:text-[#A7A9B5] whitespace-nowrap overflow-hidden text-ellipsis px-2">
          {rs.label}
        </span>
      )}
    </div>
  )
}

// HEADER_H exposed for future callers that compute total tray height.
export const UNCREWED_TRAY_HEADER_H = HEADER_H
