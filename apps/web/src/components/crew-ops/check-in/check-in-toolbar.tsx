'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  RefreshCw,
  Settings as SettingsIcon,
  HelpCircle,
  Users as UsersIcon,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Contact,
  MessageSquare,
  ScrollText,
  Check,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { RibbonSection, RibbonBtn, RibbonDivider } from '@/components/ui/ribbon-primitives'

interface CrewCheckInToolbarProps {
  onRefresh: () => void
  onOpenSettings: () => void
}

const GROUP_BY_OPTIONS = [
  { key: 'none', label: 'No Grouping' },
  { key: 'base', label: 'By Base' },
  { key: 'acType', label: 'By A/C Type' },
  { key: 'status', label: 'By Status' },
] as const

/**
 * 4.1.7.1 ribbon toolbar — Period · Communication · View · System.
 * Format popover (Row Height + Refresh Interval) + Group By popover follow
 * the 4.1.5.2 stepper / dropdown pattern so the page reads as part of the
 * Crew Ops module family.
 */
export function CrewCheckInToolbar({ onRefresh, onOpenSettings }: CrewCheckInToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const rowHeight = useCrewCheckInStore((s) => s.rowHeight)
  const setRowHeight = useCrewCheckInStore((s) => s.setRowHeight)
  const refreshIntervalMins = useCrewCheckInStore((s) => s.refreshIntervalMins)
  const setRefreshIntervalMins = useCrewCheckInStore((s) => s.setRefreshIntervalMins)
  const groupBy = useCrewCheckInStore((s) => s.groupBy)
  const setGroupBy = useCrewCheckInStore((s) => s.setGroupBy)
  const commPanelMode = useCrewCheckInStore((s) => s.commPanelMode)
  const setCommPanelMode = useCrewCheckInStore((s) => s.setCommPanelMode)
  const toggleComm = (m: 'contacts' | 'messages' | 'logs') => setCommPanelMode(commPanelMode === m ? null : m)

  const [collapsed, setCollapsed] = useState(false)

  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  // ── Format popover ──
  const [formatOpen, setFormatOpen] = useState(false)
  const formatBtnRef = useRef<HTMLButtonElement>(null)
  const formatDropRef = useRef<HTMLDivElement>(null)
  const [formatPos, setFormatPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!formatOpen || !formatBtnRef.current) return
    const r = formatBtnRef.current.getBoundingClientRect()
    setFormatPos({ top: r.bottom + 4, left: r.left })
  }, [formatOpen])

  useEffect(() => {
    if (!formatOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (formatDropRef.current?.contains(t) || formatBtnRef.current?.contains(t)) return
      setFormatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [formatOpen])

  // ── Group By popover ──
  const [groupOpen, setGroupOpen] = useState(false)
  const groupBtnRef = useRef<HTMLButtonElement>(null)
  const groupDropRef = useRef<HTMLDivElement>(null)
  const [groupPos, setGroupPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!groupOpen || !groupBtnRef.current) return
    const r = groupBtnRef.current.getBoundingClientRect()
    setGroupPos({ top: r.bottom + 4, left: r.left })
  }, [groupOpen])

  useEffect(() => {
    if (!groupOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (groupDropRef.current?.contains(t) || groupBtnRef.current?.contains(t)) return
      setGroupOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [groupOpen])

  return (
    <div className="relative flex items-stretch">
      {collapsed ? (
        <div className="flex-1 flex items-center gap-1 px-3 h-[52px]">
          <CompactBtn icon={RefreshCw} label="Refresh" onClick={onRefresh} isDark={isDark} hoverBg={hoverBg} />
          <CompactBtn
            icon={LayoutGrid}
            label="Format"
            onClick={() => setFormatOpen((o) => !o)}
            isDark={isDark}
            hoverBg={hoverBg}
            buttonRef={formatBtnRef}
          />
          <CompactBtn
            icon={UsersIcon}
            label="Group By"
            onClick={() => setGroupOpen((o) => !o)}
            isDark={isDark}
            hoverBg={hoverBg}
            buttonRef={groupBtnRef}
          />
          <div className="flex-1" />
          <CompactBtn icon={SettingsIcon} label="Settings" onClick={onOpenSettings} isDark={isDark} hoverBg={hoverBg} />
          <CompactBtn icon={HelpCircle} label="Help" onClick={() => {}} isDark={isDark} hoverBg={hoverBg} disabled />
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="ml-1 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-hz-background-hover"
            aria-label="Expand toolbar"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-stretch overflow-x-auto">
          <RibbonSection label="View">
            <RibbonBtn
              ref={formatBtnRef}
              icon={LayoutGrid}
              label="Format"
              tooltip="Row height · Refresh interval"
              onClick={() => setFormatOpen((o) => !o)}
              active={formatOpen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
            <RibbonBtn
              ref={groupBtnRef}
              icon={UsersIcon}
              label="Group By"
              tooltip="Group duties by base / fleet / status"
              onClick={() => setGroupOpen((o) => !o)}
              active={groupOpen || groupBy !== 'none'}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
          </RibbonSection>

          <RibbonDivider isDark={isDark} />

          <RibbonSection label="Period">
            <RibbonBtn
              icon={RefreshCw}
              label="Refresh"
              tooltip="Refresh duty + crew data"
              onClick={onRefresh}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
          </RibbonSection>

          <RibbonDivider isDark={isDark} />

          <RibbonSection label="Communication">
            <RibbonBtn
              icon={Contact}
              label="Contacts"
              tooltip="Crew contact directory"
              active={commPanelMode === 'contacts'}
              onClick={() => toggleComm('contacts')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
            <RibbonBtn
              icon={MessageSquare}
              label="Messages"
              tooltip="Send message to crew"
              active={commPanelMode === 'messages'}
              onClick={() => toggleComm('messages')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
            <RibbonBtn
              icon={ScrollText}
              label="Logs"
              tooltip="Communication & check-in logs"
              active={commPanelMode === 'logs'}
              onClick={() => toggleComm('logs')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
          </RibbonSection>

          <div className="flex-1" />

          <RibbonDivider isDark={isDark} />

          <RibbonSection label="System">
            <RibbonBtn
              icon={SettingsIcon}
              label="Settings"
              tooltip="Operator check-in configuration"
              onClick={onOpenSettings}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
            <RibbonBtn
              icon={HelpCircle}
              label="Help"
              tooltip="Help (coming soon)"
              disabled
              onClick={() => {}}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
          </RibbonSection>

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="absolute top-1.5 right-1.5 h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-hz-background-hover"
            aria-label="Collapse toolbar"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      )}

      {/* ── Format popover ── */}
      {formatOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={formatDropRef}
            className="fixed z-[9999] rounded-xl p-3 select-none space-y-3"
            style={{
              top: formatPos.top,
              left: formatPos.left,
              width: 220,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
            }}
          >
            <Stepper
              label="Row Height"
              value={String(rowHeight)}
              onMinus={() => setRowHeight(rowHeight - 4)}
              onPlus={() => setRowHeight(rowHeight + 4)}
              minusDisabled={rowHeight <= 28}
              plusDisabled={rowHeight >= 64}
              panelBorder={panelBorder}
              hoverBg={hoverBg}
            />
            <Stepper
              label="Refresh Interval"
              value={refreshIntervalMins === 0 ? 'Off' : `${refreshIntervalMins}m`}
              onMinus={() => setRefreshIntervalMins(refreshIntervalMins - 1)}
              onPlus={() => setRefreshIntervalMins(refreshIntervalMins + 1)}
              minusDisabled={refreshIntervalMins <= 0}
              plusDisabled={refreshIntervalMins >= 30}
              panelBorder={panelBorder}
              hoverBg={hoverBg}
            />
          </div>,
          document.body,
        )}

      {/* ── Group By popover ── */}
      {groupOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={groupDropRef}
            className="fixed z-[9999] rounded-xl overflow-hidden select-none"
            style={{
              top: groupPos.top,
              left: groupPos.left,
              width: 200,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
            }}
          >
            <div
              className="px-3 py-2 text-[13px] uppercase tracking-wider font-semibold"
              style={{
                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                borderBottom: `1px solid ${panelBorder}`,
              }}
            >
              Group By
            </div>
            <div className="py-1">
              {GROUP_BY_OPTIONS.map((opt) => {
                const isActive = groupBy === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setGroupBy(opt.key)
                      setGroupOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-[13px] transition-colors text-left"
                    style={{ color: isActive ? (isDark ? '#5B8DEF' : '#1e40af') : isDark ? '#E5E7EB' : '#1F2937' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="flex-1">{opt.label}</span>
                    {isActive && <Check size={13} style={{ color: isDark ? '#5B8DEF' : '#1e40af', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

interface StepperProps {
  label: string
  onMinus: () => void
  onPlus: () => void
  minusDisabled?: boolean
  plusDisabled?: boolean
  value: string
  panelBorder: string
  hoverBg: string
}

function Stepper({ label, onMinus, onPlus, minusDisabled, plusDisabled, value, panelBorder, hoverBg }: StepperProps) {
  return (
    <div>
      <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">{label}</div>
      <div className="flex items-center justify-center">
        <button
          onClick={onMinus}
          disabled={minusDisabled}
          className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
          onMouseEnter={(e) => {
            if (!minusDisabled) e.currentTarget.style.background = hoverBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          −
        </button>
        <div
          className="flex items-center justify-center text-[13px] font-mono font-medium tabular-nums"
          style={{
            width: 80,
            height: 36,
            borderTop: `1px solid ${panelBorder}`,
            borderBottom: `1px solid ${panelBorder}`,
          }}
        >
          {value}
        </div>
        <button
          onClick={onPlus}
          disabled={plusDisabled}
          className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
          onMouseEnter={(e) => {
            if (!plusDisabled) e.currentTarget.style.background = hoverBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}

function CompactBtn({
  icon: Icon,
  label,
  onClick,
  isDark,
  hoverBg,
  disabled,
  buttonRef,
}: {
  icon: typeof RefreshCw
  label: string
  onClick: () => void
  isDark: boolean
  hoverBg: string
  disabled?: boolean
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <button
      ref={buttonRef as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
      style={{ color: isDark ? '#F5F2FD' : '#1C1C28' }}
    >
      <Icon size={15} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}
