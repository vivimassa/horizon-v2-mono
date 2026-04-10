'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, X,
  Users, Package, Building2, Handshake, Heart, Moon, Trophy, FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CharterContractRef } from '@skyhub/api'
import { getStatusStyle, CONTRACT_TYPE_ICONS } from './charter-types'
import type { ContractType, ContractStatus } from './charter-types'

const ICON_MAP: Record<string, LucideIcon> = {
  Users, Package, Building2, Handshake, Heart, Moon, Trophy, FileText,
}

function formatDateRange(start: string, end: string | null): string {
  const fmt = (d: string) => {
    const dt = new Date(d)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`
  }
  return end ? `${fmt(start)} \u2013 ${fmt(end)}` : `${fmt(start)} \u2013 Open`
}

interface ContractSidebarProps {
  contracts: CharterContractRef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewContract: () => void
  isDark: boolean
}

/**
 * Compact contract list sidebar that renders inside the main glass content area
 * (not a standalone left panel — the filter panel is the standalone left panel).
 */
export function ContractSidebar({ contracts, selectedId, onSelect, onNewContract, isDark }: ContractSidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return contracts
    const q = search.toLowerCase()
    return contracts.filter(c =>
      c.contractNumber.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q)
    )
  }, [contracts, search])

  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'

  return (
    <div className="shrink-0 flex flex-col h-full" style={{ width: 280, borderRight: `1px solid ${sectionBorder}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 shrink-0" style={{ minHeight: 44, borderBottom: `1px solid ${sectionBorder}` }}>
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold">Contracts</span>
          <span className="px-1.5 py-0.5 rounded-full text-[13px] font-bold" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: isDark ? '#8F90A6' : '#555770' }}>
            {contracts.length}
          </span>
        </div>
        <button onClick={onNewContract}
          className="p-1.5 rounded-lg hover:bg-hz-border/20 transition-colors text-module-accent"
          title="New contract">
          <Plus size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hz-text-tertiary" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full h-8 pl-8 pr-7 rounded-lg text-[13px] font-medium outline-none"
            style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X size={13} className="text-hz-text-tertiary" />
            </button>
          )}
        </div>
      </div>

      {/* Contract list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-hz-text-tertiary">No contracts found</div>
        ) : (
          filtered.map(c => (
            <ContractCard key={c._id} contract={c} isSelected={c._id === selectedId} onSelect={() => onSelect(c._id)} isDark={isDark} />
          ))
        )}
      </div>
    </div>
  )
}

function ContractCard({ contract, isSelected, onSelect, isDark }: {
  contract: CharterContractRef
  isSelected: boolean
  onSelect: () => void
  isDark: boolean
}) {
  const iconName = CONTRACT_TYPE_ICONS[contract.contractType as ContractType] || 'FileText'
  const Icon = ICON_MAP[iconName] || FileText
  const status = getStatusStyle(contract.status as ContractStatus, isDark)

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left"
      style={{
        background: isSelected
          ? (isDark ? 'rgba(62,123,250,0.12)' : 'rgba(30,64,175,0.08)')
          : 'transparent',
      }}
    >
      {/* Type icon */}
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
        <Icon size={13} className="text-hz-text-secondary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[13px] font-bold font-mono truncate">{contract.contractNumber}</span>
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold capitalize"
            style={{ background: status.background, color: status.color, border: `1px solid ${status.borderColor}` }}>
            {contract.status}
          </span>
        </div>
        <div className="text-[13px] font-medium text-hz-text-secondary truncate">{contract.clientName}</div>
        <div className="text-[13px] text-hz-text-tertiary">{formatDateRange(contract.contractStart, contract.contractEnd)}</div>
      </div>
    </button>
  )
}
