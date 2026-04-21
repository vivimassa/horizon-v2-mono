'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Clock } from 'lucide-react'
import type { ActivityCodeGroupRef, ActivityCodeRef } from '@skyhub/api'

interface Props {
  activityCodes: ActivityCodeRef[]
  activityGroups: ActivityCodeGroupRef[]
  /** Optional filter — when set, hides codes not applicable to this position. */
  crewPositionId?: string | null
  disabled?: boolean
  onPick: (code: ActivityCodeRef) => void
  /** Optional placeholder for the search field. */
  searchPlaceholder?: string
}

/**
 * Shared grouped activity-code picker used by:
 *   - The Assign tab's single-date + range flows (right panel)
 *   - The Change-code dialog
 *   - The Duplicate-across-dates dialog
 *
 * Extracted from `crew-schedule-right-panel.tsx` (ActivityAssignTab) so
 * all three callers share the same group-collapse + search + position
 * filter behaviour.
 */
export function ActivityCodePicker({
  activityCodes,
  activityGroups,
  crewPositionId = null,
  disabled = false,
  onPick,
  searchPlaceholder = 'Search codes...',
}: Props) {
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

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
                      onClick={() => onPick(code)}
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
  onClick,
}: {
  code: ActivityCodeRef
  groupColor: string | null
  disabled: boolean
  onClick: () => void
}) {
  const pillBg = code.color ?? groupColor ?? '#3E7BFA'
  const shortLabel = code.shortLabel ?? code.code
  return (
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
  )
}
