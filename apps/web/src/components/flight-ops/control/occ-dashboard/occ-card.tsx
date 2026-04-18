'use client'

import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

type AccentTone = 'accent' | 'ok' | 'warn' | 'err' | 'info'

const TONE_BG: Record<AccentTone, string> = {
  accent: 'bg-[var(--occ-accent)]',
  ok: 'bg-[#06C270]',
  warn: 'bg-[#FF8800]',
  err: 'bg-[#FF3B3B]',
  info: 'bg-[#0063F7]',
}

const TONE_BORDER: Record<AccentTone, string> = {
  accent: '',
  ok: 'border-l-[3px] border-l-[#06C270]',
  warn: 'border-l-[3px] border-l-[#FF8800]',
  err: 'border-l-[3px] border-l-[#FF3B3B]',
  info: 'border-l-[3px] border-l-[#0063F7]',
}

interface OccCardProps {
  title: string
  tone?: AccentTone
  moduleCode?: string
  icon?: ReactNode
  children: ReactNode
  footLeft?: ReactNode
  footRight?: { label: string; href?: string; onClick?: () => void }
  /** Removes inner body padding (for table layouts). */
  flush?: boolean
  /** Emphasises card with a left edge stripe for Exception Queues. */
  edge?: boolean
}

export function OccCard({
  title,
  tone = 'accent',
  moduleCode,
  icon,
  children,
  footLeft,
  footRight,
  flush,
  edge,
}: OccCardProps) {
  return (
    <section
      className={[
        'relative flex flex-col rounded-xl border bg-white/80 dark:bg-[#191921]/80',
        'border-[rgba(17,17,24,0.08)] dark:border-white/10',
        'shadow-[0_1px_2px_rgba(96,97,112,0.08),0_1px_3px_rgba(96,97,112,0.04)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.5),0_1px_3px_rgba(96,97,112,0.10)]',
        'backdrop-blur-[4px]',
        edge ? TONE_BORDER[tone] : '',
      ].join(' ')}
    >
      <header className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[rgba(17,17,24,0.08)] dark:border-white/10">
        <span className={`w-[3px] h-3.5 rounded-[2px] ${TONE_BG[tone]}`} aria-hidden />
        {icon ? <span className="text-[var(--occ-text-2)]">{icon}</span> : null}
        <h3 className="m-0 text-[13px] font-semibold tracking-[-0.005em] text-[var(--occ-text)]">{title}</h3>
        {moduleCode ? (
          <span className="ml-auto font-mono text-[10.5px] text-[var(--occ-text-3)] px-1.5 py-[2px] border border-[rgba(17,17,24,0.08)] dark:border-white/10 rounded">
            {moduleCode}
          </span>
        ) : null}
      </header>
      <div className={flush ? '' : 'px-3.5 py-3'}>{children}</div>
      {(footLeft || footRight) && (
        <footer className="flex items-center justify-between px-3.5 py-2 border-t border-[rgba(17,17,24,0.08)] dark:border-white/10 text-[12px] text-[var(--occ-text-3)]">
          <span>{footLeft}</span>
          {footRight ? (
            footRight.href ? (
              <a
                className="inline-flex items-center gap-1 text-[var(--occ-accent)] hover:opacity-80 font-medium"
                href={footRight.href}
              >
                {footRight.label}
                <ArrowUpRight size={12} />
              </a>
            ) : (
              <button
                type="button"
                onClick={footRight.onClick}
                className="inline-flex items-center gap-1 text-[var(--occ-accent)] hover:opacity-80 font-medium"
              >
                {footRight.label}
                <ArrowUpRight size={12} />
              </button>
            )
          ) : null}
        </footer>
      )}
    </section>
  )
}
