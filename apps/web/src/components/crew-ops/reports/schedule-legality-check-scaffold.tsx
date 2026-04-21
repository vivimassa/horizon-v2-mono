'use client'

import { ClipboardCheck, Construction } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

/**
 * Scaffold for 4.3.1 Schedule Legality Check (replaces 4.3.1 FDTL Report).
 *
 * Intended behaviour — captured here as specification until the page is
 * implemented against real data:
 *
 *   • Replaces the legacy 4.3.1 FDTL Report entirely.
 *   • Surfaces every pairing / assignment with an active rule violation,
 *     grouped by violation kind (base_mismatch, fdp_exceeded, rest_short,
 *     rank_mismatch, expiry_alert, etc.).
 *   • Each row: crew · pairing · seat · violation kind · message snapshot
 *     · override status (acknowledged / not yet reviewed) · planner who
 *     overrode · timestamp.
 *   • Source of truth: `AssignmentViolationOverride` collection +
 *     server-side re-evaluation of the active FDTL rule set against the
 *     current schedule. Overrides that are already logged get an
 *     "Acknowledged" badge; still-open issues get "Open".
 *   • Filters: period, crew base, violation kind, status.
 *   • Export: PDF + CSV for compliance audit.
 */
export function ScheduleLegalityCheckScaffold() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const accent = '#7c3aed'

  const cardBg = isDark ? 'rgba(25,25,33,0.72)' : 'rgba(255,255,255,0.78)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(100,116,139,0.60)'

  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div
        className="relative rounded-2xl overflow-hidden max-w-2xl w-full"
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          backdropFilter: 'blur(18px) saturate(150%)',
          WebkitBackdropFilter: 'blur(18px) saturate(150%)',
          boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.35)' : '0 12px 40px rgba(96,97,112,0.12)',
        }}
      >
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            width: 320,
            height: 200,
            background: `radial-gradient(ellipse at center, ${accent}40 0%, transparent 65%)`,
            filter: 'blur(18px)',
          }}
        />
        <div className="relative px-8 pt-10 pb-8 flex flex-col items-center text-center gap-4">
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{ width: 72, height: 72, background: accent, boxShadow: `0 8px 28px ${accent}60` }}
          >
            <ClipboardCheck size={32} strokeWidth={1.8} color="#fff" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-[0.12em] uppercase" style={{ color: accent }}>
              4.3.1
            </span>
            <span className="text-[13px]" style={{ color: textTertiary }}>
              ·
            </span>
            <span className="text-[13px] font-semibold tracking-wide uppercase" style={{ color: textTertiary }}>
              Reports
            </span>
          </div>

          <h1 className="text-[24px] font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
            Schedule Legality Check
          </h1>
          <p className="text-[13px] leading-relaxed max-w-lg" style={{ color: textSecondary }}>
            Replaces the legacy FDTL Report. Lists every pairing and assignment with an active rule violation, grouped
            by violation kind, with planner override status and audit trail.
          </p>

          <div className="w-full mt-4 text-left">
            <div className="text-[13px] font-semibold uppercase tracking-wider mb-2" style={{ color: textTertiary }}>
              Data sources
            </div>
            <ul className="text-[13px] leading-relaxed space-y-1" style={{ color: textSecondary }}>
              <li>
                • <code>AssignmentViolationOverride</code> collection — planner-acknowledged overrides
              </li>
              <li>• Live FDTL re-evaluation over the current schedule window</li>
              <li>
                • <code>CrewAssignment</code> ↔ <code>CrewMember</code> ↔ <code>Pairing</code> joins
              </li>
            </ul>

            <div
              className="text-[13px] font-semibold uppercase tracking-wider mt-4 mb-2"
              style={{ color: textTertiary }}
            >
              Surface shape
            </div>
            <ul className="text-[13px] leading-relaxed space-y-1" style={{ color: textSecondary }}>
              <li>• Columns: crew · pairing · seat · kind · message · status · overrider · time</li>
              <li>• Filters: period · base · kind · status (open / acknowledged)</li>
              <li>• Export: PDF + CSV for compliance audit</li>
              <li>• Row click deep-links back into 4.1.6 on the affected pairing</li>
            </ul>

            <div
              className="text-[13px] font-semibold uppercase tracking-wider mt-4 mb-2"
              style={{ color: textTertiary }}
            >
              Kinds emitted today
            </div>
            <ul className="text-[13px] leading-relaxed space-y-1" style={{ color: textSecondary }}>
              <li>
                • <code>base_mismatch</code> — crew base ≠ pairing base (4.1.6 duty assignment)
              </li>
            </ul>
          </div>

          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-2"
            style={{
              background: 'rgba(255,136,0,0.15)',
              border: '1px solid rgba(255,136,0,0.33)',
            }}
          >
            <Construction size={14} color="#FF8800" />
            <span className="text-[12px] font-semibold tracking-wide" style={{ color: '#FF8800' }}>
              Scaffolded · not yet implemented
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
