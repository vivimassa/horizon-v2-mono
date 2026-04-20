'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Route,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { useOperatorStore } from '@/stores/use-operator-store'
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
}

/**
 * Read-only modal showing every operational metric for a pairing plus the
 * list of legs and assigned crew. Ported in content from AIMS' "Details for
 * Crew Route" dialog, re-styled to SkyHub glass aesthetic.
 */
export function PairingDetailsDialog({ pairing, onClose }: PairingDetailsDialogProps) {
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
  const complementStr = formatCrewComplement(pairing.crewCounts)
  // FDP — extract from the first FDP check the engine emitted.
  const fdpCheck = legality.checks.find(
    (c) => c.label === 'Flight Duty Period' || c.label.toUpperCase().includes('FDP'),
  )
  const fdpDisplay = fdpCheck?.actual ?? minutesToHM(Math.max(0, dutyMin - 30)) // rough fallback
  const aircraftType = pairingFlights[0]?.aircraftType ?? pairing.legs[0]?.aircraftTypeIcao ?? '—'

  // ── Styling ─────────────────────────────────────────────────────────
  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const subtleBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)'

  const crewCount = 0 // MVP — real list arrives with 3.2.x
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
            <PairingStatusBadge status={pairing.status} size="md" />
            {pairing.workflowStatus === 'draft' && (
              <span
                className="text-[11px] font-bold tracking-[0.04em] px-2 py-0.5 rounded-md"
                style={{
                  background: 'rgba(59,130,246,0.14)',
                  color: '#3B82F6',
                  border: '1px solid rgba(59,130,246,0.30)',
                }}
              >
                DRAFT
              </span>
            )}
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
          <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 13, color: textSecondary }}>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
              <span className="tabular-nums">{pairing.baseAirport || '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Plane size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
              <span className="tabular-nums">{aircraftType}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Route size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
              <span className="truncate tabular-nums">{pairing.routeChain || '—'}</span>
            </span>
            <span style={{ opacity: 0.35 }}>|</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
              <span className="tabular-nums">
                {formatDMY(pairing.startDate)} → {formatDMY(pairing.endDate)}
              </span>
            </span>
            <span style={{ opacity: 0.35 }}>|</span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
              <span className="tabular-nums">{complementStr}</span>
            </span>
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

          {/* Crew list — placeholder for 3.2.x */}
          <section>
            <SectionHeader
              icon={<UsersIcon size={13} strokeWidth={2} />}
              label="Crew Assigned"
              count={crewCount}
              isDark={isDark}
            />
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
                Crew assignment lives in Roster (4.1.6 Crew Schedule / 3.2.x). Once wired, they'll appear here with
                seniority, base, AC qualification and position.
              </div>
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
            </div>
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

// ── Small visual primitives ──────────────────────────────────────────

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
}: {
  icon: React.ReactNode
  label: string
  value: string
  isDark: boolean
  wide?: boolean
  mono?: boolean
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
            return (
              <tr
                key={leg.flightId}
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
                  <TailCell tail={f?.tailNumber ?? null} fallback={leg.aircraftTypeIcao ?? '—'} isDark={isDark} />
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

// Re-export the leg type for callers that want it
export type { PairingLegMeta }
