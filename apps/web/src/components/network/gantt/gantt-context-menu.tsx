"use client"

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, Link, Unlink, Scissors, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

export function GanttContextMenu() {
  const ctx = useGanttStore(s => s.contextMenu)
  const closeContextMenu = useGanttStore(s => s.closeContextMenu)
  const openFlightInfo = useGanttStore(s => s.openFlightInfo)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Close on outside click
  useEffect(() => {
    if (!ctx) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeContextMenu()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctx, closeContextMenu])

  // Close on Escape
  useEffect(() => {
    if (!ctx) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [ctx, closeContextMenu])

  if (!mounted || !ctx) return null

  const items: { icon: typeof Info; label: string; shortcut?: string; onClick: () => void; danger?: boolean; disabled?: boolean; divider?: boolean }[] = [
    { icon: Info, label: 'Flight Information', shortcut: 'F1', onClick: () => openFlightInfo(ctx.flightId) },
    { icon: Info, label: '', shortcut: '', onClick: () => {}, divider: true },
    { icon: Link, label: 'Assign Aircraft Registration', shortcut: 'Ctrl+A', onClick: () => {}, disabled: true },
    { icon: Unlink, label: 'Unassign Aircraft Registration', onClick: () => {}, disabled: true },
    { icon: Info, label: '', shortcut: '', onClick: () => {}, divider: true },
    { icon: Scissors, label: 'Cut', shortcut: 'Ctrl+X', onClick: () => {}, disabled: true },
    { icon: ArrowLeftRight, label: 'Swap', shortcut: 'Ctrl+S', onClick: () => {}, disabled: true },
    { icon: Info, label: '', shortcut: '', onClick: () => {}, divider: true },
    { icon: Pencil, label: 'Edit schedule pattern', onClick: () => {}, disabled: true },
    { icon: Info, label: '', shortcut: '', onClick: () => {}, divider: true },
    { icon: Trash2, label: 'Remove from Date', shortcut: 'Del', onClick: () => {}, danger: true, disabled: true },
  ]

  // Inverted glass: dark bg in light mode, light bg in dark mode
  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const textColor = isDark ? '#18181b' : '#fafafa'
  const textMuted = isDark ? 'rgba(24,24,27,0.40)' : 'rgba(250,250,250,0.40)'
  const hoverBg = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'
  const dividerColor = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  // Clamp to viewport
  const menuW = 280
  const menuH = 340
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = ctx.x + menuW > vpW ? vpW - menuW - 8 : ctx.x
  const top = ctx.y + menuH > vpH ? vpH - menuH - 8 : ctx.y

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] rounded-xl py-1.5 overflow-hidden"
      style={{
        left, top, minWidth: 260,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        animation: 'bc-dropdown-in 100ms ease-out',
      }}
    >
      {items.map((item, i) => {
        if (item.divider) return <div key={i} className="h-px my-1 mx-2" style={{ background: dividerColor }} />
        const Icon = item.icon
        return (
          <button
            key={i}
            onClick={() => { if (!item.disabled) { item.onClick(); closeContextMenu() } }}
            disabled={item.disabled}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors"
            style={{
              color: item.disabled ? `${textColor}30` : item.danger ? '#E63535' : textColor,
              cursor: item.disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={e => { if (!item.disabled) (e.currentTarget.style.background = item.danger ? 'rgba(255,59,59,0.10)' : hoverBg) }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Icon size={14} className="shrink-0" strokeWidth={1.8} />
            <span className="flex-1 text-left font-medium">{item.label}</span>
            {item.shortcut && <span className="text-[11px] font-mono" style={{ color: textMuted }}>{item.shortcut}</span>}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
