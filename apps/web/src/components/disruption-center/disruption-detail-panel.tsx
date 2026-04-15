'use client'

import { useMemo } from 'react'
import { CheckCircle2, Play, UserCheck, X, EyeOff, ArrowUpRight, Sparkles, Bot } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { MODULE_REGISTRY } from '@skyhub/constants'
import { useTheme } from '@/components/theme-provider'
import { useDisruptionStore } from '@/stores/use-disruption-store'
import type { DisruptionIssueRef } from '@skyhub/api'
import { CATEGORY_LABEL, SEVERITY_COLOR, STATUS_LABEL } from './severity-utils'

const DETAIL_WIDTH = 420

/**
 * Detail column — right half of the workspace split. Owns no glass
 * chrome; sits directly in the shell's main card, separated from the
 * feed by a 1px section border on the left edge.
 */
export function DisruptionDetailPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const selectedIssueId = useDisruptionStore((s) => s.selectedIssueId)
  const issues = useDisruptionStore((s) => s.issues)
  const activity = useDisruptionStore((s) => s.selectedActivity)
  const claim = useDisruptionStore((s) => s.claim)
  const start = useDisruptionStore((s) => s.start)
  const resolve = useDisruptionStore((s) => s.resolve)
  const close = useDisruptionStore((s) => s.close)
  const hide = useDisruptionStore((s) => s.hide)

  const issue = useMemo(() => issues.find((i) => i._id === selectedIssueId) ?? null, [issues, selectedIssueId])

  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const divStyle = { width: DETAIL_WIDTH, borderLeft: `1px solid ${sectionBorder}` } as const

  if (!issue) {
    return (
      <div className="shrink-0 flex flex-col overflow-hidden" style={divStyle}>
        <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-tertiary px-6 text-center">
          Select a disruption to see details.
        </div>
      </div>
    )
  }

  const sevColor = SEVERITY_COLOR[issue.severity]

  return (
    <div className="shrink-0 flex flex-col overflow-y-auto" style={divStyle}>
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: sevColor }}>
            {CATEGORY_LABEL[issue.category]}
          </span>
          <span className="text-[13px] text-hz-text-tertiary">·</span>
          <StatusPill status={issue.status} />
        </div>
        <h2 className="text-[16px] font-bold leading-tight text-hz-text">{issue.title}</h2>
        <div className="text-[13px] mt-1.5 text-hz-text-secondary">
          {[issue.flightNumber, issue.forDate, issue.depStation, issue.arrStation, issue.tail]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>

      {issue.reasons && issue.reasons.length > 0 && (
        <Section title="Why this flagged" sectionBorder={sectionBorder}>
          <ul className="flex flex-col gap-2">
            {issue.reasons.map((r: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-hz-text">
                <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: sevColor }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <SuggestedActionsSlot issue={issue} sectionBorder={sectionBorder} isDark={isDark} />

      <Section title="Workflow" sectionBorder={sectionBorder}>
        <div className="flex flex-wrap gap-2">
          {issue.status === 'open' && <ActionButton icon={UserCheck} label="Claim" onClick={() => claim(issue._id)} />}
          {issue.status === 'assigned' && <ActionButton icon={Play} label="Start" onClick={() => start(issue._id)} />}
          {(issue.status === 'assigned' || issue.status === 'in_progress') && (
            <ActionButton
              icon={CheckCircle2}
              label="Resolve"
              variant="affirmative"
              onClick={() => {
                const resolutionType = window.prompt('Resolution type (swap / delay_accepted / cancelled):')
                if (!resolutionType) return
                const notes = window.prompt('Notes (optional):') ?? undefined
                resolve(issue._id, resolutionType, notes)
              }}
            />
          )}
          {issue.status === 'resolved' && <ActionButton icon={X} label="Close" onClick={() => close(issue._id)} />}
          <ActionButton
            icon={EyeOff}
            label="Hide"
            variant="secondary"
            onClick={() => {
              if (window.confirm('Hide this disruption?')) hide(issue._id)
            }}
          />
        </div>
      </Section>

      <Section title="Activity" sectionBorder={sectionBorder}>
        {activity.length === 0 ? (
          <div className="text-[13px] text-hz-text-tertiary">No activity yet.</div>
        ) : (
          <ol className="flex flex-col gap-3">
            {activity.map((a) => (
              <li key={a._id} className="flex items-start gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-[7px] shrink-0"
                  style={{ background: 'var(--module-accent, #4f46e5)' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-hz-text">
                    {a.actionType}
                    {a.newStatus && (
                      <span className="text-hz-text-secondary font-normal">
                        {' → '}
                        {STATUS_LABEL[a.newStatus as keyof typeof STATUS_LABEL] ?? a.newStatus}
                      </span>
                    )}
                  </div>
                  {a.actionDetail && <div className="text-[13px] text-hz-text-secondary">{a.actionDetail}</div>}
                  <div className="text-[13px] text-hz-text-tertiary">
                    {new Date(a.createdAt).toUTCString()} · {a.userName ?? 'system'}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="AI advisor" sectionBorder={sectionBorder}>
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{
            background: 'rgba(79,70,229,0.08)',
            border: '1px solid rgba(79,70,229,0.22)',
          }}
        >
          <Bot size={16} className="mt-[2px] shrink-0" style={{ color: 'var(--module-accent, #4f46e5)' }} />
          <div className="text-[13px] leading-relaxed text-hz-text">
            Per-operator AI advisor available after <span className="font-semibold">2.1.3.2 — AI Customization</span>.
            Preferences are staged but the advisor call is not wired yet.
          </div>
        </div>
      </Section>
    </div>
  )
}

// ── Subcomponents ──

function Section({
  title,
  children,
  sectionBorder,
}: {
  title: string
  children: React.ReactNode
  sectionBorder: string
}) {
  return (
    <div className="px-5 py-4" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-[14px] rounded-full bg-module-accent" />
        <span className="text-[13px] font-bold uppercase tracking-wider text-hz-text-secondary">{title}</span>
      </div>
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: DisruptionIssueRef['status'] }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-semibold text-hz-text"
      style={{
        background: 'rgba(79,70,229,0.16)',
        border: '1px solid rgba(79,70,229,0.32)',
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function SuggestedActionsSlot({
  issue,
  sectionBorder,
  isDark,
}: {
  issue: DisruptionIssueRef
  sectionBorder: string
  isDark: boolean
}) {
  const router = useRouter()
  const actions = deriveActions(issue)
  const innerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
  const innerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const openModule = (code: string | null | undefined, actionId: string) => {
    if (!code) return
    const mod = MODULE_REGISTRY.find((m) => m.code === code)
    if (!mod?.route) return
    const params = new URLSearchParams()
    if (issue._id) params.set('disruptionId', issue._id)
    if (actionId === 'plan-recovery') params.set('openRecovery', '1')
    const qs = params.toString() ? `?${params.toString()}` : ''
    router.push(`${mod.route}${qs}`)
  }

  return (
    <div className="px-5 py-4" style={{ borderBottom: `1px solid ${sectionBorder}` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[3px] h-[14px] rounded-full bg-module-accent" />
        <span className="text-[13px] font-bold uppercase tracking-wider text-hz-text-secondary">Suggested actions</span>
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => openModule(a.linkedModuleCode, a.id)}
            className="w-full rounded-xl px-4 py-3 flex items-center justify-between text-left transition-opacity hover:opacity-90"
            style={{ background: innerBg, border: `1px solid ${innerBorder}` }}
          >
            <div className="flex items-center gap-3">
              <Sparkles size={14} className="text-module-accent" />
              <div>
                <div className="text-[14px] font-semibold text-hz-text">{a.label}</div>
                {a.hint && <div className="text-[13px] text-hz-text-secondary">{a.hint}</div>}
              </div>
            </div>
            <ArrowUpRight size={16} className="text-module-accent" />
          </button>
        ))}
      </div>
    </div>
  )
}

function deriveActions(
  issue: DisruptionIssueRef,
): Array<{ id: string; label: string; linkedModuleCode: string | null; hint?: string }> {
  const planRecovery = {
    id: 'plan-recovery',
    label: 'Plan recovery in Movement Control',
    linkedModuleCode: '2.1.1',
    hint: 'Open the recovery solver with this flight pre-selected.',
  }
  const maint = {
    id: 'open-maintenance',
    label: 'Open in Aircraft Maintenance',
    linkedModuleCode: '2.1.2',
    hint: 'Inspect aircraft maintenance status.',
  }
  const worldMap = {
    id: 'open-world-map',
    label: 'Track on World Map',
    linkedModuleCode: '2.1.5',
    hint: 'See aircraft and weather in context.',
  }
  switch (issue.category) {
    case 'MAINTENANCE_RISK':
      return [maint, planRecovery]
    case 'DIVERSION':
      return [worldMap, planRecovery, maint]
    case 'CURFEW_VIOLATION':
    case 'TAT_VIOLATION':
      return [planRecovery]
    default:
      return [planRecovery]
  }
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'primary',
}: {
  icon: typeof Play
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'affirmative'
}) {
  const base =
    'h-9 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-opacity hover:opacity-90'
  if (variant === 'affirmative') {
    return (
      <button type="button" onClick={onClick} className={base} style={{ background: '#06C270', color: '#fff' }}>
        <Icon size={14} strokeWidth={2} />
        {label}
      </button>
    )
  }
  if (variant === 'secondary') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} bg-transparent text-module-accent`}
        style={{ border: '1px solid var(--module-accent, #4f46e5)' }}
      >
        <Icon size={14} strokeWidth={2} />
        {label}
      </button>
    )
  }
  return (
    <button type="button" onClick={onClick} className={`${base} bg-module-accent text-white`}>
      <Icon size={14} strokeWidth={2} />
      {label}
    </button>
  )
}
