'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftToLine, ArrowRightToLine, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import type { ActivityCodeGroupRef, ActivityCodeRef } from '@skyhub/api'

export interface ActivityPickTimes {
  startHHMM: string
  endHHMM: string
}

interface Props {
  activityCodes: ActivityCodeRef[]
  activityGroups: ActivityCodeGroupRef[]
  /** Optional filter — when set, hides codes not applicable to this position. */
  crewPositionId?: string | null
  disabled?: boolean
  onPick: (code: ActivityCodeRef, times?: ActivityPickTimes) => void
  /** Optional placeholder for the search field. */
  searchPlaceholder?: string
  /** Hide the inline time editor for time-bounded codes (e.g. Change-code dialog
   *  where the target activity already carries its own times). */
  disableTimeEditor?: boolean
}

/**
 * Shared grouped activity-code picker used by:
 *   - The Assign tab's single-date + range flows (right panel)
 *   - The Change-code dialog
 *   - The Duplicate-across-dates dialog
 *
 * Time-bounded codes (`requiresTime === true`) expand inline on click into a
 * stepper that lets the user override the default Time Assignment window
 * before committing. Non-time-bounded codes commit immediately.
 */
export function ActivityCodePicker({
  activityCodes,
  activityGroups,
  crewPositionId = null,
  disabled = false,
  onPick,
  searchPlaceholder = 'Search codes...',
  disableTimeEditor = false,
}: Props) {
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null)

  const filteredCodes = useMemo(() => {
    const q = search.trim().toUpperCase()
    return activityCodes
      .filter((c) => c.isActive && !c.isArchived)
      .filter((c) => {
        if (!c.applicablePositions?.length) return true
        if (!crewPositionId) return true
        return c.applicablePositions.includes(crewPositionId)
      })
      .filter((c) => {
        if (!q) return true
        return c.code.toUpperCase().includes(q) || c.name.toUpperCase().includes(q)
      })
  }, [activityCodes, search, crewPositionId])

  const groupsById = useMemo(() => new Map(activityGroups.map((g) => [g._id, g])), [activityGroups])
  const codesByGroup = useMemo(() => {
    const map = new Map<string, ActivityCodeRef[]>()
    for (const c of filteredCodes) {
      const arr = map.get(c.groupId) ?? []
      arr.push(c)
      map.set(c.groupId, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.code.localeCompare(b.code))
    return map
  }, [filteredCodes])

  const orderedGroupIds = useMemo(() => {
    const ids = Array.from(codesByGroup.keys())
    ids.sort((a, b) => (groupsById.get(a)?.sortOrder ?? 999) - (groupsById.get(b)?.sortOrder ?? 999))
    return ids
  }, [codesByGroup, groupsById])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const handleRowClick = (code: ActivityCodeRef) => {
    if (disabled) return
    if (code.requiresTime && !disableTimeEditor) {
      setExpandedCodeId((id) => (id === code._id ? null : code._id))
      return
    }
    onPick(code)
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 pb-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hz-text-tertiary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-hz-border/30 bg-transparent text-[13px] outline-none focus:border-[var(--module-accent)]"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {orderedGroupIds.length === 0 && (
          <div className="p-4 text-[13px] text-hz-text-tertiary text-center">No matching activity codes.</div>
        )}
        {orderedGroupIds.map((groupId) => {
          const group = groupsById.get(groupId)
          const codes = codesByGroup.get(groupId) ?? []
          const collapsed = collapsedGroups.has(groupId)
          return (
            <div key={groupId}>
              <button
                onClick={() => toggleGroup(groupId)}
                className="w-full flex items-center gap-2 px-1 h-10 hover:bg-hz-border/10 text-left sticky top-0 z-[1] bg-[inherit]"
                style={{ backdropFilter: 'blur(24px)' }}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4 text-hz-text-tertiary shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-hz-text-tertiary shrink-0" />
                )}
                <span className="text-[13px] font-bold uppercase tracking-wider text-hz-text-secondary">
                  {group?.name ?? 'Ungrouped'}
                </span>
                <span className="text-[13px] font-bold text-hz-text-tertiary">{codes.length}</span>
              </button>
              {!collapsed && (
                <div>
                  {codes.map((code) => (
                    <ActivityCodeRow
                      key={code._id}
                      code={code}
                      groupColor={group?.color ?? null}
                      disabled={disabled}
                      expanded={expandedCodeId === code._id}
                      showTimeEditor={!disableTimeEditor}
                      onClick={() => handleRowClick(code)}
                      onAssignWithTimes={(times) => {
                        onPick(code, times)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityCodeRow({
  code,
  groupColor,
  disabled,
  expanded,
  showTimeEditor,
  onClick,
  onAssignWithTimes,
}: {
  code: ActivityCodeRef
  groupColor: string | null
  disabled: boolean
  expanded: boolean
  showTimeEditor: boolean
  onClick: () => void
  onAssignWithTimes: (times: ActivityPickTimes) => void
}) {
  const pillBg = code.color ?? groupColor ?? '#3E7BFA'
  const shortLabel = code.shortLabel ?? code.code
  const timeBounded = code.requiresTime && showTimeEditor
  return (
    <div>
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full flex items-center gap-3 px-2 h-11 hover:bg-hz-border/10 text-left disabled:opacity-50 transition-colors"
      >
        <span
          className="inline-flex items-center justify-center h-7 min-w-[52px] px-2.5 rounded-md text-[13px] font-bold text-white tabular-nums shrink-0"
          style={{ backgroundColor: pillBg }}
        >
          {shortLabel}
        </span>
        <span className="flex-1 text-[14px] text-hz-text truncate">{code.name}</span>
        {code.requiresTime ? (
          <Clock className="w-4 h-4 text-hz-text-tertiary shrink-0" />
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}
      </button>
      {timeBounded && expanded && (
        <TimeEditorAccordion
          defaultStart={code.defaultStartTime ?? '08:00'}
          defaultEnd={code.defaultEndTime ?? '16:00'}
          disabled={disabled}
          onAssign={onAssignWithTimes}
        />
      )}
    </div>
  )
}

function TimeEditorAccordion({
  defaultStart,
  defaultEnd,
  disabled,
  onAssign,
}: {
  defaultStart: string
  defaultEnd: string
  disabled: boolean
  onAssign: (times: ActivityPickTimes) => void
}) {
  const [start, setStart] = useState<string>(normalizeHHMM(defaultStart) ?? '08:00')
  const [end, setEnd] = useState<string>(normalizeHHMM(defaultEnd) ?? '16:00')

  const valid = isValidHHMM(start) && isValidHHMM(end)

  return (
    <div className="mx-2 mb-2 rounded-xl border border-hz-border/30 bg-hz-border/[0.05] p-3 shadow-sm">
      <div className="flex items-stretch gap-2">
        <TimeStepper label="Start" value={start} onChange={setStart} disabled={disabled} />
        <TimeStepper label="End" value={end} onChange={setEnd} disabled={disabled} />
      </div>
      <button
        onClick={() => valid && onAssign({ startHHMM: start, endHHMM: end })}
        disabled={disabled || !valid}
        className="mt-3 w-full h-9 rounded-lg text-[13px] font-semibold tracking-wide bg-[var(--module-accent)] text-white shadow-sm hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:hover:brightness-100 transition"
      >
        Assign
      </button>
    </div>
  )
}

function TimeStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const step = (m: number) => onChange(shiftHHMM(value, m))
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-hz-text-tertiary px-0.5">{label}</span>
      <div className="flex items-center gap-0.5 rounded-lg border border-hz-border/40 bg-hz-bg/40 px-1 py-1 focus-within:border-[var(--module-accent)] focus-within:ring-1 focus-within:ring-[var(--module-accent)]/40 transition">
        <StepBtn onClick={() => step(-60)} disabled={disabled} aria-label={`${label} -60 min`}>
          <ArrowLeftToLine className="w-3.5 h-3.5" />
        </StepBtn>
        <StepBtn onClick={() => step(-15)} disabled={disabled} aria-label={`${label} -15 min`}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </StepBtn>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const n = normalizeHHMM(e.target.value)
            if (n) onChange(n)
          }}
          disabled={disabled}
          inputMode="numeric"
          maxLength={5}
          className="flex-1 min-w-0 w-0 h-6 bg-transparent text-center text-[13px] font-mono font-bold tabular-nums outline-none"
        />
        <StepBtn onClick={() => step(15)} disabled={disabled} aria-label={`${label} +15 min`}>
          <ChevronRight className="w-3.5 h-3.5" />
        </StepBtn>
        <StepBtn onClick={() => step(60)} disabled={disabled} aria-label={`${label} +60 min`}>
          <ArrowRightToLine className="w-3.5 h-3.5" />
        </StepBtn>
      </div>
    </div>
  )
}

function StepBtn({
  onClick,
  disabled,
  children,
  ...rest
}: {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
  'aria-label': string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className="inline-flex items-center justify-center h-6 w-5 rounded text-hz-text-secondary hover:bg-[var(--module-accent)]/15 hover:text-[var(--module-accent)] active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-hz-text-secondary transition shrink-0"
    >
      {children}
    </button>
  )
}

/* ─── Time helpers ────────────────────────────────────────────────────── */

/** Accept "HHMM", "HH:MM", "H:MM", "HMM" → normalized "HH:MM" or null. */
export function normalizeHHMM(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim().replace(/[^\d:]/g, '')
  let h: number
  let m: number
  if (s.includes(':')) {
    const [hs, ms] = s.split(':')
    h = parseInt(hs, 10)
    m = parseInt(ms ?? '0', 10)
  } else if (/^\d{3,4}$/.test(s)) {
    const pad = s.padStart(4, '0')
    h = parseInt(pad.slice(0, 2), 10)
    m = parseInt(pad.slice(2), 10)
  } else if (/^\d{1,2}$/.test(s)) {
    h = parseInt(s, 10)
    m = 0
  } else {
    return null
  }
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isValidHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

function shiftHHMM(current: string, deltaMin: number): string {
  const n = normalizeHHMM(current)
  if (!n) return current
  const [h, m] = n.split(':').map((x) => parseInt(x, 10))
  let total = h * 60 + m + deltaMin
  total = ((total % 1440) + 1440) % 1440
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
