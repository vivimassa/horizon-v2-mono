"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Wand2, BarChart3, Search, Maximize2, Minimize2, LayoutGrid,
  CalendarCheck, RefreshCw, Link, Activity, ChevronUp, ChevronDown, Crosshair, MessageSquare, Timer,
  Binary, Route, GitBranch, Plus, Clock,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { Tooltip } from '@/components/ui/tooltip'
import { useGanttStore } from '@/stores/use-gantt-store'
import { BulkAssignDialog } from './bulk-assign-dialog'
import { OptimizerDialog } from './optimizer-dialog'
import { CompareDialog } from './compare-dialog'
import { ScenarioPanel } from '../schedule-grid/scenario-panel'
import { useOperatorStore } from '@/stores/use-operator-store'
import { listOptimizerRuns } from '@/lib/gantt/api'
import { ROW_HEIGHT_LEVELS } from '@/lib/gantt/types'
import type { ZoomLevel } from '@/lib/gantt/types'

const ZOOMS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '14D', '21D', '28D']

export function GanttToolbar({ onSearch, onFullscreen, isFullscreen, onAddFlight }: { onSearch?: () => void; onFullscreen?: () => void; isFullscreen?: boolean; onAddFlight?: () => void } = {}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const zoomLevel = useGanttStore(s => s.zoomLevel)
  const rowHeightLevel = useGanttStore(s => s.rowHeightLevel)
  const barLabelMode = useGanttStore(s => s.barLabelMode)
  const showTat = useGanttStore(s => s.showTat)
  const toggleTat = useGanttStore(s => s.toggleTat)
  const showSlots = useGanttStore(s => s.showSlots)
  const toggleSlots = useGanttStore(s => s.toggleSlots)
  const setZoom = useGanttStore(s => s.setZoom)
  const zoomRowIn = useGanttStore(s => s.zoomRowIn)
  const zoomRowOut = useGanttStore(s => s.zoomRowOut)
  const goToToday = useGanttStore(s => s.goToToday)
  const setBarLabelMode = useGanttStore(s => s.setBarLabelMode)

  // Toolbar collapse
  const [collapsed, setCollapsed] = useState(false)

  // Dialog states
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const scenarioId = useOperatorStore(s => s.activeScenarioId)
  const setScenarioId = useOperatorStore(s => s.setActiveScenarioId)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [optimizerOpen, setOptimizerOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareCount, setCompareCount] = useState(0)

  const periodFrom = useGanttStore(s => s.periodFrom)
  const periodTo = useGanttStore(s => s.periodTo)

  // Load saved run count for badge
  const loadCompareCount = useCallback(async () => {
    try {
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      if (!operatorId || !periodFrom || !periodTo) return
      const runs = await listOptimizerRuns(operatorId, periodFrom, periodTo)
      setCompareCount(runs.length)
    } catch { /* ignore */ }
  }, [periodFrom, periodTo])

  useEffect(() => { loadCompareCount() }, [loadCompareCount])
  // Refresh count when optimizer or compare dialog closes
  useEffect(() => { if (!optimizerOpen && !compareOpen) loadCompareCount() }, [optimizerOpen, compareOpen, loadCompareCount])

  // Utilization popover state
  const [utilOpen, setUtilOpen] = useState(false)
  const utilBtnRef = useRef<HTMLButtonElement>(null)
  const utilDropRef = useRef<HTMLDivElement>(null)
  const [utilPos, setUtilPos] = useState({ top: 0, left: 0 })
  const aircraftTypes = useGanttStore(s => s.aircraftTypes)
  const utilizationTargets = useGanttStore(s => s.utilizationTargets)
  const setUtilizationTargets = useGanttStore(s => s.setUtilizationTargets)
  const [utilDraft, setUtilDraft] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!utilOpen || !utilBtnRef.current) return
    const rect = utilBtnRef.current.getBoundingClientRect()
    setUtilPos({ top: rect.bottom + 6, left: rect.left })
    // Init draft from current targets, with defaults for missing types
    const draft = new Map<string, number>()
    for (const t of aircraftTypes) {
      draft.set(t.icaoType, utilizationTargets.get(t.icaoType) ?? 10)
    }
    setUtilDraft(draft)
  }, [utilOpen, aircraftTypes, utilizationTargets])

  useEffect(() => {
    if (!utilOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        utilBtnRef.current && !utilBtnRef.current.contains(t) &&
        utilDropRef.current && !utilDropRef.current.contains(t)
      ) setUtilOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [utilOpen])

  // Format popover state
  const [formatOpen, setFormatOpen] = useState(false)
  const formatBtnRef = useRef<HTMLButtonElement>(null)
  const formatDropRef = useRef<HTMLDivElement>(null)
  const [formatPos, setFormatPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!formatOpen || !formatBtnRef.current) return
    const rect = formatBtnRef.current.getBoundingClientRect()
    setFormatPos({ top: rect.bottom + 6, left: rect.left })
  }, [formatOpen])

  useEffect(() => {
    if (!formatOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        formatBtnRef.current && !formatBtnRef.current.contains(t) &&
        formatDropRef.current && !formatDropRef.current.contains(t)
      ) setFormatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [formatOpen])

  // Zoom stepping
  const zoomIdx = ZOOMS.indexOf(zoomLevel)
  const zoomPrev = () => { if (zoomIdx > 0) setZoom(ZOOMS[zoomIdx - 1]) }
  const zoomNext = () => { if (zoomIdx < ZOOMS.length - 1) setZoom(ZOOMS[zoomIdx + 1]) }

  // Theme
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const [centerTimebar, setCenterTimebar] = useState(false)

  const handleCenterTimebar = useCallback(() => {
    const next = !centerTimebar
    setCenterTimebar(next)
    if (next) useGanttStore.getState().goToToday()
  }, [centerTimebar])

  // Auto-recenter every 30s when enabled
  useEffect(() => {
    if (!centerTimebar) return
    const id = setInterval(() => {
      useGanttStore.setState({ scrollTargetMs: Date.now() })
    }, 30_000)
    return () => clearInterval(id)
  }, [centerTimebar])

  const rowH = ROW_HEIGHT_LEVELS[rowHeightLevel].rowH

  // All toolbar items for collapsed mode
  const toolbarItems = [
    // Flight
    { icon: Plus, label: 'Add', tooltip: 'Add a new flight', onClick: onAddFlight },
    // Actions
    { icon: Wand2, label: 'Optimizer', tooltip: 'Auto-assign flights to aircraft', onClick: () => setOptimizerOpen(true) },
    { icon: BarChart3, label: 'Compare', tooltip: 'Compare saved optimizer runs', onClick: () => setCompareOpen(true), disabled: compareCount === 0, badge: compareCount > 0 ? compareCount : undefined },
    { icon: Link, label: 'Assign', tooltip: 'Bulk assign/deassign aircraft for a period', onClick: () => setBulkAssignOpen(true) },
    // Navigate
    { icon: CalendarCheck, label: 'Today', tooltip: 'Go to today', onClick: goToToday },
    { icon: Search, label: 'Search', tooltip: 'Search flights (Ctrl+F)', onClick: onSearch },
    // Display
    { icon: LayoutGrid, label: 'Format', tooltip: 'Row height & zoom range', onClick: () => setFormatOpen(o => !o), ref: formatBtnRef, active: formatOpen },
    { icon: barLabelMode === 'flightNo' ? Binary : Route, label: barLabelMode === 'flightNo' ? 'Flight' : 'Sector', tooltip: barLabelMode === 'flightNo' ? 'Showing flight numbers — click for sectors' : 'Showing sectors — click for flight numbers', onClick: () => setBarLabelMode(barLabelMode === 'flightNo' ? 'sector' : 'flightNo') },
    { icon: Timer, label: 'TAT', tooltip: showTat ? 'Hide turnaround times' : 'Show turnaround times', onClick: toggleTat, active: showTat },
    { icon: Clock, label: 'Slot', tooltip: showSlots ? 'Hide slot status flags' : 'Show slot status flags', onClick: toggleSlots, active: showSlots },
    { icon: Crosshair, label: 'Center', tooltip: centerTimebar ? 'Center timebar Enabled' : 'Center timebar Disabled', onClick: handleCenterTimebar, active: centerTimebar },
    { icon: isFullscreen ? Minimize2 : Maximize2, label: isFullscreen ? 'Exit' : 'Fullscreen', tooltip: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', onClick: onFullscreen, active: isFullscreen },
    // Settings
    { icon: Activity, label: 'Utilization', tooltip: 'Set target block hours per AC type', onClick: () => setUtilOpen(o => !o), ref: utilBtnRef, active: utilOpen },
    { icon: GitBranch, label: 'Scenario', tooltip: scenarioId ? 'Viewing scenario — click to manage' : 'Scenario management', onClick: () => setScenarioOpen(true), active: !!scenarioId },
    { icon: MessageSquare, label: 'ASM/SSM', tooltip: 'ASM/SSM transmission settings', disabled: true },
  ] as const

  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        height: collapsed ? 52 : 145,
        transition: 'height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ── Collapsed: icon-only row ── */}
      {collapsed && (
        <div className="flex items-center gap-0.5 px-2" style={{ height: 52, animation: 'bc-dropdown-in 150ms ease-out' }}>
          {toolbarItems.map((item, i) => (
            <div key={i} className="relative">
              <Tooltip content={item.tooltip ?? item.label}>
                <button
                  ref={'ref' in item ? item.ref as any : undefined}
                  onClick={item.onClick}
                  disabled={'disabled' in item ? item.disabled : false}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 ${
                    ('disabled' in item && item.disabled) ? 'opacity-30 pointer-events-none' : ''
                  }`}
                  style={{
                    background: ('active' in item && item.active) ? activeBg : undefined,
                    color: ('active' in item && item.active) ? (isDark ? '#5B8DEF' : '#1e40af') : palette.textSecondary,
                  }}
                  onMouseEnter={(e) => { if (!('active' in item && item.active)) e.currentTarget.style.background = hoverBg }}
                  onMouseLeave={(e) => { if (!('active' in item && item.active)) e.currentTarget.style.background = 'transparent' }}
                >
                  <item.icon size={18} strokeWidth={1.6} />
                </button>
              </Tooltip>
              {'badge' in item && item.badge && (
                <div className="absolute top-0.5 right-0 min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: '#E63535', color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                  {item.badge}
                </div>
              )}
            </div>
          ))}
          <div className="flex-1" />
          <Tooltip content="Expand toolbar">
            <button onClick={() => setCollapsed(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: palette.textTertiary }}
              onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <ChevronDown size={16} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* ── Expanded: full ribbon ── */}
      {!collapsed && (
        <div className="flex items-stretch gap-0" style={{ minHeight: 120, animation: 'bc-dropdown-in 150ms ease-out' }}>
          {/* ── Flight ── */}
          <RibbonSection label="Flight">
            <RibbonBtn icon={Plus} label="Add" onClick={onAddFlight} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip="Add a new flight" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Actions ── */}
          <RibbonSection label="Actions">
            <RibbonBtn icon={Wand2} label="Optimizer" onClick={() => setOptimizerOpen(true)} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip="Auto-assign flights to aircraft" />
            <div className="relative">
              <RibbonBtn icon={BarChart3} label="Compare"
                disabled={compareCount === 0} onClick={() => setCompareOpen(true)}
                isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
                tooltip="Compare saved optimizer runs" />
              {compareCount > 0 && (
                <div className="absolute top-2 right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: '#E63535', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
                  {compareCount}
                </div>
              )}
            </div>
            <RibbonBtn icon={Link} label="Assign" onClick={() => setBulkAssignOpen(true)} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip="Bulk assign/deassign aircraft for a period" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Navigate ── */}
          <RibbonSection label="Navigate">
            <RibbonBtn icon={CalendarCheck} label="Today" onClick={goToToday} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg} />
            <RibbonBtn icon={Search} label="Search" onClick={onSearch} isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip="Search flights (Ctrl+F)" />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Display ── */}
          <RibbonSection label="Display">
            <RibbonBtn
              ref={formatBtnRef}
              icon={LayoutGrid}
              label="Format"
              onClick={() => setFormatOpen(o => !o)}
              active={formatOpen}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
            />
            <RibbonBtn
              icon={barLabelMode === 'flightNo' ? Binary : Route}
              label={barLabelMode === 'flightNo' ? 'Flight' : 'Sector'}
              onClick={() => setBarLabelMode(barLabelMode === 'flightNo' ? 'sector' : 'flightNo')}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip={barLabelMode === 'flightNo' ? 'Showing flight numbers — click for sectors' : 'Showing sectors — click for flight numbers'}
            />
            <RibbonBtn icon={Timer} label="TAT"
              onClick={toggleTat} active={showTat}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip={showTat ? 'Hide turnaround times' : 'Show turnaround times'} />
            <RibbonBtn icon={Clock} label="Slot"
              onClick={toggleSlots} active={showSlots}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip={showSlots ? 'Hide slot status flags' : 'Show slot status flags'} />
            <RibbonBtn icon={Crosshair} label="Center"
              onClick={handleCenterTimebar} active={centerTimebar}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip={centerTimebar ? 'Center timebar Enabled' : 'Center timebar Disabled'} />
            <RibbonBtn icon={isFullscreen ? Minimize2 : Maximize2} label={isFullscreen ? 'Exit' : 'Fullscreen'}
              onClick={onFullscreen} active={isFullscreen}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Settings ── */}
          <RibbonSection label="Settings">
            <RibbonBtn
              ref={utilBtnRef}
              icon={Activity}
              label="Utilization"
              onClick={() => setUtilOpen(o => !o)}
              active={utilOpen}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip="Set target block hours per AC type"
            />
            <RibbonBtn icon={GitBranch} label="Scenario"
              onClick={() => setScenarioOpen(true)} active={!!scenarioId}
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip={scenarioId ? 'Viewing scenario — click to manage' : 'Scenario management'} />
            <RibbonBtn icon={MessageSquare} label="ASM/SSM" disabled
              isDark={isDark} hoverBg={hoverBg} activeBg={activeBg}
              tooltip="ASM/SSM transmission settings" />
          </RibbonSection>

          {/* ── Collapse chevron ── */}
          <div className="flex items-start pt-2 pr-2 ml-auto">
            <Tooltip content="Collapse toolbar">
              <button onClick={() => setCollapsed(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: palette.textTertiary }}
                onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <ChevronUp size={14} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* ── Format Popover ── */}
      {formatOpen && createPortal(
        <div
          ref={formatDropRef}
          className="fixed z-[9999] rounded-xl p-3 select-none space-y-3"
          style={{
            top: formatPos.top, left: formatPos.left, width: 200,
            background: panelBg, border: `1px solid ${panelBorder}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
          }}
        >
          {/* Row Height */}
          <div>
            <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">Row Height</div>
            <div className="flex items-center justify-center">
              <button
                onClick={zoomRowOut}
                disabled={rowHeightLevel <= 0}
                className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >−</button>
              <div
                className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text"
                style={{ width: 56, height: 36, borderTop: `1px solid ${panelBorder}`, borderBottom: `1px solid ${panelBorder}` }}
              >{rowH}</div>
              <button
                onClick={zoomRowIn}
                disabled={rowHeightLevel >= ROW_HEIGHT_LEVELS.length - 1}
                className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >+</button>
            </div>
          </div>

          {/* Range (Zoom) */}
          <div>
            <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">Range</div>
            <div className="flex items-center justify-center">
              <button
                onClick={zoomPrev}
                disabled={zoomIdx <= 0}
                className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >−</button>
              <div
                className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text"
                style={{ width: 56, height: 36, borderTop: `1px solid ${panelBorder}`, borderBottom: `1px solid ${panelBorder}` }}
              >{zoomLevel}</div>
              <button
                onClick={zoomNext}
                disabled={zoomIdx >= ZOOMS.length - 1}
                className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >+</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Utilization Popover ── */}
      {utilOpen && createPortal(
        <div
          ref={utilDropRef}
          className="fixed z-[9999] rounded-xl p-4 select-none space-y-3"
          style={{
            top: utilPos.top, left: utilPos.left, width: 280,
            background: panelBg, border: `1px solid ${panelBorder}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
          }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: palette.textTertiary }}>
            Target Block Hours / Day
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {[...aircraftTypes].sort((a, b) => a.icaoType.localeCompare(b.icaoType)).map(t => {
              const val = utilDraft.get(t.icaoType) ?? 10
              return (
                <div key={t.icaoType}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold" style={{ color: palette.text }}>{t.icaoType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={5} max={20} step={0.5}
                      value={val}
                      onChange={e => {
                        const next = new Map(utilDraft)
                        next.set(t.icaoType, parseFloat(e.target.value))
                        setUtilDraft(next)
                      }}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #06C270 ${((val - 5) / 15) * 100}%, ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'} ${((val - 5) / 15) * 100}%)`,
                        accentColor: '#06C270',
                      }}
                    />
                    <span className="text-[12px] font-semibold w-[32px] text-right" style={{ color: '#06C270' }}>{val}h</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: `1px solid ${panelBorder}` }}>
            <button
              onClick={() => setUtilOpen(false)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{ color: palette.text, border: `1px solid ${panelBorder}` }}
            >Cancel</button>
            <button
              onClick={() => {
                setUtilizationTargets(utilDraft)
                setUtilOpen(false)
              }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
              style={{ background: '#06C270' }}
            >Save</button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Bulk Assign Dialog ── */}
      <BulkAssignDialog open={bulkAssignOpen} onClose={() => setBulkAssignOpen(false)} />
      <OptimizerDialog open={optimizerOpen} onClose={() => setOptimizerOpen(false)} />
      <CompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} />
      {scenarioOpen && createPortal(
        <ScenarioPanel
          activeScenarioId={scenarioId}
          onSelectScenario={(id) => { setScenarioId(id); useGanttStore.getState().commitPeriod() }}
          onClose={() => setScenarioOpen(false)}
        />,
        document.body
      )}
    </div>
  )
}

// ── Ribbon primitives (matching 1.1.1 pattern) ──

function RibbonSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center self-stretch justify-between pt-5 pb-3 px-3">
      <div className="flex items-center justify-center gap-2 flex-1">
        {children}
      </div>
      <div className="w-full text-center border-t border-hz-border/20 pt-1 mt-1">
        <span className="text-[11px] text-hz-text-tertiary/50 font-medium leading-none whitespace-nowrap">{label}</span>
      </div>
    </div>
  )
}

