'use client'

import { useState, useCallback, useMemo } from 'react'
import type { LopaConfigRef, CabinClassRef, CabinEntry, AircraftTypeRef } from '@skyhub/api'
import { FieldRow } from '../airports/field-row'
import { AircraftSeatMap } from './aircraft-seat-map'
import { useTheme } from '@/components/theme-provider'
import { getOperatorId } from '@/stores/use-operator-store'
import { modeColor } from '@skyhub/ui/theme'
import { Info, Pencil, Save, X, Trash2, Plus, Star, MinusCircle } from 'lucide-react'

interface LopaConfigDetailProps {
  config: LopaConfigRef | null
  cabinClasses: CabinClassRef[]
  aircraftTypes?: AircraftTypeRef[]
  onSave?: (id: string, data: Partial<LopaConfigRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<LopaConfigRef>) => Promise<void>
  initialShowCreate?: boolean
  onCancelCreate?: () => void
}

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
    info: { bar: '#0063F7', bg: 'rgba(0,99,247,0.08)' },
    success: { bar: '#06C270', bg: 'rgba(6,194,112,0.08)' },
    error: { bar: '#E63535', bg: 'rgba(255,59,59,0.08)' },
    warning: { bar: '#FF8800', bg: 'rgba(255,136,0,0.08)' },
  }[type]
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-hz-border/50"
      style={{ backgroundColor: c.bg }}
    >
      <div
        className="w-[3px] h-full min-h-[20px] rounded-full shrink-0 self-stretch"
        style={{ backgroundColor: c.bar }}
      />
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
            <h3 className="text-[15px] font-bold">Delete configuration?</h3>
            <p className="text-[13px] text-hz-text-secondary mt-1">
              This will permanently remove this LOPA configuration. This action cannot be undone.
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

