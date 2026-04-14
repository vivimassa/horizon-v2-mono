'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

/**
 * Exposes the panel's collapse setter to children rendered in the `footer`
 * slot (typically a <FilterGoButton>) so they can fold the panel away
 * after triggering a data load. Returns null when used outside a
 * <FilterPanel>, which is a valid no-op.
 */
interface FilterPanelContextValue {
  setCollapsed: (value: boolean) => void
}
const FilterPanelContext = createContext<FilterPanelContextValue | null>(null)

export function useFilterPanelControl(): FilterPanelContextValue | null {
  return useContext(FilterPanelContext)
}

interface FilterPanelProps {
  /** Panel title shown in the header. */
  title?: string
  /** Number of active (non-default) filters — shown as an accent badge. */
  activeCount?: number
  /** The scrollable body — compose `<FilterSection>` children here. */
  children: ReactNode
  /** The pinned footer area (typically a `<FilterGoButton>`). */
  footer?: ReactNode
  /** Controlled collapse state (optional). If omitted, panel manages its own. */
  collapsed?: boolean
  /** Collapse-state change callback. */
  onCollapsedChange?: (collapsed: boolean) => void
  /** Expanded width in px. Default 300. */
  width?: number
  /** Collapsed rail width in px. Default 44. */
  railWidth?: number
}

/**
 * Canonical filter panel shell for ops workspaces. Matches the SkyHub
 * glass aesthetic: 24px backdrop-filter blur, rounded-2xl, semi-opaque
 * surface. Collapses to a narrow vertical rail; clicking the rail
 * expands. Header shows a Filter icon, title, and an accent-tinted
 * active-filter count badge. Body is scrollable, footer is pinned.
 *
 * Pages compose this with FilterSection + field primitives:
 *   <FilterPanel activeCount={n} footer={<FilterGoButton ... />}>
 *     <FilterSection label="Period"><PeriodField ... /></FilterSection>
 *     <FilterSection label="Aircraft"><MultiSelectField ... /></FilterSection>
 *   </FilterPanel>
 */
export function FilterPanel({
  title = 'Filters',
  activeCount = 0,
  children,
  footer,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  width = 300,
  railWidth = 44,
}: FilterPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const collapsed = controlledCollapsed ?? internalCollapsed
  const setCollapsed = (v: boolean) => {
    if (onCollapsedChange) onCollapsedChange(v)
    else setInternalCollapsed(v)
  }

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  return (
    <FilterPanelContext.Provider value={{ setCollapsed }}>
      <div
        className="relative shrink-0 h-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: collapsed ? railWidth : width,
          transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          background: glassBg,
          border: `1px solid ${glassBorder}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Collapsed rail — click anywhere to expand */}
        <button
          type="button"
          className="absolute inset-0 flex flex-col items-center cursor-pointer hover:bg-hz-border/20 transition-colors focus:outline-none"
          onClick={() => {
            if (collapsed) setCollapsed(false)
          }}
          style={{
            opacity: collapsed ? 1 : 0,
            pointerEvents: collapsed ? 'auto' : 'none',
            transition: 'opacity 200ms ease',
          }}
          aria-label="Expand filters"
        >
          <div className="h-12 w-full flex items-center justify-center">
            <ChevronRight size={16} className="text-hz-text-secondary" />
          </div>
          <div
            className="flex-1 flex items-center justify-center"
            style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
          >
            <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">
              {title}
            </span>
          </div>
          {activeCount > 0 && (
            <span className="mb-3 px-2 py-0.5 rounded-full bg-module-accent text-white text-[11px] font-bold">
              {activeCount}
            </span>
          )}
        </button>

        {/* Expanded view */}
        <div
          className="flex flex-col h-full"
          style={{
            minWidth: width,
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? 'none' : 'auto',
            transition: 'opacity 200ms ease',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 shrink-0"
            style={{ minHeight: 48, borderBottom: `1px solid ${sectionBorder}` }}
          >
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-module-accent" />
              <span className="text-[15px] font-bold">{title}</span>
              {activeCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-module-accent text-white text-[13px] font-bold">
                  {activeCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-md hover:bg-hz-border/30 transition-colors focus:outline-none"
              aria-label="Collapse filters"
            >
              <ChevronLeft size={16} className="text-hz-text-tertiary" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${sectionBorder}` }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </FilterPanelContext.Provider>
  )
}
