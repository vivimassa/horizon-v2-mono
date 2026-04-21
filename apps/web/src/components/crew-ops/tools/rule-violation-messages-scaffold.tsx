'use client'

import { Construction, MessageSquareWarning } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

/**
 * Scaffold for 4.2.1 Rule Violation Message (under 4.2 Tools).
 *
 * Intended behaviour — captured here as specification until implemented:
 *
 *   • Operator-editable catalog of the messages shown to planners when
 *     an overridable rule fires (base mismatch, FDP exceeded, rest short,
 *     rank mismatch, etc.). Matches AIMS's equivalent screen.
 *   • Table: violationKind · default title · default body · custom title
 *     · custom body · scope (cockpit / cabin / all).
 *   • Inline edit per row with a "Reset to default" control.
 *   • `violationKind` is the join key used by:
 *       – 4.1.6 duty assignment dialogs (lookup at display time)
 *       – 4.3.1 Schedule Legality Check (for `messageSnapshot` column)
 *   • Changes apply immediately — no Go button. Snapshots are taken at
 *     the moment of override so report rows always show the wording that
 *     was in effect when the planner confirmed.
 *
 *   • Import / export: JSON bundle so ops teams can share catalogs.
 */
export function RuleViolationMessagesScaffold() {
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
            <MessageSquareWarning size={32} strokeWidth={1.8} color="#fff" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-[0.12em] uppercase" style={{ color: accent }}>
              4.2.1
            </span>
            <span className="text-[13px]" style={{ color: textTertiary }}>
              ·
            </span>
            <span className="text-[13px] font-semibold tracking-wide uppercase" style={{ color: textTertiary }}>
              Tools
            </span>
          </div>

          <h1 className="text-[24px] font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
            Rule Violation Message
          </h1>
          <p className="text-[13px] leading-relaxed max-w-lg" style={{ color: textSecondary }}>
            Operator-editable catalog of the messages shown to planners when an overridable rule fires during duty
            assignment. Mirrors AIMS's equivalent screen.
          </p>

          <div className="w-full mt-4 text-left">
            <div className="text-[13px] font-semibold uppercase tracking-wider mb-2" style={{ color: textTertiary }}>
              Data model
            </div>
            <ul className="text-[13px] leading-relaxed space-y-1" style={{ color: textSecondary }}>
              <li>
                • New collection <code>RuleViolationMessage</code> keyed on (operatorId, violationKind)
              </li>
              <li>• Fields: default title, default body, custom title, custom body, scope, updatedAt</li>
              <li>
                • <code>violationKind</code> joins to the overrides emitted by 4.1.6
              </li>
            </ul>

            <div
              className="text-[13px] font-semibold uppercase tracking-wider mt-4 mb-2"
              style={{ color: textTertiary }}
            >
              Surface shape
            </div>
            <ul className="text-[13px] leading-relaxed space-y-1" style={{ color: textSecondary }}>
              <li>• Table of every known kind, inline-edit title + body, reset to default</li>
              <li>• Live preview of the dialog as rendered in 4.1.6</li>
              <li>• Import / export as JSON bundle</li>
            </ul>

            <div
              className="text-[13px] font-semibold uppercase tracking-wider mt-4 mb-2"
              style={{ color: textTertiary }}
            >
              Kinds to seed on first use
            </div>
            <ul className="text-[13px] leading-relaxed space-y-1" style={{ color: textSecondary }}>
              <li>
                • <code>base_mismatch</code> — wired to 4.1.6 duty assignment today
              </li>
              <li>
                • <code>fdp_exceeded</code>, <code>rest_short</code>, <code>rank_mismatch</code>,{' '}
                <code>expiry_alert</code> — reserved
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
