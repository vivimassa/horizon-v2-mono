'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { fetchFlightDetail, saveFlightInstance } from '@/lib/gantt/flight-detail-api'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'
import { InfoHeader } from './info-header'
import { TimesTab } from './times-tab'
import { DelaysTab } from './delays-tab'
import { PassengersTab } from './passengers-tab'
import { FuelCargoTab } from './fuel-cargo-tab'
import { CrewTab } from './crew-tab'
import { MemosTab } from './memos-tab'
import { MessagesTab } from './messages-tab'
import { AuditTab } from './audit-tab'

const TABS = [
  { id: 'times', label: 'Times' },
  { id: 'delays', label: 'Delays' },
  { id: 'passengers', label: 'Passengers' },
  { id: 'fuel-cargo', label: 'Fuel & Cargo' },
  { id: 'crew', label: 'Crew' },
  { id: 'memos', label: 'Memos' },
  { id: 'messages', label: 'Messages' },
  { id: 'audit', label: 'Audit' },
] as const

type TabKey = (typeof TABS)[number]['id']

export function FlightInformationDialog() {
  const flightId = useGanttStore((s) => s.flightInfoDialogId)
  const closeFlightInfo = useGanttStore((s) => s.closeFlightInfo)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [data, setData] = useState<FlightDetail | null>(null)
  const [draft, setDraft] = useState<FlightDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('times')
  const [mounted, setMounted] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch flight detail when dialog opens
  useEffect(() => {
    if (!flightId) {
      setData(null)
      setDraft(null)
      setDirty(false)
      return
    }
    const [sfId, opDate] = flightId.split('|')
    if (!sfId || !opDate) return

    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    setLoading(true)
    setError(null)
    setActiveTab('times')
    setDirty(false)

    fetchFlightDetail(sfId, opDate, operatorId)
      .then((d) => {
        setData(d)
        setDraft(structuredClone(d))
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [flightId])

  // Update a nested field in draft
  const updateDraft = useCallback((updater: (d: FlightDetail) => void) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      updater(next)
      return next
    })
    setDirty(true)
  }, [])

  // Save handler
  const handleSave = useCallback(async () => {
    if (!draft || saving) return
    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    setSaving(true)
    try {
      await saveFlightInstance({
        operatorId,
        scheduledFlightId: draft.scheduledFlightId,
        operatingDate: draft.operatingDate,
        flightNumber: draft.flightNumber,
        actual: draft.actual,
        depInfo: draft.depInfo,
        arrInfo: draft.arrInfo,
        pax: draft.pax,
        fuel: draft.fuel,
        cargo: draft.cargo,
        delays: draft.delays,
        memos: draft.memos,
        connections: draft.connections,
        scenarioId: useOperatorStore.getState().activeScenarioId ?? undefined,
      })
      setData(structuredClone(draft))
      setDirty(false)
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }, [draft, saving])

  const saveRef = useRef(handleSave)
  saveRef.current = handleSave

  // Ctrl+S to save
  useEffect(() => {
    if (!flightId) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [flightId])

  if (!mounted || !flightId) return null

  const bg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.97)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const accent = 'var(--module-accent, #1e40af)'
  const muted = isDark ? '#8F90A6' : '#555770'

  const content = (
    <div
      data-gantt-overlay
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeFlightInfo()
      }}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl"
        style={{
          width: 1040,
          maxWidth: '95vw',
          maxHeight: '85vh',
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(24px)',
          boxShadow: isDark
            ? '0 16px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)'
            : '0 16px 64px rgba(96,97,112,0.18), 0 4px 16px rgba(96,97,112,0.08)',
        }}
      >
        {/* Save + Close buttons */}
        <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="h-9 px-6 rounded-xl text-[13px] font-bold text-white transition-opacity disabled:opacity-40"
            style={{ background: accent }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
          <button
            onClick={closeFlightInfo}
            className="rounded-xl h-8 w-8 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          >
            <X size={16} style={{ color: muted }} />
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin" style={{ color: accent }} />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center py-24">
            <span className="text-[13px]" style={{ color: '#FF3B3B' }}>
              Failed to load: {error}
            </span>
          </div>
        )}

        {/* Content */}
        {draft && !loading && (
          <>
            <InfoHeader data={draft} />

            {/* Tab bar — pill container matching V1 */}
            <div className="px-7 mb-5">
              <div
                className="flex rounded-full p-1 h-[38px]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${border}`,
                }}
              >
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex-1 text-[13px] font-semibold rounded-full transition-all duration-200"
                      style={{
                        color: isActive ? accent : muted,
                        background: isActive
                          ? isDark
                            ? 'rgba(255,255,255,0.10)'
                            : 'rgba(255,255,255,0.70)'
                          : 'transparent',
                        boxShadow: isActive ? 'inset 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        fontWeight: isActive ? 700 : 600,
                      }}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0 px-7 pb-6">
              {activeTab === 'times' && <TimesTab data={draft} onUpdate={updateDraft} />}
              {activeTab === 'delays' && <DelaysTab data={draft} onUpdate={updateDraft} />}
              {activeTab === 'passengers' && <PassengersTab data={draft} onUpdate={updateDraft} />}
              {activeTab === 'fuel-cargo' && <FuelCargoTab data={draft} onUpdate={updateDraft} />}
              {activeTab === 'crew' && <CrewTab data={draft} />}
              {activeTab === 'memos' && <MemosTab data={draft} onUpdate={updateDraft} />}
              {activeTab === 'messages' && <MessagesTab data={draft} />}
              {activeTab === 'audit' && <AuditTab data={draft} />}
            </div>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
