'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * 2.1.3.3 — Disruption Management shell. Mirrors the MovementControlShell
 * skeleton: left FilterPanel (collapsible rail), right workspace split
 * into KPI toolbar + feed/detail. Scan uses the shared runway-loading
 * animation so the workflow matches every other ops surface.
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
  const scan = useDisruptionStore((s) => s.scan)

  const runway = useRunwayLoading()
  const shellRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)

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
  }, [operator?._id, setOperatorId])

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
          <div className="shrink-0 rounded-2xl overflow-hidden" style={glass}>
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
              <DisruptionFeed />
              <DisruptionDetailPanel />
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
    </div>
  )
}
