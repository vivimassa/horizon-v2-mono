'use client'

import type { MaintenanceCheckTypeRef } from '@skyhub/api'
import { Search, Plus } from 'lucide-react'

interface MaintenanceCheckListProps {
  checkTypes: MaintenanceCheckTypeRef[]
  totalCount: number
  filteredCount: number
  selected: MaintenanceCheckTypeRef | null
  onSelect: (ct: MaintenanceCheckTypeRef) => void
  search: string
  onSearchChange: (value: string) => void
  loading: boolean
  onCreateClick: () => void
}

export function MaintenanceCheckList({
  checkTypes,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onCreateClick,
}: MaintenanceCheckListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Check Types</h2>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-hz-text-secondary">
              {filteredCount !== totalCount ? `${filteredCount}/` : ''}
              {totalCount}
            </span>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] font-semibold text-white transition-colors bg-module-accent"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search checks..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : checkTypes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[13px] text-hz-text-secondary">No check types found</p>
            <p className="text-[13px] text-hz-text-secondary/50 mt-1">Click Add to create one</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {checkTypes.map((ct) => {
              const isSelected = selected?._id === ct._id
              const intervalParts = [
                ct.defaultHoursInterval ? `${ct.defaultHoursInterval}h` : null,
                ct.defaultCyclesInterval ? `${ct.defaultCyclesInterval}cyc` : null,
                ct.defaultDaysInterval ? `${ct.defaultDaysInterval}d` : null,
              ].filter(Boolean)

              return (
                <button
                  key={ct._id}
                  onClick={() => onSelect(ct)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                      : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                  }`}
                >
                  {/* Color bar */}
                  <div
                    className="w-[6px] h-[32px] rounded-full shrink-0"
                    style={{ backgroundColor: ct.color || '#6b7280' }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">{ct.name || 'Untitled'}</div>
                    <div className="text-[13px] text-hz-text-secondary truncate">
                      {intervalParts.length > 0 ? intervalParts.join(' / ') : 'No thresholds'}
                    </div>
                  </div>

                  {/* Code badge */}
                  <span className="text-[13px] font-mono font-semibold text-hz-text-secondary shrink-0">
                    {ct.code || '?'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
