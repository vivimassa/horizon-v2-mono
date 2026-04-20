'use client'

import { useTheme } from '@/components/theme-provider'
import { PairingListPanel } from './pairing-list-panel'
import { FlightPoolPanel } from './flight-pool-panel'
import { InspectorPanel } from './inspector-panel'

/**
 * Three-pane layout for the Crew Pairing Text workspace:
 *  [  List  |  Flight Pool (grid)  |  Inspector  ]
 *
 * The Flight Pool now renders a Scheduling-XL-style grid and needs the lion's
 * share of horizontal space. The side panels are capped so the grid always
 * gets at least ~55% of the workspace on ultrawide viewports.
 */
export function TextViewLayout() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const glassBg = isDark ? 'rgba(25,25,33,0.55)' : 'rgba(255,255,255,0.60)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const panelStyle: React.CSSProperties = {
    background: glassBg,
    border: `1px solid ${glassBorder}`,
    backdropFilter: 'blur(18px)',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.22)' : '0 8px 24px rgba(96,97,112,0.10)',
  }

  return (
    <div className="flex-1 min-h-0 flex gap-3">
      <div
        className="rounded-2xl overflow-hidden flex flex-col shrink-0"
        style={{ ...panelStyle, width: '20%', minWidth: 280, maxWidth: 360 }}
      >
        <PairingListPanel />
      </div>

      <div className="flex-1 min-w-0 rounded-2xl overflow-hidden flex flex-col" style={panelStyle}>
        <FlightPoolPanel />
      </div>

      <div
        className="rounded-2xl overflow-hidden flex flex-col shrink-0"
        style={{ ...panelStyle, width: '22%', minWidth: 320, maxWidth: 400 }}
      >
        <InspectorPanel />
      </div>
    </div>
  )
}
