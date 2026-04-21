'use client'

import { useState, useEffect, useRef } from 'react'
import { FileText, Clock, Wrench, Palette, RotateCcw, Loader2, Plus, Trash2 } from 'lucide-react'
import { api, type MaintenanceCheckTypeRef, type MaintenanceWindowRef } from '@skyhub/api'
import { useOperatorStore } from '@/stores/use-operator-store'

// ── Shared styles ──

const INPUT =
  'h-[40px] px-3 text-[14px] rounded-lg border border-hz-border bg-transparent focus:border-module-accent focus:ring-2 focus:ring-module-accent/20 outline-none placeholder:text-hz-text-secondary/40 transition-colors duration-200 w-full text-hz-text'

const LABEL = 'text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary mb-1.5 block'

// ── Props ──

interface Props {
  checkType: MaintenanceCheckTypeRef | null
  allCheckTypes: MaintenanceCheckTypeRef[]
  onSave?: (id: string, data: Partial<MaintenanceCheckTypeRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<MaintenanceCheckTypeRef>) => Promise<void>
  onCancelCreate?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

// ── Component ──

export function MaintenanceCheckDetail({
  checkType,
  allCheckTypes,
  onSave,
  onDelete,
  onCreate,
  onCancelCreate,
  onDirtyChange,
}: Props) {
  const isCreate = !checkType
  const operatorId = useOperatorStore((s) => s.operator?._id)

  // Form state
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amosCode, setAmosCode] = useState('')
  const [hoursInterval, setHoursInterval] = useState('')
  const [cyclesInterval, setCyclesInterval] = useState('')
  const [daysInterval, setDaysInterval] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [defaultStation, setDefaultStation] = useState('')
  const [requiresGrounding, setRequiresGrounding] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [color, setColor] = useState('#3b82f6')
  const [resetsCheckCodes, setResetsCheckCodes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Maintenance windows state
  const [windows, setWindows] = useState<MaintenanceWindowRef[]>([])
  const [windowsLoading, setWindowsLoading] = useState(true)
  const [showWindowForm, setShowWindowForm] = useState(false)
  const [editBase, setEditBase] = useState('')
  const [editStart, setEditStart] = useState('22:00')
  const [editEnd, setEditEnd] = useState('05:00')
  const [editNotes, setEditNotes] = useState('')
  const [windowSaving, setWindowSaving] = useState(false)

  // Load check type into form
  useEffect(() => {
    if (checkType) {
      setCode(checkType.code)
      setName(checkType.name)
      setDescription(checkType.description || '')
      setAmosCode(checkType.amosCode || '')
      setHoursInterval(checkType.defaultHoursInterval?.toString() || '')
      setCyclesInterval(checkType.defaultCyclesInterval?.toString() || '')
      setDaysInterval(checkType.defaultDaysInterval?.toString() || '')
      setDurationHours(checkType.defaultDurationHours?.toString() || '')
      setDefaultStation(checkType.defaultStation || '')
      setRequiresGrounding(checkType.requiresGrounding)
      setIsActive(checkType.isActive)
      setColor(checkType.color || '#3b82f6')
      setResetsCheckCodes(checkType.resetsCheckCodes || [])
    } else {
      setCode('')
      setName('')
      setDescription('')
      setAmosCode('')
      setHoursInterval('')
      setCyclesInterval('')
      setDaysInterval('')
      setDurationHours('24')
      setDefaultStation('')
      setRequiresGrounding(true)
      setIsActive(true)
      setColor('#3b82f6')
      setResetsCheckCodes([])
    }
    setError('')
  }, [checkType])

  // Load maintenance windows
  useEffect(() => {
    setWindowsLoading(true)
    api
      .getMaintenanceWindows()
      .then(setWindows)
      .catch(console.error)
      .finally(() => setWindowsLoading(false))
  }, [])

  // Dirty tracking
  const initialRef = useRef<string>('')
  useEffect(() => {
    if (checkType) {
      initialRef.current = JSON.stringify({
        code: checkType.code,
        name: checkType.name,
        description: checkType.description || '',
        amosCode: checkType.amosCode || '',
        hoursInterval: checkType.defaultHoursInterval?.toString() || '',
        cyclesInterval: checkType.defaultCyclesInterval?.toString() || '',
        daysInterval: checkType.defaultDaysInterval?.toString() || '',
        durationHours: checkType.defaultDurationHours?.toString() || '',
        defaultStation: checkType.defaultStation || '',
        requiresGrounding: checkType.requiresGrounding,
        isActive: checkType.isActive,
        color: checkType.color || '#3b82f6',
        resetsCheckCodes: checkType.resetsCheckCodes || [],
      })
    }
  }, [checkType])

  useEffect(() => {
    if (!checkType) return
    const current = JSON.stringify({
      code,
      name,
      description,
      amosCode,
      hoursInterval,
      cyclesInterval,
      daysInterval,
      durationHours,
      defaultStation,
      requiresGrounding,
      isActive,
      color,
      resetsCheckCodes,
    })
    onDirtyChange?.(current !== initialRef.current)
  }, [
    code,
    name,
    description,
    amosCode,
    hoursInterval,
    cyclesInterval,
    daysInterval,
    durationHours,
    defaultStation,
    requiresGrounding,
    isActive,
    color,
    resetsCheckCodes,
    checkType,
    onDirtyChange,
  ])

  // Helpers
  const numOrNull = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) || n <= 0 ? null : n
  }
  const intOrNull = (v: string) => {
    const n = parseInt(v, 10)
    return isNaN(n) || n <= 0 ? null : n
  }

  const buildPayload = (): Partial<MaintenanceCheckTypeRef> => ({
    code: code.trim().toUpperCase(),
    name: name.trim(),
    description: description.trim() || null,
    amosCode: amosCode.trim() || null,
    defaultHoursInterval: numOrNull(hoursInterval),
    defaultCyclesInterval: intOrNull(cyclesInterval),
    defaultDaysInterval: intOrNull(daysInterval),
    defaultDurationHours: numOrNull(durationHours),
    defaultStation: defaultStation.trim().toUpperCase() || null,
    requiresGrounding,
    resetsCheckCodes: resetsCheckCodes.length > 0 ? resetsCheckCodes : null,
    color,
    isActive,
    sortOrder: checkType?.sortOrder ?? 0,
  })

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      setError('Code and Name are required')
      return
    }
    if (!operatorId) {
      setError('Operator not loaded yet — please retry')
      return
    }
    setError('')
    setSaving(true)
    try {
      const payload = buildPayload()
      if (isCreate) {
        await onCreate?.({ ...payload, operatorId } as any)
      } else {
        await onSave?.(checkType!._id, payload)
      }
      onDirtyChange?.(false)
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!checkType) return
    if (!window.confirm(`Delete "${checkType.name}" check type? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await onDelete?.(checkType._id)
    } catch (err: any) {
      setError(err.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // Maintenance window handlers
  const handleWindowSave = async () => {
    if (!editBase.trim()) return
    if (!operatorId) return
    setWindowSaving(true)
    try {
      await api.createMaintenanceWindow({
        operatorId,
        base: editBase.trim().toUpperCase(),
        windowStartUtc: editStart,
        windowEndUtc: editEnd,
        notes: editNotes.trim() || null,
      } as any)
      setShowWindowForm(false)
      setEditBase('')
      setEditStart('22:00')
      setEditEnd('05:00')
      setEditNotes('')
      const data = await api.getMaintenanceWindows()
      setWindows(data)
    } catch (err: any) {
      setError(err.message || 'Window save failed')
    } finally {
      setWindowSaving(false)
    }
  }

  const handleWindowDelete = async (id: string) => {
    if (!window.confirm('Remove this maintenance window?')) return
    try {
      await api.deleteMaintenanceWindow(id)
      const data = await api.getMaintenanceWindows()
      setWindows(data)
    } catch {
      /* silent */
    }
  }

  const canSave = code.trim() && name.trim() && !saving
  const otherCheckCodes = allCheckTypes.filter((c) => c._id !== checkType?._id && c.code).map((c) => c.code)

  return (
    <>
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold truncate">
            {isCreate ? 'New Check Type' : `${name || 'Untitled'} - Configuration`}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {isCreate && onCancelCreate && (
              <button
                onClick={onCancelCreate}
                className="h-8 px-3 text-[13px] font-medium rounded-lg text-hz-text-secondary hover:text-hz-text transition-colors"
              >
                Cancel
              </button>
            )}
            {!isCreate && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-8 px-3 text-[13px] font-medium rounded-lg border bg-[#E63535]/10 border-[#E63535]/25 text-[#E63535] hover:bg-[#E63535]/20 transition-colors duration-200"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Delete check'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="h-8 px-4 text-[13px] font-semibold rounded-lg bg-module-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isCreate ? 'Create' : 'Save changes'}
            </button>
          </div>
        </div>
        {error && <p className="text-[13px] text-[#E63535] mt-2">{error}</p>}
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
        {/* Section 1: General */}
        <section className="space-y-3">
          <SectionTitle icon={<FileText className="h-4 w-4" />} title="General" />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TR"
                className={`${INPUT} font-mono font-semibold text-center`}
                style={{ maxWidth: 120 }}
              />
            </div>
            <div>
              <label className={LABEL}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Transit Check"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>MRO Code Mapping</label>
              <input
                value={amosCode}
                onChange={(e) => setAmosCode(e.target.value)}
                placeholder="AMOS code"
                className={`${INPUT} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className={`${INPUT} min-h-[60px] py-2.5 resize-none h-auto`}
              rows={2}
            />
          </div>
        </section>

        {/* Section 2: Frequency Thresholds */}
        <section className="space-y-3">
          <SectionTitle icon={<Clock className="h-4 w-4" />} title="Default Frequency Thresholds" />
          <p className="text-[13px] text-hz-text-secondary">
            Check is triggered when <strong className="font-semibold text-hz-text">any</strong> threshold is reached —
            whichever comes first.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <ThresholdCard
              label="Flight Hours"
              value={hoursInterval}
              onChange={setHoursInterval}
              unit="hours"
              hint="Max hours between checks"
            />
            <ThresholdCard
              label="Cycles"
              value={cyclesInterval}
              onChange={setCyclesInterval}
              unit="cycles"
              hint="Max cycles between checks"
            />
            <ThresholdCard
              label="Calendar Days"
              value={daysInterval}
              onChange={setDaysInterval}
              unit="days"
              hint="Max days between checks"
            />
          </div>
        </section>

        {/* Section 3: Operational Settings */}
        <section className="space-y-3">
          <SectionTitle icon={<Wrench className="h-4 w-4" />} title="Operational Settings" />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Default Duration</label>
              <div className="flex items-center gap-2">
                <input
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  type="number"
                  className={`${INPUT} flex-1 font-mono text-center`}
                />
                <span className="text-[13px] text-hz-text-secondary shrink-0">hours</span>
              </div>
            </div>
            <div>
              <label className={LABEL}>Default Station</label>
              <input
                value={defaultStation}
                onChange={(e) => setDefaultStation(e.target.value)}
                placeholder="Any station"
                className={`${INPUT} font-mono uppercase`}
              />
            </div>
            <div>
              <label className={LABEL}>Requires Grounding</label>
              <div className="flex items-center gap-2 mt-2">
                <Toggle checked={requiresGrounding} onChange={setRequiresGrounding} />
                <span className="text-[13px] text-hz-text-secondary">
                  {requiresGrounding ? 'Yes — aircraft grounded' : 'No — can stay in service'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Toggle checked={isActive} onChange={setIsActive} />
            <span className="text-[14px] font-medium">Active</span>
            <span className="text-[13px] text-hz-text-secondary">— include in fleet health calculations</span>
          </div>
        </section>

        {/* Section 4: Display Color */}
        <section className="space-y-3">
          <SectionTitle icon={<Palette className="h-4 w-4" />} title="Display Color" />

          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                onClick={() => colorInputRef.current?.click()}
                className="w-[32px] h-[32px] rounded-lg cursor-pointer border-2 border-hz-border hover:border-hz-text-secondary/40 transition-all duration-150 hover:scale-110"
                style={{ backgroundColor: color }}
              />
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </div>
            <input
              value={color}
              onChange={(e) => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
              }}
              maxLength={7}
              className="w-[80px] h-8 px-2 text-[13px] font-mono text-hz-text-secondary text-center rounded-lg border border-hz-border bg-transparent outline-none focus:border-module-accent focus:ring-1 focus:ring-module-accent/20 transition-colors duration-200"
            />
          </div>
        </section>

        {/* Section 5: Cascade Resets */}
        <section className="space-y-3">
          <SectionTitle icon={<RotateCcw className="h-4 w-4" />} title="Cascade Resets" />
          <p className="text-[13px] text-hz-text-secondary">
            When this check completes, it also resets the counter for these check types.
          </p>

          {otherCheckCodes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {otherCheckCodes.map((c) => {
                const sel = resetsCheckCodes.includes(c)
                return (
                  <button
                    key={c}
                    onClick={() => setResetsCheckCodes((prev) => (sel ? prev.filter((x) => x !== c) : [...prev, c]))}
                    className={`px-2.5 py-1 rounded-lg text-[13px] font-medium border cursor-pointer transition-all duration-150 ${
                      sel
                        ? 'bg-module-accent/10 border-module-accent/25 text-module-accent font-semibold'
                        : 'text-hz-text-secondary border-hz-border hover:border-hz-text-secondary/30'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[13px] text-hz-text-secondary/50">No other check types to cascade to.</p>
          )}
          <p className="text-[13px] text-hz-text-secondary/70">
            Tip: C-Check typically resets A-Check. D-Check resets everything.
          </p>
        </section>

        {/* Section 6: Maintenance Windows */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<Clock className="h-4 w-4" />} title="Maintenance Windows" />
            <button
              onClick={() => setShowWindowForm(true)}
              className="h-7 px-2.5 rounded-lg text-[13px] text-module-accent font-medium flex items-center gap-1 hover:bg-module-accent/5 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          <p className="text-[13px] text-hz-text-secondary">
            Quiet hours per base when short checks can be performed. Long checks that exceed the window duration are
            scheduled without time constraints.
          </p>

          {windowsLoading ? (
            <div className="text-[13px] text-hz-text-secondary/50 py-4 text-center">Loading...</div>
          ) : windows.length === 0 && !showWindowForm ? (
            <div className="text-center py-6">
              <p className="text-[13px] text-hz-text-secondary/50">
                No maintenance windows configured. Click Add to create one.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-hz-border overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-hz-bg">
                    {['Base', 'Window (UTC)', 'Duration', 'Source', ''].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {windows.map((w) => (
                    <tr key={w._id} className="border-t border-hz-border hover:bg-hz-border/20 transition-colors">
                      <td className="px-3 py-2.5 text-[14px] font-mono font-semibold">{w.base}</td>
                      <td className="px-3 py-2.5 text-[14px] font-mono">
                        {w.windowStartUtc} - {w.windowEndUtc}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-hz-text-secondary">{w.windowDurationHours}h</td>
                      <td className="px-3 py-2.5 text-[13px] text-hz-text-secondary">
                        {w.isManualOverride ? 'Manual' : 'Auto-detected'}
                      </td>
                      <td className="px-2 py-2.5" style={{ width: 36 }}>
                        <button
                          onClick={() => handleWindowDelete(w._id)}
                          className="h-6 w-6 flex items-center justify-center rounded-lg text-hz-text-secondary hover:text-[#E63535] hover:bg-[#E63535]/10 transition-colors duration-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add window form */}
          {showWindowForm && (
            <div className="rounded-lg border border-hz-border p-4 space-y-3 bg-hz-bg">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={LABEL}>Base</label>
                  <input
                    value={editBase}
                    onChange={(e) => setEditBase(e.target.value)}
                    placeholder="HAN"
                    maxLength={4}
                    className={`${INPUT} font-mono text-center uppercase`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Start (UTC)</label>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className={`${INPUT} font-mono text-center`}
                  />
                </div>
                <div>
                  <label className={LABEL}>End (UTC)</label>
                  <input
                    type="time"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className={`${INPUT} font-mono text-center`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Notes</label>
                  <input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional"
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowWindowForm(false)
                    setEditBase('')
                    setEditStart('22:00')
                    setEditEnd('05:00')
                    setEditNotes('')
                  }}
                  className="h-8 px-3 text-[13px] font-medium rounded-lg text-hz-text-secondary hover:text-hz-text transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWindowSave}
                  disabled={!editBase.trim() || windowSaving}
                  className="h-8 px-4 text-[13px] font-semibold rounded-lg bg-module-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {windowSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

// ── Sub-components ──

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[3px] h-[18px] rounded-full bg-module-accent" />
      <span className="text-hz-text-secondary">{icon}</span>
      <h3 className="text-[14px] font-bold">{title}</h3>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-[38px] h-[22px] rounded-full transition-colors duration-200 relative shrink-0 cursor-pointer ${
        checked ? 'bg-module-accent' : 'bg-hz-text-secondary/20'
      }`}
    >
      <span
        className={`absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'left-[19px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

function ThresholdCard({
  label,
  value,
  onChange,
  unit,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  unit: string
  hint: string
}) {
  return (
    <div className="rounded-lg p-4 border border-hz-border bg-hz-bg">
      <label className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary mb-2 block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="number"
          placeholder="--"
          className="flex-1 h-[40px] text-[16px] font-mono font-semibold text-center rounded-lg border border-hz-border bg-transparent focus:border-module-accent focus:ring-2 focus:ring-module-accent/20 outline-none placeholder:text-hz-text-secondary/20 transition-colors duration-200 text-hz-text"
        />
        <span className="text-[13px] text-hz-text-secondary shrink-0">{unit}</span>
      </div>
      <p className="text-[13px] text-hz-text-secondary/70 mt-1.5">{hint}</p>
    </div>
  )
}
