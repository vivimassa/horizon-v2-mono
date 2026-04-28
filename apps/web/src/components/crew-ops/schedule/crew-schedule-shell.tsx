'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, type CrewFlightBookingRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { buildCrewScheduleLayout } from '@/lib/crew-schedule/layout'
import { CrewScheduleFilterPanel } from './crew-schedule-filter-panel'
import { CrewScheduleRibbonToolbar } from './crew-schedule-ribbon-toolbar'
import { CrewScheduleCanvas } from './crew-schedule-canvas'
import { CrewScheduleLeftPanel } from './crew-schedule-left-panel'
import { CrewScheduleRightPanel } from './crew-schedule-right-panel'
import { CrewScheduleContextMenu } from './crew-schedule-context-menu'
import { CrewScheduleDialogs } from './crew-schedule-dialogs'
import { CrewScheduleSwapOverlay } from './crew-schedule-swap-overlay'
import { TargetPickerBanner } from './target-picker-banner'
import { CrewOnPairingDialog } from './dialogs/crew-on-pairing-dialog'
import { AssignmentOverrideDialogHost } from './dialogs/assignment-override-dialog-host'
import { AssignmentBlockedDialogHost } from './dialogs/assignment-blocked-dialog-host'
import { LegalityCheckDialogHost } from './dialogs/legality-check-dialog-host'
import { PairingDetailsDialogHost } from './dialogs/pairing-details-dialog-host'
import { DateTotalsDialog } from './dialogs/date-totals-dialog'
import { LegalityReportDialog } from './dialogs/legality-report-dialog'
import { TemporaryBaseDialog } from './dialogs/temporary-base-dialog'
import { FlightBookingDrawer } from '@/components/crew-ops/transport/views/flight-booking-drawer'
import { CrewScheduleCheatsheet } from './crew-schedule-cheatsheet'
import { CrewScheduleCommandPalette } from './crew-schedule-command-palette'
import { CrewScheduleSearch } from './crew-schedule-search'
import { CrewScheduleSmartFilter } from './crew-schedule-smart-filter'
import { DialogShell } from './dialogs/dialog-shell'
import { BulkDeleteHero } from './dialogs/dialog-heroes'
import { CrewScheduleMemoOverlay } from './crew-schedule-memo-overlay'
import { CrewSchedulePublishBanner } from './crew-schedule-publish-banner'
import { UncrewedDutiesTray } from './uncrewed-duties-tray'
import { UncrewedTrayResizer } from './uncrewed-tray-resizer'

/**
 * Module 4.1.6 Crew Schedule — shell.
 *
 * Layout mirrors 2.1.1 Movement Control (`movement-control-shell.tsx`):
 *   • Outer: flex with p-3 gap-3, optional fullscreen bg.
 *   • Left:  collapsible FilterPanel dock (drafts local, commits on Go).
 *   • Right column:
 *       – Glass-wrapped ribbon toolbar (hidden before first Go).
 *       – Glass canvas region with EmptyPanel / RunwayLoadingPanel /
 *         the actual Gantt + left crew column + bottom uncrewed tray.
 *       – Right inspector overlay (Duty / Assign / Bio / Expiry).
 *
 * Data flow: filter panel sets committed store values on Go → shell
 * calls `commitPeriod()` wrapped in `useRunwayLoading` → store
 * populates pairings/crew/assignments → canvas + tray + inspector
 * read from store. Nothing reacts to filter drafts.
 */
