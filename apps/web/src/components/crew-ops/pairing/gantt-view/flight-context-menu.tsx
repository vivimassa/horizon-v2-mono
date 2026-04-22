'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Eye } from 'lucide-react'
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
 */
export function FlightContextMenu({ x, y, flightId, onClose }: FlightContextMenuProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const flight = usePairingStore((s) => s.flights.find((f) => f.id === flightId) ?? null)
  const pairings = usePairingStore((s) => s.pairings)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)

  // All pairings that include this flight as a non-deadhead leg — client-side
  // scan so the menu surfaces every covering pairing regardless of whether
  // the server-returned `flight.pairingId` hint is missing / stale / filtered.
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
  const menuH = coveringPairings.length > 0 ? 56 + coveringPairings.length * 36 : 70
  const left = Math.min(x, window.innerWidth - menuW - 8)
  const top = Math.min(y, window.innerHeight - menuH - 8)

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

  return createPortal(
    <div
      data-pairing-ctx-menu
      className="fixed rounded-xl overflow-hidden"
      style={{
        left,
        top,
        width: menuW,
        zIndex: 10000,
        background: isDark ? 'rgba(20,20,28,0.98)' : 'rgba(255,255,255,0.99)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        boxShadow: '0 20px 48px rgba(0,0,0,0.32)',
        backdropFilter: 'blur(16px)',
      }}
    >
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
        {coveringPairings.length > 0 ? (
          coveringPairings.map((p, i) => (
            <Item
              key={p.id}
              icon={<Eye size={14} />}
              label={coveringPairings.length === 1 ? 'Show pairing' : `Show ${p.pairingCode}`}
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
