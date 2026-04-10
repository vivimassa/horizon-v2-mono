"use client"

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, ChevronLeft } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { CodeshareAgreementRef, CodeshareOperatingFlightRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { CABIN_CLASSES } from './codeshare-types'

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agreement: CodeshareAgreementRef
  isDark: boolean
  onMappingChanged: () => void
}

export function BulkImportDialog({
  open, onOpenChange, agreement, isDark, onMappingChanged,
}: BulkImportDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const inputStyle = { background: inputBg, border: `1px solid ${glassBorder}`, color: palette.text }

  const [flights, setFlights] = useState<CodeshareOperatingFlightRef[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [prefix, setPrefix] = useState('5')
  const [step, setStep] = useState<'select' | 'preview'>('select')
  const [cabinAllocs, setCabinAllocs] = useState<Record<string, { seats: number; release: number }>>({})
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.getCodeshareUnmappedFlights(agreement._id, getOperatorId())
      .then(setFlights)
      .finally(() => setLoading(false))
  }, [open, agreement._id])

  const needsAlloc = agreement.agreementType === 'block_space' || agreement.agreementType === 'hard_block'
  const allocTotal = Object.values(cabinAllocs).reduce((s, v) => s + v.seats, 0)

  const selectedFlights = useMemo(
    () => flights.filter(f => selected.has(f.flightNumber)),
    [flights, selected]
  )

  function toggleFlight(flightNumber: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(flightNumber)) next.delete(flightNumber)
      else next.add(flightNumber)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(flights.map(f => f.flightNumber)))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  function getMarketingNumber(opFlt: string): string {
    return `${prefix}${opFlt}`
  }

  async function handleImport() {
    setImporting(true)
    try {
      const mappings = selectedFlights.map(f => ({
        operatingFlightNumber: f.flightNumber,
        marketingFlightNumber: getMarketingNumber(f.flightNumber),
        departureIata: f.depStation,
        arrivalIata: f.arrStation,
        daysOfOperation: f.daysOfWeek || '1234567',
        effectiveFrom: agreement.effectiveFrom,
        effectiveUntil: agreement.effectiveUntil || undefined,
      }))

      const cabinAllocationsPayload = needsAlloc
        ? Object.entries(cabinAllocs)
            .filter(([_, v]) => v.seats > 0)
            .map(([cabinCode, v]) => ({
              cabinCode,
              allocatedSeats: v.seats,
              releaseHours: v.release,
            }))
        : undefined

      await api.bulkCreateCodeshareMappings({
        agreementId: agreement._id,
        mappings,
        cabinAllocations: cabinAllocationsPayload,
      })

      onMappingChanged()
      onOpenChange(false)
    } finally {
      setImporting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-[640px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
          <h2 className="text-[18px] font-bold" style={{ color: palette.text }}>
            Bulk Import Mappings
          </h2>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-hz-border/20">
            <X size={18} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'select' && (
            <>
              {/* Marketing prefix */}
              <div className="flex items-center gap-3 mb-3">
                <label className="text-[13px] font-medium" style={{ color: palette.textSecondary }}>Marketing prefix:</label>
                <input
                  value={prefix}
                  onChange={e => setPrefix(e.target.value)}
                  className="w-16 px-2 h-8 rounded-lg text-[13px] font-mono outline-none text-center"
                  style={inputStyle}
                />
                <div className="flex-1" />
                <button onClick={selectAll} className="text-[13px] font-medium" style={{ color: accent }}>Select all</button>
                <button onClick={deselectAll} className="text-[13px] font-medium" style={{ color: palette.textSecondary }}>Deselect all</button>
              </div>

              {/* Flight list */}
              {loading ? (
                <div className="text-center py-8 text-[13px]" style={{ color: palette.textTertiary }}>Loading unmapped flights...</div>
              ) : flights.length === 0 ? (
                <div className="text-center py-8 text-[13px]" style={{ color: palette.textTertiary }}>All flights are already mapped</div>
              ) : (
                <div className="space-y-0.5 max-h-[40vh] overflow-y-auto rounded-xl" style={{ background: inputBg, border: `1px solid ${glassBorder}` }}>
                  {flights.map(f => {
                    const isChecked = selected.has(f.flightNumber)
                    return (
                      <button
                        key={f._id}
                        type="button"
                        onClick={() => toggleFlight(f.flightNumber)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                        style={{ borderBottom: `1px solid ${glassBorder}` }}
                      >
                        {/* Checkbox */}
                        <span
                          className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                          style={{
                            borderColor: isChecked ? accent : (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'),
                            background: isChecked ? accent : 'transparent',
                          }}
                        >
                          {isChecked && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>

                        <span className="font-mono text-[13px] font-semibold" style={{ color: accent }}>{f.flightNumber}</span>
                        <span className="font-mono text-[13px]" style={{ color: palette.textSecondary }}>{f.depStation}&rarr;{f.arrStation}</span>
                        <span className="text-[13px]" style={{ color: palette.textTertiary }}>{f.daysOfWeek}</span>
                        {f.aircraftTypeIcao && <span className="text-[13px] font-mono" style={{ color: palette.textTertiary }}>{f.aircraftTypeIcao}</span>}
                        <div className="flex-1" />
                        <span className="text-[13px] font-mono" style={{ color: palette.textTertiary }}>
                          &rarr; {agreement.partnerAirlineCode} {getMarketingNumber(f.flightNumber)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Status */}
              <div className="text-[13px] mt-3" style={{ color: palette.textSecondary }}>
                {selected.size} of {flights.length} selected
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              {/* Preview table */}
              <table className="w-full mb-3">
                <thead>
                  <tr>
                    <th className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2" style={{ color: palette.textTertiary }}>Operating</th>
                    <th className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2" style={{ color: palette.textTertiary }}>Marketing</th>
                    <th className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2" style={{ color: palette.textTertiary }}>Route</th>
                    <th className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2" style={{ color: palette.textTertiary }}>DOW</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFlights.map(f => (
                    <tr key={f._id} style={{ borderBottom: `1px solid ${glassBorder}` }}>
                      <td className="px-2.5 py-2 font-mono text-[13px] font-semibold" style={{ color: accent }}>{f.flightNumber}</td>
                      <td className="px-2.5 py-2 font-mono text-[13px] font-semibold" style={{ color: accent }}>
                        {agreement.partnerAirlineCode} {getMarketingNumber(f.flightNumber)}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-[13px]" style={{ color: palette.textSecondary }}>{f.depStation}&rarr;{f.arrStation}</td>
                      <td className="px-2.5 py-2 text-[13px]" style={{ color: palette.textSecondary }}>{f.daysOfWeek}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Cabin allocations for block/hard */}
              {needsAlloc && (
                <div className="pt-3" style={{ borderTop: `1px solid ${glassBorder}` }}>
                  <div className="text-[13px] font-semibold mb-2" style={{ color: palette.text }}>Default Seat Allocation (applied to all)</div>
                  {CABIN_CLASSES.map(cc => (
                    <div key={cc.code} className="grid grid-cols-[60px_120px_80px_80px] gap-2 mb-1.5 items-center">
                      <span className="text-[13px] font-mono font-semibold" style={{ color: cc.color }}>{cc.code}</span>
                      <span className="text-[13px]" style={{ color: palette.textSecondary }}>{cc.name}</span>
                      <input
                        type="number"
                        min={0}
                        value={cabinAllocs[cc.code]?.seats ?? 0}
                        onChange={e => setCabinAllocs(s => ({ ...s, [cc.code]: { seats: parseInt(e.target.value) || 0, release: s[cc.code]?.release ?? 72 } }))}
                        placeholder="Seats"
                        className="h-8 px-2 rounded-lg text-[13px] font-mono outline-none text-center"
                        style={inputStyle}
                      />
                      <input
                        type="number"
                        min={0}
                        max={168}
                        value={cabinAllocs[cc.code]?.release ?? 72}
                        onChange={e => setCabinAllocs(s => ({ ...s, [cc.code]: { seats: s[cc.code]?.seats ?? 0, release: parseInt(e.target.value) || 72 } }))}
                        placeholder="Release h"
                        className="h-8 px-2 rounded-lg text-[13px] font-mono outline-none text-center"
                        style={inputStyle}
                      />
                    </div>
                  ))}
                  <div className="text-[13px] font-medium mt-1" style={{ color: palette.text }}>
                    Total: <span className="font-mono font-semibold">{allocTotal}</span> seats per flight
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0 flex justify-between" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <div>
            {step === 'preview' && (
              <button
                onClick={() => setStep('select')}
                className="h-9 px-4 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
                style={{ color: palette.textSecondary }}
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-xl text-[13px] font-medium transition-colors"
              style={{ background: inputBg, border: `1px solid ${glassBorder}`, color: palette.textSecondary }}
            >
              Cancel
            </button>
            {step === 'select' ? (
              <button
                onClick={() => setStep('preview')}
                disabled={selected.size === 0}
                className="h-9 px-4 rounded-xl text-[13px] font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: accent, color: '#ffffff' }}
              >
                Preview ({selected.size})
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing}
                className="h-9 px-4 rounded-xl text-[13px] font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: accent, color: '#ffffff' }}
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : `Import ${selectedFlights.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
