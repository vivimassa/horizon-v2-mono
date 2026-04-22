'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Plane,
  PlaneTakeoff,
  CalendarDays,
  Clock,
  Moon,
  Gauge,
  BedDouble,
  ArrowRightCircle,
  MapPin,
  Users as UsersIcon,
  UserX,
  Timer,
  Wrench,
  HelpCircle,
} from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore, resolveComplementCounts } from '@/stores/use-pairing-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { COMPLEMENT_TEMPLATES, POSITION_DEFAULT_COLORS } from '@skyhub/logic'
import type { CrewPositionRef } from '@skyhub/api'
import { usePairingLegality, useFdtlRuleSet } from '../use-pairing-legality'
import { PairingStatusBadge } from '../shared/pairing-status-badge'
import type { Pairing, PairingFlight, PairingLegMeta } from '../types'
import {
  computeDhcHours,
  computeEfficiency,
  computeNightHours,
  computeRouteId,
  computeTafb,
  deriveOperatingDates,
  formatCrewComplement,
  formatDMY,
  formatNextPossibleDuty,
  minutesToHM,
  resolvePairingFlights,
  resolveRequiredRestMinutes,
} from '../lib/pairing-metrics'

const ACCENT = '#7c3aed'

interface PairingDetailsDialogProps {
  pairing: Pairing
  onClose: () => void
  /**
   * When the dialog is opened from a parent group card (summarising every
   * replica of the same pairing pattern), pass the aggregate span + SSIM
   * day-of-week pattern. The header then replaces the single-day `DATE`
   * chip with a `PERIOD` range and a `FREQUENCY` chip.
   */
  periodOverride?: {
    startDate: string
    endDate: string
    frequency: string
    replicaCount: number
  }
  /**
   * Optional list of crew currently assigned to this pairing. When supplied
   * (e.g. from 4.1.6 Crew Schedule where assignments are live), renders a
   * real "Crew Assigned" list instead of the placeholder panel.
   */
  assignedCrew?: AssignedCrewRow[]
}

export interface AssignedCrewRow {
  crewId: string
  firstName: string
  lastName: string
  employeeId: string
  positionCode: string
  positionColor?: string | null
  baseLabel?: string | null
  seniority?: number | null
  status?: string
}

/**
 * Read-only modal showing every operational metric for a pairing plus the
 * list of legs and assigned crew. Ported in content from AIMS' "Details for
 * Crew Route" dialog, re-styled to SkyHub glass aesthetic.
 */
