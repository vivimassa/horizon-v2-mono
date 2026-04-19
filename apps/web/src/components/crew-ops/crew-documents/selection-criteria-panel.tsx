'use client'

import { SlidersHorizontal } from 'lucide-react'
import {
  useAirports,
  useCrewPositions,
  useCrewGroups,
  type CrewDocumentStatusFilters,
  type CrewDocumentStatusKey,
} from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { getOperatorId } from '@/stores/use-operator-store'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import { FilterSection, MultiSelectField, PeriodField, type MultiSelectOption } from '@/components/filter-panel/fields'
import { Dropdown } from '@/components/ui/dropdown'

const DOC_STATUS_OPTIONS: MultiSelectOption[] = [
  { key: 'missing_photo', label: 'Missing Photo' },
  { key: 'missing_passport', label: 'Missing Passport' },
  { key: 'missing_medical', label: 'Missing Medical' },
  { key: 'missing_training', label: 'Missing Training' },
  { key: 'complete', label: 'Complete' },
]

interface Props {
  draft: CrewDocumentStatusFilters
  onDraftChange: (next: CrewDocumentStatusFilters) => void
  onGo: () => void
  loading: boolean
}

export function SelectionCriteriaPanel({ draft, onDraftChange, onGo, loading }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)

  const operatorId = getOperatorId()
  const bases = useAirports({ crewBase: true }).data ?? []
  const positions = useCrewPositions(operatorId).data ?? []
  const groups = useCrewGroups(operatorId).data ?? []

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const docStatusValue = draft.documentStatus ?? []

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} style={{ color: accent }} />
          <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: palette.textSecondary }}>
            Selection Criteria
          </h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <FilterSection label="Base">
          <Dropdown
            value={draft.base ?? null}
            onChange={(v) => onDraftChange({ ...draft, base: v || undefined })}
            options={bases.map((b) => ({ value: b._id, label: b.iataCode ?? b.icaoCode }))}
            placeholder="All bases"
          />
        </FilterSection>
        <FilterSection label="Position">
          <Dropdown
            value={draft.position ?? null}
            onChange={(v) => onDraftChange({ ...draft, position: v || undefined })}
            options={positions.map((p) => ({ value: p._id, label: `${p.code} — ${p.name}` }))}
            placeholder="All positions"
          />
        </FilterSection>
        <FilterSection label="Document Status">
          <MultiSelectField
            options={DOC_STATUS_OPTIONS}
            value={docStatusValue}
            onChange={(keys) =>
              onDraftChange({
                ...draft,
                documentStatus: keys.length > 0 ? (keys as CrewDocumentStatusKey[]) : undefined,
              })
            }
            allLabel="Any status"
            noneLabel="Any status"
            placeholder="Any status"
            summaryMax={2}
          />
        </FilterSection>
        <FilterSection label="Expiry Date Range">
          <PeriodField
            from={draft.expiryFrom ?? ''}
            to={draft.expiryTo ?? ''}
            onChangeFrom={(iso) => onDraftChange({ ...draft, expiryFrom: iso || undefined })}
            onChangeTo={(iso) => onDraftChange({ ...draft, expiryTo: iso || undefined })}
          />
        </FilterSection>
        <FilterSection label="Group">
          <Dropdown
            value={draft.groupId ?? null}
            onChange={(v) => onDraftChange({ ...draft, groupId: v || undefined })}
            options={groups.map((g) => ({ value: g._id, label: g.name }))}
            placeholder="All groups"
          />
        </FilterSection>
      </div>

      <div className="p-3 border-t" style={{ borderColor: border }}>
        <button
          type="button"
          onClick={onGo}
          disabled={loading}
          className="w-full h-10 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: accent, color: 'white' }}
        >
          {loading ? 'Loading…' : 'Go'}
        </button>
      </div>
    </div>
  )
}
