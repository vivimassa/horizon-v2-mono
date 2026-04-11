'use client'

import { useState } from 'react'
import { Edit3, Save, X } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { CodeshareAgreementRef } from '@skyhub/api'
import { AGREEMENT_TYPE_LABELS, STATUS_COLORS } from './codeshare-types'

interface DetailsTabProps {
  agreement: CodeshareAgreementRef
  isDark: boolean
  onUpdated: () => void
}

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function DetailsTab({ agreement, isDark, onUpdated }: DetailsTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const inputStyle = { background: inputBg, border: `1px solid ${glassBorder}`, color: palette.text }

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    partnerAirlineCode: agreement.partnerAirlineCode,
    partnerAirlineName: agreement.partnerAirlineName,
    partnerNumericCode: agreement.partnerNumericCode || '',
    agreementType: agreement.agreementType,
    status: agreement.status,
    effectiveFrom: agreement.effectiveFrom,
    effectiveUntil: agreement.effectiveUntil || '',
    notes: agreement.notes || '',
  })

  async function handleSave() {
    setSaving(true)
    try {
      await api.updateCodeshareAgreement(agreement._id, {
        partnerAirlineCode: form.partnerAirlineCode.toUpperCase().trim(),
        partnerAirlineName: form.partnerAirlineName.trim(),
        partnerNumericCode: form.partnerNumericCode.trim() || null,
        agreementType: form.agreementType,
        status: form.status,
        effectiveFrom: form.effectiveFrom,
        effectiveUntil: form.effectiveUntil || null,
        notes: form.notes.trim() || null,
      })
      setEditing(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const sc = STATUS_COLORS[agreement.status] || STATUS_COLORS.pending

  if (!editing) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: palette.text }}>
            Agreement Details
          </h3>
          <button
            onClick={() => setEditing(true)}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
            style={{ background: inputBg, border: `1px solid ${glassBorder}`, color: palette.text }}
          >
            <Edit3 size={14} />
            Edit
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <FieldDisplay label="IATA Code" value={agreement.partnerAirlineCode} mono palette={palette} />
          <FieldDisplay label="Partner Airline Name" value={agreement.partnerAirlineName} palette={palette} />
          <FieldDisplay label="ICAO Code" value={agreement.partnerNumericCode || '\u2014'} mono palette={palette} />
          <FieldDisplay
            label="Agreement Type"
            value={AGREEMENT_TYPE_LABELS[agreement.agreementType]}
            palette={palette}
          />
          <div>
            <div
              className="text-[13px] uppercase tracking-wide font-medium mb-1"
              style={{ color: palette.textTertiary }}
            >
              Status
            </div>
            <span
              className="text-[13px] font-semibold px-2 py-0.5 rounded-lg"
              style={{ background: sc.bg, color: sc.text }}
            >
              {statusLabel(agreement.status)}
            </span>
          </div>
          <FieldDisplay label="Effective From" value={agreement.effectiveFrom} mono palette={palette} />
          <FieldDisplay label="Effective Until" value={agreement.effectiveUntil || '\u2014'} mono palette={palette} />
          <div className="col-span-2">
            <FieldDisplay label="Notes" value={agreement.notes || '\u2014'} palette={palette} />
          </div>
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold" style={{ color: palette.text }}>
          Edit Agreement
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
            style={{ background: inputBg, border: `1px solid ${glassBorder}`, color: palette.textSecondary }}
          >
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: accent, color: '#ffffff' }}
          >
            <Save size={14} />
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-2xl">
        <FormField label="IATA Code" required>
          <input
            value={form.partnerAirlineCode}
            onChange={(e) => setForm((f) => ({ ...f, partnerAirlineCode: e.target.value }))}
            maxLength={3}
            className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono uppercase"
            style={inputStyle}
          />
        </FormField>
        <FormField label="Airline Name" required>
          <input
            value={form.partnerAirlineName}
            onChange={(e) => setForm((f) => ({ ...f, partnerAirlineName: e.target.value }))}
            className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
            style={inputStyle}
          />
        </FormField>
        <FormField label="ICAO Code">
          <input
            value={form.partnerNumericCode}
            onChange={(e) => setForm((f) => ({ ...f, partnerNumericCode: e.target.value }))}
            maxLength={4}
            className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono"
            style={inputStyle}
          />
        </FormField>
        <FormField label="Agreement Type">
          <select
            value={form.agreementType}
            onChange={(e) => setForm((f) => ({ ...f, agreementType: e.target.value as any }))}
            className="w-full h-9 pl-3 pr-8 rounded-xl text-[13px] appearance-none cursor-pointer outline-none"
            style={inputStyle}
          >
            <option value="free_sale">Free-sale</option>
            <option value="block_space">Block space</option>
            <option value="hard_block">Hard block</option>
          </select>
        </FormField>
        <FormField label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
            className="w-full h-9 pl-3 pr-8 rounded-xl text-[13px] appearance-none cursor-pointer outline-none"
            style={inputStyle}
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </FormField>
        <FormField label="Effective From" required>
          <input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
            className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
            style={inputStyle}
          />
        </FormField>
        <FormField label="Effective Until">
          <input
            type="date"
            value={form.effectiveUntil}
            onChange={(e) => setForm((f) => ({ ...f, effectiveUntil: e.target.value }))}
            className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
            style={inputStyle}
          />
        </FormField>
        <div className="col-span-2">
          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none resize-none"
              style={inputStyle}
            />
          </FormField>
        </div>
      </div>
    </div>
  )
}

function FieldDisplay({ label, value, mono, palette }: { label: string; value: string; mono?: boolean; palette: any }) {
  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide font-medium mb-1" style={{ color: palette.textTertiary }}>
        {label}
      </div>
      <div className={`text-[14px] ${mono ? 'font-mono' : ''}`} style={{ color: palette.text }}>
        {value}
      </div>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] uppercase tracking-wide font-medium mb-1 text-hz-text-tertiary">
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  )
}