export function CrewScheduleShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const periodCommitted = useCrewScheduleStore((s) => s.periodCommitted)
  const loading = useCrewScheduleStore((s) => s.loading)
  const error = useCrewScheduleStore((s) => s.error)
  const rightPanelOpen = useCrewScheduleStore((s) => s.rightPanelOpen)
  const commitPeriod = useCrewScheduleStore((s) => s.commitPeriod)
  const loadContext = useCrewScheduleStore((s) => s.loadContext)

  // Data for layout + children
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const crew = useCrewScheduleStore((s) => s.crew)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const positions = useCrewScheduleStore((s) => s.positions)
  const uncrewed = useCrewScheduleStore((s) => s.uncrewed)
  const activities = useCrewScheduleStore((s) => s.activities)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const activityGroups = useCrewScheduleStore((s) => s.activityGroups)
  const memos = useCrewScheduleStore((s) => s.memos)
  const fdtl = useCrewScheduleStore((s) => s.fdtl)
  const aircraftTypes = useCrewScheduleStore((s) => s.aircraftTypes)
  const displayOffsetHours = useCrewScheduleStore((s) => s.displayOffsetHours)
  const publishedOverlay = useCrewScheduleStore((s) => s.publishedOverlay)
  const publishedOverlayVisible = useCrewScheduleStore((s) => s.publishedOverlayVisible)
  const uncrewedTrayVisible = useCrewScheduleStore((s) => s.uncrewedTrayVisible)
  const periodFrom = useCrewScheduleStore((s) => s.periodFromIso)
  const periodTo = useCrewScheduleStore((s) => s.periodToIso)
  const zoom = useCrewScheduleStore((s) => s.zoom)
  const barLabelMode = useCrewScheduleStore((s) => s.barLabelMode)
  const filters = useCrewScheduleStore((s) => s.filters)
  const containerWidth = useCrewScheduleStore((s) => s.containerWidth)
  const rowHeightLevel = useCrewScheduleStore((s) => s.rowHeightLevel)
  const excludedCrewIds = useCrewScheduleStore((s) => s.excludedCrewIds)
  const smartFilter = useCrewScheduleStore((s) => s.smartFilter)
  const crewGrouping = useCrewScheduleStore((s) => s.crewGrouping)

  const runway = useRunwayLoading()
  const shellRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameHeight, setFrameHeight] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [smartFilterOpen, setSmartFilterOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Track the canvas-plus-tray frame height so the resizer can clamp the
  // tray growth. Uses ResizeObserver so it tracks fullscreen toggles too.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    setFrameHeight(el.clientHeight)
    const ro = new ResizeObserver(() => setFrameHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [periodCommitted])

  const toggleFullscreen = useCallback(() => {
    if (!shellRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      shellRef.current.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Load airport + aircraft-type context once (populates filter dropdowns).
  useEffect(() => {
    loadContext()
  }, [loadContext])

  const handleGo = useCallback(async () => {
    // Scope the calibration bucket by the filter shape — a 1-crew
    // Specific Crew Search resolves in ~50ms whereas a full-roster
    // load can take 30s+. Sharing one median across both makes the bar
    // creep with a 30s shape on a 50ms request, which feels broken.
    const f = useCrewScheduleStore.getState().filters
    const narrowed =
      f.baseIds.length === 1 || f.positionIds.length === 1 || f.acTypeIcaos.length === 1 || f.crewGroupIds.length === 1
    const scope: 'specific' | 'narrow' | 'full' =
      f.specificCrewTokens.length > 0 ? 'specific' : narrowed ? 'narrow' : 'full'
    const expectedByScope = { specific: 1_000, narrow: 5_000, full: 30_000 } as const
    await runway.run(() => commitPeriod(), {
      loadingLabel: 'Loading crew schedule…',
      doneLabel: 'Schedule loaded',
      loadKey: `crew-schedule:${scope}`,
      expectedMs: expectedByScope[scope],
    })
  }, [runway, commitPeriod])

  // Post-mutation refresh — debounced full reconcile. Mutation sites
  // that know which crew they touched already call `reconcileCrew`
  // (narrow, ~50ms). The full reconcile is the safety net for cascade
  // effects + any site that didn't pre-narrow. Without debounce a burst
  // of 5 mutations would queue 5 × 51s aggregator scans on M0 Atlas.
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleRefresh = useCallback(() => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current)
    reconcileTimerRef.current = setTimeout(() => {
      reconcileTimerRef.current = null
      void reconcilePeriod()
    }, 30_000)
  }, [reconcilePeriod])

  // Global shortcuts (Delete / `?` / `Ctrl+K`). Every input/textarea
  // is exempt so we don't hijack typing. `?` is `Shift+/` on most
  // layouts so we check either `e.key === '?'` or the explicit combo.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      // `?` → open cheatsheet.
      if (!typing && (e.key === '?' || (e.key === '/' && e.shiftKey))) {
        e.preventDefault()
        setCheatsheetOpen(true)
        return
      }

      // Ctrl+K / ⌘K → command palette. Allowed even when typing so
      // planners can trigger it from any focus — matches VS Code etc.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      // Ctrl+F / ⌘F → toggle Search panel (matches 2.1.1 Movement
      // Control). Allowed even when typing so the field-bound input
      // doesn't have to lose focus first.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return
      }

      // Ctrl+C / ⌘C → copy selected activity into the Gantt clipboard.
      // Skip when typing so the planner can still copy text from inputs.
      if (!typing && (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        const st = useCrewScheduleStore.getState()
        if (st.selectedActivityId) {
          e.preventDefault()
          st.copyActivityToClipboard(st.selectedActivityId)
        }
        return
      }

      // Ctrl+X / ⌘X → cut. Buffers the selected activity AND deletes
      // the source on the next successful paste. Esc cancels (source
      // stays). Skip when typing so the planner can still cut text in
      // inputs.
      if (!typing && (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        const st = useCrewScheduleStore.getState()
        if (st.selectedActivityId) {
          e.preventDefault()
          st.cutActivityToClipboard(st.selectedActivityId)
        }
        return
      }

      // Esc → clear the Gantt clipboard. The canvas already has its own
      // Esc handler for drag/range/swap state; that one runs first via
      // a separate listener, so we only act when nothing else is active.
      if (!typing && e.key === 'Escape') {
        const st = useCrewScheduleStore.getState()
        if (
          st.clipboardActivity &&
          !st.dragState &&
          !st.swapPicker &&
          !st.targetPickerMode &&
          !st.rangeSelection &&
          !st.contextMenu
        ) {
          st.clearClipboard()
        }
        return
      }

      // Ctrl+V / ⌘V → paste buffered activity onto the current
      // selection: range > single empty cell. No-op when no clipboard
      // or no target. Skip when typing.
      if (!typing && (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        const st = useCrewScheduleStore.getState()
        if (!st.clipboardActivity) return
        if (st.rangeSelection && st.rangeSelection.crewIds.length > 0) {
          e.preventDefault()
          const targets = expandRangeToCells(st.rangeSelection)
          void st.pasteClipboardToCells(targets)
          return
        }
        if (st.selectedCrewId && st.selectedDateIso) {
          e.preventDefault()
          void st.pasteClipboardToCells([{ crewId: st.selectedCrewId, dateIso: st.selectedDateIso }])
          return
        }
        return
      }

      // Ctrl+Shift+P / ⌘⇧P → toggle the "Compare to Published" overlay
      // (AIMS F10 — F10 itself is grabbed by Chromium on Linux/Win).
      if (!typing && (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        void useCrewScheduleStore.getState().togglePublishedOverlay()
        return
      }

      // Delete shortcut — Delete / Backspace + Shift+Delete (explicit,
      // browser-conflict-free). Every Ctrl+letter and Ctrl+Shift+letter
      // combo on letter D is intercepted by Chrome/Edge for bookmark
      // actions before the page gets the keydown — Shift+Delete is the
      // one that survives.
      const isDeleteShortcut =
        !typing && (e.key === 'Delete' || e.key === 'Backspace' || (e.shiftKey && e.key === 'Delete'))
      if (isDeleteShortcut) {
        e.preventDefault()
        const s = useCrewScheduleStore.getState()
        console.log('[delete] key fired', {
          via: e.key,
          rangeSelection: s.rangeSelection ? s.rangeSelection.crewIds.length + ' crew' : null,
          selectedActivityId: s.selectedActivityId,
          selectedAssignmentId: s.selectedAssignmentId,
          selectedPairingId: s.selectedPairingId,
          selectedCrewId: s.selectedCrewId,
          selectedDateIso: s.selectedDateIso,
        })
        // Optimistic IDs (client-only, never persisted) shouldn't be
        // shipped to the server — would 404 or surface "Failed to fetch"
        // in the Next.js dev overlay. Filter them out everywhere below.
        const isOptimistic = (id: string) => id.startsWith('__optimistic_')
        const safeReconcile = () => {
          s.reconcilePeriod().catch(() => {
            /* silent — next natural refresh will resync */
          })
        }
        // Range selection wins over single-item selection: deleting a
        // shift-drag block wipes every activity + assignment inside.
        if (s.rangeSelection) {
          e.preventDefault()
          const { crewIds, fromIso, toIso } = s.rangeSelection
          const crewIdSet = new Set(crewIds)
          const acts = s.activities.filter(
            (a) =>
              !isOptimistic(a._id) &&
              crewIdSet.has(a.crewId) &&
              a.startUtcIso.slice(0, 10) <= toIso &&
              a.endUtcIso.slice(0, 10) >= fromIso,
          )
          const asgs = s.assignments.filter(
            (a) =>
              !isOptimistic(a._id) &&
              crewIdSet.has(a.crewId) &&
              a.startUtcIso.slice(0, 10) <= toIso &&
              a.endUtcIso.slice(0, 10) >= fromIso,
          )
          if (acts.length === 0 && asgs.length === 0) {
            s.clearRangeSelection()
            return
          }
          // Multi-day or multi-crew → confirm dialog. Single-cell
          // ranges (1 crew × 1 day) skip the prompt and behave like a
          // single-item delete.
          const dayMs = 86_400_000
          const fromMs = Date.parse(`${fromIso}T00:00:00Z`)
          const toMs = Date.parse(`${toIso}T00:00:00Z`)
          const dayCount =
            Number.isFinite(fromMs) && Number.isFinite(toMs) ? Math.round((toMs - fromMs) / dayMs) + 1 : 1
          const isBulk = dayCount > 1 || crewIds.length > 1
          if (isBulk) {
            useCrewScheduleStore.setState({
              pendingBlockDelete: {
                activityIds: acts.map((a) => a._id),
                assignmentIds: asgs.map((a) => a._id),
                crewCount: crewIds.length,
                dayCount,
              },
            })
            // Don't clear range yet — confirm path needs it for the
            // post-delete safeReconcile sweep. Cancel path also leaves
            // the range so the planner can adjust the selection.
            return
          }
          const requests = [
            ...acts.map((a) => ({ kind: 'activity' as const, id: a._id, fn: () => api.deleteCrewActivity(a._id) })),
            ...asgs.map((a) => ({
              kind: 'assignment' as const,
              id: a._id,
              fn: () => api.deleteCrewAssignment(a._id),
            })),
          ]
          const results = await Promise.allSettled(requests.map((r) => r.fn()))
          // Build the "definitely gone" set for the optimistic strip:
          //   - status === 'fulfilled'        → server actually deleted
          //   - status === 'rejected' + 404   → server says already gone
          // Both outcomes mean the local bar should disappear NOW; the
          // alternative (waiting on the 30-50s reconcile sweep) was the
          // bug where a successful first Delete looked like a no-op.
          const failures: Array<{
            kind: 'activity' | 'assignment'
            id: string
            status: number | null
            message: string
            payload: unknown
          }> = []
          const goneActivityIds = new Set<string>()
          const goneAssignmentIds = new Set<string>()
          for (let i = 0; i < results.length; i++) {
            const r = results[i]
            const req = requests[i]
            if (r.status === 'fulfilled') {
              if (req.kind === 'activity') goneActivityIds.add(req.id)
              else goneAssignmentIds.add(req.id)
              continue
            }
            const err = r.reason as { message?: string; status?: number; payload?: unknown }
            const status = err?.status ?? null
            failures.push({
              kind: req.kind,
              id: req.id,
              status,
              message: err?.message ?? String(r.reason),
              payload: err?.payload ?? null,
            })
            if (status === 404) {
              if (req.kind === 'activity') goneActivityIds.add(req.id)
              else goneAssignmentIds.add(req.id)
            }
          }
          if (failures.length > 0) {
            console.error('Block delete: %d/%d failed', failures.length, results.length, failures)
          }
          if (goneActivityIds.size > 0 || goneAssignmentIds.size > 0) {
            useCrewScheduleStore.setState((st) => ({
              activities: st.activities.filter((a) => !goneActivityIds.has(a._id)),
              assignments: st.assignments.filter((a) => !goneAssignmentIds.has(a._id)),
            }))
          }
          s.clearRangeSelection()
          safeReconcile()
        } else if (s.selectedActivityId) {
          e.preventDefault()
          const id = s.selectedActivityId
          if (isOptimistic(id)) {
            s.selectActivity(null)
            return
          }
          let serverGone = true
          try {
            await api.deleteCrewActivity(id)
          } catch (err) {
            const status = (err as { status?: number })?.status
            // 404 = already deleted on server (e.g. previous click succeeded
            // but the reconcile that follows it silently failed). Treat as
            // success and let the optimistic strip below clear the bar.
            if (status !== 404) {
              serverGone = false
              console.error('Failed to delete activity:', err)
            }
          }
          if (serverGone) {
            // Optimistic local strip — guarantees the bar disappears even
            // when the follow-up reconcile fails (server bouncing / network
            // blip). Reconcile still fires to catch any cascading changes
            // (FDTL re-eval, pairing crewCounts, etc.).
            useCrewScheduleStore.setState((st) => ({
              activities: st.activities.filter((a) => a._id !== id),
            }))
          }
          s.selectActivity(null)
          safeReconcile()
        } else if (s.selectedAssignmentId) {
          e.preventDefault()
          const id = s.selectedAssignmentId
          if (isOptimistic(id)) {
            s.selectAssignment(null)
            return
          }
          let serverGone = true
          try {
            await api.deleteCrewAssignment(id)
          } catch (err) {
            const status = (err as { status?: number })?.status
            if (status !== 404) {
              serverGone = false
              console.error('Failed to delete assignment:', err)
            }
          }
          if (serverGone) {
            useCrewScheduleStore.setState((st) => ({
              assignments: st.assignments.filter((a) => a._id !== id),
            }))
          }
          s.selectAssignment(null)
          safeReconcile()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commitPeriod])

  // Build layout when data or view-state changes.
  const computedLayout = useMemo(() => {
    if (!periodCommitted || crew.length === 0) return null
    return buildCrewScheduleLayout({
      crew,
      pairings,
      assignments,
      activities,
      activityCodes,
      activityGroups,
      memos,
      periodFromIso: periodFrom,
      periodToIso: periodTo,
      containerWidth: containerWidth || 1200,
      zoom,
      barLabelMode,
      filters,
      rowHeightLevel,
      excludedCrewIds,
      smartFilter,
      publishedSnapshotAssignments:
        publishedOverlayVisible && publishedOverlay ? publishedOverlay.assignments : undefined,
      positions,
      grouping: crewGrouping ?? undefined,
      restRules: fdtl.restRules,
      aircraftTypes,
      displayOffsetHours,
    })
  }, [
    periodCommitted,
    crew,
    pairings,
    assignments,
    activities,
    activityCodes,
    activityGroups,
    memos,
    periodFrom,
    periodTo,
    containerWidth,
    zoom,
    barLabelMode,
    filters,
    rowHeightLevel,
    excludedCrewIds,
    smartFilter,
    publishedOverlay,
    publishedOverlayVisible,
    positions,
    crewGrouping,
    fdtl,
    aircraftTypes,
    displayOffsetHours,
  ])

  const pairingsById = useMemo(() => new Map(pairings.map((p) => [p._id, p])), [pairings])
  const positionsById = useMemo(() => new Map(positions.map((p) => [p._id, p])), [positions])

  // Uncrewed tray honours the left-panel A/C Type + Position filters:
  //   • A/C Type trims whole pairings by aircraft family.
  //   • Position trims the `missing` seat list to only seats whose
  //     position was picked, then drops pairings whose missing list
  //     becomes empty (all selected seats are already filled).
  // Resolve selected base _ids → IATA codes so we can match against
  // `pairing.baseAirport` (which is an IATA, not a DB id).
  const bases = useCrewScheduleStore((s) => s.context.bases)
  const selectedBaseIatas = useMemo(() => {
    if (filters.baseIds.length === 0) return null
    const byId = new Map(bases.map((b) => [b._id, b.iataCode]))
    return new Set(
      filters.baseIds.map((id) => byId.get(id)).filter((v): v is string => typeof v === 'string' && v.length > 0),
    )
  }, [filters.baseIds, bases])

  const filteredUncrewed = useMemo(() => {
    const acActive = filters.acTypeIcaos.length > 0
    const posActive = filters.positionIds.length > 0
    const baseActive = !!selectedBaseIatas && selectedBaseIatas.size > 0
    if (!acActive && !posActive && !baseActive) return uncrewed
    const out: typeof uncrewed = []
    for (const u of uncrewed) {
      const p = baseActive || acActive ? pairingsById.get(u.pairingId) : null
      if (baseActive) {
        if (!p || !p.baseAirport || !selectedBaseIatas!.has(p.baseAirport)) continue
      }
      if (acActive) {
        if (!p || !p.aircraftTypeIcao || !filters.acTypeIcaos.includes(p.aircraftTypeIcao)) continue
      }
      if (posActive) {
        const keptMissing = u.missing.filter((m) => filters.positionIds.includes(m.seatPositionId))
        if (keptMissing.length === 0) continue
        out.push({ ...u, missing: keptMissing })
      } else {
        out.push(u)
      }
    }
    return out
  }, [uncrewed, pairingsById, filters.acTypeIcaos, filters.positionIds, selectedBaseIatas])

  return (
    <div
      ref={shellRef}
      className="h-full flex gap-3 p-3"
      style={{ background: isFullscreen ? (isDark ? '#0E0E14' : '#FAFAFC') : undefined }}
    >
      <div className="shrink-0 h-full">
        <CrewScheduleFilterPanel onGo={handleGo} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {/* ── Ribbon toolbar (glass) — hidden until first successful Go ── */}
        {!runway.active && periodCommitted && (
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <CrewScheduleRibbonToolbar
              onFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              onRefresh={handleRefresh}
              onToggleSmartFilter={() => setSmartFilterOpen((v) => !v)}
              smartFilterOpen={smartFilterOpen}
              onOpenCheatsheet={() => setCheatsheetOpen(true)}
              onOpenLegalityCheck={() => useCrewScheduleStore.getState().openLegalityCheck({ kind: 'all' })}
              onSearch={() => setSearchOpen((v) => !v)}
            />
          </div>
        )}

        {/* ── Main body: canvas + tray + inspector (glass) ── */}
        <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
          <div
            className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}
            {!runway.active && !periodCommitted && !loading && (
              <EmptyPanel message="Configure filters on the left and click Go to load the crew schedule" />
            )}
            {!runway.active && periodCommitted && <CrewSchedulePublishBanner onAfterPublish={handleRefresh} />}
            {!runway.active && periodCommitted && computedLayout && (
              <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col" ref={frameRef}>
                <div className="flex-1 min-h-0 flex">
                  <CrewScheduleLeftPanel rows={computedLayout.rows} positions={positions} rowH={computedLayout.rowH} />
                  <div className="flex-1 min-w-0 relative">
                    <CrewScheduleCanvas layout={computedLayout} />
                    <CrewScheduleSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
                    <ClipboardPill />
                    <PasteFlashToast />
                    <PasteFdtlConfirmDialog />
                    <BlockDeleteConfirmDialog />
                  </div>
                </div>
                {uncrewedTrayVisible && (
                  <>
                    <UncrewedTrayResizer frameHeight={frameHeight} />
                    <UncrewedDutiesTray
                      uncrewed={filteredUncrewed}
                      pairingsById={pairingsById}
                      positionsById={positionsById}
                      periodStartMs={computedLayout.periodStartMs}
                      pph={computedLayout.pph}
                      totalWidth={computedLayout.totalWidth}
                      leftColumnWidth={280}
                      briefMinutes={fdtl.briefMinutes}
                      debriefMinutes={fdtl.debriefMinutes}
                      barLabelMode={barLabelMode}
                      rows={computedLayout.rows}
                      rowH={computedLayout.rowH}
                    />
                  </>
                )}
                {loading && (
                  <div
                    className="absolute inset-0 flex items-center justify-center z-10"
                    style={{ background: isDark ? 'rgba(14,14,20,0.5)' : 'rgba(255,255,255,0.5)' }}
                  >
                    <Loader2 size={28} className="animate-spin text-module-accent" />
                  </div>
                )}
              </div>
            )}
            {!runway.active && periodCommitted && !computedLayout && (
              <EmptyPanel
                message={
                  error
                    ? `Failed to load: ${error}`
                    : crew.length === 0
                      ? 'No crew match the current filters'
                      : 'Loading crew schedule…'
                }
              />
            )}
          </div>

          <CrewScheduleContextMenu onAfterMutate={handleRefresh} />
          <CrewScheduleDialogs onAfterMutate={handleRefresh} />
          <CrewScheduleSwapOverlay onAfterSwap={handleRefresh} />
          <TargetPickerBanner />
          <CrewOnPairingDialog />
          <AssignmentOverrideDialogHost />
          <AssignmentBlockedDialogHost />
          <LegalityCheckDialogHost />
          <PairingDetailsDialogHost />
          <DateTotalsDialog />
          <LegalityReportDialog />
          <TemporaryBaseDialogHost />
          <PositioningDrawerHost onAfterMutate={handleRefresh} />
          <CrewScheduleMemoOverlay onAfterMutate={handleRefresh} />
          <CrewScheduleCheatsheet open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
          <CrewScheduleCommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            onOpenCheatsheet={() => setCheatsheetOpen(true)}
            onRefresh={handleRefresh}
          />

          {/* ── Smart Filter (glass, left of inspector) ── */}
          {!runway.active && periodCommitted && (
            <CrewScheduleSmartFilter open={smartFilterOpen} onClose={() => setSmartFilterOpen(false)} />
          )}

          {/* ── Right inspector (glass) ── */}
          {!runway.active && periodCommitted && rightPanelOpen && (
            <div
              className="shrink-0 rounded-2xl overflow-hidden"
              style={{
                width: 360,
                background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                backdropFilter: 'blur(24px)',
              }}
            >
              <CrewScheduleRightPanel onRefresh={handleRefresh} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Expand a shift-drag block selection into the full set of
 * (crewId × dateIso) cell tuples it covers. Used by the Ctrl+V handler
 * + the context-menu paste action so a 5-crew × 4-day block pastes 20
 * activities in one bulk POST.
 */
function expandRangeToCells(range: {
  crewIds: string[]
  fromIso: string
  toIso: string
}): Array<{ crewId: string; dateIso: string }> {
  const out: Array<{ crewId: string; dateIso: string }> = []
  const fromMs = Date.parse(`${range.fromIso}T00:00:00Z`)
  const toMs = Date.parse(`${range.toIso}T00:00:00Z`)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return out
  for (const crewId of range.crewIds) {
    for (let ms = fromMs; ms <= toMs; ms += 86_400_000) {
      out.push({ crewId, dateIso: new Date(ms).toISOString().slice(0, 10) })
    }
  }
  return out
}

/** Small toolbar pill showing what's on the Gantt clipboard. Click ×
 *  to clear. Cut mode renders with an amber border + dashed underline
 *  on the code label so the planner can tell at a glance the source
 *  bar will be deleted on paste. */
function ClipboardPill() {
  const clip = useCrewScheduleStore((s) => s.clipboardActivity)
  const clear = useCrewScheduleStore((s) => s.clearClipboard)
  if (!clip) return null
  const isCut = clip.mode === 'cut'
  const accent = isCut ? '#FF8800' : 'var(--module-accent)'
  const tint = isCut ? 'rgba(255,136,0,0.10)' : 'rgba(62,123,250,0.10)'
  return (
    <div
      className="absolute top-3 left-3 z-30 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
      style={{
        background: tint,
        border: `1px solid ${accent}`,
        color: accent,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span className="opacity-70 uppercase tracking-wider text-[10px]">{isCut ? 'Cut' : 'Clipboard'}</span>
      <span
        className="font-mono font-semibold"
        style={isCut ? { textDecoration: 'underline dashed', textUnderlineOffset: 3 } : undefined}
      >
        {clip.codeLabel}
      </span>
      <span className="opacity-70 font-mono">
        {clip.startHHMM}–{clip.endHHMM}
      </span>
      <button
        onClick={clear}
        className="ml-1 w-4 h-4 rounded flex items-center justify-center hover:bg-white/10"
        title={isCut ? 'Cancel cut' : 'Clear clipboard'}
      >
        ×
      </button>
    </div>
  )
}

/** Confirm dialog for FDTL violations triggered by a paste. Renders
 *  one row per (crew × date × rule) issue with severity color. Cancel
 *  drops the pending paste; "Paste anyway" calls `confirmPendingPaste`
 *  which fires the bulk POST + cut-source delete + reevaluate. */
function PasteFdtlConfirmDialog() {
  const pending = useCrewScheduleStore((s) => s.pendingPasteConfirm)
  const confirm = useCrewScheduleStore((s) => s.confirmPendingPaste)
  const cancel = useCrewScheduleStore((s) => s.cancelPendingPaste)
  if (!pending) return null
  const violations = pending.issues.filter((i) => i.severity === 'violation').length
  const warnings = pending.issues.filter((i) => i.severity === 'warning').length
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={cancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl overflow-hidden flex flex-col max-h-[80vh] w-full max-w-[560px]"
        style={{
          background: 'rgba(25,25,33,0.98)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          color: '#fff',
        }}
      >
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase mb-0.5" style={{ color: '#FF8800' }}>
            FDTL Pre-check
          </div>
          <h3 className="text-[15px] font-bold tracking-tight">Paste will create FDTL issues</h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.60)' }}>
            {pending.fresh.length} cell{pending.fresh.length === 1 ? '' : 's'} ready to paste · {violations} violation
            {violations === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2">
          {pending.issues.map((iss, i) => (
            <div
              key={`${iss.crewId}-${iss.dateIso}-${i}`}
              className="rounded-lg px-3 py-2 text-[12px]"
              style={{
                background: iss.severity === 'violation' ? 'rgba(230,53,53,0.10)' : 'rgba(255,136,0,0.10)',
                border: `1px solid ${iss.severity === 'violation' ? '#E63535' : '#FF8800'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: iss.severity === 'violation' ? '#E63535' : '#FF8800' }}
                >
                  {iss.severity}
                </span>
                <span className="font-semibold">{iss.crewLabel}</span>
                <span className="opacity-60 font-mono">{iss.dateIso}</span>
              </div>
              <div className="font-medium">{iss.title}</div>
              {iss.message && <div className="opacity-70 leading-snug mt-0.5">{iss.message}</div>}
            </div>
          ))}
        </div>
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button onClick={cancel} className="h-9 px-4 rounded-lg text-[13px] font-medium hover:bg-white/10">
            Cancel
          </button>
          <button
            onClick={() => void confirm()}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white"
            style={{ background: '#FF8800' }}
          >
            Paste anyway
          </button>
        </div>
      </div>
    </div>
  )
}

/** Confirm prompt for multi-day / multi-crew block deletes. Single-
 *  cell deletes skip this and run immediately. Hero-style 104px header
 *  matches every other Gantt dialog. Delete CTA auto-focuses so Enter
 *  / Space proceed without an extra click; Esc cancels. */
function BlockDeleteConfirmDialog() {
  const pending = useCrewScheduleStore((s) => s.pendingBlockDelete)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (pending) {
      const id = setTimeout(() => confirmBtnRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [pending])
  if (!pending) return null
  const total = pending.activityIds.length + pending.assignmentIds.length
  const cancel = () => useCrewScheduleStore.setState({ pendingBlockDelete: null })
  const confirm = async () => {
    const { activityIds, assignmentIds } = pending
    useCrewScheduleStore.setState({ pendingBlockDelete: null })
    const requests = [
      ...activityIds.map((id) => ({ kind: 'activity' as const, id, fn: () => api.deleteCrewActivity(id) })),
      ...assignmentIds.map((id) => ({ kind: 'assignment' as const, id, fn: () => api.deleteCrewAssignment(id) })),
    ]
    const results = await Promise.allSettled(requests.map((r) => r.fn()))
    const failures: Array<{ kind: 'activity' | 'assignment'; id: string; status: number | null; message: string }> = []
    const goneActivityIds = new Set<string>()
    const goneAssignmentIds = new Set<string>()
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const req = requests[i]
      if (r.status === 'fulfilled') {
        if (req.kind === 'activity') goneActivityIds.add(req.id)
        else goneAssignmentIds.add(req.id)
        continue
      }
      const err = r.reason as { message?: string; status?: number }
      const status = err?.status ?? null
      failures.push({ kind: req.kind, id: req.id, status, message: err?.message ?? String(r.reason) })
      if (status === 404) {
        if (req.kind === 'activity') goneActivityIds.add(req.id)
        else goneAssignmentIds.add(req.id)
      }
    }
    if (failures.length > 0) {
      console.error('Block delete: %d/%d failed', failures.length, results.length, failures)
    }
    if (goneActivityIds.size > 0 || goneAssignmentIds.size > 0) {
      useCrewScheduleStore.setState((st) => ({
        activities: st.activities.filter((a) => !goneActivityIds.has(a._id)),
        assignments: st.assignments.filter((a) => !goneAssignmentIds.has(a._id)),
      }))
    }
    useCrewScheduleStore.getState().clearRangeSelection()
    void useCrewScheduleStore.getState().reconcilePeriod()
  }
  return (
    <DialogShell
      title={`Delete ${total} ${total === 1 ? 'duty' : 'duties'}?`}
      heroEyebrow="Confirm bulk delete"
      heroSubtitle="Removes a large number of ground and flight duties. This cannot be undone."
      heroSvg={<BulkDeleteHero />}
      onClose={cancel}
      width={520}
      bodyPadding={false}
      footer={
        <>
          <button onClick={cancel} className="h-9 px-4 rounded-lg text-[13px] font-medium hover:bg-white/10">
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => void confirm()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                void confirm()
              }
            }}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white outline-none"
            style={{ background: '#E63535', boxShadow: '0 0 0 2px rgba(230,53,53,0.30)' }}
          >
            Delete
          </button>
        </>
      }
    >
      <div />
    </DialogShell>
  )
}

/** Auto-clearing flash toast for paste outcomes. Lives inside the
 *  canvas frame so it doesn't compete with global app-level toasts. */
function PasteFlashToast() {
  const flash = useCrewScheduleStore((s) => s.pasteFlash)
  const setFlash = useCrewScheduleStore((s) => s.setPasteFlash)
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(id)
  }, [flash, setFlash])
  if (!flash) return null
  const accent = flash.kind === 'error' ? '#E63535' : flash.kind === 'warning' ? '#FF8800' : 'var(--module-accent)'
  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-lg text-[13px] font-medium"
      style={{
        background: 'rgba(25,25,33,0.92)',
        border: `1px solid ${accent}`,
        color: '#fff',
        backdropFilter: 'blur(8px)',
        animation: 'bc-dropdown-in 150ms ease-out',
      }}
    >
      {flash.text}
    </div>
  )
}

function TemporaryBaseDialogHost() {
  const dialog = useCrewScheduleStore((s) => s.tempBaseDialog)
  const close = useCrewScheduleStore((s) => s.closeTempBaseDialog)
  if (!dialog) return null
  return (
    <TemporaryBaseDialog
      crewIds={dialog.crewIds}
      fromIso={dialog.fromIso}
      toIso={dialog.toIso}
      editingId={dialog.editingId}
      onClose={close}
    />
  )
}

function PositioningDrawerHost({ onAfterMutate }: { onAfterMutate: () => void }) {
  const drawer = useCrewScheduleStore((s) => s.positioningDrawer)
  const close = useCrewScheduleStore((s) => s.closePositioningDrawer)
  const loadFlightBookings = useCrewScheduleStore((s) => s.loadFlightBookings)
  const activities = useCrewScheduleStore((s) => s.activities)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const [existing, setExisting] = useState<CrewFlightBookingRef | null>(null)
  const [resolved, setResolved] = useState(false)

  // Conflict detection — any activity / assignment for this crew on the
  // flightDate. Soft warning only; positioning around a half-day duty is
  // legitimate (training in the morning, position in the evening).
  const conflicts = useMemo<Array<{ kind: 'activity' | 'pairing'; label: string; window: string }>>(() => {
    if (!drawer) return []
    const out: Array<{ kind: 'activity' | 'pairing'; label: string; window: string }> = []
    const day = drawer.flightDate
    const codeMap = new Map(activityCodes.map((c) => [c._id, c.code]))
    const pairingMap = new Map(pairings.map((p) => [p._id, p.pairingCode]))
    const fmt = (iso: string) => iso.slice(11, 16)
    for (const a of activities) {
      if (a.crewId !== drawer.crewId) continue
      if (a.startUtcIso.slice(0, 10) > day || a.endUtcIso.slice(0, 10) < day) continue
      out.push({
        kind: 'activity',
        label: codeMap.get(a.activityCodeId ?? '') ?? a.activityCodeId ?? '?',
        window: `${fmt(a.startUtcIso)}–${fmt(a.endUtcIso)}Z`,
      })
    }
    for (const a of assignments) {
      if (a.crewId !== drawer.crewId) continue
      if (a.startUtcIso.slice(0, 10) > day || a.endUtcIso.slice(0, 10) < day) continue
      out.push({
        kind: 'pairing',
        label: pairingMap.get(a.pairingId) ?? a.pairingId,
        window: `${fmt(a.startUtcIso)}–${fmt(a.endUtcIso)}Z`,
      })
    }
    return out
  }, [drawer, activities, assignments, activityCodes, pairings])

  // When the drawer opens with a bookingId, fetch the row so the form
  // initialises in edit mode. We refilter on the temp base id + direction
  // because the click handler only stashes the id from the cached chip,
  // which can be stale by milliseconds.
  useEffect(() => {
    if (!drawer) {
      setExisting(null)
      setResolved(false)
      return
    }
    if (!drawer.bookingId) {
      setExisting(null)
      setResolved(true)
      return
    }
    let cancelled = false
    setResolved(false)
    api
      .getCrewFlightBookings({ tempBaseId: drawer.tempBaseId })
      .then((rows) => {
        if (cancelled) return
        const row =
          rows.find((r) => r._id === drawer.bookingId) ?? rows.find((r) => r.direction === drawer.direction) ?? null
        setExisting(row)
        setResolved(true)
      })
      .catch(() => {
        if (!cancelled) {
          setExisting(null)
          setResolved(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [drawer])

  if (!drawer || !resolved) return null
  return (
    <FlightBookingDrawer
      existing={existing}
      leg={null}
      positioning={{
        tempBaseId: drawer.tempBaseId,
        direction: drawer.direction,
        crewId: drawer.crewId,
        flightDate: drawer.flightDate,
        depStation: drawer.depStation,
        arrStation: drawer.arrStation,
        conflicts,
      }}
      onClosed={(changed) => {
        close()
        if (changed) {
          void loadFlightBookings()
          onAfterMutate()
        }
      }}
    />
  )
}
