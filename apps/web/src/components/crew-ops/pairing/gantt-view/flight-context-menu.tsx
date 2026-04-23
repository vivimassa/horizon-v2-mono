'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Plus, Minus, Plane, PlaneLanding } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'

interface FlightContextMenuProps {
  x: number
  y: number
  flightId: string
  onClose: () => void
}

/**
 * Right-click menu on a flight bar. Portaled to body, clamps to viewport,
 * closes on outside click or Escape.
 *
 * In build mode: shows chain management items (add/remove/mark DH).
 * Outside build mode: shows "Show pairing" if the flight has one.
 */
export function FlightContextMenu({ x, y, flightId, onClose }: FlightContextMenuProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const flight = usePairingStore((s) => s.flights.find((f) => f.id === flightId) ?? null)
  const pairings = usePairingStore((s) => s.pairings)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)

  const buildMode = usePairingGanttStore((s) => s.buildMode)
  const selectedFlightIds = usePairingGanttStore((s) => s.selectedFlightIds)
  const deadheadFlightIds = usePairingGanttStore((s) => s.deadheadFlightIds)
  const selectFlight = usePairingGanttStore((s) => s.selectFlight)
  const toggleDeadheadFlight = usePairingGanttStore((s) => s.toggleDeadheadFlight)

  const isInChain = selectedFlightIds.has(flightId)
  const isDeadhead = deadheadFlightIds.has(flightId)

  // Pairings covering this flight (for non-build "Show pairing" items)
  const coveringPairings = pairings.filter((p) => {
    if (!flight) return false
    if (!p.flightIds.includes(flight.id) && p.id !== flight.pairingId) return false
    if (p.deadheadFlightIds.includes(flight.id)) return false
    return true
  })

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-pairing-ctx-menu]')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (typeof document === 'undefined' || !flight) return null

  const menuW = 240

  function Item({
    icon,
    label,
    kbd,
    onClick,
    danger,
  }: {
    icon: React.ReactNode
    label: string
    kbd?: string
    onClick: () => void
    danger?: boolean
  }) {
    return (
      <button
        type="button"
        onClick={() => {
          onClick()
          onClose()
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors"
        style={{
          color: danger ? '#DC2626' : 'var(--hz-text)',
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {kbd && <span className="text-[11px] font-mono text-hz-text-tertiary">{kbd}</span>}
      </button>
    )
  }

  function Divider() {
    return (
      <div
        style={{
          height: 1,
          margin: '2px 12px',
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        }}
      />
    )
  }

  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - menuW - 8),
    top: 0, // computed below
    width: menuW,
    zIndex: 10000,
    background: isDark ? 'rgba(20,20,28,0.98)' : 'rgba(255,255,255,0.99)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
    boxShadow: '0 20px 48px rgba(0,0,0,0.32)',
    backdropFilter: 'blur(16px)',
  }

  // Estimate height to clamp top
  let estimatedRows = 0
  if (buildMode) {
    estimatedRows = isInChain ? 2 : 2
    if (coveringPairings.length > 0) estimatedRows += 1 + coveringPairings.length
  } else {
    estimatedRows = coveringPairings.length > 0 ? coveringPairings.length : 0
  }
  const menuH = 40 + estimatedRows * 36
  menuStyle.top = Math.min(y, window.innerHeight - menuH - 8)

  return createPortal(
    <div data-pairing-ctx-menu className="fixed rounded-xl overflow-hidden" style={menuStyle}>
      {/* Header: flight number + sector */}
      <div
        className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold"
        style={{
          color: 'var(--hz-text-tertiary)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
        }}
      >
        {flight.flightNumber} · {flight.departureAirport}-{flight.arrivalAirport}
      </div>

      <div className="py-1">
        {buildMode ? (
          <>
            {/* Show Pairing — always first when available */}
            {coveringPairings.map((p, i) => (
              <Item
                key={p.id}
                icon={<Eye size={14} />}
                label={coveringPairings.length === 1 ? 'Show Pairing' : `Show ${p.pairingCode}`}
                kbd={i === 0 ? 'Ctrl+P' : undefined}
                onClick={() => inspectPairing(p.id)}
              />
            ))}
            {coveringPairings.length > 0 && <Divider />}

            {isInChain ? (
              <>
                <Item
                  icon={isDeadhead ? <Plane size={14} /> : <PlaneLanding size={14} />}
                  label={isDeadhead ? 'Mark as Operating' : 'Mark as Deadhead'}
                  kbd="D"
                  onClick={() => toggleDeadheadFlight(flightId)}
                />
                <Item
                  icon={<Minus size={14} />}
                  label="Remove from rotation"
                  danger
                  onClick={() => {
                    selectFlight(flightId, true)
                    if (deadheadFlightIds.has(flightId)) toggleDeadheadFlight(flightId)
                  }}
                />
              </>
            ) : (
              <>
                <Item icon={<Plus size={14} />} label="Add to rotation" onClick={() => selectFlight(flightId, true)} />
                <Item
                  icon={<PlaneLanding size={14} />}
                  label="Add as Deadhead"
                  onClick={() => {
                    selectFlight(flightId, true)
                    toggleDeadheadFlight(flightId)
                  }}
                />
              </>
            )}
          </>
        ) : coveringPairings.length > 0 ? (
          coveringPairings.map((p, i) => (
            <Item
              key={p.id}
              icon={<Eye size={14} />}
              label={coveringPairings.length === 1 ? 'Show Pairing' : `Show ${p.pairingCode}`}
              kbd={i === 0 ? 'Ctrl+P' : undefined}
              onClick={() => inspectPairing(p.id)}
            />
          ))
        ) : (
          <div className="px-3 py-2 text-[12px] italic" style={{ color: 'var(--hz-text-tertiary)' }}>
            No pairing covers this flight.
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
