'use client'

import type { CharterContractRef } from '@skyhub/api'
import { CONTRACT_TYPE_LABELS } from './charter-types'
import type { ContractType } from './charter-types'

interface DetailsTabProps {
  contract: CharterContractRef
  isDark: boolean
}

function fmtDate(iso: string | null): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function fmtMoney(val: number | null, currency: string): string {
  if (val == null) return '\u2014'
  return `${currency} ${val.toLocaleString()}`
}

export function DetailsTab({ contract, isDark }: DetailsTabProps) {
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const labelColor = isDark ? '#8F90A6' : '#555770'

  return (
    <div className="p-5 space-y-6">
      {/* Contract */}
      <Section title="Contract" border={sectionBorder} isDark={isDark}>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Number" value={contract.contractNumber} mono labelColor={labelColor} />
          <Field label="Type" value={CONTRACT_TYPE_LABELS[contract.contractType as ContractType]} labelColor={labelColor} />
          <Field label="Start date" value={fmtDate(contract.contractStart)} labelColor={labelColor} />
          <Field label="End date" value={fmtDate(contract.contractEnd)} labelColor={labelColor} />
        </div>
      </Section>

      {/* Client */}
      <Section title="Client" border={sectionBorder} isDark={isDark}>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Company" value={contract.clientName} labelColor={labelColor} />
          <Field label="Contact" value={contract.clientContactName ?? '\u2014'} labelColor={labelColor} />
          <Field label="Email" value={contract.clientContactEmail ?? '\u2014'} labelColor={labelColor} />
          <Field label="Phone" value={contract.clientContactPhone ?? '\u2014'} labelColor={labelColor} />
        </div>
      </Section>

      {/* Aircraft */}
      <Section title="Aircraft" border={sectionBorder} isDark={isDark}>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Type" value={contract.aircraftTypeIcao ?? '\u2014'} mono labelColor={labelColor} />
          <Field label="Registration" value={contract.aircraftRegistration ?? '\u2014'} mono labelColor={labelColor} />
          <Field label="Pax capacity" value={contract.paxCapacity?.toString() ?? '\u2014'} mono labelColor={labelColor} />
        </div>
      </Section>

      {/* Commercial */}
      <Section title="Commercial" border={sectionBorder} isDark={isDark}>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Rate/sector" value={fmtMoney(contract.ratePerSector, contract.currency)} mono labelColor={labelColor} />
          <Field label="Rate/block hour" value={fmtMoney(contract.ratePerBlockHour, contract.currency)} mono labelColor={labelColor} />
          <Field label="Currency" value={contract.currency} mono labelColor={labelColor} />
          <Field label="Fuel surcharge" value={contract.fuelSurchargeIncluded ? 'Yes' : 'No'} labelColor={labelColor} />
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4">
          <Field label="Catering" value={contract.catering === 'operator' ? 'Operator' : contract.catering === 'client' ? 'Client' : 'None'} labelColor={labelColor} />
          <Field label="Cancel <14d" value={`${contract.cancelPenalty14d}%`} mono labelColor={labelColor} />
          <Field label="Cancel <7d" value={`${contract.cancelPenalty7d}%`} mono labelColor={labelColor} />
          <Field label="Cancel <48h" value={`${contract.cancelPenalty48h}%`} mono labelColor={labelColor} />
        </div>
      </Section>
    </div>
  )
}

function Section({ title, border, isDark, children }: { title: string; border: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3" style={{ borderBottom: `1px solid ${border}`, paddingBottom: 8 }}>
        <div className="w-[3px] h-4 rounded-full bg-module-accent" />
        <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: isDark ? '#8F90A6' : '#555770' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, mono, labelColor }: { label: string; value: string; mono?: boolean; labelColor: string }) {
  return (
    <div>
      <div className="text-[13px] font-medium uppercase tracking-wide mb-1" style={{ color: labelColor }}>{label}</div>
      <div className={`text-[13px] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
