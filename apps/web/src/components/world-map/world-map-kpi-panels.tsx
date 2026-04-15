'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Clock, Fuel, Timer, Users } from 'lucide-react'
import type { WorldMapFlight, KpiMode, OtpKpi, FuelKpi, TatKpi, LoadFactorKpi } from './world-map-types'
import { computeOtpKpi, computeFuelKpi, computeTatKpi, computeLoadFactorKpi } from './world-map-kpi-data'

// ─── Shared ──────────────────────────────────────────────────────

const PANEL =
  'glass-heavy rounded-2xl shadow-xl border border-black/10 dark:border-white/10 px-6 py-4 flex flex-col overflow-hidden relative h-[220px] dark:text-white/90'

const PANEL_GRADIENT =
  'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/40 via-white/10 to-transparent dark:from-white/[0.06] dark:via-white/[0.02] dark:to-transparent'

const HEADER = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-white/60'

// ─── SVG Donut Ring ──────────────────────────────────────────────

function DonutRing({
  value,
  size = 110,
  stroke = 8,
  color,
  trackClass = 'stroke-black/5 dark:stroke-white/10',
  children,
}: {
  value: number // 0-100
  size?: number
  stroke?: number
  color: string
  trackClass?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(value, 100) / 100) * circ

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

// ─── Mini horizontal bar ─────────────────────────────────────────

function MiniBar({ pct, color, label, count }: { pct: number; color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-muted-foreground w-[48px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-[5px] rounded-full bg-black/5 dark:bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground w-[24px] text-right">{count}</span>
    </div>
  )
}

// ─── Semi-circle gauge ───────────────────────────────────────────

function GaugeArc({
  value,
  max,
  size = 100,
  color,
  label,
  displayValue,
}: {
  value: number
  max: number
  size?: number
  color: string
  label: string
  displayValue?: string
}) {
  const stroke = 7
  const r = (size - stroke) / 2
  const halfCirc = Math.PI * r
  const pct = Math.min(value / max, 1)
  const offset = halfCirc - pct * halfCirc

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 12 }}>
      <svg width={size} height={size / 2 + stroke} className="overflow-visible">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-black/5 dark:stroke-white/10"
          strokeDasharray={`${halfCirc} ${halfCirc}`}
          strokeDashoffset={0}
          transform={`rotate(180 ${size / 2} ${size / 2})`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${halfCirc} ${halfCirc}`}
          strokeDashoffset={offset}
          transform={`rotate(180 ${size / 2} ${size / 2})`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-[20px] font-bold leading-none tabular-nums">{displayValue ?? value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

// ─── Vertical bar chart ──────────────────────────────────────────

function VerticalBars({ bars, maxH = 60 }: { bars: { label: string; value: number; color: string }[]; maxH?: number }) {
  const maxVal = Math.max(...bars.map((b) => b.value), 1)
  return (
    <div className="flex items-end gap-1.5 justify-center" style={{ height: maxH + 16 }}>
      {bars.map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-0.5 flex-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">{b.value}</span>
          <div
            className="w-full rounded-t-sm transition-all duration-500 min-w-[8px]"
            style={{
              height: `${Math.max((b.value / maxVal) * maxH, b.value > 0 ? 3 : 1)}px`,
              backgroundColor: b.color,
              opacity: 0.8,
            }}
          />
          <span className="text-[10px] text-muted-foreground truncate max-w-full">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 1. OTP Panel ────────────────────────────────────────────────

function OtpPanel({ data, otpTarget }: { data: OtpKpi; otpTarget: number }) {
  const ringColor = data.otpPercent >= otpTarget ? '#10b981' : data.otpPercent >= otpTarget - 10 ? '#f59e0b' : '#ef4444'

  return (
    <div className={PANEL}>
      <div className={PANEL_GRADIENT} />
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className={HEADER}>On-Time Performance</span>
      </div>

      <div className="flex items-center gap-4 flex-1">
        {/* Donut */}
        <DonutRing value={data.otpPercent} size={130} stroke={10} color={ringColor}>
          <span className="text-[26px] font-bold leading-none tabular-nums">{data.otpPercent.toFixed(0)}%</span>
        </DonutRing>

        {/* Delay breakdown bars */}
        <div className="flex-1 flex flex-col gap-1.5">
          <MiniBar
            pct={(data.onTimeCount / Math.max(data.totalCompleted, 1)) * 100}
            color="#10b981"
            label="On Time"
            count={data.onTimeCount}
          />
          <MiniBar
            pct={(data.delay15to30 / Math.max(data.totalCompleted, 1)) * 100}
            color="#f59e0b"
            label="15-30m"
            count={data.delay15to30}
          />
          <MiniBar
            pct={(data.delay30to60 / Math.max(data.totalCompleted, 1)) * 100}
            color="#f97316"
            label="30-60m"
            count={data.delay30to60}
          />
          <MiniBar
            pct={(data.delay60plus / Math.max(data.totalCompleted, 1)) * 100}
            color="#ef4444"
            label="60m+"
            count={data.delay60plus}
          />

          <div className="flex items-center justify-between mt-auto pt-1 border-t border-black/5 dark:border-white/5">
            <span className="text-[11px] text-muted-foreground">
              Avg delay:{' '}
              <span className="font-medium text-foreground font-mono">
                {Math.floor(data.avgDelayMinutes / 60)}:{String(data.avgDelayMinutes % 60).padStart(2, '0')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2. Fuel Panel ───────────────────────────────────────────────

function FuelPanel({ data, fuelTargetPct }: { data: FuelKpi; fuelTargetPct: number }) {
  const fuelColor =
    Math.abs(data.planVsActualPct) <= Math.abs(fuelTargetPct)
      ? '#10b981'
      : Math.abs(data.planVsActualPct) <= Math.abs(fuelTargetPct) + 2
        ? '#f59e0b'
        : '#ef4444'
  const sign = data.planVsActualPct > 0 ? '+' : ''

  return (
    <div className={PANEL}>
      <div className={PANEL_GRADIENT} />
      <div className="flex items-center gap-1.5">
        <Fuel className="h-3 w-3 text-muted-foreground" />
        <span className={HEADER}>Fuel Management</span>
      </div>

      <div className="flex flex-col gap-3 flex-1 mt-2">
        {/* Hero stats row */}
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-bold leading-none tabular-nums font-mono" style={{ color: fuelColor }}>
              {sign}
              {data.planVsActualPct.toFixed(1)}%
            </span>
            <span className="text-[11px] text-muted-foreground">Plan vs Actual</span>
          </div>
          <div className="flex gap-4 ml-auto">
            <div className="text-center">
              <span className="text-[16px] font-bold tabular-nums leading-none">{data.overBurnCount}</span>
              <p className="text-[10px] text-muted-foreground">Over-burn</p>
            </div>
            <div className="text-center">
              <span className="text-[16px] font-bold tabular-nums leading-none">
                {(data.avgUpliftKg / 1000).toFixed(1)}t
              </span>
              <p className="text-[10px] text-muted-foreground">Avg Uplift</p>
            </div>
          </div>
        </div>

        {/* Fuel tank bars per type — plan (outline) vs actual (fill) */}
        {data.burnByType.length > 0 ? (
          <div className="flex flex-col gap-2.5 flex-1">
            {data.burnByType.map((t) => {
              const diff = t.avgPlan > 0 ? ((t.avgBurn - t.avgPlan) / t.avgPlan) * 100 : 0
              const isOver = diff > 0
              const barColor = Math.abs(diff) <= Math.abs(fuelTargetPct) ? '#10b981' : isOver ? '#ef4444' : '#f59e0b'
              const deviationPct = (Math.min(Math.abs(diff), 20) / 20) * 50
              // Target marker position: from center, offset by target %
              const targetPosPct = 50 + (fuelTargetPct / 20) * 50
              return (
                <div key={t.acType} className="flex items-center gap-2">
                  <span className="text-[11px] font-medium w-[28px] shrink-0">{t.acType}</span>
                  <div className="flex-1 relative h-[14px] rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                    {/* Center plan line */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-black/25 dark:bg-white/35 z-10" />
                    {/* Target threshold line */}
                    <div
                      className="absolute top-[-3px] w-[2px] h-[20px] rounded-full z-10 transition-all duration-500"
                      style={{
                        left: `${targetPosPct}%`,
                        backgroundColor: '#3b82f6',
                        boxShadow: '0 0 4px rgba(59,130,246,0.5)',
                      }}
                    />
                    {/* Deviation fill from center */}
                    {isOver ? (
                      <div
                        className="absolute top-0 bottom-0 left-1/2 rounded-r-full transition-all duration-500"
                        style={{ width: `${deviationPct}%`, backgroundColor: barColor, opacity: 0.6 }}
                      />
                    ) : (
                      <div
                        className="absolute top-0 bottom-0 rounded-l-full transition-all duration-500"
                        style={{ width: `${deviationPct}%`, right: '50%', backgroundColor: barColor, opacity: 0.6 }}
                      />
                    )}
                  </div>
                  <span
                    className={`text-[11px] tabular-nums font-medium w-[36px] text-right ${Math.abs(diff) <= Math.abs(fuelTargetPct) ? 'text-emerald-500 dark:text-emerald-400' : isOver ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}
                  >
                    {diff > 0 ? '+' : ''}
                    {Math.round(diff)}%
                  </span>
                </div>
              )
            })}
            <div className="flex items-center justify-center gap-4 mt-auto pt-1 border-t border-black/5 dark:border-white/5">
              <div className="flex items-center gap-1.5">
                <div className="w-[10px] h-[6px] rounded-sm bg-emerald-500/60" />
                <span className="text-[10px] text-muted-foreground">Under</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[2px] h-[10px] bg-black/25 dark:bg-white/35" />
                <span className="text-[10px] text-muted-foreground">Plan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[10px] h-[6px] rounded-sm bg-red-500/60" />
                <span className="text-[10px] text-muted-foreground">Over</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[11px] text-muted-foreground/50">No fuel data</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 3. TAT Panel ────────────────────────────────────────────────

