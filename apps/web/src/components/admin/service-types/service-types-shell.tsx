'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api, type FlightServiceTypeRef } from '@skyhub/api'
import { MasterDetailLayout } from '@/components/layout'
import { FieldRow } from '../airports/field-row'
import { getOperatorId } from '@/stores/use-operator-store'
import { Search, Plus, Info, Pencil, Save, X, Trash2 } from 'lucide-react'

export function ServiceTypesShell() {
  const [types, setTypes] = useState<FlightServiceTypeRef[]>([])
  const [selected, setSelected] = useState<FlightServiceTypeRef | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    setLoading(true)
    api
      .getFlightServiceTypes()
      .then((data) => {
        setTypes(data)
        setSelected((prev: FlightServiceTypeRef | null) => {
          if (prev) {
            const found = data.find((t) => t._id === prev._id)
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
    async (id: string, data: Partial<FlightServiceTypeRef>) => {
      await api.updateFlightServiceType(id, data)
      fetchData()
    },
    [fetchData],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteFlightServiceType(id)
      setSelected(null)
      fetchData()
    },
    [fetchData],
  )

  const handleCreate = useCallback(
    async (data: Partial<FlightServiceTypeRef>) => {
      const created = await api.createFlightServiceType(data)
      fetchData()
      setTimeout(() => setSelected(created), 300)
    },
    [fetchData],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return types
    return types.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    )
  }, [types, search])

  return (
    <MasterDetailLayout
      left={
        <ServiceTypeList
          types={filtered}
          selected={selected}
          onSelect={setSelected}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onCreateClick={() => setSelected(null)}
        />
      }
      center={
        selected ? (
          <ServiceTypeDetail
            serviceType={selected}
            onSave={handleSave}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        ) : (
          <ServiceTypeDetail
            serviceType={null}
            onCreate={handleCreate}
            onCancelCreate={() => {
              if (types.length > 0) setSelected(types[0])
            }}
          />
        )
      }
    />
  )
}

// ── List ──

function ServiceTypeList({
  types,
  selected,
  onSelect,
  search,
  onSearchChange,
  loading,
  onCreateClick,
}: {
  types: FlightServiceTypeRef[]
  selected: FlightServiceTypeRef | null
  onSelect: (t: FlightServiceTypeRef) => void
  search: string
  onSearchChange: (v: string) => void
  loading: boolean
  onCreateClick: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 space-y-3 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Flight Service Types</h2>
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-white transition-colors bg-module-accent"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-hz-text-secondary" />
          <input
            type="text"
            placeholder="Search code or name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 placeholder:text-hz-text-secondary/50 text-hz-text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-[13px] text-hz-text-secondary animate-pulse px-3 py-4">Loading...</div>
        ) : types.length === 0 ? (
          <div className="text-[13px] text-hz-text-secondary px-3 py-4">No service types found</div>
        ) : (
          <div className="space-y-0.5">
            {types.map((t) => {
              const isSelected = selected?._id === t._id
              return (
                <button
                  key={t._id}
                  onClick={() => onSelect(t)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? 'border-l-[3px] border-l-module-accent bg-module-accent/[0.08]'
                      : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color || '#6b7280' }} />
                  <span className="text-[14px] font-bold font-mono">{t.code}</span>
                  <span className="text-[13px] font-medium truncate">{t.name}</span>
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

function ServiceTypeDetail({
  serviceType,
  onSave,
  onDelete,
  onCreate,
  onCancelCreate,
}: {
  serviceType: FlightServiceTypeRef | null
  onSave?: (id: string, data: Partial<FlightServiceTypeRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<FlightServiceTypeRef>) => Promise<void>
  onCancelCreate?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState<Partial<FlightServiceTypeRef>>({})
  const [errorMsg, setErrorMsg] = useState('')

  // Create form
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({ code: '', name: '', description: '', color: '#3b82f6' })

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || 'Failed'
    try {
      const match = msg.match(/API (\d+): (.+)/)
      if (match) {
        const parsed = JSON.parse(match[2])
        if (Number(match[1]) === 409) return parsed.error || 'This service type already exists.'
        return parsed.error || parsed.details?.join(', ') || msg
      }
    } catch {}
    return msg
  }, [])

  const handleCreate = useCallback(async () => {
    if (!onCreate) return
    if (!createForm.code || !createForm.name) {
      setCreateError('Code and name are required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await onCreate({
        operatorId: getOperatorId(),
        code: createForm.code.toUpperCase(),
        name: createForm.name,
        description: createForm.description || null,
        color: createForm.color || null,
        isActive: true,
      } as Partial<FlightServiceTypeRef>)
      setCreateForm({ code: '', name: '', description: '', color: '#3b82f6' })
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

  const handleSave = useCallback(async () => {
    if (!onSave || !serviceType || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      await onSave(serviceType._id, draft)
      setEditing(false)
      setDraft({})
    } catch (err: any) {
      setErrorMsg(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }, [onSave, serviceType, draft, friendlyError])

  const handleDelete = useCallback(async () => {
    if (!onDelete || !serviceType) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onDelete(serviceType._id)
    } catch (err: any) {
      setErrorMsg(friendlyError(err))
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }, [onDelete, serviceType, friendlyError])

  const getVal = (key: keyof FlightServiceTypeRef) =>
    serviceType ? (key in draft ? (draft as any)[key] : serviceType[key]) : null

  // ── Create mode ──
  if (!serviceType) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-hz-border shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-semibold">Add Flight Service Type</h1>
            {onCancelCreate && (
              <button onClick={onCancelCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">
                Cancel
              </button>
            )}
          </div>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="flex gap-3">
            <MiniInput
              label="Code *"
              value={createForm.code}
              maxLength={2}
              onChange={(v) => setCreateForm((p) => ({ ...p, code: v.toUpperCase() }))}
              mono
            />
            <MiniInput
              label="Name *"
              value={createForm.name}
              onChange={(v) => setCreateForm((p) => ({ ...p, name: v }))}
            />
          </div>
          <MiniInput
            label="Description"
            value={createForm.description}
            onChange={(v) => setCreateForm((p) => ({ ...p, description: v }))}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={createForm.color}
                  onChange={(e) => setCreateForm((p) => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-hz-border cursor-pointer"
                />
                <input
                  type="text"
                  value={createForm.color}
                  onChange={(e) => setCreateForm((p) => ({ ...p, color: e.target.value }))}
                  className="flex-1 px-3 py-2.5 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none text-hz-text"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
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
              {creating ? 'Creating...' : 'Add Service Type'}
            </button>
          </div>
          {createError && (
            <p className="text-[13px]" style={{ color: '#E63535' }}>
              {createError}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Detail view ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="w-5 h-5 rounded-full shrink-0 border border-hz-border/50"
              style={{ backgroundColor: serviceType.color || '#6b7280' }}
            />
            <span className="text-[20px] font-bold font-mono">{serviceType.code}</span>
            <span className="text-[16px] text-hz-text-secondary">—</span>
            <h1 className="text-[20px] font-semibold">{serviceType.name}</h1>
            {serviceType.isActive ? (
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
                      className="p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-3 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
            <FieldRow
              label="Code"
              value={<span className="font-bold font-mono">{serviceType.code}</span>}
              editing={editing}
              fieldKey="code"
              editValue={getVal('code')}
              onChange={handleFieldChange}
            />
            <FieldRow
              label="Name"
              value={serviceType.name}
              editing={editing}
              fieldKey="name"
              editValue={getVal('name')}
              onChange={handleFieldChange}
            />
            <FieldRow
              label="Description"
              value={serviceType.description}
              editing={editing}
              fieldKey="description"
              editValue={getVal('description')}
              onChange={handleFieldChange}
            />
            {/* Color picker */}
            <div className="py-2.5 border-b border-hz-border/50">
              <div className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium mb-1">Color</div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={getVal('color') || '#6b7280'}
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
                  <span
                    className="w-5 h-5 rounded-full border border-hz-border/50"
                    style={{ backgroundColor: serviceType.color || '#6b7280' }}
                  />
                  <span className="text-[13px] font-mono font-medium">{serviceType.color || '—'}</span>
                </div>
              )}
            </div>
            <FieldRow
              label="Active"
              value={
                serviceType.isActive ? (
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
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mini input ──
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
