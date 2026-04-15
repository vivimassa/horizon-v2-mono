'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MapFilter } from './world-map-types'
import { MAP_STYLES, type MapStyleKey } from './world-map-types'

interface WorldMapFilterProps {
  filter: MapFilter
  onChange: (f: MapFilter) => void
  aircraftTypes: string[]
  isDark?: boolean
  mapStyleKey: MapStyleKey
  onMapStyleChange: (key: MapStyleKey) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  otpTarget: number
  onOtpTargetChange: (v: number) => void
  lfTarget: number
  onLfTargetChange: (v: number) => void
  tatTargetMin: number
  onTatTargetChange: (v: number) => void
  fuelTargetPct: number
  onFuelTargetChange: (v: number) => void
}

const STATUS_OPTIONS = [
  { key: 'airborne', label: 'Airborne', color: '#f5c842' },
  { key: 'ground', label: 'On Ground', color: '#3b82f6' },
  { key: 'completed', label: 'Completed', color: '#6b7280' },
  { key: 'scheduled', label: 'Scheduled', color: '#94a3b8' },
] as const

export function WorldMapFilter({
  filter,
  onChange,
  aircraftTypes,
  mapStyleKey,
  onMapStyleChange,
  collapsed,
  onCollapsedChange,
  otpTarget,
  onOtpTargetChange,
  lfTarget,
  onLfTargetChange,
  tatTargetMin,
  onTatTargetChange,
  fuelTargetPct,
  onFuelTargetChange,
}: WorldMapFilterProps) {
  const setCollapsed = onCollapsedChange
  const [sectionOpen, setSectionOpen] = useState({ criteria: true, mapStyle: true, kpiSettings: true })
  const [acTypeOpen, setAcTypeOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [mapStyleOpen, setMapStyleOpen] = useState(false)

  const activeCount = filter.aircraftTypes.length + filter.statuses.length

  const acTypeLabel =
    filter.aircraftTypes.length === 0
      ? 'All'
      : filter.aircraftTypes.length === 1
        ? filter.aircraftTypes[0]
        : `${filter.aircraftTypes.length} selected`

  const statusLabel =
    filter.statuses.length === 0
      ? 'All'
      : filter.statuses.length === 1
        ? STATUS_OPTIONS.find((s) => s.key === filter.statuses[0])?.label || filter.statuses[0]
        : `${filter.statuses.length} selected`

  function toggleType(t: string) {
    const next = filter.aircraftTypes.includes(t)
      ? filter.aircraftTypes.filter((x) => x !== t)
      : [...filter.aircraftTypes, t]
    onChange({ ...filter, aircraftTypes: next })
  }

  function toggleStatus(s: string) {
    const next = filter.statuses.includes(s) ? filter.statuses.filter((x) => x !== s) : [...filter.statuses, s]
    onChange({ ...filter, statuses: next })
  }

  return (
    <aside
      className="fixed left-4 top-4 bottom-4 z-30 shrink-0 glass-heavy shadow-xl rounded-2xl border border-black/10 dark:border-white/10 flex flex-col overflow-hidden transition-all duration-300"
      style={{ width: collapsed ? 44 : 300 }}
    >
      {collapsed ? (
        <div
          className="flex flex-col items-center h-full cursor-pointer select-none"
          onClick={() => setCollapsed(false)}
        >
          <div className="h-11 flex items-center justify-center shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span
              className="text-[13px] font-semibold text-muted-foreground tracking-wider"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              Filters
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            className="shrink-0 h-11 flex items-center justify-between px-4 border-b border-black/5 dark:border-white/5 cursor-pointer"
            onClick={() => setCollapsed(true)}
          >
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold">Filters</span>
              {activeCount > 0 && (
                <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full leading-none">
                  {activeCount}
                </span>
              )}
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0 custom-scrollbar">
            {/* Map Style */}
            <div className="space-y-2 pb-3">
              <button
                onClick={() => setSectionOpen((p) => ({ ...p, mapStyle: !p.mapStyle }))}
                className="w-full flex items-center justify-between py-1"
              >
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Map Style
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-muted-foreground/50 transition-transform duration-200',
                    sectionOpen.mapStyle && 'rotate-180',
                  )}
                />
              </button>
              {sectionOpen.mapStyle && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[13px] text-muted-foreground">Map Type</span>
                    <div className="relative">
                      <button
                        onClick={() => {
                          setMapStyleOpen((p) => !p)
                          setAcTypeOpen(false)
                          setStatusOpen(false)
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-black/[0.08] dark:border-white/10 flex items-center justify-between text-[13px] text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <span>{MAP_STYLES.find((s) => s.key === mapStyleKey)?.label ?? 'Auto (Theme)'}</span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                            mapStyleOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {mapStyleOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg border border-black/10 dark:border-white/10 shadow-lg z-10 py-1">
                          {MAP_STYLES.map((s) => (
                            <button
                              key={s.key}
                              onClick={() => {
                                onMapStyleChange(s.key)
                                setMapStyleOpen(false)
                              }}
                              className={cn(
                                'w-full px-3 py-2 text-left text-[13px] transition-colors',
                                mapStyleKey === s.key
                                  ? 'bg-primary/10 text-foreground font-medium'
                                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-black/5 dark:border-white/5 mb-3" />

            {/* Selection Criteria */}
            <div className="space-y-2 pb-3">
              <button
                onClick={() => setSectionOpen((p) => ({ ...p, criteria: !p.criteria }))}
                className="w-full flex items-center justify-between py-1"
              >
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Selection Criteria
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-muted-foreground/50 transition-transform duration-200',
                    sectionOpen.criteria && 'rotate-180',
                  )}
                />
              </button>
              {sectionOpen.criteria && (
                <div className="space-y-4">
                  {/* Aircraft Type dropdown */}
                  <div className="space-y-1.5">
                    <span className="text-[13px] text-muted-foreground">Aircraft Type</span>
                    <div className="relative">
                      <button
                        onClick={() => {
                          setAcTypeOpen((p) => !p)
                          setStatusOpen(false)
                          setMapStyleOpen(false)
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-black/[0.08] dark:border-white/10 flex items-center justify-between text-[13px] text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <span className={filter.aircraftTypes.length === 0 ? 'text-muted-foreground' : ''}>
                          {acTypeLabel}
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                            acTypeOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {acTypeOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-lg border border-black/10 dark:border-white/10 shadow-lg z-10 py-1 max-h-[200px] overflow-y-auto">
                          {/* All option */}
                          <button
                            onClick={() => {
                              onChange({ ...filter, aircraftTypes: [] })
                              setAcTypeOpen(false)
                            }}
                            className={cn(
                              'w-full px-3 py-2 text-left text-[13px] transition-colors',
                              filter.aircraftTypes.length === 0
                                ? 'bg-primary/10 text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                            )}
                          >
                            All
                          </button>
                          {aircraftTypes.map((t) => {
                            const active = filter.aircraftTypes.includes(t)
                            return (
                              <button
                                key={t}
                                onClick={() => toggleType(t)}
                                className={cn(
                                  'w-full px-3 py-2 text-left text-[13px] font-mono transition-colors',
                                  active
                                    ? 'bg-primary/10 text-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                                )}
                              >
                                {t}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status dropdown */}
                  <div className="space-y-1.5">
                    <span className="text-[13px] text-muted-foreground">Status</span>
                    <div className="relative">
                      <button
                        onClick={() => {
                          setStatusOpen((p) => !p)
                          setAcTypeOpen(false)
                          setMapStyleOpen(false)
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-black/[0.08] dark:border-white/10 flex items-center justify-between text-[13px] text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <span className={filter.statuses.length === 0 ? 'text-muted-foreground' : ''}>
                          {statusLabel}
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                            statusOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {statusOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg border border-black/10 dark:border-white/10 shadow-lg z-10 py-1">
                          {/* All option */}
                          <button
                            onClick={() => {
                              onChange({ ...filter, statuses: [] })
                              setStatusOpen(false)
                            }}
                            className={cn(
                              'w-full px-3 py-2 text-left text-[13px] transition-colors',
                              filter.statuses.length === 0
                                ? 'bg-primary/10 text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                            )}
                          >
                            All
                          </button>
                          {STATUS_OPTIONS.map((s) => {
                            const active = filter.statuses.includes(s.key)
                            return (
                              <button
                                key={s.key}
                                onClick={() => toggleStatus(s.key)}
                                className={cn(
                                  'w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors',
                                  active
                                    ? 'bg-primary/10 text-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                                )}
                              >
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                {s.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-black/5 dark:border-white/5 mb-3" />

            {/* KPI Settings */}
            <div className="space-y-2 pb-3">
              <button
                onClick={() => setSectionOpen((p) => ({ ...p, kpiSettings: !p.kpiSettings }))}
                className="w-full flex items-center justify-between py-1"
              >
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  KPI Settings
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-muted-foreground/50 transition-transform duration-200',
                    sectionOpen.kpiSettings && 'rotate-180',
                  )}
                />
              </button>
              {sectionOpen.kpiSettings && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">OTP Target (%)</span>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={otpTarget}
                      onChange={(e) => {
                        const v = parseInt(e.target.value)
                        if (!isNaN(v) && v >= 50 && v <= 100) onOtpTargetChange(v)
                      }}
                      className="w-[56px] h-8 px-2 rounded-lg border border-black/[0.08] dark:border-white/10 bg-transparent text-[13px] text-foreground font-mono text-center outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">TAT Target</span>
                    <input
                      type="text"
                      value={`${Math.floor(tatTargetMin / 60)}:${String(tatTargetMin % 60).padStart(2, '0')}`}
                      onChange={(e) => {
                        const parts = e.target.value.split(':')
                        if (parts.length === 2) {
                          const h = parseInt(parts[0]) || 0
                          const m = parseInt(parts[1]) || 0
                          const total = h * 60 + m
                          if (total >= 15 && total <= 300) onTatTargetChange(total)
                        }
                      }}
                      className="w-[56px] h-8 px-2 rounded-lg border border-black/[0.08] dark:border-white/10 bg-transparent text-[13px] text-foreground font-mono text-center outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                      placeholder="0:45"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">Fuel Burn Target (%)</span>
                    <input
                      type="number"
                      min={-20}
                      max={20}
                      value={fuelTargetPct}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v) && v >= -20 && v <= 20) onFuelTargetChange(v)
                      }}
                      className="w-[56px] h-8 px-2 rounded-lg border border-black/[0.08] dark:border-white/10 bg-transparent text-[13px] text-foreground font-mono text-center outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">Load Factor Target (%)</span>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={lfTarget}
                      onChange={(e) => {
                        const v = parseInt(e.target.value)
                        if (!isNaN(v) && v >= 50 && v <= 100) onLfTargetChange(v)
                      }}
                      className="w-[56px] h-8 px-2 rounded-lg border border-black/[0.08] dark:border-white/10 bg-transparent text-[13px] text-foreground font-mono text-center outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-2.5 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Live — auto-refreshes every 60s</span>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
