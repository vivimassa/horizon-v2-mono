'use client'

import { useState, useCallback, useRef } from 'react'
import type { CountryRef } from '@skyhub/api'
import { CountryFlag } from '@/components/ui/country-flag'
import { CountryMap } from './country-map'
import { FieldRow } from '../airports/field-row'
import { Info, Landmark, Pencil, Save, X, Trash2, Plus, XCircle, AlertCircle, Check } from 'lucide-react'

// ── Alert (XD pattern) ──
function Alert({
  type,
  message,
  onDismiss,
}: {
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
  onDismiss?: () => void
}) {
  const c = {
    info: { bar: '#0063F7', icon: AlertCircle, bg: 'rgba(0,99,247,0.08)' },
    success: { bar: '#06C270', icon: Check, bg: 'rgba(6,194,112,0.08)' },
    error: { bar: '#E63535', icon: XCircle, bg: 'rgba(255,59,59,0.08)' },
    warning: { bar: '#FF8800', icon: AlertCircle, bg: 'rgba(255,136,0,0.08)' },
  }[type]
  const Icon = c.icon
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-hz-border/50"
      style={{ backgroundColor: c.bg }}
    >
      <div
        className="w-[3px] h-full min-h-[20px] rounded-full shrink-0 self-stretch"
        style={{ backgroundColor: c.bar }}
      />
      <Icon size={15} className="shrink-0 mt-0.5" style={{ color: c.bar }} />
      <span className="text-[13px] flex-1" style={{ color: c.bar }}>
        {message}
      </span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 p-0.5 rounded hover:bg-hz-border/30 transition-colors">
          <X size={13} style={{ color: c.bar }} />
        </button>
      )}
    </div>
  )
}

