'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Copy, FileText, Trash2, Eye } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface PairingRowContextMenuProps {
  x: number
  y: number
  pairingCode: string
  onClose: () => void
  /** Open the full Pairing Details dialog. */
  onShowDetails: () => void
  onReplicate: () => void
  onInspect: () => void
  onDelete: () => void
}

/**
 * Right-click menu on a row of the Pairings panel. Four actions:
 *  - Pairing Details…          (opens the full modal — metrics + legs + crew)
 *  - Replicate across period…  (primary path — spreads the pattern across days)
 *  - Inspect                   (routes the Inspector side panel to this pairing)
 *  - Delete pairing            (destructive, with confirm in the handler)
 */
export function PairingRowContextMenu({
  x,
  y,
  pairingCode,
  onClose,
  onShowDetails,
  onReplicate,
  onInspect,
  onDelete,
}: PairingRowContextMenuProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const bg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const hoverBg = isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.10)'
  const dangerHoverBg = isDark ? 'rgba(255,59,59,0.15)' : 'rgba(255,59,59,0.08)'

  const menuWidth = 240
  const menuHeight = 240
  const clampedX = Math.max(4, Math.min(x, window.innerWidth - menuWidth - 4))
  const clampedY = Math.max(4, Math.min(y, window.innerHeight - menuHeight - 4))

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
      <div
        className="px-3 py-1.5"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#7c3aed',
          borderBottom: `1px solid ${border}`,
        }}
      >
        Pairing {pairingCode}
      </div>
      <Item
        icon={<FileText size={14} strokeWidth={2.2} />}
        label="Pairing Details"
        kbd="Ctrl+F1"
        onClick={() => {
          onShowDetails()
          onClose()
        }}
        textPrimary={textPrimary}
        hoverBg={hoverBg}
      />
      <Item
        icon={<Copy size={14} strokeWidth={2.2} />}
        label="Replicate across period"
        kbd="Ctrl+C"
        onClick={() => {
          onReplicate()
          onClose()
        }}
        textPrimary={textPrimary}
        hoverBg={hoverBg}
      />
      <Item
        icon={<Eye size={14} strokeWidth={2} />}
        label="Inspect"
        onClick={() => {
          onInspect()
          onClose()
        }}
        textPrimary={textPrimary}
        hoverBg={hoverBg}
      />
      <div style={{ borderTop: `1px solid ${border}` }} />
      <Item
        icon={<Trash2 size={14} strokeWidth={2} />}
        label="Delete pairing"
        destructive
        onClick={() => {
          onDelete()
          onClose()
        }}
        textPrimary="#FF3B3B"
        hoverBg={dangerHoverBg}
      />
    </div>,
    document.body,
  )
}

function Item({
  icon,
  label,
  kbd,
  accent,
  destructive,
  onClick,
  textPrimary,
  hoverBg,
}: {
  icon: React.ReactNode
  label: string
  kbd?: string
  accent?: boolean
  destructive?: boolean
  onClick: () => void
  textPrimary: string
  hoverBg: string
}) {
  const color = destructive ? '#FF3B3B' : accent ? '#7c3aed' : textPrimary
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
      style={{ color, fontSize: 13, fontWeight: accent || destructive ? 600 : 400 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {kbd && (
        <span className="text-[11px] font-mono text-hz-text-tertiary" style={{ fontWeight: 500 }}>
          {kbd}
        </span>
      )}
    </button>
  )
}
