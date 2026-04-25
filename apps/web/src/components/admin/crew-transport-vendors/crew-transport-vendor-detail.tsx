'use client'

import { useState, useCallback } from 'react'
import type { CrewTransportVendorRef, AirportRef } from '@skyhub/api'
import { Bus, Info, Phone, FileText, User, Plus, Trash2 } from 'lucide-react'
import { DetailScreenHeader, TabBar, Text, FieldRow, type TabBarItem } from '@/components/ui'
import { api } from '@skyhub/api'

const TABS: TabBarItem[] = [
  { key: 'details', label: 'Vendor Details', icon: Info },
  { key: 'contacts', label: 'Contacts', icon: Phone },
  { key: 'contracts', label: 'Contracts', icon: FileText },
  { key: 'drivers', label: 'Drivers', icon: User },
]

type TabKey = 'details' | 'contacts' | 'contracts' | 'drivers'

interface Props {
  vendor: CrewTransportVendorRef
  airports: AirportRef[]
  onSave?: (id: string, data: Partial<CrewTransportVendorRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onRefresh?: () => void
}

export function CrewTransportVendorDetail({ vendor, airports, onSave, onDelete, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState<Partial<CrewTransportVendorRef>>({})

  const handleEdit = useCallback(() => {
    setDraft({})
    setEditing(true)
    setConfirmDelete(false)
  }, [])

  const handleCancel = useCallback(() => {
    setDraft({})
    setEditing(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!onSave || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(vendor._id, draft)
      setEditing(false)
      setDraft({})
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [onSave, vendor._id, draft])

  const handleDelete = useCallback(async () => {
    if (!onDelete) return
    setSaving(true)
    try {
      await onDelete(vendor._id)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }, [onDelete, vendor._id])

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }) as Partial<CrewTransportVendorRef>)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-hz-border shrink-0">
        <DetailScreenHeader
          icon={Bus}
          title={vendor.vendorName}
          helpCode="5.4.10"
          helpTitle="Crew Transport Vendors"
          helpSubtitle="Ground transport vendors per airport — contracts, vehicle tiers, drivers"
          editing={editing}
          onEdit={onSave ? handleEdit : undefined}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={onDelete ? () => (confirmDelete ? handleDelete() : setConfirmDelete(true)) : undefined}
          saving={saving}
          status={{
            label: vendor.isActive ? 'Active' : 'Inactive',
            tone: vendor.isActive ? 'success' : 'danger',
          }}
        />

        {confirmDelete && (
          <div className="px-6 pb-3">
            <div className="flex items-center gap-2">
              <Text variant="caption" as="span" className="!text-red-500 !font-medium">
                Delete this vendor?
              </Text>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-2.5 py-1 rounded-lg text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as TabKey)} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'details' && (
          <DetailsTab
            vendor={vendor}
            airports={airports}
            editing={editing}
            draft={draft}
            onChange={handleFieldChange}
          />
        )}
        {activeTab === 'contacts' && (
          <ContactsTab vendor={vendor} editing={editing} draft={draft} onDraftChange={setDraft} />
        )}
        {activeTab === 'contracts' && <ContractsTab vendor={vendor} onRefresh={onRefresh ?? (() => undefined)} />}
        {activeTab === 'drivers' && <DriversTab vendor={vendor} onRefresh={onRefresh ?? (() => undefined)} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Details tab
// ─────────────────────────────────────────────────────────────

function DetailsTab({
  vendor,
  airports,
  editing,
  draft,
  onChange,
}: {
  vendor: CrewTransportVendorRef
  airports: AirportRef[]
  editing: boolean
  draft: Partial<CrewTransportVendorRef>
  onChange: (key: string, value: string | number | boolean | null) => void
}) {
  const get = (key: keyof CrewTransportVendorRef) =>
    (key in draft ? (draft as Record<string, unknown>)[key] : vendor[key]) as
      | string
      | number
      | boolean
      | null
      | undefined
  const change = (key: string) => (v: string | number | boolean | null | undefined) => onChange(key, v ?? null)

  void airports // reserved for future ICAO autocomplete

  return (
    <div className="px-6 pt-3 pb-6 space-y-6">
      <Section title="Vendor Info">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          <FieldRow
            label="Vendor Name"
            value={vendor.vendorName}
            editing={editing}
            editValue={get('vendorName')}
            onChangeValue={change('vendorName')}
          />
          <FieldRow
            label="Base Airport ICAO"
            value={vendor.baseAirportIcao}
            editing={editing}
            editValue={get('baseAirportIcao')}
            onChangeValue={change('baseAirportIcao')}
            mono
          />
          <FieldRow
            label="Priority"
            value={vendor.priority}
            editing={editing}
            editValue={get('priority')}
            onChangeValue={change('priority')}
            type="number"
          />
          <FieldRow
            label="Active"
            value={vendor.isActive}
            editing={editing}
            editValue={get('isActive')}
            onChangeValue={change('isActive')}
            type="toggle"
          />
        </div>
      </Section>

      <Section title="Address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <FieldRow
            label="Line 1"
            value={vendor.addressLine1 ?? ''}
            editing={editing}
            editValue={get('addressLine1')}
            onChangeValue={change('addressLine1')}
          />
          <FieldRow
            label="Line 2"
            value={vendor.addressLine2 ?? ''}
            editing={editing}
            editValue={get('addressLine2')}
            onChangeValue={change('addressLine2')}
          />
          <FieldRow
            label="Line 3"
            value={vendor.addressLine3 ?? ''}
            editing={editing}
            editValue={get('addressLine3')}
            onChangeValue={change('addressLine3')}
          />
          <FieldRow
            label="Latitude"
            value={vendor.latitude ?? ''}
            editing={editing}
            editValue={get('latitude')}
            onChangeValue={change('latitude')}
            type="number"
          />
          <FieldRow
            label="Longitude"
            value={vendor.longitude ?? ''}
            editing={editing}
            editValue={get('longitude')}
            onChangeValue={change('longitude')}
            type="number"
          />
        </div>
      </Section>

      <Section title="Service Area">
        <Text variant="secondary" muted as="div" className="text-[13px] mb-1">
          Additional ICAO codes the vendor covers via the same contract (comma-separated).
        </Text>
        <Text variant="body" as="div" className="font-mono text-[13px] text-hz-text">
          {vendor.serviceAreaIcaos.length > 0 ? vendor.serviceAreaIcaos.join(', ') : '—'}
        </Text>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Contacts tab
// ─────────────────────────────────────────────────────────────

function ContactsTab({
  vendor,
  editing,
  draft,
  onDraftChange,
}: {
  vendor: CrewTransportVendorRef
  editing: boolean
  draft: Partial<CrewTransportVendorRef>
  onDraftChange: React.Dispatch<React.SetStateAction<Partial<CrewTransportVendorRef>>>
}) {
  const contacts = (draft.contacts ?? vendor.contacts) as CrewTransportVendorRef['contacts']

  const update = (idx: number, key: 'name' | 'telephone' | 'email', value: string) => {
    const next = [...contacts]
    next[idx] = { ...next[idx]!, [key]: value }
    onDraftChange((d) => ({ ...d, contacts: next }))
  }

  const add = () => {
    const next = [
      ...contacts,
      { _id: '', name: '', telephone: null, email: null },
    ] as CrewTransportVendorRef['contacts']
    onDraftChange((d) => ({ ...d, contacts: next }))
  }

  const remove = (idx: number) => {
    const next = contacts.filter((_, i) => i !== idx)
    onDraftChange((d) => ({ ...d, contacts: next }))
  }

  return (
    <div className="px-6 pt-3 pb-6">
      <Section title="Vendor Contacts">
        <div className="space-y-2">
          {contacts.length === 0 && (
            <Text variant="secondary" muted as="div" className="text-[13px]">
              No contacts yet.
            </Text>
          )}
          {contacts.map((c, idx) => (
            <div key={c._id || idx} className="flex items-center gap-2">
              <input
                type="text"
                value={c.name ?? ''}
                disabled={!editing}
                onChange={(e) => update(idx, 'name', e.target.value)}
                placeholder="Name"
                className="flex-1 h-9 px-3 rounded-lg text-[13px] text-hz-text bg-transparent disabled:opacity-70"
                style={{ border: '1px solid var(--color-hz-border)' }}
              />
              <input
                type="tel"
                value={c.telephone ?? ''}
                disabled={!editing}
                onChange={(e) => update(idx, 'telephone', e.target.value)}
                placeholder="Phone"
                className="w-44 h-9 px-3 rounded-lg text-[13px] text-hz-text bg-transparent disabled:opacity-70"
                style={{ border: '1px solid var(--color-hz-border)' }}
              />
              <input
                type="email"
                value={c.email ?? ''}
                disabled={!editing}
                onChange={(e) => update(idx, 'email', e.target.value)}
                placeholder="Email"
                className="w-64 h-9 px-3 rounded-lg text-[13px] text-hz-text bg-transparent disabled:opacity-70"
                style={{ border: '1px solid var(--color-hz-border)' }}
              />
              {editing && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-[#FF3B3B] hover:bg-[#FF3B3B]/10"
                  aria-label="Remove contact"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {editing && (
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold border border-hz-border bg-hz-card hover:bg-hz-border/30 transition-colors text-hz-text"
            >
              <Plus className="h-3.5 w-3.5" /> Add contact
            </button>
          )}
          {!editing && (
            <Text variant="secondary" muted as="div" className="text-[13px]">
              Click <span className="font-semibold">Edit</span> in the header to modify contacts.
            </Text>
          )}
        </div>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Contracts tab — contracts + nested vehicle tiers
// ─────────────────────────────────────────────────────────────

function ContractsTab({ vendor, onRefresh }: { vendor: CrewTransportVendorRef; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false)

  const addContract = async () => {
    setBusy(true)
    try {
      await api.addTransportVendorContract(vendor._id, {
        contractNo: 'NEW-CONTRACT',
        priority: vendor.contracts.length + 1,
        currency: 'USD',
        minLeadTimeMin: 30,
        slaMin: 15,
      })
      onRefresh()
    } catch (err) {
      console.error('addContract failed', err)
    } finally {
      setBusy(false)
    }
  }

  const removeContract = async (cId: string) => {
    setBusy(true)
    try {
      await api.deleteTransportVendorContract(vendor._id, cId)
      onRefresh()
    } catch (err) {
      console.error('removeContract failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-6 pt-3 pb-6 space-y-4">
      <Section title="Contracts">
        {vendor.contracts.length === 0 ? (
          <Text variant="secondary" muted as="div" className="text-[13px]">
            No contracts yet. Click below to add the first one.
          </Text>
        ) : (
          <div className="space-y-3">
            {vendor.contracts.map((c) => (
              <div key={c._id} className="rounded-xl border border-hz-border p-4 bg-hz-border/[0.04]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-hz-text">{c.contractNo ?? '(unnamed contract)'}</span>
                    <span className="text-[13px] text-hz-text-secondary">
                      Priority P{c.priority} · {c.currency} · SLA {c.slaMin} min · Lead {c.minLeadTimeMin} min
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeContract(c._id)}
                    disabled={busy}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-[#FF3B3B] hover:bg-[#FF3B3B]/10 disabled:opacity-50"
                    aria-label="Delete contract"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">
                  Vehicle tiers
                </div>
                {c.vehicleTiers.length === 0 ? (
                  <Text variant="secondary" muted as="div" className="text-[13px]">
                    No tiers defined.
                  </Text>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead className="text-hz-text-secondary text-[13px]">
                      <tr>
                        <th className="text-left py-1">Tier</th>
                        <th className="text-right py-1">Pax cap</th>
                        <th className="text-right py-1">Per trip</th>
                        <th className="text-right py-1">Per hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.vehicleTiers.map((t) => (
                        <tr key={t._id} className="border-t border-hz-border/50">
                          <td className="py-1.5 text-hz-text">{t.tierName}</td>
                          <td className="py-1.5 text-right tabular-nums text-hz-text">{t.paxCapacity}</td>
                          <td className="py-1.5 text-right tabular-nums text-hz-text">{t.ratePerTrip}</td>
                          <td className="py-1.5 text-right tabular-nums text-hz-text">{t.ratePerHour}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={addContract}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" /> Add contract
          </button>
        </div>
        <Text variant="secondary" muted as="div" className="text-[13px] mt-2">
          Vehicle tiers and detailed rates are edited via the API while the inline editor lands in a follow-up. Use the
          contract row delete to remove an entry.
        </Text>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Drivers tab
// ─────────────────────────────────────────────────────────────

function DriversTab({ vendor, onRefresh }: { vendor: CrewTransportVendorRef; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', vehiclePlate: '' })

  const submit = async () => {
    if (!form.name.trim()) return
    setBusy(true)
    try {
      await api.addTransportVendorDriver(vendor._id, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        vehiclePlate: form.vehiclePlate.trim() || null,
        status: 'active',
      })
      setForm({ name: '', phone: '', vehiclePlate: '' })
      onRefresh()
    } catch (err) {
      console.error('addDriver failed', err)
    } finally {
      setBusy(false)
    }
  }

  const removeDriver = async (dId: string) => {
    setBusy(true)
    try {
      await api.deleteTransportVendorDriver(vendor._id, dId)
      onRefresh()
    } catch (err) {
      console.error('removeDriver failed', err)
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (dId: string, status: 'active' | 'inactive') => {
    setBusy(true)
    try {
      await api.updateTransportVendorDriver(vendor._id, dId, { status })
      onRefresh()
    } catch (err) {
      console.error('updateDriver failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-6 pt-3 pb-6 space-y-4">
      <Section title="Driver Roster">
        {vendor.drivers.length === 0 ? (
          <Text variant="secondary" muted as="div" className="text-[13px]">
            No drivers yet.
          </Text>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-hz-text-secondary text-[13px]">
              <tr>
                <th className="text-left py-1">Name</th>
                <th className="text-left py-1">Phone</th>
                <th className="text-left py-1">Plate</th>
                <th className="text-left py-1">Status</th>
                <th className="w-[80px]" />
              </tr>
            </thead>
            <tbody>
              {vendor.drivers.map((d) => (
                <tr key={d._id} className="border-t border-hz-border/50">
                  <td className="py-1.5 text-hz-text font-medium">{d.name}</td>
                  <td className="py-1.5 text-hz-text font-mono">{d.phone ?? '—'}</td>
                  <td className="py-1.5 text-hz-text font-mono">{d.vehiclePlate ?? '—'}</td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleStatus(d._id, d.status === 'active' ? 'inactive' : 'active')}
                      disabled={busy}
                      className={`text-[13px] px-2 py-0.5 rounded ${
                        d.status === 'active'
                          ? 'bg-[#06C270]/15 text-[#06C270]'
                          : 'bg-hz-border/40 text-hz-text-secondary'
                      }`}
                    >
                      {d.status}
                    </button>
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeDriver(d._id)}
                      disabled={busy}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-[#FF3B3B] hover:bg-[#FF3B3B]/10 disabled:opacity-50"
                      aria-label="Remove driver"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Add driver">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Driver name"
            className="flex-1 h-9 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
            style={{ border: '1px solid var(--color-hz-border)' }}
          />
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Phone"
            className="w-44 h-9 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
            style={{ border: '1px solid var(--color-hz-border)' }}
          />
          <input
            type="text"
            value={form.vehiclePlate}
            onChange={(e) => setForm((f) => ({ ...f, vehiclePlate: e.target.value }))}
            placeholder="Plate"
            className="w-32 h-9 px-3 rounded-lg text-[13px] text-hz-text bg-transparent font-mono"
            style={{ border: '1px solid var(--color-hz-border)' }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !form.name.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
        <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
        {title}
      </div>
      {children}
    </div>
  )
}
