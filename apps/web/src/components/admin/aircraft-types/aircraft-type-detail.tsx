'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { AircraftTypeRef, LopaConfigRef, CabinClassRef } from '@skyhub/api'
import { api } from '@skyhub/api'
import { FieldRow } from '../airports/field-row'
import { getOperatorId } from '@/stores/use-operator-store'
import {
  Info,
  Gauge,
  Clock,
  Armchair,
  Package,
  Users,
  CloudRain,
  Pencil,
  Save,
  X,
  Trash2,
  Plus,
  Star,
  Plane,
} from 'lucide-react'

// ── Constants ──

const CATEGORIES: Record<string, string> = {
  narrow_body: 'Narrow Body',
  wide_body: 'Wide Body',
  regional: 'Regional',
  turboprop: 'Turboprop',
}

const MANUFACTURERS = ['Airbus', 'Boeing', 'Embraer', 'ATR', 'Bombardier', 'Comac']
const REST_CLASSES = ['None', 'Class 1', 'Class 2', 'Class 3']
const ILS_CATEGORIES = ['None', 'Cat I', 'Cat II', 'Cat IIIa', 'Cat IIIb', 'Cat IIIc']

const TABS = [
  { key: 'basic' as const, label: 'Basic', icon: Info },
  { key: 'performance' as const, label: 'Performance', icon: Gauge },
  { key: 'tat' as const, label: 'TAT', icon: Clock },
  { key: 'seating' as const, label: 'Seating', icon: Armchair },
  { key: 'cargo' as const, label: 'Cargo', icon: Package },
  { key: 'crew' as const, label: 'Crew & Rest', icon: Users },
  { key: 'weather' as const, label: 'Weather', icon: CloudRain },
]

type TabKey = (typeof TABS)[number]['key']

// ── Helpers ──

