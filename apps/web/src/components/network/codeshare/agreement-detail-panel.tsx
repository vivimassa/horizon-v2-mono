'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plane, AlertTriangle } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type {
  CodeshareAgreementRef,
  CodeshareMappingRef,
  CodeshareSeatAllocationRef,
  CodeshareAgreementStats,
} from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import type { TabKey, MappingHealth } from './codeshare-types'
import { TABS, AGREEMENT_TYPE_LABELS, STATUS_COLORS } from './codeshare-types'
import { MappingsTab } from './mappings-tab'
import { DetailsTab } from './details-tab'
import { CapacityTab } from './capacity-tab'
import { SsimTab } from './ssim-tab'
import { MappingDialog } from './mapping-dialog'
import { AgreementDialog } from './agreement-dialog'
import { BulkImportDialog } from './bulk-import-dialog'
import { AirlineLogo } from './airline-logo'

interface AgreementDetailPanelProps {
  agreement: CodeshareAgreementRef
  operatorCode: string
  isDark: boolean
  onDataChanged: () => void
}

export function AgreementDetailPanel({ agreement, operatorCode, isDark, onDataChanged }: AgreementDetailPanelProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const [tab, setTab] = useState<TabKey>('mappings')
  const [mappings, setMappings] = useState<CodeshareMappingRef[]>([])
  const [stats, setStats] = useState<CodeshareAgreementStats>({ mappedFlights: 0, routeCount: 0, weeklySeats: 0 })
  const [healthMap, setHealthMap] = useState<Record<string, MappingHealth>>({})
  const [seatCapacity, setSeatCapacity] = useState<Record<string, number>>({})
  const [allAllocations, setAllAllocations] = useState<CodeshareSeatAllocationRef[]>([])
  const [cabinConfigs, setCabinConfigs] = useState<Record<string, Record<string, number>>>({})
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState<CodeshareMappingRef | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Per-mapping allocation map
  const allocsByMapping = useMemo(() => {
    const map = new Map<string, CodeshareSeatAllocationRef[]>()
    for (const a of allAllocations) {
      const list = map.get(a.mappingId) || []
      list.push(a)
      map.set(a.mappingId, list)
    }
    return map
  }, [allAllocations])

  const loadData = useCallback(async () => {
    const opId = getOperatorId()
    const [m, s, h, sc, allocs, configs] = await Promise.all([
      api.getCodeshareMappings(agreement._id),
      api.getCodeshareStats(agreement._id),
      api.getCodeshareMappingHealth(agreement._id, opId),
      api.getCodeshareFlightCapacity(opId),
      api.getCodeshareSeatAllocations({ agreementId: agreement._id }),
      api.getCodeshareCabinConfigs(opId),
    ])
    setMappings(m)
    setStats(s)
    setHealthMap(h as Record<string, MappingHealth>)
    setSeatCapacity(sc)
    setAllAllocations(allocs)
    setCabinConfigs(configs)
  }, [agreement._id])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  function handleMappingChanged() {
    setRefreshKey((k) => k + 1)
    onDataChanged()
  }

  async function handleSuspend() {
    await api.suspendCodeshareAgreement(agreement._id)
    onDataChanged()
  }

  const seasonLabel =
    new Date(agreement.effectiveFrom).getFullYear() >= 2025
      ? `S${String(new Date(agreement.effectiveFrom).getFullYear()).slice(2)}`
      : ''

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0"
        style={{ borderBottom: `1px solid ${glassBorder}` }}
      >
        <div className="flex items-center gap-3">
          <AirlineLogo iataCode={agreement.partnerAirlineCode} size={40} isDark={isDark} />
          <div>
            <div className="text-[15px] font-semibold" style={{ color: palette.text }}>
              {agreement.partnerAirlineName}
            </div>
            <div className="text-[13px]" style={{ color: palette.textSecondary }}>
              {AGREEMENT_TYPE_LABELS[agreement.agreementType]} agreement
              {seasonLabel && (
                <>
                  {' '}
                  &middot; <span className="font-mono">{seasonLabel}</span>
                </>
              )}
              {' \u00b7 Since '}
              <span className="font-mono">{agreement.effectiveFrom}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditDialogOpen(true)}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${glassBorder}`,
              color: palette.text,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
            }}
          >
            Edit agreement
          </button>
          {agreement.status !== 'suspended' && agreement.status !== 'terminated' && (
            <button
              type="button"
              onClick={handleSuspend}
              className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
              style={{
                background: 'rgba(255,136,0,0.1)',
                border: '1px solid rgba(255,136,0,0.25)',
                color: '#FF8800',
              }}
            >
              <AlertTriangle size={14} />
              Suspend
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-5 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors duration-150 relative"
            style={{
              borderBottomColor: tab === t.key ? accent : 'transparent',
              color: tab === t.key ? accent : palette.textTertiary,
              top: 1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'mappings' && (
        <MappingsTab
          agreement={agreement}
          operatorCode={operatorCode}
          mappings={mappings}
          stats={stats}
          healthMap={healthMap}
          isDark={isDark}
          onAddMapping={() => setMappingDialogOpen(true)}
          onEditMapping={(m) => {
            setEditingMapping(m)
            setMappingDialogOpen(true)
          }}
          onBulkImport={() => setBulkImportOpen(true)}
          onSwitchTab={setTab}
          onMappingChanged={handleMappingChanged}
        />
      )}
      {tab === 'details' && <DetailsTab agreement={agreement} isDark={isDark} onUpdated={onDataChanged} />}
      {tab === 'capacity' && (
        <CapacityTab
          agreement={agreement}
          mappings={mappings}
          seatCapacity={seatCapacity}
          allocsByMapping={allocsByMapping}
          cabinConfigs={cabinConfigs}
          isDark={isDark}
          onAllocationChanged={handleMappingChanged}
        />
      )}
      {tab === 'ssim' && (
        <SsimTab agreement={agreement} mappings={mappings} operatorCode={operatorCode} isDark={isDark} />
      )}

      {/* Dialogs */}
      {mappingDialogOpen && (
        <MappingDialog
          open
          onOpenChange={(open) => {
            setMappingDialogOpen(open)
            if (!open) setEditingMapping(null)
          }}
          agreement={agreement}
          mapping={editingMapping}
          isDark={isDark}
          onMappingChanged={handleMappingChanged}
        />
      )}
      {editDialogOpen && (
        <AgreementDialog
          open
          onOpenChange={setEditDialogOpen}
          agreement={agreement}
          isDark={isDark}
          onCreated={() => onDataChanged()}
        />
      )}
      {bulkImportOpen && (
        <BulkImportDialog
          open
          onOpenChange={setBulkImportOpen}
          agreement={agreement}
          isDark={isDark}
          onMappingChanged={handleMappingChanged}
        />
      )}
    </div>
  )
}
