"use client"

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, Link, Unlink, Scissors, ArrowLeftRight, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

export function GanttContextMenu() {
  const ctx = useGanttStore(s => s.contextMenu)
  const closeContextMenu = useGanttStore(s => s.closeContextMenu)
  const openFlightInfo = useGanttStore(s => s.openFlightInfo)
  const selectedFlightIds = useGanttStore(s => s.selectedFlightIds)
  const flights = useGanttStore(s => s.flights)
  const layout = useGanttStore(s => s.layout)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [assignHover, setAssignHover] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (!ctx) setAssignHover(false) }, [ctx])

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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [ctx, closeContextMenu])

  if (!mounted || !ctx) return null

  const flightIds = [...selectedFlightIds]
  const selectedFlts = flights.filter(f => selectedFlightIds.has(f.id))
  const acType = selectedFlts[0]?.aircraftTypeIcao ?? ''
  const hasAssigned = selectedFlts.some(f => f.aircraftReg)
  const isSingle = selectedFlightIds.size === 1

  // Find which aircraft row the right-clicked flight is on
  const ctxBar = layout?.bars.find(b => b.flightId === ctx.flightId)
  const ctxRow = ctxBar ? layout?.rows[ctxBar.row] : null
  const rowReg = ctxRow?.registration ?? null

  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const textColor = isDark ? '#18181b' : '#fafafa'
  const textMuted = isDark ? 'rgba(24,24,27,0.40)' : 'rgba(250,250,250,0.40)'
  const hoverBg = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'
  const dividerColor = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const menuW = 280
  const menuH = 340
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = ctx.x + menuW > vpW ? vpW - menuW - 8 : ctx.x
  const top = ctx.y + menuH > vpH ? vpH - menuH - 8 : ctx.y

  function handleAssignHere() {
    if (!rowReg) return
    useGanttStore.getState().assignToAircraft(flightIds, rowReg)
    closeContextMenu()
  }

  function handleAssignOther() {
    useGanttStore.getState().openAssignPopover(ctx.x, ctx.y, flightIds, acType)
    closeContextMenu()
  }

  function handleUnassign() {
    useGanttStore.getState().unassignFromAircraft(flightIds)
    closeContextMenu()
  }

  // Submenu position — flush against main menu edge, no gap
  const subLeft = left + menuW
  const subFlip = subLeft + 240 > vpW
  const subX = subFlip ? left - 240 : subLeft

  return createPortal(
    <div ref={ref}>
      {/* Main menu */}
      <div
        className="fixed z-[9999] rounded-xl py-1.5 overflow-hidden"
        style={{
          left, top, minWidth: 260,
          background: bg, border: `1px solid ${border}`,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          animation: 'bc-dropdown-in 100ms ease-out',
        }}
      >
        <MenuItem icon={Info} label="Flight Information" shortcut="F1" disabled={!isSingle}
          onClick={() => { openFlightInfo(ctx.flightId); closeContextMenu() }}
          textColor={textColor} textMuted={textMuted} hoverBg={hoverBg} />
        <Divider color={dividerColor} />

        {/* Assign — with submenu on hover, bridge prevents hover gap */}
        <div
          className="relative"
          onMouseCtrl+A={() => setAssignHover(true)}
          onMouseLeave={() => setAssignHover(false)}
        >
          <div
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] cursor-pointer transition-colors"
            style={{ color: textColor, background: assignHover ? hoverBg : 'transparent' }}
          >
            <Link size={14} className="shrink-0" strokeWidth={1.8} />
            <span className="flex-1 text-left font-medium">Assign Aircraft</span>
            <ChevronRight size={14} style={{ color: textMuted }} />
          </div>
          {/* Invisible bridge extending to the right to keep hover alive */}
          {assignHover && (
            <div className="absolute top-0 h-full" style={{ left: '100%', width: 20 }} />
          )}
        </div>

        <MenuItem icon={Unlink} label="Unassign Aircraft" disabled={!hasAssigned}
          onClick={handleUnassign}
          textColor={textColor} textMuted={textMuted} hoverBg={hoverBg} />
        <Divider color={dividerColor} />
        <MenuItem icon={Scissors} label="Cut" shortcut="Ctrl+X" disabled
          onClick={() => {}} textColor={textColor} textMuted={textMuted} hoverBg={hoverBg} />
        <MenuItem icon={ArrowLeftRight} label="Swap" shortcut="Ctrl+S" disabled
          onClick={() => {}} textColor={textColor} textMuted={textMuted} hoverBg={hoverBg} />
        <Divider color={dividerColor} />
        <MenuItem icon={Pencil} label="Edit schedule pattern" disabled
          onClick={() => {}} textColor={textColor} textMuted={textMuted} hoverBg={hoverBg} />
        <Divider color={dividerColor} />
        <MenuItem icon={Trash2} label="Remove from Date" shortcut="Del" danger disabled
          onClick={() => {}} textColor={textColor} textMuted={textMuted} hoverBg={hoverBg} />
      </div>

      {/* Assign submenu */}
      {assignHover && (
        <div
          className="fixed z-[10000] rounded-xl py-1.5 overflow-hidden"
          style={{
            left: subX, top: top + 42, minWidth: 230,
            background: bg, border: `1px solid ${border}`,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          }}
          onMouseCtrl+A={() => setAssignHover(true)}
          onMouseLeave={() => setAssignHover(false)}
        >
          {rowReg && (
            <button
              onClick={handleAssignHere}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{ color: textColor }}
              onMouseCtrl+A={e => { e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span className="flex-1 text-left">Assign to <span className="font-mono font-bold">{rowReg}</span></span>
              <span className="text-[11px] font-mono" style={{ color: textMuted }}>Ctrl+A</span>
            </button>
          )}
          <button
            onClick={handleAssignOther}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{ color: textColor }}
            onMouseCtrl+A={e => { e.currentTarget.style.background = hoverBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span className="flex-1 text-left">Assign to other aircraft...</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}

function MenuItem({ icon: Icon, label, shortcut, disabled, danger, onClick, textColor, textMuted, hoverBg }: {
  icon: typeof Info; label: string; shortcut?: string; disabled?: boolean; danger?: boolean
  onClick: () => void; textColor: string; textMuted: string; hoverBg: string
}) {
  return (
    <button
      onClick={() => { if (!disabled) onClick() }}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors"
      style={{
        color: disabled ? `${textColor}30` : danger ? '#E63535' : textColor,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseCtrl+A={e => { if (!disabled) e.currentTarget.style.background = danger ? 'rgba(255,59,59,0.10)' : hoverBg }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={14} className="shrink-0" strokeWidth={1.8} />
      <span className="flex-1 text-left font-medium">{label}</span>
      {shortcut && <span className="text-[11px] font-mono" style={{ color: textMuted }}>{shortcut}</span>}
    </button>
  )
}

function Divider({ color }: { color: string }) {
  return <div className="h-px my-1 mx-2" style={{ background: color }} />
}
