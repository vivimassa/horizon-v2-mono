"use client"

import { useState, type ReactNode } from 'react'
import { Plus, Upload, Download, FileText, Search, Link2, ChevronUp, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'

interface CodeshareToolbarProps {
  hasSelection: boolean
  onNewAgreement: () => void
  onAddMapping?: () => void
  onBulkImport?: () => void
  onExportSsim?: () => void
  onSearch?: () => void
}

export function CodeshareToolbar({
  hasSelection, onNewAgreement, onAddMapping, onBulkImport, onExportSsim, onSearch,
}: CodeshareToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [collapsed, setCollapsed] = useState(false)

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'

  const toolbarItems = [
    { icon: Plus, label: 'New', tooltip: 'New agreement', onClick: onNewAgreement },
    { icon: Link2, label: 'Map', tooltip: 'Add mapping', onClick: hasSelection ? onAddMapping : undefined },
    { icon: Upload, label: 'Bulk', tooltip: 'Bulk import mappings', onClick: hasSelection ? onBulkImport : undefined },
    { icon: Download, label: 'SSIM', tooltip: 'Export SSIM', onClick: hasSelection ? onExportSsim : undefined },
    { icon: Search, label: 'Search', tooltip: 'Search mappings', onClick: onSearch },
  ]

  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{ height: collapsed ? 52 : 120, transition: 'height 250ms cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      {/* Collapsed: icon-only row */}
      {collapsed && (
        <div className="flex items-center gap-0.5 px-2" style={{ height: 52, animation: 'bc-dropdown-in 150ms ease-out' }}>
          {toolbarItems.map((item, i) => (
            <Tooltip key={i} content={item.tooltip ?? item.label}>
              <button
                onClick={item.onClick}
                disabled={!item.onClick}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <item.icon size={18} strokeWidth={1.6} />
              </button>
            </Tooltip>
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
            <RibbonBtn icon={Plus} label="New" onClick={onNewAgreement} isDark={isDark} hoverBg={hoverBg} tooltip="New agreement" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* Mapping */}
          <RibbonSection label="Mapping">
            <RibbonBtn icon={Link2} label="Add" onClick={hasSelection ? onAddMapping : undefined} isDark={isDark} hoverBg={hoverBg} tooltip="Add mapping" />
            <RibbonBtn icon={Upload} label="Bulk" onClick={hasSelection ? onBulkImport : undefined} isDark={isDark} hoverBg={hoverBg} tooltip="Bulk import" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* Export */}
          <RibbonSection label="Export">
            <RibbonBtn icon={Download} label="SSIM" onClick={hasSelection ? onExportSsim : undefined} isDark={isDark} hoverBg={hoverBg} tooltip="Export SSIM file" />
            <RibbonBtn icon={FileText} label="Copy" onClick={hasSelection ? onExportSsim : undefined} isDark={isDark} hoverBg={hoverBg} tooltip="Copy SSIM to clipboard" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* Navigate */}
          <RibbonSection label="Navigate">
            <RibbonBtn icon={Search} label="Search" onClick={onSearch} isDark={isDark} hoverBg={hoverBg} tooltip="Search mappings" />
          </RibbonSection>

          <div className="flex-1" />

          {/* Collapse toggle */}
          <div className="flex items-start pt-2 pr-2">
            <button onClick={() => setCollapsed(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-hz-border/20 transition-colors">
              <ChevronUp size={16} className="text-hz-text-tertiary" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Ribbon sub-components (matching 1.1.3 slot-toolbar pattern) ── */

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

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <div className="shrink-0 flex items-center" style={{ height: 72, alignSelf: 'center' }}>
      <div style={{ width: 1, height: '100%', background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }} />
    </div>
  )
}

function RibbonBtn({
  icon: Icon, label, onClick, isDark, hoverBg, tooltip, active,
}: {
  icon: LucideIcon; label: string; onClick?: () => void
  isDark: boolean; hoverBg: string; tooltip?: string; active?: boolean
}) {
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'
  return (
    <Tooltip content={tooltip ?? label}>
      <button
        onClick={onClick}
        disabled={!onClick}
        className="flex flex-col items-center justify-center gap-1 rounded-lg transition-colors disabled:opacity-30 relative"
        style={{
          width: 72, height: 72,
          background: active ? activeBg : undefined,
          color: active ? (isDark ? '#5B8DEF' : '#1e40af') : undefined,
        }}
        onMouseEnter={e => { if (!active && onClick) e.currentTarget.style.background = hoverBg }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? activeBg : 'transparent' }}
      >
        <Icon size={26} strokeWidth={1.4} />
        <span className="text-[13px] font-medium leading-none">{label}</span>
      </button>
    </Tooltip>
  )
}
