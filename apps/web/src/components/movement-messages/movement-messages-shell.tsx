'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Download, RefreshCw, Upload, Send, Trash2, X, Loader2 } from 'lucide-react'
import {
  useMovementMessages,
  useMovementMessageStats,
  useReleaseMovementMessages,
  useDiscardMovementMessages,
} from '@skyhub/api/src/hooks'
import type { MovementMessageRef } from '@skyhub/api'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { MessageFilterPanel, type MessageFilterValues } from './message-filter-panel'
import { MessageStatsBar } from './message-stats-bar'
import { MessageFeed } from './message-feed'
import { MessageDetailPanel } from './message-detail-panel'
import { PasteToApplyModal } from './paste-to-apply-modal'

const TAB_KEYS = ['all', 'held', 'outbound', 'inbound'] as const
type TabKey = (typeof TAB_KEYS)[number]

const TAB_LABELS: Record<TabKey, string> = {
  all: 'All',
  held: 'Held',
  outbound: 'Outbound',
  inbound: 'Inbound',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function messagesToCSV(messages: MovementMessageRef[]): string {
  const headers = ['Time', 'Type', 'Action', 'Direction', 'Flight', 'Route', 'Summary', 'Status', 'Raw']
  const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
  const rows = messages.map((m) =>
    [
      m.createdAtUtc,
      m.messageType,
      m.actionCode,
      m.direction,
      m.flightNumber ?? '',
      m.depStation && m.arrStation ? `${m.depStation}-${m.arrStation}` : '',
      m.summary ?? '',
      m.status,
      (m.rawMessage ?? '').replace(/\n/g, ' \\n '),
    ]
      .map(escape)
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}

export function MovementMessagesShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const operator = useOperatorStore((s) => s.operator)
  const loaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const accentColor = operator?.accentColor ?? '#1e40af'

  useEffect(() => {
    if (!loaded) loadOperator()
  }, [loaded, loadOperator])

  const [filters, setFilters] = useState<MessageFilterValues>({
    from: today(),
    to: today(),
    direction: [],
    messageTypes: [],
    actionCodes: [],
    statuses: [],
    stations: [],
    flightNumber: '',
  })
  const [committed, setCommitted] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const runway = useRunwayLoading()
  const releaseBulk = useReleaseMovementMessages()
  const discardBulk = useDiscardMovementMessages()

  const queryParams = useMemo(
    () => ({
      operatorId: operator?._id ?? '',
      flightDateFrom: filters.from ?? undefined,
      flightDateTo: filters.to ?? undefined,
      direction: filters.direction.length === 1 ? (filters.direction[0] as 'inbound' | 'outbound') : undefined,
      actionCodes: filters.actionCodes.length > 0 ? filters.actionCodes : undefined,
      messageTypes: filters.messageTypes.length > 0 ? filters.messageTypes : undefined,
      stations: filters.stations.length > 0 ? filters.stations : undefined,
      status: filters.statuses.length > 0 ? filters.statuses.join(',') : undefined,
      flightNumber: filters.flightNumber || undefined,
      limit: 200,
    }),
    [operator?._id, filters],
  )

  const messagesQuery = useMovementMessages({ ...queryParams, operatorId: queryParams.operatorId })
  const statsQuery = useMovementMessageStats(operator?._id ?? '', {
    flightDateFrom: filters.from ?? undefined,
    flightDateTo: filters.to ?? undefined,
  })

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !committed) return
    const t = setInterval(() => {
      messagesQuery.refetch()
      statsQuery.refetch()
    }, 30_000)
    return () => clearInterval(t)
  }, [autoRefresh, committed, messagesQuery, statsQuery])

  // Station options for filter (derived from messages we've already loaded)
  const stationOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of messagesQuery.data?.messages ?? []) {
      if (m.depStation) set.add(m.depStation)
      if (m.arrStation) set.add(m.arrStation)
    }
    return Array.from(set)
      .sort()
      .map((k) => ({ key: k, label: k }))
  }, [messagesQuery.data?.messages])

  // Tab-filtered messages (client-side)
  const messagesForTab = useMemo(() => {
    const all = messagesQuery.data?.messages ?? []
    switch (activeTab) {
      case 'held':
        return all.filter((m) => m.status === 'held')
      case 'outbound':
        return all.filter((m) => m.direction === 'outbound')
      case 'inbound':
        return all.filter((m) => m.direction === 'inbound')
      case 'all':
      default:
        return all
    }
  }, [activeTab, messagesQuery.data?.messages])

  const selectedMessage = useMemo(
    () => (selectedId ? (messagesForTab.find((m) => m._id === selectedId) ?? null) : null),
    [selectedId, messagesForTab],
  )

  const handleGo = useCallback(async () => {
    if (!operator?._id) return
    await runway.run(
      async () => {
        await Promise.all([messagesQuery.refetch(), statsQuery.refetch()])
      },
      'Loading messages…',
      'Ready',
    )
    setCommitted(true)
  }, [operator?._id, runway, messagesQuery, statsQuery])

  const handleExport = useCallback(() => {
    const data = messagesForTab
    if (data.length === 0) return
    const csv = messagesToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movement-messages-${filters.from ?? 'all'}-${filters.to ?? 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [messagesForTab, filters.from, filters.to])

  const handleRefreshAll = useCallback(() => {
    messagesQuery.refetch()
    statsQuery.refetch()
  }, [messagesQuery, statsQuery])

  // Bulk selection helpers
  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setCheckedIds(new Set(messagesForTab.map((m) => m._id)))
  }, [messagesForTab])

  const clearChecked = useCallback(() => setCheckedIds(new Set()), [])

  const checkedMessages = useMemo(
    () => messagesForTab.filter((m) => checkedIds.has(m._id)),
    [messagesForTab, checkedIds],
  )

  // Which bulk actions are valid for the current selection
  const canBulkRelease = useMemo(
    () =>
      checkedMessages.length > 0 &&
      checkedMessages.every(
        (m) => m.direction === 'outbound' && (m.status === 'held' || m.status === 'pending' || m.status === 'failed'),
      ),
    [checkedMessages],
  )
  const canBulkDiscard = useMemo(
    () => checkedMessages.length > 0 && checkedMessages.every((m) => m.status === 'held'),
    [checkedMessages],
  )

  const handleBulkRelease = useCallback(async () => {
    if (!canBulkRelease) return
    await releaseBulk.mutateAsync(Array.from(checkedIds))
    clearChecked()
    handleRefreshAll()
  }, [canBulkRelease, checkedIds, clearChecked, handleRefreshAll, releaseBulk])

  const handleBulkDiscard = useCallback(async () => {
    if (!canBulkDiscard) return
    await discardBulk.mutateAsync(Array.from(checkedIds))
    clearChecked()
    handleRefreshAll()
  }, [canBulkDiscard, checkedIds, clearChecked, handleRefreshAll, discardBulk])

  // Escape deselects row + clears bulk selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null)
        clearChecked()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [clearChecked])

  const glass = {
    background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  } as const

  const toolbarBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  // Tab counts
  const tabCount = (t: TabKey): number => {
    const all = messagesQuery.data?.messages ?? []
    if (t === 'all') return all.length
    if (t === 'held') return all.filter((m) => m.status === 'held').length
    if (t === 'outbound') return all.filter((m) => m.direction === 'outbound').length
    return all.filter((m) => m.direction === 'inbound').length
  }

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <MessageFilterPanel
          values={filters}
          onChange={setFilters}
          onGo={handleGo}
          loading={runway.active}
          stationOptions={stationOptions}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}

        {!runway.active && !committed && (
          <EmptyPanel message="Select a period on the left and click Load to see movement messages" />
        )}

        {!runway.active && committed && (
          <div className="flex-1 min-w-0 flex flex-col min-h-0 rounded-2xl overflow-hidden" style={glass}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b" style={{ borderColor: toolbarBorder }}>
              <div className="flex items-center gap-2">
                <div className="w-[3px] h-5 rounded-full" style={{ background: accentColor }} />
                <span className="text-[15px] font-semibold text-hz-text">Movement messages</span>
              </div>

              <div className="flex-1" />

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hz-text-tertiary" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search flight, summary, station…"
                  className="w-[240px] h-8 pl-8 pr-3 rounded-lg text-[13px] outline-none text-hz-text placeholder:text-hz-text-tertiary"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
                  }}
                />
              </div>

              <button
                onClick={() => setPasteOpen(true)}
                className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-2"
                style={{ background: `${accentColor}1A`, color: accentColor, border: `1px solid ${accentColor}40` }}
                title="Paste inbound telex"
              >
                <Upload className="w-3.5 h-3.5" />
                Paste telex
              </button>

              <button
                onClick={() => setAutoRefresh((v) => !v)}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: autoRefresh ? `${accentColor}1A` : 'transparent',
                  color: autoRefresh ? accentColor : undefined,
                  border: `1px solid ${autoRefresh ? `${accentColor}40` : 'transparent'}`,
                }}
                title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
              >
                <RefreshCw
                  className="w-4 h-4"
                  style={autoRefresh ? { animation: 'spin 3s linear infinite' } : undefined}
                />
              </button>

              <button
                onClick={handleRefreshAll}
                className="h-8 px-2 rounded-lg text-[13px] text-hz-text-secondary hover:bg-hz-surface-hover"
              >
                Refresh
              </button>

              <button
                onClick={handleExport}
                disabled={messagesForTab.length === 0}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover disabled:opacity-40"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            <MessageStatsBar stats={statsQuery.data ?? null} accentColor={accentColor} />

            {/* Tabs */}
            <div className="flex items-end gap-0 px-4 shrink-0" style={{ borderBottom: `1px solid ${toolbarBorder}` }}>
              {TAB_KEYS.map((t) => {
                const active = activeTab === t
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setActiveTab(t)
                      setSelectedId(null)
                      clearChecked()
                    }}
                    className="relative h-10 px-4 text-[13px] font-semibold transition-colors"
                    style={{
                      color: active ? accentColor : 'var(--hz-text-secondary)',
                    }}
                  >
                    {TAB_LABELS[t]}
                    <span
                      className="ml-1.5 text-[13px] font-normal"
                      style={{ color: active ? accentColor : 'var(--hz-text-tertiary)' }}
                    >
                      {tabCount(t)}
                    </span>
                    {active && (
                      <span
                        className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full"
                        style={{ background: accentColor }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selection toolbar */}
            {checkedIds.size > 0 && (
              <div
                className="flex items-center gap-2 px-4 h-11 shrink-0 border-b"
                style={{
                  background: `${accentColor}10`,
                  borderColor: toolbarBorder,
                }}
              >
                <span className="text-[13px] font-semibold" style={{ color: accentColor }}>
                  {checkedIds.size} selected
                </span>
                <button
                  onClick={clearChecked}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1" />

                <button
                  onClick={handleBulkRelease}
                  disabled={!canBulkRelease || releaseBulk.isPending}
                  className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-opacity"
                  style={{
                    background: accentColor,
                    color: '#fff',
                    opacity: !canBulkRelease || releaseBulk.isPending ? 0.4 : 1,
                  }}
                  title={
                    canBulkRelease
                      ? 'Release selected messages'
                      : 'Release requires outbound held / pending / failed messages'
                  }
                >
                  {releaseBulk.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Release ({checkedIds.size})
                </button>
                <button
                  onClick={handleBulkDiscard}
                  disabled={!canBulkDiscard || discardBulk.isPending}
                  className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-opacity"
                  style={{
                    background: 'rgba(255,59,59,0.14)',
                    color: '#FF3B3B',
                    border: '1px solid rgba(255,59,59,0.28)',
                    opacity: !canBulkDiscard || discardBulk.isPending ? 0.4 : 1,
                  }}
                  title={canBulkDiscard ? 'Discard selected held messages' : 'Discard requires held messages'}
                >
                  {discardBulk.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Discard ({checkedIds.size})
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              <MessageFeed
                messages={messagesForTab}
                selectedId={selectedId}
                onSelect={setSelectedId}
                searchText={searchText}
                accentColor={accentColor}
                checkedIds={checkedIds}
                onToggleCheck={toggleChecked}
                onCheckAll={selectAllVisible}
                onClearCheck={clearChecked}
              />
              {selectedMessage && (
                <MessageDetailPanel message={selectedMessage} accentColor={accentColor} onChanged={handleRefreshAll} />
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-1.5 border-t flex items-center justify-between text-[13px] text-hz-text-tertiary shrink-0"
              style={{ borderColor: toolbarBorder }}
            >
              <span>
                Showing {messagesForTab.length}
                {messagesQuery.data?.total ? ` of ${messagesQuery.data.total}` : ''} messages
              </span>
              <span className="font-mono">
                Operator · {operator?.code ?? '—'} ·{' '}
                {operator?.delayCodeAdherence === 'ahm732' ? 'AHM 732' : 'AHM 730/731'}
              </span>
            </div>
          </div>
        )}
      </div>

      <PasteToApplyModal
        open={pasteOpen}
        accentColor={accentColor}
        onClose={() => setPasteOpen(false)}
        onApplied={handleRefreshAll}
      />
    </div>
  )
}
