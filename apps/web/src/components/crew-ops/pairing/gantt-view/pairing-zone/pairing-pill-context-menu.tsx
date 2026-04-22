'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Trash2, FileText, Copy, Pencil } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'

interface PairingPillContextMenuProps {
  x: number
  y: number
  pairingId: string
  onClose: () => void
  /** Opens the shared `PairingDetailsDialog` — state lives in the canvas. */
  onShowDetails: (pairingId: string) => void
  /** Opens the shared `DeletePairingDialog` — state lives in the canvas. */
  onRequestDelete: (pairingId: string) => void
  /** Opens `ReplicatePairingDialog` — state lives in the canvas. */
  onReplicate: (pairingId: string) => void
  /** Enters Edit mode: seeds build chain with the pairing's legs + complement. */
  onEdit: (pairingId: string) => void
}

/**
 * Right-click menu on a pairing pill.
 *   • Show Flights — selects the pairing's legs, scrolls the canvas to the
 *     first leg's aircraft row, and opens the pairing in the inspector.
 *   • Delete Pairing — calls `api.deletePairing` and drops it from the store.
 *   • Bulk Delete — Phase 4 stub (disabled).
 */
export function PairingPillContextMenu({
  x,
  y,
  pairingId,
  onClose,
  onShowDetails,
  onRequestDelete,
  onReplicate,
  onEdit,
}: PairingPillContextMenuProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const pairing = usePairingStore((s) => s.pairings.find((p) => p.id === pairingId) ?? null)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)

  function handleDelete() {
    if (!pairing) return
    onRequestDelete(pairing.id)
  }

  function handleShowFlights() {
    if (!pairing || pairing.legs.length === 0) return
    // Select the pairing's legs so the canvas draws the red selection ring + glow.
    const gantt = usePairingGanttStore.getState()
    gantt.clearSearchHighlight()
    const selected = new Set(pairing.legs.map((l) => l.flightId))
    usePairingGanttStore.setState({ selectedFlightIds: selected })
    // Scroll horizontally to the first leg's STD — canvas centers on this ms.
    const first = pairing.legs[0]
    const firstStdIso = first.stdUtcIso ?? first.stdUtc ?? null
    if (firstStdIso) {
      const stdMs = Date.parse(firstStdIso)
      if (Number.isFinite(stdMs)) gantt.setScrollTarget(stdMs)
    }
    // Surface the pairing in the inspector.
    inspectPairing(pairingId)
  }

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

  if (typeof document === 'undefined' || !pairing) return null

  const menuW = 240
  // Conservative upper bound for menu height — header + 5 items + divider.
  // Must be ≥ actual rendered height so viewport-edge clamping doesn't clip
  // the last row (was 160 when only 3 items existed).
  const menuH = 300
  const left = Math.max(8, Math.min(x, window.innerWidth - menuW - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - menuH - 8))

  function Item({
    icon,
    label,
    kbd,
    onClick,
    disabled,
    danger,
  }: {
    icon: React.ReactNode
    label: string
    kbd?: string
    onClick?: () => void
    disabled?: boolean
    danger?: boolean
  }) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          onClick?.()
          onClose()
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors"
        style={{
          color: disabled ? 'var(--hz-text-tertiary)' : danger ? '#DC2626' : 'var(--hz-text)',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          if (disabled) return
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
        {pairing.pairingCode}
      </div>
      <div className="py-1">
        <Item
          icon={<FileText size={14} />}
          label="Pairing Details"
          kbd="Ctrl+F1"
          onClick={() => onShowDetails(pairingId)}
        />
        <Item icon={<Pencil size={14} />} label="Edit Pairing" kbd="Ctrl+E" onClick={() => onEdit(pairingId)} />
        <Item icon={<Copy size={14} />} label="Replicate" kbd="Ctrl+R" onClick={() => onReplicate(pairingId)} />
        <Item icon={<Eye size={14} />} label="Show Flights" kbd="Ctrl+↑" onClick={handleShowFlights} />
        <div className="my-1 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
        <Item icon={<Trash2 size={14} />} label="Delete Pairing" kbd="Del" onClick={handleDelete} danger />
        <Item icon={<Trash2 size={14} />} label="Bulk Delete…" kbd="Ctrl+D" disabled danger />
      </div>
    </div>,
    document.body,
  )
}