import { forwardRef } from 'react'

const RibbonBtn = forwardRef<HTMLButtonElement, {
  icon: typeof Wand2; label: string; onClick?: () => void
  disabled?: boolean; active?: boolean; tooltip?: string
  isDark: boolean; hoverBg: string; activeBg: string
}>(({ icon: Icon, label, onClick, disabled, active, tooltip, isDark, hoverBg, activeBg }, ref) => {
  const btn = (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg transition-all duration-150 ${
        disabled ? 'opacity-30 pointer-events-none' : ''
      }`}
      style={{
        width: 72, height: 72,
        background: active ? activeBg : undefined,
        color: active ? (isDark ? '#5B8DEF' : '#1e40af') : undefined,
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = hoverBg }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? activeBg : 'transparent' }}
    >
      <Icon size={26} strokeWidth={1.4} />
      <span className="text-[12px] font-medium leading-none">{label}</span>
    </button>
  )

  if (tooltip) {
    return <Tooltip content={tooltip}>{btn}</Tooltip>
  }
  return btn
})

RibbonBtn.displayName = 'RibbonBtn'

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <div className="shrink-0 flex items-center" style={{ height: 72, alignSelf: 'center' }}>
      <div style={{ width: 1, height: '100%', background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }} />
    </div>
  )
}
