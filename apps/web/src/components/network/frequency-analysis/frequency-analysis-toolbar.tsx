'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Download,
  Search,
  Plane,
  Route as RouteIcon,
  CalendarDays,
  Clock,
  FileText,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
  X,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useFrequencyAnalysisStore, countActiveFilters } from '@/stores/use-frequency-analysis-store'
import { fmtHM } from './compute-frequency'
import type { FrequencyKpis } from './frequency-analysis-types'

interface FrequencyAnalysisToolbarProps {
  kpis: FrequencyKpis
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void
}

export function FrequencyAnalysisToolbar({ kpis, onExport }: FrequencyAnalysisToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const filters = useFrequencyAnalysisStore((s) => s.filters)
  const setSearchQuery = useFrequencyAnalysisStore((s) => s.setSearchQuery)
  const resetFilters = useFrequencyAnalysisStore((s) => s.resetFilters)
  const activeCount = countActiveFilters(filters)

  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!exportOpen) return
    const onClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [exportOpen])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const chipBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const menuBg = isDark ? 'rgba(25,25,33,0.96)' : 'rgba(255,255,255,0.98)'

  const blockH = Math.floor(kpis.weeklyBlockMin / 60)
  const blockM = kpis.weeklyBlockMin % 60

  return (
    <div
      className="flex items-center gap-3 px-4 shrink-0 rounded-2xl relative z-10"
      style={{
        minHeight: 44,
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* KPI strip */}
      <div className="flex items-center gap-3 mr-auto overflow-x-auto">
        <Stat icon={Plane} label="Unique" value={String(kpis.uniqueFlights)} accent />
        <Sep isDark={isDark} />
        <Stat icon={CalendarDays} label="Weekly Deps" value={String(kpis.weeklyDeps)} accent />
        <Sep isDark={isDark} />
        <Stat icon={Clock} label="Weekly Block" value={`${blockH}:${String(blockM).padStart(2, '0')}`} accent />
        <Sep isDark={isDark} />
        <Stat icon={CalendarDays} label={`Peak · ${kpis.peakDow || '—'}`} value={String(kpis.peakCount)} accent />
        <Sep isDark={isDark} />
        <Stat icon={RouteIcon} label="Routes" value={String(kpis.routeCount)} accent />
        <Sep isDark={isDark} />
        <Stat icon={Plane} label="Avg / Day" value={String(kpis.avgDaily)} accent />
      </div>

      {/* Reset filters */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={resetFilters}
          className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors text-hz-text-secondary hover:text-hz-text"
          style={{ background: chipBg, border: `1px solid ${chipBorder}` }}
          title="Clear active filters"
        >
          <X size={14} />
          <span className="tabular-nums">{activeCount}</span>
        </button>
      )}

      {/* Search */}
      <div
        className="flex items-center gap-2 h-8 px-2.5 rounded-lg"
        style={{ background: chipBg, border: `1px solid ${chipBorder}`, width: 200 }}
      >
        <Search size={14} className="text-hz-text-tertiary shrink-0" />
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search flights…"
          className="bg-transparent outline-none text-[13px] font-medium text-hz-text placeholder:text-hz-text-tertiary flex-1 min-w-0"
        />
        {filters.searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-hz-text-tertiary hover:text-hz-text"
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Export */}
      <div ref={exportRef} className="relative">
        <button
          type="button"
          onClick={() => setExportOpen((o) => !o)}
          className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-[13px] font-semibold transition-opacity bg-module-accent text-white hover:opacity-90"
        >
          <Download size={14} />
          Export
          <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
        </button>
        {exportOpen && (
          <div
            className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50 min-w-[160px]"
            style={{
              background: menuBg,
              border: `1px solid ${chipBorder}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            <ExportItem
              icon={FileText}
              label="Export CSV"
              onClick={() => {
                onExport('csv')
                setExportOpen(false)
              }}
            />
            <ExportItem
              icon={FileSpreadsheet}
              label="Export XLSX"
              onClick={() => {
                onExport('xlsx')
                setExportOpen(false)
              }}
            />
            <ExportItem
              icon={FileDown}
              label="Export PDF"
              onClick={() => {
                onExport('pdf')
                setExportOpen(false)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

interface StatProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  accent?: boolean
}
function Stat({ icon: IconCmp, label, value, accent }: StatProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <IconCmp size={14} className={accent ? 'text-module-accent' : 'text-hz-text-tertiary'} />
      <div className="flex flex-col leading-tight">
        <span
          className="text-[15px] font-bold tabular-nums"
          style={{ color: accent ? 'var(--module-accent, #1e40af)' : undefined }}
        >
          {value}
        </span>
        <span className="text-[13px] font-medium text-hz-text-tertiary uppercase tracking-wide">{label}</span>
      </div>
    </div>
  )
}

function Sep({ isDark }: { isDark: boolean }) {
  return (
    <span
      className="shrink-0 h-6 w-px"
      style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
    />
  )
}

interface ExportItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
}
function ExportItem({ icon: IconCmp, label, onClick }: ExportItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 h-9 px-3 text-[13px] font-medium text-hz-text hover:bg-hz-border/30 transition-colors"
    >
      <IconCmp size={14} className="text-hz-text-tertiary" />
      {label}
    </button>
  )
}
