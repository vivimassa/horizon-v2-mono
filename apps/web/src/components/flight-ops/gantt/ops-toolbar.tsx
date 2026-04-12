'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Wand2,
  BarChart3,
  Search,
  Maximize2,
  Minimize2,
  LayoutGrid,
  CalendarCheck,
  Link,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Timer,
  Binary,
  Route,
  GitBranch,
  Plus,
  CheckCircle,
  Crosshair,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { Tooltip } from '@/components/ui/tooltip'
import { RibbonSection, RibbonBtn, RibbonDivider as Divider } from '@/components/ui/ribbon-primitives'
import { useGanttStore } from '@/stores/use-gantt-store'
import { BulkAssignDialog } from '@/components/network/gantt/bulk-assign-dialog'
import { RecoveryDialog } from './recovery-dialog'
import { CompareDialog } from '@/components/network/gantt/compare-dialog'
import { ScenarioPanel } from '@/components/network/schedule-grid/scenario-panel'
import { ScenarioSaveDialog } from './scenario-save-dialog'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { api } from '@skyhub/api'
import { listOptimizerRuns } from '@/lib/gantt/api'
import { ROW_HEIGHT_LEVELS } from '@/lib/gantt/types'
import type { ZoomLevel } from '@/lib/gantt/types'

