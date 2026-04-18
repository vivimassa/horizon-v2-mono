'use client'

import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  description?: string
  right?: ReactNode
}

export function SectionHeader({ title, description, right }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2 min-w-0">
        <span
          className="w-[3px] self-stretch rounded-sm shrink-0 mt-0.5"
          style={{ background: 'var(--module-accent, #1e40af)', minHeight: 24 }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-hz-text truncate">{title}</h2>
          {description && <p className="text-[13px] text-hz-text-secondary mt-0.5">{description}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
