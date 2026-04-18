'use client'

import { useMemo } from 'react'
import { Clock3, CheckCircle2, AlertTriangle, Plane } from 'lucide-react'
import { OccKpiTile } from './occ-kpi-tile'
import type { OccKpis } from './lib/compute-kpis'
import { BandHead } from './lib/occ-helpers'

// synthetic 7d — replace when trend rollups are wired
const OTP_TREND = [83.2, 84.1, 85.0, 85.4, 84.8, 86.2, 86.9]
const CF_TREND = [96.8, 97.2, 96.0, 95.4, 93.1, 92.0, 93.4]
const FLEET_TREND = [93.5, 94.2, 95.1, 95.0, 94.2, 93.8, 93.0]

interface BandNetworkPulseProps {
  kpis: OccKpis
  fleet: { active: number; available: number; aog: number; maintenance: number }
}

export function BandNetworkPulse({ kpis, fleet }: BandNetworkPulseProps) {
  const fleetAvailabilityPct = useMemo(() => (fleet.active > 0 ? (fleet.available / fleet.active) * 100 : 0), [fleet])

  const disruptionSeverity = kpis.disruptions.divert * 3 + kpis.disruptions.airReturn * 2 + kpis.disruptions.rampReturn

  return (
    <section aria-label="Network Pulse" className="h-full flex flex-col">
      <BandHead tag="Network Pulse · 1.1" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 rounded-2xl border border-[rgba(17,17,24,0.16)] dark:border-white/14 overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.12),0_4px_16px_rgba(96,97,112,0.14)] relative backdrop-blur-2xl bg-gradient-to-b from-white/95 to-[#f5f6fa]/90 dark:from-[#191921]/95 dark:to-[#191921]/78 flex-1">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(600px 200px at 20% 0%, color-mix(in srgb, var(--occ-accent) 18%, transparent), transparent 70%), radial-gradient(500px 200px at 80% 100%, rgba(6,194,112,0.08), transparent 70%)',
          }}
        />
        <OccKpiTile
          icon={<Clock3 size={14} />}
          label="OTP (D-15)"
          moduleCode="2.1.1"
          value={kpis.otpPct.toFixed(1)}
          unit="%"
          sparkline={OTP_TREND}
          delta={
            kpis.otpPct > OTP_TREND[OTP_TREND.length - 1]
              ? { tone: 'up', text: `▲ ${(kpis.otpPct - OTP_TREND[OTP_TREND.length - 1]).toFixed(1)} pt vs 7d` }
              : { tone: 'down', text: `▼ ${(OTP_TREND[OTP_TREND.length - 1] - kpis.otpPct).toFixed(1)} pt vs 7d` }
          }
          sub={`• ${kpis.totals.scheduled} flights in window`}
        />
        <OccKpiTile
          icon={<CheckCircle2 size={14} />}
          label="Completion Factor"
          moduleCode="2.1.1"
          value={kpis.completionFactorPct.toFixed(1)}
          unit="%"
          sparkline={CF_TREND}
          sub={
            <>
              <span className="font-mono">
                <b>{kpis.totals.completed}</b>/{kpis.totals.scheduled}
              </span>
              {' • '}
              <b className="font-mono">{kpis.totals.cancelled}</b> cancelled ·{' '}
              <b className="font-mono">{kpis.totals.diverted}</b> diverted
            </>
          }
        />
        <OccKpiTile
          icon={<AlertTriangle size={14} />}
          label="Active Disruptions"
          moduleCode="2.1.3"
          value={String(kpis.disruptions.total)}
          unit={disruptionSeverity > 0 ? `severity ${disruptionSeverity}` : undefined}
          unitTone="warn"
        >
          <DisruptionSplit open={kpis.disruptions.open} resolving={kpis.disruptions.resolving} />
          <div className="flex gap-2.5 text-[11px] text-[var(--occ-text-2)] mt-1.5 flex-wrap">
            <LegendDot color="#FF3B3B" label="Divert" n={kpis.disruptions.divert} />
            <LegendDot color="#FF8800" label="Air Return" n={kpis.disruptions.airReturn} />
            <LegendDot color="#0063F7" label="Ramp Return" n={kpis.disruptions.rampReturn} />
          </div>
        </OccKpiTile>
        <OccKpiTile
          icon={<Plane size={14} />}
          label="Fleet Availability"
          moduleCode="3.4.1"
          value={fleetAvailabilityPct.toFixed(1)}
          unit="%"
          sparkline={FLEET_TREND}
          sub={
            <span className="font-mono">
              <b>{fleet.available}</b>/{fleet.active} a/c
              {fleet.aog > 0 && <span className="ml-2 text-[#FF3B3B]">◆ {fleet.aog} AOG</span>}
              {fleet.maintenance > 0 && <span className="ml-2 text-[#FF8800]">◆ {fleet.maintenance} maint</span>}
            </span>
          }
        />
      </div>
    </section>
  )
}

function DisruptionSplit({ open, resolving }: { open: number; resolving: number }) {
  const total = open + resolving
  if (total === 0)
    return <div className="h-2 rounded-[4px] bg-[rgba(17,17,24,0.06)] dark:bg-white/5 mt-0.5" aria-hidden />
  const openPct = (open / total) * 100
  return (
    <div className="flex h-2 rounded-[4px] overflow-hidden bg-[rgba(17,17,24,0.06)] dark:bg-white/5 mt-0.5 gap-[2px]">
      <span className="h-full bg-[#FF3B3B]" style={{ width: `${openPct}%` }} />
      <span className="h-full bg-[#0063F7]" style={{ width: `${100 - openPct}%` }} />
    </div>
  )
}

function LegendDot({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="w-[7px] h-[7px] rounded-sm inline-block" style={{ background: color }} />
      {label} <b className="font-mono ml-0.5">{n}</b>
    </span>
  )
}
