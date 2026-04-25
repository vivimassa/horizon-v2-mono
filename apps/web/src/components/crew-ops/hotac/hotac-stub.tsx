'use client'

import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'

interface HotacStubProps {
  title: string
  num: string
  icon: LucideIcon
  sections: string[]
}

export function HotacStub({ title, num, icon: Icon, sections }: HotacStubProps) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl bg-hz-card border border-hz-border shadow-[0_1px_3px_rgba(96,97,112,0.06)] overflow-hidden">
        {/* Accent bar header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-hz-border">
          <div className="w-1 h-7 rounded-full bg-module-accent" />
          <div className="h-9 w-9 rounded-lg bg-module-accent/10 flex items-center justify-center">
            <Icon className="h-[18px] w-[18px] text-module-accent" strokeWidth={2.25} />
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-hz-text">{title}</div>
            <div className="text-[13px] text-hz-text-secondary mt-0.5">Section {num}</div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Construction className="h-4 w-4 text-hz-text-secondary" />
            <span className="text-[13px] font-semibold text-hz-text">Coming soon</span>
          </div>
          <div className="text-[13px] text-hz-text-secondary mb-4 leading-relaxed">
            This module is in design. Planned scope:
          </div>
          <ul className="space-y-2">
            {sections.map((s) => (
              <li key={s} className="flex items-center gap-2 text-[13px] text-hz-text">
                <span className="h-1.5 w-1.5 rounded-full bg-module-accent shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