function TatPanel({ data, tatTargetMin }: { data: TatKpi; tatTargetMin: number }) {
  const tatColor =
    data.avgGroundMinutes <= tatTargetMin
      ? '#10b981'
      : data.avgGroundMinutes <= tatTargetMin + 15
        ? '#f59e0b'
        : '#ef4444'

  const barColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
  const bars = data.distribution.map((d, i) => ({
    label: d.label,
    value: d.count,
    color: barColors[i] ?? '#6b7280',
  }))

  return (
    <div className={PANEL}>
      <div className={PANEL_GRADIENT} />
      <div className="flex items-center gap-1.5">
        <Timer className="h-3 w-3 text-muted-foreground" />
        <span className={HEADER}>Turnaround Monitor</span>
      </div>

      {!data.hasRotationData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <span className="text-[22px] font-bold text-muted-foreground/30">--:--</span>
          <span className="text-[11px] text-muted-foreground/50 text-center">Insufficient rotation data</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 flex-1 mt-2">
          {/* Hero value */}
          <div className="flex items-baseline gap-2">
            <span
              className={`text-[26px] font-bold leading-none tabular-nums font-mono ${tatColor <= '#10b981' ? '' : ''}`}
              style={{ color: tatColor }}
            >
              {Math.floor(data.avgGroundMinutes / 60)}:{String(data.avgGroundMinutes % 60).padStart(2, '0')}
            </span>
            <span className="text-[11px] text-muted-foreground">Average TAT</span>
          </div>

          {/* Timeline ruler */}
          <div className="relative">
            {/* Track */}
            <div className="h-[14px] rounded-full overflow-hidden flex">
              {/* Green zone: 0 to target */}
              <div
                className="h-full bg-emerald-500/50 dark:bg-emerald-400/40"
                style={{ width: `${(tatTargetMin / 120) * 100}%` }}
              />
              {/* Yellow zone: target to target+15 */}
              <div className="h-full bg-amber-500/50 dark:bg-amber-400/40" style={{ width: `${(15 / 120) * 100}%` }} />
              {/* Red zone: rest */}
              <div className="h-full bg-red-500/45 dark:bg-red-400/35 flex-1" />
            </div>
            {/* Blue target line */}
            <div
              className="absolute top-[-4px] w-[2px] h-[22px] rounded-full transition-all duration-700"
              style={{
                left: `${Math.min((tatTargetMin / 120) * 100, 100)}%`,
                backgroundColor: '#3b82f6',
                boxShadow: '0 0 4px rgba(59,130,246,0.5)',
              }}
            />
            {/* Needle marker for avg */}
            <div
              className="absolute top-[-3px] w-[3px] h-[20px] rounded-full transition-all duration-700"
              style={{
                left: `${Math.min((data.avgGroundMinutes / 120) * 100, 100)}%`,
                backgroundColor: tatColor,
                boxShadow: `0 0 6px ${tatColor}80`,
              }}
            />
            {/* Tick labels */}
            <div className="flex justify-between mt-1">
              {[0, 30, 45, 60, 90, 120].map((t) => (
                <span
                  key={t}
                  className="text-[8px] text-muted-foreground/60 tabular-nums"
                  style={{ position: 'absolute', left: `${(t / 120) * 100}%`, transform: 'translateX(-50%)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Spacer for tick labels */}
          <div className="h-1" />

          {/* Distribution bars */}
          <div className="flex flex-col gap-1">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-[42px] shrink-0 truncate">{b.label}</span>
                <div className="flex-1 h-[5px] rounded-full bg-black/5 dark:bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max((b.value / Math.max(...bars.map((x) => x.value), 1)) * 100, b.value > 0 ? 3 : 0)}%`,
                      backgroundColor: b.color,
                      opacity: 0.8,
                    }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground w-[24px] text-right">{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 4. Load Factor Panel ────────────────────────────────────────

function LoadFactorPanel({ data, lfTarget }: { data: LoadFactorKpi; lfTarget: number }) {
  const lfColor = data.fleetAvgLf >= lfTarget ? '#10b981' : data.fleetAvgLf >= lfTarget - 15 ? '#f59e0b' : '#ef4444'

  return (
    <div className={PANEL}>
      <div className={PANEL_GRADIENT} />
      <div className="flex items-center gap-1.5">
        <Users className="h-3 w-3 text-muted-foreground" />
        <span className={HEADER}>Load Factor</span>
      </div>

      <div className="flex items-center gap-4 flex-1">
        {/* Donut */}
        <DonutRing value={data.fleetAvgLf} size={130} stroke={10} color={lfColor}>
          <span className="text-[26px] font-bold leading-none tabular-nums">{data.fleetAvgLf.toFixed(0)}%</span>
        </DonutRing>

        {/* LF by type as visual bars + stats */}
        <div className="flex-1 flex flex-col gap-2">
          {data.lfByType.length > 0 ? (
            <>
              {data.lfByType.map((t) => {
                const c = t.avgLf >= lfTarget ? '#10b981' : t.avgLf >= lfTarget - 15 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={t.acType} className="flex items-center gap-2">
                    <span className="text-[10px] font-medium w-[28px] shrink-0">{t.acType}</span>
                    <div className="flex-1 relative h-[6px] rounded-full bg-black/5 dark:bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(t.avgLf, 100)}%`, backgroundColor: c }}
                      />
                      {/* Target line */}
                      <div
                        className="absolute top-[-3px] w-[2px] h-[12px] rounded-full"
                        style={{
                          left: `${lfTarget}%`,
                          backgroundColor: '#ef4444',
                          boxShadow: '0 0 4px rgba(239,68,68,0.5)',
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums w-[30px] text-right">{t.avgLf.toFixed(0)}%</span>
                  </div>
                )
              })}

              <div className="flex gap-3 mt-auto pt-1 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[11px] text-muted-foreground">
                    &lt;80%: <span className="font-medium text-foreground">{data.below80Count}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-muted-foreground">
                    &gt;95%: <span className="font-medium text-foreground">{data.above95Count}</span>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground/50">No load data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── VisionOS Materialize Wrapper ────────────────────────────────

function MaterializePanel({ index, children }: { index: number; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 60)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <div
      style={{
        width: '340px',
        flexShrink: 0,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
        filter: visible ? 'blur(0px)' : 'blur(8px)',
        transition:
          'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1), filter 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  )
}

// ─── Main KPI Panels Container ──────────────────────────────────

interface WorldMapKpiPanelsProps {
  flights: WorldMapFlight[]
  activeKpis: KpiMode[]
  filterCollapsed: boolean
  otpTarget: number
  lfTarget: number
  tatTargetMin: number
  fuelTargetPct: number
  uiZoom?: number
}

export function WorldMapKpiPanels({
  flights,
  activeKpis,
  filterCollapsed,
  otpTarget,
  lfTarget,
  tatTargetMin,
  fuelTargetPct,
  uiZoom = 1,
}: WorldMapKpiPanelsProps) {
  const otpData = useMemo(() => (activeKpis.includes('otp') ? computeOtpKpi(flights) : null), [flights, activeKpis])
  const fuelData = useMemo(() => (activeKpis.includes('fuel') ? computeFuelKpi(flights) : null), [flights, activeKpis])
  const tatData = useMemo(
    () => (activeKpis.includes('tat') ? computeTatKpi(flights, tatTargetMin) : null),
    [flights, activeKpis, tatTargetMin],
  )
  const lfData = useMemo(
    () => (activeKpis.includes('loadfactor') ? computeLoadFactorKpi(flights) : null),
    [flights, activeKpis],
  )

  // Track panel order for stagger index
  let panelIndex = 0

  return (
    <div
      className="fixed bottom-[60px] z-[60] flex justify-center gap-3 transition-all duration-300"
      style={{
        left: `${filterCollapsed ? 68 : 324}px`,
        right: '16px',
        zoom: uiZoom,
      }}
    >
      {activeKpis.includes('otp') && otpData && (
        <MaterializePanel index={panelIndex++}>
          <OtpPanel data={otpData} otpTarget={otpTarget} />
        </MaterializePanel>
      )}
      {activeKpis.includes('fuel') && fuelData && (
        <MaterializePanel index={panelIndex++}>
          <FuelPanel data={fuelData} fuelTargetPct={fuelTargetPct} />
        </MaterializePanel>
      )}
      {activeKpis.includes('tat') && tatData && (
        <MaterializePanel index={panelIndex++}>
          <TatPanel data={tatData} tatTargetMin={tatTargetMin} />
        </MaterializePanel>
      )}
      {activeKpis.includes('loadfactor') && lfData && (
        <MaterializePanel index={panelIndex++}>
          <LoadFactorPanel data={lfData} lfTarget={lfTarget} />
        </MaterializePanel>
      )}
    </div>
  )
}
