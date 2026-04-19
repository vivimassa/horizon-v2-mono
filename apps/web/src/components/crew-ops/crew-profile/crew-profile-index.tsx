'use client'

import { useMemo } from 'react'
import { Plus, Search, User } from 'lucide-react'
import type { CrewMemberListItemRef } from '@skyhub/api'
import { useCrewPositions, useAirports } from '@skyhub/api'
import { getApiBaseUrl } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { getOperatorId } from '@/stores/use-operator-store'
import { crewAccent } from './common/draft-helpers'
import { DRAFT_ID } from './crew-profile-shell'

interface Filters {
  base?: string
  position?: string
  status?: string
  aircraftType?: string
}

interface Props {
  list: CrewMemberListItemRef[]
  loading: boolean
  selectedId: string | null
  search: string
  filters: Filters
  onSearchChange: (v: string) => void
  onFiltersChange: (f: Filters) => void
  onSelect: (id: string) => void
  onStartCreate: () => void
}

export function CrewProfileIndex({
  list,
  loading,
  selectedId,
  search,
  filters,
  onSearchChange,
  onFiltersChange,
  onSelect,
  onStartCreate,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const positionsQ = useCrewPositions(getOperatorId())
  const basesQ = useAirports({ crewBase: true })
  const positions = positionsQ.data ?? []
  const bases = basesQ.data ?? []

  const positionLabel = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of positions) m.set(p._id, p.code)
    return m
  }, [positions])

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const rowHover = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
  const activeBg = `${crewAccent(isDark)}1a`

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b" style={{ borderColor: border }}>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-[15px] font-bold flex-1" style={{ color: palette.text }}>
            Crew Profile
          </h2>
          <button
            type="button"
            onClick={onStartCreate}
            className="h-8 px-2.5 rounded-lg text-[13px] font-semibold flex items-center gap-1 transition-opacity hover:opacity-90"
            style={{ background: crewAccent(isDark), color: 'white' }}
          >
            <Plus size={13} />
            New Crew
          </button>
        </div>
        <div className="relative mb-2">
          <Search
            size={14}
            style={{
              color: palette.textTertiary,
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, ID, short code…"
            className="w-full h-10 pl-8 pr-3 rounded-lg text-[13px] outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${border}`,
              color: palette.text,
              boxShadow: isDark ? '0 1px 1px rgba(0,0,0,0.25)' : '0 1px 2px rgba(96,97,112,0.08)',
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Status"
            value={filters.status}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'terminated', label: 'Terminated' },
            ]}
            onChange={(v) => onFiltersChange({ ...filters, status: v ?? undefined })}
            palette={palette}
            isDark={isDark}
          />
          <FilterChip
            label="Base"
            value={filters.base}
            options={bases.map((b) => ({ value: b._id, label: b.iataCode ?? b.icaoCode }))}
            onChange={(v) => onFiltersChange({ ...filters, base: v ?? undefined })}
            palette={palette}
            isDark={isDark}
          />
          <FilterChip
            label="Position"
            value={filters.position}
            options={positions.map((p) => ({ value: p._id, label: p.code }))}
            onChange={(v) => onFiltersChange({ ...filters, position: v ?? undefined })}
            palette={palette}
            isDark={isDark}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-[13px]" style={{ color: palette.textTertiary }}>
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="p-6 text-center text-[13px]" style={{ color: palette.textTertiary }}>
            No crew members match the current filters.
          </div>
        ) : (
          <ul className="py-1">
            {list.map((c) => {
              const isSel = selectedId === c._id
              const photoFull = c.photoUrl ? `${getApiBaseUrl()}${c.photoUrl}` : null
              const posCode = c.position ? (positionLabel.get(c.position) ?? '') : ''
              return (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c._id)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 transition-colors"
                    style={{
                      background: isSel ? activeBg : 'transparent',
                      borderLeft: isSel ? `3px solid ${crewAccent(isDark)}` : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel) (e.currentTarget as HTMLElement).style.background = rowHover
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                      style={{ background: `${crewAccent(isDark)}22` }}
                    >
                      {photoFull ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoFull} alt="" className="w-full h-full object-cover" />
                      ) : c.firstName || c.lastName ? (
                        <span className="text-[13px] font-semibold" style={{ color: crewAccent(isDark) }}>
                          {(c.firstName[0] ?? '') + (c.lastName[0] ?? '')}
                        </span>
                      ) : (
                        <User size={14} style={{ color: palette.textTertiary }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium truncate" style={{ color: palette.text }}>
                          {c.lastName}, {c.firstName}
                        </p>
                        {c.expiryAlertCount > 0 && (
                          <span
                            className="text-[13px] font-semibold px-1.5 rounded-full"
                            style={{ background: '#E6353522', color: '#E63535' }}
                          >
                            {c.expiryAlertCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] truncate" style={{ color: palette.textTertiary }}>
                        {c.employeeId}
                        {posCode ? ` · ${posCode}` : ''}
                        {c.baseLabel ? ` · ${c.baseLabel}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
            {selectedId === DRAFT_ID && (
              <li>
                <div
                  className="flex items-center gap-3 px-3 py-2 border-l-[3px]"
                  style={{ background: activeBg, borderColor: crewAccent(isDark) }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: `${crewAccent(isDark)}22` }}
                  >
                    <Plus size={14} style={{ color: crewAccent(isDark) }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium" style={{ color: palette.text }}>
                      New crew…
                    </p>
                    <p className="text-[13px]" style={{ color: palette.textTertiary }}>
                      Unsaved
                    </p>
                  </div>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="px-3 py-2 text-[13px] border-t" style={{ borderColor: border, color: palette.textTertiary }}>
        {list.length} crew{search || Object.values(filters).some(Boolean) ? ' (filtered)' : ''}
      </div>
    </div>
  )
}

function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
  palette,
  isDark,
}: {
  label: string
  value: string | undefined
  options: Array<{ value: T; label: string }>
  onChange: (v: string | null) => void
  palette: Palette | typeof colors.dark
  isDark: boolean
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label
  return (
    <label className="relative inline-flex items-center">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="appearance-none h-8 pl-3 pr-3 rounded-full text-[13px] font-medium cursor-pointer"
        style={{
          background: value ? `${crewAccent(isDark)}1a` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          color: value ? crewAccent(isDark) : palette.textSecondary,
          border: `1px solid ${value ? `${crewAccent(isDark)}44` : 'transparent'}`,
        }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {selectedLabel ? null : null}
    </label>
  )
}
