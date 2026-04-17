'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Search, Send, Trash2, X, Loader2 } from 'lucide-react'
import { useMovementMessages, useReleaseMovementMessages, useDiscardMovementMessages } from '@skyhub/api/src/hooks'
import type { MovementMessageRef } from '@skyhub/api'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { MessageFilterPanel, type MessageFilterValues } from './message-filter-panel'
import { MessageColumn } from './message-column'
import { PasteToApplyModal } from './paste-to-apply-modal'
import { CommunicationDeckToolbar, type MessageStatus } from './communication-deck-toolbar'
import { ReleaseAllModal } from './release-all-modal'
import { AutoTransmitBanner } from './auto-transmit-banner'

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

export function CommunicationDeckShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const operator = useOperatorStore((s) => s.operator)
  const loaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const accentColor = operator?.accentColor ?? '#1e40af'

  useEffect(() => {
    if (!loaded) loadOperator()
  }, [loaded, loadOperator])

  // Two copies of the left-panel filter state:
  //   draftFilters   — what the user is currently editing
  //   appliedFilters — what actually drives the query; only updated on Load click
  // Editing the left panel never refetches; the user must click Load to commit.
  const initialFilters: MessageFilterValues = {
    from: today(),
    to: today(),
    direction: [],
    messageTypes: [],
    actionCodes: [],
    statuses: [],
    stations: [],
    flightNumber: '',
  }
  const [draftFilters, setDraftFilters] = useState<MessageFilterValues>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<MessageFilterValues>(initialFilters)
  const [committed, setCommitted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [releaseAllOpen, setReleaseAllOpen] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [statusQuickFilter, setStatusQuickFilter] = useState<MessageStatus[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const runway = useRunwayLoading()
  const releaseBulk = useReleaseMovementMessages()
  const discardBulk = useDiscardMovementMessages()

  const queryParams = useMemo(
    () => ({
      operatorId: operator?._id ?? '',
      flightDateFrom: appliedFilters.from ?? undefined,
      flightDateTo: appliedFilters.to ?? undefined,
      direction:
        appliedFilters.direction.length === 1 ? (appliedFilters.direction[0] as 'inbound' | 'outbound') : undefined,
      actionCodes: appliedFilters.actionCodes.length > 0 ? appliedFilters.actionCodes : undefined,
      messageTypes: appliedFilters.messageTypes.length > 0 ? appliedFilters.messageTypes : undefined,
      stations: appliedFilters.stations.length > 0 ? appliedFilters.stations : undefined,
      status: appliedFilters.statuses.length > 0 ? appliedFilters.statuses.join(',') : undefined,
      flightNumber: appliedFilters.flightNumber || undefined,
      limit: 200,
    }),
    [operator?._id, appliedFilters],
  )

  const messagesQuery = useMovementMessages({ ...queryParams, operatorId: queryParams.operatorId })

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

  // Apply search + status quick filter on top of fetched messages
  const visibleMessages = useMemo(() => {
    const all = messagesQuery.data?.messages ?? []
    const q = searchText.trim().toLowerCase()
    return all.filter((m) => {
      if (statusQuickFilter.length > 0 && !statusQuickFilter.includes(m.status as MessageStatus)) {
        return false
      }
      if (!q) return true
      return (
        m.flightNumber?.toLowerCase().includes(q) ||
        m.summary?.toLowerCase().includes(q) ||
        m.depStation?.toLowerCase().includes(q) ||
        m.arrStation?.toLowerCase().includes(q) ||
        m.actionCode.toLowerCase().includes(q) ||
        m.messageType.toLowerCase().includes(q) ||
        m.rawMessage?.toLowerCase().includes(q) ||
        false
      )
    })
  }, [messagesQuery.data?.messages, searchText, statusQuickFilter])

  const incomingMessages = useMemo(() => visibleMessages.filter((m) => m.direction === 'inbound'), [visibleMessages])
  const outgoingMessages = useMemo(() => visibleMessages.filter((m) => m.direction === 'outbound'), [visibleMessages])

  // "Release all" candidates: outbound messages currently in Held or Pending.
  // Failed retries are NOT auto-swept — they require per-message attention.
  const releasableMessages = useMemo(
    () => outgoingMessages.filter((m) => m.status === 'held' || m.status === 'pending'),
    [outgoingMessages],
  )

  const handleGo = useCallback(async () => {
    if (!operator?._id) return
    // Commit the draft filters. The query hook re-keys on queryParams change
    // and the explicit refetch covers the no-op case (Load with no changes).
    setAppliedFilters(draftFilters)
    await runway.run(
      async () => {
        await messagesQuery.refetch()
      },
      'Loading messages…',
      'Ready',
    )
    setCommitted(true)
  }, [operator?._id, runway, messagesQuery, draftFilters])

  const handleExport = useCallback(() => {
    const data = visibleMessages
    if (data.length === 0) return
    const csv = messagesToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `communication-deck-${appliedFilters.from ?? 'all'}-${appliedFilters.to ?? 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [visibleMessages, appliedFilters.from, appliedFilters.to])

  const handleRefreshAll = useCallback(() => {
    messagesQuery.refetch()
  }, [messagesQuery])

  const handleReleaseAllConfirm = useCallback(async () => {
    if (releasableMessages.length === 0) return
    const ids = releasableMessages.map((m) => m._id)
    await releaseBulk.mutateAsync(ids)
    setReleaseAllOpen(false)
    handleRefreshAll()
  }, [releasableMessages, releaseBulk, handleRefreshAll])

  // Bulk selection helpers (outgoing only)
  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearChecked = useCallback(() => setCheckedIds(new Set()), [])

  const checkedMessages = useMemo(
    () => outgoingMessages.filter((m) => checkedIds.has(m._id)),
    [outgoingMessages, checkedIds],
  )

  const canBulkRelease = useMemo(
    () =>
      checkedMessages.length > 0 &&
      checkedMessages.every((m) => m.status === 'held' || m.status === 'pending' || m.status === 'failed'),
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

  // Escape clears selection + closes search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearChecked()
        setSearchOpen(false)
      }
      // Ctrl+F / Cmd+F toggles search when the page is mounted
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && committed) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [clearChecked, committed])

  // Focus the search input when the overlay opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 40)
    } else {
      setSearchText('')
    }
  }, [searchOpen])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const softBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  // Bulk action bar rendered inside the OUTGOING column header area
  const outgoingExtraHeader = checkedIds.size > 0 && (
    <div
      className="flex items-center gap-2 px-4 h-11 shrink-0 border-b"
      style={{ background: `${accentColor}10`, borderColor: softBorder }}
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
        title={canBulkRelease ? 'Release selected messages' : 'Release requires held / pending / failed messages'}
      >
        {releaseBulk.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
        {discardBulk.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Discard ({checkedIds.size})
      </button>
    </div>
  )

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <MessageFilterPanel
          values={draftFilters}
          onChange={setDraftFilters}
          onGo={handleGo}
          loading={runway.active}
          stationOptions={stationOptions}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden gap-3">
        {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}

        {!runway.active && !committed && (
          <EmptyPanel message="Select a period on the left and click Load to open the Communication Deck" />
        )}

        {!runway.active && committed && (
          <>
            {/* Top ribbon toolbar */}
            <div
              className="shrink-0 rounded-2xl overflow-hidden"
              style={{
                background: glassBg,
                border: `1px solid ${glassBorder}`,
                backdropFilter: 'blur(24px)',
              }}
            >
              <CommunicationDeckToolbar
                onPasteTelex={() => setPasteOpen(true)}
                onRefresh={handleRefreshAll}
                onExport={handleExport}
                canExport={visibleMessages.length > 0}
                onSearch={() => setSearchOpen((v) => !v)}
                searchOpen={searchOpen}
                statusFilter={statusQuickFilter}
                onChangeStatusFilter={setStatusQuickFilter}
                onReleaseAll={() => setReleaseAllOpen(true)}
                releasableCount={releasableMessages.length}
              />
            </div>

            {/* Search overlay bar */}
            {searchOpen && (
              <div
                className="shrink-0 rounded-2xl flex items-center gap-2 px-3 h-12"
                style={{
                  background: glassBg,
                  border: `1px solid ${glassBorder}`,
                  backdropFilter: 'blur(24px)',
                }}
              >
                <Search size={16} className="text-hz-text-tertiary shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search flight, summary, station, raw telex…"
                  className="flex-1 h-8 bg-transparent text-[13px] outline-none text-hz-text placeholder:text-hz-text-tertiary"
                />
                {searchText && (
                  <span className="text-[13px] text-hz-text-tertiary">
                    {visibleMessages.length} match{visibleMessages.length === 1 ? '' : 'es'}
                  </span>
                )}
                <button
                  onClick={() => setSearchOpen(false)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover"
                  title="Close search (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Auto-transmit armed banner — only renders when scheduler is enabled */}
            {operator?._id && <AutoTransmitBanner operatorId={operator._id} onDisarmed={handleRefreshAll} />}

            {/* Two-column body */}
            <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
              <MessageColumn variant="incoming" messages={incomingMessages} accentColor={accentColor} />
              <MessageColumn
                variant="outgoing"
                messages={outgoingMessages}
                accentColor={accentColor}
                checkable
                checkedIds={checkedIds}
                onToggleCheck={toggleChecked}
                extraHeader={outgoingExtraHeader}
              />
            </div>
          </>
        )}
      </div>

      <PasteToApplyModal
        open={pasteOpen}
        accentColor={accentColor}
        onClose={() => setPasteOpen(false)}
        onApplied={handleRefreshAll}
      />

      <ReleaseAllModal
        open={releaseAllOpen}
        messages={releasableMessages}
        accentColor={accentColor}
        pending={releaseBulk.isPending}
        onClose={() => setReleaseAllOpen(false)}
        onConfirm={handleReleaseAllConfirm}
      />
    </div>
  )
}