export function PairingDetailsDialog({ pairing, onClose, periodOverride, assignedCrew }: PairingDetailsDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const pool = usePairingStore((s) => s.flights)
  const complements = usePairingStore((s) => s.complements)
  const positions = usePairingStore((s) => s.positions)
  const pairingFlights = useMemo(() => resolvePairingFlights(pairing, pool), [pairing, pool])

  const { data: ruleSet } = useFdtlRuleSet()
  const { result: legality } = usePairingLegality(pairingFlights, {
    complementKey: pairing.complementKey as 'standard' | 'aug1' | 'aug2' | 'custom',
    facilityClass: pairing.facilityClass ?? undefined,
    cockpitCount: pairing.cockpitCount,
    homeBase: pairing.baseAirport,
    deadheadIds: new Set(pairing.deadheadFlightIds),
  })

  // ── Derived metrics ─────────────────────────────────────────────────
  const blockMin = pairing.totalBlockMinutes
  const dutyMin = pairing.totalDutyMinutes
  const dhcMin = computeDhcHours(pairing)
  const nightMin = computeNightHours(pairing)
  const tafbMin = computeTafb(pairing, ruleSet ?? null)
  const efficiency = computeEfficiency(blockMin, tafbMin)
  const requiredRestMin = resolveRequiredRestMinutes(ruleSet ?? null, dutyMin)
  const nextPossibleDuty = formatNextPossibleDuty(pairing, ruleSet ?? null)
  const routeId = computeRouteId(pairing)
  // FDP — extract from the first FDP check the engine emitted.
  const fdpCheck = legality.checks.find(
    (c) => c.label === 'Flight Duty Period' || c.label.toUpperCase().includes('FDP'),
  )
  const fdpDisplay = fdpCheck?.actual ?? minutesToHM(Math.max(0, dutyMin - 30)) // rough fallback
  const aircraftType =
    pairing.aircraftTypeIcao ?? pairingFlights[0]?.aircraftType ?? pairing.legs[0]?.aircraftTypeIcao ?? '—'

  // Crew complement resolution — prefer what was stored on the pairing, fall
  // back to the 5.4.3 catalog so older pairings (created before auto-fill was
  // wired) still render the correct breakdown.
  //
  // We filter the resolved map to positions that are currently active in 5.4.2
  // because seeded complements may still contain codes for positions that have
  // since been retired (e.g. an operator who started with PS/FA and later
  // switched to PU/CA only — the old counts linger in the document but must
  // not surface to the user, just like the admin screen filters them out).
  const resolvedCrewCounts = useMemo(() => {
    const raw =
      pairing.crewCounts ??
      resolveComplementCounts(
        complements,
        pairing.aircraftTypeIcao ?? pairing.legs[0]?.aircraftTypeIcao ?? null,
        pairing.complementKey,
      )
    if (!raw) return null
    if (positions.length === 0) return raw
    const activeCodes = new Set(positions.filter((p) => p.isActive !== false).map((p) => p.code))
    const filtered: Record<string, number> = {}
    for (const [code, n] of Object.entries(raw)) {
      if (activeCodes.has(code) && n > 0) filtered[code] = n
    }
    return filtered
  }, [pairing, complements, positions])
  const complementStr = formatCrewComplement(resolvedCrewCounts)
  const complementTotal = useMemo(
    () => (resolvedCrewCounts ? Object.values(resolvedCrewCounts).reduce((s, n) => s + (n || 0), 0) : 0),
    [resolvedCrewCounts],
  )
  const complementTemplate = COMPLEMENT_TEMPLATES.find((t) => t.key === pairing.complementKey)

  // ── Styling ─────────────────────────────────────────────────────────
  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const subtleBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)'

  const crewCount = assignedCrew?.length ?? 0
  const [timeMode, setTimeMode] = useState<'local' | 'utc'>('utc')
  // Operator timezone (IANA) from Settings → Admin → Operator Config. Used
  // to convert the stored UTC leg times into the operator's local display.
  const operatorTz = useOperatorStore((s) => s.operator?.timezone ?? 'UTC')
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  // The pairing workspace shell doesn't seed the operator store, so without
  // this the dialog would fall back to UTC and the toggle would do nothing.
  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{
        background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'pd-fade-in 0.18s ease-out',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <style>{`@keyframes pd-fade-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }`}</style>
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: 1000,
          maxHeight: '92vh',
          borderRadius: 24,
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          backdropFilter: 'blur(18px)',
          boxShadow: isDark
            ? '0 24px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.04)'
            : '0 24px 80px rgba(15,23,42,0.18), 0 0 0 0.5px rgba(0,0,0,0.06)',
          animation: 'pd-fade-in 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-6 pt-4 pb-3"
          style={{
            borderBottom: `1px solid ${divider}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.50)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <h2
              className="text-[22px] font-bold tabular-nums"
              style={{ color: ACCENT, letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              {pairing.pairingCode}
            </h2>
            {/* Prefer the LIVE legality result (which includes soft rules
                like 4.1.5.4 aircraft-change ground time) over the stored
                status, so a pairing that was 'legal' at save time but falls
                below a newly-configured soft threshold surfaces the warning
                here instead of silently passing. */}
            <PairingStatusBadge
              status={
                legality.overallStatus === 'pass'
                  ? 'legal'
                  : legality.overallStatus === 'warning'
                    ? 'warning'
                    : 'violation'
              }
              size="md"
            />
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-lg transition-colors hover:opacity-90"
              style={{
                width: 30,
                height: 30,
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                color: textMuted,
              }}
              aria-label="Close"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <MetaChip
              icon={<MapPin size={11} strokeWidth={2.2} />}
              label="Base"
              value={pairing.baseAirport || '—'}
              isDark={isDark}
            />
            <MetaChip
              icon={<Plane size={11} strokeWidth={2.2} />}
              label="Aircraft"
              value={aircraftType}
              isDark={isDark}
            />
            {periodOverride ? (
              <>
                <MetaChip
                  icon={<CalendarDays size={11} strokeWidth={2.2} />}
                  label={`Period · ${periodOverride.replicaCount} Instances`}
                  value={`${formatDMY(periodOverride.startDate)} → ${formatDMY(periodOverride.endDate)}`}
                  isDark={isDark}
                />
                <MetaChip
                  icon={<CalendarDays size={11} strokeWidth={2.2} />}
                  label="Frequency"
                  value={periodOverride.frequency || '—'}
                  isDark={isDark}
                />
              </>
            ) : (
              <MetaChip
                icon={<CalendarDays size={11} strokeWidth={2.2} />}
                label={pairing.pairingDays > 1 ? `${pairing.pairingDays}-day` : 'Date'}
                value={
                  pairing.startDate === pairing.endDate
                    ? formatDMY(pairing.startDate)
                    : `${formatDMY(pairing.startDate)} → ${formatDMY(pairing.endDate)}`
                }
                isDark={isDark}
              />
            )}
          </div>
        </div>

        {/* ── Body (scrollable) ─────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-5 space-y-5">
          {/* Legs table */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionHeader
                icon={<PlaneTakeoff size={13} strokeWidth={2} />}
                label="Flight Legs"
                count={pairing.legs.length}
                isDark={isDark}
              />
              <TimeModeToggle mode={timeMode} onChange={setTimeMode} isDark={isDark} />
            </div>
            <LegsTable
              pairing={pairing}
              pairingFlights={pairingFlights}
              timeMode={timeMode}
              operatorTz={operatorTz}
              isDark={isDark}
            />
          </section>

          {/* Summary grid — 4 columns, 3 rows */}
          <section>
            <SectionHeader icon={<Gauge size={13} strokeWidth={2} />} label="Summary" isDark={isDark} />
            <div className="grid grid-cols-4 gap-2 mt-3">
              {/* Row 1 — durations */}
              <MetricTile icon={<Clock size={13} />} label="Block Time" value={minutesToHM(blockMin)} isDark={isDark} />
              <MetricTile icon={<Timer size={13} />} label="Duty Time" value={minutesToHM(dutyMin)} isDark={isDark} />
              <MetricTile icon={<Clock size={13} />} label="FDP" value={fdpDisplay} isDark={isDark} />
              <MetricTile
                icon={<Plane size={13} />}
                label="Flight Time"
                value={minutesToHM(blockMin)}
                isDark={isDark}
              />

              {/* Row 2 — composition & quality */}
              <MetricTile icon={<UserX size={13} />} label="DHC Hours" value={minutesToHM(dhcMin)} isDark={isDark} />
              <MetricTile icon={<Moon size={13} />} label="Night Hours" value={minutesToHM(nightMin)} isDark={isDark} />
              <MetricTile
                icon={<Gauge size={13} />}
                label="Efficiency"
                value={efficiency > 0 ? efficiency.toFixed(2) : '—'}
                isDark={isDark}
                help={
                  "Block ÷ TAFB — how much of the crew's time away from base was spent flying vs sitting on the ground.\n\n" +
                  '• Block = total flight time (OOOI) across every leg.\n' +
                  '• TAFB = report time on the first leg through debrief on the last — the full "away from base" clock.\n\n' +
                  'A value of 1.00 would mean every minute away was flown (never happens). 0.50 means the crew sat on the ground as long as they flew. Higher = more productive pairing.'
                }
              />
              <MetricTile icon={<Timer size={13} />} label="TAFB" value={minutesToHM(tafbMin)} isDark={isDark} />

              {/* Row 3 — rest / next / identifiers */}
              <MetricTile
                icon={<BedDouble size={13} />}
                label="Required Rest"
                value={minutesToHM(requiredRestMin)}
                isDark={isDark}
              />
              <MetricTile
                icon={<ArrowRightCircle size={13} />}
                label="Next Possible Duty"
                value={nextPossibleDuty}
                isDark={isDark}
              />
              <MetricTile icon={<MapPin size={13} />} label="Route ID" value={routeId} isDark={isDark} mono />
              <MetricTile
                icon={<UsersIcon size={13} />}
                label="Crew Complement"
                value={complementStr}
                isDark={isDark}
                mono
              />
            </div>
          </section>

          {/* Crew Complement panel intentionally removed — the Summary grid
               above already surfaces the full template + seat breakdown
               (e.g. `1CP 1FO 1PU 3CA`), so the redundant panel added noise. */}

          {/* Crew list — live when `assignedCrew` is provided (4.1.6); otherwise
               a gentle placeholder for contexts without access to the roster. */}
          <section>
            <SectionHeader
              icon={<UsersIcon size={13} strokeWidth={2} />}
              label="Crew Assigned"
              count={crewCount}
              isDark={isDark}
            />
            {assignedCrew && assignedCrew.length > 0 ? (
              <AssignedCrewList
                rows={assignedCrew}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                textMuted={textMuted}
                divider={divider}
                subtleBg={subtleBg}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center text-center gap-2 py-8 rounded-xl mt-3"
                style={{
                  background: subtleBg,
                  border: `1px solid ${divider}`,
                }}
              >
                <UsersIcon size={22} strokeWidth={1.8} style={{ color: textMuted }} />
                <div className="text-[13px] font-semibold" style={{ color: textPrimary }}>
                  No crew members assigned to this pairing
                </div>
                <div className="text-[11px] max-w-[360px]" style={{ color: textSecondary }}>
                  {assignedCrew
                    ? 'Assign crew from the 4.1.6 Crew Schedule to see them listed here.'
                    : "Crew assignment lives in Roster (4.1.6 Crew Schedule / 3.2.x). Once wired, they'll appear here with seniority, base, AC qualification and position."}
                </div>
                {!assignedCrew && (
                  <div
                    className="mt-2 inline-flex items-center gap-1.5 px-2 h-5 rounded text-[11px] font-semibold"
                    style={{
                      background: `${ACCENT}14`,
                      color: ACCENT,
                      border: `1px solid ${ACCENT}33`,
                    }}
                  >
                    <Wrench size={10} strokeWidth={2.2} />
                    Coming next
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-end gap-2 px-6 py-4"
          style={{
            borderTop: `1px solid ${divider}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: ACCENT,
              color: '#fff',
              boxShadow: `0 4px 14px ${ACCENT}55`,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Render the live "Crew Assigned" roster for the pairing. Rows are grouped
 *  by position so cockpit crew cluster before cabin crew, matching how the
 *  4.1.5.2 Crew Complement block orders its pills. */
function AssignedCrewList({
  rows,
  textPrimary,
  textSecondary,
  textMuted,
  divider,
  subtleBg,
}: {
  rows: AssignedCrewRow[]
  textPrimary: string
  textSecondary: string
  textMuted: string
  divider: string
  subtleBg: string
}) {
  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ background: subtleBg, border: `1px solid ${divider}` }}>
      <table className="w-full text-[13px] tabular-nums border-collapse">
        <thead>
          <tr style={{ borderBottom: `1px solid ${divider}` }}>
            <th
              className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: textMuted }}
            >
              Pos
            </th>
            <th
              className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: textMuted }}
            >
              Name
            </th>
            <th
              className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: textMuted }}
            >
              Employee ID
            </th>
            <th
              className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: textMuted }}
            >
              Base
            </th>
            <th
              className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: textMuted }}
            >
              Sen.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.crewId} style={i < rows.length - 1 ? { borderBottom: `1px solid ${divider}` } : undefined}>
              <td className="px-3 py-2">
                <span
                  className="inline-flex items-center h-[22px] px-2 rounded-md text-[12px] font-bold tabular-nums"
                  style={{
                    background: r.positionColor ? `${r.positionColor}22` : 'rgba(124,58,237,0.14)',
                    color: r.positionColor ?? '#7c3aed',
                    border: `1px solid ${r.positionColor ?? '#7c3aed'}33`,
                  }}
                >
                  {r.positionCode}
                </span>
              </td>
              <td className="px-3 py-2 font-semibold" style={{ color: textPrimary }}>
                {r.lastName} {r.firstName}
              </td>
              <td className="px-3 py-2" style={{ color: textSecondary }}>
                {r.employeeId}
              </td>
              <td className="px-3 py-2" style={{ color: textSecondary }}>
                {r.baseLabel ?? '—'}
              </td>
              <td className="px-3 py-2 text-right" style={{ color: textSecondary }}>
                {r.seniority != null ? r.seniority : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Small visual primitives ──────────────────────────────────────────

// Compact header-row metadata chip: tiny uppercase label + value, wrapped in
// a subtle rounded pill so the row reads as a group of tags rather than a
// pipe-delimited sentence.
function MetaChip({
  icon,
  label,
  value,
  isDark,
  truncate = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  isDark: boolean
  truncate?: boolean
}) {
  const bg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(71,85,105,0.65)'
  const valueColor = isDark ? '#F5F2FD' : '#1C1C28'
  const iconColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.70)'
  return (
    <span
      className={`inline-flex items-center gap-2 h-7 pl-2 pr-2.5 rounded-full ${truncate ? 'min-w-0 max-w-full' : ''}`}
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span style={{ color: iconColor }}>{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: labelColor }}>
        {label}
      </span>
      <span
        className={`text-[13px] font-semibold tabular-nums ${truncate ? 'truncate' : ''}`}
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </span>
  )
}

