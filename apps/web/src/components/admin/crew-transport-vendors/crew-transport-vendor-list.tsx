'use client'

import { useState } from 'react'
import type { CrewTransportVendorRef, AirportRef } from '@skyhub/api'
import { ChevronRight, Bus } from 'lucide-react'
import { ListScreenHeader, TextInput, Text } from '@/components/ui'

interface CrewTransportVendorListProps {
  groups: [string, CrewTransportVendorRef[]][]
  airports: AirportRef[]
  totalCount: number
  filteredCount: number
  selected: CrewTransportVendorRef | null
  onSelect: (v: CrewTransportVendorRef) => void
  search: string
  onSearchChange: (value: string) => void
  activeOnly: boolean
  onActiveOnlyChange: (v: boolean) => void
  loading: boolean
  onRefresh: () => void
  onAdd?: () => void
}

export function CrewTransportVendorList({
  groups,
  airports,
  totalCount,
  filteredCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  activeOnly,
  onActiveOnlyChange,
  loading,
  onAdd,
}: CrewTransportVendorListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleGroup = (icao: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(icao)) next.delete(icao)
      else next.add(icao)
      return next
    })
  }

  const airportLabel = (icao: string) => {
    const a = airports.find((x) => x.icaoCode === icao)
    if (!a) return icao
    return `${a.iataCode ?? icao} · ${a.city ?? a.name}`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-hz-border shrink-0">
        <ListScreenHeader
          icon={Bus}
          title="Transport Vendors"
          count={totalCount}
          filteredCount={filteredCount}
          countLabel="vendor"
          onAdd={onAdd}
          addLabel="New"
          hideHelp
        />
        <div className="px-4 pb-3">
          <TextInput
            placeholder="Search vendor, ICAO, address…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <Text variant="secondary" muted as="div" className="animate-pulse px-3 py-4">
            Loading…
          </Text>
        ) : groups.length === 0 ? (
          <Text variant="secondary" muted as="div" className="px-3 py-4">
            No vendors found
          </Text>
        ) : (
          groups.map(([icao, vendors]) => (
            <div key={icao}>
              <button
                type="button"
                onClick={() => toggleGroup(icao)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 hover:text-hz-text-secondary transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-hz-text-secondary/50 transition-transform duration-200 ${
                    !collapsed.has(icao) ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary/70">
                  {airportLabel(icao)}
                </span>
                <span className="text-[13px] text-hz-text-secondary/40">({vendors.length})</span>
                <div className="flex-1 h-px bg-hz-border/50 ml-1" />
              </button>
              {!collapsed.has(icao) && (
                <div className="space-y-0.5">
                  {vendors.map((vendor) => {
                    const isSelected = selected?._id === vendor._id
                    return (
                      <button
                        type="button"
                        key={vendor._id}
                        onClick={() => onSelect(vendor)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                          isSelected
                            ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                            : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium truncate">{vendor.vendorName}</div>
                          <div className="text-[13px] text-hz-text-secondary truncate">
                            {vendor.addressLine1 ?? '—'}
                            {vendor.contracts.length > 0
                              ? ` · ${vendor.contracts.length} contract${vendor.contracts.length === 1 ? '' : 's'}`
                              : ''}
                          </div>
                        </div>
                        {!vendor.isActive && (
                          <span className="text-[13px] px-1.5 py-0.5 rounded bg-hz-border/40 text-hz-text-secondary">
                            OFF
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-hz-border shrink-0 px-3 py-2 flex items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => onActiveOnlyChange(e.target.checked)}
            className="accent-module-accent"
          />
          Only Active
        </label>
      </div>
    </div>
  )
}