export function OpsToolbar({
  onSearch,
  onFullscreen,
  isFullscreen,
  onAddFlight,
}: { onSearch?: () => void; onFullscreen?: () => void; isFullscreen?: boolean; onAddFlight?: () => void } = {}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const barLabelMode = useGanttStore((s) => s.barLabelMode)
  const showTat = useGanttStore((s) => s.showTat)
  const toggleTat = useGanttStore((s) => s.toggleTat)
  // showMissingTimes removed from Display — controlled by alertCategories.missingTimes
  const showAlerts = useGanttStore((s) => s.showAlerts)
  const toggleAlerts = useGanttStore((s) => s.toggleAlerts)
  const alertCategories = useGanttStore((s) => s.alertCategories)
  const toggleAlertCategory = useGanttStore((s) => s.toggleAlertCategory)
  const goToToday = useGanttStore((s) => s.goToToday)
  const setBarLabelMode = useGanttStore((s) => s.setBarLabelMode)
  const rowHeightLevel = useGanttStore((s) => s.rowHeightLevel)
  const zoomLevel = useGanttStore((s) => s.zoomLevel)
  const setZoom = useGanttStore((s) => s.setZoom)
  const zoomRowIn = useGanttStore((s) => s.zoomRowIn)
  const zoomRowOut = useGanttStore((s) => s.zoomRowOut)

  const scenarioId = useOperatorStore((s) => s.activeScenarioId)
  const operatorId = useOperatorStore((s) => s.operator?._id ?? '')
  const setActiveScenarioId = useOperatorStore((s) => s.setActiveScenarioId)

  const [centerTimebar, setCenterTimebar] = useState(false)

  const [collapsed, setCollapsed] = useState(false)
  const [optimizerOpen, setOptimizerOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [activeScenarioName, setActiveScenarioName] = useState('')
  const [formatOpen, setFormatOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [compareCount, setCompareCount] = useState(0)

  const formatBtnRef = useRef<HTMLButtonElement>(null)
  const formatDropRef = useRef<HTMLDivElement>(null)
  const [formatPos, setFormatPos] = useState({ top: 0, left: 0 })

  const alertsBtnRef = useRef<HTMLButtonElement>(null)
  const alertsDropRef = useRef<HTMLDivElement>(null)
  const [alertsPos, setAlertsPos] = useState({ top: 0, left: 0 })

  // Load compare count
  useEffect(() => {
    if (!operatorId) return
    const pf = useGanttStore.getState().periodFrom
    const pt = useGanttStore.getState().periodTo
    if (!pf || !pt) return
    listOptimizerRuns(operatorId, pf, pt)
      .then((runs) => setCompareCount(runs.length))
      .catch(() => {})
  }, [operatorId])

  // Format popover positioning
  useEffect(() => {
    if (!formatOpen || !formatBtnRef.current) return
    const r = formatBtnRef.current.getBoundingClientRect()
    setFormatPos({ top: r.bottom + 6, left: r.left })
  }, [formatOpen])

  // Close format on outside click
  useEffect(() => {
    if (!formatOpen) return
    const handler = (e: MouseEvent) => {
      if (
        formatDropRef.current &&
        !formatDropRef.current.contains(e.target as Node) &&
        !formatBtnRef.current?.contains(e.target as Node)
      ) {
        setFormatOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [formatOpen])

  // Alerts popover positioning
  useEffect(() => {
    if (!alertsOpen || !alertsBtnRef.current) return
    const r = alertsBtnRef.current.getBoundingClientRect()
    setAlertsPos({ top: r.bottom + 6, left: r.left })
  }, [alertsOpen])

  // Close alerts on outside click
  useEffect(() => {
    if (!alertsOpen) return
    const handler = (e: MouseEvent) => {
      if (
        alertsDropRef.current &&
        !alertsDropRef.current.contains(e.target as Node) &&
        !alertsBtnRef.current?.contains(e.target as Node)
      ) {
        setAlertsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [alertsOpen])

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

  // Quick-toggle scenario: F9 to enter/save, Ctrl+S to save
  const handleScenarioToggle = useCallback(async () => {
    if (scenarioId) {
      // Already in scenario → exit back to production and refetch
      setActiveScenarioId(null)
      setActiveScenarioName('')
      useGanttStore.getState().setScenarioId(null)
      useGanttStore.getState().commitPeriod()
    } else {
      // Not in scenario → show tint instantly, create scenario in background
      const opId = getOperatorId()
      if (!opId) return
      // Immediate visual feedback — yellow tint appears now
      useGanttStore.getState().setScenarioId('pending')
      const now = new Date()
      const defaultName = `Draft ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
      try {
        const created = await api.createScenario({ operatorId: opId, name: defaultName, createdBy: 'OCC' })
        setActiveScenarioId(created._id)
        setActiveScenarioName(created.name)
        useGanttStore.getState().setScenarioId(created._id)
      } catch (e) {
        console.error('Failed to quick-create scenario:', e)
        // Revert tint on failure
        useGanttStore.getState().setScenarioId(null)
      }
    }
  }, [scenarioId, setActiveScenarioId])

  const handleScenarioSave = useCallback(
    async (name: string, description: string) => {
      if (!scenarioId) return
      try {
        await api.updateScenario(scenarioId, { name, description })
        setSaveDialogOpen(false)
      } catch (e) {
        console.error('Failed to save scenario:', e)
      }
    },
    [scenarioId],
  )

  const handleScenarioPublish = useCallback(
    async (name: string, description: string) => {
      if (!scenarioId) return
      const opId = getOperatorId()
      try {
        await api.updateScenario(scenarioId, { name, description })
        await api.publishMergeScenario(scenarioId, opId)
        setActiveScenarioId(null)
        setActiveScenarioName('')
        setSaveDialogOpen(false)
        // Refetch flights to reflect published changes
        useGanttStore.getState().commitPeriod()
      } catch (e) {
        console.error('Failed to publish scenario:', e)
      }
    },
    [scenarioId, setActiveScenarioId],
  )

  const handleScenarioDiscard = useCallback(async () => {
    if (!scenarioId) return
    const opId = getOperatorId()
    try {
      await api.deleteScenario(scenarioId)
      setActiveScenarioId(null)
      setActiveScenarioName('')
      setSaveDialogOpen(false)
      useGanttStore.getState().commitPeriod()
    } catch (e) {
      console.error('Failed to discard scenario:', e)
    }
  }, [scenarioId, setActiveScenarioId])

  // Keyboard shortcuts: F9 = toggle scenario, Ctrl+S = save scenario
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault()
        handleScenarioToggle()
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && scenarioId) {
        e.preventDefault()
        setSaveDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleScenarioToggle, scenarioId])

  // Track scenario name when entering via full panel
  useEffect(() => {
    if (!scenarioId) {
      setActiveScenarioName('')
      return
    }
    if (activeScenarioName) return // already set from quick-create
    api
      .getScenarios({ operatorId })
      .then((list) => {
        const s = list.find((x) => x._id === scenarioId)
        if (s) setActiveScenarioName(s.name)
      })
      .catch(() => {})
  }, [scenarioId, operatorId, activeScenarioName])

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(91,141,239,0.12)' : 'rgba(30,64,175,0.08)'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  // Alert count (flights with missing OOOI times)
  const flights = useGanttStore((s) => s.flights)
  const oooiGraceMins = useGanttStore((s) => s.oooiGraceMins)
  const alertCount = (() => {
    const now = Date.now()
    const graceMs = oooiGraceMins * 60_000
    let count = 0
    for (const f of flights) {
      const etdVal = f.etdUtc ?? Infinity
      const depMissing = now >= Math.min(f.stdUtc, etdVal) + graceMs && (!f.atdUtc || !f.offUtc)
      const etaVal = f.etaUtc ?? Infinity
      const arrMissing = now >= Math.min(f.staUtc, etaVal) + graceMs && (!f.ataUtc || !f.onUtc)
      if (depMissing || arrMissing) count++
    }
    return count
  })()

  return (
    <div className="select-none" style={{ color: palette.text }}>
      {/* ── Collapsed: icon-only strip ── */}
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
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
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
              {/* Issues */}
              {cb(AlertTriangle, 'Configure alerts', () => setAlertsOpen((o) => !o), {
                active: alertsOpen || showAlerts,
                badge: alertCount,
              })}
              {/* Disruption Recovery */}
              {cb(GitBranch, scenarioId ? 'Exit What-If (F9)' : 'What-If (F9)', handleScenarioToggle, {
                active: !!scenarioId,
              })}
              {cb(Wand2, 'Resolve', () => setOptimizerOpen(true), { disabled: !scenarioId })}
              {cb(BarChart3, 'Compare', () => setCompareOpen(true), { disabled: compareCount === 0 })}
              {cb(CheckCircle, 'Finalize', undefined, { disabled: !scenarioId })}
              {/* Execute */}
              {cb(Link, 'Assign', () => setBulkAssignOpen(true))}
              {cb(Plus, 'Add flight', onAddFlight)}
              {/* Display */}
              {cb(LayoutGrid, 'Format', () => setFormatOpen((o) => !o), { active: formatOpen })}
              {cb(
                barLabelMode === 'flightNo' ? Binary : Route,
                barLabelMode === 'flightNo' ? 'Flight numbers' : 'Sectors',
                () => setBarLabelMode(barLabelMode === 'flightNo' ? 'sector' : 'flightNo'),
              )}
              {cb(Timer, showTat ? 'Hide TAT' : 'Show TAT', toggleTat, { active: showTat })}
              {cb(Crosshair, centerTimebar ? 'Center on' : 'Center off', handleCenterTimebar, {
                active: centerTimebar,
              })}
              {cb(isFullscreen ? Minimize2 : Maximize2, isFullscreen ? 'Exit fullscreen' : 'Fullscreen', onFullscreen, {
                active: isFullscreen,
              })}
              {/* Navigate */}
              {cb(CalendarCheck, 'Today', goToToday)}
              {cb(Search, 'Search (Ctrl+F)', onSearch)}
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

      {/* ── Expanded: full ribbon ── */}
      {!collapsed && (
        <div
          className="flex items-stretch gap-0"
          style={{ minHeight: 120, animation: 'bc-dropdown-in 150ms ease-out' }}
        >
          {/* ── Issues ── */}
          <RibbonSection label="Issues">
            <div className="relative">
              <RibbonBtn
                ref={alertsBtnRef}
                icon={AlertTriangle}
                label="Alerts"
                onClick={() => setAlertsOpen((o) => !o)}
                active={alertsOpen || showAlerts}
                isDark={isDark}
                hoverBg={hoverBg}
                activeBg={activeBg}
                tooltip="Configure alert types"
              />
              {alertCount > 0 && (
                <div
                  className="absolute top-2 right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: '#FF8800', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}
                >
                  {alertCount}
                </div>
              )}
            </div>
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Disruption Recovery ── */}
          <RibbonSection label="Disruption Recovery">
            <RibbonBtn
              icon={GitBranch}
              label={scenarioId ? 'Exit' : 'What-If'}
              onClick={handleScenarioToggle}
              active={!!scenarioId}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={scenarioId ? 'Exit What-If mode (F9)' : 'Enter What-If mode (F9)'}
            />
            <RibbonBtn
              icon={Wand2}
              label="Resolve"
              disabled={!scenarioId}
              onClick={() => setOptimizerOpen(true)}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={scenarioId ? 'Run recovery optimizer on selected flights' : 'Enter What-If first'}
            />
            <div className="relative">
              <RibbonBtn
                icon={BarChart3}
                label="Compare"
                disabled={compareCount === 0}
                onClick={() => setCompareOpen(true)}
                isDark={isDark}
                hoverBg={hoverBg}
                activeBg={activeBg}
                tooltip="Compare recovery options"
              />
              {compareCount > 0 && (
                <div
                  className="absolute top-2 right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5"
                  style={{ background: '#E63535', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}
                >
                  {compareCount}
                </div>
              )}
            </div>
            <RibbonBtn
              icon={CheckCircle}
              label="Finalize"
              disabled={!scenarioId}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={scenarioId ? 'Publish changes & generate messages' : 'Enter What-If first'}
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Execute ── */}
          <RibbonSection label="Execute">
            <RibbonBtn
              icon={Link}
              label="Assign"
              onClick={() => setBulkAssignOpen(true)}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Bulk assign/deassign aircraft"
            />
            <RibbonBtn
              icon={Plus}
              label="Add"
              onClick={onAddFlight}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Add a new flight"
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Display ── */}
          <RibbonSection label="Display">
            <RibbonBtn
              ref={formatBtnRef}
              icon={LayoutGrid}
              label="Format"
              onClick={() => setFormatOpen((o) => !o)}
              active={formatOpen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
            <RibbonBtn
              icon={barLabelMode === 'flightNo' ? Binary : Route}
              label={barLabelMode === 'flightNo' ? 'Flight' : 'Sector'}
              onClick={() => setBarLabelMode(barLabelMode === 'flightNo' ? 'sector' : 'flightNo')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={
                barLabelMode === 'flightNo'
                  ? 'Showing flight numbers — click for sectors'
                  : 'Showing sectors — click for flight numbers'
              }
            />
            <RibbonBtn
              icon={Timer}
              label="TAT"
              onClick={toggleTat}
              active={showTat}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={showTat ? 'Hide turnaround times' : 'Show turnaround times'}
            />
            <RibbonBtn
              icon={Crosshair}
              label="Center"
              onClick={handleCenterTimebar}
              active={centerTimebar}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={centerTimebar ? 'Center timebar Enabled' : 'Center timebar Disabled'}
            />
            <RibbonBtn
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? 'Exit' : 'Fullscreen'}
              onClick={onFullscreen}
              active={isFullscreen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Navigate ── */}
          <RibbonSection label="Navigate">
            <RibbonBtn
              icon={CalendarCheck}
              label="Today"
              onClick={goToToday}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
            />
            <RibbonBtn
              icon={Search}
              label="Search"
              onClick={onSearch}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Search flights (Ctrl+F)"
            />
          </RibbonSection>

          {/* ── Collapse chevron ── */}
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

      {/* ── Format Popover ── */}
      {formatOpen &&
        createPortal(
          <div
            ref={formatDropRef}
            className="fixed z-[9999] rounded-xl p-3 select-none space-y-3"
            style={{
              top: formatPos.top,
              left: formatPos.left,
              width: 200,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              backdropFilter: 'blur(24px)',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: palette.textTertiary }}
              >
                Row Height
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={zoomRowOut}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[14px] font-bold"
                  style={{ background: hoverBg, color: palette.textSecondary }}
                >
                  −
                </button>
                <span className="flex-1 text-center text-[13px] font-medium capitalize">
                  {ROW_HEIGHT_LEVELS[rowHeightLevel].label}
                </span>
                <button
                  onClick={zoomRowIn}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[14px] font-bold"
                  style={{ background: hoverBg, color: palette.textSecondary }}
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: palette.textTertiary }}
              >
                Range
              </div>
              <div className="flex flex-wrap gap-1">
                {(['1D', '2D', '3D', '4D', '5D', '6D', '7D'] as ZoomLevel[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className="px-2 py-1 rounded-md text-[12px] font-medium transition-colors"
                    style={{
                      background: zoomLevel === z ? activeBg : 'transparent',
                      color: zoomLevel === z ? (isDark ? '#5B8DEF' : '#1e40af') : palette.textSecondary,
                    }}
                    onMouseEnter={(e) => {
                      if (zoomLevel !== z) e.currentTarget.style.background = hoverBg
                    }}
                    onMouseLeave={(e) => {
                      if (zoomLevel !== z) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Alerts Popover ── */}
      {alertsOpen &&
        createPortal(
          <div
            ref={alertsDropRef}
            className="fixed z-[9999] rounded-xl p-4 select-none"
            style={{
              top: alertsPos.top,
              left: alertsPos.left,
              width: 300,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              backdropFilter: 'blur(24px)',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-wider mb-3"
              style={{ color: palette.textTertiary }}
            >
              Alert Types
            </div>
            <div className="flex flex-col gap-1">
              {[
                { key: 'missingTimes' as const, label: 'Actual Times Missing', count: alertCount, enabled: true },
                { key: 'considerableDelay' as const, label: 'Considerable Delay', count: null, enabled: false },
                { key: 'curfew' as const, label: 'Curfew Violation', count: null, enabled: false },
                { key: 'crewFtl' as const, label: 'Crew FTL Legality', count: null, enabled: false },
                { key: 'depArrIncompat' as const, label: 'DEP/ARR Incompatibility', count: null, enabled: false },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => item.enabled && toggleAlertCategory(item.key)}
                  disabled={!item.enabled}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left ${!item.enabled ? 'opacity-40' : ''}`}
                  style={{
                    background: alertCategories[item.key]
                      ? isDark
                        ? 'rgba(255,136,0,0.10)'
                        : 'rgba(255,136,0,0.08)'
                      : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (item.enabled && !alertCategories[item.key]) e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    if (!alertCategories[item.key]) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* iOS-style toggle switch */}
                  <div
                    className="shrink-0 rounded-full relative transition-colors duration-200"
                    style={{
                      width: 32,
                      height: 18,
                      background: alertCategories[item.key]
                        ? '#FF8800'
                        : isDark
                          ? 'rgba(255,255,255,0.15)'
                          : 'rgba(0,0,0,0.12)',
                    }}
                  >
                    <div
                      className="absolute top-[2px] rounded-full bg-white transition-all duration-200"
                      style={{
                        width: 14,
                        height: 14,
                        left: alertCategories[item.key] ? 16 : 2,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  {/* Label */}
                  <span className="flex-1 text-[13px] font-medium" style={{ color: palette.text }}>
                    {item.label}
                  </span>
                  {/* Count */}
                  <span
                    className="text-[12px] font-semibold tabular-nums"
                    style={{
                      color: item.count != null && item.count > 0 ? '#FF8800' : palette.textTertiary,
                    }}
                  >
                    {item.count != null ? `${item.count}` : '—'}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {/* ── Dialogs ── */}
      <BulkAssignDialog open={bulkAssignOpen} onClose={() => setBulkAssignOpen(false)} />
      <RecoveryDialog open={optimizerOpen} onClose={() => setOptimizerOpen(false)} />
      <CompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} />
      {scenarioOpen &&
        createPortal(
          <ScenarioPanel
            activeScenarioId={scenarioId}
            onSelectScenario={(id) => {
              setActiveScenarioId(id)
              setActiveScenarioName('')
            }}
            onClose={() => setScenarioOpen(false)}
          />,
          document.body,
        )}
      {saveDialogOpen && scenarioId && (
        <ScenarioSaveDialog
          scenarioName={activeScenarioName}
          onSave={handleScenarioSave}
          onPublish={handleScenarioPublish}
          onDiscard={handleScenarioDiscard}
          onClose={() => setSaveDialogOpen(false)}
        />
      )}
    </div>
  )
}
