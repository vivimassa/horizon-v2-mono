'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import type { CharterContractRef } from '@skyhub/api'
import { CONTRACT_TYPE_LABELS } from './charter-types'
import type { ContractType } from './charter-types'

const CONTRACT_TYPES = Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]
const CATERING_OPTIONS = [
  { value: 'operator', label: 'Operator provides' },
  { value: 'client', label: 'Client provides' },
  { value: 'none', label: 'None' },
]
const CURRENCY_OPTIONS = ['USD', 'VND', 'EUR']

interface ContractFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: CharterContractRef | null
  onCreated: () => void
  onUpdated: () => void
  isDark: boolean
}

export function ContractFormDialog({ open, onOpenChange, contract, onCreated, onUpdated, isDark }: ContractFormDialogProps) {
  const palette = isDark ? colors.dark : colors.light
  const isEdit = !!contract
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    contractNumber: '',
    contractType: 'passenger',
    clientName: '',
    clientContactName: '',
    clientContactEmail: '',
    clientContactPhone: '',
    aircraftTypeIcao: '',
    aircraftRegistration: '',
    paxCapacity: '',
    contractStart: '',
    contractEnd: '',
    ratePerSector: '',
    ratePerBlockHour: '',
    currency: 'USD',
    catering: 'operator',
    cancelPenalty14d: '50',
    cancelPenalty7d: '100',
    cancelPenalty48h: '100',
  })

  useEffect(() => {
    if (contract) {
      setForm({
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
        clientName: contract.clientName,
        clientContactName: contract.clientContactName ?? '',
        clientContactEmail: contract.clientContactEmail ?? '',
        clientContactPhone: contract.clientContactPhone ?? '',
        aircraftTypeIcao: contract.aircraftTypeIcao ?? '',
        aircraftRegistration: contract.aircraftRegistration ?? '',
        paxCapacity: contract.paxCapacity?.toString() ?? '',
        contractStart: contract.contractStart,
        contractEnd: contract.contractEnd ?? '',
        ratePerSector: contract.ratePerSector?.toString() ?? '',
        ratePerBlockHour: contract.ratePerBlockHour?.toString() ?? '',
        currency: contract.currency,
        catering: contract.catering,
        cancelPenalty14d: contract.cancelPenalty14d.toString(),
        cancelPenalty7d: contract.cancelPenalty7d.toString(),
        cancelPenalty48h: contract.cancelPenalty48h.toString(),
      })
    }
  }, [contract])

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit() {
    if (!form.contractNumber || !form.clientName || !form.contractStart) {
      setError('Contract number, client name, and start date are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        operatorId: getOperatorId(),
        contractNumber: form.contractNumber,
        contractType: form.contractType,
        clientName: form.clientName,
        clientContactName: form.clientContactName || null,
        clientContactEmail: form.clientContactEmail || null,
        clientContactPhone: form.clientContactPhone || null,
        aircraftTypeIcao: form.aircraftTypeIcao.toUpperCase() || null,
        aircraftRegistration: form.aircraftRegistration.toUpperCase() || null,
        paxCapacity: form.paxCapacity ? parseInt(form.paxCapacity, 10) : null,
        contractStart: form.contractStart,
        contractEnd: form.contractEnd || null,
        ratePerSector: form.ratePerSector ? parseFloat(form.ratePerSector) : null,
        ratePerBlockHour: form.ratePerBlockHour ? parseFloat(form.ratePerBlockHour) : null,
        currency: form.currency,
        fuelSurchargeIncluded: false,
        catering: form.catering,
        cancelPenalty14d: parseInt(form.cancelPenalty14d || '50', 10),
        cancelPenalty7d: parseInt(form.cancelPenalty7d || '100', 10),
        cancelPenalty48h: parseInt(form.cancelPenalty48h || '100', 10),
      }

      if (isEdit) {
        await api.updateCharterContract(contract._id, payload)
        onUpdated()
      } else {
        await api.createCharterContract(payload)
        onCreated()
      }
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save contract')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onOpenChange(false) }}
      onKeyDown={e => { if (e.key === 'Escape') onOpenChange(false) }}>
      <div className="w-[680px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: palette.text }}>
              {isEdit ? 'Edit contract' : 'New charter contract'}
            </h2>
            <p className="text-[13px]" style={{ color: palette.textSecondary }}>
              {isEdit ? 'Update contract details.' : 'Create a new charter/ad-hoc contract.'}
            </p>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:opacity-70">
            <X size={16} style={{ color: palette.textSecondary }} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 rounded-lg text-[13px] font-medium" style={{ background: 'rgba(255,59,59,0.10)', color: isDark ? '#FF5C5C' : '#E63535' }}>
              {error}
            </div>
          )}

          {/* Contract identity */}
          <Fieldset label="Contract">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Contract number *" value={form.contractNumber} onChange={v => update('contractNumber', v)} placeholder="VT-2026-001" mono style={inputStyle} palette={palette} />
              <SelectField label="Contract type" value={form.contractType} onChange={v => update('contractType', v)}
                options={CONTRACT_TYPES.map(([k, v]) => ({ value: k, label: v }))} style={inputStyle} palette={palette} />
              <SelectField label="Catering" value={form.catering} onChange={v => update('catering', v)}
                options={CATERING_OPTIONS} style={inputStyle} palette={palette} />
            </div>
          </Fieldset>

          {/* Client */}
          <Fieldset label="Client">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company name *" value={form.clientName} onChange={v => update('clientName', v)} placeholder="Acme Corp" style={inputStyle} palette={palette} />
              <Field label="Contact name" value={form.clientContactName} onChange={v => update('clientContactName', v)} style={inputStyle} palette={palette} />
              <Field label="Email" value={form.clientContactEmail} onChange={v => update('clientContactEmail', v)} type="email" style={inputStyle} palette={palette} />
              <Field label="Phone" value={form.clientContactPhone} onChange={v => update('clientContactPhone', v)} style={inputStyle} palette={palette} />
            </div>
          </Fieldset>

          {/* Aircraft & Period */}
          <Fieldset label="Aircraft &amp; Period">
            <div className="grid grid-cols-4 gap-3">
              <Field label="AC type" value={form.aircraftTypeIcao} onChange={v => update('aircraftTypeIcao', v.toUpperCase())} placeholder="A321" mono maxLength={4} style={inputStyle} palette={palette} />
              <Field label="Registration" value={form.aircraftRegistration} onChange={v => update('aircraftRegistration', v.toUpperCase())} placeholder="VN-A123" mono style={inputStyle} palette={palette} />
              <Field label="Start date *" value={form.contractStart} onChange={v => update('contractStart', v)} type="date" style={inputStyle} palette={palette} />
              <Field label="End date" value={form.contractEnd} onChange={v => update('contractEnd', v)} type="date" style={inputStyle} palette={palette} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="Pax capacity" value={form.paxCapacity} onChange={v => update('paxCapacity', v)} type="number" style={inputStyle} palette={palette} />
            </div>
          </Fieldset>

          {/* Commercial */}
          <Fieldset label="Commercial">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Rate/sector" value={form.ratePerSector} onChange={v => update('ratePerSector', v)} type="number" placeholder="85000" mono style={inputStyle} palette={palette} />
              <Field label="Rate/block hour" value={form.ratePerBlockHour} onChange={v => update('ratePerBlockHour', v)} type="number" placeholder="4500" mono style={inputStyle} palette={palette} />
              <SelectField label="Currency" value={form.currency} onChange={v => update('currency', v)}
                options={CURRENCY_OPTIONS.map(c => ({ value: c, label: c }))} style={inputStyle} palette={palette} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="Cancel <14d (%)" value={form.cancelPenalty14d} onChange={v => update('cancelPenalty14d', v)} type="number" style={inputStyle} palette={palette} />
              <Field label="Cancel <7d (%)" value={form.cancelPenalty7d} onChange={v => update('cancelPenalty7d', v)} type="number" style={inputStyle} palette={palette} />
              <Field label="Cancel <48h (%)" value={form.cancelPenalty48h} onChange={v => update('cancelPenalty48h', v)} type="number" style={inputStyle} palette={palette} />
            </div>
          </Fieldset>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <button onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-colors"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${glassBorder}` }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="h-9 px-4 flex items-center gap-2 rounded-lg text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create contract'}
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

function Field({ label, value, onChange, placeholder, type = 'text', mono, maxLength, style, palette }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; mono?: boolean; maxLength?: number
  style: Record<string, string>; palette: { text: string; textSecondary: string }
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1" style={{ color: palette.textSecondary }}>{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} type={type} maxLength={maxLength}
        className={`w-full h-10 px-3 rounded-lg text-[13px] outline-none ${mono ? 'font-mono' : ''}`}
        style={style}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options, style, palette }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
  style: Record<string, string>; palette: { text: string; textSecondary: string }
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1" style={{ color: palette.textSecondary }}>{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg text-[13px] outline-none appearance-none cursor-pointer"
        style={style}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
