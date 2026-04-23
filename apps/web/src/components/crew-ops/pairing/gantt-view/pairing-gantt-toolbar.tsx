'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Maximize2,
  Minimize2,
  Search,
  LayoutGrid,
  Binary,
  Route as RouteIcon,
  Route,
  Timer,
  Crosshair,
  CalendarCheck,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  CalendarDays,
  Layers,
  ListFilter,
  SlidersHorizontal,
  Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { Tooltip } from '@/components/ui/tooltip'
import { usePairingStore } from '@/stores/use-pairing-store'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'
import type { ReviewFilterMode } from '@/stores/use-pairing-gantt-store'
import { SmartFiltersDialog } from '../dialogs/smart-filters-dialog'
import { RibbonSection, RibbonBtn, RibbonDivider } from '@/components/ui/ribbon-primitives'
import { ROW_HEIGHT_LEVELS } from '@/lib/gantt/types'
import type { ZoomLevel } from '@/lib/gantt/types'

const ZOOMS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '14D', '21D', '28D']

/**
 * Ribbon-style toolbar for 4.1.5.2 Crew Pairing — Gantt.
 *
 * Collapsible: same 52px ↔ 145px animated transition as Movement Control's
 * toolbar. Expanded shows labeled `RibbonSection` groups of vertical
 * `RibbonBtn`s with a chevron-up in the top-right. Collapsed shrinks to a
 * flat icon-only row with a chevron-down on the right.
 *
 * Scope vs Movement Control: omits `Utilization` (manpower concept),
 * `Scenario`, `ASM/SSM`, `Help`, `Optimizer`, `Compare`, `Assign`, `OOOI`,
 * `Slot`, `Actual`. Keeps Format, Flight/Sector, TAT, Center, Fullscreen,
 * Today, Search, plus the Build Pairing primary CTA.
 */
