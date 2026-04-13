'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  Check,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  CalendarCheck,
  Search,
  Palette,
  Maximize2,
  Minimize2,
  RefreshCw,
  FileDown,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { Tooltip } from '@/components/ui/tooltip'
import { RibbonSection, RibbonBtn, RibbonDivider as Divider } from '@/components/ui/ribbon-primitives'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'
import { getOperatorId } from '@/stores/use-operator-store'

const ALL_ZOOM_OPTIONS = [7, 14, 21, 28, 30] as const

export function PlanningToolbar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const stats = useMaintenancePlanningStore((s) => s.stats)
  const selectedEvent = useMaintenancePlanningStore((s) => s.selectedEvent)
  const zoomDays = useMaintenancePlanningStore((s) => s.zoomDays)
  const rowHeight = useMaintenancePlanningStore((s) => s.rowHeight)
  const colorMode = useMaintenancePlanningStore((s) => s.colorMode)
  const setRowHeight = useMaintenancePlanningStore((s) => s.setRowHeight)
  const setColorMode = useMaintenancePlanningStore((s) => s.setColorMode)
  const forecastLoading = useMaintenancePlanningStore((s) => s.forecastLoading)
  const bulkLoading = useMaintenancePlanningStore((s) => s.bulkLoading)
  const forecastBanner = useMaintenancePlanningStore((s) => s.forecastBanner)
  const periodFrom = useMaintenancePlanningStore((s) => s.committedFrom)
  const periodTo = useMaintenancePlanningStore((s) => s.committedTo)
  const runForecast = useMaintenancePlanningStore((s) => s.runForecast)
  const acceptAll = useMaintenancePlanningStore((s) => s.acceptAll)
  const rejectAll = useMaintenancePlanningStore((s) => s.rejectAll)
  const setZoomDays = useMaintenancePlanningStore((s) => s.setZoomDays)
  const openForm = useMaintenancePlanningStore((s) => s.openForm)
  const deleteSelectedEvent = useMaintenancePlanningStore((s) => s.deleteSelectedEvent)
  const setSearchOpen = useMaintenancePlanningStore((s) => s.setSearchOpen)
  const dismissForecastBanner = useMaintenancePlanningStore((s) => s.dismissForecastBanner)

  const [collapsed, setCollapsed] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const formatBtnRef = useRef<HTMLButtonElement>(null)
  const formatDropRef = useRef<HTMLDivElement>(null)
  const [formatPos, setFormatPos] = useState({ top: 0, left: 0 })

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(62,123,250,0.12)' : 'rgba(30,64,175,0.08)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const handleForecast = () => runForecast(getOperatorId())
  const handleAcceptAll = () => acceptAll(getOperatorId())
  const handleRejectAll = () => rejectAll(getOperatorId())

  // Scroll gantt to today
  const handleGoToToday = useCallback(() => {
    const el = document.querySelector('[data-mx-gantt-scroll]') as HTMLElement | null
    if (!el) return
    const from = new Date(periodFrom).getTime()
    const to = new Date(periodTo).getTime()
    const now = Date.now()
    const totalMs = to - from + 86400000
    const totalWidth = el.scrollWidth
    const todayPx = ((now - from) / totalMs) * totalWidth
    el.scrollLeft = Math.max(0, todayPx - el.clientWidth / 3)
  }, [periodFrom, periodTo])

  // Fullscreen toggle
  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Export CSV
  const handleExport = useCallback(() => {
    const rows = useMaintenancePlanningStore.getState().rows
    const lines = ['Aircraft,Type,Base,Check,Status,Start,End,Station,Source']
    for (const row of rows) {
      for (const ev of row.events) {
        lines.push(
          [
            ev.registration,
            ev.icaoType,
            ev.base,
            ev.checkCode,
            ev.status,
            ev.plannedStart,
            ev.plannedEnd ?? '',
            ev.station,
            ev.source,
          ].join(','),
        )
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `maintenance-planning-${periodFrom}-${periodTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [periodFrom, periodTo])

  // Zoom options
  const periodDays = useMemo(() => {
    if (!periodFrom || !periodTo) return 0
    return Math.round((new Date(periodTo).getTime() - new Date(periodFrom).getTime()) / 86400000)
  }, [periodFrom, periodTo])

  const zoomOptions = useMemo((): number[] => ALL_ZOOM_OPTIONS.filter((d) => d <= periodDays), [periodDays])
  const zoomIdx = zoomOptions.indexOf(zoomDays)
  const zoomLabel = zoomDays === 30 ? 'M' : `${zoomDays}D`
  const zoomPrev = () => {
    if (zoomIdx > 0) setZoomDays(zoomOptions[zoomIdx - 1])
  }
  const zoomNext = () => {
    if (zoomIdx < zoomOptions.length - 1) setZoomDays(zoomOptions[zoomIdx + 1])
  }

  // Format popover position + click-outside
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
        formatBtnRef.current &&
        !formatBtnRef.current.contains(t) &&
        formatDropRef.current &&
        !formatDropRef.current.contains(t)
      )
        setFormatOpen(false)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [formatOpen])

  // Collapsed toolbar items
  const toolbarItems = [
    {
      icon: Activity,
      label: 'Forecast',
      tooltip: 'Run forecast engine',
      onClick: handleForecast,
      disabled: forecastLoading,
    },
    { icon: RefreshCw, label: 'Sync', tooltip: 'AMOS/MRO sync (coming soon)', disabled: true },
    {
      icon: Plus,
      label: 'New',
      tooltip: 'Create maintenance event',
      onClick: () => openForm({ mode: 'create', aircraftId: '', registration: '' }),
    },
    {
      icon: Pencil,
      label: 'Edit',
      tooltip: selectedEvent ? 'Edit selected event' : 'Select an event to edit',
      onClick: selectedEvent
        ? () =>
            openForm({
              mode: 'edit',
              aircraftId: selectedEvent.aircraftId,
              registration: selectedEvent.registration,
              event: selectedEvent,
            })
        : undefined,
      disabled: !selectedEvent,
    },
    {
      icon: Trash2,
      label: 'Delete',
      tooltip: selectedEvent ? 'Delete selected event' : 'Select an event to delete',
      onClick: selectedEvent ? deleteSelectedEvent : undefined,
      disabled: !selectedEvent,
    },
    ...(stats.proposed > 0
      ? [
          {
            icon: Check,
            label: 'Accept',
            tooltip: `Accept all (${stats.proposed})`,
            onClick: handleAcceptAll,
            disabled: bulkLoading,
          },
          { icon: X, label: 'Reject', tooltip: 'Reject all proposed', onClick: handleRejectAll, disabled: bulkLoading },
        ]
      : []),
    { icon: CalendarCheck, label: 'Today', tooltip: 'Scroll to today', onClick: handleGoToToday },
    { icon: Search, label: 'Search', tooltip: 'Search aircraft/events', onClick: () => setSearchOpen(true) },
    {
      icon: LayoutGrid,
      label: 'Format',
      tooltip: 'Row height & range',
      onClick: () => setFormatOpen((o) => !o),
      ref: formatBtnRef,
      active: formatOpen,
    },
    {
      icon: Palette,
      label: 'Color',
      tooltip: `Color by ${colorMode === 'check_type' ? 'status' : 'check type'}`,
      onClick: () => setColorMode(colorMode === 'check_type' ? 'status' : 'check_type'),
      active: colorMode === 'status',
    },
    {
      icon: isFullscreen ? Minimize2 : Maximize2,
      label: isFullscreen ? 'Exit' : 'Fullscreen',
      tooltip: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
      onClick: handleFullscreen,
      active: isFullscreen,
    },
    { icon: FileDown, label: 'Export', tooltip: 'Export to CSV', onClick: handleExport },
  ]

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
        <div
          className="flex items-center gap-0.5 px-2"
          style={{ height: 52, animation: 'bc-dropdown-in 150ms ease-out' }}
        >
          {toolbarItems.map((item, i) => (
            <Tooltip key={i} content={item.tooltip ?? item.label}>
              <button
                ref={'ref' in item ? (item.ref as React.RefObject<HTMLButtonElement | null>) : undefined}
                onClick={item.onClick}
                disabled={item.disabled}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 ${item.disabled ? 'opacity-30 pointer-events-none' : ''}`}
                style={{
                  background: 'active' in item && item.active ? activeBg : undefined,
                  color: 'active' in item && item.active ? (isDark ? '#5B8DEF' : '#1e40af') : palette.textSecondary,
                }}
                onMouseEnter={(e) => {
                  if (!('active' in item && item.active)) e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  if (!('active' in item && item.active))
                    e.currentTarget.style.background = 'active' in item && item.active ? activeBg : 'transparent'
                }}
              >
                <item.icon size={18} strokeWidth={1.6} />
              </button>
            </Tooltip>
          ))}
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
        <div
          className="flex items-stretch gap-0"
          style={{ minHeight: 120, animation: 'bc-dropdown-in 150ms ease-out' }}
        >
          {/* ── Actions ── */}
          <RibbonSection label="Actions">
            <RibbonBtn
              icon={Activity}
              label="Forecast"
              onClick={handleForecast}
              disabled={forecastLoading}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Run forecast engine"
            />
            <RibbonBtn
              icon={RefreshCw}
              label="Sync"
              disabled
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="AMOS/MRO sync (coming soon)"
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Events ── */}
          <RibbonSection label="Events">
            <RibbonBtn
              icon={Plus}
              label="New"
              onClick={() => openForm({ mode: 'create', aircraftId: '', registration: '' })}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Create maintenance event"
            />
            <RibbonBtn
              icon={Pencil}
              label="Edit"
              onClick={
                selectedEvent
                  ? () =>
                      openForm({
                        mode: 'edit',
                        aircraftId: selectedEvent.aircraftId,
                        registration: selectedEvent.registration,
                        event: selectedEvent,
                      })
                  : undefined
              }
              disabled={!selectedEvent}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={selectedEvent ? 'Edit selected event' : 'Select an event to edit'}
            />
            <RibbonBtn
              icon={Trash2}
              label="Delete"
              onClick={selectedEvent ? deleteSelectedEvent : undefined}
              disabled={!selectedEvent}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={selectedEvent ? 'Delete selected event' : 'Select an event to delete'}
            />
          </RibbonSection>

          {/* ── Bulk (conditional) ── */}
          {stats.proposed > 0 && (
            <>
              <Divider isDark={isDark} />
              <RibbonSection label="Bulk">
                <div className="relative">
                  <RibbonBtn
                    icon={Check}
                    label="Accept"
                    onClick={handleAcceptAll}
                    disabled={bulkLoading}
                    isDark={isDark}
                    hoverBg={hoverBg}
                    activeBg={activeBg}
                    tooltip={`Accept all ${stats.proposed} proposed events`}
                  />
                  <div
                    className="absolute top-2 right-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5"
                    style={{ background: '#06C270', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}
                  >
                    {stats.proposed}
                  </div>
                </div>
                <RibbonBtn
                  icon={X}
                  label="Reject"
                  onClick={handleRejectAll}
                  disabled={bulkLoading}
                  isDark={isDark}
                  hoverBg={hoverBg}
                  activeBg={activeBg}
                  tooltip="Reject all proposed events"
                />
              </RibbonSection>
            </>
          )}

          <Divider isDark={isDark} />

          {/* ── Navigate ── */}
          <RibbonSection label="Navigate">
            <RibbonBtn
              icon={CalendarCheck}
              label="Today"
              onClick={handleGoToToday}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Scroll to today"
            />
            <RibbonBtn
              icon={Search}
              label="Search"
              onClick={() => setSearchOpen(true)}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Search aircraft/events"
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
              tooltip="Row height & range"
            />
            <RibbonBtn
              icon={Palette}
              label="Color"
              onClick={() => setColorMode(colorMode === 'check_type' ? 'status' : 'check_type')}
              active={colorMode === 'status'}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={
                colorMode === 'check_type'
                  ? 'Showing check type colors — click for status'
                  : 'Showing status colors — click for check type'
              }
            />
            <RibbonBtn
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? 'Exit' : 'Fullscreen'}
              onClick={handleFullscreen}
              active={isFullscreen}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            />
          </RibbonSection>
          <Divider isDark={isDark} />

          {/* ── Settings ── */}
          <RibbonSection label="Settings">
            <RibbonBtn
              icon={FileDown}
              label="Export"
              onClick={handleExport}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Export schedule to CSV"
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
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
            }}
          >
            {/* Row Height */}
            <div>
              <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">Row Height</div>
              <Stepper
                value={rowHeight}
                onDec={() => setRowHeight(rowHeight - 4)}
                onInc={() => setRowHeight(rowHeight + 4)}
                disableDec={rowHeight <= 28}
                disableInc={rowHeight >= 56}
                panelBorder={panelBorder}
                hoverBg={hoverBg}
              />
            </div>
            {/* Range */}
            <div>
              <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">Range</div>
              <Stepper
                value={zoomLabel}
                onDec={zoomPrev}
                onInc={zoomNext}
                disableDec={zoomIdx <= 0}
                disableInc={zoomIdx >= zoomOptions.length - 1}
                panelBorder={panelBorder}
                hoverBg={hoverBg}
              />
            </div>
          </div>,
          document.body,
        )}

      {/* ── Forecast banner ── */}
      {forecastBanner && (
        <div
          className="flex items-center gap-3 px-4 py-2 text-[13px] text-hz-text"
          style={{
            background: isDark ? 'rgba(62,123,250,0.08)' : 'rgba(30,64,175,0.05)',
            borderTop: `1px solid ${sectionBorder}`,
          }}
        >
          <Activity size={14} className="text-module-accent" />
          <span>
            Forecast engine analyzed <strong>{forecastBanner.aircraft}</strong> aircraft.{' '}
            <strong className="text-module-accent">{forecastBanner.events}</strong> auto-proposed events created.
          </span>
          {forecastBanner.events > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="px-2.5 py-0.5 rounded-full text-[13px] font-semibold bg-module-accent text-white">
                {forecastBanner.events}
              </span>
              <button onClick={handleAcceptAll} className="text-[13px] font-medium" style={{ color: '#06C270' }}>
                Accept all
              </button>
              <button onClick={handleRejectAll} className="text-[13px] font-medium" style={{ color: '#FF3B3B' }}>
                Reject all
              </button>
            </div>
          )}
          <button onClick={dismissForecastBanner} className="p-1 rounded hover:bg-hz-border/20">
            <X size={14} className="text-hz-text-tertiary" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Stepper (−/value/+) ── */

function Stepper({
  value,
  onDec,
  onInc,
  disableDec,
  disableInc,
  panelBorder,
  hoverBg,
}: {
  value: string | number
  onDec: () => void
  onInc: () => void
  disableDec: boolean
  disableInc: boolean
  panelBorder: string
  hoverBg: string
}) {
  return (
    <div className="flex items-center justify-center">
      <button
        onClick={onDec}
        disabled={disableDec}
        className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30"
        style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hoverBg
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        −
      </button>
      <div
        className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text"
        style={{
          width: 56,
          height: 36,
          borderTop: `1px solid ${panelBorder}`,
          borderBottom: `1px solid ${panelBorder}`,
        }}
      >
        {value}
      </div>
      <button
        onClick={onInc}
        disabled={disableInc}
        className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30"
        style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hoverBg
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        +
      </button>
    </div>
  )
}
