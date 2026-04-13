'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info, Link, Unlink, ArrowLeftRight, Trash2, ChevronRight, Clock, ShieldCheck, ShieldOff } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

export function GanttContextMenu() {
  const ctx = useGanttStore((s) => s.contextMenu)
  const closeContextMenu = useGanttStore((s) => s.closeContextMenu)
  const openFlightInfo = useGanttStore((s) => s.openFlightInfo)
  const selectedFlightIds = useGanttStore((s) => s.selectedFlightIds)
  const flights = useGanttStore((s) => s.flights)
  const layout = useGanttStore((s) => s.layout)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [assignHover, setAssignHover] = useState(false)
  const leaveTimer = useRef<number | null>(null)

  const enterAssign = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    setAssignHover(true)
  }, [])

  const leaveAssign = useCallback(() => {
    leaveTimer.current = window.setTimeout(() => setAssignHover(false), 120)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!ctx) {
      setAssignHover(false)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }
  }, [ctx])

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

  if (!mounted || !ctx) return null

  const flightIds = [...selectedFlightIds]
  const selectedFlts = flights.filter((f) => selectedFlightIds.has(f.id))
  const acType = selectedFlts[0]?.aircraftTypeIcao ?? ''
  const hasAssigned = selectedFlts.some((f) => f.aircraftReg)
  const isSingle = selectedFlightIds.size === 1
  const allProtected = selectedFlts.length > 0 && selectedFlts.every((f) => f.isProtected)

  // Find which aircraft row the right-clicked flight is on
  const ctxBar = layout?.bars.find((b) => b.flightId === ctx.flightId)
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

  // Submenu position — 2px gap from main menu edge for visual cohesion
  const menuVisualW = 264 // actual rendered width (~minWidth 260 + border)
  const subGap = 0
  const subLeft = left + menuVisualW + subGap
  const subFlip = subLeft + 240 > vpW
  const subX = subFlip ? left - 240 - subGap : subLeft

  // Vertical alignment: "Assign Aircraft" row is the 3rd item (after FlightInfo + divider)
  // Each item ~30px, divider ~10px → row top offset ~42px from menu top
  const assignRowTop = top + 42

  return createPortal(
    <div ref={ref} data-gantt-overlay>
      {/* Main menu */}
      <div
        className="fixed z-[9999] rounded-xl py-1.5 overflow-hidden"
        style={{
          left,
          top,
          minWidth: 260,
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          animation: 'bc-dropdown-in 100ms ease-out',
        }}
      >
        <MenuItem
          icon={Info}
          label="Flight Information"
          shortcut="F1"
          disabled={!isSingle}
          onClick={() => {
            openFlightInfo(ctx.flightId)
            closeContextMenu()
          }}
          textColor={textColor}
          textMuted={textMuted}
          hoverBg={hoverBg}
        />
        <MenuItem
          icon={Clock}
          label="Slot Details"
          disabled={!isSingle || !selectedFlts[0]?.slotStatus}
          onClick={() => {
            window.open('/network/schedule/slot-manager', '_blank')
            closeContextMenu()
          }}
          textColor={textColor}
          textMuted={textMuted}
          hoverBg={hoverBg}
        />
        <Divider color={dividerColor} />

        {/* Assign Aircraft — hover triggers submenu */}
        <div className="relative" onMouseEnter={enterAssign} onMouseLeave={leaveAssign}>
          <div
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] cursor-pointer transition-colors"
            style={{ color: textColor, background: assignHover ? hoverBg : 'transparent' }}
          >
            <Link size={14} className="shrink-0" strokeWidth={1.8} />
            <span className="flex-1 text-left font-medium">Assign Aircraft</span>
            <ChevronRight size={14} style={{ color: textMuted }} />
          </div>
        </div>

        <MenuItem
          icon={Unlink}
          label="Unassign Aircraft"
          shortcut="Alt+D"
          disabled={!hasAssigned}
          onClick={handleUnassign}
          textColor={textColor}
          textMuted={textMuted}
          hoverBg={hoverBg}
        />
        <Divider color={dividerColor} />
        <MenuItem
          icon={ArrowLeftRight}
          label="Swap"
          shortcut="Alt+S"
          onClick={() => {
            useGanttStore.getState().enterSwapMode()
            closeContextMenu()
          }}
          textColor={textColor}
          textMuted={textMuted}
          hoverBg={hoverBg}
        />
        <Divider color={dividerColor} />
        <MenuItem
          icon={allProtected ? ShieldOff : ShieldCheck}
          label={allProtected ? 'Remove Protection' : 'Protect Flight'}
          onClick={() => {
            useGanttStore.getState().toggleProtection(flightIds, !allProtected)
          }}
          textColor={textColor}
          textMuted={textMuted}
          hoverBg={hoverBg}
        />
        <Divider color={dividerColor} />
        <MenuItem
          icon={Trash2}
          label="Cancel Flight(s)"
          shortcut="Del"
          danger
          onClick={() => {
            useGanttStore.getState().openCancelDialog([...selectedFlightIds])
          }}
          textColor={textColor}
          textMuted={textMuted}
          hoverBg={hoverBg}
        />
      </div>

      {/* Assign submenu — outside main menu to avoid overflow clip, uses timer to bridge gap */}
      {assignHover && (
        <div onMouseEnter={enterAssign} onMouseLeave={leaveAssign}>
          {/* Invisible bridge covering the 4px gap between menus */}
          <div
            className="fixed z-[9999]"
            style={{
              left: subFlip ? subX + 230 : left + menuVisualW,
              top: assignRowTop,
              width: subGap,
              height: 60,
            }}
          />
          <div
            className="fixed z-[10000] rounded-xl py-1.5 overflow-hidden"
            style={{
              left: subX,
              top: assignRowTop,
              minWidth: 230,
              background: bg,
              border: `1px solid ${border}`,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {rowReg && (
              <button
                onClick={handleAssignHere}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors"
                style={{ color: textColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span className="flex-1 text-left">
                  Assign to <span className="font-mono font-bold">{rowReg}</span>
                </span>
                <span className="text-[11px] font-mono" style={{ color: textMuted }}>
                  Alt+A
                </span>
              </button>
            )}
            <button
              onClick={handleAssignOther}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{ color: textColor }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hoverBg
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span className="flex-1 text-left">Assign to other aircraft...</span>
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  disabled,
  danger,
  onClick,
  textColor,
  textMuted,
  hoverBg,
}: {
  icon: typeof Info
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  textColor: string
  textMuted: string
  hoverBg: string
}) {
  return (
    <button
      onClick={() => {
        if (!disabled) onClick()
      }}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors"
      style={{
        color: disabled ? `${textColor}30` : danger ? '#E63535' : textColor,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = danger ? 'rgba(255,59,59,0.10)' : hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={14} className="shrink-0" strokeWidth={1.8} />
      <span className="flex-1 text-left font-medium">{label}</span>
      {shortcut && (
        <span className="text-[11px] font-mono" style={{ color: textMuted }}>
          {shortcut}
        </span>
      )}
    </button>
  )
}

function Divider({ color }: { color: string }) {
  return <div className="h-px my-1 mx-2" style={{ background: color }} />
}
