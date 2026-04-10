'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Search, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { CONTRACT_TYPE_LABELS } from './charter-types'
import type { ContractType } from './charter-types'

const CONTRACT_TYPES: { key: ContractType; label: string }[] = (
  Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]
).map(([k, v]) => ({ key: k, label: v }))

const CATERING_OPTIONS: { key: string; label: string }[] = [
  { key: 'operator', label: 'Operator provides' },
  { key: 'client', label: 'Client provides' },
  { key: 'none', label: 'None' },
]

export interface CharterFilterState {
  periodFrom: string
  periodTo: string
  contractTypes: string[] | null
  catering: string[] | null
}

interface CharterFilterPanelProps {
  loading?: boolean
  onGo: (filters: CharterFilterState) => void
}

export function CharterFilterPanel({ loading = false, onGo }: CharterFilterPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [collapsed, setCollapsed] = useState(false)

  // Default date range: past year to next 6 months
  const now = new Date()
  const defaultFrom = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const sixMonths = new Date(now.getFullYear(), now.getMonth() + 6, 0)
  const defaultTo = `${sixMonths.getFullYear()}-${String(sixMonths.getMonth() + 1).padStart(2, '0')}-${String(sixMonths.getDate()).padStart(2, '0')}`

  const [periodFrom, setPeriodFrom] = useState(defaultFrom)
  const [periodTo, setPeriodTo] = useState(defaultTo)
  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null)
  const [selectedCatering, setSelectedCatering] = useState<Set<string> | null>(null)

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const periodMissing = !periodFrom || !periodTo

  const activeCount =
    (periodFrom && periodTo ? 1 : 0) +
    (selectedTypes !== null ? 1 : 0) +
    (selectedCatering !== null ? 1 : 0)

  function handleGo() {
    onGo({
      periodFrom,
      periodTo,
      contractTypes: selectedTypes ? [...selectedTypes] : null,
      catering: selectedCatering ? [...selectedCatering] : null,
    })
    setCollapsed(true)
  }

  return (
    <div
      className="shrink-0 h-full flex flex-col rounded-2xl overflow-hidden"
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
        onClick={() => { if (collapsed) setCollapsed(false) }}
        style={{ opacity: collapsed ? 1 : 0, pointerEvents: collapsed ? 'auto' : 'none', transition: 'opacity 200ms ease' }}
      >
        <div className="h-12 w-full flex items-center justify-center">
          <ChevronRight size={16} className="text-hz-text-secondary" />
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">Filters</span>
        </div>
      </div>

      {/* Expanded view */}
      <div
        className="flex flex-col h-full min-w-[300px]"
        style={{ opacity: collapsed ? 0 : 1, pointerEvents: collapsed ? 'none' : 'auto', transition: 'opacity 200ms ease' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 shrink-0" style={{ minHeight: 48, borderBottom: `1px solid ${sectionBorder}` }}>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-module-accent" />
            <span className="text-[15px] font-bold">Filters</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-module-accent text-white text-[13px] font-bold">{activeCount}</span>
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
            <DateRangePicker
              from={periodFrom}
              to={periodTo}
              onChangeFrom={setPeriodFrom}
              onChangeTo={setPeriodTo}
              inline
            />
          </FilterSection>

          {/* Contract Type */}
          <FilterSection label="Contract Type">
            <MultiDropdown
              items={CONTRACT_TYPES}
              value={selectedTypes}
              onChange={setSelectedTypes}
              allLabel="All Types"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Catering */}
          <FilterSection label="Catering">
            <MultiDropdown
              items={CATERING_OPTIONS}
              value={selectedCatering}
              onChange={setSelectedCatering}
              allLabel="All Catering"
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>
        </div>

        {/* Go Button */}
        <div className="px-5 py-4 shrink-0 space-y-2" style={{ borderTop: `1px solid ${sectionBorder}` }}>
          {periodMissing && (
            <p className="text-[13px] text-hz-text-tertiary text-center">Select the period to continue</p>
          )}
          <button
            onClick={handleGo}
            disabled={loading || periodMissing}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Loading...' : 'Go'}
          </button>
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

function MultiDropdown({ items, value, onChange, allLabel, isDark, inputBg, inputBorder }: {
  items: { key: string; label: string }[]
  value: Set<string> | null
  onChange: (v: Set<string> | null) => void
  allLabel: string
  isDark: boolean; inputBg: string; inputBorder: string
}) {
  const [open, setOpen] = useState(false)
  const allSelected = value === null || items.every(i => value.has(i.key))

  const label = allSelected
    ? allLabel
    : items.filter(i => value?.has(i.key)).map(i => i.label).join(', ') || 'None'

  function toggle(key: string) {
    const all = new Set(items.map(i => i.key))
    if (value === null) { all.delete(key); onChange(all) }
    else {
      const next = new Set(value)
      if (next.has(key)) next.delete(key); else next.add(key)
      if (items.every(i => next.has(i.key))) onChange(null)
      else onChange(next)
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-xl text-[13px] font-medium transition-colors"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
        <span className="truncate text-hz-text">{label}</span>
        <ChevronDown size={14} className={`text-hz-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden py-1 max-h-[200px] overflow-y-auto"
          style={{
            background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${inputBorder}`,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)',
          }}>
          {items.map(item => {
            const checked = value === null || value.has(item.key)
            const accentColor = 'var(--module-accent, #1e40af)'
            return (
              <button key={item.key} onClick={() => toggle(item.key)}
                className="w-full flex items-center gap-2.5 h-8 px-3 hover:bg-hz-border/20 transition-colors">
                <span className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                  style={{ borderColor: checked ? accentColor : (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'), background: checked ? accentColor : 'transparent' }}>
                  {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span className="text-[13px] font-medium text-hz-text">{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
