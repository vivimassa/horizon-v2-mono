'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type CarrierCodeRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import {
  FieldRow,
  ListScreenHeader,
  DetailScreenHeader,
  TabBar,
  TextInput,
  Text,
  type TabBarItem,
} from '@/components/ui'
import { getOperatorId } from '@/stores/use-operator-store'
import { Building2, Info, Phone, Settings2, Clock, Plus, X } from 'lucide-react'

const CATEGORY_OPTIONS = [
  { label: 'Air', value: 'Air' },
  { label: 'Ground', value: 'Ground' },
  { label: 'Other', value: 'Other' },
]

const TABS: TabBarItem[] = [
  { key: 'basic', label: 'Basic', icon: Info },
  { key: 'contact', label: 'Contact', icon: Phone },
  { key: 'times', label: 'Report & Debrief', icon: Clock },
  { key: 'additional', label: 'Additional Info', icon: Settings2 },
]

type TabKey = 'basic' | 'contact' | 'times' | 'additional'

// ── Time helpers ──

function minutesToHHMM(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToMinutes(str: string): number | null {
  const trimmed = str.trim()
  if (!trimmed) return null
  if (trimmed.includes(':')) {
    const [hStr, mStr] = trimmed.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
  }
  const num = trimmed.replace(/\D/g, '')
  if (!num) return null
  if (num.length >= 3) {
    const mins = parseInt(num.slice(-2), 10)
    const hrs = parseInt(num.slice(0, -2), 10)
    return hrs * 60 + mins
  }
  return (parseInt(num, 10) || 0) * 60
}

function getAirlineLogoUrl(iataCode: string): string {
  return `https://pics.avs.io/200/80/${iataCode}.png`
}

export function CarrierCodesShell() {
  const [carriers, setCarriers] = useState<CarrierCodeRef[]>([])
  const [selected, setSelected] = useState<CarrierCodeRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    setLoading(true)
    api
      .getCarrierCodes()
      .then((data) => {
        setCarriers(data)
        setSelected((prev: CarrierCodeRef | null) => {
          if (prev) {
            const found = data.find((c) => c._id === prev._id)
            if (found) return found
          }
          return data.length > 0 ? data[0] : null
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = useCallback(
    async (id: string, data: Partial<CarrierCodeRef>) => {
      await api.updateCarrierCode(id, data)
      fetchData()
    },
    [fetchData],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteCarrierCode(id)
      setSelected(null)
      fetchData()
    },
    [fetchData],
  )

  const handleCreate = useCallback(
    async (data: Partial<CarrierCodeRef>) => {
      const created = await api.createCarrierCode(data)
      fetchData()
      setTimeout(() => setSelected(created), 300)
    },
    [fetchData],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return carriers
    return carriers.filter(
      (c) =>
        c.iataCode.toLowerCase().includes(q) ||
        (c.icaoCode?.toLowerCase().includes(q) ?? false) ||
        c.name.toLowerCase().includes(q),
    )
  }, [carriers, search])

  return (
    <MasterDetailLayout
      left={
        <CarrierList
          carriers={filtered}
          totalCount={carriers.length}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={() => setSelected(null)}
        />
      }
      center={
        <CarrierDetail
          carrier={selected}
          onSave={handleSave}
          onDelete={handleDelete}
          onCreate={handleCreate}
          onCancelCreate={() => {
            if (carriers.length > 0) setSelected(carriers[0])
          }}
        />
      }
    />
  )
}

// ── List ──

function CarrierList({
  carriers,
  totalCount,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onCreateClick,
}: {
  carriers: CarrierCodeRef[]
  totalCount: number
  selected: CarrierCodeRef | null
  onSelect: (c: CarrierCodeRef) => void
  search: string
  onSearchChange: (v: string) => void
  loading: boolean
  onCreateClick: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-hz-border shrink-0">
        <ListScreenHeader
          icon={Building2}
          title="Carrier Codes"
          count={totalCount}
          filteredCount={carriers.length}
          countLabel="carrier"
          addLabel="Add"
          onAdd={onCreateClick}
        />
        <div className="px-4 pb-3">
          <TextInput
            placeholder="Search code or name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <Text variant="secondary" muted as="div" className="animate-pulse px-3 py-4">
            Loading...
          </Text>
        ) : carriers.length === 0 ? (
          <Text variant="secondary" muted as="div" className="px-3 py-4">
            No carrier codes found
          </Text>
        ) : (
          <div className="space-y-0.5">
            {carriers.map((c) => {
              const isSelected = selected?._id === c._id
              return (
                <button
                  key={c._id}
                  onClick={() => onSelect(c)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                      : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                  }`}
                >
                  <div className="w-8 h-5 rounded overflow-hidden bg-hz-border/20 flex items-center justify-center shrink-0">
                    <img
                      src={getAirlineLogoUrl(c.iataCode)}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <Text variant="body" as="span" className="!font-bold font-mono">
                    {c.iataCode}
                  </Text>
                  {c.icaoCode && (
                    <Text variant="secondary" muted as="span" className="font-mono">
                      {c.icaoCode}
                    </Text>
                  )}
                  <Text variant="cardTitle" as="span" className="!font-medium truncate">
                    {c.name}
                  </Text>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Detail ──

function CarrierDetail({
  carrier,
  onSave,
  onDelete,
  onCreate,
  onCancelCreate,
}: {
  carrier: CarrierCodeRef | null
  onSave?: (id: string, data: Partial<CarrierCodeRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<CarrierCodeRef>) => Promise<void>
  onCancelCreate?: () => void
}) {
  const isCreateMode = !carrier
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(isCreateMode)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>(
    isCreateMode ? { iataCode: '', icaoCode: '', name: '', category: 'Air', isActive: true } : {},
  )
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isCreateMode) {
      setEditing(true)
      setDraft({ iataCode: '', icaoCode: '', name: '', category: 'Air', isActive: true })
      setActiveTab('basic')
    } else {
      setEditing(false)
      setDraft({})
    }
  }, [isCreateMode, carrier?._id])

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || 'Failed'
    try {
      const match = msg.match(/API (\d+): (.+)/)
      if (match) {
        const parsed = JSON.parse(match[2])
        if (Number(match[1]) === 409) return parsed.error || 'This carrier code already exists.'
        return parsed.error || parsed.details?.join(', ') || msg
      }
    } catch {}
    return msg
  }, [])

  const handleEdit = useCallback(() => {
    setDraft({})
    setEditing(true)
    setConfirmDelete(false)
  }, [])
  const handleCancel = useCallback(() => {
    if (isCreateMode && onCancelCreate) {
      onCancelCreate()
      return
    }
    setDraft({})
    setEditing(false)
  }, [isCreateMode, onCancelCreate])

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null | undefined) => {
    setDraft((prev) => ({ ...prev, [key]: value ?? null }))
  }, [])
  const change = (key: string) => (v: string | number | boolean | null | undefined) => handleFieldChange(key, v)

  const handleNestedChange = useCallback((path: string, value: number | null) => {
    const [parent, child] = path.split('.')
    setDraft((prev) => {
      const existing = (prev[parent] as Record<string, unknown>) || {}
      return { ...prev, [parent]: { ...existing, [child]: value } }
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (isCreateMode) {
      if (!onCreate) return
      const d = draft as Record<string, any>
      if (!d.iataCode || !d.name) {
        setErrorMsg('IATA code and name are required')
        return
      }
      setSaving(true)
      setErrorMsg('')
      try {
        const payload: Record<string, any> = { operatorId: getOperatorId() }
        for (const [k, v] of Object.entries(d)) {
          payload[k] = v === '' || v === undefined ? null : v
        }
        if (payload.iataCode) payload.iataCode = (payload.iataCode as string).toUpperCase()
        if (payload.icaoCode) payload.icaoCode = (payload.icaoCode as string).toUpperCase()
        await onCreate(payload as Partial<CarrierCodeRef>)
      } catch (err: any) {
        setErrorMsg(friendlyError(err))
      } finally {
        setSaving(false)
      }
      return
    }
    if (!onSave || !carrier || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      await onSave(carrier._id, draft as Partial<CarrierCodeRef>)
      setEditing(false)
      setDraft({})
    } catch (err: any) {
      setErrorMsg(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }, [isCreateMode, onCreate, onSave, carrier, draft, friendlyError])

  const handleDelete = useCallback(async () => {
    if (!onDelete || !carrier) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onDelete(carrier._id)
    } catch (err: any) {
      setErrorMsg(friendlyError(err))
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }, [onDelete, carrier, friendlyError])

  const getVal = (key: keyof CarrierCodeRef) => {
    if (key in draft) return (draft as any)[key]
    return carrier ? carrier[key] : null
  }

  const getNestedVal = (parent: keyof CarrierCodeRef, child: string) => {
    const draftParent = draft[parent] as Record<string, unknown> | undefined
    if (draftParent && child in draftParent) return draftParent[child] as any
    if (!carrier) return null
    const orig = carrier[parent] as Record<string, unknown> | null
    return orig?.[child] ?? null
  }

  const displayIata = (getVal('iataCode') as string) || ''
  const displayIcao = (getVal('icaoCode') as string) || ''
  const displayName = (getVal('name') as string) || ''
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => {
    setLogoFailed(false)
  }, [displayIata])

  const accent = 'var(--module-accent, #1e40af)'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero banner */}
      <div
        className="relative shrink-0 h-[160px] overflow-hidden border-b border-hz-border"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 5%, transparent) 0%, transparent 60%)`,
        }}
      >
        <div className="absolute inset-0 flex items-center px-8 gap-8">
          <div
            className="w-[140px] h-[90px] rounded-xl border border-hz-border/40 flex items-center justify-center shrink-0 overflow-hidden shadow-sm"
            style={{ background: `linear-gradient(145deg, white, color-mix(in srgb, ${accent} 6%, white))` }}
          >
            {displayIata && !logoFailed ? (
              <img
                src={getAirlineLogoUrl(displayIata)}
                alt={displayIata}
                className="w-[120px] h-[70px] object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <img src="/skyhub-logo.png" alt="SkyHub" className="w-[100px] h-[50px] object-contain opacity-40" />
            )}
          </div>
          <div
            className="w-px h-16 shrink-0"
            style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}
          />
          <div className="flex flex-col gap-2.5 min-w-0">
            <div className="flex items-baseline gap-3 min-w-0">
              {displayName ? (
                <Text as="span" className="!text-[24px] !font-bold !leading-tight truncate">
                  {displayName}
                </Text>
              ) : (
                <Text as="span" muted className="!text-[24px] !font-bold !leading-tight">
                  New Carrier
                </Text>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {displayIata && (
                <Text
                  variant="secondary"
                  as="span"
                  className="!font-bold font-mono px-2 py-0.5 rounded-md !text-hz-text"
                  style={{ background: `color-mix(in srgb, ${accent} 8%, transparent)` }}
                >
                  {displayIata}
                </Text>
              )}
              {displayIcao && (
                <Text variant="secondary" muted as="span" className="font-mono">
                  {displayIcao}
                </Text>
              )}
              <span className="text-hz-border">|</span>
              {carrier?.category && (
                <Text
                  variant="badge"
                  as="span"
                  className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"
                >
                  {carrier.category}
                </Text>
              )}
              {carrier?.defaultCurrency && (
                <Text variant="secondary" muted as="span" className="font-mono">
                  {carrier.defaultCurrency}
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header bar with actions */}
      <div className="border-b border-hz-border shrink-0">
        <DetailScreenHeader
          title={isCreateMode ? 'New Carrier' : displayName || 'Carrier'}
          editing={editing}
          onEdit={!isCreateMode && onSave ? handleEdit : undefined}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={
            !isCreateMode && onDelete ? () => (confirmDelete ? handleDelete() : setConfirmDelete(true)) : undefined
          }
          saving={saving}
          status={
            !isCreateMode && carrier
              ? {
                  label: carrier.isActive ? 'Active' : 'Inactive',
                  tone: carrier.isActive ? 'success' : 'danger',
                }
              : undefined
          }
        />
        {confirmDelete && (
          <div className="px-6 pb-3 flex items-center gap-2">
            <Text variant="caption" as="span" className="!text-[#E63535] !font-medium">
              Delete this carrier?
            </Text>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-2.5 py-1 rounded-lg text-[13px] font-semibold text-white bg-[#E63535] hover:opacity-90 transition-opacity"
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <Text variant="caption" as="span" className="!text-red-700 dark:!text-red-400">
              {errorMsg}
            </Text>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 shrink-0 ml-auto">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 shrink-0">
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as TabKey)} />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-3 pb-6">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow
                label="IATA Code"
                value={getVal('iataCode') as string}
                editing={editing}
                editValue={getVal('iataCode')}
                onChangeValue={change('iataCode')}
                mono
                maxLength={2}
              />
              <FieldRow
                label="ICAO Code"
                value={getVal('icaoCode') as string}
                editing={editing}
                editValue={getVal('icaoCode')}
                onChangeValue={change('icaoCode')}
                mono
                maxLength={3}
              />
              <FieldRow
                label="Name"
                value={getVal('name') as string}
                editing={editing}
                editValue={getVal('name')}
                onChangeValue={change('name')}
              />
              <FieldRow
                label="Category"
                value={getVal('category') as string}
                editing={editing}
                editValue={getVal('category')}
                onChangeValue={change('category')}
                type="select"
                options={CATEGORY_OPTIONS}
              />
              <FieldRow
                label="Vendor Number"
                value={getVal('vendorNumber') as string}
                editing={editing}
                editValue={getVal('vendorNumber')}
                onChangeValue={change('vendorNumber')}
              />
              <FieldRow
                label="Active"
                value={getVal('isActive') as boolean}
                editing={editing}
                editValue={getVal('isActive')}
                onChangeValue={change('isActive')}
                type="toggle"
              />
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow
                label="Contact Name"
                value={getVal('contactName') as string}
                editing={editing}
                editValue={getVal('contactName')}
                onChangeValue={change('contactName')}
              />
              <FieldRow
                label="Position"
                value={getVal('contactPosition') as string}
                editing={editing}
                editValue={getVal('contactPosition')}
                onChangeValue={change('contactPosition')}
              />
              <FieldRow
                label="Phone"
                value={getVal('phone') as string}
                editing={editing}
                editValue={getVal('phone')}
                onChangeValue={change('phone')}
              />
              <FieldRow
                label="Email"
                value={getVal('email') as string}
                editing={editing}
                editValue={getVal('email')}
                onChangeValue={change('email')}
              />
              <FieldRow
                label="SITA"
                value={getVal('sita') as string}
                editing={editing}
                editValue={getVal('sita')}
                onChangeValue={change('sita')}
                mono
              />
              <FieldRow
                label="Website"
                value={getVal('website') as string}
                editing={editing}
                editValue={getVal('website')}
                onChangeValue={change('website')}
              />
            </div>
          )}

          {activeTab === 'times' && (
            <div className="space-y-6">
              <Section title="Report & Debrief Times">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-4 w-28">
                          <Text variant="fieldLabel" muted as="span">
                            &nbsp;
                          </Text>
                        </th>
                        <th className="text-center py-2 px-3">
                          <Text variant="fieldLabel" muted as="span">
                            Report
                          </Text>
                        </th>
                        <th className="text-center py-2 px-3">
                          <Text variant="fieldLabel" muted as="span">
                            Debrief
                          </Text>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-hz-border/50">
                        <td className="py-3 pr-4">
                          <Text variant="fieldLabel" muted as="span">
                            Cockpit
                          </Text>
                        </td>
                        <TimeCell
                          value={getNestedVal('cockpitTimes', 'reportMinutes')}
                          editing={editing}
                          onChange={(v) => handleNestedChange('cockpitTimes.reportMinutes', v)}
                        />
                        <TimeCell
                          value={getNestedVal('cockpitTimes', 'debriefMinutes')}
                          editing={editing}
                          onChange={(v) => handleNestedChange('cockpitTimes.debriefMinutes', v)}
                        />
                      </tr>
                      <tr className="border-t border-hz-border/50">
                        <td className="py-3 pr-4">
                          <Text variant="fieldLabel" muted as="span">
                            Cabin
                          </Text>
                        </td>
                        <TimeCell
                          value={getNestedVal('cabinTimes', 'reportMinutes')}
                          editing={editing}
                          onChange={(v) => handleNestedChange('cabinTimes.reportMinutes', v)}
                        />
                        <TimeCell
                          value={getNestedVal('cabinTimes', 'debriefMinutes')}
                          editing={editing}
                          onChange={(v) => handleNestedChange('cabinTimes.debriefMinutes', v)}
                        />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
              <Section title="Capacity">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <FieldRow
                    label="Capacity (Passengers)"
                    value={getVal('capacity') as number}
                    editing={editing}
                    editValue={getVal('capacity')}
                    onChangeValue={change('capacity')}
                    type="number"
                  />
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'additional' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow
                label="Default Currency"
                value={getVal('defaultCurrency') as string}
                editing={editing}
                editValue={getVal('defaultCurrency')}
                onChangeValue={change('defaultCurrency')}
                mono
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Time cell (HH:MM display/edit for report & debrief table) ──

function TimeCell({
  value,
  editing,
  onChange,
}: {
  value: number | null
  editing: boolean
  onChange: (v: number | null) => void
}) {
  const [text, setText] = useState(minutesToHHMM(value))
  useEffect(() => {
    setText(minutesToHHMM(value))
  }, [value])

  if (editing) {
    return (
      <td className="text-center py-3 px-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onChange(hhmmToMinutes(text))}
          placeholder="HH:MM"
          className="w-20 text-center text-[14px] font-mono font-medium bg-transparent border-b border-module-accent/30 outline-none focus:border-module-accent py-0.5 text-hz-text mx-auto"
        />
      </td>
    )
  }
  return (
    <td className="text-center py-3 px-3">
      <Text variant="body" as="span" className="font-mono !font-medium">
        {value != null ? minutesToHHMM(value) : '\u2014'}
      </Text>
    </td>
  )
}

// ── Section wrapper ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-4 rounded-full bg-module-accent" />
        <Text variant="cardTitle" as="span" className="!font-semibold">
          {title}
        </Text>
      </div>
      {children}
    </div>
  )
}
