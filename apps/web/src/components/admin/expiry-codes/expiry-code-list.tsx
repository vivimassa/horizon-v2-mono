'use client'

import { useState, memo } from 'react'
import type { ExpiryCodeRef, ExpiryCodeCategoryRef } from '@skyhub/api'
import { EXPIRY_FORMULAS } from '@skyhub/logic'
import { Search, Plus, ChevronRight } from 'lucide-react'
import { ACCENT } from './expiry-codes-shell'

interface ExpiryCodeListProps {
  groups: [string, ExpiryCodeRef[]][]
  totalCount: number
  selected: ExpiryCodeRef | null
  onSelect: (c: ExpiryCodeRef) => void
  search: string
  onSearchChange: (v: string) => void
  loading: boolean
  onAddClick: () => void
  categoryMap: Map<string, ExpiryCodeCategoryRef>
}

const crewCategoryColors: Record<string, string> = {
  cockpit: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  cabin: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  both: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
}

export const ExpiryCodeList = memo(function ExpiryCodeList({
  groups,
  totalCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onAddClick,
  categoryMap,
}: ExpiryCodeListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Expiry Codes</h2>
            <span className="text-[11px] text-hz-text-secondary">
              {totalCount} code{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onAddClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search code, name, formula..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No expiry codes found</div>
        ) : (
          groups.map(([category, items]) => {
            // Find color for this category group
            const catRef = Array.from(categoryMap.values()).find((c) => c.label === category)
            const catColor = catRef?.color ?? ACCENT

            return (
              <div key={category}>
                <button
                  onClick={() => toggle(category)}
                  className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
                >
                  <ChevronRight
                    className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${!collapsed.has(category) ? 'rotate-90' : ''}`}
                  />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-hz-text-secondary/70">
                    {category}
                  </span>
                  <span className="text-[10px] text-hz-text-secondary/40">({items.length})</span>
                  <div className="flex-1 h-px bg-hz-border/50 ml-1" />
                </button>
                {!collapsed.has(category) && (
                  <div className="space-y-0.5">
                    {items.map((c) => {
                      const isSel = selected?._id === c._id
                      const formulaDef = EXPIRY_FORMULAS.find((f) => f.id === c.formula)
                      return (
                        <button
                          key={c._id}
                          onClick={() => onSelect(c)}
                          className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                            isSel
                              ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                              : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                          } ${!c.isActive ? 'opacity-40' : ''}`}
                        >
                          {/* Code */}
                          <span
                            className="text-[13px] font-bold font-mono shrink-0"
                            style={{ color: c.isActive ? ACCENT : undefined }}
                          >
                            {c.code}
                          </span>
                          {/* Name + formula */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{c.name}</div>
                            <div className="text-[11px] text-hz-text-secondary truncate">
                              {formulaDef?.label ?? c.formula}
                            </div>
                          </div>
                          {/* Crew category badge */}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize shrink-0 ${crewCategoryColors[c.crewCategory] ?? ''}`}
                          >
                            {c.crewCategory === 'both' ? 'All' : c.crewCategory === 'cockpit' ? 'FD' : 'CC'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})
