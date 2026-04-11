'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import type { CharterContractRef } from '@skyhub/api'

interface FlightFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: CharterContractRef
  operatorCode: string
  onCreated: () => void
  isDark: boolean
}

function calcBlockMinutes(stdUtc: string, staUtc: string, dayOffset: number): number {
  if (!stdUtc || !staUtc) return 0
  const [dh, dm] = stdUtc.split(':').map(Number)
  const [ah, am] = staUtc.split(':').map(Number)
  const depMins = dh * 60 + dm
  const arrMins = ah * 60 + am + dayOffset * 1440
  return Math.max(0, arrMins - depMins)
}

export function FlightFormDialog({
  open,
  onOpenChange,
  contract,
  operatorCode,
  onCreated,
  isDark,
}: FlightFormDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    flightNumber: '',
    flightDate: '',
    legType: 'revenue',
    departureIata: '',
    arrivalIata: '',
    stdUtc: '',
    staUtc: '',
    arrivalDayOffset: '0',
    aircraftTypeIcao: contract.aircraftTypeIcao ?? '',
    aircraftRegistration: contract.aircraftRegistration ?? '',
    paxBooked: '0',
  })

  // Fetch next flight number on open
  useEffect(() => {
    if (open) {
      api.getNextCharterFlightNumber().then((r) => {
        setForm((f) => ({ ...f, flightNumber: r.flightNumber }))
      })
    }
  }, [open])

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit() {
    if (
      !form.flightNumber ||
      !form.flightDate ||
      !form.departureIata ||
      !form.arrivalIata ||
      !form.stdUtc ||
      !form.staUtc
    ) {
      setError('Flight number, date, route, and times are required.')
      return
    }

    const blockMinutes = calcBlockMinutes(form.stdUtc, form.staUtc, parseInt(form.arrivalDayOffset, 10))

    setSaving(true)
    setError('')
    try {
      await api.createCharterFlight({
        operatorId: getOperatorId(),
        contractId: contract._id,
        operatorCode,
        flightNumber: form.flightNumber,
        flightDate: form.flightDate,
        departureIata: form.departureIata.toUpperCase(),
        arrivalIata: form.arrivalIata.toUpperCase(),
        stdUtc: form.stdUtc,
        staUtc: form.staUtc,
        blockMinutes,
        arrivalDayOffset: parseInt(form.arrivalDayOffset, 10),
        aircraftTypeIcao: form.aircraftTypeIcao.toUpperCase() || null,
        aircraftRegistration: form.aircraftRegistration.toUpperCase() || null,
        legType: form.legType,
        paxBooked: parseInt(form.paxBooked, 10) || 0,
        cargoKg: 0,
        status: 'planned',
      })
      onCreated()
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add flight')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const glassBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${glassBorder}`,
    color: palette.text,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onOpenChange(false)
      }}
    >
      <div
        className="w-[580px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${glassBorder}` }}
        >
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: palette.text }}>
              Add charter flight
            </h2>
            <p className="text-[13px]" style={{ color: palette.textSecondary }}>
              Add a flight to this charter contract.
            </p>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:opacity-70">
            <X size={16} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div
              className="px-3 py-2 rounded-lg text-[13px] font-medium"
              style={{ background: 'rgba(255,59,59,0.10)', color: isDark ? '#FF5C5C' : '#E63535' }}
            >
              {error}
            </div>
          )}

          {/* Flight identity */}
          <Fieldset label="Flight">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[13px] font-medium mb-1" style={{ color: palette.textSecondary }}>
                  Flight number
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[13px] font-mono font-bold shrink-0" style={{ color: palette.textSecondary }}>
                    {operatorCode}
                  </span>
                  <input
                    value={form.flightNumber}
                    onChange={(e) => update('flightNumber', e.target.value)}
                    className="flex-1 h-10 px-3 rounded-lg text-[13px] font-mono outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
              <Field
                label="Date *"
                value={form.flightDate}
                onChange={(v) => update('flightDate', v)}
                type="date"
                style={inputStyle}
                palette={palette}
              />
              <SelectField
                label="Leg type"
                value={form.legType}
                onChange={(v) => update('legType', v)}
                options={[
                  { value: 'revenue', label: 'Revenue' },
                  { value: 'positioning', label: 'Positioning' },
                  { value: 'technical', label: 'Technical' },
                ]}
                style={inputStyle}
                palette={palette}
              />
            </div>
          </Fieldset>

          {/* Route & times */}
          <Fieldset label="Route &amp; Times (UTC)">
            <div className="grid grid-cols-4 gap-3">
              <Field
                label="Departure *"
                value={form.departureIata}
                onChange={(v) => update('departureIata', v.toUpperCase())}
                placeholder="SGN"
                mono
                maxLength={4}
                style={inputStyle}
                palette={palette}
              />
              <Field
                label="Arrival *"
                value={form.arrivalIata}
                onChange={(v) => update('arrivalIata', v.toUpperCase())}
                placeholder="CXR"
                mono
                maxLength={4}
                style={inputStyle}
                palette={palette}
              />
              <Field
                label="STD (UTC) *"
                value={form.stdUtc}
                onChange={(v) => update('stdUtc', v)}
                type="time"
                style={inputStyle}
                palette={palette}
              />
              <Field
                label="STA (UTC) *"
                value={form.staUtc}
                onChange={(v) => update('staUtc', v)}
                type="time"
                style={inputStyle}
                palette={palette}
              />
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              <SelectField
                label="Day offset"
                value={form.arrivalDayOffset}
                onChange={(v) => update('arrivalDayOffset', v)}
                options={[
                  { value: '0', label: 'Same day' },
                  { value: '1', label: '+1 day' },
                ]}
                style={inputStyle}
                palette={palette}
              />
            </div>
          </Fieldset>

          {/* Aircraft & payload */}
          <Fieldset label="Aircraft &amp; Payload">
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="AC type"
                value={form.aircraftTypeIcao}
                onChange={(v) => update('aircraftTypeIcao', v.toUpperCase())}
                placeholder="A321"
                mono
                maxLength={4}
                style={inputStyle}
                palette={palette}
              />
              <Field
                label="Tail"
                value={form.aircraftRegistration}
                onChange={(v) => update('aircraftRegistration', v.toUpperCase())}
                placeholder="VN-A123"
                mono
                style={inputStyle}
                palette={palette}
              />
              <Field
                label="Pax booked"
                value={form.paxBooked}
                onChange={(v) => update('paxBooked', v)}
                type="number"
                style={inputStyle}
                palette={palette}
              />
            </div>
          </Fieldset>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${glassBorder}`,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-9 px-4 flex items-center gap-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Add flight
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Fieldset({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{label}</legend>
      {children}
    </fieldset>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono,
  maxLength,
  style,
  palette,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  mono?: boolean
  maxLength?: number
  style: Record<string, string>
  palette: { text: string; textSecondary: string }
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1" style={{ color: palette.textSecondary }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        maxLength={maxLength}
        className={`w-full h-10 px-3 rounded-lg text-[13px] outline-none ${mono ? 'font-mono' : ''}`}
        style={style}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  style,
  palette,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  style: Record<string, string>
  palette: { text: string; textSecondary: string }
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1" style={{ color: palette.textSecondary }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg text-[13px] outline-none appearance-none cursor-pointer"
        style={style}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
