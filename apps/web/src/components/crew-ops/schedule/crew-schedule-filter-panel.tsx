'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import {
  FilterPanel,
  FilterSection,
  PeriodField,
  MultiSelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { SpecificCrewSearchDialog } from './dialogs/specific-crew-search-dialog'

interface Props {
  onGo: () => void
}

/**
 * Left filter panel for 4.1.6 Crew Schedule.
 *
 * Draft-only: filter changes live in local state and do NOT touch the
 * canvas until the user clicks Go. Base / Position / A/C Type are all
 * multi-selectable; the server fetch narrows when exactly one value is
 * picked, otherwise all rows are fetched and trimmed client-side in
 * `buildCrewScheduleLayout`.
 *
 * Specific Crew Search overrides every other filter — when token list
 * is non-empty, Base / Position / A/C Type / Crew Group are disabled
 * and the layout filter only honours the token list.
 */
export function CrewScheduleFilterPanel({ onGo }: Props) {
  const storeFrom = useCrewScheduleStore((s) => s.periodFromIso)
  const storeTo = useCrewScheduleStore((s) => s.periodToIso)
  const storeFilters = useCrewScheduleStore((s) => s.filters)
  const loading = useCrewScheduleStore((s) => s.loading)

  const positions = useCrewScheduleStore((s) => s.positions)
  const context = useCrewScheduleStore((s) => s.context)
  const loadContext = useCrewScheduleStore((s) => s.loadContext)

  const setPeriod = useCrewScheduleStore((s) => s.setPeriod)
  const setFilters = useCrewScheduleStore((s) => s.setFilters)

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const [draftFrom, setDraftFrom] = useState(storeFrom)
  const [draftTo, setDraftTo] = useState(storeTo)
  const [draftBase, setDraftBase] = useState<string[]>(storeFilters.baseIds)
  const [draftPositions, setDraftPositions] = useState<string[]>(storeFilters.positionIds)
  const [draftAcTypes, setDraftAcTypes] = useState<string[]>(storeFilters.acTypeIcaos)
  const [draftCrewGroups, setDraftCrewGroups] = useState<string[]>(storeFilters.crewGroupIds)
  const [draftSpecific, setDraftSpecific] = useState<string[]>(storeFilters.specificCrewTokens ?? [])
  const [searchOpen, setSearchOpen] = useState(false)

  const baseOptions: MultiSelectOption[] = useMemo(
    () => context.bases.map((b) => ({ key: b._id, label: b.iataCode ?? b.name })),
    [context.bases],
  )
  const positionOptions: MultiSelectOption[] = useMemo(
    () =>
      positions
        .filter((p) => p.isActive)
        .slice()
        .sort((a, b) => {
          if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
          return (a.rankOrder ?? 9999) - (b.rankOrder ?? 9999)
        })
        .map((p) => ({ key: p._id, label: `${p.code} · ${p.name}`, color: p.color ?? undefined })),
    [positions],
  )
  const acTypeOptions: MultiSelectOption[] = useMemo(
    () => context.acTypes.map((t) => ({ key: t, label: t })),
    [context.acTypes],
  )
  const crewGroupOptions: MultiSelectOption[] = useMemo(
    () => context.crewGroups.map((g) => ({ key: g._id, label: g.name })),
    [context.crewGroups],
  )

  const specificActive = draftSpecific.length > 0
  const activeCount =
    (specificActive ? 1 : 0) +
    (!specificActive && draftBase.length > 0 ? 1 : 0) +
    (!specificActive && draftPositions.length > 0 ? 1 : 0) +
    (!specificActive && draftAcTypes.length > 0 ? 1 : 0) +
    (!specificActive && draftCrewGroups.length > 0 ? 1 : 0)

  function handleGo() {
    setPeriod(draftFrom, draftTo)
    setFilters({
      // Specific Crew Search wins — wipe the others on commit so the
      // server fetches the unrestricted set and the layout filter is
      // free to apply tokens in isolation.
      baseIds: specificActive ? [] : draftBase,
      positionIds: specificActive ? [] : draftPositions,
      acTypeIcaos: specificActive ? [] : draftAcTypes,
      crewGroupIds: specificActive ? [] : draftCrewGroups,
      specificCrewTokens: draftSpecific,
    })
    setTimeout(() => onGo(), 0)
  }

  return (
    <>
      <FilterPanel
        activeCount={activeCount}
        footer={<FilterGoButton onClick={handleGo} loading={loading} disabled={!draftFrom || !draftTo} />}
      >
        <FilterSection label="Period">
          <PeriodField from={draftFrom} to={draftTo} onChangeFrom={setDraftFrom} onChangeTo={setDraftTo} />
        </FilterSection>

        <DisabledWhen disabled={specificActive}>
          <FilterSection label="Base">
            <MultiSelectField
              options={baseOptions}
              value={draftBase}
              onChange={setDraftBase}
              allLabel="All Bases"
              noneLabel="All Bases"
              searchable
              searchPlaceholder="Search bases…"
            />
          </FilterSection>

          <FilterSection label="Position">
            <MultiSelectField
              options={positionOptions}
              value={draftPositions}
              onChange={setDraftPositions}
              allLabel="All Positions"
              noneLabel="All Positions"
              searchable
              searchPlaceholder="Search positions…"
            />
          </FilterSection>

          <FilterSection label="A/C Type">
            <MultiSelectField
              options={acTypeOptions}
              value={draftAcTypes}
              onChange={setDraftAcTypes}
              allLabel="All Types"
              noneLabel="All Types"
            />
          </FilterSection>

          <FilterSection label="Crew Group">
            <MultiSelectField
              options={crewGroupOptions}
              value={draftCrewGroups}
              onChange={setDraftCrewGroups}
              allLabel="All Groups"
              noneLabel="All Groups"
              searchable
              searchPlaceholder="Search groups…"
            />
          </FilterSection>
        </DisabledWhen>

        <FilterSection label="Specific Crew Search">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full h-10 px-3 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors"
            style={{
              background: specificActive ? 'rgba(62,123,250,0.10)' : 'rgba(142,142,160,0.12)',
              border: `1px solid ${specificActive ? 'var(--module-accent)' : 'rgba(142,142,160,0.3)'}`,
              color: specificActive ? 'var(--module-accent)' : undefined,
            }}
          >
            <Search size={14} />
            <span className="flex-1 text-left truncate">
              {specificActive ? `${draftSpecific.length} crew selected` : 'Add crew IDs or names…'}
            </span>
            {specificActive && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear specific crew search"
                onClick={(e) => {
                  e.stopPropagation()
                  setDraftSpecific([])
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    setDraftSpecific([])
                  }
                }}
                className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-white/10"
              >
                <X size={12} />
              </span>
            )}
          </button>
          {specificActive && (
            <div className="text-[11px] text-hz-text-tertiary leading-snug">
              Overrides Base / Position / A/C Type / Crew Group filters above.
            </div>
          )}
        </FilterSection>
      </FilterPanel>

      {searchOpen && (
        <SpecificCrewSearchDialog
          initial={draftSpecific}
          onClose={() => setSearchOpen(false)}
          onSave={(tokens) => {
            setDraftSpecific(tokens)
            // Mirror the override visually in the panel — the local
            // drafts are blanked so the user sees what Go will commit.
            if (tokens.length > 0) {
              setDraftBase([])
              setDraftPositions([])
              setDraftAcTypes([])
              setDraftCrewGroups([])
            }
          }}
        />
      )}
    </>
  )
}

/** Visually mute and pointer-block a sub-tree when `disabled` is true.
 *  Used to gray-out the conventional filter sections while Specific
 *  Crew Search owns the result set. */
function DisabledWhen({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        transition: 'opacity 150ms ease',
      }}
      aria-disabled={disabled}
    >
      {children}
    </div>
  )
}
