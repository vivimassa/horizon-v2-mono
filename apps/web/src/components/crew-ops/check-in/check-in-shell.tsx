'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { useCheckInConfigStore } from '@/stores/use-check-in-config-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { CrewCheckInFilterPanel } from './check-in-filter-panel'
import { CrewCheckInToolbar } from './check-in-toolbar'
import { CrewCheckInWorkspace } from './check-in-workspace'
import { CrewCheckInSettingsDrawer } from './check-in-settings-drawer'

/**
 * 4.1.7.1 Crew Check-In/Out — top-level shell.
 *
 *   1. Pre-Go: EmptyPanel with SkyHub watermark
 *   2. Go: runway animation while fetching
 *   3. Post-Go: glass toolbar + duties grid + crew list
 *   4. Background: 60s refresh keeps the late/very-late states current
 */
export function CrewCheckInShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const committed = useCrewCheckInStore((s) => s.committed)
  const commit = useCrewCheckInStore((s) => s.commit)
  const fetch = useCrewCheckInStore((s) => s.fetch)

  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const loadConfig = useCheckInConfigStore((s) => s.load)
  const configLoaded = useCheckInConfigStore((s) => s.loaded)

  const runway = useRunwayLoading()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])

  useEffect(() => {
    if (operator?._id && !configLoaded) void loadConfig(operator._id)
  }, [operator?._id, configLoaded, loadConfig])

  const handleGo = useCallback(async () => {
    commit()
    await runway.run(() => fetch(), 'Loading duties…', 'Loaded')
  }, [commit, fetch, runway])

  const handleRefresh = useCallback(async () => {
    await fetch()
  }, [fetch])

  // Background refresh while the workspace is open. Interval driven by the
  // Format popover ("Refresh Interval"). 0 = off.
  const refreshIntervalMins = useCrewCheckInStore((s) => s.refreshIntervalMins)
  useEffect(() => {
    if (!committed || refreshIntervalMins <= 0) return
    const id = setInterval(() => {
      void fetch()
    }, refreshIntervalMins * 60_000)
    return () => clearInterval(id)
  }, [committed, fetch, refreshIntervalMins])

  const showWorkArea = !runway.active && committed

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <CrewCheckInFilterPanel onGo={handleGo} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {showWorkArea && (
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
              boxShadow: '0 4px 16px rgba(96,97,112,0.08)',
            }}
          >
            <CrewCheckInToolbar onRefresh={handleRefresh} onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        )}

        <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">
          {runway.active ? (
            <div
              className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl"
              style={{
                background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                backdropFilter: 'blur(24px)',
                boxShadow: '0 2px 12px rgba(96,97,112,0.06)',
              }}
            >
              <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
            </div>
          ) : !committed ? (
            <div
              className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl"
              style={{
                background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                backdropFilter: 'blur(24px)',
                boxShadow: '0 2px 12px rgba(96,97,112,0.06)',
              }}
            >
              <EmptyPanel message="Click Go to load crew check-in (defaults to all bases, today)" />
            </div>
          ) : (
            <CrewCheckInWorkspace />
          )}
        </div>
      </div>

      <CrewCheckInSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
