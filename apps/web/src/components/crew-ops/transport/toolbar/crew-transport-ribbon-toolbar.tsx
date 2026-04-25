'use client'

import { useTheme } from '@/components/theme-provider'
import { RibbonSection, RibbonBtn, RibbonDivider } from '@/components/ui/ribbon-primitives'
import {
  RefreshCw,
  Layers,
  Sparkles,
  CheckCircle2,
  Rows3,
  RotateCw,
  Download,
  AlertTriangle,
  MapPin,
  Send,
  LogIn,
  CheckSquare,
  Inbox,
  Pause,
  X,
  PlusCircle,
  ImagePlus,
  HelpCircle,
} from 'lucide-react'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { useHelp } from '@/components/help'

interface CrewTransportRibbonToolbarProps {
  // Ground — Planning
  onFetch: () => void
  onBatch: () => void
  onAutoAssign: () => void
  // Ground — Day-to-Day lifecycle
  onDispatch: () => void
  onPickedUp: () => void
  onCompleted: () => void
  onNoShow: () => void
  onTrack: () => void
  onDisruption: () => void
  // Common
  onToggleStatusPanel: () => void
  onCycleGroupBy: () => void
  onCycleDensity: () => void
  onExport: () => void
  // Ground — Communication
  onOpenIncoming: () => void
  onOpenOutgoing: () => void
  onComposeHeld: () => void
  onReleaseSelected: () => void
  onDiscardSelected: () => void
  // Flight
  onBookFlight: () => void
  onReplaceTicket: () => void
}

