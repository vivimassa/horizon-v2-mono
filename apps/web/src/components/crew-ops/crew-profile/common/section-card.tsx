'use client'

import type { ReactNode } from 'react'
import { type Palette as PaletteType } from '@skyhub/ui/theme'

const ACCENT_FALLBACK = '#14B8A6'

interface Props {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  palette: PaletteType
  isDark: boolean
  accentColor?: string
}

/**
 * Section container used throughout the Crew Profile tabs. Renders a 3px
 * accent-colored vertical bar before the title per CLAUDE.md rule 7
 * (SectionHeader pattern) — but built inline so we can host arbitrary action
 * nodes in the header without coupling to the mobile SectionHeader API.
 */
export function SectionCard({ title, description, action, children, palette, isDark, accentColor }: Props) {
  const bar = accentColor ?? ACCENT_FALLBACK
  return (
    <section
      className="rounded-xl p-5 mb-4"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: isDark ? '0 1px 1px rgba(0,0,0,0.25)' : '0 1px 2px rgba(96,97,112,0.06)',
      }}
    >
      <header className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 w-[3px] h-5 rounded-full" style={{ background: bar }} />
          <div>
            <h3 className="text-[15px] font-bold leading-tight" style={{ color: palette.text }}>
              {title}
            </h3>
            {description && (
              <p className="text-[13px] mt-0.5" style={{ color: palette.textTertiary }}>
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}
