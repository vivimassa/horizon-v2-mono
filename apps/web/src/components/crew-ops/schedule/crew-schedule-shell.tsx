'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@skyhub/api'
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
import { CrewScheduleCheatsheet } from './crew-schedule-cheatsheet'
import { CrewScheduleCommandPalette } from './crew-schedule-command-palette'
import { CrewScheduleSmartFilter } from './crew-schedule-smart-filter'
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
    await runway.run(() => commitPeriod(), 'Loading crew schedule…', 'Schedule loaded')
  }, [runway, commitPeriod])

  // Post-mutation refresh — silent reconcile so the loading flag does
  // not toggle and the canvas does not repaint from scratch. Prevents
  // the crew-row reshuffle the user sees after assigning a duty.
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)
  const handleRefresh = useCallback(() => {
    void reconcilePeriod()
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

      // Ctrl+Shift+P / ⌘⇧P → toggle the "Compare to Published" overlay
      // (AIMS F10 — F10 itself is grabbed by Chromium on Linux/Win).
      if (!typing && (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        void useCrewScheduleStore.getState().togglePublishedOverlay()
        return
      }

      // Delete / Backspace → destructive action on the current selection.
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (typing) return
        const s = useCrewScheduleStore.getState()
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
          const results = await Promise.allSettled([
            ...acts.map((a) => api.deleteCrewActivity(a._id)),
            ...asgs.map((a) => api.deleteCrewAssignment(a._id)),
          ])
          const failures = results.filter((r) => r.status === 'rejected')
          if (failures.length > 0) {
            console.error('Block delete: %d/%d failed', failures.length, results.length, failures)
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
          try {
            await api.deleteCrewActivity(id)
          } catch (err) {
            console.error('Failed to delete activity:', err)
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
          try {
            await api.deleteCrewAssignment(id)
          } catch (err) {
            console.error('Failed to delete assignment:', err)
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
  ])

  const pairingsById = useMemo(() => new Map(pairings.map((p) => [p._id, p])), [pairings])
  const positionsById = useMemo(() => new Map(positions.map((p) => [p._id, p])), [positions])

  // Uncrewed tray honours the left-panel A/C Type + Position filters:
  //   • A/C Type trims whole pairings by aircraft family.
  //   • Position trims the `missing` seat list to only seats whose
  //     position was picked, then drops pairings whose missing list
  //     becomes empty (all selected seats are already filled).
  const filteredUncrewed = useMemo(() => {
    const acActive = filters.acTypeIcaos.length > 0
    const posActive = filters.positionIds.length > 0
    if (!acActive && !posActive) return uncrewed
    const out: typeof uncrewed = []
    for (const u of uncrewed) {
      if (acActive) {
        const p = pairingsById.get(u.pairingId)
        if (!p || !filters.acTypeIcaos.includes(p.aircraftTypeIcao)) continue
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
  }, [uncrewed, pairingsById, filters.acTypeIcaos, filters.positionIds])

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
