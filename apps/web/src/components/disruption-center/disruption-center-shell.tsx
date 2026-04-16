'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MODULE_REGISTRY } from '@skyhub/constants'
import { api, type DisruptionIssueRef } from '@skyhub/api'
import { useGanttStore } from '@/stores/use-gantt-store'
import { FlightInformationDialog } from '@/components/network/gantt/flight-information/flight-information-dialog'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useDisruptionStore } from '@/stores/use-disruption-store'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { DisruptionFilterPanel } from './disruption-filter-panel'
import { DisruptionKpiStrip } from './disruption-kpi-strip'
import { DisruptionFeed } from './disruption-feed'
import { DisruptionDetailPanel } from './disruption-detail-panel'
import { DisruptionContextMenu } from './disruption-context-menu'
import { AssignToPicker } from './assign-to-picker'
import { AdvisorDrawer } from './advisor-drawer'
import { ResolveDialog } from './resolve-dialog'

/**
 * 2.1.3.4 — Disruption Management shell. Mirrors the MovementControlShell
 * skeleton: left FilterPanel (collapsible rail), right workspace split
 * into KPI toolbar + feed/detail. Scan uses the shared runway-loading
 * animation so the workflow matches every other ops surface.
 *
 * Per-operator overrides (SLA, labels, rolling stops, resolution types,
 * default feed status) come from 2.1.3.3 Disruption Customization via
 * the store's refreshConfig(), called once after the operator is set.
 */
