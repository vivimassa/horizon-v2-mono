'use client'

import { useState, type ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface SelectionPanelProps {
  /** Panel title (shown in header) */
  title?: string
  /** Number of active filters — shown as badge */
  activeCount?: number
  /** Content: filter fields, sections, etc. */
  children: ReactNode
  /** Pinned footer (Go/Reset buttons) */
  footer?: ReactNode
  /** Controlled collapsed state */
  collapsed?: boolean
  /** Collapse toggle callback */
  onToggleCollapse?: () => void
}

/**
 * Selection criteria panel — the standard filter sidebar.
 * 300px expanded, 44px collapsed. Used inside MasterDetailLayout left slot.
 */
export function SelectionPanel({
  title = 'Filters',
  activeCount = 0,
  children,
  footer,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SelectionPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const collapsed = controlledCollapsed ?? internalCollapsed
  const toggleCollapse = onToggleCollapse ?? (() => setInternalCollapsed((c) => !c))

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 w-[44px]">
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg text-hz-text-secondary hover:bg-hz-border/50 transition-colors"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <span className="mt-3 text-[11px] font-semibold text-hz-text-secondary tracking-wider [writing-mode:vertical-lr]">
          {title}
        </span>
        {activeCount > 0 && (
          <span className="mt-2 w-5 h-5 rounded-full bg-module-accent text-white text-[10px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-hz-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold">{title}</span>
          {activeCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-module-accent text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg text-hz-text-secondary hover:bg-hz-border/50 transition-colors"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">{children}</div>

      {/* Pinned footer */}
      {footer && <div className="px-4 py-3 border-t border-hz-border shrink-0">{footer}</div>}
    </div>
  )
}
