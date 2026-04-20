'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FileText, CheckCircle2, X, Eye, Trash2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

type FlightGridContextMenuProps =
  | {
      variant: 'create'
      x: number
      y: number
      selectionCount: number
      onClose: () => void
      onCreateDraft: () => void
      onCreateFinal: () => void
      onClearSelection: () => void
    }
  | {
      variant: 'pairing'
      x: number
      y: number
      pairingCode: string
      onClose: () => void
      onInspect: () => void
      onDelete: () => void
    }

/**
 * Portalled right-click menu for the Flight Pool grid. Two variants:
 *
 * - `create`: right-click on an empty / uncovered cell. Offers Create Pairing
 *   as Draft / Final (from the current grid selection) + Clear Selection.
 * - `pairing`: right-click on a PAIRING column cell with a code. Offers
 *   Replicate / Inspect / Delete, scoped to that specific pairing.
 *
 * All items are keyboard-less — Escape or outside-click closes.
 */
export function FlightGridContextMenu(props: FlightGridContextMenuProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) props.onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onClose])

  const bg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textMuted = isDark ? '#8F90A6' : '#8F90A6'
  const hoverBg = isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.10)'
  const dangerHoverBg = isDark ? 'rgba(255,59,59,0.15)' : 'rgba(255,59,59,0.08)'

  const menuWidth = 240
  const menuHeight = 200
  const clampedX = Math.min(props.x, window.innerWidth - menuWidth - 4)
  const clampedY = Math.min(props.y, window.innerHeight - menuHeight - 4)

  return createPortal(
    <div
      ref={ref}
      className="fixed rounded-lg overflow-hidden"
      style={{
        left: clampedX,
        top: clampedY,
        width: menuWidth,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(18px)',
        boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.55)' : '0 12px 40px rgba(96,97,112,0.25)',
        zIndex: 1000,
      }}
    >
      {props.variant === 'create' ? (
        <CreateVariant {...props} textPrimary={textPrimary} textMuted={textMuted} hoverBg={hoverBg} border={border} />
      ) : (
        <PairingVariant
          {...props}
          textPrimary={textPrimary}
          textMuted={textMuted}
          hoverBg={hoverBg}
          dangerHoverBg={dangerHoverBg}
          border={border}
        />
      )}
    </div>,
    document.body,
  )
}

// ── Create variant (existing) ───────────────────────────────────────────
function CreateVariant({
  selectionCount,
  onCreateDraft,
  onCreateFinal,
  onClearSelection,
  onClose,
  textPrimary,
  textMuted,
  hoverBg,
  border,
}: Extract<FlightGridContextMenuProps, { variant: 'create' }> & {
  textPrimary: string
  textMuted: string
  hoverBg: string
  border: string
}) {
  const disabled = selectionCount === 0
  return (
    <>
      <Header
        title={
          selectionCount > 0
            ? `${selectionCount} flight${selectionCount === 1 ? '' : 's'} selected`
            : 'No flights selected'
        }
        textMuted={textMuted}
        border={border}
      />
      <MenuItem
        icon={<FileText size={14} strokeWidth={2} />}
        label="Create Pairing as Draft"
        onClick={() => {
          onCreateDraft()
          onClose()
        }}
        disabled={disabled}
        textPrimary={textPrimary}
        hoverBg={hoverBg}
      />
      <MenuItem
        icon={<CheckCircle2 size={14} strokeWidth={2.2} />}
        label="Create Pairing as Final"
        onClick={() => {
          onCreateFinal()
          onClose()
        }}
        disabled={disabled}
        accent
        hoverBg={hoverBg}
        textPrimary={textPrimary}
      />
      <Divider border={border} />
      <MenuItem
        icon={<X size={14} strokeWidth={2} />}
        label="Clear Selection"
        onClick={() => {
          onClearSelection()
          onClose()
        }}
        disabled={disabled}
        muted
        textPrimary={textMuted}
        hoverBg={hoverBg}
      />
    </>
  )
}

// ── Pairing variant (PAIRING cell right-click) ──────────────────────────
// Replicate lives on the Pairings panel now (canonical home for the action).
// This variant focuses on flight-pool operations against the covering pairing.
function PairingVariant({
  pairingCode,
  onInspect,
  onDelete,
  onClose,
  textPrimary,
  textMuted,
  hoverBg,
  dangerHoverBg,
  border,
}: Extract<FlightGridContextMenuProps, { variant: 'pairing' }> & {
  textPrimary: string
  textMuted: string
  hoverBg: string
  dangerHoverBg: string
  border: string
}) {
  return (
    <>
      <Header title={`Pairing ${pairingCode}`} textMuted={textMuted} border={border} accent />
      <MenuItem
        icon={<Eye size={14} strokeWidth={2} />}
        label="Inspect"
        onClick={() => {
          onInspect()
          onClose()
        }}
        textPrimary={textPrimary}
        hoverBg={hoverBg}
      />
      <Divider border={border} />
      <MenuItem
        icon={<Trash2 size={14} strokeWidth={2} />}
        label="Delete pairing"
        onClick={() => {
          onDelete()
          onClose()
        }}
        destructive
        textPrimary="#FF3B3B"
        hoverBg={dangerHoverBg}
      />
    </>
  )
}

// ── Small primitives ────────────────────────────────────────────────────
function Header({
  title,
  textMuted,
  border,
  accent,
}: {
  title: string
  textMuted: string
  border: string
  accent?: boolean
}) {
  return (
    <div
      className="px-3 py-1.5"
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: accent ? '#7c3aed' : textMuted,
        borderBottom: `1px solid ${border}`,
      }}
    >
      {title}
    </div>
  )
}

function Divider({ border }: { border: string }) {
  return <div style={{ borderTop: `1px solid ${border}` }} />
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  accent,
  muted,
  destructive,
  textPrimary,
  hoverBg,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  accent?: boolean
  muted?: boolean
  destructive?: boolean
  textPrimary: string
  hoverBg: string
}) {
  let color = textPrimary
  if (accent) color = '#7c3aed'
  else if (destructive) color = '#FF3B3B'
  else if (muted) color = textPrimary // passed-in already muted
  const fontWeight = accent || destructive ? 600 : 400

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color, fontSize: 13, fontWeight }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
