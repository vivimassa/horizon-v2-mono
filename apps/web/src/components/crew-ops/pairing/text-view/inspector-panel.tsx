'use client'

import { useMemo } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { useFlightGridSelection } from '@/stores/use-flight-grid-selection'
import { SelectionInspectorPanel } from './selection-inspector-panel'
import { InspectPairingPanel } from './inspect-pairing-panel'
import { ACCENT } from './inspector-helpers'

/**
 * Right pane of the Crew Pairing Text workspace. Three modes, routed by the
 * current state:
 *  - Idle: no grid selection AND no inspected pairing
 *  - Selection: grid has rows selected → live FDTL check
 *  - Inspect: user clicked a pairing in the list → show its details
 *
 * Selection always wins over an inspected pairing because the user is
 * actively building something new.
 */
export function InspectorPanel() {
  const selectedRowIds = useFlightGridSelection((s) => s.selectedRowIds)
  const inspectedPairingId = usePairingStore((s) => s.inspectedPairingId)
  const pairings = usePairingStore((s) => s.pairings)
  const flights = usePairingStore((s) => s.flights)

  const inspectedPairing = useMemo(
    () => (inspectedPairingId ? (pairings.find((p) => p.id === inspectedPairingId) ?? null) : null),
    [pairings, inspectedPairingId],
  )

  if (selectedRowIds.size > 0) return <SelectionInspectorPanel />
  if (inspectedPairing) return <InspectPairingPanel pairing={inspectedPairing} flights={flights} />
  return <IdleState />
}

function IdleState() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textPrimary = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.50)' : 'rgba(71,85,105,0.70)'
  const bgIcon = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'

  return (
    <div className="flex flex-col h-full items-center justify-center px-8 text-center gap-3">
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{ width: 56, height: 56, background: bgIcon }}
      >
        <MousePointerClick size={24} strokeWidth={1.8} style={{ color: ACCENT }} />
      </div>
      <div>
        <h3 className="text-[14px] font-bold mb-1" style={{ color: textPrimary }}>
          Inspector
        </h3>
        <p className="text-[12px] leading-relaxed max-w-[260px]" style={{ color: textSecondary }}>
          Drag-select flights in the Flight Pool to build a pairing, or pick an existing pairing in the list on the
          left.
        </p>
      </div>
    </div>
  )
}
