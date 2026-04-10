"use client"

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { CodeshareAgreementRef, CodeshareMappingRef, CodeshareOperatingFlightRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { CABIN_CLASSES } from './codeshare-types'

interface MappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agreement: CodeshareAgreementRef
  mapping: CodeshareMappingRef | null
  isDark: boolean
  onMappingChanged: () => void
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MappingDialog({
  open, onOpenChange, agreement, mapping, isDark, onMappingChanged,
}: MappingDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const inputStyle = { background: inputBg, border: `1px solid ${glassBorder}`, color: palette.text }

  const isEdit = !!mapping

  const [manual, setManual] = useState(!!mapping)
  const [flights, setFlights] = useState<CodeshareOperatingFlightRef[]>([])
  const [selectedFlight, setSelectedFlight] = useState<CodeshareOperatingFlightRef | null>(null)
  const [flightSearch, setFlightSearch] = useState('')
  const [dow, setDow] = useState(mapping?.daysOfOperation || '1234567')
  const [operatingFlt, setOperatingFlt] = useState(mapping?.operatingFlightNumber || '')
  const [marketingFlt, setMarketingFlt] = useState(mapping?.marketingFlightNumber || '')
  const [departure, setDeparture] = useState(mapping?.departureIata || '')
  const [arrival, setArrival] = useState(mapping?.arrivalIata || '')
  const [agreedAcType, setAgreedAcType] = useState(mapping?.agreedAircraftType || '')
  const [effectiveFrom, setEffectiveFrom] = useState(mapping?.effectiveFrom || agreement.effectiveFrom)
  const [effectiveUntil, setEffectiveUntil] = useState(mapping?.effectiveUntil || '')
  const [status, setStatus] = useState(mapping?.status || 'active')
  const [cabinAllocs, setCabinAllocs] = useState<Record<string, { seats: number; release: number }>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load operating flights for picker
  useEffect(() => {
    if (!open || manual) return
    setLoading(true)
    api.getCodeshareOperatingFlights(getOperatorId())
      .then(setFlights)
      .finally(() => setLoading(false))
  }, [open, manual])

  // Filter flights based on search
  const filteredFlights = useMemo(() => {
    if (!flightSearch.trim()) return flights.slice(0, 50)
    const q = flightSearch.toLowerCase()
    return flights
      .filter(f =>
        f.flightNumber.toLowerCase().includes(q) ||
        f.depStation.toLowerCase().includes(q) ||
        f.arrStation.toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [flights, flightSearch])

  function selectFlight(f: CodeshareOperatingFlightRef) {
    setSelectedFlight(f)
    setOperatingFlt(f.flightNumber)
    setDeparture(f.depStation)
    setArrival(f.arrStation)
    setDow(f.daysOfWeek || '1234567')
    if (f.aircraftTypeIcao) setAgreedAcType(f.aircraftTypeIcao)
  }

  function toggleDow(dayNum: number) {
    const d = String(dayNum)
    setDow(prev => prev.includes(d) ? prev.replace(d, '') : (prev + d).split('').sort().join(''))
  }

  const needsAlloc = agreement.agreementType === 'block_space' || agreement.agreementType === 'hard_block'
  const allocTotal = Object.values(cabinAllocs).reduce((s, v) => s + v.seats, 0)

  async function handleSubmit() {
    if (!operatingFlt || !marketingFlt) {
      setError('Both flight numbers are required')
      return
    }
    if (!manual && !selectedFlight && !isEdit) {
      setError('Select an operating flight or switch to manual entry')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (isEdit) {
        await api.updateCodeshareMapping(mapping!._id, {
          operatingFlightNumber: operatingFlt,
          marketingFlightNumber: marketingFlt,
          departureIata: departure.toUpperCase(),
          arrivalIata: arrival.toUpperCase(),
          daysOfOperation: dow || '1234567',
          effectiveFrom,
          effectiveUntil: effectiveUntil || null,
          agreedAircraftType: agreedAcType || null,
          status,
          seatAllocation: needsAlloc ? allocTotal : null,
        })
      } else {
        const result = await api.createCodeshareMapping({
          agreementId: agreement._id,
          operatingFlightNumber: operatingFlt,
          marketingFlightNumber: marketingFlt,
          departureIata: departure.toUpperCase(),
          arrivalIata: arrival.toUpperCase(),
          daysOfOperation: dow || '1234567',
          effectiveFrom,
          effectiveUntil: effectiveUntil || null,
          agreedAircraftType: agreedAcType || null,
          seatAllocation: needsAlloc ? allocTotal : null,
        })

        // If block/hard, also upsert seat allocations
        if (needsAlloc && allocTotal > 0) {
          const allocs = Object.entries(cabinAllocs)
            .filter(([_, v]) => v.seats > 0)
            .map(([cabinCode, v]) => ({ cabinCode, allocatedSeats: v.seats, releaseHours: v.release }))
          await api.upsertCodeshareSeatAllocations(result.id, allocs)
        }
      }
      onMappingChanged()
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message || 'Failed to save mapping')
    } finally {
      setSaving(false)
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
        className="w-[600px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
          <h2 className="text-[18px] font-bold" style={{ color: palette.text }}>
            {isEdit ? 'Edit Mapping' : 'Add Mapping'}
          </h2>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-hz-border/20">
            <X size={18} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {error && (
            <div className="text-[13px] px-3 py-2 rounded-xl" style={{ background: 'rgba(255,59,59,0.1)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.2)' }}>
              {error}
            </div>
          )}

          {/* Mode toggle (create only) */}
          {!isEdit && (
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setManual(!manual)}
                className="flex items-center gap-1.5 text-[13px] font-medium"
                style={{ color: accent }}
              >
                {manual ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {manual ? 'Manual entry' : 'From schedule'}
              </button>
            </div>
          )}

          {/* Operating flight — schedule picker mode */}
          {!manual && !isEdit && (
            <div>
              <label className="block text-[13px] font-medium mb-1 text-hz-text-tertiary">Operating Flight</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: palette.textTertiary }} />
                <input
                  value={flightSearch}
                  onChange={e => setFlightSearch(e.target.value)}
                  placeholder="Search by flight, departure, arrival..."
                  className="w-full pl-9 pr-3 h-9 rounded-xl text-[13px] outline-none"
                  style={inputStyle}
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl" style={{ background: inputBg, border: `1px solid ${glassBorder}` }}>
                {loading && <div className="text-[13px] text-center py-4" style={{ color: palette.textTertiary }}>Loading flights...</div>}
                {filteredFlights.map(f => (
                  <button
                    key={f._id}
                    type="button"
                    onClick={() => selectFlight(f)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={{
                      background: selectedFlight?._id === f._id ? accentTint(accent, isDark ? 0.15 : 0.1) : 'transparent',
                      borderBottom: `1px solid ${glassBorder}`,
                    }}
                    onMouseEnter={e => { if (selectedFlight?._id !== f._id) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                    onMouseLeave={e => { if (selectedFlight?._id !== f._id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span className="font-mono text-[13px] font-semibold" style={{ color: accent }}>{f.flightNumber}</span>
                    <span className="font-mono text-[13px]" style={{ color: palette.textSecondary }}>{f.depStation}&rarr;{f.arrStation}</span>
                    <span className="text-[13px]" style={{ color: palette.textTertiary }}>{f.daysOfWeek}</span>
                    {f.aircraftTypeIcao && <span className="text-[13px] font-mono" style={{ color: palette.textTertiary }}>{f.aircraftTypeIcao}</span>}
                  </button>
                ))}
                {!loading && filteredFlights.length === 0 && (
                  <div className="text-[13px] text-center py-4" style={{ color: palette.textTertiary }}>
                    {flightSearch ? 'No matches' : 'No flights available'}
                  </div>
                )}
              </div>
              {selectedFlight && (
                <div className="text-[13px] mt-2 font-medium" style={{ color: palette.textSecondary }}>
                  Selected: <span className="font-mono font-semibold" style={{ color: accent }}>{selectedFlight.flightNumber}</span>
                  {' '}{selectedFlight.depStation}&rarr;{selectedFlight.arrStation}
                </div>
              )}
            </div>
          )}

          {/* Manual fields or route display */}
          {(manual || isEdit) && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Operating Flight *">
                <input
                  value={operatingFlt}
                  onChange={e => setOperatingFlt(e.target.value)}
                  placeholder="151"
                  className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono"
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Departure IATA">
                <input
                  value={departure}
                  onChange={e => setDeparture(e.target.value)}
                  maxLength={4}
                  placeholder="SGN"
                  className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono uppercase"
                  style={inputStyle}
                />
              </FormField>
              <div /> {/* spacer for grid */}
              <FormField label="Arrival IATA">
                <input
                  value={arrival}
                  onChange={e => setArrival(e.target.value)}
                  maxLength={4}
                  placeholder="ICN"
                  className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono uppercase"
                  style={inputStyle}
                />
              </FormField>
            </div>
          )}

          <FormField label="Marketing Flight Number *">
            <input
              value={marketingFlt}
              onChange={e => setMarketingFlt(e.target.value)}
              placeholder="5151"
              className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono"
              style={inputStyle}
            />
          </FormField>

          {/* Days of operation */}
          <FormField label="Days of Operation">
            <div className="flex gap-1.5">
              {DOW_LABELS.map((lbl, i) => {
                const dayNum = i + 1
                const active = dow.includes(String(dayNum))
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDow(dayNum)}
                    className="w-10 h-9 rounded-lg text-[13px] font-medium transition-colors"
                    style={{
                      background: active ? accentTint(accent, isDark ? 0.2 : 0.15) : inputBg,
                      color: active ? accent : palette.textTertiary,
                      border: `1px solid ${active ? accentTint(accent, 0.3) : glassBorder}`,
                    }}
                  >
                    {lbl}
                  </button>
                )
              })}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Agreed Aircraft Type">
              <input
                value={agreedAcType}
                onChange={e => setAgreedAcType(e.target.value)}
                maxLength={4}
                placeholder="A321"
                className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono uppercase"
                style={inputStyle}
              />
            </FormField>
            {isEdit && (
              <FormField label="Status">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full h-9 pl-3 pr-8 rounded-xl text-[13px] appearance-none cursor-pointer outline-none"
                  style={inputStyle}
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </FormField>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Effective From *">
              <input
                type="date"
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
                style={inputStyle}
              />
            </FormField>
            <FormField label="Effective Until">
              <input
                type="date"
                value={effectiveUntil}
                onChange={e => setEffectiveUntil(e.target.value)}
                className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
                style={inputStyle}
              />
            </FormField>
          </div>

          {/* Seat allocation section */}
          {needsAlloc && (
            <div className="pt-2" style={{ borderTop: `1px solid ${glassBorder}` }}>
              <div className="text-[13px] font-semibold mb-2" style={{ color: palette.text }}>Seat Allocation</div>
              {CABIN_CLASSES.map(cc => (
                <div key={cc.code} className="grid grid-cols-[60px_120px_80px_80px] gap-2 mb-1.5 items-center">
                  <span className="text-[13px] font-mono font-semibold" style={{ color: cc.color }}>{cc.code}</span>
                  <span className="text-[13px]" style={{ color: palette.textSecondary }}>{cc.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={cabinAllocs[cc.code]?.seats ?? 0}
                    onChange={e => setCabinAllocs(s => ({ ...s, [cc.code]: { seats: parseInt(e.target.value) || 0, release: s[cc.code]?.release ?? 72 } }))}
                    placeholder="0"
                    className="h-8 px-2 rounded-lg text-[13px] font-mono outline-none text-center"
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    min={0}
                    max={168}
                    value={cabinAllocs[cc.code]?.release ?? 72}
                    onChange={e => setCabinAllocs(s => ({ ...s, [cc.code]: { seats: s[cc.code]?.seats ?? 0, release: parseInt(e.target.value) || 72 } }))}
                    className="h-8 px-2 rounded-lg text-[13px] font-mono outline-none text-center"
                    style={inputStyle}
                  />
                </div>
              ))}
              <div className="text-[13px] font-medium mt-1" style={{ color: palette.text }}>
                Total: <span className="font-mono font-semibold">{allocTotal}</span> seats
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0 flex justify-end gap-3" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-xl text-[13px] font-medium transition-colors"
            style={{ background: inputBg, border: `1px solid ${glassBorder}`, color: palette.textSecondary }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (!operatingFlt || !marketingFlt)}
            className="h-9 px-4 rounded-xl text-[13px] font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: accent, color: '#ffffff' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : (isEdit ? 'Update' : 'Add Mapping')}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1 text-hz-text-tertiary">{label}</label>
      {children}
    </div>
  )
}