export function DisruptionCenterShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)

  const issues = useDisruptionStore((s) => s.issues)
  const error = useDisruptionStore((s) => s.error)
  const filters = useDisruptionStore((s) => s.filters)
  const setOperatorId = useDisruptionStore((s) => s.setOperatorId)
  const refresh = useDisruptionStore((s) => s.refresh)
  const refreshConfig = useDisruptionStore((s) => s.refreshConfig)
  const scan = useDisruptionStore((s) => s.scan)
  const claim = useDisruptionStore((s) => s.claim)
  const assign = useDisruptionStore((s) => s.assign)
  const start = useDisruptionStore((s) => s.start)
  const resolve = useDisruptionStore((s) => s.resolve)
  const closeIssue = useDisruptionStore((s) => s.close)
  const hide = useDisruptionStore((s) => s.hide)
  const selectIssue = useDisruptionStore((s) => s.selectIssue)
  const selectedIssueId = useDisruptionStore((s) => s.selectedIssueId)
  const advisorOpen = useDisruptionStore((s) => s.advisorOpen)
  const setAdvisorOpen = useDisruptionStore((s) => s.setAdvisorOpen)

  const router = useRouter()
  const runway = useRunwayLoading()
  const shellRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; issue: DisruptionIssueRef } | null>(null)
  const [assignIssue, setAssignIssue] = useState<DisruptionIssueRef | null>(null)
  const [resolveIssue, setResolveIssue] = useState<DisruptionIssueRef | null>(null)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    if (!operatorLoaded) loadOperator()
  }, [operatorLoaded, loadOperator])

  useEffect(() => {
    if (!operator?._id) return
    setOperatorId(operator._id)
    void refreshConfig()
  }, [operator?._id, setOperatorId, refreshConfig])

  // Scan over the selected window. Rolling period (if set) re-anchors to
  // today → today + N days; otherwise uses the fixed from/to picked in the
  // filter panel. Wrapped in `runway.run` so the full-screen runway
  // animation plays for at least 3s, matching Movement Control's flow.
  const handleGo = useCallback(async () => {
    if (!operator?._id) return
    const today = new Date().toISOString().slice(0, 10)
    const rolling = filters.rollingPeriodDays
    const from = rolling !== null ? today : (filters.from ?? today)
    const to =
      rolling !== null
        ? new Date(Date.now() + rolling * 86_400_000).toISOString().slice(0, 10)
        : (filters.to ?? new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10))
    await runway.run(
      async () => {
        await scan(from, to)
        await refresh()
      },
      'Scanning disruptions…',
      'Scan complete',
    )
    setHasScanned(true)
  }, [operator?._id, filters.rollingPeriodDays, filters.from, filters.to, runway, scan, refresh])

  const handleContextMenu = useCallback((e: React.MouseEvent, issue: DisruptionIssueRef) => {
    setMenu({ x: e.clientX, y: e.clientY, issue })
  }, [])

  const handleOpenModule = useCallback(
    (code: string, issue: DisruptionIssueRef) => {
      const mod = MODULE_REGISTRY.find((m) => m.code === code)
      if (!mod?.route) return
      const params = new URLSearchParams({ disruptionId: issue._id })
      router.push(`${mod.route}?${params.toString()}`)
    },
    [router],
  )

  const handleViewFlightInfo = useCallback(
    async (issue: DisruptionIssueRef) => {
      if (!issue.flightNumber || !issue.forDate || !operator?._id) return
      try {
        const { scheduledFlightId, operatingDate } = await api.resolveFlight({
          operatorId: operator._id,
          flightNumber: issue.flightNumber,
          date: issue.forDate,
          dep: issue.depStation ?? undefined,
          arr: issue.arrStation ?? undefined,
        })
        useGanttStore.getState().openFlightInfo(`${scheduledFlightId}|${operatingDate}`)
      } catch (e) {
        console.warn('View flight info failed:', e)
      }
    },
    [operator?._id],
  )

  const handleResolveFromMenu = useCallback((issue: DisruptionIssueRef) => {
    setResolveIssue(issue)
  }, [])

  const handleAskAdvisor = useCallback(
    async (issue: DisruptionIssueRef) => {
      await selectIssue(issue._id)
      setAdvisorOpen(true)
    },
    [selectIssue, setAdvisorOpen],
  )

  const selectedIssue = issues.find((i) => i._id === selectedIssueId) ?? null

  const glass = {
    background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  } as const

  return (
    <div
      ref={shellRef}
      className="h-full flex gap-3 p-3"
      style={{ background: isFullscreen ? (isDark ? '#0E0E14' : '#FAFAFC') : undefined }}
    >
      <div className="shrink-0 h-full">
        <DisruptionFilterPanel onGo={handleGo} loading={runway.active} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {!runway.active && hasScanned && (
          <div className="shrink-0">
            <DisruptionKpiStrip issues={issues} />
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl" style={glass}>
          {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}
          {!runway.active && !hasScanned && (
            <EmptyPanel message="Set filters on the left and click Scan to load disruptions" />
          )}
          {!runway.active && hasScanned && (
            <div className="flex-1 min-h-0 flex overflow-hidden">
              <DisruptionFeed onContextMenu={handleContextMenu} />
              {advisorOpen && selectedIssue ? <AdvisorDrawer issue={selectedIssue} /> : <DisruptionDetailPanel />}
            </div>
          )}
          {!runway.active && hasScanned && error && (
            <div
              className="mx-5 mb-3 rounded-xl px-4 py-3 text-[13px]"
              style={{
                background: 'rgba(255,59,59,0.08)',
                border: '1px solid rgba(255,59,59,0.28)',
                color: '#FF3B3B',
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {menu && (
        <DisruptionContextMenu
          x={menu.x}
          y={menu.y}
          issue={menu.issue}
          onClose={() => setMenu(null)}
          onClaim={(issue) => void claim(issue._id)}
          onAssign={(issue) => setAssignIssue(issue)}
          onStart={(issue) => void start(issue._id)}
          onResolve={(issue) => void handleResolveFromMenu(issue)}
          onCloseIssue={(issue) => void closeIssue(issue._id)}
          onHide={(issue) => void hide(issue._id)}
          onAskAdvisor={handleAskAdvisor}
          onViewFlightInfo={handleViewFlightInfo}
          onOpenModule={handleOpenModule}
        />
      )}

      {assignIssue && operator?._id && (
        <AssignToPicker
          issue={assignIssue}
          operatorId={operator._id}
          onClose={() => setAssignIssue(null)}
          onConfirm={async (userId) => {
            const issueId = assignIssue._id
            setAssignIssue(null)
            await assign(issueId, userId)
          }}
        />
      )}

      {resolveIssue && (
        <ResolveDialog
          issue={resolveIssue}
          onClose={() => setResolveIssue(null)}
          onConfirm={async (resolutionType, notes) => {
            const issueId = resolveIssue._id
            setResolveIssue(null)
            await resolve(issueId, resolutionType, notes)
          }}
        />
      )}

      {/* Reused premium Flight Information modal — opened via
          useGanttStore.openFlightInfo() from the right-click menu. */}
      <FlightInformationDialog />
    </div>
  )
}