// ── Delete Modal (XD pattern) ──
function DeleteModal({
  onConfirm,
  onCancel,
  saving,
}: {
  onConfirm: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(255,59,59,0.12)' }}
          >
            <Trash2 size={20} style={{ color: '#E63535' }} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold">Delete country?</h3>
            <p className="text-[13px] text-hz-text-secondary mt-1">
              This will permanently remove the country from the database. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors"
          >
            No, Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#E63535' }}
          >
            {saving ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'basic', label: 'Basic', icon: Info },
  { key: 'extra', label: 'Currency & Details', icon: Landmark },
] as const

type TabKey = (typeof TABS)[number]['key']

interface CountryDetailProps {
  country: CountryRef
  onSave?: (id: string, data: Partial<CountryRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<CountryRef>) => Promise<void>
}

export function CountryDetail({ country, onSave, onDelete, onCreate }: CountryDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [draft, setDraft] = useState<Partial<CountryRef>>({})
  const [errorMsg, setErrorMsg] = useState('')

  // Create flow
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({
    isoCode2: '',
    isoCode3: '',
    name: '',
    officialName: '',
    region: '',
    subRegion: '',
    icaoPrefix: '',
    currencyCode: '',
    currencyName: '',
    currencySymbol: '',
    phoneCode: '',
    flagEmoji: '',
    latitude: '',
    longitude: '',
  })

  const resetCreate = useCallback(() => {
    setShowCreate(false)
    setCreateError('')
    setCreateForm({
      isoCode2: '',
      isoCode3: '',
      name: '',
      officialName: '',
      region: '',
      subRegion: '',
      icaoPrefix: '',
      currencyCode: '',
      currencyName: '',
      currencySymbol: '',
      phoneCode: '',
      flagEmoji: '',
      latitude: '',
      longitude: '',
    })
  }, [])

  const friendlyCreateError = useCallback((err: any) => {
    const msg = err.message || 'Create failed'
    try {
      const match = msg.match(/API (\d+): (.+)/)
      if (match) {
        const parsed = JSON.parse(match[2])
        if (Number(match[1]) === 409) {
          return `This country already exists in the database. You can find it using the search on the left panel.`
        }
        return parsed.error || parsed.details?.join(', ') || msg
      }
    } catch {
      /* use raw msg */
    }
    return msg
  }, [])

  const handleManualCreate = useCallback(async () => {
    if (!onCreate) return
    if (!createForm.isoCode2 || !createForm.isoCode3 || !createForm.name) {
      setCreateError('ISO 2, ISO 3, and name are required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await onCreate({
        isoCode2: createForm.isoCode2.toUpperCase(),
        isoCode3: createForm.isoCode3.toUpperCase(),
        name: createForm.name,
        officialName: createForm.officialName || null,
        region: createForm.region || null,
        subRegion: createForm.subRegion || null,
        icaoPrefix: createForm.icaoPrefix || null,
        currencyCode: createForm.currencyCode || null,
        currencyName: createForm.currencyName || null,
        currencySymbol: createForm.currencySymbol || null,
        phoneCode: createForm.phoneCode || null,
        flagEmoji: createForm.flagEmoji || null,
        latitude: createForm.latitude ? Number(createForm.latitude) : null,
        longitude: createForm.longitude ? Number(createForm.longitude) : null,
        isActive: true,
      } as Partial<CountryRef>)
      resetCreate()
    } catch (err: any) {
      setCreateError(friendlyCreateError(err))
    } finally {
      setCreating(false)
    }
  }, [onCreate, createForm, resetCreate, friendlyCreateError])

  const handleEdit = useCallback(() => {
    setDraft({})
    setEditing(true)
    setShowDeleteModal(false)
  }, [])

  const handleCancel = useCallback(() => {
    setDraft({})
    setEditing(false)
  }, [])

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!onSave || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(country._id, draft)
      setEditing(false)
      setDraft({})
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [onSave, country._id, draft])

  const handleDelete = useCallback(async () => {
    if (!onDelete) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onDelete(country._id)
    } catch (err: any) {
      const msg = err.message || 'Delete failed'
      const match = msg.match(/API \d+: (.+)/)
      try {
        const parsed = JSON.parse(match?.[1] ?? '{}')
        setErrorMsg(parsed.error || msg)
      } catch {
        setErrorMsg(match?.[1] || msg)
      }
    } finally {
      setSaving(false)
      setShowDeleteModal(false)
    }
  }, [onDelete, country._id])

  // Resizable map
  const [mapHeight, setMapHeight] = useState(300)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startH: mapHeight }

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = ev.clientY - dragRef.current.startY
        setMapHeight(Math.max(150, Math.min(700, dragRef.current.startH + delta)))
      }
      const onUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [mapHeight],
  )

  const getVal = (key: keyof CountryRef) => (key in draft ? (draft as any)[key] : country[key])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} saving={saving} />
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {country.isoCode2 && <CountryFlag iso2={country.isoCode2} size={28} />}
            <h1 className="text-xl font-semibold">{country.name}</h1>
            {country.isActive ? (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-[rgba(6,194,112,0.12)] text-[#06C270] dark:bg-[rgba(57,217,138,0.15)] dark:text-[#39D98A]">
                Active
              </span>
            ) : (
              <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-[rgba(255,59,59,0.12)] text-[#E63535] dark:bg-[rgba(255,92,92,0.15)] dark:text-[#FF5C5C]">
                Inactive
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-module-accent transition-colors"
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Delete country"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {onSave && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {onCreate && (
                  <button
                    onClick={() => {
                      resetCreate()
                      setShowCreate(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-module-accent transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3">
            <Alert type="error" message={errorMsg} onDismiss={() => setErrorMsg('')} />
          </div>
        )}
      </div>

      {/* ── Create Country Panel ── */}
      {showCreate && (
        <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3 overflow-y-auto max-h-[50vh]">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Add New Country</span>
            <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">
              Cancel
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <MiniInput
                label="ISO 2 Code *"
                value={createForm.isoCode2}
                maxLength={2}
                mono
                onChange={(v) => setCreateForm((p) => ({ ...p, isoCode2: v.toUpperCase() }))}
              />
              <MiniInput
                label="ISO 3 Code *"
                value={createForm.isoCode3}
                maxLength={3}
                mono
                onChange={(v) => setCreateForm((p) => ({ ...p, isoCode3: v.toUpperCase() }))}
              />
              <MiniInput
                label="Flag Emoji"
                value={createForm.flagEmoji}
                onChange={(v) => setCreateForm((p) => ({ ...p, flagEmoji: v }))}
              />
            </div>
            <MiniInput
              label="Country Name *"
              value={createForm.name}
              onChange={(v) => setCreateForm((p) => ({ ...p, name: v }))}
            />
            <MiniInput
              label="Official Name"
              value={createForm.officialName}
              onChange={(v) => setCreateForm((p) => ({ ...p, officialName: v }))}
            />
            <div className="flex gap-3">
              <MiniInput
                label="Region"
                value={createForm.region}
                onChange={(v) => setCreateForm((p) => ({ ...p, region: v }))}
              />
              <MiniInput
                label="Sub-region"
                value={createForm.subRegion}
                onChange={(v) => setCreateForm((p) => ({ ...p, subRegion: v }))}
              />
            </div>
            <div className="flex gap-3">
              <MiniInput
                label="ICAO Prefix"
                value={createForm.icaoPrefix}
                mono
                onChange={(v) => setCreateForm((p) => ({ ...p, icaoPrefix: v.toUpperCase() }))}
              />
              <MiniInput
                label="Phone Code"
                value={createForm.phoneCode}
                onChange={(v) => setCreateForm((p) => ({ ...p, phoneCode: v }))}
              />
            </div>
            <div className="flex gap-3">
              <MiniInput
                label="Currency Code"
                value={createForm.currencyCode}
                mono
                onChange={(v) => setCreateForm((p) => ({ ...p, currencyCode: v.toUpperCase() }))}
              />
              <MiniInput
                label="Currency Name"
                value={createForm.currencyName}
                onChange={(v) => setCreateForm((p) => ({ ...p, currencyName: v }))}
              />
              <MiniInput
                label="Currency Symbol"
                value={createForm.currencySymbol}
                onChange={(v) => setCreateForm((p) => ({ ...p, currencySymbol: v }))}
              />
            </div>
            <div className="flex gap-3">
              <MiniInput
                label="Latitude"
                value={createForm.latitude}
                type="number"
                onChange={(v) => setCreateForm((p) => ({ ...p, latitude: v }))}
              />
              <MiniInput
                label="Longitude"
                value={createForm.longitude}
                type="number"
                onChange={(v) => setCreateForm((p) => ({ ...p, longitude: v }))}
              />
            </div>

            <button
              onClick={handleManualCreate}
              disabled={creating}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white bg-module-accent transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Add to Database'}
            </button>
          </div>

          {createError && <Alert type="error" message={createError} onDismiss={() => setCreateError('')} />}
        </div>
      )}

      {/* Map */}
      {country.isoCode2 && (
        <div className="shrink-0 border-b border-hz-border relative" style={{ height: mapHeight }}>
          <CountryMap
            iso2={country.isoCode2}
            name={country.name}
            officialName={country.officialName}
            latitude={country.latitude}
            longitude={country.longitude}
          />
          {/* Drag handle */}
          <div
            onMouseDown={onDragStart}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-10 group flex items-center justify-center"
          >
            <div className="w-10 h-1 rounded-full bg-hz-text-secondary/30 group-hover:bg-hz-text-secondary/60 transition-colors" />
          </div>
        </div>
      )}

      {/* Tabs — underline style */}
      <div className="flex items-center gap-0 px-4 border-b border-hz-border shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors duration-150 shrink-0 ${
                active ? 'text-module-accent' : 'text-hz-text-secondary hover:text-hz-text'
              }`}
            >
              <Icon className="h-4 w-4" /> {tab.label}
              {active && <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-module-accent" />}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'basic' && (
          <CountryBasicTab country={country} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
        {activeTab === 'extra' && (
          <CountryExtraTab country={country} editing={editing} draft={draft} onChange={handleFieldChange} />
        )}
      </div>
    </div>
  )
}

/* ── Basic Tab ── */
function CountryBasicTab({
  country,
  editing,
  draft = {},
  onChange,
}: {
  country: CountryRef
  editing?: boolean
  draft?: Partial<CountryRef>
  onChange?: (key: string, value: string | number | boolean | null) => void
}) {
  const get = (key: keyof CountryRef) => (key in draft ? (draft as any)[key] : country[key])

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
        <FieldRow
          label="Country Name"
          value={country.name}
          editing={editing}
          fieldKey="name"
          editValue={get('name')}
          onChange={onChange}
        />
        <FieldRow
          label="Official Name"
          value={country.officialName}
          editing={editing}
          fieldKey="officialName"
          editValue={get('officialName')}
          onChange={onChange}
        />
        <FieldRow
          label="ISO 2 Code"
          value={country.isoCode2}
          editing={editing}
          fieldKey="isoCode2"
          editValue={get('isoCode2')}
          onChange={onChange}
        />
        <FieldRow
          label="ISO 3 Code"
          value={country.isoCode3}
          editing={editing}
          fieldKey="isoCode3"
          editValue={get('isoCode3')}
          onChange={onChange}
        />
        <FieldRow
          label="Region"
          value={country.region}
          editing={editing}
          fieldKey="region"
          editValue={get('region')}
          onChange={onChange}
        />
        <FieldRow
          label="Sub-region"
          value={country.subRegion}
          editing={editing}
          fieldKey="subRegion"
          editValue={get('subRegion')}
          onChange={onChange}
        />
        <FieldRow
          label="Active"
          value={
            country.isActive ? (
              <span className="font-semibold" style={{ color: '#06C270' }}>
                Active
              </span>
            ) : (
              <span className="font-semibold" style={{ color: '#E63535' }}>
                Inactive
              </span>
            )
          }
          editing={editing}
          fieldKey="isActive"
          editValue={get('isActive')}
          onChange={onChange}
          inputType="toggle"
        />
      </div>
    </div>
  )
}

/* ── Extra Tab (Currency & Details) ── */
function CountryExtraTab({
  country,
  editing,
  draft = {},
  onChange,
}: {
  country: CountryRef
  editing?: boolean
  draft?: Partial<CountryRef>
  onChange?: (key: string, value: string | number | boolean | null) => void
}) {
  const get = (key: keyof CountryRef) => (key in draft ? (draft as any)[key] : country[key])

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
        <FieldRow
          label="Currency Code"
          value={country.currencyCode ?? null}
          editing={editing}
          fieldKey="currencyCode"
          editValue={get('currencyCode')}
          onChange={onChange}
        />
        <FieldRow
          label="Currency Name"
          value={country.currencyName}
          editing={editing}
          fieldKey="currencyName"
          editValue={get('currencyName')}
          onChange={onChange}
        />
        <FieldRow
          label="Currency Symbol"
          value={country.currencySymbol}
          editing={editing}
          fieldKey="currencySymbol"
          editValue={get('currencySymbol')}
          onChange={onChange}
        />
        <FieldRow
          label="Phone Code"
          value={country.phoneCode}
          editing={editing}
          fieldKey="phoneCode"
          editValue={get('phoneCode')}
          onChange={onChange}
        />
        <FieldRow
          label="Latitude"
          value={country.latitude?.toFixed(6)}
          editing={editing}
          fieldKey="latitude"
          editValue={get('latitude')}
          onChange={onChange}
          inputType="number"
        />
        <FieldRow
          label="Longitude"
          value={country.longitude?.toFixed(6)}
          editing={editing}
          fieldKey="longitude"
          editValue={get('longitude')}
          onChange={onChange}
          inputType="number"
        />
      </div>
    </div>
  )
}

/* ── Reusable mini input for create form ── */
function MiniInput({
  label,
  value,
  onChange,
  maxLength,
  mono,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  mono?: boolean
  type?: string
}) {
  return (
    <div className="flex-1">
      <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent text-hz-text transition-colors"
      />
    </div>
  )
}
