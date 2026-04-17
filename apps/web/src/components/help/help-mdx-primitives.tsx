import type { ReactNode } from 'react'
import { Info, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-hz-border bg-black/5 dark:bg-white/5 font-mono text-[13px] font-medium text-hz-text">
      {children}
    </kbd>
  )
}

export function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-3 mb-3">
      <div
        className="shrink-0 h-6 w-6 rounded-full bg-module-accent text-white flex items-center justify-center text-[13px] font-semibold"
        aria-hidden
      >
        {n}
      </div>
      <div className="flex-1 text-[14px] text-hz-text/90 leading-[1.6] pt-0.5">{children}</div>
    </div>
  )
}

type CalloutTone = 'info' | 'warning' | 'tip' | 'success'

const CALLOUT_CONFIG: Record<CalloutTone, { icon: typeof Info; color: string; bg: string; border: string }> = {
  info: { icon: Info, color: '#0063F7', bg: 'rgba(0,99,247,0.08)', border: 'rgba(0,99,247,0.25)' },
  warning: {
    icon: AlertTriangle,
    color: '#FF8800',
    bg: 'rgba(255,136,0,0.08)',
    border: 'rgba(255,136,0,0.25)',
  },
  tip: {
    icon: Lightbulb,
    color: '#9333EA',
    bg: 'rgba(147,51,234,0.08)',
    border: 'rgba(147,51,234,0.25)',
  },
  success: {
    icon: CheckCircle2,
    color: '#06C270',
    bg: 'rgba(6,194,112,0.08)',
    border: 'rgba(6,194,112,0.25)',
  },
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: CalloutTone
  title?: string
  children: ReactNode
}) {
  const cfg = CALLOUT_CONFIG[tone]
  const Icon = cfg.icon
  return (
    <div className="my-4 rounded-lg p-3 flex gap-3" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <Icon size={16} strokeWidth={2} style={{ color: cfg.color, marginTop: 2 }} />
      <div className="flex-1 min-w-0">
        {title ? (
          <div className="text-[14px] font-semibold mb-1" style={{ color: cfg.color }}>
            {title}
          </div>
        ) : null}
        <div className="text-[14px] text-hz-text/90 leading-[1.6]">{children}</div>
      </div>
    </div>
  )
}

const COMBO_SEPARATORS = new Set(['+', '/', 'or', ',', '&'])

function renderCombo(combo: string) {
  const tokens = combo.split(/\s+/).filter(Boolean)
  return tokens.map((tok, i) => {
    if (COMBO_SEPARATORS.has(tok)) {
      return (
        <span key={i} className="mx-1 text-hz-text-secondary text-[13px]">
          {tok}
        </span>
      )
    }
    return <Kbd key={i}>{tok}</Kbd>
  })
}

export function ShortcutList({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 rounded-lg border border-hz-border overflow-hidden">
      <div className="divide-y divide-hz-border">{children}</div>
    </div>
  )
}

export function Shortcut({ combo, children }: { combo: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      <div className="flex items-center shrink-0 min-w-[140px]">{renderCombo(combo)}</div>
      <div className="text-[13px] text-hz-text/90 leading-snug flex-1">{children}</div>
    </div>
  )
}
