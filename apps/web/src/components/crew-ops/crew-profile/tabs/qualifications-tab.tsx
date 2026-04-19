'use client'

import { useMemo, useState, type Ref } from 'react'
import { api, type CrewExpiryDateFullRef, type CrewMemberRef, type FullCrewProfileRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { SectionCard } from '../common/section-card'
import { crewAccent } from '../common/draft-helpers'
import { AircraftQualificationsGrid, type AircraftQualificationsGridHandle } from '../grid/aircraft-qualifications-grid'

interface Props {
  crewId: string | null
  isDraft: boolean
  member: CrewMemberRef
  serverProfile: FullCrewProfileRef | null
  onFieldChange: (field: keyof CrewMemberRef, value: CrewMemberRef[keyof CrewMemberRef]) => void
  onRefresh: () => Promise<unknown>
  gridRef?: Ref<AircraftQualificationsGridHandle>
  onGridReadyCountChange?: (n: number) => void
}

export function QualificationsTab({ crewId, serverProfile, onRefresh, gridRef, onGridReadyCountChange }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const expiryRows = serverProfile?.expiryDates ?? []
  const qualifications = serverProfile?.qualifications ?? []

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; color: string; rows: CrewExpiryDateFullRef[] }>()
    for (const e of expiryRows) {
      const key = e.categoryKey || 'other'
      if (!map.has(key)) map.set(key, { label: e.categoryLabel, color: e.categoryColor, rows: [] })
      map.get(key)!.rows.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label))
  }, [expiryRows])

  return (
    <>
      <SectionCard
        title="Aircraft Type Qualifications"
        description="Add each A/C-type × position rating. Works like Excel — Tab/Enter move between cells, Ctrl+C/V copies a row. Rows auto-save after 500ms."
        palette={palette}
        isDark={isDark}
        accentColor={crewAccent(isDark)}
      >
        <AircraftQualificationsGrid
          ref={gridRef}
          crewId={crewId}
          rows={qualifications}
          onChanged={onRefresh}
          onReadyCountChange={onGridReadyCountChange}
        />
      </SectionCard>

      <SectionCard
        title="Expiry Dates"
        description="Defined in 5.4.3 Crew Expiry Codes. Manual dates override the computed value. Click an expiry-date cell to edit."
        palette={palette}
        isDark={isDark}
        accentColor="#0063F7"
      >
        {expiryRows.length === 0 ? (
          <p className="text-[13px]" style={{ color: palette.textTertiary }}>
            No applicable expiry codes. Add a qualification or confirm the crew member&apos;s position — expiry rows
            auto-populate when the position maps to an active code in 5.4.3.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map(([key, { label, color, rows }]) => (
              <CategoryBlock
                key={key}
                label={label}
                color={color}
                rows={rows}
                crewId={crewId}
                palette={palette}
                isDark={isDark}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

function CategoryBlock({
  label,
  color,
  rows,
  crewId,
  palette,
  isDark,
  onRefresh,
}: {
  label: string
  color: string
  rows: CrewExpiryDateFullRef[]
  crewId: string | null
  palette: Palette
  isDark: boolean
  onRefresh: () => Promise<unknown>
}) {
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-[3px] h-4 rounded-full" style={{ background: color }} />
        <h4 className="text-[13px] font-bold" style={{ color: palette.text }}>
          {label}
        </h4>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
        <div
          className="grid text-[12px] font-medium uppercase tracking-wide"
          style={{
            gridTemplateColumns: '80px 60px minmax(140px, 1fr) 110px 70px 120px 120px 80px',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            color: palette.textSecondary,
          }}
        >
          <HeaderC>Code</HeaderC>
          <HeaderC>A/C</HeaderC>
          <HeaderC>Description</HeaderC>
          <HeaderC>Last Done</HeaderC>
          <HeaderC>Base M</HeaderC>
          <HeaderC>Expiry</HeaderC>
          <HeaderC>Next Planned</HeaderC>
          <HeaderC>Status</HeaderC>
        </div>
        {rows.map((row) => (
          <ExpiryRow key={row._id} row={row} crewId={crewId} palette={palette} isDark={isDark} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  )
}

function ExpiryRow({
  row,
  crewId,
  palette,
  isDark,
  onRefresh,
}: {
  row: CrewExpiryDateFullRef
  crewId: string | null
  palette: Palette
  isDark: boolean
  onRefresh: () => Promise<unknown>
}) {
  const [expiryDate, setExpiryDate] = useState(row.expiryDate ?? '')
  const [lastDone, setLastDone] = useState(row.lastDone ?? '')
  const [baseMonth, setBaseMonth] = useState(row.baseMonth ?? '')
  const [nextPlanned, setNextPlanned] = useState(row.nextPlanned ?? '')
  const [saving, setSaving] = useState(false)

  const statusColor =
    row.status === 'valid'
      ? '#06C270'
      : row.status === 'warning'
        ? '#FF8800'
        : row.status === 'expired'
          ? '#E63535'
          : '#555770'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const commit = async () => {
    if (!crewId) return
    setSaving(true)
    try {
      await api.updateCrewExpiryDate(crewId, row._id, {
        expiryDate: expiryDate || null,
        lastDone: lastDone || null,
        baseMonth: baseMonth || null,
        nextPlanned: nextPlanned || null,
      })
      await onRefresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="grid text-[13px] border-t"
      style={{
        gridTemplateColumns: '80px 60px minmax(140px, 1fr) 110px 70px 120px 120px 80px',
        borderColor: border,
        color: palette.text,
      }}
    >
      <div className="px-2 py-1.5 font-mono font-semibold" style={{ color: crewAccent(isDark) }}>
        {row.codeLabel}
      </div>
      <div className="px-2 py-1.5 font-mono" style={{ color: palette.textSecondary }}>
        {row.aircraftType || '—'}
      </div>
      <div className="px-2 py-1.5 truncate">{row.codeName}</div>
      <div className="px-1 py-0.5">
        <input
          type="date"
          value={lastDone}
          onChange={(e) => setLastDone(e.target.value)}
          onBlur={commit}
          disabled={!crewId}
          className="w-full h-7 px-1 text-[13px] bg-transparent outline-none"
          style={{ color: palette.text }}
        />
      </div>
      <div className="px-1 py-0.5">
        <input
          type="number"
          min={1}
          max={12}
          value={baseMonth}
          onChange={(e) => setBaseMonth(e.target.value)}
          onBlur={commit}
          disabled={!crewId}
          className="w-full h-7 px-1 text-[13px] bg-transparent outline-none"
          style={{ color: palette.text }}
        />
      </div>
      <div className="px-1 py-0.5">
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          onBlur={commit}
          disabled={!crewId}
          className="w-full h-7 px-1 text-[13px] bg-transparent outline-none"
          style={{ color: palette.text, fontWeight: row.isManualOverride ? 600 : 400 }}
          title={row.isManualOverride ? 'Manually overridden' : undefined}
        />
      </div>
      <div className="px-1 py-0.5">
        <input
          type="date"
          value={nextPlanned}
          onChange={(e) => setNextPlanned(e.target.value)}
          onBlur={commit}
          disabled={!crewId}
          className="w-full h-7 px-1 text-[13px] bg-transparent outline-none"
          style={{ color: palette.text }}
        />
      </div>
      <div className="px-2 py-1.5 flex items-center">
        <span
          className="text-[13px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
          style={{ background: `${statusColor}22`, color: statusColor }}
        >
          {saving ? 'Saving…' : row.status}
        </span>
      </div>
    </div>
  )
}

function HeaderC({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1.5 flex items-center">{children}</div>
}
