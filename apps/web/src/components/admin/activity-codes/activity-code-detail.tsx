'use client'

import { useState, useCallback } from 'react'
import type { ActivityCodeGroupRef, ActivityCodeRef } from '@skyhub/api'
import { FLAG_CATEGORIES, FLAG_LABELS, type ActivityFlag } from '@skyhub/constants'
import { Pencil, Save, X, Trash2, Lock, Archive } from 'lucide-react'

interface Props {
  code: ActivityCodeRef | null
  groups: ActivityCodeGroupRef[]
  defaultGroupId?: string | null
  onSave?: (id: string, data: Partial<ActivityCodeRef>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<ActivityCodeRef>) => Promise<void>
  onCancelCreate?: () => void
  onUpdateFlags?: (id: string, flags: string[]) => Promise<void>
  onUpdatePositions?: (id: string, positions: string[]) => Promise<void>
}

// ── Helpers ──
function minutesToHHMM(min: number | null | undefined): string {
  if (min == null) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToMinutes(val: string): number | null {
  if (!val) return null
  const [h, m] = val.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

/** Mutually-exclusive flag groups. Turning on a flag in one group blocks
 *  flags in any group listed as a conflict. */
const DUTY_TRAINING_FLAGS: ActivityFlag[] = [
  'is_flight_duty',
  'is_ground_duty',
  'is_deadhead',
  'is_training',
  'is_simulator',
]
const OFF_LEAVE_FLAGS: ActivityFlag[] = ['is_day_off', 'is_annual_leave', 'is_sick_leave']

function getConflictingFlags(flag: ActivityFlag): ActivityFlag[] {
  if (DUTY_TRAINING_FLAGS.includes(flag)) return OFF_LEAVE_FLAGS
  if (OFF_LEAVE_FLAGS.includes(flag)) return DUTY_TRAINING_FLAGS
  return []
}

/** Disables a flag checkbox when an opposing flag is already set. */
function isFlagBlockedByActive(flag: ActivityFlag, activeFlags: string[]): boolean {
  const conflicts = getConflictingFlags(flag)
  if (conflicts.length === 0) return false
  if (activeFlags.includes(flag)) return false // already on — let user turn off
  return conflicts.some((c) => activeFlags.includes(c))
}

export function ActivityCodeDetail({
  code,
  groups,
  defaultGroupId,
  onSave,
  onDelete,
  onCreate,
  onCancelCreate,
  onUpdateFlags,
  onUpdatePositions,
}: Props) {
  const [tab, setTab] = useState<'general' | 'credits'>('general')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<ActivityCodeRef>>({})

  // Create form state
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    description: '',
    groupId: defaultGroupId ?? groups[0]?._id ?? '',
  })

  const isCreate = code === null
  const isSystem = code?.isSystem ?? false

  const group = code ? groups.find((g) => g._id === code.groupId) : groups.find((g) => g._id === createForm.groupId)

  // Draft getter
  const getVal = <K extends keyof ActivityCodeRef>(key: K): ActivityCodeRef[K] | undefined =>
    code ? ((key in draft ? (draft as Record<string, unknown>)[key] : code[key]) as ActivityCodeRef[K]) : undefined

  const handleFieldChange = (key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!code || !onSave) return
    setSaving(true)
    try {
      await onSave(code._id, draft)
      setEditing(false)
      setDraft({})
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!onCreate) return
    if (!createForm.code.trim() || !createForm.name.trim()) return
    setSaving(true)
    try {
      await onCreate({
        groupId: createForm.groupId,
        code: createForm.code.toUpperCase(),
        name: createForm.name,
        description: createForm.description || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleFlagToggle = async (flag: ActivityFlag) => {
    if (!code || !onUpdateFlags || isSystem) return
    const current = code.flags ?? []
    const turningOn = !current.includes(flag)
    const next = turningOn ? [...current, flag] : current.filter((f) => f !== flag)
    // Mutual exclusion: Day Off / Leave cannot coexist with Duty / Training.
    if (turningOn) {
      const conflicts = getConflictingFlags(flag)
      if (conflicts.length > 0) {
        const offending = next.filter((f) => conflicts.includes(f))
        if (offending.length > 0) {
          const offLabels = offending.map((f) => FLAG_LABELS[f]).join(', ')
          alert(
            `"${FLAG_LABELS[flag]}" can't be combined with ${offLabels}. ` +
              `Day Off / Leave and Duty / Training are mutually exclusive.`,
          )
          return
        }
      }
    }
    await onUpdateFlags(code._id, next)
  }

  // ── Create form ──
  if (isCreate) {
    return (
      <div className="p-6 space-y-4">
        <h3 className="text-[18px] font-semibold text-hz-text">New Activity Code</h3>

        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div>
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold block mb-1">
              Group
            </label>
            <select
              value={createForm.groupId}
              onChange={(e) => setCreateForm((p) => ({ ...p, groupId: e.target.value }))}
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text"
            >
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold block mb-1">
              Code
            </label>
            <input
              value={createForm.code}
              onChange={(e) =>
                setCreateForm((p) => ({
                  ...p,
                  code: e.target.value.toUpperCase(),
                }))
              }
              maxLength={8}
              placeholder="e.g. FLT"
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold block mb-1">
              Name
            </label>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              maxLength={60}
              placeholder="e.g. Flight Duty"
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold block mb-1">
              Description
            </label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={saving || !createForm.code.trim() || !createForm.name.trim()}
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: '#1e40af' }}
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
          {onCancelCreate && (
            <button
              onClick={onCancelCreate}
              className="px-3 py-1.5 rounded-lg text-[13px] text-hz-text-secondary hover:text-hz-text border border-hz-border"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Detail view ──
  const codeColor = code.color ?? group?.color ?? '#6b7280'
  const hasSimFlag = (code.flags ?? []).includes('is_simulator')
  const hasDayOffFlag = (code.flags ?? []).includes('is_day_off')
  const groupCode = group?.code ?? ''
  const hideDuration = groupCode === 'LEAVE' || groupCode === 'SICK'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0">
        <div className="flex items-center gap-3">
          {/* Large code badge */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[14px] font-mono font-bold"
            style={{ backgroundColor: codeColor }}
          >
            {code.code}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[18px] font-semibold text-hz-text">{code.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="px-1.5 py-0.5 rounded text-[13px] font-mono font-semibold text-white"
                style={{ backgroundColor: group?.color ?? '#6b7280' }}
              >
                {group?.code}
              </span>
              <span className="text-[13px] text-hz-text-secondary">{group?.name}</span>
              {isSystem && (
                <span className="flex items-center gap-0.5 text-[13px] text-hz-text-tertiary">
                  <Lock className="h-3 w-3" /> System
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white"
                  style={{ backgroundColor: '#7c3aed' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setDraft({})
                  }}
                  className="p-1.5 rounded-lg hover:bg-hz-card"
                >
                  <X className="h-4 w-4 text-hz-text-secondary" />
                </button>
              </>
            ) : (
              <>
                {(!isSystem || code.code !== 'SBY') && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-hz-border text-hz-text-secondary hover:text-hz-text"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {!isSystem && (
                  <button onClick={() => onDelete?.(code._id)} className="p-1.5 rounded-lg hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* System / Archived banners */}
      {isSystem && (
        <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[13px] text-amber-600 dark:text-amber-400">
          <Lock className="h-3 w-3 inline mr-1" />
          System code — fields are read-only. Only color can be customized.
        </div>
      )}
      {code.isArchived && (
        <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-500">
          <Archive className="h-3 w-3 inline mr-1" />
          This code is archived and cannot be assigned to new roster entries.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 px-6 mt-3 border-b border-hz-border shrink-0">
        {(['general', 'credits'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 transition-colors ${
              tab === t
                ? 'text-hz-text border-b-[#1e40af]'
                : 'text-hz-text-secondary border-b-transparent hover:text-hz-text'
            }`}
          >
            {t === 'general' ? 'General' : 'Credit Hours'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {tab === 'general' ? (
          <GeneralTab
            code={code}
            groups={groups}
            group={group ?? null}
            editing={editing}
            isSystem={isSystem}
            draft={draft}
            getVal={getVal}
            onChange={handleFieldChange}
            onFlagToggle={handleFlagToggle}
            hideDuration={hideDuration}
            hasDayOffFlag={hasDayOffFlag}
            hasSimFlag={hasSimFlag}
          />
        ) : (
          <CreditsTab code={code} editing={editing} isSystem={isSystem} getVal={getVal} onChange={handleFieldChange} />
        )}
      </div>
    </div>
  )
}

// ── General Tab ──
function GeneralTab({
  code,
  groups,
  group,
  editing,
  isSystem,
  draft,
  getVal,
  onChange,
  onFlagToggle,
  hideDuration,
  hasDayOffFlag,
  hasSimFlag,
}: {
  code: ActivityCodeRef
  groups: ActivityCodeGroupRef[]
  group: ActivityCodeGroupRef | null
  editing: boolean
  isSystem: boolean
  draft: Partial<ActivityCodeRef>
  getVal: <K extends keyof ActivityCodeRef>(key: K) => ActivityCodeRef[K] | undefined
  onChange: (key: string, value: unknown) => void
  onFlagToggle: (flag: ActivityFlag) => void
  hideDuration: boolean
  hasDayOffFlag: boolean
  hasSimFlag: boolean
}) {
  return (
    <div className="space-y-5">
      {/* Code & Group */}
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <FieldBlock label="Code">
          {editing && !isSystem ? (
            <input
              value={(getVal('code') as string) ?? ''}
              onChange={(e) => onChange('code', e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] font-mono font-bold text-hz-text">{code.code}</span>
          )}
        </FieldBlock>
        <FieldBlock label="Group">
          {editing && !isSystem ? (
            <select
              value={(getVal('groupId') as string) ?? ''}
              onChange={(e) => onChange('groupId', e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text"
            >
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[13px] text-hz-text">
              {group?.code} — {group?.name}
            </span>
          )}
        </FieldBlock>
      </div>

      {/* Name & Color */}
      <div className="grid grid-cols-[1fr_auto] gap-4 max-w-lg">
        <FieldBlock label="Name">
          {editing && !isSystem ? (
            <input
              value={(getVal('name') as string) ?? ''}
              onChange={(e) => onChange('name', e.target.value)}
              maxLength={60}
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] text-hz-text">{code.name}</span>
          )}
        </FieldBlock>
        <FieldBlock label="Color">
          {editing && code.code !== 'SBY' ? (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(getVal('color') as string) ?? group?.color ?? '#6b7280'}
                onChange={(e) => onChange('color', e.target.value)}
                className="w-8 h-8 rounded border border-hz-border cursor-pointer"
              />
              {code.color && (
                <button
                  onClick={() => onChange('color', null)}
                  className="text-[13px] text-hz-text-secondary hover:text-hz-text"
                >
                  Reset
                </button>
              )}
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded border border-hz-border"
              style={{
                backgroundColor: code.color ?? group?.color ?? '#6b7280',
              }}
            />
          )}
        </FieldBlock>
      </div>

      {/* Description */}
      <FieldBlock label="Description">
        {editing && !isSystem ? (
          <textarea
            value={(getVal('description') as string) ?? ''}
            onChange={(e) => onChange('description', e.target.value || null)}
            rows={2}
            className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text outline-none resize-none max-w-lg"
          />
        ) : (
          <span className="text-[13px] text-hz-text-secondary">{code.description || '—'}</span>
        )}
      </FieldBlock>

      {/* Active & Archived toggles */}
      {editing && !isSystem && (
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={getVal('isActive') as boolean}
              onChange={(e) => onChange('isActive', e.target.checked)}
              className="rounded"
            />
            <span className="text-[13px] text-hz-text">Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={getVal('isArchived') as boolean}
              onChange={(e) => onChange('isArchived', e.target.checked)}
              className="rounded"
            />
            <span className="text-[13px] text-hz-text">Archived</span>
          </label>
        </div>
      )}

      {/* Default Duration */}
      {!hideDuration && (
        <FieldBlock label="Default Duration">
          {editing && !isSystem ? (
            <input
              type="text"
              value={minutesToHHMM(getVal('defaultDurationMin') as number | null)}
              onChange={(e) => onChange('defaultDurationMin', hhmmToMinutes(e.target.value))}
              placeholder="HH:MM"
              className="w-24 px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] font-mono text-hz-text">
              {code.defaultDurationMin ? minutesToHHMM(code.defaultDurationMin) : '—'}
            </span>
          )}
        </FieldBlock>
      )}

      {/* ── Behavioral Flags ── */}
      <div>
        <h4 className="text-[14px] font-bold uppercase tracking-wider text-hz-text-secondary mb-3">Behavioral Flags</h4>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {FLAG_CATEGORIES.map((cat) => (
            <div key={cat.label} className="rounded-xl border border-hz-border p-3 space-y-2">
              <p className="text-[13px] font-semibold text-hz-text-secondary uppercase tracking-wider">{cat.label}</p>
              {cat.flags.map((flag) => {
                const activeFlags = code.flags ?? []
                const active = activeFlags.includes(flag)
                const blocked = isFlagBlockedByActive(flag, activeFlags)
                const disabled = isSystem || blocked
                const conflicts = getConflictingFlags(flag)
                  .map((c) => FLAG_LABELS[c])
                  .join(', ')
                return (
                  <label
                    key={flag}
                    title={blocked ? `Conflicts with active flag (${conflicts})` : undefined}
                    className={`flex items-center gap-2 ${
                      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => onFlagToggle(flag)}
                      disabled={disabled}
                      className="rounded"
                    />
                    <span className="text-[13px] text-hz-text">{FLAG_LABELS[flag]}</span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Time Assignment ── */}
      {!hasDayOffFlag && (
        <div>
          <h4 className="text-[14px] font-bold uppercase tracking-wider text-hz-text-secondary mb-2">
            Time Assignment
          </h4>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={getVal('requiresTime') as boolean}
              onChange={(e) => {
                if (!editing || isSystem) return
                onChange('requiresTime', e.target.checked)
              }}
              disabled={!editing || isSystem}
              className="rounded"
            />
            <span className="text-[13px] text-hz-text">Requires time input</span>
          </label>
          {(getVal('requiresTime') as boolean) && (
            <div className="grid grid-cols-2 gap-4 max-w-xs ml-6">
              <FieldBlock label="Default Start">
                {editing && !isSystem ? (
                  <input
                    type="text"
                    value={(getVal('defaultStartTime') as string) ?? ''}
                    onChange={(e) => onChange('defaultStartTime', e.target.value || null)}
                    placeholder="HH:MM"
                    className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
                  />
                ) : (
                  <span className="text-[13px] font-mono text-hz-text">{code.defaultStartTime || '—'}</span>
                )}
              </FieldBlock>
              <FieldBlock label="Default End">
                {editing && !isSystem ? (
                  <input
                    type="text"
                    value={(getVal('defaultEndTime') as string) ?? ''}
                    onChange={(e) => onChange('defaultEndTime', e.target.value || null)}
                    placeholder="HH:MM"
                    className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
                  />
                ) : (
                  <span className="text-[13px] font-mono text-hz-text">{code.defaultEndTime || '—'}</span>
                )}
              </FieldBlock>
            </div>
          )}
        </div>
      )}

      {/* ── Simulator Settings ── */}
      {hasSimFlag && (
        <div>
          <h4 className="text-[14px] font-bold uppercase tracking-wider text-hz-text-secondary mb-2">
            Simulator Settings
          </h4>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <FieldBlock label="Platform">
              {editing && !isSystem ? (
                <input
                  value={(getVal('simPlatform') as string) ?? ''}
                  onChange={(e) => onChange('simPlatform', e.target.value || null)}
                  placeholder="e.g. Boeing 737-800 FFS Level D"
                  className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text outline-none"
                />
              ) : (
                <span className="text-[13px] text-hz-text">{code.simPlatform || '—'}</span>
              )}
            </FieldBlock>
            <FieldBlock label="Standard Duration">
              {editing && !isSystem ? (
                <input
                  type="text"
                  value={minutesToHHMM(getVal('simDurationMin') as number | null)}
                  onChange={(e) => onChange('simDurationMin', hhmmToMinutes(e.target.value))}
                  placeholder="HH:MM"
                  className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
                />
              ) : (
                <span className="text-[13px] font-mono text-hz-text">
                  {code.simDurationMin ? minutesToHHMM(code.simDurationMin) : '—'}
                </span>
              )}
            </FieldBlock>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Credits Tab ──
function CreditsTab({
  code,
  editing,
  isSystem,
  getVal,
  onChange,
}: {
  code: ActivityCodeRef
  editing: boolean
  isSystem: boolean
  getVal: <K extends keyof ActivityCodeRef>(key: K) => ActivityCodeRef[K] | undefined
  onChange: (key: string, value: unknown) => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <FieldBlock label="Credit Ratio (x)">
          {editing && !isSystem ? (
            <input
              type="number"
              step="0.05"
              value={(getVal('creditRatio') as number) ?? ''}
              onChange={(e) => onChange('creditRatio', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="e.g. 1.25"
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] font-mono text-hz-text">
              {code.creditRatio != null ? `${code.creditRatio}x` : '—'}
            </span>
          )}
        </FieldBlock>
        <FieldBlock label="Credit Override (HH:MM)">
          {editing && !isSystem ? (
            <input
              type="text"
              value={minutesToHHMM(getVal('creditFixedMin') as number | null)}
              onChange={(e) => onChange('creditFixedMin', hhmmToMinutes(e.target.value))}
              placeholder="HH:MM"
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] font-mono text-hz-text">
              {code.creditFixedMin ? minutesToHHMM(code.creditFixedMin) : '—'}
            </span>
          )}
        </FieldBlock>
        <FieldBlock label="Pay Ratio (x)">
          {editing && !isSystem ? (
            <input
              type="number"
              step="0.05"
              value={(getVal('payRatio') as number) ?? ''}
              onChange={(e) => onChange('payRatio', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="e.g. 1.0"
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] font-mono text-hz-text">
              {code.payRatio != null ? `${code.payRatio}x` : '—'}
            </span>
          )}
        </FieldBlock>
        <div />
        <FieldBlock label="Min Rest Before (HH:MM)">
          {editing && !isSystem ? (
            <input
              type="text"
              value={minutesToHHMM(getVal('minRestBeforeMin') as number | null)}
              onChange={(e) => onChange('minRestBeforeMin', hhmmToMinutes(e.target.value))}
              placeholder="HH:MM"
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] font-mono text-hz-text">
              {code.minRestBeforeMin ? minutesToHHMM(code.minRestBeforeMin) : '—'}
            </span>
          )}
        </FieldBlock>
        <FieldBlock label="Min Rest After (HH:MM)">
          {editing && !isSystem ? (
            <input
              type="text"
              value={minutesToHHMM(getVal('minRestAfterMin') as number | null)}
              onChange={(e) => onChange('minRestAfterMin', hhmmToMinutes(e.target.value))}
              placeholder="HH:MM"
              className="w-full px-2 py-1.5 rounded-lg border border-hz-border bg-hz-card text-[13px] font-mono text-hz-text outline-none"
            />
          ) : (
            <span className="text-[13px] font-mono text-hz-text">
              {code.minRestAfterMin ? minutesToHHMM(code.minRestAfterMin) : '—'}
            </span>
          )}
        </FieldBlock>
      </div>

      <p className="text-[13px] text-hz-text-tertiary max-w-lg leading-relaxed">
        Credit ratio multiplies block hours to derive credit hours. Override sets fixed credit time regardless of block.
        Rest periods enforced by FDTL rule engine.
      </p>
    </div>
  )
}

// ── FieldBlock helper ──
function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-hz-text-secondary uppercase tracking-wider font-semibold mb-1">{label}</p>
      {children}
    </div>
  )
}
