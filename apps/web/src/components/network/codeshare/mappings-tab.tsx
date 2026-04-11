'use client'

import { useState, useMemo } from 'react'
import { Plus, Upload, Download, Trash2, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { CodeshareAgreementRef, CodeshareMappingRef, CodeshareAgreementStats } from '@skyhub/api'
import type { TabKey, MappingHealth } from './codeshare-types'
import { AGREEMENT_TYPE_LABELS, STATUS_COLORS, HEALTH_INDICATORS } from './codeshare-types'

interface MappingsTabProps {
  agreement: CodeshareAgreementRef
  operatorCode: string
  mappings: CodeshareMappingRef[]
  stats: CodeshareAgreementStats
  healthMap: Record<string, MappingHealth>
  isDark: boolean
  onAddMapping: () => void
  onEditMapping: (mapping: CodeshareMappingRef) => void
  onBulkImport: () => void
  onSwitchTab: (tab: TabKey) => void
  onMappingChanged: () => void
}

type SortCol = 'operating' | 'marketing' | 'route' | 'effective' | 'status'

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function formatDateShort(d: string) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${String(dt.getDate()).padStart(2, '0')}${months[dt.getMonth()]}`
}

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function MappingsTab({
  agreement,
  operatorCode,
  mappings,
  stats,
  healthMap,
  isDark,
  onAddMapping,
  onEditMapping,
  onBulkImport,
  onSwitchTab,
  onMappingChanged,
}: MappingsTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const [sortCol, setSortCol] = useState<SortCol>('operating')
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = useMemo(() => {
    const arr = [...mappings]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'operating':
          cmp = a.operatingFlightNumber.localeCompare(b.operatingFlightNumber, undefined, { numeric: true })
          break
        case 'marketing':
          cmp = a.marketingFlightNumber.localeCompare(b.marketingFlightNumber, undefined, { numeric: true })
          break
        case 'route':
          cmp = `${a.departureIata}${a.arrivalIata}`.localeCompare(`${b.departureIata}${b.arrivalIata}`)
          break
        case 'effective':
          cmp = a.effectiveFrom.localeCompare(b.effectiveFrom)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
      }
      return sortAsc ? cmp : -cmp
    })
    return arr
  }, [mappings, sortCol, sortAsc])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else {
      setSortCol(col)
      setSortAsc(true)
    }
  }

  async function handleDelete(id: string) {
    await api.deleteCodeshareMapping(id)
    onMappingChanged()
  }

  const typeChipStyle = (type: string) =>
    type === 'block_space' || type === 'hard_block'
      ? {
          background: 'rgba(139,92,246,0.10)',
          color: isDark ? '#c4b5fd' : '#7c3aed',
          border: '1px solid rgba(139,92,246,0.15)',
        }
      : {
          background: 'rgba(59,130,246,0.10)',
          color: isDark ? '#93c5fd' : '#2563eb',
          border: '1px solid rgba(59,130,246,0.15)',
        }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* KPI Row */}
      <div className="flex gap-2.5 px-5 py-3 shrink-0">
        <KpiCard value={`${stats.mappedFlights}`} label="Mapped Flights" isDark={isDark} palette={palette} />
        <KpiCard value={`${stats.routeCount}`} label="Routes Covered" isDark={isDark} palette={palette} />
        <KpiCard
          value={stats.weeklySeats > 0 ? stats.weeklySeats.toLocaleString() : '\u2014'}
          label="Weekly Partner Seats"
          isDark={isDark}
          palette={palette}
        />
        <KpiCard
          value={AGREEMENT_TYPE_LABELS[agreement.agreementType]}
          label="Agreement Type"
          textValue
          isDark={isDark}
          palette={palette}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <button
          type="button"
          onClick={onAddMapping}
          className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors hover:opacity-90"
          style={{ background: accent, color: '#ffffff' }}
        >
          <Plus size={14} />
          Add mapping
        </button>
        <button
          type="button"
          onClick={onBulkImport}
          className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${glassBorder}`,
            color: palette.textSecondary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = palette.text
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = palette.textSecondary
          }}
        >
          <Upload size={14} />
          Bulk import
        </button>
        <div className="flex-1" />
        <span className="text-[13px]" style={{ color: palette.textSecondary }}>
          {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => onSwitchTab('ssim')}
          className="h-8 px-3.5 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${glassBorder}`,
            color: palette.textSecondary,
          }}
        >
          <Download size={14} />
          Export SSIM
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr
              className="sticky top-0 z-10"
              style={{ background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)' }}
            >
              <th className="w-9 px-3 py-2" />
              <SortTh
                col="operating"
                label="Operating flt"
                sortCol={sortCol}
                sortAsc={sortAsc}
                onClick={toggleSort}
                palette={palette}
              />
              <SortTh
                col="marketing"
                label="Marketing flt"
                sortCol={sortCol}
                sortAsc={sortAsc}
                onClick={toggleSort}
                palette={palette}
              />
              <SortTh
                col="route"
                label="Route"
                sortCol={sortCol}
                sortAsc={sortAsc}
                onClick={toggleSort}
                palette={palette}
              />
              <th
                className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2"
                style={{ color: palette.textTertiary }}
              >
                DOW
              </th>
              <th
                className="text-[13px] font-semibold uppercase tracking-wider text-left px-2.5 py-2"
                style={{ color: palette.textTertiary }}
              >
                Type
              </th>
              <SortTh
                col="effective"
                label="Effective"
                sortCol={sortCol}
                sortAsc={sortAsc}
                onClick={toggleSort}
                palette={palette}
              />
              <SortTh
                col="status"
                label="Status"
                sortCol={sortCol}
                sortAsc={sortAsc}
                onClick={toggleSort}
                palette={palette}
              />
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const health = (healthMap[m._id] || 'valid') as MappingHealth
              const hi = HEALTH_INDICATORS[health]
              const sc = STATUS_COLORS[m.status] || STATUS_COLORS.pending

              return (
                <tr
                  key={m._id}
                  onClick={() => onEditMapping(m)}
                  className="h-10 cursor-pointer transition-colors duration-150"
                  style={{ borderBottom: `1px solid ${glassBorder}` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Health dot */}
                  <td className="px-3">
                    <span
                      className="w-[7px] h-[7px] rounded-full inline-block"
                      style={{ background: hi.color }}
                      title={hi.title}
                    />
                    {health !== 'valid' && (
                      <AlertTriangle
                        size={13}
                        className="inline-block ml-1 -mt-0.5"
                        style={{ color: hi.color }}
                        title={hi.title}
                      />
                    )}
                  </td>

                  {/* Operating flight */}
                  <td className="px-2.5">
                    <span className="font-mono text-[13px] font-semibold" style={{ color: accent }}>
                      {operatorCode} {m.operatingFlightNumber}
                    </span>
                  </td>

                  {/* Marketing flight */}
                  <td className="px-2.5">
                    <span className="font-mono text-[13px] font-semibold" style={{ color: accent }}>
                      {agreement.partnerAirlineCode} {m.marketingFlightNumber}
                    </span>
                  </td>

                  {/* Route */}
                  <td className="px-2.5">
                    <span className="font-mono text-[13px]" style={{ color: palette.textSecondary }}>
                      {m.departureIata}
                      <span className="mx-1 opacity-40">&rarr;</span>
                      {m.arrivalIata}
                    </span>
                  </td>

                  {/* DOW */}
                  <td className="px-2.5">
                    <DowPillsReadonly value={m.daysOfOperation} isDark={isDark} accent={accent} />
                  </td>

                  {/* Type chip */}
                  <td className="px-2.5">
                    <span
                      className="text-[13px] font-medium px-2 py-0.5 rounded-lg"
                      style={typeChipStyle(agreement.agreementType)}
                    >
                      {AGREEMENT_TYPE_LABELS[agreement.agreementType]}
                    </span>
                  </td>

                  {/* Effective dates */}
                  <td className="px-2.5">
                    <span className="font-mono text-[13px]" style={{ color: palette.textSecondary }}>
                      {formatDateShort(m.effectiveFrom)}
                      {m.effectiveUntil ? ` \u2013 ${formatDateShort(m.effectiveUntil)}` : ' \u2013'}
                    </span>
                  </td>

                  {/* Status badge */}
                  <td className="px-2.5">
                    <span
                      className="text-[13px] font-semibold px-2 py-0.5 rounded-lg"
                      style={{ background: sc.bg, color: sc.text }}
                    >
                      {statusLabel(m.status)}
                    </span>
                  </td>

                  {/* Delete */}
                  <td className="px-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(m._id)
                      }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors duration-150"
                      style={{ color: palette.textTertiary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,59,59,0.1)'
                        e.currentTarget.style.color = '#FF3B3B'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = palette.textTertiary
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-[13px] py-12" style={{ color: palette.textTertiary }}>
                  No flight mappings yet. Click &quot;Add mapping&quot; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sub-components ──

function KpiCard({
  value,
  label,
  textValue,
  isDark,
  palette,
}: {
  value: string
  label: string
  textValue?: boolean
  isDark: boolean
  palette: ReturnType<typeof colors.dark & typeof colors.light>
}) {
  const glassBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  return (
    <div className="flex-1 rounded-xl px-3.5 py-3" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
      <div
        className={`font-bold leading-tight ${textValue ? 'text-[16px]' : 'text-[20px] font-mono'}`}
        style={{ color: palette.text }}
      >
        {value}
      </div>
      <div className="text-[13px] mt-1" style={{ color: palette.textSecondary }}>
        {label}
      </div>
    </div>
  )
}

function SortTh({
  col,
  label,
  sortCol,
  sortAsc,
  onClick,
  palette,
}: {
  col: SortCol
  label: string
  sortCol: SortCol
  sortAsc: boolean
  onClick: (col: SortCol) => void
  palette: any
}) {
  const Icon = sortCol !== col ? ArrowUpDown : sortAsc ? ArrowUp : ArrowDown
  return (
    <th className="text-left px-2.5 py-2">
      <button
        type="button"
        onClick={() => onClick(col)}
        className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider transition-colors duration-150"
        style={{ color: palette.textTertiary }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = palette.text
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = palette.textTertiary
        }}
      >
        {label}
        <Icon size={13} style={{ opacity: sortCol === col ? 1 : 0.3 }} />
      </button>
    </th>
  )
}

function DowPillsReadonly({ value, isDark, accent }: { value: string; isDark: boolean; accent: string }) {
  return (
    <div className="flex gap-0.5">
      {DOW_LABELS.map((lbl, i) => {
        const dayNum = String(i + 1)
        const active = value.includes(dayNum)
        return (
          <span
            key={i}
            className="w-5 h-5 rounded text-[13px] font-medium flex items-center justify-center"
            style={{
              background: active ? accentTint(accent, isDark ? 0.2 : 0.12) : 'transparent',
              color: active ? accent : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            }}
          >
            {lbl}
          </span>
        )
      })}
    </div>
  )
}
