"use client"

import { useState, useMemo } from 'react'
import { Edit3, Save, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { CodeshareAgreementRef, CodeshareMappingRef, CodeshareSeatAllocationRef } from '@skyhub/api'
import { CABIN_CLASSES } from './codeshare-types'
import { FuselageCapacityBar } from './fuselage-capacity-bar'

interface CapacityTabProps {
  agreement: CodeshareAgreementRef
  mappings: CodeshareMappingRef[]
  seatCapacity: Record<string, number>
  allocsByMapping: Map<string, CodeshareSeatAllocationRef[]>
  cabinConfigs: Record<string, Record<string, number>>
  isDark: boolean
  onAllocationChanged: () => void
}

export function CapacityTab({
  agreement, mappings, seatCapacity, allocsByMapping, cabinConfigs, isDark, onAllocationChanged,
}: CapacityTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAllocs, setEditAllocs] = useState<Record<string, { seats: number; release: number }>>({})
  const [saving, setSaving] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  // Free-sale agreements don't need capacity management
  if (agreement.agreementType === 'free_sale') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="text-[15px] font-medium" style={{ color: palette.textSecondary }}>
            No seat allocation required
          </div>
          <div className="text-[13px] mt-1" style={{ color: palette.textTertiary }}>
            Free-sale agreements don&apos;t define seat allocations
          </div>
        </div>
      </div>
    )
  }

  // Summary KPIs
  const summaryData = useMemo(() => {
    let totalPartnerSeats = 0
    let totalCapacity = 0
    let maxRelease = 0
    let flightsWithAlloc = 0

    for (const m of mappings) {
      const allocs = allocsByMapping.get(m._id) || []
      const partnerSeats = allocs.reduce((s, a) => s + a.allocatedSeats, 0)
      const cap = seatCapacity[m.operatingFlightNumber] || 0
      if (partnerSeats > 0) {
        flightsWithAlloc++
        totalPartnerSeats += partnerSeats
        totalCapacity += cap
        for (const a of allocs) {
          if (a.releaseHours > maxRelease) maxRelease = a.releaseHours
        }
      }
    }

    return {
      avgSeats: flightsWithAlloc > 0 ? Math.round(totalPartnerSeats / flightsWithAlloc) : 0,
      weeklySeats: totalPartnerSeats * 7,
      capacityPct: totalCapacity > 0 ? Math.round((totalPartnerSeats / totalCapacity) * 100) : 0,
      maxRelease,
    }
  }, [mappings, allocsByMapping, seatCapacity])

  function startEdit(mappingId: string) {
    const allocs = allocsByMapping.get(mappingId) || []
    const state: Record<string, { seats: number; release: number }> = {}
    for (const cc of CABIN_CLASSES) {
      const existing = allocs.find(a => a.cabinCode === cc.code)
      state[cc.code] = {
        seats: existing?.allocatedSeats ?? 0,
        release: existing?.releaseHours ?? 72,
      }
    }
    setEditAllocs(state)
    setEditingId(mappingId)
  }

  async function handleSave(mappingId: string) {
    setSaving(true)
    try {
      const allocations = Object.entries(editAllocs)
        .filter(([_, v]) => v.seats > 0)
        .map(([cabinCode, v]) => ({
          cabinCode,
          allocatedSeats: v.seats,
          releaseHours: v.release,
        }))
      await api.upsertCodeshareSeatAllocations(mappingId, allocations)
      setEditingId(null)
      onAllocationChanged()
    } finally {
      setSaving(false)
    }
  }

  const editTotal = Object.values(editAllocs).reduce((s, v) => s + v.seats, 0)

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {/* Summary KPIs */}
      <div className="flex gap-2.5 mb-4">
        <SummaryCard label="Partner seats/flight" value={`${summaryData.avgSeats}`} isDark={isDark} palette={palette} />
        <SummaryCard label="Weekly partner seats" value={summaryData.weeklySeats.toLocaleString()} isDark={isDark} palette={palette} />
        <SummaryCard label="Capacity %" value={`${summaryData.capacityPct}%`} isDark={isDark} palette={palette} />
        <SummaryCard label="Release window" value={`${summaryData.maxRelease}h`} isDark={isDark} palette={palette} />
      </div>

      {/* Per-flight rows */}
      <div className="space-y-3">
        {mappings.map(m => {
          const allocs = allocsByMapping.get(m._id) || []
          const partnerSeats = allocs.reduce((s, a) => s + a.allocatedSeats, 0)
          const totalCap = seatCapacity[m.operatingFlightNumber] || 0
          const config = cabinConfigs[m.operatingFlightNumber] || {}
          const allocMap: Record<string, number> = {}
          for (const a of allocs) allocMap[a.cabinCode] = a.allocatedSeats
          const isEditing = editingId === m._id

          return (
            <div key={m._id} className="rounded-xl p-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)', border: `1px solid ${glassBorder}` }}>
              {/* Flight info header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold" style={{ color: accent }}>
                    {m.operatingFlightNumber}
                  </span>
                  <span className="text-[13px] opacity-40">&rarr;</span>
                  <span className="font-mono text-[13px] font-semibold" style={{ color: accent }}>
                    {agreement.partnerAirlineCode} {m.marketingFlightNumber}
                  </span>
                  <span className="text-[13px] font-mono" style={{ color: palette.textSecondary }}>
                    {m.departureIata}&ndash;{m.arrivalIata}
                  </span>
                  {m.agreedAircraftType && (
                    <span className="text-[13px] font-mono px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: palette.textTertiary }}>
                      {m.agreedAircraftType}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium" style={{ color: palette.textSecondary }}>
                    {partnerSeats}/{totalCap} seats
                  </span>
                  {!isEditing ? (
                    <button
                      onClick={() => startEdit(m._id)}
                      className="h-7 px-2.5 rounded-lg text-[13px] font-medium flex items-center gap-1 transition-colors"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: palette.textSecondary }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditingId(null)}
                        className="h-7 px-2.5 rounded-lg text-[13px] flex items-center gap-1"
                        style={{ color: palette.textSecondary }}
                      >
                        <X size={13} /> Cancel
                      </button>
                      <button
                        onClick={() => handleSave(m._id)}
                        disabled={saving}
                        className="h-7 px-2.5 rounded-lg text-[13px] font-medium flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                        style={{ background: accent, color: '#fff' }}
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Fuselage bar */}
              {Object.keys(config).length > 0 && (
                <FuselageCapacityBar
                  cabinConfig={config}
                  allocations={allocMap}
                  brandColor={null}
                  isDark={isDark}
                />
              )}

              {/* Inline edit form */}
              {isEditing && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${glassBorder}` }}>
                  <div className="grid grid-cols-[60px_120px_80px_80px] gap-2 mb-2">
                    <div className="text-[13px] font-semibold uppercase" style={{ color: palette.textTertiary }}>Cabin</div>
                    <div className="text-[13px] font-semibold uppercase" style={{ color: palette.textTertiary }}>Name</div>
                    <div className="text-[13px] font-semibold uppercase" style={{ color: palette.textTertiary }}>Seats</div>
                    <div className="text-[13px] font-semibold uppercase" style={{ color: palette.textTertiary }}>Release (h)</div>
                  </div>
                  {CABIN_CLASSES.filter(cc => config[cc.code]).map(cc => (
                    <div key={cc.code} className="grid grid-cols-[60px_120px_80px_80px] gap-2 mb-1.5 items-center">
                      <span className="text-[13px] font-mono font-semibold" style={{ color: cc.color }}>{cc.code}</span>
                      <span className="text-[13px]" style={{ color: palette.textSecondary }}>{cc.name}</span>
                      <input
                        type="number"
                        min={0}
                        max={config[cc.code]}
                        value={editAllocs[cc.code]?.seats ?? 0}
                        onChange={e => setEditAllocs(s => ({ ...s, [cc.code]: { ...s[cc.code], seats: parseInt(e.target.value) || 0 } }))}
                        className="h-8 px-2 rounded-lg text-[13px] font-mono outline-none text-center"
                        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${glassBorder}`, color: palette.text }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={168}
                        value={editAllocs[cc.code]?.release ?? 72}
                        onChange={e => setEditAllocs(s => ({ ...s, [cc.code]: { ...s[cc.code], release: parseInt(e.target.value) || 72 } }))}
                        className="h-8 px-2 rounded-lg text-[13px] font-mono outline-none text-center"
                        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${glassBorder}`, color: palette.text }}
                      />
                    </div>
                  ))}
                  <div className="text-[13px] font-medium mt-2" style={{ color: palette.text }}>
                    Total: <span className="font-mono font-semibold">{editTotal}</span> seats
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Collapsible detail table */}
      {mappings.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setDetailOpen(v => !v)}
            className="flex items-center gap-1.5 text-[13px] font-medium mb-2"
            style={{ color: palette.textSecondary }}
          >
            {detailOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Utilization detail
          </button>
          {detailOpen && (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2" style={{ color: palette.textTertiary }}>Flight</th>
                  <th className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2" style={{ color: palette.textTertiary }}>Route</th>
                  <th className="text-[13px] font-semibold uppercase tracking-wider text-right px-2.5 py-2" style={{ color: palette.textTertiary }}>Total</th>
                  <th className="text-[13px] font-semibold uppercase tracking-wider text-right px-2.5 py-2" style={{ color: palette.textTertiary }}>Partner</th>
                  <th className="text-[13px] font-semibold uppercase tracking-wider text-right px-2.5 py-2" style={{ color: palette.textTertiary }}>Remaining</th>
                  <th className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2 w-32" style={{ color: palette.textTertiary }}>Utilization</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map(m => {
                  const allocs = allocsByMapping.get(m._id) || []
                  const partner = allocs.reduce((s, a) => s + a.allocatedSeats, 0)
                  const total = seatCapacity[m.operatingFlightNumber] || 0
                  const remaining = total - partner
                  const pct = total > 0 ? Math.round((partner / total) * 100) : 0
                  const barColor = pct >= 80 ? '#FF3B3B' : pct >= 50 ? '#FF8800' : '#06C270'

                  return (
                    <tr key={m._id} style={{ borderBottom: `1px solid ${glassBorder}` }}>
                      <td className="px-2.5 py-2 font-mono text-[13px] font-semibold" style={{ color: accent }}>{m.operatingFlightNumber}</td>
                      <td className="px-2.5 py-2 font-mono text-[13px]" style={{ color: palette.textSecondary }}>{m.departureIata}&ndash;{m.arrivalIata}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-[13px]" style={{ color: palette.text }}>{total}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-[13px]" style={{ color: palette.text }}>{partner}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-[13px]" style={{ color: palette.text }}>{remaining}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <span className="text-[13px] font-semibold w-8 text-right" style={{ color: barColor }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: `1px solid ${glassBorder}` }}>
        {CABIN_CLASSES.slice(0, 4).map(cc => (
          <div key={cc.code} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: `${cc.color}90` }} />
            <span className="text-[13px]" style={{ color: palette.textSecondary }}>
              {cc.code} Partner
            </span>
            <div className="w-3 h-3 rounded" style={{ background: `${cc.color}20` }} />
            <span className="text-[13px]" style={{ color: palette.textSecondary }}>
              Retained
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, isDark, palette }: { label: string; value: string; isDark: boolean; palette: any }) {
  return (
    <div className="flex-1 rounded-xl px-3.5 py-3" style={{
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <div className="text-[20px] font-mono font-bold" style={{ color: palette.text }}>{value}</div>
      <div className="text-[13px] mt-1" style={{ color: palette.textSecondary }}>{label}</div>
    </div>
  )
}
