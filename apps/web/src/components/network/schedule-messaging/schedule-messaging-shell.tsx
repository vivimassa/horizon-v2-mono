'use client'

import { useEffect, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useScheduleMessagingStore } from '@/stores/use-schedule-messaging-store'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { MessagingFilterPanel } from './messaging-filter-panel'
import { MessagingToolbar } from './messaging-toolbar'
import { ReceivePanel } from './receive-panel'
import { SendPanel } from './send-panel'
import { MessageLogTable } from './message-log-table'

export function ScheduleMessagingShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const runway = useRunwayLoading()
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const operator = useOperatorStore((s) => s.operator)

  const dataLoaded = useScheduleMessagingStore((s) => s.dataLoaded)
  const activeSection = useScheduleMessagingStore((s) => s.activeSection)
  const loadMessages = useScheduleMessagingStore((s) => s.loadMessages)
  const loadStats = useScheduleMessagingStore((s) => s.loadStats)

  // Glass styling
  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const glassStyle = {
    background: glassBg,
    border: `1px solid ${glassBorder}`,
    backdropFilter: 'blur(24px)',
  }

  useEffect(() => {
    loadOperator()
  }, [loadOperator])

  const handleGo = useCallback(async () => {
    await runway.run(
      async () => {
        await Promise.all([loadMessages(), loadStats()])
      },
      'Loading messages\u2026',
      'Messages loaded',
    )
  }, [runway, loadMessages, loadStats])

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadMessages(), loadStats()])
  }, [loadMessages, loadStats])

  return (
    <div className="h-full flex gap-3 p-3">
      {/* Left filter panel */}
      <div className="shrink-0 h-full">
        <MessagingFilterPanel forceCollapsed={dataLoaded} loading={runway.active} onGo={handleGo} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {/* Empty state */}
        {!dataLoaded && !runway.active && <EmptyPanel />}

        {/* Loading */}
        {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}

        {/* Loaded */}
        {dataLoaded && !runway.active && (
          <>
            {/* Toolbar */}
            <div className="shrink-0 rounded-2xl overflow-hidden" style={glassStyle}>
              <MessagingToolbar onRefresh={handleRefresh} />
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl" style={glassStyle}>
              {activeSection === 'receive' && (
                <ReceivePanel operatorIataCode={operator?.iataCode ?? ''} onApplied={handleRefresh} />
              )}
              {activeSection === 'send' && (
                <SendPanel operatorIataCode={operator?.iataCode ?? ''} onSent={handleRefresh} />
              )}
              {activeSection === 'log' && <MessageLogTable />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