export function LopaConfigDetail({
  config,
  cabinClasses,
  aircraftTypes = [],
  onSave,
  onDelete,
  onCreate,
  initialShowCreate,
  onCancelCreate,
}: LopaConfigDetailProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [draft, setDraft] = useState<Partial<LopaConfigRef>>({})
  const [draftCabins, setDraftCabins] = useState<CabinEntry[] | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Create flow
  const [showCreate, setShowCreate] = useState(initialShowCreate ?? false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({
    aircraftType: '',
    configName: '',
    isDefault: false,
    notes: '',
    cabins: [{ classCode: 'Y', seats: 180 }] as CabinEntry[],
  })

  const resetCreate = useCallback(() => {
    setShowCreate(false)
    setCreateError('')
    setCreateForm({
      aircraftType: '',
      configName: '',
      isDefault: false,
      notes: '',
      cabins: [{ classCode: 'Y', seats: 180 }],
    })
    onCancelCreate?.()
  }, [onCancelCreate])

  const friendlyError = useCallback((err: any) => {
    const msg = err.message || 'Failed'
    try {
      const match = msg.match(/API (\d+): (.+)/)
      if (match) {
        const parsed = JSON.parse(match[2])
        if (Number(match[1]) === 409) return parsed.error || 'This configuration already exists.'
        return parsed.error || parsed.details?.join(', ') || msg
      }
    } catch {
      /* use raw */
    }
    return msg
  }, [])

  const handleCreate = useCallback(async () => {
    if (!onCreate) return
    if (!createForm.aircraftType || !createForm.configName || createForm.cabins.length === 0) {
      setCreateError('Aircraft type, config name, and at least one cabin entry are required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await onCreate({
        operatorId: getOperatorId(),
        aircraftType: createForm.aircraftType.toUpperCase(),
        configName: createForm.configName,
        cabins: createForm.cabins,
        isDefault: createForm.isDefault,
        notes: createForm.notes || null,
        isActive: true,
      } as Partial<LopaConfigRef>)
      resetCreate()
    } catch (err: any) {
      setCreateError(friendlyError(err))
    } finally {
      setCreating(false)
    }
  }, [onCreate, createForm, resetCreate, friendlyError])

  const handleEdit = useCallback(() => {
    if (!config) return
    setDraft({})
    setDraftCabins([...config.cabins])
    setEditing(true)
    setShowDeleteModal(false)
  }, [config])

  const handleCancel = useCallback(() => {
    setDraft({})
    setDraftCabins(null)
    setEditing(false)
  }, [])

  const handleFieldChange = useCallback((key: string, value: string | number | boolean | null) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!onSave || !config) {
      setEditing(false)
      return
    }
    const payload: Partial<LopaConfigRef> = { ...draft }
    if (draftCabins) payload.cabins = draftCabins
    if (Object.keys(payload).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(config._id, payload)
      setEditing(false)
      setDraft({})
      setDraftCabins(null)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [onSave, config, draft, draftCabins])

  const handleDelete = useCallback(async () => {
    if (!onDelete || !config) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onDelete(config._id)
    } catch (err: any) {
      setErrorMsg(friendlyError(err))
    } finally {
      setSaving(false)
      setShowDeleteModal(false)
    }
  }, [onDelete, config, friendlyError])

  const getVal = (key: keyof LopaConfigRef) => (config ? (key in draft ? (draft as any)[key] : config[key]) : null)

  const currentCabins = draftCabins ?? config?.cabins ?? []
  const computedTotal = useMemo(() => currentCabins.reduce((s, c) => s + c.seats, 0), [currentCabins])

  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const classOptions = useMemo(
    () => cabinClasses.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [cabinClasses],
  )

  const getClassColor = useCallback(
    (code: string) => modeColor(cabinClasses.find((c) => c.code === code)?.color || '#9ca3af', isDark),
    [cabinClasses, isDark],
  )

  const getClassName = useCallback(
    (code: string) => cabinClasses.find((c) => c.code === code)?.name || code,
    [cabinClasses],
  )

  // Max seats for slider (rough: widebody max ~60 rows * 10 abreast = 600)
  const getMaxSeats = useCallback(
    (classCode: string) => {
      const cc = cabinClasses.find((c) => c.code === classCode)
      const layout = (cc?.seatLayout || '3-3').split('-').map(Number)
      const perRow = layout.reduce((s, g) => s + g, 0)
      return Math.max(perRow * 60, 800)
    },
    [cabinClasses],
  )

  // Toggle a cabin class on/off in create form
  const toggleCabinClass = useCallback(
    (code: string) => {
      setCreateForm((p) => {
        const exists = p.cabins.find((c) => c.classCode === code)
        if (exists) {
          // Remove — but keep at least one cabin
          const next = p.cabins.filter((c) => c.classCode !== code)
          return { ...p, cabins: next.length > 0 ? next : p.cabins }
        }
        // Add with a sensible default seat count based on class type
        const cc = cabinClasses.find((c) => c.code === code)
        const layout = (cc?.seatLayout || '3-3').split('-').map(Number)
        const perRow = layout.reduce((s, g) => s + g, 0)
        const defaultSeats = perRow <= 2 ? 8 : perRow <= 4 ? 24 : 180
        return { ...p, cabins: [...p.cabins, { classCode: code, seats: defaultSeats }] }
      })
    },
    [cabinClasses],
  )

  const createTotalSeats = useMemo(() => createForm.cabins.reduce((s, c) => s + c.seats, 0), [createForm.cabins])

  // ── Standalone create mode ──
  if (!config) {
    const enabledCodes = new Set(createForm.cabins.map((c) => c.classCode))

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hz-border shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-semibold">Add New LOPA Configuration</h1>
            <button
              onClick={resetCreate}
              className="text-[13px] text-hz-text-secondary hover:text-hz-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Aircraft type + config name */}
          <div className="px-6 pt-4 pb-3 space-y-3 border-b border-hz-border">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">
                  Aircraft Type *
                </label>
                <select
                  value={createForm.aircraftType}
                  onChange={(e) => setCreateForm((p) => ({ ...p, aircraftType: e.target.value }))}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent transition-colors text-hz-text"
                >
                  <option value="">Select type...</option>
                  {aircraftTypes.map((t) => (
                    <option key={t._id} value={t.icaoType}>
                      {t.icaoType} — {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <MiniInput
                label="Config Name *"
                value={createForm.configName}
                onChange={(v) => setCreateForm((p) => ({ ...p, configName: v }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.isDefault}
                  onChange={(e) => setCreateForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded border-hz-border accent-module-accent"
                />
                <span className="text-[13px] font-medium">Set as default</span>
              </label>
            </div>
          </div>

          {/* Cabin class toggle chips */}
          <div className="px-6 py-4 border-b border-hz-border">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">
                Cabin Classes
              </span>
              <span className="text-[13px] font-bold tabular-nums text-module-accent">
                {createTotalSeats} total seats
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {classOptions.map((cc) => {
                const active = enabledCodes.has(cc.code)
                const color = getClassColor(cc.code)
                return (
                  <button
                    key={cc.code}
                    onClick={() => toggleCabinClass(cc.code)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium border transition-all duration-150 ${
                      active ? 'border-transparent shadow-sm' : 'border-hz-border/50 opacity-50 hover:opacity-80'
                    }`}
                    style={active ? { backgroundColor: color + '18', borderColor: color + '40', color } : undefined}
                  >
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-bold font-mono">{cc.code}</span>
                    <span className={active ? '' : 'text-hz-text-secondary'}>{cc.name}</span>
                    {active && (
                      <span className="text-[13px] font-bold tabular-nums ml-1 opacity-70">
                        {createForm.cabins.find((c) => c.classCode === cc.code)?.seats ?? 0}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Seat sliders for enabled classes */}
          {createForm.cabins.length > 0 && (
            <div className="px-6 py-4 border-b border-hz-border space-y-2.5">
              {createForm.cabins.map((cabin, i) => {
                const cc = cabinClasses.find((c) => c.code === cabin.classCode)
                const sortedIdx = classOptions.findIndex((c) => c.code === cabin.classCode)
                return (
                  <CabinSliderRow
                    key={cabin.classCode}
                    cabin={cabin}
                    classOptions={classOptions}
                    color={getClassColor(cabin.classCode)}
                    maxSeats={getMaxSeats(cabin.classCode)}
                    onChangeClass={(code) => {
                      const u = [...createForm.cabins]
                      u[i] = { ...u[i], classCode: code }
                      setCreateForm((p) => ({ ...p, cabins: u }))
                    }}
                    onChangeSeats={(seats) => {
                      const u = [...createForm.cabins]
                      u[i] = { ...u[i], seats }
                      setCreateForm((p) => ({ ...p, cabins: u }))
                    }}
                    onRemove={createForm.cabins.length > 1 ? () => toggleCabinClass(cabin.classCode) : undefined}
                  />
                )
              })}
            </div>
          )}

          {/* Live aircraft seat map */}
          {createForm.cabins.length > 0 && createForm.cabins.some((c) => c.seats > 0) && (
            <div className="px-6 py-4 border-b border-hz-border">
              <AircraftSeatMap
                cabins={createForm.cabins}
                cabinClasses={cabinClasses}
                aircraftType={createForm.aircraftType}
              />
            </div>
          )}

          {/* Notes + submit */}
          <div className="px-6 py-4 space-y-3">
            <MiniInput
              label="Notes"
              value={createForm.notes}
              onChange={(v) => setCreateForm((p) => ({ ...p, notes: v }))}
            />

            <div className="flex gap-3 pt-1">
              <button
                onClick={resetCreate}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-hz-text-secondary border border-hz-border hover:bg-hz-border/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  creating || !createForm.aircraftType || !createForm.configName || createForm.cabins.length === 0
                }
                className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent hover:opacity-90"
              >
                {creating ? 'Creating...' : `Add Configuration · ${createTotalSeats} seats`}
              </button>
            </div>
            {createError && <Alert type="error" message={createError} onDismiss={() => setCreateError('')} />}
          </div>
        </div>
      </div>
    )
  }

  // ── Normal detail view ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showDeleteModal && (
        <DeleteModal onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} saving={saving} />
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-bold font-mono px-2.5 py-1 rounded-lg bg-hz-border/30">
              {config.aircraftType}
            </span>
            <h1 className="text-[20px] font-semibold">{config.configName}</h1>
            {config.isDefault && (
              <span className="flex items-center gap-1 text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[rgba(255,136,0,0.12)] text-[#E67A00] dark:bg-[rgba(253,172,66,0.15)] dark:text-[#FDAC42]">
                <Star className="h-3 w-3 fill-current" /> Default
              </span>
            )}
            <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full text-module-accent bg-module-accent/10">
              {editing ? computedTotal : config.totalSeats} seats
            </span>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors bg-module-accent hover:opacity-90"
                >
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {onDelete && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-1 p-1.5 rounded-lg text-hz-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Delete configuration"
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

      {/* Inline create panel */}
      {showCreate &&
        (() => {
          const enabledCodes = new Set(createForm.cabins.map((c) => c.classCode))
          const inlineTotal = createForm.cabins.reduce((s, c) => s + c.seats, 0)
          return (
            <div className="px-6 py-4 border-b border-hz-border shrink-0 space-y-3 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">Add New LOPA Configuration</span>
                <button onClick={resetCreate} className="text-[13px] text-hz-text-secondary hover:text-hz-text">
                  Cancel
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">
                      Aircraft Type *
                    </label>
                    <select
                      value={createForm.aircraftType}
                      onChange={(e) => setCreateForm((p) => ({ ...p, aircraftType: e.target.value }))}
                      className="w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] font-mono border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent transition-colors text-hz-text"
                    >
                      <option value="">Select type...</option>
                      {aircraftTypes.map((t) => (
                        <option key={t._id} value={t.icaoType}>
                          {t.icaoType} — {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <MiniInput
                    label="Config Name *"
                    value={createForm.configName}
                    onChange={(v) => setCreateForm((p) => ({ ...p, configName: v }))}
                  />
                </div>

                {/* Cabin class chips */}
                <div>
                  <span className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-medium">
                    Cabin Classes
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {classOptions.map((cc) => {
                      const active = enabledCodes.has(cc.code)
                      const color = getClassColor(cc.code)
                      return (
                        <button
                          key={cc.code}
                          onClick={() => toggleCabinClass(cc.code)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
                            active ? 'border-transparent' : 'border-hz-border/50 opacity-50 hover:opacity-80'
                          }`}
                          style={
                            active ? { backgroundColor: color + '18', borderColor: color + '40', color } : undefined
                          }
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-bold font-mono">{cc.code}</span>
                          <span className={active ? '' : 'text-hz-text-secondary'}>{cc.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sliders */}
                {createForm.cabins.map((cabin, i) => (
                  <CabinSliderRow
                    key={cabin.classCode}
                    cabin={cabin}
                    classOptions={classOptions}
                    color={getClassColor(cabin.classCode)}
                    maxSeats={getMaxSeats(cabin.classCode)}
                    onChangeClass={(code) => {
                      const u = [...createForm.cabins]
                      u[i] = { ...u[i], classCode: code }
                      setCreateForm((p) => ({ ...p, cabins: u }))
                    }}
                    onChangeSeats={(seats) => {
                      const u = [...createForm.cabins]
                      u[i] = { ...u[i], seats }
                      setCreateForm((p) => ({ ...p, cabins: u }))
                    }}
                    onRemove={createForm.cabins.length > 1 ? () => toggleCabinClass(cabin.classCode) : undefined}
                  />
                ))}

                <button
                  onClick={handleCreate}
                  disabled={creating || !createForm.aircraftType || !createForm.configName}
                  className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-50 bg-module-accent hover:opacity-90"
                >
                  {creating ? 'Creating...' : `Add Configuration · ${inlineTotal} seats`}
                </button>
              </div>
              {createError && <Alert type="error" message={createError} onDismiss={() => setCreateError('')} />}
            </div>
          )
        })()}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero: Aircraft Seat Map */}
        <div className="px-6 py-4 border-b border-hz-border">
          <AircraftSeatMap cabins={currentCabins} cabinClasses={cabinClasses} aircraftType={config.aircraftType} />
        </div>

        {/* Cabin sliders (edit mode) or cabin summary (view mode) */}
        <div className="px-6 py-4 border-b border-hz-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold">Cabin Layout</h3>
            <span className="text-[13px] font-bold text-module-accent">{computedTotal} total seats</span>
          </div>

          {editing && draftCabins ? (
            <div className="space-y-3">
              {draftCabins.map((cabin, i) => (
                <CabinSliderRow
                  key={i}
                  cabin={cabin}
                  classOptions={classOptions}
                  color={getClassColor(cabin.classCode)}
                  maxSeats={getMaxSeats(cabin.classCode)}
                  onChangeClass={(code) => {
                    const u = [...draftCabins]
                    u[i] = { ...u[i], classCode: code }
                    setDraftCabins(u)
                  }}
                  onChangeSeats={(seats) => {
                    const u = [...draftCabins]
                    u[i] = { ...u[i], seats }
                    setDraftCabins(u)
                  }}
                  onRemove={
                    draftCabins.length > 1 ? () => setDraftCabins(draftCabins.filter((_, idx) => idx !== i)) : undefined
                  }
                />
              ))}
              <button
                onClick={() => setDraftCabins([...draftCabins, { classCode: 'Y', seats: 0 }])}
                className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg hover:bg-hz-border/30 transition-colors text-module-accent"
              >
                <Plus className="h-3.5 w-3.5" /> Add Cabin
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {[...config.cabins]
                .sort((a, b) => {
                  const aOrder = cabinClasses.find((c) => c.code === a.classCode)?.sortOrder ?? 99
                  const bOrder = cabinClasses.find((c) => c.code === b.classCode)?.sortOrder ?? 99
                  return aOrder - bOrder
                })
                .map((cabin, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-hz-border/30">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: getClassColor(cabin.classCode) }}
                    />
                    <span className="text-[14px] font-bold font-mono w-8">{cabin.classCode}</span>
                    <span className="text-[13px] text-hz-text-secondary">{getClassName(cabin.classCode)}</span>
                    <span className="text-[14px] font-semibold ml-auto tabular-nums">{cabin.seats}</span>
                    <span className="text-[13px] text-hz-text-tertiary">seats</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Details fields */}
        <div className="px-6 pt-3 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
            <FieldRow
              label="Aircraft Type"
              value={config.aircraftType}
              editing={editing}
              fieldKey="aircraftType"
              editValue={getVal('aircraftType')}
              onChange={handleFieldChange}
            />
            <FieldRow
              label="Config Name"
              value={config.configName}
              editing={editing}
              fieldKey="configName"
              editValue={getVal('configName')}
              onChange={handleFieldChange}
            />
            <FieldRow
              label="Default"
              value={
                config.isDefault ? (
                  <span className="font-semibold" style={{ color: '#E67A00' }}>
                    Default
                  </span>
                ) : (
                  <span className="text-hz-text-secondary">No</span>
                )
              }
              editing={editing}
              fieldKey="isDefault"
              editValue={getVal('isDefault')}
              onChange={handleFieldChange}
              inputType="toggle"
            />
            <FieldRow
              label="Notes"
              value={config.notes}
              editing={editing}
              fieldKey="notes"
              editValue={getVal('notes')}
              onChange={handleFieldChange}
            />
            <FieldRow
              label="Active"
              value={
                config.isActive ? (
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

// ── Cabin slider row ──
function CabinSliderRow({
  cabin,
  classOptions,
  color,
  maxSeats,
  onChangeClass,
  onChangeSeats,
  onRemove,
}: {
  cabin: CabinEntry
  classOptions: CabinClassRef[]
  color: string
  maxSeats: number
  onChangeClass: (code: string) => void
  onChangeSeats: (seats: number) => void
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-hz-border/50">
      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <select
        value={cabin.classCode}
        onChange={(e) => onChangeClass(e.target.value)}
        className="px-2 py-1 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:border-module-accent transition-colors text-hz-text w-[120px] shrink-0"
      >
        {classOptions.map((cc) => (
          <option key={cc.code} value={cc.code}>
            {cc.code} — {cc.name}
          </option>
        ))}
        {!classOptions.find((cc) => cc.code === cabin.classCode) && (
          <option value={cabin.classCode}>{cabin.classCode}</option>
        )}
      </select>
      <input
        type="range"
        min={0}
        max={maxSeats}
        step={1}
        value={cabin.seats}
        onChange={(e) => onChangeSeats(Number(e.target.value))}
        className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${(cabin.seats / maxSeats) * 100}%, rgba(128,128,128,0.2) ${(cabin.seats / maxSeats) * 100}%, rgba(128,128,128,0.2) 100%)`,
          accentColor: color,
        }}
      />
      <input
        type="number"
        value={cabin.seats}
        onChange={(e) => onChangeSeats(Math.max(0, Number(e.target.value) || 0))}
        className="w-16 px-2 py-1 rounded-lg text-[13px] font-mono font-bold border border-hz-border bg-hz-bg outline-none focus:border-module-accent transition-colors text-hz-text text-right"
        min={0}
      />
      {onRemove && (
        <button onClick={onRemove} className="text-hz-text-secondary/50 hover:text-red-500 transition-colors shrink-0">
          <MinusCircle className="h-4 w-4" />
        </button>
      )}
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
        className={`w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border border-hz-border bg-hz-bg outline-none focus:ring-2 focus:ring-module-accent/30 focus:border-module-accent transition-colors text-hz-text ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}
