'use client'

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

export function RowContextMenu() {
  const ctx = useGanttStore((s) => s.rowContextMenu)
  const close = useGanttStore((s) => s.closeRowContextMenu)
  const openRotation = useGanttStore((s) => s.openRotationPopover)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!ctx) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctx, close])

  useEffect(() => {
    if (!ctx) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [ctx, close])

  if (!mounted || !ctx) return null

  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const textColor = isDark ? '#18181b' : '#fafafa'
  const textMuted = isDark ? 'rgba(24,24,27,0.40)' : 'rgba(250,250,250,0.40)'
  const hoverBg = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'

  const menuW = 220
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = ctx.x + menuW > vpW ? vpW - menuW - 8 : ctx.x
  const top = ctx.y + 44 > vpH ? vpH - 52 : ctx.y

  return createPortal(
    <div
      ref={ref}
      data-gantt-overlay
      className="fixed z-[9999] rounded-xl py-1.5 overflow-hidden"
      style={{
        left,
        top,
        minWidth: 200,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        animation: 'bc-dropdown-in 100ms ease-out',
      }}
    >
      <button
        onClick={() => {
          openRotation(ctx.x, ctx.y, ctx.registration, ctx.aircraftTypeIcao, ctx.date)
          close()
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors"
        style={{ color: textColor }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hoverBg
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <RotateCcw size={14} className="shrink-0" strokeWidth={1.8} />
        <span className="flex-1 text-left">Daily Rotation</span>
        <span className="text-[11px] font-mono" style={{ color: textMuted }}>
          F5
        </span>
      </button>
    </div>,
    document.body,
  )
}
