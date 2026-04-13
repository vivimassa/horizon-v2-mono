'use client'

import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plane, Wrench, ClipboardList } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useStatusBoardStore } from '@/stores/use-status-board-store'

export function StatusBoardContextMenu() {
  const ctx = useStatusBoardStore((s) => s.contextMenu)
  const closeContextMenu = useStatusBoardStore((s) => s.closeContextMenu)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctx) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeContextMenu()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctx, closeContextMenu])

  useEffect(() => {
    if (!ctx) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [ctx, closeContextMenu])

  if (!ctx) return null

  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const textColor = isDark ? '#18181b' : '#fafafa'
  const textMuted = isDark ? 'rgba(24,24,27,0.40)' : 'rgba(250,250,250,0.40)'
  const hoverBg = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'

  const menuW = 260
  const menuH = 140
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = ctx.x + menuW > vpW ? vpW - menuW - 8 : ctx.x
  const top = ctx.y + menuH > vpH ? vpH - menuH - 8 : ctx.y

  const items = [
    {
      icon: Plane,
      label: 'Show Aircraft Details',
      onClick: () => {
        closeContextMenu()
      },
    },
    {
      icon: Wrench,
      label: 'Schedule Maintenance',
      onClick: () => {
        window.open(`/flight-ops/control/aircraft-maintenance/planning`, '_self')
        closeContextMenu()
      },
    },
    {
      icon: ClipboardList,
      label: 'Maintenance History',
      onClick: () => {
        closeContextMenu()
      },
    },
  ]

  return createPortal(
    <div ref={ref}>
      <div
        className="fixed z-[9999] rounded-xl py-1.5 overflow-hidden"
        style={{
          left,
          top,
          minWidth: 240,
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-1.5 text-[13px] font-semibold" style={{ color: textColor }}>
          {ctx.registration}
        </div>
        <div
          className="h-px mx-2 my-1"
          style={{ background: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}
        />

        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{ color: textColor, cursor: 'pointer' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hoverBg
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <item.icon size={14} strokeWidth={1.8} className="shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}
