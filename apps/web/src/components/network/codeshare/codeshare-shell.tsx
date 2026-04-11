'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { api } from '@skyhub/api'
import type { CodeshareAgreementRef } from '@skyhub/api'
import { CodeshareFilterPanel } from './codeshare-filter-panel'
import type { CodeshareFilterState } from './codeshare-filter-panel'
import { PartnerListPanel } from './partner-list-panel'
import { CodeshareToolbar } from './codeshare-toolbar'
import { AgreementDetailPanel } from './agreement-detail-panel'
import { AgreementDialog } from './agreement-dialog'

export function CodeshareShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const operator = useOperatorStore((s) => s.operator)
  const runway = useRunwayLoading()

  // Data state
  const [agreements, setAgreements] = useState<CodeshareAgreementRef[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const [filters, setFilters] = useState<CodeshareFilterState | null>(null)

  // View state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  useEffect(() => {
    loadOperator()
  }, [loadOperator])

  // Called when user clicks Go in the filter panel
  const handleGo = useCallback(
    async (f: CodeshareFilterState) => {
      setFilters(f)
      const data = await runway.run(
        async () => {
          const opId = getOperatorId()
          const all = await api.getCodeshareAgreements(opId)
          return all
        },
        'Loading codeshare agreements\u2026',
        'Agreements loaded',
      )

      // Client-side filtering
      let filtered = data as CodeshareAgreementRef[]

      // Date range filter — keep agreements whose effective window overlaps the filter period
      if (f.dateFrom) {
        filtered = filtered.filter((a) => !a.effectiveUntil || a.effectiveUntil >= f.dateFrom)
      }
      if (f.dateTo) {
        filtered = filtered.filter((a) => a.effectiveFrom <= f.dateTo)
      }

      // Status filter
      if (f.status) {
        filtered = filtered.filter((a) => a.status === f.status)
      }

      // Agreement type filter
      if (f.agreementType) {
        filtered = filtered.filter((a) => a.agreementType === f.agreementType)
      }

      setAgreements(filtered)
      setDataLoaded(true)
      setSelectedId(filtered.length > 0 ? filtered[0]._id : null)
    },
    [runway],
  )

  const handleDataChanged = useCallback(() => {
    // Re-run filters with current filter state
    if (filters) handleGo(filters)
    else setRefreshKey((k) => k + 1)
  }, [filters, handleGo])

  const handleAgreementCreated = useCallback(
    (id: string) => {
      setSelectedId(id)
      handleDataChanged()
    },
    [handleDataChanged],
  )

  const selectedAgreement = agreements.find((a) => a._id === selectedId) ?? null
  const operatorCode = operator?.iataCode || operator?.code || 'XX'

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const glassStyle = { background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }

  return (
    <div className="h-full flex gap-3 p-3">
      {/* Left filter panel */}
      <div className="shrink-0 h-full">
        <CodeshareFilterPanel forceCollapsed={dataLoaded} loading={runway.active} onGo={handleGo} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {/* Toolbar */}
        {!runway.active && dataLoaded && (
          <div className="shrink-0 rounded-2xl overflow-hidden" style={glassStyle}>
            <CodeshareToolbar hasSelection={!!selectedAgreement} onNewAgreement={() => setNewDialogOpen(true)} />
          </div>
        )}

        {/* Content panel */}
        <div className="flex-1 min-h-0 flex overflow-hidden rounded-2xl relative" style={glassStyle}>
          {runway.active ? (
            <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
          ) : !dataLoaded ? (
            <EmptyPanel message="Select a period and click Go to load codeshare agreements" />
          ) : (
            <>
              {/* Partner list inside content area */}
              <PartnerListPanel
                agreements={agreements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onNewAgreement={() => setNewDialogOpen(true)}
                isDark={isDark}
              />

              {/* Detail panel */}
              {!selectedAgreement ? (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyPanel
                    message={
                      agreements.length === 0
                        ? 'No agreements match your filters. Try adjusting the date range or status.'
                        : 'Select a partner airline to view agreement details'
                    }
                  />
                </div>
              ) : (
                <AgreementDetailPanel
                  agreement={selectedAgreement}
                  operatorCode={operatorCode}
                  isDark={isDark}
                  onDataChanged={handleDataChanged}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* New agreement dialog */}
      {newDialogOpen && (
        <AgreementDialog open onOpenChange={setNewDialogOpen} isDark={isDark} onCreated={handleAgreementCreated} />
      )}
    </div>
  )
}
