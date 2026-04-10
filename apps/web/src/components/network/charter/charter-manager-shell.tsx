'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { useCharterStore } from '@/stores/use-charter-store'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { api } from '@skyhub/api'
import type { CharterContractRef } from '@skyhub/api'
import { CharterFilterPanel } from './charter-filter-panel'
import type { CharterFilterState } from './charter-filter-panel'
import { ContractSidebar } from './contract-list-panel'
import { ContractToolbar } from './contract-toolbar'
import { ContractDetailPanel } from './contract-detail-panel'
import { ContractFormDialog } from './contract-form-dialog'
import { FlightFormDialog } from './flight-form-dialog'

export function CharterManagerShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const loadOperator = useOperatorStore(s => s.loadOperator)
  const operator = useOperatorStore(s => s.operator)
  const runway = useRunwayLoading()

  const contracts = useCharterStore(s => s.contracts)
  const selectedId = useCharterStore(s => s.selectedId)
  const loadContracts = useCharterStore(s => s.loadContracts)
  const selectContract = useCharterStore(s => s.selectContract)
  const refreshFlightsAndStats = useCharterStore(s => s.refreshFlightsAndStats)

  // Data only loads after Go is clicked
  const [hasLoaded, setHasLoaded] = useState(false)
  const [filters, setFilters] = useState<CharterFilterState | null>(null)

  // Dialog state
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<CharterContractRef | null>(null)
  const [flightDialogOpen, setFlightDialogOpen] = useState(false)

  // Client-side filtered contracts
  const filteredContracts = useMemo(() => {
    if (!filters) return contracts
    let list = contracts

    if (filters.periodFrom && filters.periodTo) {
      list = list.filter(c => {
        const start = c.contractStart
        const end = c.contractEnd || '9999-12-31'
        return start <= filters.periodTo && end >= filters.periodFrom
      })
    }
    if (filters.contractTypes) {
      const types = new Set(filters.contractTypes)
      list = list.filter(c => types.has(c.contractType))
    }
    if (filters.catering) {
      const cats = new Set(filters.catering)
      list = list.filter(c => cats.has(c.catering))
    }
    return list
  }, [contracts, filters])

  const selectedContract = filteredContracts.find(c => c._id === selectedId) ?? null

  useEffect(() => { loadOperator() }, [loadOperator])

  const handleGo = useCallback(async (f: CharterFilterState) => {
    setFilters(f)
    const loaded = await runway.run(async () => {
      // Ensure operator is loaded before querying (idempotent — no-op if already loaded)
      await loadOperator()
      return loadContracts()
    }, 'Loading charter contracts\u2026', 'Contracts loaded')

    setHasLoaded(true)

    // Auto-select first filtered contract
    if (loaded && loaded.length > 0) {
      let firstList = loaded
      if (f.periodFrom && f.periodTo) {
        firstList = firstList.filter(c => {
          const start = c.contractStart
          const end = c.contractEnd || '9999-12-31'
          return start <= f.periodTo && end >= f.periodFrom
        })
      }
      if (f.contractTypes) {
        const types = new Set(f.contractTypes)
        firstList = firstList.filter(c => types.has(c.contractType))
      }
      if (f.catering) {
        const cats = new Set(f.catering)
        firstList = firstList.filter(c => cats.has(c.catering))
      }
      if (firstList.length > 0) {
        await selectContract(firstList[0]._id)
      }
    }
  }, [runway, loadContracts, selectContract])

  const handleContractCreated = useCallback(async () => {
    const refreshed = await loadContracts()
    if (refreshed.length > 0 && !selectedId) {
      await selectContract(refreshed[0]._id)
    }
  }, [loadContracts, selectContract, selectedId])

  const handleContractUpdated = useCallback(async () => {
    await loadContracts()
  }, [loadContracts])

  const handleStatusChanged = useCallback(async () => {
    await loadContracts()
  }, [loadContracts])

  const handleFlightChanged = useCallback(async () => {
    await refreshFlightsAndStats()
    await loadContracts()
  }, [refreshFlightsAndStats, loadContracts])

  const handleEdit = useCallback(() => {
    if (selectedContract) {
      setEditingContract(selectedContract)
      setContractDialogOpen(true)
    }
  }, [selectedContract])

  const handleNewContract = useCallback(() => {
    setEditingContract(null)
    setContractDialogOpen(true)
  }, [])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const glassStyle = { background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }

  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      {/* Left filter panel */}
      <CharterFilterPanel
        loading={runway.active}
        onGo={handleGo}
      />

      {/* Main content — 3 mutually exclusive states, like 1.1.1 */}
      <div className="flex-1 flex flex-col overflow-hidden gap-3 min-w-0 relative">

        {/* ── Empty state: before first load ── */}
        {!hasLoaded && !runway.active && (
          <EmptyPanel message="Select a period and click Go to load charter contracts" />
        )}

        {/* ── Loading: runway animation ── */}
        {runway.active && (
          <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
        )}

        {/* ── Loaded: toolbar + content ── */}
        {hasLoaded && !runway.active && (
          <>
            {/* Toolbar — own glass container */}
            <div className="shrink-0 rounded-2xl overflow-hidden" style={glassStyle}>
              <ContractToolbar
                contract={selectedContract}
                onEdit={handleEdit}
                onStatusChange={handleStatusChanged}
                onNewContract={handleNewContract}
                isDark={isDark}
              />
            </div>

            {/* Content — own glass container with contract sidebar + detail */}
            <div className="flex-1 min-h-0 flex overflow-hidden rounded-2xl" style={glassStyle}>
              {/* Contract sidebar */}
              <ContractSidebar
                contracts={filteredContracts}
                selectedId={selectedId}
                onSelect={selectContract}
                onNewContract={handleNewContract}
                isDark={isDark}
              />

              {/* Detail panel */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <ContractDetailPanel
                  contract={selectedContract}
                  onAddFlight={() => setFlightDialogOpen(true)}
                  onFlightChanged={handleFlightChanged}
                  onContractUpdated={handleContractUpdated}
                  isDark={isDark}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {contractDialogOpen && (
        <ContractFormDialog
          open
          onOpenChange={setContractDialogOpen}
          contract={editingContract}
          onCreated={handleContractCreated}
          onUpdated={handleContractUpdated}
          isDark={isDark}
        />
      )}
      {flightDialogOpen && selectedContract && (
        <FlightFormDialog
          open
          onOpenChange={setFlightDialogOpen}
          contract={selectedContract}
          operatorCode={operator?.code ?? 'VJ'}
          onCreated={handleFlightChanged}
          isDark={isDark}
        />
      )}
    </div>
  )
}
