'use client'

import { useEffect, useMemo } from 'react'
import { Filter, RotateCcw, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { isSmartFilterActive } from '@/lib/crew-schedule/smart-filter'
import { CrewScheduleActivityCodeMultiselect } from './crew-schedule-activity-code-multiselect'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Smart Filter side-sheet (AIMS §3 + §6.4). Follows the same draft +
 * commit pattern as the left FilterPanel:
 *
 *   - Toggling any criterion updates `smartFilterDraft` only.
 *   - The canvas/layout keep reading the *committed* `smartFilter`.
 *   - User must click the bottom "Filter" CTA to commit the draft.
 *
 * Three modes govern what matching crew looks like:
 *
 *   - **Show only**  : non-matching crew are filtered out of the Gantt.
 *   - **Highlight**  : everyone stays visible; matching rows glow.
 *   - **Exclude**    : matching crew are filtered out (inverse of Show).
 */
export function CrewScheduleSmartFilter({ open, onClose }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const committed = useCrewScheduleStore((s) => s.smartFilter)
  const draft = useCrewScheduleStore((s) => s.smartFilterDraft)
  const setDraft = useCrewScheduleStore((s) => s.setSmartFilterDraft)
  const commit = useCrewScheduleStore((s) => s.commitSmartFilter)
  const initDraft = useCrewScheduleStore((s) => s.initSmartFilterDraft)
  const resetSmartFilter = useCrewScheduleStore((s) => s.resetSmartFilter)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const activityGroups = useCrewScheduleStore((s) => s.activityGroups)
  const crew = useCrewScheduleStore((s) => s.crew)

  // Known languages + AC types pulled from the loaded crew.
  const knownLanguages = useMemo(() => {
    const s = new Set<string>()
    for (const c of crew) {
      for (const l of c.languages ?? []) s.add(l)
    }
    return Array.from(s).sort()
  }, [crew])
  const knownAcTypes = useMemo(() => {
    const s = new Set<string>()
    for (const c of crew) {
      for (const t of c.acTypes ?? []) s.add(t)
    }
    return Array.from(s).sort()
  }, [crew])

  const groupsById = useMemo(() => new Map(activityGroups.map((g) => [g._id, g])), [activityGroups])

  const activityCodeOptions = useMemo(
    () =>
      activityCodes
        .filter((c) => c.isActive && !c.isArchived)
        .map((c) => ({
          id: c._id,
          code: c.code,
          name: c.name,
          color: c.color ?? groupsById.get(c.groupId)?.color ?? null,
        })),
    [activityCodes, groupsById],
  )

  // Initialise draft from committed every time the sheet opens so edits
  // start from what's on screen.
  useEffect(() => {
    if (open) initDraft()
  }, [open, initDraft])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const active = isSmartFilterActive(committed)
  const dirty = !sameSmartFilter(draft, committed)

  const handleFilter = () => {
    if (!dirty) return
    commit()
  }

  return (
    <div
      className="shrink-0 rounded-2xl overflow-hidden flex flex-col"
      style={{
        width: 340,
        background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 shrink-0"
        style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'var(--module-accent)' }} />
          <span className="text-[15px] font-bold">Smart filter</span>
          {active && (
            <span
              className="text-[13px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: 'var(--module-accent)' }}
            >
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(active || dirty) && (
            <button
              onClick={resetSmartFilter}
              className="h-7 px-2 rounded-md text-[13px] font-medium hover:bg-hz-border/20 flex items-center gap-1.5"
              title="Clear all criteria"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-hz-border/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Mode */}
        <SectionHeader title="Mode" />
        <div className="grid grid-cols-3 gap-1.5">
          {(['show-only', 'highlight', 'exclude'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDraft({ mode: m })}
              className="h-9 rounded-lg text-[13px] font-semibold transition-colors capitalize"
              style={{
                background: draft.mode === m ? 'var(--module-accent)' : 'transparent',
                color: draft.mode === m ? '#FFFFFF' : undefined,
                border: `1px solid ${draft.mode === m ? 'transparent' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              }}
            >
              {m.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Combinator */}
        <SectionHeader title="Match" />
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}` }}
        >
          {(['any', 'all'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setDraft({ combinator: c })}
              className="flex-1 h-9 text-[13px] font-semibold uppercase tracking-wider"
              style={{
                background: draft.combinator === c ? 'var(--module-accent)' : 'transparent',
                color: draft.combinator === c ? '#FFFFFF' : undefined,
              }}
            >
              {c === 'any' ? 'Any match' : 'All match'}
            </button>
          ))}
        </div>

        {/* Duty-related toggles */}
        <SectionHeader title="Duty" />
        <div className="space-y-1.5">
          <CheckChip
            label="Has rule violation"
            checked={draft.hasRuleViolation}
            onToggle={() => setDraft({ hasRuleViolation: !draft.hasRuleViolation })}
          />
          <CheckChip
            label="Has any duty in period"
            checked={draft.hasAnyDuty}
            onToggle={() => setDraft({ hasAnyDuty: !draft.hasAnyDuty })}
          />
          <CheckChip
            label="Has no duties in period"
            checked={draft.hasNoDuties}
            onToggle={() => setDraft({ hasNoDuties: !draft.hasNoDuties })}
          />
        </div>

        {/* Expiry */}
        <SectionHeader title="Expiry" />
        <CheckChip
          label="Has expiry alert"
          checked={draft.hasExpiryAlert}
          onToggle={() => setDraft({ hasExpiryAlert: !draft.hasExpiryAlert })}
        />

        {/* Activity code */}
        {activityCodeOptions.length > 0 && (
          <>
            <SectionHeader title="On activity code" />
            <CrewScheduleActivityCodeMultiselect
              options={activityCodeOptions}
              selected={draft.activityCodeIds}
              onChange={(next) => setDraft({ activityCodeIds: next })}
            />
          </>
        )}

        {/* A/C Type */}
        {knownAcTypes.length > 0 && (
          <>
            <SectionHeader title="A/C type qualification" />
            <ChipPicker
              options={knownAcTypes.map((t) => ({ id: t, label: t }))}
              selected={draft.acTypes}
              onToggle={(id) => {
                const next = draft.acTypes.includes(id) ? draft.acTypes.filter((x) => x !== id) : [...draft.acTypes, id]
                setDraft({ acTypes: next })
              }}
            />
          </>
        )}

        {/* Languages */}
        {knownLanguages.length > 0 && (
          <>
            <SectionHeader title="Languages spoken" />
            <ChipPicker
              options={knownLanguages.map((l) => ({ id: l, label: l }))}
              selected={draft.languages}
              onToggle={(id) => {
                const next = draft.languages.includes(id)
                  ? draft.languages.filter((x) => x !== id)
                  : [...draft.languages, id]
                setDraft({ languages: next })
              }}
            />
          </>
        )}
      </div>

      {/* Footer CTA — copies draft → committed */}
      <div
        className="shrink-0 px-4 py-3 space-y-2"
        style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
      >
        {dirty && (
          <div className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: 'var(--module-accent)' }}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--module-accent)' }}
            />
            Unsaved changes
          </div>
        )}
        <button
          onClick={handleFilter}
          disabled={!dirty}
          className="w-full h-10 rounded-lg text-[13px] font-semibold transition-opacity"
          style={{
            background: 'var(--module-accent)',
            color: '#FFFFFF',
            opacity: dirty ? 1 : 0.4,
            cursor: dirty ? 'pointer' : 'not-allowed',
          }}
        >
          Filter
        </button>
      </div>
    </div>
  )
}

function sameSmartFilter(
  a: ReturnType<typeof useCrewScheduleStore.getState>['smartFilter'],
  b: ReturnType<typeof useCrewScheduleStore.getState>['smartFilter'],
): boolean {
  return (
    a.hasRuleViolation === b.hasRuleViolation &&
    a.hasExpiryAlert === b.hasExpiryAlert &&
    a.hasAnyDuty === b.hasAnyDuty &&
    a.hasNoDuties === b.hasNoDuties &&
    a.mode === b.mode &&
    a.combinator === b.combinator &&
    sameStringSet(a.activityCodeIds, b.activityCodeIds) &&
    sameStringSet(a.acTypes, b.acTypes) &&
    sameStringSet(a.languages, b.languages)
  )
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[3px] h-3.5 rounded-sm" style={{ backgroundColor: 'var(--module-accent)' }} />
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-secondary">{title}</h3>
    </div>
  )
}

function CheckChip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-left transition-colors"
      style={{
        background: checked ? 'rgba(62,123,250,0.14)' : 'transparent',
        border: `1px solid ${checked ? 'var(--module-accent)' : 'rgba(125,125,140,0.25)'}`,
        color: checked ? 'var(--module-accent)' : undefined,
      }}
    >
      <span
        className="w-4 h-4 rounded flex items-center justify-center shrink-0"
        style={{
          background: checked ? 'var(--module-accent)' : 'transparent',
          border: `1px solid ${checked ? 'var(--module-accent)' : 'rgba(125,125,140,0.35)'}`,
        }}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
            <polyline points="3 8 7 12 13 4" />
          </svg>
        )}
      </span>
      <span className="text-[13px] font-medium">{label}</span>
    </button>
  )
}

function ChipPicker({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            onClick={() => onToggle(opt.id)}
            className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{
              background: on ? 'var(--module-accent)' : 'transparent',
              color: on ? '#FFFFFF' : undefined,
              border: `1px solid ${on ? 'transparent' : 'rgba(125,125,140,0.25)'}`,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
