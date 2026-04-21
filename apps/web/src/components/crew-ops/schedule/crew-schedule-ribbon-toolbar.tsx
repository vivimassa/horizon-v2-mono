'use client'

import { useRef, useState, type ElementType, type RefObject } from 'react'
import {
  Tag,
  Binary,
  Route as RouteIcon,
  Maximize2,
  Minimize2,
  LayoutGrid,
  CalendarCheck,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  PanelRight,
  PanelRightClose,
  RefreshCw,
  Filter,
  ShieldAlert,
  UserRoundX,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { Tooltip } from '@/components/ui/tooltip'
import { RibbonSection, RibbonBtn, RibbonDivider } from '@/components/ui/ribbon-primitives'
import { FormatPopover } from '@/components/ui/format-popover'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { CREW_ROW_HEIGHT_LEVELS, type BarLabelMode, type CrewScheduleZoom } from '@/lib/crew-schedule/layout'
import { isSmartFilterActive } from '@/lib/crew-schedule/smart-filter'

interface Props {
  onFullscreen?: () => void
  isFullscreen?: boolean
  onRefresh?: () => void
  onToggleSmartFilter?: () => void
  smartFilterOpen?: boolean
  onOpenCheatsheet?: () => void
  onOpenLegalityCheck?: () => void
}

/** Zoom progression for the Format popover's Range stepper. */
const CREW_ZOOMS: CrewScheduleZoom[] = ['7D', '14D', '28D', 'M']

/**
 * Ribbon toolbar for 4.1.6 Crew Schedule. Section order mirrors 4.1.5.2
 * (`pairing-gantt-toolbar.tsx`): Format → Display → Navigate → Help.
 * Label-mode icons match 4.1.5.2: `Binary` for Flight No., `RouteIcon`
 * for Sector; `Tag` for Pairing No. (4.1.6-only third state).
 *
 * Row height · Range · Refresh interval live inside the shared
 * `<FormatPopover>` (used by both 2.1.1 Movement Control and 4.1.5.2).
 */
export function CrewScheduleRibbonToolbar({
  onFullscreen,
  isFullscreen,
  onRefresh,
  onToggleSmartFilter,
  smartFilterOpen,
  onOpenCheatsheet,
  onOpenLegalityCheck,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const barLabelMode = useCrewScheduleStore((s) => s.barLabelMode)
  const smartFilter = useCrewScheduleStore((s) => s.smartFilter)
  const smartActive = isSmartFilterActive(smartFilter)
  const cycleLabelMode = useCrewScheduleStore((s) => s.cycleLabelMode)
  const rightPanelOpen = useCrewScheduleStore((s) => s.rightPanelOpen)
  const setRightPanelOpen = useCrewScheduleStore((s) => s.setRightPanelOpen)
  const uncrewedTrayVisible = useCrewScheduleStore((s) => s.uncrewedTrayVisible)
  const toggleUncrewedTrayVisible = useCrewScheduleStore((s) => s.toggleUncrewedTrayVisible)
  const rowHeightLevel = useCrewScheduleStore((s) => s.rowHeightLevel)
  const zoomRowIn = useCrewScheduleStore((s) => s.zoomRowIn)
  const zoomRowOut = useCrewScheduleStore((s) => s.zoomRowOut)
  const zoom = useCrewScheduleStore((s) => s.zoom)
  const setZoom = useCrewScheduleStore((s) => s.setZoom)
  const refreshIntervalMins = useCrewScheduleStore((s) => s.refreshIntervalMins)
  const setRefreshIntervalMins = useCrewScheduleStore((s) => s.setRefreshIntervalMins)
  const goToToday = useCrewScheduleStore((s) => s.goToToday)
  const loading = useCrewScheduleStore((s) => s.loading)

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.10)'

  const [collapsed, setCollapsed] = useState(false)

  const formatBtnRefExpanded = useRef<HTMLButtonElement>(null)
  const formatBtnRefCollapsed = useRef<HTMLButtonElement>(null)
  const [formatOpen, setFormatOpen] = useState(false)

  const labelModeMeta: Record<BarLabelMode, { icon: typeof Tag; label: string; tooltip: string }> = {
    pairing: {
      icon: Tag,
      label: 'Pairing',
      tooltip: 'Showing pairing codes — click for Sector',
    },
    sector: {
      icon: RouteIcon,
      label: 'Sector',
      tooltip: 'Showing sectors — click for Flight No.',
    },
    flight: {
      icon: Binary,
      label: 'Flight',
      tooltip: 'Showing flight numbers — click for Pairing No.',
    },
  }
  const labelIcon = labelModeMeta[barLabelMode].icon
  const labelText = labelModeMeta[barLabelMode].label
  const labelTooltip = labelModeMeta[barLabelMode].tooltip

  const zoomIdx = CREW_ZOOMS.indexOf(zoom)
  const zoomPrev = () => {
    if (zoomIdx > 0) setZoom(CREW_ZOOMS[zoomIdx - 1])
  }
  const zoomNext = () => {
    if (zoomIdx < CREW_ZOOMS.length - 1) setZoom(CREW_ZOOMS[zoomIdx + 1])
  }

  const activeFormatAnchor = collapsed ? formatBtnRefCollapsed : formatBtnRefExpanded

  return (
    <div className="select-none" style={{ color: palette.text }}>
      {/* ── Collapsed: icon-only strip ── */}
      {collapsed &&
        (() => {
          const cb = (
            icon: ElementType,
            tip: string,
            onClick?: () => void,
            opts?: { active?: boolean; disabled?: boolean; btnRef?: RefObject<HTMLButtonElement | null> },
          ) => {
            const Icon = icon
            const { active, disabled, btnRef } = opts ?? {}
            return (
              <Tooltip content={tip} key={tip}>
                <button
                  ref={btnRef}
                  onClick={onClick}
                  disabled={disabled}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
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
                  <Icon size={18} strokeWidth={1.6} />
                </button>
              </Tooltip>
            )
          }
          return (
            <div
              className="flex items-center gap-0.5 px-2"
              style={{ height: 52, animation: 'bc-dropdown-in 150ms ease-out' }}
            >
              {/* Format */}
              {cb(LayoutGrid, 'Format', () => setFormatOpen((o) => !o), {
                active: formatOpen,
                btnRef: formatBtnRefCollapsed,
              })}
              {/* Display */}
              {cb(labelIcon, labelTooltip, cycleLabelMode)}
              {cb(
                rightPanelOpen ? PanelRightClose : PanelRight,
                rightPanelOpen ? 'Hide inspector' : 'Show inspector',
                () => setRightPanelOpen(!rightPanelOpen),
              )}
              {cb(Filter, smartActive ? 'Smart filter (active)' : 'Smart filter', onToggleSmartFilter, {
                active: !!smartFilterOpen || smartActive,
              })}
              {/* Navigate */}
              {cb(isFullscreen ? Minimize2 : Maximize2, isFullscreen ? 'Exit fullscreen' : 'Fullscreen', onFullscreen, {
                active: isFullscreen,
              })}
              {cb(CalendarCheck, 'Today', goToToday)}
              {cb(RefreshCw, 'Refresh', onRefresh, { disabled: loading })}
              {/* Help */}
              {cb(HelpCircle, 'Shortcuts', onOpenCheatsheet)}
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
          {/* ── Format ── */}
          <RibbonSection label="Format">
            <RibbonBtn
              ref={formatBtnRefExpanded}
              icon={LayoutGrid}
              label="Format"
              onClick={() => setFormatOpen((o) => !o)}
              active={formatOpen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Row height · Range · Refresh interval"
            />
          </RibbonSection>
          <RibbonDivider isDark={isDark} />

          {/* ── Display ── */}
          <RibbonSection label="Display">
            <RibbonBtn
              icon={labelIcon}
              label={labelText}
              onClick={cycleLabelMode}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={labelTooltip}
            />
            <RibbonBtn
              icon={rightPanelOpen ? PanelRightClose : PanelRight}
              label={rightPanelOpen ? 'Hide' : 'Show'}
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              active={rightPanelOpen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={rightPanelOpen ? 'Hide inspector panel' : 'Show inspector panel'}
            />
            <RibbonBtn
              icon={Filter}
              label={smartActive ? 'Filter ●' : 'Smart Filter'}
              onClick={onToggleSmartFilter}
              active={!!smartFilterOpen || smartActive}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Smart Filter — highlight, show-only or exclude crew by violation, expiry, activity, A/C type, or language"
            />
            <RibbonBtn
              icon={UserRoundX}
              label="Uncrewed"
              onClick={toggleUncrewedTrayVisible}
              active={uncrewedTrayVisible}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={uncrewedTrayVisible ? 'Hide uncrewed duties tray' : 'Show uncrewed duties tray'}
            />
            <RibbonBtn
              icon={ShieldAlert}
              label="Legality"
              onClick={onOpenLegalityCheck}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Legality Check — review every legality issue and acknowledged override for this period"
            />
          </RibbonSection>
          <RibbonDivider isDark={isDark} />

          {/* ── Navigate ── */}
          <RibbonSection label="Navigate">
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
            <RibbonBtn
              icon={CalendarCheck}
              label="Today"
              onClick={goToToday}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Center timeline on today"
            />
            <RibbonBtn
              icon={RefreshCw}
              label="Refresh"
              onClick={onRefresh}
              disabled={loading}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Refresh schedule"
            />
          </RibbonSection>
          <RibbonDivider isDark={isDark} />

          {/* ── Help ── */}
          <RibbonSection label="Help">
            <RibbonBtn
              icon={HelpCircle}
              label="Shortcuts"
              onClick={onOpenCheatsheet}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Keyboard shortcuts (?)"
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

      {/* ── Shared Format popover (matches 2.1.1 + 4.1.5.2) ── */}
      <FormatPopover
        open={formatOpen}
        onClose={() => setFormatOpen(false)}
        anchorRef={activeFormatAnchor}
        rowHeight={{
          displayValue: CREW_ROW_HEIGHT_LEVELS[rowHeightLevel].rowH,
          canDecrement: rowHeightLevel > 0,
          canIncrement: rowHeightLevel < CREW_ROW_HEIGHT_LEVELS.length - 1,
          onDecrement: zoomRowOut,
          onIncrement: zoomRowIn,
        }}
        range={{
          displayValue: zoom,
          canPrev: zoomIdx > 0,
          canNext: zoomIdx < CREW_ZOOMS.length - 1,
          onPrev: zoomPrev,
          onNext: zoomNext,
        }}
        refreshInterval={{
          valueMins: refreshIntervalMins,
          onChange: setRefreshIntervalMins,
        }}
      />
    </div>
  )
}
