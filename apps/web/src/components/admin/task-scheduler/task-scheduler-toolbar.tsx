'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Play,
  Square,
  Settings as SettingsIcon,
  FileText,
  Plus,
  Search,
  Trash2,
  Copy,
  RotateCcw,
  Eraser,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { Tooltip } from '@/components/ui/tooltip'
import { RibbonSection, RibbonBtn, RibbonDivider as Divider } from '@/components/ui/ribbon-primitives'
import type { ScheduledTaskRef } from '@skyhub/api'

export type ToolbarAction =
  | 'refresh'
  | 'runNow'
  | 'cancel'
  | 'configure'
  | 'viewLog'
  | 'search'
  | 'newTask'
  | 'delete'
  | 'clone'
  | 'restore'
  | 'clear'
  | 'help'

interface Props {
  selected: ScheduledTaskRef | null
  loading: boolean
  searchActive?: boolean
  onAction: (action: ToolbarAction) => void
}

/**
 * 7.1.6 Task Scheduler Management — top ribbon toolbar.
 *
 * Mirrors the 2.1.1 OpsToolbar shape (RibbonSection / RibbonBtn) so the
 * visual rhythm matches the Movement Control workspace.
 *
 * Wired today: Refresh, Run Now, Cancel, Settings, Schedule, Notifications,
 * View Log. Stubbed (no-op): New Task, Delete, Clone, Restore, Clear, Help —
 * user will wire these next.
 */
export function TaskSchedulerToolbar({ selected, loading, searchActive, onAction }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const [collapsed, setCollapsed] = useState(false)

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(91,141,239,0.12)' : 'rgba(30,64,175,0.08)'

  const hasSelection = selected != null
  const isRunning = selected?.lastRunStatus === 'running' || selected?.lastRunStatus === 'queued'

  const cb = (
    icon: React.ElementType,
    tip: string,
    action: ToolbarAction,
    opts?: { active?: boolean; disabled?: boolean },
  ) => {
    const Icon = icon
    const { active, disabled } = opts ?? {}
    return (
      <Tooltip content={tip} key={tip}>
        <button
          onClick={() => onAction(action)}
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
        </button>
      </Tooltip>
    )
  }

  return (
    <div className="select-none border-b border-hz-border" style={{ color: palette.text }}>
      {/* ── Collapsed: icon-only strip ── */}
      {collapsed ? (
        <div className="flex items-center gap-0.5 px-2" style={{ height: 52 }}>
          {cb(RefreshCw, 'Refresh list', 'refresh')}
          {cb(Play, 'Run now', 'runNow', { disabled: !hasSelection || isRunning })}
          {cb(Square, 'Cancel running', 'cancel', { disabled: !isRunning })}
          {cb(FileText, 'View log', 'viewLog', { disabled: !hasSelection })}
          {cb(SettingsIcon, 'Configure', 'configure', { disabled: !hasSelection })}
          {cb(Search, 'Search tasks', 'search', { active: searchActive })}
          {cb(Plus, 'New task', 'newTask', { disabled: true })}
          {cb(Trash2, 'Delete', 'delete', { disabled: true })}
          {cb(Copy, 'Clone', 'clone', { disabled: true })}
          {cb(RotateCcw, 'Restore defaults', 'restore', { disabled: true })}
          {cb(Eraser, 'Clear last-run', 'clear', { disabled: true })}
          {cb(HelpCircle, 'Help', 'help', { disabled: true })}
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
      ) : (
        <div className="flex items-stretch gap-0" style={{ minHeight: 110 }}>
          {/* ── Run ── */}
          <RibbonSection label="Run">
            <RibbonBtn
              icon={RefreshCw}
              label="Refresh"
              onClick={() => onAction('refresh')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Reload task list"
              disabled={loading}
            />
            <RibbonBtn
              icon={Play}
              label="Go"
              onClick={() => onAction('runNow')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={!hasSelection ? 'Select a task first' : isRunning ? 'Already running' : 'Run now'}
              disabled={!hasSelection || isRunning}
            />
            <RibbonBtn
              icon={Square}
              label="Cancel"
              onClick={() => onAction('cancel')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={isRunning ? 'Cancel the running execution' : 'Nothing to cancel'}
              disabled={!isRunning}
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── History ── */}
          <RibbonSection label="History">
            <RibbonBtn
              icon={FileText}
              label="Log"
              onClick={() => onAction('viewLog')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="View run history & logs"
              disabled={!hasSelection}
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Manage ── */}
          <RibbonSection label="Manage">
            <RibbonBtn
              icon={SettingsIcon}
              label="Configure"
              onClick={() => onAction('configure')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Open task configuration (description, schedule, alerts)"
              disabled={!hasSelection}
            />
            <RibbonBtn
              icon={Search}
              label="Search"
              onClick={() => onAction('search')}
              active={searchActive}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Search tasks by name"
            />
            <RibbonBtn
              icon={Plus}
              label="New"
              onClick={() => onAction('newTask')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="New task (coming soon)"
              disabled
            />
            <RibbonBtn
              icon={Trash2}
              label="Delete"
              onClick={() => onAction('delete')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Delete task (coming soon)"
              disabled
            />
            <RibbonBtn
              icon={Copy}
              label="Clone"
              onClick={() => onAction('clone')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Clone task (coming soon)"
              disabled
            />
            <RibbonBtn
              icon={RotateCcw}
              label="Restore"
              onClick={() => onAction('restore')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Restore defaults (coming soon)"
              disabled
            />
            <RibbonBtn
              icon={Eraser}
              label="Clear"
              onClick={() => onAction('clear')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Clear last-run state (coming soon)"
              disabled
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Help ── */}
          <RibbonSection label="Help">
            <RibbonBtn
              icon={HelpCircle}
              label="Help"
              onClick={() => onAction('help')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Help (coming soon)"
              disabled
            />
          </RibbonSection>

          <div className="flex-1" />
          <div className="flex items-start pt-2 pr-2">
            <Tooltip content="Collapse toolbar">
              <button
                onClick={() => setCollapsed(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: palette.textTertiary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <ChevronUp size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}
