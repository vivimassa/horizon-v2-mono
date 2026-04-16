'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  HandMetal,
  UserPlus,
  Info,
  Radar,
  CheckCircle2,
  Lock,
  Sparkles,
  EyeOff,
  Play,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { DisruptionIssueRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useEffectiveCategoryLabel, useEffectiveStatusLabel } from '@/stores/use-disruption-store'

interface ContextMenuProps {
  x: number
  y: number
  issue: DisruptionIssueRef
  onClose: () => void
  onClaim: (issue: DisruptionIssueRef) => void
  onAssign: (issue: DisruptionIssueRef) => void
  onStart: (issue: DisruptionIssueRef) => void
  onResolve: (issue: DisruptionIssueRef) => void
  onCloseIssue: (issue: DisruptionIssueRef) => void
  onHide: (issue: DisruptionIssueRef) => void
  onAskAdvisor: (issue: DisruptionIssueRef) => void
  onViewFlightInfo: (issue: DisruptionIssueRef) => void
  onOpenModule: (moduleCode: string, issue: DisruptionIssueRef) => void
}

interface MenuItem {
  icon: LucideIcon
  label: string
  show: boolean
  dividerAfter?: boolean
  destructive?: boolean
  accent?: boolean
  action: () => void
}

const ADVISOR_PURPLE = '#a855f7'

export function DisruptionContextMenu({
  x,
  y,
  issue,
  onClose,
  onClaim,
  onAssign,
  onStart,
  onResolve,
  onCloseIssue,
  onHide,
  onAskAdvisor,
  onViewFlightInfo,
  onOpenModule,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const categoryLabel = useEffectiveCategoryLabel(issue.category)
  const statusLabel = useEffectiveStatusLabel(issue.status)

  useEffect(() => {
    const handleClick = () => onClose()
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) {
      ref.current.style.left = `${window.innerWidth - rect.width - 8}px`
    }
    if (rect.bottom > window.innerHeight - 8) {
      ref.current.style.top = `${window.innerHeight - rect.height - 8}px`
    }
  }, [])

  const status = issue.status
  const isMaintenance = issue.category === 'MAINTENANCE_RISK'
  const isOpen = status === 'open'
  const isAssigned = status === 'assigned'
  const isInProgress = status === 'in_progress'
  const isResolved = status === 'resolved'

  const items: MenuItem[] = [
    { icon: HandMetal, label: 'Claim Issue', show: isOpen, action: () => onClaim(issue) },
    { icon: UserPlus, label: 'Assign to…', show: isOpen || isAssigned, action: () => onAssign(issue) },
    { icon: Play, label: 'Start Working', show: isAssigned, dividerAfter: true, action: () => onStart(issue) },
    {
      icon: Info,
      label: 'View Flight Information',
      show: !!issue.flightNumber && !isMaintenance,
      action: () => onViewFlightInfo(issue),
    },
    {
      icon: Radar,
      label: 'Open in Movement Control',
      show: !isMaintenance,
      dividerAfter: !isMaintenance,
      action: () => onOpenModule('2.1.1', issue),
    },
    {
      icon: Wrench,
      label: 'Open in Aircraft Status Board',
      show: isMaintenance,
      dividerAfter: true,
      action: () => onOpenModule('2.1.2.2', issue),
    },
    {
      icon: CheckCircle2,
      label: 'Mark Resolved',
      show: isAssigned || isInProgress,
      action: () => onResolve(issue),
    },
    { icon: Lock, label: 'Close Issue', show: isResolved, dividerAfter: true, action: () => onCloseIssue(issue) },
    { icon: Sparkles, label: 'Ask AI Advisor', show: true, accent: true, action: () => onAskAdvisor(issue) },
    { icon: EyeOff, label: 'Hide Issue', show: true, destructive: true, action: () => onHide(issue) },
  ]

  const visibleItems = items.filter((i) => i.show)

  const menuBg = isDark ? 'rgba(25,25,33,0.96)' : 'rgba(255,255,255,0.98)'
  const menuBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const headerColor = isDark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.50)'
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.80)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const destructiveColor = '#E63535'

  const menu = (
    <div
      ref={ref}
      className="rounded-xl overflow-hidden py-1.5 min-w-[240px]"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: menuBg,
        border: `1px solid ${menuBorder}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.32)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[13px] font-mono font-medium" style={{ color: headerColor }}>
        {issue.flightNumber ?? 'Unknown'} · {categoryLabel} · {statusLabel}
      </div>
      <div className="h-px my-1" style={{ background: dividerColor }} />

      {visibleItems.map((item, i) => {
        const color = item.destructive ? destructiveColor : item.accent ? ADVISOR_PURPLE : textColor
        return (
          <div key={i}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                item.action()
                onClose()
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors duration-150"
              style={{ color }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hoverBg
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
              <span style={item.accent ? { fontWeight: 600 } : undefined}>{item.label}</span>
            </button>
            {item.dividerAfter && i < visibleItems.length - 1 && (
              <div className="h-px my-1" style={{ background: dividerColor }} />
            )}
          </div>
        )
      })}
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(menu, document.body) : null
}
