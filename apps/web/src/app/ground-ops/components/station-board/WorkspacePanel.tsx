'use client'

import { Plane, LayoutDashboard, Package, Scale, MessageSquare, FileText, BadgeCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { StationFlight } from './types'
import { FlightHeader } from './FlightHeader'
import { OverviewTab } from './tabs/OverviewTab'
import { LoadingTab } from './tabs/LoadingTab'
import { WBTab } from './tabs/WBTab'
import { MessagesTab } from './tabs/MessagesTab'
import { DocsTab } from './tabs/DocsTab'
import { CaptainTab } from './tabs/CaptainTab'

interface WorkspacePanelProps {
  flight: StationFlight | null
  activeTab: string
  onTabChange: (tab: string) => void
  accent: string
  accentDark: string
  isDark: boolean
  glass: { panel: string; panelBorder: string; panelShadow: string }
}

const TABS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'loading', label: 'Loading', icon: Package },
  { key: 'wb', label: 'W&B', icon: Scale },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'docs', label: 'Documents', icon: FileText },
  { key: 'captain', label: 'Captain', icon: BadgeCheck },
]

export function WorkspacePanel({
  flight,
  activeTab,
  onTabChange,
  accent,
  accentDark,
  isDark,
  glass,
}: WorkspacePanelProps) {
  // Empty state
  if (!flight) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          borderRadius: 14,
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.3)'}`,
        }}
      >
        <div className="text-center">
          <Plane
            size={48}
            strokeWidth={1}
            style={{
              margin: '0 auto 12px',
              opacity: 0.15,
              color: isDark ? '#888' : '#555',
              transform: 'rotate(-45deg)',
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#ccc' : '#555' }}>Select a flight</div>
          <div
            style={{
              fontSize: 13,
              color: isDark ? '#777' : '#999',
              marginTop: 4,
              maxWidth: 260,
              lineHeight: 1.5,
            }}
          >
            Tap a flight from the list to open the workspace with Overview, Loading, W&B, Messages, and more
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{
        borderRadius: 14,
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${glass.panelBorder}`,
        boxShadow: glass.panelShadow,
        animation: 'ws-in 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <FlightHeader flight={flight} accent={accent} accentDark={accentDark} isDark={isDark} />

      {/* Tab bar — pill style with icons */}
      <div
        className="flex items-center gap-1"
        style={{
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          padding: '8px 16px',
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.3)',
        }}
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className="flex items-center gap-1.5 cursor-pointer transition-all duration-150"
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? accent : isDark ? '#888' : '#777',
                background: isActive ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)') : 'transparent',
                border: isActive
                  ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`
                  : '1px solid transparent',
                boxShadow: isActive ? (isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.06)') : 'none',
              }}
            >
              <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'overview' && <OverviewTab flight={flight} accent={accent} isDark={isDark} glass={glass} />}
        {activeTab === 'loading' && <LoadingTab isDark={isDark} />}
        {activeTab === 'wb' && <WBTab isDark={isDark} />}
        {activeTab === 'messages' && <MessagesTab accent={accent} isDark={isDark} glass={glass} />}
        {activeTab === 'docs' && <DocsTab accent={accent} isDark={isDark} glass={glass} />}
        {activeTab === 'captain' && <CaptainTab isDark={isDark} />}
      </div>

      <style>{`
        @keyframes ws-in {
          0% { opacity: 0; transform: translateX(20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
