'use client'

import { type ReactNode } from 'react'
import { WEB_LAYOUT } from '@/lib/fonts'
import { useTheme } from '@/components/theme-provider'

interface MasterDetailLayoutProps {
  /** Left panel content (list, search, filters) */
  left: ReactNode
  /** Center panel content — flex-1, always present */
  center: ReactNode
  /** Optional right panel content (info, inspector) */
  right?: ReactNode
}

/**
 * Shared master-detail layout shell used across all admin and data screens.
 *
 * Variants:
 *   - 2-panel: left (320px) + center (flex-1)
 *   - 3-panel: left (320px) + center (flex-1) + right (320px)
 */
export function MasterDetailLayout({ left, center, right }: MasterDetailLayoutProps) {
  const { theme } = useTheme()
  const panelBg = theme === 'dark' ? '#191921' : '#FFFFFF'

  return (
    <div className="flex h-full overflow-hidden gap-3 px-5 pt-4 pb-5">
      {/* Left panel */}
      <aside
        className="shrink-0 flex flex-col rounded-2xl border border-hz-border overflow-hidden"
        style={{ width: WEB_LAYOUT.sidebarWidth, background: panelBg }}
      >
        {left}
      </aside>

      {/* Center panel — flex-1 */}
      <section
        className="flex-1 flex flex-col rounded-2xl border border-hz-border overflow-hidden"
        style={{ background: panelBg }}
      >
        {center}
      </section>

      {/* Right panel — optional */}
      {right && (
        <aside
          className="shrink-0 flex flex-col rounded-2xl border border-hz-border bg-hz-card overflow-hidden"
          style={{ width: WEB_LAYOUT.inspectorWidth }}
        >
          {right}
        </aside>
      )}
    </div>
  )
}
