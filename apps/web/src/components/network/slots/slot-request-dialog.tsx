'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import { getOperatorId, useOperatorStore } from '@/stores/use-operator-store'
import { Dropdown } from '@/components/ui/dropdown'
import { DateRangePicker } from '@/components/ui/date-range-picker'

interface SlotRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  airportIata: string
  seasonCode: string
  onCreated: () => void
  isDark: boolean
}

export function SlotRequestDialog({
  open,
  onOpenChange,
  airportIata,
  seasonCode,
  onCreated,
  isDark,
}: SlotRequestDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const dateFormat = useOperatorStore((s) => s.dateFormat)
  const datePlaceholder =
    dateFormat === 'DD/MM/YYYY'
      ? '29/03/2026'
      : dateFormat === 'MM/DD/YYYY'
        ? '03/29/2026'
        : dateFormat === 'YYYY-MM-DD'
          ? '2026-03-29'
          : dateFormat === 'DD.MM.YYYY'
            ? '29.03.2026'
            : '29-MAR-26'
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    arrivalFlightNumber: '',
    departureFlightNumber: '',
    arrivalOriginIata: '',
    departureDestIata: '',
    requestedArrivalTime: '',
    requestedDepartureTime: '',
    periodStart: '',
    periodEnd: '',
    daysOfOperation: '1234567',
    seats: '',
    aircraftTypeIcao: '',
    priorityCategory: 'new',
  })

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function parseTime(str: string): number | null {
    if (!str) return null
    const clean = str.replace(':', '')
    if (clean.length !== 4) return null
    return parseInt(clean.slice(0, 2), 10) * 100 + parseInt(clean.slice(2), 10)
  }

  async function handleSubmit() {
    if (!form.periodStart || !form.periodEnd) return
    setSaving(true)
    try {
      await api.createSlotSeries({
        operatorId: getOperatorId(),
        airportIata,
        seasonCode,
        arrivalFlightNumber: form.arrivalFlightNumber || null,
        departureFlightNumber: form.departureFlightNumber || null,
        arrivalOriginIata: form.arrivalOriginIata || null,
        departureDestIata: form.departureDestIata || null,
        requestedArrivalTime: parseTime(form.requestedArrivalTime),
        requestedDepartureTime: parseTime(form.requestedDepartureTime),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        daysOfOperation: form.daysOfOperation,
        seats: form.seats ? parseInt(form.seats, 10) : null,
        aircraftTypeIcao: form.aircraftTypeIcao || null,
        priorityCategory: form.priorityCategory,
        status: 'draft',
      })
      onCreated()
      onOpenChange(false)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-[560px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${glassBorder}` }}
        >
          <h2 className="text-[16px] font-semibold" style={{ color: palette.text }}>
            New Slot Request
          </h2>
          <button type="button" onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:opacity-70">
            <X size={16} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Flight identity */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Arrival Flight"
              value={form.arrivalFlightNumber}
              onChange={(v) => update('arrivalFlightNumber', v)}
              placeholder="SH301"
              style={inputStyle}
              palette={palette}
            />
            <Field
              label="Departure Flight"
              value={form.departureFlightNumber}
              onChange={(v) => update('departureFlightNumber', v)}
              placeholder="SH302"
              style={inputStyle}
              palette={palette}
            />
            <Field
              label="Origin IATA"
              value={form.arrivalOriginIata}
              onChange={(v) => update('arrivalOriginIata', v)}
              placeholder="ICN"
              style={inputStyle}
              palette={palette}
            />
            <Field
              label="Destination IATA"
              value={form.departureDestIata}
              onChange={(v) => update('departureDestIata', v)}
              placeholder="ICN"
              style={inputStyle}
              palette={palette}
            />
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Arrival Time (UTC)"
              value={form.requestedArrivalTime}
              onChange={(v) => update('requestedArrivalTime', v)}
              placeholder="06:15"
              style={inputStyle}
              palette={palette}
            />
            <Field
              label="Departure Time (UTC)"
              value={form.requestedDepartureTime}
              onChange={(v) => update('requestedDepartureTime', v)}
              placeholder="07:30"
              style={inputStyle}
              palette={palette}
            />
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Period Start"
              value={form.periodStart}
              onChange={(v) => update('periodStart', v)}
              placeholder={datePlaceholder}
              style={inputStyle}
              palette={palette}
            />
            <Field
              label="Period End"
              value={form.periodEnd}
              onChange={(v) => update('periodEnd', v)}
              placeholder={datePlaceholder}
              style={inputStyle}
              palette={palette}
            />
          </div>

          {/* Details */}
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Days of Operation"
              value={form.daysOfOperation}
              onChange={(v) => update('daysOfOperation', v)}
              placeholder="1234567"
              style={inputStyle}
              palette={palette}
            />
            <Field
              label="Seats"
              value={form.seats}
              onChange={(v) => update('seats', v)}
              placeholder="230"
              style={inputStyle}
              palette={palette}
            />
            <Field
              label="Aircraft Type"
              value={form.aircraftTypeIcao}
              onChange={(v) => update('aircraftTypeIcao', v)}
              placeholder="A321"
              style={inputStyle}
              palette={palette}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[13px] font-medium mb-1 block" style={{ color: palette.textSecondary }}>
              Priority
            </label>
            <Dropdown
              value={form.priorityCategory}
              onChange={(v) => update('priorityCategory', v)}
              options={[
                { value: 'new', label: 'New' },
                { value: 'historic', label: 'Historic' },
                { value: 'changed_historic', label: 'Changed Historic' },
                { value: 'new_entrant', label: 'New Entrant' },
                { value: 'adhoc', label: 'Ad-hoc' },
              ]}
              placeholder="Select priority"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-xl text-[13px] font-medium"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: palette.text,
              border: `1px solid ${glassBorder}`,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !form.periodStart || !form.periodEnd}
            className="h-9 px-4 rounded-xl text-[13px] font-medium disabled:opacity-50"
            style={{ background: MODULE_THEMES.network.accent, color: '#fff' }}
          >
            {saving ? 'Creating...' : 'Create Series'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  style,
  palette,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  style: Record<string, string>
  palette: { text: string; textSecondary: string }
}) {
  return (
    <div>
      <label className="text-[13px] font-medium mb-1 block" style={{ color: palette.textSecondary }}>
        {label}
      </label>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-lg text-[14px] outline-none"
        style={style}
      />
    </div>
  )
}
