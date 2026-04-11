'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { ScheduledFlightRef } from '@skyhub/api'
import { Search, Paintbrush, Type } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useScheduleGridStore } from '@/stores/use-schedule-grid-store'
import { formatDate } from '@/lib/date-format'
import { GRID_COLUMNS } from './grid-columns'

export interface ColorFilter {
  type: 'bg' | 'text'
  color: string // "" = no fill / default text
}

interface ColumnFilterDropdownProps {
  colKey: string
  rows: ScheduledFlightRef[]
  activeFilters: Set<string>
  activeColorFilter?: ColorFilter | null
  onApply: (colKey: string, values: Set<string>) => void
  onApplyColor?: (colKey: string, filter: ColorFilter | null) => void
  onClose: () => void
}

export function ColumnFilterDropdown({
  colKey,
  rows,
  activeFilters,
  activeColorFilter,
  onApply,
  onApplyColor,
  onClose,
}: ColumnFilterDropdownProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const opDateFormat = useOperatorStore((s) => s.dateFormat)
  const cellFormats = useScheduleGridStore((s) => s.cellFormats)
  const colDef = GRID_COLUMNS.find((c) => c.key === colKey)
  const isDateCol = colKey === 'effectiveFrom' || colKey === 'effectiveUntil'
  const useMono = colDef?.mono || isDateCol
  const valueFont = useMono
    ? "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    : 'Inter, system-ui, sans-serif'
  const displayValue = (v: string) => (isDateCol ? formatDate(v, opDateFormat) : v)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(activeFilters))
  const [tab, setTab] = useState<'values' | 'color'>('values')
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Get unique values for this column
  const uniqueValues = useMemo(() => {
    const vals = new Set<string>()
    for (const row of rows) {
      const v = (row as any)[colKey]
      if (v != null && v !== '') vals.add(String(v))
    }
    return Array.from(vals).sort()
  }, [rows, colKey])

  // Collect unique bg colors and text colors used in this column
  const { bgColors, textColors } = useMemo(() => {
    const bgs = new Set<string>()
    const txts = new Set<string>()
    for (const row of rows) {
      const fmt = cellFormats.get(`${row._id}:${colKey}`)
      if (fmt?.bgColor) bgs.add(fmt.bgColor)
      if (fmt?.textColor) txts.add(fmt.textColor)
    }
    return { bgColors: Array.from(bgs), textColors: Array.from(txts) }
  }, [rows, colKey, cellFormats])

  const hasColors = bgColors.length > 0 || textColors.length > 0

  const filtered = search
    ? uniqueValues.filter((v) => {
        const q = search.toLowerCase()
        return v.toLowerCase().includes(q) || displayValue(v).toLowerCase().includes(q)
      })
    : uniqueValues

  const allSelected = filtered.every((v) => selected.has(v))

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected)
      filtered.forEach((v) => next.delete(v))
      setSelected(next)
    } else {
      const next = new Set(selected)
      filtered.forEach((v) => next.add(v))
      setSelected(next)
    }
  }

  const toggle = (v: string) => {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    setSelected(next)
  }

  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-30 rounded-xl border border-hz-border shadow-lg overflow-hidden"
      style={{
        animation: 'bc-dropdown-in 150ms cubic-bezier(0.16,1,0.3,1)',
        backgroundColor: isDark ? '#1C1C28' : '#FAFAFC',
        width: 220,
      }}
    >
      {/* Tabs: Values / Color (only show tabs if colors exist) */}
      {hasColors && (
        <div className="flex border-b border-hz-border" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          <button
            onClick={() => setTab('values')}
            className={`flex-1 py-1.5 text-[12px] font-medium transition-colors ${
              tab === 'values'
                ? 'text-module-accent border-b-2 border-module-accent'
                : 'text-hz-text-secondary hover:text-hz-text'
            }`}
          >
            Values
          </button>
          <button
            onClick={() => setTab('color')}
            className={`flex-1 py-1.5 text-[12px] font-medium transition-colors flex items-center justify-center gap-1 ${
              tab === 'color'
                ? 'text-module-accent border-b-2 border-module-accent'
                : 'text-hz-text-secondary hover:text-hz-text'
            }`}
          >
            <Paintbrush size={11} />
            Color
          </button>
        </div>
      )}

      {tab === 'values' && (
        <>
          {/* Search */}
          <div className="p-2 border-b border-hz-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-hz-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter..."
                className="w-full pl-7 pr-2 py-1.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-1 focus:ring-module-accent/30 text-hz-text font-[Inter,system-ui,sans-serif]"
                autoFocus
              />
            </div>
          </div>

          {/* Select all */}
          <div className="px-2 py-1 border-b border-hz-border/50">
            <label
              className="flex items-center gap-2 cursor-pointer text-[13px] text-hz-text-secondary hover:text-hz-text"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-module-accent w-3.5 h-3.5"
              />
              <span className="font-medium">Select All</span>{' '}
              <span className="text-hz-text-tertiary">({filtered.length})</span>
            </label>
          </div>

          {/* Values */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map((v) => (
              <label
                key={v}
                className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-[13px] text-hz-text hover:bg-hz-border/20"
              >
                <input
                  type="checkbox"
                  checked={selected.has(v)}
                  onChange={() => toggle(v)}
                  className="accent-module-accent w-3.5 h-3.5"
                />
                <span className="truncate" style={{ fontFamily: valueFont }}>
                  {displayValue(v)}
                </span>
              </label>
            ))}
            {filtered.length === 0 && <p className="text-[13px] text-hz-text-tertiary px-2 py-2">No values</p>}
          </div>

          {/* Actions */}
          <div
            className="flex items-center gap-1 p-2 border-t border-hz-border"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            <button
              onClick={() => {
                onApply(colKey, selected)
                onClose()
              }}
              className="flex-1 py-1 rounded-lg text-[13px] font-medium text-white bg-module-accent hover:opacity-90 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => {
                onApply(colKey, new Set(uniqueValues))
                onClose()
              }}
              className="px-2 py-1 rounded-lg text-[13px] text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
            >
              Clear
            </button>
          </div>
        </>
      )}

      {tab === 'color' && (
        <div className="p-2 space-y-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {/* Cell Color */}
          {bgColors.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Paintbrush size={11} className="text-hz-text-tertiary" />
                <span className="text-[12px] font-medium text-hz-text-secondary">Cell Color</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bgColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onApplyColor?.(colKey, { type: 'bg', color })
                      onClose()
                    }}
                    className="rounded-md transition-transform hover:scale-110"
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: color,
                      border: `2px solid ${borderColor}`,
                      outline:
                        activeColorFilter?.type === 'bg' && activeColorFilter.color === color
                          ? '2px solid var(--color-module-accent)'
                          : 'none',
                      outlineOffset: 1,
                    }}
                    title={color}
                  />
                ))}
                <button
                  onClick={() => {
                    onApplyColor?.(colKey, { type: 'bg', color: '' })
                    onClose()
                  }}
                  className="rounded-md text-[11px] text-hz-text-tertiary hover:text-hz-text px-2 transition-colors"
                  style={{ height: 28, border: `1px dashed ${borderColor}` }}
                >
                  No Fill
                </button>
              </div>
            </div>
          )}

          {/* Font Color */}
          {textColors.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Type size={11} className="text-hz-text-tertiary" />
                <span className="text-[12px] font-medium text-hz-text-secondary">Font Color</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {textColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onApplyColor?.(colKey, { type: 'text', color })
                      onClose()
                    }}
                    className="rounded-md transition-transform hover:scale-110"
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: color,
                      border: `2px solid ${borderColor}`,
                      outline:
                        activeColorFilter?.type === 'text' && activeColorFilter.color === color
                          ? '2px solid var(--color-module-accent)'
                          : 'none',
                      outlineOffset: 1,
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Clear color filter */}
          {activeColorFilter && (
            <button
              onClick={() => {
                onApplyColor?.(colKey, null)
                onClose()
              }}
              className="w-full py-1 rounded-lg text-[12px] text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
            >
              Clear Color Filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