export function CrewTransportRibbonToolbar(props: CrewTransportRibbonToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(91,141,239,0.15)' : 'rgba(30,64,175,0.10)'

  const segment = useCrewTransportStore((s) => s.segment)
  const groundTab = useCrewTransportStore((s) => s.groundTab)
  const flightTab = useCrewTransportStore((s) => s.flightTab)
  const pollingPaused = useCrewTransportStore((s) => s.pollingPaused)
  const setPollingPaused = useCrewTransportStore((s) => s.setPollingPaused)
  const periodCommitted = useCrewTransportStore((s) => s.periodCommitted)
  const disabled = !periodCommitted
  const { openHelp } = useHelp()

  /** Help section rendered at the rightmost edge of every ribbon variant. */
  const helpSection = (
    <>
      <RibbonDivider isDark={isDark} />
      <RibbonSection label="Help">
        <RibbonBtn
          icon={HelpCircle}
          label="Help"
          onClick={() => openHelp()}
          isDark={isDark}
          hoverBg={hoverBg}
          activeBg={activeBg}
          tooltip="Open help for this page (F1)"
        />
      </RibbonSection>
    </>
  )

  // ── Ground / Planning ──
  if (segment === 'ground' && groundTab === 'planning') {
    return (
      <Bar>
        <RibbonSection label="Pairings">
          <RibbonBtn
            icon={RefreshCw}
            label="Fetch"
            onClick={props.onFetch}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Re-derive trips from pairings"
          />
          <RibbonBtn
            icon={Layers}
            label="Batch"
            onClick={props.onBatch}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Collapse near-time pickups into shared trips (hub mode)"
          />
          <RibbonBtn
            icon={Sparkles}
            label="Assign"
            onClick={props.onAutoAssign}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Auto-pick vendor + tier by capacity and priority"
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Status">
          <RibbonBtn
            icon={CheckCircle2}
            label="Status"
            onClick={props.onToggleStatusPanel}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="View">
          <RibbonBtn
            icon={Layers}
            label="Group"
            onClick={props.onCycleGroupBy}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
          <RibbonBtn
            icon={Rows3}
            label="Density"
            onClick={props.onCycleDensity}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
          <RibbonBtn
            icon={RotateCw}
            label={pollingPaused ? 'Resume' : 'Refresh'}
            active={!pollingPaused}
            onClick={() => setPollingPaused(!pollingPaused)}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Export">
          <RibbonBtn
            icon={Download}
            label="Export"
            onClick={props.onExport}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        {helpSection}
      </Bar>
    )
  }

  // ── Ground / Day-to-Day ──
  if (segment === 'ground' && groundTab === 'dayToDay') {
    return (
      <Bar>
        <RibbonSection label="Sync">
          <RibbonBtn
            icon={RefreshCw}
            label="Fetch"
            onClick={props.onFetch}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
          <RibbonBtn
            icon={RotateCw}
            label={pollingPaused ? 'Resume' : 'Refresh'}
            active={!pollingPaused}
            onClick={() => setPollingPaused(!pollingPaused)}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Operations">
          <RibbonBtn
            icon={AlertTriangle}
            label="Disruption"
            onClick={props.onDisruption}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Auto-retime trips affected by flight delays"
          />
          <RibbonBtn
            icon={MapPin}
            label="Track"
            onClick={props.onTrack}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Driver ETA + in-progress map"
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Lifecycle">
          <RibbonBtn
            icon={Send}
            label="Dispatch"
            onClick={props.onDispatch}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Mark dispatched (driver en route)"
          />
          <RibbonBtn
            icon={LogIn}
            label="Picked up"
            onClick={props.onPickedUp}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
          <RibbonBtn
            icon={CheckSquare}
            label="Done"
            onClick={props.onCompleted}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Mark trip completed"
          />
          <RibbonBtn
            icon={X}
            label="No-show"
            onClick={props.onNoShow}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Status">
          <RibbonBtn
            icon={CheckCircle2}
            label="Status"
            onClick={props.onToggleStatusPanel}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Export">
          <RibbonBtn
            icon={Download}
            label="Export"
            onClick={props.onExport}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        {helpSection}
      </Bar>
    )
  }

  // ── Ground / Communication ──
  if (segment === 'ground' && groundTab === 'communication') {
    return (
      <Bar>
        <RibbonSection label="Mail">
          <RibbonBtn
            icon={Inbox}
            label="Incoming"
            onClick={props.onOpenIncoming}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
          <RibbonBtn
            icon={Send}
            label="Outgoing"
            onClick={props.onOpenOutgoing}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Compose">
          <RibbonBtn
            icon={Pause}
            label="Hold"
            onClick={props.onComposeHeld}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="New dispatch sheet, save as held"
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Bulk">
          <RibbonBtn
            icon={Send}
            label="Release"
            onClick={props.onReleaseSelected}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
          <RibbonBtn
            icon={X}
            label="Discard"
            onClick={props.onDiscardSelected}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        {helpSection}
      </Bar>
    )
  }

  // ── Flight (any tab) ──
  if (segment === 'flight') {
    return (
      <Bar>
        <RibbonSection label="Sync">
          <RibbonBtn
            icon={RefreshCw}
            label="Fetch"
            onClick={props.onFetch}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Re-scan pairings for new deadhead legs"
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Bookings">
          <RibbonBtn
            icon={PlusCircle}
            label="Book"
            onClick={props.onBookFlight}
            disabled={disabled || flightTab === 'history'}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Open booking drawer"
          />
          <RibbonBtn
            icon={ImagePlus}
            label="Replace"
            onClick={props.onReplaceTicket}
            disabled={disabled || flightTab !== 'booked'}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
            tooltip="Replace ticket attachment on selected booking"
          />
        </RibbonSection>
        <RibbonDivider isDark={isDark} />
        <RibbonSection label="Export">
          <RibbonBtn
            icon={Download}
            label="Export"
            onClick={props.onExport}
            disabled={disabled}
            isDark={isDark}
            hoverBg={hoverBg}
            activeBg={activeBg}
          />
        </RibbonSection>
        {helpSection}
      </Bar>
    )
  }

  return null
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-0 overflow-x-auto" style={{ minHeight: 120 }}>
      {children}
    </div>
  )
}
