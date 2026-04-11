'use client'

import { useState } from 'react'
import { Plane } from 'lucide-react'
import type { CharterContractRef } from '@skyhub/api'
import { FlightsTab } from './flights-tab'
import { DetailsTab } from './details-tab'
import { CostsTab } from './costs-tab'
import { NotesTab } from './notes-tab'

type TabKey = 'flights' | 'details' | 'costs' | 'notes'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'flights', label: 'Flights' },
  { key: 'details', label: 'Details' },
  { key: 'costs', label: 'Costs' },
  { key: 'notes', label: 'Notes' },
]

interface ContractDetailPanelProps {
  contract: CharterContractRef | null
  onAddFlight: () => void
  onFlightChanged: () => void
  onContractUpdated: () => void
  isDark: boolean
}

export function ContractDetailPanel({
  contract,
  onAddFlight,
  onFlightChanged,
  onContractUpdated,
  isDark,
}: ContractDetailPanelProps) {
  const [tab, setTab] = useState<TabKey>('flights')

  if (!contract) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Plane size={40} style={{ opacity: 0.15 }} className="text-hz-text-tertiary" />
        <span className="text-[14px] text-hz-text-tertiary">Select a contract to view details</span>
      </div>
    )
  }

  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex gap-1 px-5 shrink-0" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-3 text-[13px] font-semibold transition-colors relative"
            style={{ color: tab === t.key ? (isDark ? '#5B8DEF' : '#1e40af') : isDark ? '#8F90A6' : '#555770' }}
          >
            {t.label}
            {tab === t.key && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: isDark ? '#5B8DEF' : '#1e40af' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'flights' && (
          <FlightsTab contract={contract} onAddFlight={onAddFlight} onFlightChanged={onFlightChanged} isDark={isDark} />
        )}
        {tab === 'details' && <DetailsTab contract={contract} isDark={isDark} />}
        {tab === 'costs' && <CostsTab contract={contract} isDark={isDark} />}
        {tab === 'notes' && <NotesTab contract={contract} onUpdated={onContractUpdated} isDark={isDark} />}
      </div>
    </div>
  )
}
