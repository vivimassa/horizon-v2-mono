'use client'

import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EyeOff } from 'lucide-react'
import type { CrewPositionRef } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import type { CrewRowLayout } from '@/lib/crew-schedule/layout'
import { dispatchTargetPicker } from '@/lib/crew-schedule/target-picker-dispatch'

interface Props {
  rows: CrewRowLayout[]
  positions: CrewPositionRef[]
  rowH: number
}

/** 28-day block-hour limit per regulator. V1 fixed value; future work
 *  (P4-alpha) will read from `FdtlRule` for the crew's rule set. */
const BLOCK_LIMIT_28D_MIN = 100 * 60

const LEFT_W = 280
const HEADER_H = 48
const OVERSCAN = 6 // rows rendered above/below viewport for smooth scroll

/**
 * Virtualized crew column for the 4.1.6 Crew Schedule Gantt.
 *
 * Handles 8000+ crew without jank: only rows intersecting the viewport
 * (plus a small overscan buffer) are materialized as DOM nodes; the rest
 * live purely in the JS array. A full-height sizer preserves accurate
 * scrollbar proportions, and the translated inner wrapper scrolls in
 * sync with the canvas via the shared `scrollTop` in the store.
 */
export const CrewScheduleLeftPanel = memo(function CrewScheduleLeftPanel({ rows, positions, rowH }: Props) {
  const selectedCrewId = useCrewScheduleStore((s) => s.selectedCrewId)
  const selectCrew = useCrewScheduleStore((s) => s.selectCrew)
  const scrollTop = useCrewScheduleStore((s) => s.scrollTop)
  const openContextMenu = useCrewScheduleStore((s) => s.openContextMenu)

  const positionsById = useMemo(() => new Map(positions.map((p) => [p._id, p])), [positions])

  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportH, setViewportH] = useState(0)

  // Track the viewport height so virtualization knows how many rows fit.
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    setViewportH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // Compute the slice of crew that actually intersects the viewport.
  const { startIdx, endIdx } = useMemo(() => {
    if (rowH <= 0 || rows.length === 0) return { startIdx: 0, endIdx: 0 }
    const first = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN)
    const last = Math.min(rows.length, Math.ceil((scrollTop + (viewportH || 0)) / rowH) + OVERSCAN)
    return { startIdx: first, endIdx: last }
  }, [scrollTop, viewportH, rowH, rows.length])

  const visibleRows = useMemo(() => rows.slice(startIdx, endIdx), [rows, startIdx, endIdx])
  const totalHeight = rows.length * rowH

  return (
    <div className="shrink-0 border-r border-hz-border/30 flex flex-col overflow-hidden" style={{ width: LEFT_W }}>
      <div
        className="flex items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary border-b border-hz-border/30 shrink-0"
        style={{ height: HEADER_H }}
      >
        Crew · {rows.length.toLocaleString()}
      </div>
      <div ref={viewportRef} className="relative flex-1 min-h-0 overflow-hidden">
        {/* Full-height sizer so the implicit scrollbar proportions are correct
            (the real scroll is driven by the canvas; we just mirror its offset). */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${-scrollTop}px)`, willChange: 'transform' }}>
            {visibleRows.map((row, i) => {
              const absIdx = startIdx + i
              const c = row.crew
              const pos = c.position ? positionsById.get(c.position) : undefined
              const selected = c._id === selectedCrewId
              const isSmartMatch = !!row.smartMatch
              const blockRatio = Math.min(1, row.blockMinutesInPeriod / BLOCK_LIMIT_28D_MIN)
              const isNearLimit = blockRatio >= 0.9
              const isOverLimit = row.blockMinutesInPeriod > BLOCK_LIMIT_28D_MIN
              return (
                <button
                  key={c._id}
                  data-crew-row={c._id}
                  onClick={() => {
                    // When a target-picker mode is active, this click is
                    // the target pick, not a normal selection. Dispatch
                    // and return — dispatch itself clears the mode.
                    if (useCrewScheduleStore.getState().targetPickerMode) {
                      dispatchTargetPicker(c._id)
                      return
                    }
                    selectCrew(c._id)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    selectCrew(c._id)
                    openContextMenu({
                      kind: 'crew-name',
                      crewId: c._id,
                      pageX: e.clientX,
                      pageY: e.clientY,
                    })
                  }}
                  className="absolute left-0 right-0 flex items-center gap-3 px-4 py-0 border-b border-hz-border/20 hover:bg-hz-border/10 text-left"
                  style={{
                    top: absIdx * rowH,
                    height: rowH,
                    backgroundColor: selected
                      ? 'rgba(62,123,250,0.08)'
                      : isSmartMatch
                        ? 'rgba(62,123,250,0.05)'
                        : undefined,
                    borderLeft: selected || isSmartMatch ? '3px solid var(--module-accent)' : '3px solid transparent',
                    paddingLeft: selected || isSmartMatch ? 13 : 16,
                    // `contain: layout style` prevents this row from invalidating
                    // sibling layout during virtual scroll — Chromium uses this
                    // as a strong hint to skip work.
                    contain: 'layout style',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    style={{
                      backgroundColor: pos?.color ? `${pos.color}20` : 'rgba(62,123,250,0.14)',
                      color: pos?.color ?? '#3E7BFA',
                    }}
                  >
                    {(c.firstName[0] ?? '') + (c.lastName[0] ?? '')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate flex items-center gap-1.5">
                      <span className="truncate">
                        {c.lastName} {c.firstName}
                      </span>
                      {c.isScheduleVisible === false && (
                        <EyeOff
                          className="w-3 h-3 shrink-0"
                          style={{ color: '#FF8800' }}
                          aria-label="Schedule hidden from crew mobile app"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-hz-text-secondary truncate tabular-nums">
                      {c.employeeId} · {pos?.code ?? '—'} · {c.baseLabel ?? '—'} · {formatQuals(c)}
                    </div>
                  </div>
                  {/* Block-hour chip — current period total vs 28-day limit
                      (AIMS "Crew Data Window Contents"). Hidden when row is
                      too short (compact zoom) and when the crew has zero
                      block hours to avoid visual noise. */}
                  {rowH >= 44 && row.blockMinutesInPeriod > 0 && (
                    <div className="shrink-0 flex flex-col items-end gap-0.5 pr-1 text-[11px] tabular-nums">
                      <span
                        className="font-semibold"
                        style={{
                          color: isOverLimit ? '#FF3B3B' : isNearLimit ? '#FF8800' : undefined,
                        }}
                      >
                        {fmtHMM(row.blockMinutesInPeriod)}
                      </span>
                      <div
                        className="rounded-full overflow-hidden"
                        style={{
                          width: 40,
                          height: 3,
                          background: 'rgba(125,125,140,0.25)',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, blockRatio * 100)}%`,
                            height: '100%',
                            background: isOverLimit ? '#FF3B3B' : isNearLimit ? '#FF8800' : 'var(--module-accent)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {rows.length === 0 && (
            <div className="p-6 text-[13px] text-hz-text-tertiary text-center">No crew match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  )
})

function formatQuals(c: { acTypes?: string[]; qualifications?: Array<{ aircraftType: string }> }): string {
  const fromQuals = c.qualifications?.map((q) => q.aircraftType).filter(Boolean) ?? []
  const types = c.acTypes?.length ? c.acTypes : fromQuals
  if (!types.length) return '—'
  return [...new Set(types)].sort().join('/')
}

function fmtHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
