"use client"

import { forwardRef, useState, type ReactNode } from 'react'
import {
  Plus, CalendarSync, Download, FileText, Upload,
  Search, Clock, LayoutGrid, List,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'

interface SlotToolbarProps {
  onNewRequest?: () => void
  onImportSchedule?: () => void
  onImportSAL?: () => void
  onGenerateSCR?: () => void
  onExport?: () => void
  onSearch?: () => void
  showSlotFlags: boolean
  onToggleSlotFlags: () => void
  viewMode: 'grid' | 'list'
  onToggleViewMode: () => void
}

export function SlotToolbar({
  onNewRequest, onImportSchedule, onImportSAL, onGenerateSCR, onExport,
  onSearch, showSlotFlags, onToggleSlotFlags, viewMode, onToggleViewMode,
}: SlotToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [collapsed, setCollapsed] = useState(false)

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'

  // All toolbar items for collapsed mode
  const toolbarItems = [
    { icon: Plus, label: 'New', tooltip: 'New slot request', onClick: onNewRequest },
    { icon: CalendarSync, label: 'Import', tooltip: 'Import from schedule', onClick: onImportSchedule },
    { icon: Download, label: 'SAL', tooltip: 'Import SAL message', onClick: onImportSAL },
    { icon: FileText, label: 'SCR', tooltip: 'Generate SCR message', onClick: onGenerateSCR },
    { icon: Upload, label: 'Export', tooltip: 'Export slot data', onClick: onExport },
    { icon: viewMode === 'grid' ? List : LayoutGrid, label: viewMode === 'grid' ? 'List' : 'Grid', tooltip: viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view', onClick: onToggleViewMode },
    { icon: Search, label: 'Search', tooltip: 'Search flights', onClick: onSearch },
  ]

  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        height: collapsed ? 52 : 120,
        transition: 'height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Collapsed: icon-only row */}
      {collapsed && (
        <div className="flex items-center gap-0.5 px-2" style={{ height: 52, animation: 'bc-dropdown-in 150ms ease-out' }}>
          {toolbarItems.map((item, i) => (
            <div key={i} className="relative">
              <Tooltip content={item.tooltip ?? item.label}>
                <button
                  onClick={item.onClick}
                  disabled={!item.onClick}
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                  style={{
                    background: item.active ? activeBg : undefined,
                    color: item.active ? (isDark ? '#5B8DEF' : '#1e40af') : undefined,
                  }}
                  onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = hoverBg }}
                  onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = item.active ? activeBg : 'transparent' }}
                >
                  <item.icon size={18} strokeWidth={1.6} />
                </button>
              </Tooltip>
            </div>
          ))}
          <div className="flex-1" />
          <button onClick={() => setCollapsed(false)} className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-hz-border/20 transition-colors">
            <ChevronDown size={16} className="text-hz-text-tertiary" />
          </button>
        </div>
      )}

      {/* Expanded: ribbon layout */}
      {!collapsed && (
        <div className="flex items-stretch gap-0 w-full" style={{ minHeight: 120, animation: 'bc-dropdown-in 150ms ease-out' }}>
          {/* Data */}
          <RibbonSection label="Data">
            <RibbonBtn icon={Plus} label="New" onClick={onNewRequest} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg} tooltip="New slot request" />
            <RibbonBtn icon={CalendarSync} label="Import" onClick={onImportSchedule} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg} tooltip="Import from schedule" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* Messages */}
          <RibbonSection label="Messages">
            <RibbonBtn icon={Download} label="SAL" onClick={onImportSAL} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg} tooltip="Import SAL message" />
            <RibbonBtn icon={FileText} label="SCR" onClick={onGenerateSCR} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg} tooltip="Generate SCR message" />
            <RibbonBtn icon={Upload} label="Export" onClick={onExport} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg} tooltip="Export slot data" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* Display */}
          <RibbonSection label="Display">
            <RibbonBtn icon={viewMode === 'grid' ? List : LayoutGrid} label={viewMode === 'grid' ? 'List' : 'Grid'}
              onClick={onToggleViewMode} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'} />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* Navigate */}
          <RibbonSection label="Navigate">
            <RibbonBtn icon={Search} label="Search" onClick={onSearch} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg} tooltip="Search flights" />
          </RibbonSection>

          <div className="flex-1" />

          {/* Collapse toggle */}
          <div className="flex items-start pt-2 pr-2">
            <button onClick={() => setCollapsed(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-hz-border/20 transition-colors">
              <ChevronUp size={14} className="text-hz-text-tertiary" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Ribbon sub-components (matching 1.1.2 pattern) ── */

function RibbonSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center self-stretch justify-between pt-2 pb-1.5 px-3">
      <div className="flex items-center justify-center gap-2 flex-1">
        {children}
      </div>
      <div className="w-full text-center border-t border-hz-border/20 pt-0.5 mt-0.5">
        <span className="text-[13px] text-hz-text-tertiary/50 font-medium leading-none whitespace-nowrap">{label}</span>
      </div>
    </div>
  )
}

const RibbonBtn = forwardRef<HTMLButtonElement, {
  icon: LucideIcon; label: string; onClick?: () => void; active?: boolean; disabled?: boolean
  isDark: boolean; hoverBg: string; activeBg: string; tooltip?: string; badge?: number
}>(({ icon: Icon, label, onClick, active, disabled, isDark, hoverBg, activeBg, tooltip, badge }, ref) => {
  return (
    <Tooltip content={tooltip ?? label}>
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled || !onClick}
        className="flex flex-col items-center justify-center gap-1 rounded-lg transition-colors disabled:opacity-30 relative"
        style={{
          width: 72, height: 72,
          background: active ? activeBg : undefined,
          color: active ? (isDark ? '#5B8DEF' : '#1e40af') : undefined,
        }}
        onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = hoverBg }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? activeBg : 'transparent' }}
      >
        <Icon size={26} strokeWidth={1.4} />
        <span className="text-[13px] font-medium leading-none">{label}</span>
        {badge != null && badge > 0 && (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-module-accent text-white text-[13px] font-bold leading-none">
            {badge}
          </span>
        )}
      </button>
    </Tooltip>
  )
})
RibbonBtn.displayName = 'RibbonBtn'

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <div className="shrink-0 flex items-center" style={{ height: 72, alignSelf: 'center' }}>
      <div style={{ width: 1, height: '100%', background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }} />
    </div>
  )
}
