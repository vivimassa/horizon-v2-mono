'use client'

/**
 * Communication Deck — top ribbon toolbar.
 * Mirrors the 2.1.1 Movement Control OpsToolbar pattern
 * (RibbonSection + RibbonBtn) with a collapsed icon-only mode.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload,
  RefreshCw,
  Download,
  Search,
  SlidersHorizontal,
  Send,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { Tooltip } from '@/components/ui/tooltip'
import { RibbonSection, RibbonBtn, RibbonDivider as Divider } from '@/components/ui/ribbon-primitives'

const STATUS_OPTIONS: Array<{ key: MessageStatus; label: string; color: string }> = [
  { key: 'held', label: 'Held', color: '#FF8800' },
  { key: 'pending', label: 'Pending', color: '#C99400' },
  { key: 'sent', label: 'Sent', color: '#0063F7' },
  { key: 'applied', label: 'Applied', color: '#06C270' },
  { key: 'failed', label: 'Failed', color: '#FF3B3B' },
  { key: 'rejected', label: 'Rejected', color: '#FF3B3B' },
  { key: 'discarded', label: 'Discarded', color: '#606170' },
]

export type MessageStatus = 'held' | 'pending' | 'sent' | 'applied' | 'failed' | 'rejected' | 'discarded'

interface Props {
  onPasteTelex: () => void
  onRefresh: () => void
  onExport: () => void
  canExport: boolean
  onSearch: () => void
  searchOpen: boolean
  statusFilter: MessageStatus[]
  onChangeStatusFilter: (next: MessageStatus[]) => void
  onReleaseAll: () => void
  releasableCount: number
}

export function CommunicationDeckToolbar({
  onPasteTelex,
  onRefresh,
  onExport,
  canExport,
  onSearch,
  searchOpen,
  statusFilter,
  onChangeStatusFilter,
  onReleaseAll,
  releasableCount,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const [collapsed, setCollapsed] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterDropRef = useRef<HTMLDivElement>(null)
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!filterOpen || !filterBtnRef.current) return
    const r = filterBtnRef.current.getBoundingClientRect()
    setFilterPos({ top: r.bottom + 6, left: r.left })
  }, [filterOpen])

  useEffect(() => {
    if (!filterOpen) return
    const handler = (e: MouseEvent) => {
      if (
        filterDropRef.current &&
        !filterDropRef.current.contains(e.target as Node) &&
        !filterBtnRef.current?.contains(e.target as Node)
      ) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterOpen])

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(91,141,239,0.12)' : 'rgba(30,64,175,0.08)'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const filterActive = statusFilter.length > 0

  const toggleStatus = (key: MessageStatus) => {
    if (statusFilter.includes(key)) {
      onChangeStatusFilter(statusFilter.filter((s) => s !== key))
    } else {
      onChangeStatusFilter([...statusFilter, key])
    }
  }

  return (
    <div className="select-none" style={{ color: palette.text }}>
      {collapsed &&
        (() => {
          const cb = (
            icon: React.ElementType,
            tip: string,
            onClick?: () => void,
            opts?: { active?: boolean; disabled?: boolean; badge?: number },
          ) => {
            const Icon = icon
            const { active, disabled, badge } = opts ?? {}
            return (
              <Tooltip content={tip} key={tip}>
                <button
                  onClick={onClick}
                  disabled={disabled}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${
                    disabled ? 'opacity-30 pointer-events-none' : ''
                  }`}
                  style={{
                    background: active ? activeBg : undefined,
                    color: active ? (isDark ? '#5B8DEF' : '#1e40af') : palette.textSecondary,
                  }}
                  onMouseEnter={(e) => {
                    if (!active && !disabled) e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = active ? activeBg : 'transparent'
                  }}
                >
                  <Icon size={18} />
                  {badge != null && badge > 0 && (
                    <div
                      className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5"
                      style={{ background: '#FF8800', color: '#fff', fontSize: 9, fontWeight: 700 }}
                    >
                      {badge}
                    </div>
                  )}
                </button>
              </Tooltip>
            )
          }
          return (
            <div
              className="flex items-center gap-0.5 px-2"
              style={{ height: 52, animation: 'bc-dropdown-in 150ms ease-out' }}
            >
              {cb(Upload, 'Paste telex', onPasteTelex)}
              {cb(Send, 'Release all', onReleaseAll, {
                disabled: releasableCount === 0,
                badge: releasableCount,
              })}
              {cb(RefreshCw, 'Refresh', onRefresh)}
              {cb(Download, 'Export CSV', onExport, { disabled: !canExport })}
              {cb(Search, 'Search (Ctrl+F)', onSearch, { active: searchOpen })}
              {cb(SlidersHorizontal, 'Filter', () => setFilterOpen((o) => !o), {
                active: filterOpen || filterActive,
                badge: statusFilter.length,
              })}
              <div className="flex-1" />
              <Tooltip content="Expand toolbar">
                <button
                  onClick={() => setCollapsed(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: palette.textTertiary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <ChevronDown size={16} />
                </button>
              </Tooltip>
            </div>
          )
        })()}

      {!collapsed && (
        <div
          className="flex items-stretch gap-0"
          style={{ minHeight: 120, animation: 'bc-dropdown-in 150ms ease-out' }}
        >
          {/* Actions */}
          <RibbonSection label="Actions">
            <RibbonBtn
              icon={Upload}
              label="Paste telex"
              onClick={onPasteTelex}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Paste inbound telex"
            />
            <div className="relative">
              <RibbonBtn
                icon={Send}
                label="Release all"
                onClick={onReleaseAll}
                disabled={releasableCount === 0}
                isDark={isDark}
                hoverBg={hoverBg}
                activeBg={activeBg}
                tooltip={
                  releasableCount === 0
                    ? 'No Held or Pending messages in view'
                    : `Release and transmit ${releasableCount} Held/Pending message${releasableCount === 1 ? '' : 's'}`
                }
              />
              {releasableCount > 0 && (
                <div
                  className="absolute top-2 right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: '#FF8800', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}
                >
                  {releasableCount}
                </div>
              )}
            </div>
            <RibbonBtn
              icon={RefreshCw}
              label="Refresh"
              onClick={onRefresh}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Refresh messages"
            />
            <RibbonBtn
              icon={Download}
              label="Export"
              disabled={!canExport}
              onClick={onExport}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Export visible messages as CSV"
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* View */}
          <RibbonSection label="View">
            <RibbonBtn
              icon={Search}
              label="Search"
              onClick={onSearch}
              active={searchOpen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Search messages (Ctrl+F)"
            />
            <div className="relative">
              <RibbonBtn
                ref={filterBtnRef}
                icon={SlidersHorizontal}
                label="Filter"
                onClick={() => setFilterOpen((o) => !o)}
                active={filterOpen || filterActive}
                isDark={isDark}
                hoverBg={hoverBg}
                activeBg={activeBg}
                tooltip="Quick filter by status"
              />
              {filterActive && (
                <div
                  className="absolute top-2 right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: '#0063F7', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}
                >
                  {statusFilter.length}
                </div>
              )}
            </div>
          </RibbonSection>

          {/* Collapse chevron */}
          <div className="flex items-start pt-2 pr-2 ml-auto">
            <Tooltip content="Collapse toolbar">
              <button
                onClick={() => setCollapsed(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: palette.textTertiary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <ChevronUp size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Filter popover */}
      {filterOpen &&
        createPortal(
          <div
            ref={filterDropRef}
            className="fixed z-[9999] rounded-xl p-4 select-none"
            style={{
              top: filterPos.top,
              left: filterPos.left,
              width: 260,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              backdropFilter: 'blur(24px)',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[13px] font-semibold uppercase tracking-wider"
                style={{ color: palette.textTertiary }}
              >
                Status
              </span>
              {statusFilter.length > 0 && (
                <button
                  onClick={() => onChangeStatusFilter([])}
                  className="text-[13px] font-medium transition-colors"
                  style={{ color: palette.textSecondary }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = palette.text)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = palette.textSecondary)}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {STATUS_OPTIONS.map((opt) => {
                const active = statusFilter.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleStatus(opt.key)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                    style={{
                      background: active ? `${opt.color}1A` : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = hoverBg
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span className="shrink-0 rounded-full" style={{ width: 10, height: 10, background: opt.color }} />
                    <span className="flex-1 text-[13px] font-medium" style={{ color: palette.text }}>
                      {opt.label}
                    </span>
                    {active && <Check size={14} style={{ color: opt.color }} />}
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
