'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Dropdown } from '@/components/ui/dropdown'

export interface CodeshareFilterState {
  dateFrom: string
  dateTo: string
  status: string
  agreementType: string
}

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
]

const AGREEMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'free_sale', label: 'Free-sale' },
  { value: 'block_space', label: 'Block space' },
  { value: 'hard_block', label: 'Hard block' },
]

interface CodeshareFilterPanelProps {
  forceCollapsed?: boolean
  loading?: boolean
  onGo: (filters: CodeshareFilterState) => void
}

export function CodeshareFilterPanel({ forceCollapsed = false, loading = false, onGo }: CodeshareFilterPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [collapsed, setCollapsed] = useState(false)

  // Default to current year range
  const now = new Date()
  const yearStart = `${now.getFullYear()}-01-01`
  const yearEnd = `${now.getFullYear()}-12-31`

  const [dateFrom, setDateFrom] = useState(yearStart)
  const [dateTo, setDateTo] = useState(yearEnd)
  const [status, setStatus] = useState('')
  const [agreementType, setAgreementType] = useState('')

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  const periodMissing = !dateFrom || !dateTo

  const activeCount = [dateFrom, dateTo].filter(Boolean).length + (status ? 1 : 0) + (agreementType ? 1 : 0)

  function handleGo() {
    if (periodMissing) return
    onGo({ dateFrom, dateTo, status, agreementType })
    setCollapsed(true)
  }

  return (
    <div
      className="shrink-0 h-full flex flex-col rounded-2xl overflow-hidden relative"
      style={{
        width: collapsed ? 44 : 300,
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Collapsed view */}
      <div
        className="absolute inset-0 flex flex-col items-center cursor-pointer hover:bg-hz-border/20 transition-colors"
        onClick={() => {
          if (collapsed) setCollapsed(false)
        }}
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      >
        <div className="h-12 w-full flex items-center justify-center">
          <ChevronRight size={16} className="text-hz-text-secondary" />
        </div>
        <div
          className="flex-1 flex items-center justify-center"
          style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
        >
          <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">
            Filters
          </span>
        </div>
      </div>

      {/* Expanded view */}
      <div
        className="flex flex-col h-full min-w-[300px]"
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: 'opacity 200ms ease',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ minHeight: 48, borderBottom: `1px solid ${sectionBorder}` }}
        >
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-module-accent" />
            <span className="text-[15px] font-bold">Filters</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-module-accent text-white text-[13px] font-bold">
                {activeCount}
              </span>
            )}
          </div>
          <button onClick={() => setCollapsed(true)} className="p-1 rounded-md hover:bg-hz-border/30 transition-colors">
            <ChevronLeft size={16} className="text-hz-text-tertiary" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Period */}
          <FilterSection label="Period">
            <DateRangePicker from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} inline />
          </FilterSection>

          {/* Status */}
          <FilterSection label="Agreement Status">
            <Dropdown value={status || null} options={STATUSES} onChange={setStatus} placeholder="All Statuses" />
          </FilterSection>

          {/* Agreement Type */}
          <FilterSection label="Agreement Type">
            <Dropdown
              value={agreementType || null}
              options={AGREEMENT_TYPES}
              onChange={setAgreementType}
              placeholder="All Types"
            />
          </FilterSection>
        </div>

        {/* Go Button */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          <button
            onClick={handleGo}
            disabled={loading || periodMissing}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Loading...' : 'Go'}
          </button>
          {periodMissing && (
            <p className="text-[13px] text-hz-text-secondary mt-1.5 text-center">Select the period to continue</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary block">{label}</label>
      {children}
    </div>
  )
}