function SectionHeader({
  icon,
  label,
  count,
  isDark,
}: {
  icon?: React.ReactNode
  label: string
  count?: number
  isDark: boolean
}) {
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
  return (
    <div className="flex items-center gap-2">
      {icon && <span style={{ color: textMuted }}>{icon}</span>}
      <span className="text-[13px] font-semibold" style={{ color: textPrimary }}>
        {label}
      </span>
      {typeof count === 'number' && (
        <span
          className="inline-flex items-center justify-center rounded-md px-2 text-[11px] font-bold tabular-nums"
          style={{ background: chipBg, color: textMuted, height: 19 }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

function TimeModeToggle({
  mode,
  onChange,
  isDark,
}: {
  mode: 'local' | 'utc'
  onChange: (m: 'local' | 'utc') => void
  isDark: boolean
}) {
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : '#fff'
  const trackBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
  const activeText = isDark ? '#F5F2FD' : '#1C1C28'
  const inactiveText = isDark ? '#8F90A6' : '#8F90A6'
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: trackBg }}>
      {(['local', 'utc'] as const).map((v) => {
        const active = mode === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="px-2.5 h-6 rounded-md text-[11px] font-bold tracking-[0.05em] uppercase transition-all"
            style={{
              background: active ? activeBg : 'transparent',
              color: active ? activeText : inactiveText,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}

function MetricTile({
  icon,
  label,
  value,
  isDark,
  wide = false,
  mono = false,
  help,
}: {
  icon: React.ReactNode
  label: string
  value: string
  isDark: boolean
  wide?: boolean
  mono?: boolean
  /** Optional explainer — renders a small `(?)` after the label with a hover tooltip. */
  help?: string
}) {
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const tileBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
  return (
    <div
      className={`rounded-lg px-3 py-2.5 ${wide ? 'col-span-2' : ''}`}
      style={{ background: tileBg, border: `1px solid ${border}` }}
    >
      <div
        className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.10em] uppercase mb-1"
        style={{ color: textMuted }}
      >
        {icon}
        {label}
        {help && (
          <Tooltip content={help} multiline maxWidth={300}>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full transition-colors"
              style={{
                width: 14,
                height: 14,
                marginLeft: 2,
                color: textMuted,
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Learn more about ${label}`}
            >
              <HelpCircle size={10} strokeWidth={2.2} />
            </button>
          </Tooltip>
        )}
      </div>
      <div
        className={`text-[15px] font-bold ${mono ? 'tabular-nums' : ''}`}
        style={{
          color: textPrimary,
          fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function LegsTable({
  pairing,
  pairingFlights,
  timeMode,
  operatorTz,
  isDark,
}: {
  pairing: Pairing
  pairingFlights: PairingFlight[]
  timeMode: 'local' | 'utc'
  operatorTz: string
  isDark: boolean
}) {
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const headerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
  const footerBg = isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.04)'

  const sortedLegs = [...pairing.legs].sort((a, b) => a.legOrder - b.legOrder)
  // Forward-chain the operating dates so legs past UTC midnight render on the
  // correct day even when the scheduled flight keeps them same-anchor-day.
  const { dates: operatingDates, stdIsoShifted, staIsoShifted } = deriveOperatingDates(sortedLegs)
  // V1 convention: Totals excludes deadhead legs so the number matches the
  // "operational block hours" crew was actually paid for / flew.
  const dhSet = new Set(pairing.deadheadFlightIds)
  const operationalBlock = sortedLegs.reduce((sum, l) => {
    const isDhc = l.isDeadhead || dhSet.has(l.flightId)
    return isDhc ? sum : sum + (l.blockMinutes ?? 0)
  }, 0)
  const dhcBlock = sortedLegs.reduce((sum, l) => {
    const isDhc = l.isDeadhead || dhSet.has(l.flightId)
    return isDhc ? sum + (l.blockMinutes ?? 0) : sum
  }, 0)

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${border}` }}>
      <table
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}
      >
        <thead style={{ background: headerBg }}>
          <tr style={{ height: 28 }}>
            <Th width="6%" isDark={isDark}>
              #
            </Th>
            <Th width="10%" isDark={isDark}>
              DATE
            </Th>
            <Th width="9%" isDark={isDark}>
              FLIGHT
            </Th>
            <Th width="7%" isDark={isDark}>
              DEP
            </Th>
            <Th width="7%" isDark={isDark}>
              ARR
            </Th>
            <Th width="7%" isDark={isDark}>
              STD
            </Th>
            <Th width="7%" isDark={isDark}>
              STA
            </Th>
            <Th width="7%" isDark={isDark}>
              BLOCK
            </Th>
            <Th width="11%" isDark={isDark}>
              TAIL
            </Th>
            <Th width="7%" isDark={isDark}>
              DHC
            </Th>
          </tr>
        </thead>
        <tbody>
          {sortedLegs.map((leg, i) => {
            const f = pairingFlights.find((x) => x.id === leg.flightId)
            const isDhc = leg.isDeadhead || pairing.deadheadFlightIds.includes(leg.flightId)
            // Layover marker between chained legs when the ground gap is ≥6h
            // (overnight / long rest). Matches the 4.1.6 right-panel heuristic.
            const prev = i > 0 ? sortedLegs[i - 1] : null
            const layover = (() => {
              if (!prev) return null
              if (prev.arrStation !== leg.depStation) return null
              const prevStaIso = staIsoShifted[i - 1] ?? prev.staUtc
              const curStdIso = stdIsoShifted[i] ?? leg.stdUtc
              if (!prevStaIso || !curStdIso) return null
              const gapMin = Math.round((new Date(curStdIso).getTime() - new Date(prevStaIso).getTime()) / 60_000)
              if (gapMin < 6 * 60) return null
              return { station: leg.depStation, gapMin }
            })()
            return (
              <Fragment key={leg.flightId}>
                {layover && (
                  <tr style={{ height: 26, background: isDark ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.04)' }}>
                    <td
                      colSpan={10}
                      className="px-2"
                      style={{
                        fontSize: 11,
                        lineHeight: '26px',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-px flex-1"
                          style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)' }}
                        />
                        <span className="font-bold uppercase tracking-[0.08em]" style={{ color: ACCENT, fontSize: 11 }}>
                          Layover · {layover.station} ·{' '}
                          {`${Math.floor(layover.gapMin / 60)}:${String(layover.gapMin % 60).padStart(2, '0')}`}
                        </span>
                        <span
                          className="h-px flex-1"
                          style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)' }}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  style={{
                    height: 28,
                    background:
                      i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.015)') : 'transparent',
                  }}
                >
                  <Td isDark={isDark}>
                    <span style={{ color: textMuted, fontWeight: 600 }}>{i + 1}</span>
                  </Td>
                  <Td isDark={isDark}>
                    {/* Derived via forward-chaining — see deriveOperatingDates. */}
                    <span style={{ color: textPrimary }}>
                      {timeMode === 'local' && stdIsoShifted[i]
                        ? formatDateInTz(stdIsoShifted[i], operatorTz)
                        : formatDMY(operatingDates[i] || leg.flightDate)}
                    </span>
                  </Td>
                  <Td isDark={isDark}>
                    <span style={{ color: textPrimary, fontWeight: 600 }}>{leg.flightNumber}</span>
                  </Td>
                  <Td isDark={isDark}>
                    <span style={{ color: textPrimary }}>{leg.depStation}</span>
                  </Td>
                  <Td isDark={isDark}>
                    <span style={{ color: textPrimary }}>{leg.arrStation}</span>
                  </Td>
                  <Td isDark={isDark}>
                    <span style={{ color: textPrimary }}>
                      {stdIsoShifted[i]
                        ? timeMode === 'local'
                          ? formatTimeInTz(stdIsoShifted[i], operatorTz)
                          : stdIsoShifted[i].slice(11, 16)
                        : (leg.stdUtc ?? '—')}
                    </span>
                  </Td>
                  <Td isDark={isDark}>
                    <span style={{ color: textPrimary }}>
                      {staIsoShifted[i]
                        ? timeMode === 'local'
                          ? formatTimeInTz(staIsoShifted[i], operatorTz)
                          : staIsoShifted[i].slice(11, 16)
                        : (leg.staUtc ?? '—')}
                    </span>
                  </Td>
                  <Td isDark={isDark}>
                    <span style={{ color: textPrimary }}>{minutesToHM(leg.blockMinutes ?? 0)}</span>
                  </Td>
                  <Td isDark={isDark}>
                    <TailCell
                      tail={leg.tailNumber ?? f?.tailNumber ?? null}
                      fallback={leg.aircraftTypeIcao ?? '—'}
                      isDark={isDark}
                    />
                  </Td>
                  <Td isDark={isDark}>
                    {isDhc ? (
                      <span
                        className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold"
                        style={{
                          background: 'rgba(255,136,0,0.14)',
                          color: '#FF8800',
                          border: '1px solid rgba(255,136,0,0.35)',
                        }}
                      >
                        DHC
                      </span>
                    ) : (
                      <span style={{ color: textMuted }}>—</span>
                    )}
                  </Td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
        <tfoot style={{ background: footerBg }}>
          <tr style={{ height: 30 }}>
            <Td isDark={isDark}>
              <span
                style={{
                  color: textMuted,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Totals
              </span>
            </Td>
            <Td isDark={isDark}>
              <span style={{ color: textMuted }}>{sortedLegs.length} legs</span>
            </Td>
            <Td isDark={isDark}>
              <span style={{ color: textMuted }}>—</span>
            </Td>
            <Td isDark={isDark}>
              <span style={{ color: textMuted }}>—</span>
            </Td>
            <Td isDark={isDark}>
              <span style={{ color: textMuted }}>—</span>
            </Td>
            <Td isDark={isDark}>
              <span style={{ color: textMuted }}>—</span>
            </Td>
            <Td isDark={isDark}>
              <span style={{ color: textMuted }}>—</span>
            </Td>
            <Td isDark={isDark}>
              <span
                style={{
                  color: ACCENT,
                  fontWeight: 700,
                }}
              >
                {minutesToHM(operationalBlock)}
              </span>
            </Td>
            <Td isDark={isDark}>
              <span style={{ color: textMuted }}>—</span>
            </Td>
            <Td isDark={isDark}>
              {dhcBlock > 0 ? (
                <span style={{ color: '#FF8800', fontWeight: 700 }}>{minutesToHM(dhcBlock)}</span>
              ) : (
                <span style={{ color: textMuted }}>—</span>
              )}
            </Td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function TailCell({ tail, fallback, isDark }: { tail: string | null; fallback: string; isDark: boolean }) {
  if (tail) {
    return (
      <span
        className="px-1.5 h-5 inline-flex items-center rounded text-[11px] font-bold tabular-nums"
        style={{
          background: isDark ? 'rgba(124,58,237,0.14)' : 'rgba(124,58,237,0.08)',
          color: ACCENT,
          border: `1px solid ${ACCENT}33`,
        }}
      >
        {tail}
      </span>
    )
  }
  return (
    <span className="text-[11px]" style={{ color: isDark ? '#8F90A6' : '#8F90A6' }}>
      {fallback}
    </span>
  )
}

function Th({ children, width, isDark }: { children: React.ReactNode; width?: string; isDark: boolean }) {
  return (
    <th
      className="text-left px-2"
      style={{
        width,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: isDark ? '#8F90A6' : '#555770',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <td
      className="px-2"
      style={{
        fontSize: 12,
        lineHeight: '28px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
      }}
    >
      {children}
    </td>
  )
}

// ── Operator-timezone formatters ─────────────────────────────────────
// Uses the operator's IANA timezone from Settings → Admin → Operator Config.
// Falls back to UTC slicing when the timezone is invalid or Intl fails.
function formatTimeInTz(utcIso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(utcIso))
  } catch {
    return utcIso.slice(11, 16)
  }
}

function formatDateInTz(utcIso: string, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(utcIso))
    const day = parts.find((p) => p.type === 'day')?.value ?? '--'
    const month = parts.find((p) => p.type === 'month')?.value ?? '--'
    const year = parts.find((p) => p.type === 'year')?.value ?? '----'
    return `${day}/${month}/${year}`
  } catch {
    return formatDMY(utcIso.slice(0, 10))
  }
}

// ── Crew Complement panel ───────────────────────────────────────────
// Renders the per-position breakdown (CP/FO/PU/CA/…) for the pairing's
// selected complement template. Order: cockpit positions first by rankOrder,
// then cabin positions by rankOrder, then any extra unknown codes (so custom
// operator positions still surface). Source of truth: `pairing.crewCounts`
// when stored, else the 5.4.3 catalog lookup from the pairing store.

function CrewComplementPanel({
  counts,
  total,
  positions,
  templateLabel,
  templateBadge,
  templateBadgeColor,
  isDark,
}: {
  counts: Record<string, number> | null
  total: number
  positions: CrewPositionRef[]
  templateLabel: string
  templateBadge: string
  templateBadgeColor: string
  isDark: boolean
}) {
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const subtleBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  if (!counts || total === 0) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl mt-3"
        style={{ background: subtleBg, border: `1px solid ${border}` }}
      >
        <UsersIcon size={14} strokeWidth={1.8} style={{ color: textMuted }} />
        <span className="text-[12px]" style={{ color: textSecondary }}>
          No complement configured for this aircraft type. Set it up in Admin → Crew Complements.
        </span>
      </div>
    )
  }

  // Build the ordered list: known positions (cockpit first, then cabin) by
  // rankOrder, then any unknown codes from the counts map.
  const cockpit = positions.filter((p) => p.category === 'cockpit').sort((a, b) => a.rankOrder - b.rankOrder)
  const cabin = positions.filter((p) => p.category === 'cabin').sort((a, b) => a.rankOrder - b.rankOrder)
  const knownCodes = new Set([...cockpit, ...cabin].map((p) => p.code))
  const extras = Object.keys(counts).filter((c) => !knownCodes.has(c) && (counts[c] ?? 0) > 0)

  const cockpitItems = cockpit.filter((p) => (counts[p.code] ?? 0) > 0)
  const cabinItems = cabin.filter((p) => (counts[p.code] ?? 0) > 0)

  return (
    <div className="mt-3 rounded-xl px-3 py-3" style={{ background: subtleBg, border: `1px solid ${border}` }}>
      {/* Template header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="px-2 h-5 inline-flex items-center rounded text-[10px] font-bold tracking-[0.06em]"
          style={{
            background: `${templateBadgeColor}22`,
            color: templateBadgeColor,
            border: `1px solid ${templateBadgeColor}55`,
          }}
        >
          {templateBadge}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: textPrimary }}>
          {templateLabel}
        </span>
        <span className="flex-1" />
        <span
          className="text-[11px] font-semibold tabular-nums px-2 h-5 inline-flex items-center rounded"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
            color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(71,85,105,0.90)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'}`,
          }}
        >
          {total} crew
        </span>
      </div>

      {/* Position groups */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {cockpitItems.length > 0 && (
          <PositionGroup label="Flight Deck" labelColor={isDark ? '#60a5fa' : '#2563eb'} isDark={isDark}>
            {cockpitItems.map((p) => (
              <PositionPill
                key={p.code}
                code={p.code}
                name={p.name}
                count={counts[p.code] ?? 0}
                color={p.color || POSITION_DEFAULT_COLORS[p.code] || '#3b82f6'}
                isDark={isDark}
              />
            ))}
          </PositionGroup>
        )}
        {cabinItems.length > 0 && (
          <PositionGroup label="Cabin Crew" labelColor={isDark ? '#fbbf24' : '#d97706'} isDark={isDark}>
            {cabinItems.map((p) => (
              <PositionPill
                key={p.code}
                code={p.code}
                name={p.name}
                count={counts[p.code] ?? 0}
                color={p.color || POSITION_DEFAULT_COLORS[p.code] || '#f59e0b'}
                isDark={isDark}
              />
            ))}
          </PositionGroup>
        )}
        {extras.length > 0 && (
          <PositionGroup label="Other" labelColor={textMuted} isDark={isDark}>
            {extras.map((code) => (
              <PositionPill
                key={code}
                code={code}
                name={code}
                count={counts[code] ?? 0}
                color={POSITION_DEFAULT_COLORS[code] || '#6b7280'}
                isDark={isDark}
              />
            ))}
          </PositionGroup>
        )}
      </div>
    </div>
  )
}

function PositionGroup({
  label,
  labelColor,
  children,
  isDark: _isDark,
}: {
  label: string
  labelColor: string
  children: React.ReactNode
  isDark: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: labelColor, minWidth: 74 }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function PositionPill({
  code,
  name,
  count,
  color,
  isDark,
}: {
  code: string
  name: string
  count: number
  color: string
  isDark: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 pl-1 pr-2 rounded-md text-[11px] font-semibold tabular-nums"
      title={`${name} × ${count}`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
        color: isDark ? '#F5F2FD' : '#1C1C28',
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded h-4 px-1 text-[10px] font-bold tracking-[0.04em]"
        style={{ background: color, color: '#fff', minWidth: 22 }}
      >
        {code}
      </span>
      × {count}
    </span>
  )
}

// Re-export the leg type for callers that want it
export type { PairingLegMeta }
