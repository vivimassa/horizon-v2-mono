"use client"

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { CodeshareAgreementRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'

interface AgreementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agreement?: CodeshareAgreementRef | null
  isDark: boolean
  onCreated: (id: string) => void
}

export function AgreementDialog({
  open, onOpenChange, agreement, isDark, onCreated,
}: AgreementDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const inputStyle = { background: inputBg, border: `1px solid ${glassBorder}`, color: palette.text }

  const isEdit = !!agreement
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    partnerAirlineCode: agreement?.partnerAirlineCode || '',
    partnerAirlineName: agreement?.partnerAirlineName || '',
    partnerNumericCode: agreement?.partnerNumericCode || '',
    agreementType: agreement?.agreementType || 'free_sale',
    status: agreement?.status || 'active',
    effectiveFrom: agreement?.effectiveFrom || new Date().toISOString().slice(0, 10),
    effectiveUntil: agreement?.effectiveUntil || '',
    notes: agreement?.notes || '',
  })

  async function handleSubmit() {
    if (!form.partnerAirlineCode || !form.partnerAirlineName || !form.effectiveFrom) {
      setError('IATA code, name, and effective date are required')
      return
    }
    setSaving(true)
    setError('')

    try {
      if (isEdit) {
        await api.updateCodeshareAgreement(agreement!._id, {
          partnerAirlineCode: form.partnerAirlineCode.toUpperCase().trim(),
          partnerAirlineName: form.partnerAirlineName.trim(),
          partnerNumericCode: form.partnerNumericCode.trim() || null,
          agreementType: form.agreementType,
          status: form.status,
          effectiveFrom: form.effectiveFrom,
          effectiveUntil: form.effectiveUntil || null,
          notes: form.notes.trim() || null,
        })
        onCreated(agreement!._id)
      } else {
        const result = await api.createCodeshareAgreement({
          operatorId: getOperatorId(),
          partnerAirlineCode: form.partnerAirlineCode.toUpperCase().trim(),
          partnerAirlineName: form.partnerAirlineName.trim(),
          partnerNumericCode: form.partnerNumericCode.trim() || null,
          agreementType: form.agreementType,
          status: form.status,
          effectiveFrom: form.effectiveFrom,
          effectiveUntil: form.effectiveUntil || null,
          notes: form.notes.trim() || null,
        })
        onCreated(result.id)
      }
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message || 'Failed to save agreement')
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
        className="w-[560px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
          <h2 className="text-[18px] font-bold" style={{ color: palette.text }}>
            {isEdit ? 'Edit Agreement' : 'New Agreement'}
          </h2>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-hz-border/20">
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

          <div className="grid grid-cols-2 gap-3">
            <FormField label="IATA Code *">
              <input
                value={form.partnerAirlineCode}
                onChange={e => setForm(f => ({ ...f, partnerAirlineCode: e.target.value }))}
                maxLength={3}
                placeholder="KE"
                className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono uppercase"
                style={inputStyle}
              />
            </FormField>
            <FormField label="ICAO Code">
              <input
                value={form.partnerNumericCode}
                onChange={e => setForm(f => ({ ...f, partnerNumericCode: e.target.value }))}
                maxLength={4}
                placeholder="KAL"
                className="w-full px-3 h-9 rounded-xl text-[13px] outline-none font-mono uppercase"
                style={inputStyle}
              />
            </FormField>
          </div>

          <FormField label="Airline Name *">
            <input
              value={form.partnerAirlineName}
              onChange={e => setForm(f => ({ ...f, partnerAirlineName: e.target.value }))}
              placeholder="Korean Air"
              className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
              style={inputStyle}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Agreement Type">
              <select
                value={form.agreementType}
                onChange={e => setForm(f => ({ ...f, agreementType: e.target.value as any }))}
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
                onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full h-9 pl-3 pr-8 rounded-xl text-[13px] appearance-none cursor-pointer outline-none"
                style={inputStyle}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Effective From *">
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
                style={inputStyle}
              />
            </FormField>
            <FormField label="Effective Until">
              <input
                type="date"
                value={form.effectiveUntil}
                onChange={e => setForm(f => ({ ...f, effectiveUntil: e.target.value }))}
                className="w-full px-3 h-9 rounded-xl text-[13px] outline-none"
                style={inputStyle}
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Internal notes about this agreement..."
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none resize-none"
              style={inputStyle}
            />
          </FormField>
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
            disabled={saving}
            className="h-9 px-4 rounded-xl text-[13px] font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: accent, color: '#ffffff' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : (isEdit ? 'Update' : 'Create')}
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