export function PairingGanttToolbar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const zoomLevel = usePairingGanttStore((s) => s.zoomLevel)
  const setZoom = usePairingGanttStore((s) => s.setZoom)
  const rowHeightLevel = usePairingGanttStore((s) => s.rowHeightLevel)
  const cycleRowHeight = usePairingGanttStore((s) => s.cycleRowHeight)
  const labelMode = usePairingGanttStore((s) => s.barLabelMode)
  const setLabelMode = usePairingGanttStore((s) => s.setBarLabelMode)
  const toggleSearch = usePairingGanttStore((s) => s.toggleSearch)
  const fullscreen = usePairingGanttStore((s) => s.fullscreen)
  const setFullscreen = usePairingGanttStore((s) => s.setFullscreen)
  const buildMode = usePairingGanttStore((s) => s.buildMode)
  const setBuildMode = usePairingGanttStore((s) => s.setBuildMode)
  const bulkMode = usePairingGanttStore((s) => s.bulkMode)
  const setBulkMode = usePairingGanttStore((s) => s.setBulkMode)
  const proposalEnabled = usePairingGanttStore((s) => s.proposalEnabled)
  const toggleProposal = usePairingGanttStore((s) => s.toggleProposal)
  const proposalDays = usePairingGanttStore((s) => s.proposalDays)
  const setProposalDays = usePairingGanttStore((s) => s.setProposalDays)
  const showTat = usePairingGanttStore((s) => s.showTat)
  const toggleTat = usePairingGanttStore((s) => s.toggleTat)
  const centerTimebar = usePairingGanttStore((s) => s.centerTimebar)
  const toggleCenterTimebar = usePairingGanttStore((s) => s.toggleCenterTimebar)
  const refreshIntervalMins = usePairingGanttStore((s) => s.refreshIntervalMins)
  const setRefreshIntervalMins = usePairingGanttStore((s) => s.setRefreshIntervalMins)
  const goToToday = usePairingGanttStore((s) => s.goToToday)
  const reviewFilterMode = usePairingGanttStore((s) => s.reviewFilterMode)
  const setReviewFilterMode = usePairingGanttStore((s) => s.setReviewFilterMode)
  const smartFilters = usePairingGanttStore((s) => s.smartFilters)
  const periodCommitted = usePairingStore((s) => s.periodCommitted)

  const [collapsed, setCollapsed] = useState(false)
  const [smartFiltersOpen, setSmartFiltersOpen] = useState(false)
  const [pairingsDropOpen, setPairingsDropOpen] = useState(false)
  const pairingsBtnRef = useRef<HTMLButtonElement>(null)
  const pairingsDropRef = useRef<HTMLDivElement>(null)
  const [pairingsDropPos, setPairingsDropPos] = useState({ top: 0, left: 0 })

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const activeBg = isDark ? 'rgba(62,123,250,0.20)' : 'rgba(30,64,175,0.12)'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  // Zoom stepping (used by Format popover)
  const zoomIdx = ZOOMS.indexOf(zoomLevel)
  const zoomPrev = () => {
    if (zoomIdx > 0) setZoom(ZOOMS[zoomIdx - 1])
  }
  const zoomNext = () => {
    if (zoomIdx < ZOOMS.length - 1) setZoom(ZOOMS[zoomIdx + 1])
  }

  function handleFullscreen() {
    if (typeof document === 'undefined') return
    if (fullscreen) {
      document.exitFullscreen?.()
      setFullscreen(false)
    } else {
      document.documentElement.requestFullscreen?.()
      setFullscreen(true)
    }
  }

  // ── Format popover ──
  const [formatOpen, setFormatOpen] = useState(false)
  const formatBtnRef = useRef<HTMLButtonElement>(null)
  const formatBtnCollapsedRef = useRef<HTMLButtonElement>(null)
  const formatDropRef = useRef<HTMLDivElement>(null)
  const [formatPos, setFormatPos] = useState({ top: 0, left: 0 })

  // ── Proposal days popover ──
  const [daysOpen, setDaysOpen] = useState(false)
  const daysBtnRef = useRef<HTMLButtonElement>(null)
  const daysBtnCollapsedRef = useRef<HTMLButtonElement>(null)
  const daysDropRef = useRef<HTMLDivElement>(null)
  const [daysPos, setDaysPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!daysOpen) return
    const source = collapsed ? daysBtnCollapsedRef.current : daysBtnRef.current
    if (!source) return
    const rect = source.getBoundingClientRect()
    setDaysPos({ top: rect.bottom + 4, left: rect.left })
  }, [daysOpen, collapsed])

  useEffect(() => {
    if (!daysOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        daysDropRef.current?.contains(target) ||
        daysBtnRef.current?.contains(target) ||
        daysBtnCollapsedRef.current?.contains(target)
      ) {
        return
      }
      setDaysOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [daysOpen])

  useEffect(() => {
    if (!formatOpen) return
    const source = collapsed ? formatBtnCollapsedRef.current : formatBtnRef.current
    if (!source) return
    const rect = source.getBoundingClientRect()
    setFormatPos({ top: rect.bottom + 4, left: rect.left })
  }, [formatOpen, collapsed])

  useEffect(() => {
    if (!formatOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        formatDropRef.current?.contains(target) ||
        formatBtnRef.current?.contains(target) ||
        formatBtnCollapsedRef.current?.contains(target)
      ) {
        return
      }
      setFormatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [formatOpen])

  useEffect(() => {
    if (!pairingsDropOpen) return
    const btn = pairingsBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setPairingsDropPos({ top: rect.bottom + 4, left: rect.left })
  }, [pairingsDropOpen])

  useEffect(() => {
    if (!pairingsDropOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (pairingsDropRef.current?.contains(t) || pairingsBtnRef.current?.contains(t)) return
      setPairingsDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pairingsDropOpen])

  const rowH = ROW_HEIGHT_LEVELS[rowHeightLevel].rowH

  // ── Unified item list (used by both collapsed and expanded views) ──
  type ToolbarItem = {
    icon: LucideIcon
    label: string
    tooltip?: string
    onClick?: () => void
    disabled?: boolean
    active?: boolean
    /** ref used by the collapsed view for positioning popovers */
    collapsedRef?: React.RefObject<HTMLButtonElement | null>
  }
  const toolbarItems: ToolbarItem[] = [
    {
      icon: LayoutGrid,
      label: 'Format',
      tooltip: 'Row height · Range · Refresh',
      onClick: () => setFormatOpen((o) => !o),
      active: formatOpen,
      collapsedRef: formatBtnCollapsedRef,
    },
    {
      icon: labelMode === 'flightNo' ? Binary : RouteIcon,
      label: labelMode === 'flightNo' ? 'Flight' : 'Sector',
      tooltip:
        labelMode === 'flightNo'
          ? 'Showing flight numbers — click for sectors'
          : 'Showing sectors — click for flight numbers',
      onClick: () => setLabelMode(labelMode === 'flightNo' ? 'sector' : 'flightNo'),
    },
    {
      icon: Timer,
      label: 'TAT',
      tooltip: showTat ? 'Hide turnaround times' : 'Show turnaround times',
      onClick: toggleTat,
      active: showTat,
    },
    {
      icon: Crosshair,
      label: 'Center',
      tooltip: centerTimebar ? 'Auto-centering on now (click to stop)' : 'Auto-center the canvas on current time',
      onClick: toggleCenterTimebar,
      active: centerTimebar,
    },
    {
      icon: fullscreen ? Minimize2 : Maximize2,
      label: fullscreen ? 'Exit' : 'Fullscreen',
      tooltip: fullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
      onClick: handleFullscreen,
      active: fullscreen,
    },
    {
      icon: CalendarCheck,
      label: 'Today',
      tooltip: 'Jump to current time',
      onClick: goToToday,
    },
    {
      icon: Search,
      label: 'Search',
      tooltip: 'Search flights (Ctrl+F)',
      onClick: toggleSearch,
    },
    {
      icon: Route,
      label: buildMode ? 'Build: ON' : 'Build: OFF',
      tooltip: buildMode
        ? 'Build mode enabled — click canvas flights to add to chain'
        : 'Build mode disabled — click to enable',
      onClick: () => setBuildMode(!buildMode),
      active: buildMode,
      disabled: !periodCommitted,
    },
    {
      icon: Layers,
      label: bulkMode ? 'Bulk: ON' : 'Bulk: OFF',
      tooltip: bulkMode
        ? 'Bulk mode ON — Enter queues pairings; Bulk Create writes all at once'
        : 'Enable bulk mode to queue multiple pairings before writing',
      onClick: () => setBulkMode(!bulkMode),
      active: bulkMode,
      disabled: !buildMode,
    },
    {
      icon: Lightbulb,
      label: 'Proposal',
      tooltip: proposalEnabled ? 'Hide next-leg proposals' : 'Highlight legal next-leg candidates',
      onClick: toggleProposal,
      active: proposalEnabled,
      disabled: !buildMode,
    },
    {
      icon: CalendarDays,
      label: `Days (${proposalDays})`,
      tooltip: 'Days ahead to search for next-leg candidates',
      onClick: () => setDaysOpen((o) => !o),
      active: daysOpen,
      disabled: !buildMode || !proposalEnabled,
      collapsedRef: daysBtnCollapsedRef,
    },
  ]

  return (
    <div
      className="shrink-0 overflow-hidden rounded-2xl"
      style={{
        height: collapsed ? 52 : 145,
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ── Collapsed: icon-only row ── */}
      {collapsed && (
        <div className="flex items-center gap-0.5 px-2" style={{ height: 52 }}>
          {toolbarItems.map((item, i) => {
            const Icon = item.icon
            const isActive = !!item.active
            return (
              <div key={i} className="relative">
                <Tooltip content={item.tooltip ?? item.label}>
                  <button
                    ref={item.collapsedRef}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 ${
                      item.disabled ? 'opacity-30 pointer-events-none' : ''
                    }`}
                    style={{
                      background: isActive ? activeBg : undefined,
                      color: isActive ? (isDark ? '#5B8DEF' : '#1e40af') : palette.textSecondary,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive && !item.disabled) e.currentTarget.style.background = hoverBg
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <Icon size={18} strokeWidth={1.6} />
                  </button>
                </Tooltip>
              </div>
            )
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
      )}

      {/* ── Expanded: full ribbon ── */}
      {!collapsed && (
        <div className="flex items-stretch gap-0" style={{ minHeight: 120 }}>
          {/* Format */}
          <RibbonSection label="Format">
            <RibbonBtn
              ref={formatBtnRef}
              icon={LayoutGrid}
              label="Format"
              onClick={() => setFormatOpen((o) => !o)}
              active={formatOpen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Row height · Range · Refresh"
            />
          </RibbonSection>
          <RibbonDivider isDark={isDark} />

          {/* Display */}
          <RibbonSection label="Display">
            <RibbonBtn
              icon={labelMode === 'flightNo' ? Binary : RouteIcon}
              label={labelMode === 'flightNo' ? 'Flight' : 'Sector'}
              onClick={() => setLabelMode(labelMode === 'flightNo' ? 'sector' : 'flightNo')}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={
                labelMode === 'flightNo'
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
          </RibbonSection>
          <RibbonDivider isDark={isDark} />

          {/* Navigate */}
          <RibbonSection label="Navigate">
            <RibbonBtn
              icon={Crosshair}
              label="Center"
              onClick={toggleCenterTimebar}
              active={centerTimebar}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={
                centerTimebar ? 'Auto-centering on now (click to stop)' : 'Auto-center the canvas on current time'
              }
            />
            <RibbonBtn
              icon={fullscreen ? Minimize2 : Maximize2}
              label={fullscreen ? 'Exit' : 'Fullscreen'}
              onClick={handleFullscreen}
              active={fullscreen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            />
            <RibbonBtn
              icon={CalendarCheck}
              label="Today"
              onClick={goToToday}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Jump to current time"
            />
            <RibbonBtn
              icon={Search}
              label="Search"
              onClick={toggleSearch}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Search flights (Ctrl+F)"
            />
          </RibbonSection>
          <RibbonDivider isDark={isDark} />

          {/* Build (primary CTA) */}
          <RibbonSection label="Build">
            <RibbonBtn
              icon={Route}
              label={buildMode ? 'Build: ON' : 'Build: OFF'}
              onClick={() => setBuildMode(!buildMode)}
              disabled={!periodCommitted}
              active={buildMode}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={
                buildMode
                  ? 'Build mode enabled — click canvas flights to add to chain'
                  : 'Build mode disabled — click to enable'
              }
            />
            <RibbonBtn
              icon={Layers}
              label={bulkMode ? 'Bulk: ON' : 'Bulk: OFF'}
              onClick={() => setBulkMode(!bulkMode)}
              disabled={!buildMode}
              active={bulkMode}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={
                bulkMode
                  ? 'Bulk mode ON — Enter queues pairings; Bulk Create writes all at once'
                  : 'Enable bulk mode to queue multiple pairings before writing'
              }
            />
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
              }}
            >
              <RibbonBtn
                icon={Lightbulb}
                label="Proposal"
                onClick={toggleProposal}
                disabled={!buildMode}
                active={proposalEnabled}
                isDark={isDark}
                hoverBg={hoverBg}
                activeBg={activeBg}
                tooltip={proposalEnabled ? 'Hide next-leg proposals' : 'Highlight legal next-leg candidates'}
              />
              <div
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              />
              <RibbonBtn
                ref={daysBtnRef}
                icon={CalendarDays}
                label={`Days (${proposalDays})`}
                onClick={() => setDaysOpen((o) => !o)}
                disabled={!buildMode || !proposalEnabled}
                active={daysOpen}
                isDark={isDark}
                hoverBg={hoverBg}
                activeBg={activeBg}
                tooltip="Days ahead to search for next-leg candidates"
              />
            </div>
          </RibbonSection>
          <RibbonDivider isDark={isDark} />

          {/* Review */}
          <RibbonSection label="Review">
            {/* Pairings quick-filter dropdown */}
            <RibbonBtn
              ref={pairingsBtnRef}
              icon={ListFilter}
              label="Pairings"
              onClick={() => setPairingsDropOpen((o) => !o)}
              active={pairingsDropOpen || reviewFilterMode !== 'all'}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Quick-filter pairing zone by type"
            />
            {/* Smart filters dialog */}
            <RibbonBtn
              icon={SlidersHorizontal}
              label="Filters"
              onClick={() => setSmartFiltersOpen(true)}
              active={smartFilters !== null}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Advanced multi-criteria pairing filters"
            />
          </RibbonSection>

          {/* Collapse chevron — top-right */}
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

      {/* ── Format popover — Row Height + Range + Refresh Interval ── */}
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
              onMinus={() => cycleRowHeight(-1)}
              onPlus={() => cycleRowHeight(1)}
              minusDisabled={rowHeightLevel <= 0}
              plusDisabled={rowHeightLevel >= ROW_HEIGHT_LEVELS.length - 1}
              value={String(rowH)}
              panelBorder={panelBorder}
              hoverBg={hoverBg}
            />
            <Stepper
              label="Range"
              onMinus={zoomPrev}
              onPlus={zoomNext}
              minusDisabled={zoomIdx <= 0}
              plusDisabled={zoomIdx >= ZOOMS.length - 1}
              value={zoomLevel}
              panelBorder={panelBorder}
              hoverBg={hoverBg}
            />
            <Stepper
              label="Refresh Interval"
              onMinus={() => setRefreshIntervalMins(refreshIntervalMins - 1)}
              onPlus={() => setRefreshIntervalMins(refreshIntervalMins + 1)}
              minusDisabled={refreshIntervalMins <= 1}
              plusDisabled={refreshIntervalMins >= 59}
              value={`${refreshIntervalMins}m`}
              panelBorder={panelBorder}
              hoverBg={hoverBg}
            />
          </div>,
          document.body,
        )}

      {/* ── Pairings quick-filter dropdown ── */}
      {pairingsDropOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={pairingsDropRef}
            className="fixed z-9999 rounded-xl overflow-hidden select-none"
            style={{
              top: pairingsDropPos.top,
              left: pairingsDropPos.left,
              width: 320,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
            }}
          >
            <div
              className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold"
              style={{
                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                borderBottom: `1px solid ${panelBorder}`,
              }}
            >
              Filter pairing zone
            </div>
            <div className="py-1">
              {(
                [
                  ['all', 'All Crew Routes'],
                  ['operating', 'Has operating leg (no Pax/Ground duties)'],
                  ['unfinalized', 'Unfinalized routes only'],
                  ['deadhead', 'Dead-heading routes only'],
                  ['non_base_to_base', 'Non base-to-base routes only'],
                  ['illegal', 'Illegal routes only'],
                  ['partial_uncovered', 'Associated with partially uncovered A/C legs'],
                  ['over_covered', 'Associated with over-covered A/C legs'],
                  ['over_and_under', 'Associated with over and under-covered A/C legs'],
                  ['any_coverage', 'Associated with A/C legs with any coverage problem'],
                ] as Array<[ReviewFilterMode, string]>
              ).map(([mode, label], i) => {
                const isActive = reviewFilterMode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setReviewFilterMode(mode)
                      setPairingsDropOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-[13px] transition-colors text-left"
                    style={{ color: isActive ? (isDark ? '#5B8DEF' : '#1e40af') : isDark ? '#E5E7EB' : '#1F2937' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      className="shrink-0 w-4 h-4 flex items-center justify-center rounded text-[11px] font-semibold"
                      style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1">{label}</span>
                    {isActive && <Check size={13} style={{ color: isDark ? '#5B8DEF' : '#1e40af', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}

      {/* ── Proposal days popover ── */}
      {daysOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={daysDropRef}
            className="fixed z-[9999] rounded-xl p-3 select-none"
            style={{
              top: daysPos.top,
              left: daysPos.left,
              width: 200,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
            }}
          >
            <Stepper
              label="Days Ahead"
              onMinus={() => setProposalDays(proposalDays - 1)}
              onPlus={() => setProposalDays(proposalDays + 1)}
              minusDisabled={proposalDays <= 1}
              plusDisabled={proposalDays >= 7}
              value={`${proposalDays}d`}
              panelBorder={panelBorder}
              hoverBg={hoverBg}
            />
          </div>,
          document.body,
        )}

      {smartFiltersOpen && <SmartFiltersDialog onClose={() => setSmartFiltersOpen(false)} />}
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
          className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text tabular-nums"
          style={{
            width: 72,
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
