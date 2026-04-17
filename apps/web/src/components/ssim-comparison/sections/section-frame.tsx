'use client'

import type { ReactNode } from 'react'

/**
 * Accent-bar section header for the web Comparison report. Matches the
 * SkyHub SectionHeader pattern used by the mobile app, but implemented
 * inline since that component is React Native only.
 */
export function SectionFrame({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="shrink-0"
            style={{
              width: 3,
              height: 16,
              borderRadius: 2,
              background: 'var(--module-accent, #1e40af)',
            }}
          />
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-hz-text truncate">{title}</h2>
            {subtitle ? <p className="text-[13px] text-hz-text-tertiary mt-0.5 truncate">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}