function minutesToHHMM(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Parse HH:MM, HHMM, or H:MM into minutes. Accepts "0210", "02:10", "2:10" → 130. */
function hhmmToMinutes(str: string): number | null {
  const trimmed = str.trim()
  if (!trimmed) return null
  // If contains ":", split on it
  if (trimmed.includes(':')) {
    const [hStr, mStr] = trimmed.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
  }
  // Pure digits: 3+ digits → HHMM (e.g. "0210" → 2h10m, "130" → 1h30m)
  const num = trimmed.replace(/\D/g, '')
  if (!num) return null
  if (num.length >= 3) {
    const mins = parseInt(num.slice(-2), 10)
    const hrs = parseInt(num.slice(0, -2), 10)
    return hrs * 60 + mins
  }
  // 1-2 digits: treat as hours (e.g. "2" → 120min)
  return (parseInt(num, 10) || 0) * 60
}

// ── Props ──

interface AircraftTypeDetailProps {
  aircraftType: AircraftTypeRef | null
  onSave?: (id: string, data: Partial<AircraftTypeRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<AircraftTypeRef>) => Promise<void>
  onCancelCreate?: () => void
}

export function AircraftTypeDetail({
  aircraftType,
  onSave,
  onDelete,
  onCreate,
  onCancelCreate,
}: AircraftTypeDetailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [errorMsg, setErrorMsg] = useState('')

  // Create form
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({
    icaoType: '',
    name: '',
    manufacturer: 'Airbus',
    category: 'narrow_body',
    family: '',
  })

  // Seating tab — LOPA configs for this aircraft type
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([])
  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([])

  useEffect(() => {
    if (!aircraftType) return
    api
      .getLopaConfigs(getOperatorId(), aircraftType.icaoType)
      .then(setLopaConfigs)
      .catch(() => {})
    api
      .getCabinClasses(getOperatorId())
      .then(setCabinClasses)
      .catch(() => {})
  }, [aircraftType])

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || 'Failed'
    try {
      const match = msg.match(/API (\d+): (.+)/)
      if (match) {
        const parsed = JSON.parse(match[2])
        if (Number(match[1]) === 409) return parsed.error || 'This aircraft type already exists.'
        return parsed.error || parsed.details?.join(', ') || msg
      }
    } catch {
      /* use raw */
    }
    return msg
  }, [])

  const handleCreate = useCallback(async () => {
    if (!onCreate) return
    if (!createForm.icaoType || !createForm.name) {
      setCreateError('ICAO type and name are required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await onCreate({
        operatorId: getOperatorId(),
        icaoType: createForm.icaoType.toUpperCase(),
        name: createForm.name,
        manufacturer: createForm.manufacturer || null,
        category: createForm.category,
        family: createForm.family || null,
        isActive: true,
      } as Partial<AircraftTypeRef>)
      setCreateForm({ icaoType: '', name: '', manufacturer: 'Airbus', category: 'narrow_body', family: '' })
    } catch (err: any) {
      setCreateError(friendlyError(err))
    } finally {
      setCreating(false)
    }
  }, [onCreate, createForm, friendlyError])

  const handleEdit = useCallback(() => {
    setDraft({})
    setEditing(true)
    setConfirmDelete(false)
  }, [])
  const handleCancel = useCallback(() => {
    setDraft({})
    setEditing(false)
  }, [])

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  // For nested fields like tat.domDom, performance.mtowKg
  const handleNestedChange = useCallback((path: string, value: string | number | boolean | null) => {
    const [parent, child] = path.split('.')
    setDraft((prev) => {
      const existing = (prev[parent] as Record<string, unknown>) || {}
      return { ...prev, [parent]: { ...existing, [child]: value } }
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!onSave || !aircraftType || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      await onSave(aircraftType._id, draft as Partial<AircraftTypeRef>)
      setEditing(false)
      setDraft({})
    } catch (err: any) {
      setErrorMsg(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }, [onSave, aircraftType, draft, friendlyError])

  const handleDelete = useCallback(async () => {
    if (!onDelete || !aircraftType) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onDelete(aircraftType._id)
    } catch (err: any) {
      setErrorMsg(friendlyError(err))
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }, [onDelete, aircraftType, friendlyError])

  // Value getters
  const getVal = (key: keyof AircraftTypeRef) =>
    aircraftType ? (key in draft ? (draft as any)[key] : aircraftType[key]) : null

  const getNestedVal = (parent: keyof AircraftTypeRef, child: string) => {
    if (!aircraftType) return null
    const draftParent = draft[parent] as Record<string, unknown> | undefined
    if (draftParent && child in draftParent) return draftParent[child] as any
    const orig = aircraftType[parent] as Record<string, unknown> | null
    return orig?.[child] ?? null
  }

  // Hero image: try /assets/aircraft/{ICAO}.png
  const heroImg = aircraftType ? `/assets/aircraft/${aircraftType.icaoType}.png` : null

  // ── Create mode ──
  if (!aircraftType) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-hz-border shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-semibold">Add New Aircraft Type</h1>
            {onCancelCreate && (
              <button
                onClick={onCancelCreate}
                className="text-[13px] text-hz-text-secondary hover:text-hz-text transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="flex gap-3">
            <MiniInput
              label="ICAO Type *"
              value={createForm.icaoType}
              maxLength={4}
              onChange={(v) => setCreateForm((p) => ({ ...p, icaoType: v.toUpperCase() }))}
              mono
            />
            <MiniInput
              label="Name *"
              value={createForm.name}
              onChange={(v) => setCreateForm((p) => ({ ...p, name: v }))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">
                Manufacturer
              </label>
              <select
                value={createForm.manufacturer}
                onChange={(e) => setCreateForm((p) => ({ ...p, manufacturer: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text"
              >
                {MANUFACTURERS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">
                Category
              </label>
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text"
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <MiniInput
            label="Family"
            value={createForm.family}
            onChange={(v) => setCreateForm((p) => ({ ...p, family: v }))}
          />
          <div className="flex gap-3 pt-2">
            {onCancelCreate && (
              <button
                onClick={onCancelCreate}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent"
            >
              {creating ? 'Creating...' : 'Add Aircraft Type'}
            </button>
          </div>
          {createError && <p className="text-[12px] text-red-500">{createError}</p>}
        </div>
      </div>
    )
  }

  // ── Detail view ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero image */}
      {heroImg && (
        <div className="relative shrink-0 h-[250px] overflow-hidden border-b border-hz-border bg-gradient-to-b from-hz-border/10 to-hz-bg">
          <img
            src={heroImg}
            alt={aircraftType.icaoType}
            className="w-full h-full object-contain opacity-75"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <div className="absolute top-3 left-6 flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-[14px] font-bold font-mono px-2.5 py-1 rounded-lg bg-hz-bg/80 text-hz-text backdrop-blur-sm border border-hz-border/50">
                {aircraftType.icaoType}
              </span>
              <span className="text-[16px] font-semibold text-hz-text">{aircraftType.name}</span>
            </div>
            {aircraftType.manufacturer && (
              <span className="text-[13px] font-semibold text-hz-text-secondary">{aircraftType.manufacturer}</span>
            )}
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="px-6 py-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            {!heroImg && (
              <>
                <span className="text-[14px] font-bold font-mono px-2.5 py-1 rounded-lg bg-hz-border/30">
                  {aircraftType.icaoType}
                </span>
                <h1 className="text-[20px] font-semibold">{aircraftType.name}</h1>
              </>
            )}
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400 capitalize">
              {CATEGORIES[aircraftType.category] || aircraftType.category}
            </span>
            {aircraftType.isActive ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(6,194,112,0.12)] text-[#06C270] dark:bg-[rgba(57,217,138,0.15)] dark:text-[#39D98A]">
                Active
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(255,59,59,0.12)] text-[#E63535] dark:bg-[rgba(255,92,92,0.15)] dark:text-[#FF5C5C]">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors bg-module-accent"
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {onDelete &&
                  (confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-medium" style={{ color: '#E63535' }}>
                        Delete?
                      </span>
                      <button
                        onClick={handleDelete}
                        disabled={saving}
                        className="px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors"
                        style={{ backgroundColor: '#E63535' }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ))}
                {onSave && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 shrink-0 ml-auto">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-hz-border shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 shrink-0 ${
                active
                  ? 'bg-module-accent/15 text-module-accent'
                  : 'text-hz-text-secondary hover:bg-hz-border/30 hover:text-hz-text'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-3 pb-6">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <FieldRow
                label="ICAO Type"
                value={<span className="font-bold font-mono">{aircraftType.icaoType}</span>}
                editing={editing}
                fieldKey="icaoType"
                editValue={getVal('icaoType')}
                onChange={handleFieldChange}
              />
              <FieldRow
                label="IATA Type"
                value={aircraftType.iataType}
                editing={editing}
                fieldKey="iataType"
                editValue={getVal('iataType')}
                onChange={handleFieldChange}
              />
              <FieldRow
                label="Name"
                value={aircraftType.name}
                editing={editing}
                fieldKey="name"
                editValue={getVal('name')}
                onChange={handleFieldChange}
              />
              {/* Manufacturer */}
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                  Manufacturer
                </div>
                {editing ? (
                  <select
                    value={getVal('manufacturer') || ''}
                    onChange={(e) => handleFieldChange('manufacturer', e.target.value || null)}
                    className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                  >
                    <option value="">—</option>
                    {MANUFACTURERS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[13px] font-medium">{aircraftType.manufacturer || '—'}</div>
                )}
              </div>
              <FieldRow
                label="Family"
                value={aircraftType.family}
                editing={editing}
                fieldKey="family"
                editValue={getVal('family')}
                onChange={handleFieldChange}
              />
              {/* Category */}
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                  Category
                </div>
                {editing ? (
                  <select
                    value={getVal('category') || 'narrow_body'}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[13px] font-medium">
                    {CATEGORIES[aircraftType.category] || aircraftType.category}
                  </div>
                )}
              </div>
              {/* Color picker */}
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                  Schedule Color
                </div>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={getVal('color') || '#3b82f6'}
                      onChange={(e) => handleFieldChange('color', e.target.value)}
                      className="w-8 h-8 rounded border border-hz-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={getVal('color') || ''}
                      onChange={(e) => handleFieldChange('color', e.target.value)}
                      className="flex-1 text-[13px] font-mono bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                      maxLength={7}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {aircraftType.color && (
                      <span
                        className="w-5 h-5 rounded-full border border-hz-border/50"
                        style={{ backgroundColor: aircraftType.color }}
                      />
                    )}
                    <span className="text-[13px] font-mono font-medium">{aircraftType.color || '—'}</span>
                  </div>
                )}
              </div>
              <FieldRow
                label="Active"
                value={
                  aircraftType.isActive ? (
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
                editValue={getVal('isActive')}
                onChange={handleFieldChange}
                inputType="toggle"
              />
              <FieldRow
                label="Notes"
                value={aircraftType.notes}
                editing={editing}
                fieldKey="notes"
                editValue={getVal('notes')}
                onChange={handleFieldChange}
              />
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <Section title="Weights">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8">
                  <NestedField
                    label="MTOW (kg)"
                    parent="performance"
                    child="mtowKg"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="MLW (kg)"
                    parent="performance"
                    child="mlwKg"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="MZFW (kg)"
                    parent="performance"
                    child="mzfwKg"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="OEW (kg)"
                    parent="performance"
                    child="oewKg"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                </div>
              </Section>
              <Section title="Fuel">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <NestedField
                    label="Max Fuel Capacity (kg)"
                    parent="performance"
                    child="maxFuelCapacityKg"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <FieldRow
                    label="Fuel Burn Rate (kg/hr)"
                    value={aircraftType.fuelBurnRateKgPerHour}
                    editing={editing}
                    fieldKey="fuelBurnRateKgPerHour"
                    editValue={getVal('fuelBurnRateKgPerHour')}
                    onChange={handleFieldChange}
                    inputType="number"
                  />
                </div>
              </Section>
              <Section title="Speed & Range">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8">
                  <NestedField
                    label="Cruising Speed (kts)"
                    parent="performance"
                    child="cruisingSpeedKts"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="Max Range (NM)"
                    parent="performance"
                    child="maxRangeNm"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="Ceiling (FL)"
                    parent="performance"
                    child="ceilingFl"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                </div>
              </Section>
              <Section title="ETOPS">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <FieldRow
                    label="ETOPS Capable"
                    value={
                      aircraftType.etopsCapable ? (
                        <span className="font-semibold" style={{ color: '#06C270' }}>
                          Yes
                        </span>
                      ) : (
                        <span className="text-hz-text-secondary">No</span>
                      )
                    }
                    editing={editing}
                    fieldKey="etopsCapable"
                    editValue={getVal('etopsCapable')}
                    onChange={handleFieldChange}
                    inputType="toggle"
                  />
                  <FieldRow
                    label="ETOPS Rating (min)"
                    value={aircraftType.etopsRatingMinutes}
                    editing={editing}
                    fieldKey="etopsRatingMinutes"
                    editValue={getVal('etopsRatingMinutes')}
                    onChange={handleFieldChange}
                    inputType="number"
                  />
                </div>
              </Section>
              <Section title="Classifications">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <FieldRow
                    label="Noise Category"
                    value={aircraftType.noiseCategory}
                    editing={editing}
                    fieldKey="noiseCategory"
                    editValue={getVal('noiseCategory')}
                    onChange={handleFieldChange}
                  />
                  <FieldRow
                    label="Emissions Category"
                    value={aircraftType.emissionsCategory}
                    editing={editing}
                    fieldKey="emissionsCategory"
                    editValue={getVal('emissionsCategory')}
                    onChange={handleFieldChange}
                  />
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'tat' && (
            <div className="space-y-6">
              <Section title="Turnaround Time (TAT)">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-[13px] text-hz-text-secondary uppercase tracking-wider">
                        <th className="text-left py-2 pr-4 font-semibold w-28"></th>
                        <th className="text-center py-2 px-3 font-semibold">DOM → DOM</th>
                        <th className="text-center py-2 px-3 font-semibold">DOM → INT</th>
                        <th className="text-center py-2 px-3 font-semibold">INT → DOM</th>
                        <th className="text-center py-2 px-3 font-semibold">INT → INT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-hz-border/50">
                        <td className="py-3 pr-4 text-[13px] font-medium text-hz-text-secondary uppercase">
                          Scheduled
                        </td>
                        <TATCell
                          field="tat.domDom"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                        <TATCell
                          field="tat.domInt"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                        <TATCell
                          field="tat.intDom"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                        <TATCell
                          field="tat.intInt"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                      </tr>
                      <tr className="border-t border-hz-border/50">
                        <td className="py-3 pr-4 text-[13px] font-medium text-hz-text-secondary uppercase">Minimum</td>
                        <TATCell
                          field="tat.minDd"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                        <TATCell
                          field="tat.minDi"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                        <TATCell
                          field="tat.minId"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                        <TATCell
                          field="tat.minIi"
                          type={aircraftType}
                          draft={draft}
                          editing={editing}
                          onChange={handleNestedChange}
                        />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'seating' && (
            <div className="space-y-3">
              {lopaConfigs.length === 0 ? (
                <div className="text-[13px] text-hz-text-secondary py-4">
                  No LOPA configurations found for {aircraftType.icaoType}. Create them in the LOPA Database.
                </div>
              ) : (
                lopaConfigs.map((lc) => (
                  <div key={lc._id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-hz-border/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{lc.configName}</span>
                        {lc.isDefault && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {lc.cabins.map((c, i) => {
                          const cc = cabinClasses.find((cls) => cls.code === c.classCode)
                          return (
                            <span key={i} className="text-[13px] text-hz-text-secondary">
                              <span className="font-bold font-mono" style={{ color: cc?.color || '#9ca3af' }}>
                                {c.classCode}
                              </span>
                              : {c.seats}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <span className="text-[14px] font-bold tabular-nums text-module-accent">{lc.totalSeats}</span>
                    <span className="text-[13px] text-hz-text-tertiary">seats</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'cargo' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <NestedField
                label="Max Cargo Weight (kg)"
                parent="cargo"
                child="maxCargoWeightKg"
                type={aircraftType}
                draft={draft}
                editing={editing}
                onChange={handleNestedChange}
                inputType="number"
              />
              <NestedField
                label="Cargo Positions (ULD)"
                parent="cargo"
                child="cargoPositions"
                type={aircraftType}
                draft={draft}
                editing={editing}
                onChange={handleNestedChange}
                inputType="number"
              />
              <NestedField
                label="Bulk Hold Capacity (kg)"
                parent="cargo"
                child="bulkHoldCapacityKg"
                type={aircraftType}
                draft={draft}
                editing={editing}
                onChange={handleNestedChange}
                inputType="number"
              />
              {/* ULD types as comma-separated */}
              <div className="py-2.5 border-b border-hz-border/50">
                <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                  ULD Types Accepted
                </div>
                {editing ? (
                  <input
                    type="text"
                    value={(() => {
                      const draftCargo = draft.cargo as Record<string, unknown> | undefined
                      if (draftCargo && 'uldTypesAccepted' in draftCargo)
                        return (draftCargo.uldTypesAccepted as string[])?.join(', ') ?? ''
                      return aircraftType.cargo?.uldTypesAccepted?.join(', ') ?? ''
                    })()}
                    onChange={(e) => {
                      const arr = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      handleNestedChange('cargo.uldTypesAccepted', arr as any)
                    }}
                    placeholder="e.g. LD3, LD6, AKE"
                    className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                  />
                ) : (
                  <div className="text-[13px] font-medium">
                    {aircraftType.cargo?.uldTypesAccepted?.join(', ') || '—'}
                  </div>
                )}
              </div>
              <FieldRow
                label="Notes"
                value={aircraftType.notes}
                editing={editing}
                fieldKey="notes"
                editValue={getVal('notes')}
                onChange={handleFieldChange}
              />
            </div>
          )}

          {activeTab === 'crew' && (
            <div className="space-y-6">
              <Section title="Cockpit Rest Facility">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <div className="py-2.5 border-b border-hz-border/50">
                    <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                      Class
                    </div>
                    {editing ? (
                      <select
                        value={getNestedVal('crewRest', 'cockpitClass') || ''}
                        onChange={(e) => handleNestedChange('crewRest.cockpitClass', e.target.value || null)}
                        className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                      >
                        <option value="">—</option>
                        {REST_CLASSES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[13px] font-medium">{aircraftType.crewRest?.cockpitClass || '—'}</div>
                    )}
                  </div>
                  <NestedField
                    label="Positions"
                    parent="crewRest"
                    child="cockpitPositions"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                </div>
              </Section>
              <Section title="Cabin Rest Facility">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <div className="py-2.5 border-b border-hz-border/50">
                    <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                      Class
                    </div>
                    {editing ? (
                      <select
                        value={getNestedVal('crewRest', 'cabinClass') || ''}
                        onChange={(e) => handleNestedChange('crewRest.cabinClass', e.target.value || null)}
                        className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                      >
                        <option value="">—</option>
                        {REST_CLASSES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[13px] font-medium">{aircraftType.crewRest?.cabinClass || '—'}</div>
                    )}
                  </div>
                  <NestedField
                    label="Positions"
                    parent="crewRest"
                    child="cabinPositions"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="space-y-6">
              <Section title="Weather Limitations">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
                  <NestedField
                    label="Min Ceiling (ft)"
                    parent="weather"
                    child="minCeilingFt"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="Min RVR (m)"
                    parent="weather"
                    child="minRvrM"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="Min Visibility (m)"
                    parent="weather"
                    child="minVisibilityM"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="Max Crosswind (kt)"
                    parent="weather"
                    child="maxCrosswindKt"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                  <NestedField
                    label="Max Wind (kt)"
                    parent="weather"
                    child="maxWindKt"
                    type={aircraftType}
                    draft={draft}
                    editing={editing}
                    onChange={handleNestedChange}
                    inputType="number"
                  />
                </div>
              </Section>
              <Section title="Approach">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <div className="py-2.5 border-b border-hz-border/50">
                    <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                      ILS Category Required
                    </div>
                    {editing ? (
                      <select
                        value={getNestedVal('approach', 'ilsCategoryRequired') || ''}
                        onChange={(e) => handleNestedChange('approach.ilsCategoryRequired', e.target.value || null)}
                        className="w-full text-[13px] font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text"
                      >
                        <option value="">—</option>
                        {ILS_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[13px] font-medium">{aircraftType.approach?.ilsCategoryRequired || '—'}</div>
                    )}
                  </div>
                  <div className="py-2.5 border-b border-hz-border/50">
                    <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">
                      Autoland Capable
                    </div>
                    {editing ? (
                      <button
                        onClick={() =>
                          handleNestedChange('approach.autolandCapable', !getNestedVal('approach', 'autolandCapable'))
                        }
                        className="text-[13px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                        style={{
                          backgroundColor: getNestedVal('approach', 'autolandCapable')
                            ? 'rgba(22,163,74,0.1)'
                            : 'rgba(220,38,38,0.1)',
                          color: getNestedVal('approach', 'autolandCapable') ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {getNestedVal('approach', 'autolandCapable') ? 'Yes' : 'No'}
                      </button>
                    ) : (
                      <div className="text-[13px] font-medium">
                        {aircraftType.approach?.autolandCapable ? (
                          <span className="font-semibold" style={{ color: '#06C270' }}>
                            Yes
                          </span>
                        ) : (
                          <span className="text-hz-text-secondary">No</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[16px] font-bold text-hz-text-secondary uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function NestedField({
  label,
  parent,
  child,
  type,
  draft,
  editing,
  onChange,
  inputType = 'text',
}: {
  label: string
  parent: string
  child: string
  type: AircraftTypeRef
  draft: Record<string, unknown>
  editing: boolean
  onChange: (path: string, value: string | number | boolean | null) => void
  inputType?: 'text' | 'number'
}) {
  const draftParent = draft[parent] as Record<string, unknown> | undefined
  const value =
    draftParent && child in draftParent
      ? draftParent[child]
      : ((type[parent as keyof AircraftTypeRef] as Record<string, unknown> | null)?.[child] ?? null)

  return (
    <FieldRow
      label={label}
      value={value != null ? String(value) : null}
      editing={editing}
      fieldKey={`${parent}.${child}`}
      editValue={value as any}
      onChange={(key, val) => onChange(key, val)}
      inputType={inputType}
    />
  )
}

function TATCell({
  field,
  type,
  draft,
  editing,
  onChange,
}: {
  field: string
  type: AircraftTypeRef
  draft: Record<string, unknown>
  editing: boolean
  onChange: (path: string, value: string | number | boolean | null) => void
}) {
  const [parent, child] = field.split('.')
  const draftParent = draft[parent] as Record<string, unknown> | undefined
  const minutes =
    draftParent && child in draftParent
      ? (draftParent[child] as number | null)
      : (((type[parent as keyof AircraftTypeRef] as Record<string, unknown> | null)?.[child] as number | null) ?? null)

  // Local text state so typing isn't clobbered by parse→format on every keystroke
  const [localText, setLocalText] = useState(() => minutesToHHMM(minutes))

  // Sync local text when external minutes change (e.g. entering/leaving edit mode)
  useEffect(() => {
    setLocalText(minutesToHHMM(minutes))
  }, [minutes, editing])

  if (editing) {
    return (
      <td className="py-3 px-3 text-center">
        <input
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            const parsed = hhmmToMinutes(localText)
            onChange(field, parsed)
            setLocalText(minutesToHHMM(parsed))
          }}
          placeholder="HH:MM"
          className="w-20 text-center text-[13px] font-mono font-medium bg-transparent border-b border-hz-accent/30 outline-none focus:border-hz-accent py-0.5 text-hz-text mx-auto"
        />
      </td>
    )
  }

  return (
    <td className="py-3 px-3 text-center">
      <span className="text-[13px] font-mono font-medium">{minutes != null ? minutesToHHMM(minutes) : '—'}</span>
    </td>
  )
}

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
        className={`w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 text-hz-text ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}
