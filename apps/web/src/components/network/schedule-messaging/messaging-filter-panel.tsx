'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { collapseDock } from '@/lib/dock-store'
import { useScheduleMessagingStore } from '@/stores/use-schedule-messaging-store'

const DIRECTIONS = [
  { value: '', label: 'All Directions' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
]

const MSG_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'ASM', label: 'ASM' },
  { value: 'SSM', label: 'SSM' },
]

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'held', label: 'Held' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'applied', label: 'Applied' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'discarded', label: 'Discarded' },
]

interface MessagingFilterPanelProps {
  forceCollapsed?: boolean
  loading?: boolean
  onGo: () => void
}

export function MessagingFilterPanel({ forceCollapsed = false, loading = false, onGo }: MessagingFilterPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [collapsed, setCollapsed] = useState(false)
  const setFilter = useScheduleMessagingStore((s) => s.setFilter)
  const filters = useScheduleMessagingStore((s) => s.filters)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [direction, setDirection] = useState('')
  const [msgType, setMsgType] = useState('')
  const [status, setStatus] = useState('')
  const [flightNumber, setFlightNumber] = useState('')

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const activeCount = mounted ? [dateFrom, dateTo, direction, msgType, status, flightNumber].filter(Boolean).length : 0

  function handleGo() {
    collapseDock()
    if (direction) setFilter('direction', direction as 'inbound' | 'outbound')
    else setFilter('direction', undefined)
    if (msgType) setFilter('messageTypes', [msgType])
    else setFilter('messageTypes', undefined)
    if (status) setFilter('status', status as any)
    else setFilter('status', undefined)
    if (flightNumber) setFilter('flightNumber', flightNumber)
    else setFilter('flightNumber', undefined)
    if (dateFrom) setFilter('flightDateFrom', dateFrom)
    else setFilter('flightDateFrom', undefined)
    if (dateTo) setFilter('flightDateTo', dateTo)
    else setFilter('flightDateTo', undefined)
    onGo()
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
          {/* Flight Date Range */}
          <FilterSection label="Flight Date">
            <DateRangePicker from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} inline />
          </FilterSection>

          {/* Direction */}
          <FilterSection label="Direction">
            <SelectInput
              value={direction}
              onChange={setDirection}
              options={DIRECTIONS}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Message Type */}
          <FilterSection label="Message Type">
            <SelectInput
              value={msgType}
              onChange={setMsgType}
              options={MSG_TYPES}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Status */}
          <FilterSection label="Status">
            <SelectInput
              value={status}
              onChange={setStatus}
              options={STATUSES}
              isDark={isDark}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </FilterSection>

          {/* Flight Number */}
          <FilterSection label="Flight Number">
            <input
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
              placeholder="e.g. VJ100"
              className="w-full h-9 px-3 rounded-xl text-[13px] font-mono outline-none"
              style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
            />
          </FilterSection>
        </div>

        {/* Go button */}
        <div className="shrink-0 px-5 pb-4">
          <button
            onClick={handleGo}
            disabled={loading}
            className="w-full h-10 rounded-xl text-[14px] font-semibold text-white bg-module-accent hover:opacity-90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Loading\u2026' : 'Go'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[13px] font-semibold text-hz-text-secondary block mb-2">{label}</label>
      {children}
    </div>
  )
}

function SelectInput({
  value,
  onChange,
  options,
  isDark,
  inputBg,
  inputBorder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  isDark: boolean
  inputBg: string
  inputBorder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-8 rounded-xl text-[13px] font-medium appearance-none cursor-pointer outline-none"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-hz-text-tertiary"
      />
    </div>
  )
}
