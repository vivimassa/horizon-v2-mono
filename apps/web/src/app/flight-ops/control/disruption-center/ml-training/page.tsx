'use client'

import { useRouter, usePathname } from 'next/navigation'
import * as LucideIcons from 'lucide-react'
import { MODULE_REGISTRY, MODULE_THEMES, resolveModule } from '@skyhub/constants'
import { useTheme } from '@/components/theme-provider'
import { revealNavigate } from '@/lib/nav-transition'

/**
 * 2.1.3.1 — Machine Learning Training (STUB).
 *
 * Not a real implementation. Canonical place to capture the planned scope
 * so the intent survives across conversations and rebuilds. Strip the
 * bullets and expand each item into a section when we're ready to build.
 */

const PLANNED_FEATURES: Array<{ title: string; detail: string }> = [
  {
    title: 'Dataset picker',
    detail:
      'Operator chooses date range, stations and fleet subset to train on. Pulls flight_instances, crew_modifications, maintenance_events and disruption_issues history for the selected slice.',
  },
  {
    title: 'Historical weather ingestion',
    detail:
      'Primary source: Iowa State IEM ASOS archive — free CSV, decades of METAR history. Backup: NOAA ISD via NCEI. Live NOAA AWC caps at 15 days and is unsuitable for training.',
  },
  {
    title: 'Feature engineering preview',
    detail:
      'Show the computed features before training: tail swap rates (30d/7d/lifetime), crew change rates, maintenance pressure, weather at dep/arr. Operator can include/exclude features.',
  },
  {
    title: 'Train / validate / publish',
    detail:
      'Standard flow with train/validation split, metrics (precision, recall, F1, calibration), and explicit publish step. Nothing auto-promotes to production.',
  },
  {
    title: 'Per-operator model versioning',
    detail:
      'Every train produces a versioned model with provenance (dataset, features, metrics, trained_at, trained_by). Roll back with one click.',
  },
  {
    title: 'A/B vs baseline rules',
    detail:
      'Compare the trained model against the rules engine on a held-out window. Surface where ML wins and where it loses, so the operator can decide whether to switch.',
  },
  {
    title: 'Lab — not ops surface',
    detail:
      'Keep this module separate from the live Disruption Center feed. This is where models are built and evaluated; the feed only consumes published models.',
  },
]

const BLOCKERS: Array<{ title: string; detail: string }> = [
  {
    title: 'Crew Ops must exist first',
    detail:
      'v1 trained the ML model with crew_changes_on_flight hardcoded to 0. Training without real crew signals repeats the same mistake. Do not build this module until Crew Ops is live and producing data.',
  },
  {
    title: 'Operator data accumulation',
    detail:
      'Disruption Center v2 must run in production long enough to accumulate real issues, activities and outcomes. Training on too little data produces a brittle model.',
  },
]

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>

export default function Page() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const mod = resolveModule(pathname)
  const accent = mod ? (MODULE_THEMES[mod.module]?.accent ?? '#1e40af') : '#1e40af'
  const parent = MODULE_REGISTRY.find((x) => x.code === mod?.parent_code)
  const Icon = mod ? (iconMap[mod.icon] ?? LucideIcons.Brain) : LucideIcons.Brain

  const cardBg = isDark ? 'rgba(25,25,33,0.72)' : 'rgba(255,255,255,0.82)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const innerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'
  const innerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(71,85,105,0.80)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'

  function goBack() {
    revealNavigate(router, '/flight-ops/control/disruption-center/disruption-management', {
      origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      accent,
      direction: 'out',
    })
  }

  return (
    <div className="h-full w-full overflow-y-auto py-10 px-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            backdropFilter: 'blur(18px) saturate(150%)',
            WebkitBackdropFilter: 'blur(18px) saturate(150%)',
            boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.35)' : '0 12px 40px rgba(96,97,112,0.12)',
          }}
        >
          {/* Accent glow */}
          <div
            className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: 420,
              height: 220,
              background: `radial-gradient(ellipse at center, ${accent}33 0%, transparent 65%)`,
              filter: 'blur(24px)',
            }}
          />

          <div className="relative px-8 pt-10 pb-8 flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center rounded-2xl shrink-0"
                style={{
                  width: 56,
                  height: 56,
                  background: accent,
                  boxShadow: `0 8px 24px ${accent}55`,
                }}
              >
                <Icon size={26} strokeWidth={1.8} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: accent }}>
                    {mod?.code ?? '2.1.3.1'}
                  </span>
                  {parent && (
                    <>
                      <span className="text-[11px]" style={{ color: textTertiary }}>
                        ·
                      </span>
                      <span
                        className="text-[11px] font-semibold tracking-wide uppercase"
                        style={{ color: textTertiary }}
                      >
                        {parent.name}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-[22px] font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
                  {mod?.name ?? 'Machine Learning Training'}
                </h1>
                {mod?.description && (
                  <p className="text-[13px] leading-relaxed mt-1.5" style={{ color: textSecondary }}>
                    {mod.description}
                  </p>
                )}
              </div>
              {/* Status pill */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0"
                style={{
                  background: `${accent}18`,
                  border: `1px solid ${accent}33`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                />
                <span className="text-[13px] font-semibold tracking-wide" style={{ color: accent }}>
                  Planned
                </span>
              </div>
            </div>

            {/* Section: Planned scope */}
            <div
              className="rounded-xl px-5 py-4"
              style={{
                background: innerBg,
                border: `1px solid ${innerBorder}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-[14px] rounded-full" style={{ background: accent }} />
                <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                  Planned scope
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {PLANNED_FEATURES.map((f) => (
                  <li key={f.title} className="flex items-start gap-3">
                    <LucideIcons.Dot size={20} strokeWidth={3} color={accent} className="shrink-0 mt-[1px]" />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold" style={{ color: textPrimary }}>
                        {f.title}
                      </div>
                      <div className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
                        {f.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section: Blockers */}
            <div
              className="rounded-xl px-5 py-4"
              style={{
                background: 'rgba(255,136,0,0.08)',
                border: '1px solid rgba(255,136,0,0.28)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <LucideIcons.AlertTriangle size={14} strokeWidth={2.2} color="#FF8800" />
                <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: '#FF8800' }}>
                  Do not build until
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {BLOCKERS.map((b) => (
                  <li key={b.title} className="flex items-start gap-3">
                    <LucideIcons.Dot size={20} strokeWidth={3} color="#FF8800" className="shrink-0 mt-[1px]" />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold" style={{ color: textPrimary }}>
                        {b.title}
                      </div>
                      <div className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
                        {b.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Principle callout */}
            <div
              className="rounded-xl px-5 py-4"
              style={{
                background: `${accent}10`,
                border: `1px solid ${accent}28`,
              }}
            >
              <div className="flex items-start gap-3">
                <LucideIcons.Lightbulb size={16} strokeWidth={2} color={accent} className="shrink-0 mt-[2px]" />
                <p className="text-[13px] leading-relaxed" style={{ color: textPrimary }}>
                  <span className="font-semibold">Principle:</span> each operator trains on their own data. v1 used one
                  fleet-agnostic model and it was weak. Per-operator models are versioned, explicitly published, and
                  always compared against the baseline rules engine before going live.
                </p>
              </div>
            </div>

            {/* Back button */}
            <div>
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80 active:scale-[0.98]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
                  color: textPrimary,
                }}
              >
                <LucideIcons.ArrowLeft size={14} strokeWidth={2} />
                Back to Disruption Management
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
