'use client'

import { useTheme } from '@/components/theme-provider'
import { RibbonSection, RibbonBtn, RibbonDivider } from '@/components/ui/ribbon-primitives'
import {
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Layers,
  Rows3,
  RotateCw,
  Download,
  AlertTriangle,
  BedDouble,
  Inbox,
  Send,
  Pause,
  X,
  HelpCircle,
} from 'lucide-react'
import { useHotacStore } from '@/stores/use-hotac-store'
import { useHelp } from '@/components/help'

interface HotacRibbonToolbarProps {
  onFetch: () => void
  onEnlist: () => void
  onToggleStatusPanel: () => void
  onCycleGroupBy: () => void
  onCycleDensity: () => void
  onExport: () => void
  onOpenDisruptions: () => void
  onOpenCheckIn: () => void
  onOpenIncoming: () => void
  onOpenOutgoing: () => void
  onComposeHeld: () => void
  onReleaseSelected: () => void
  onDiscardSelected: () => void
}

export function HotacRibbonToolbar(props: HotacRibbonToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(91,141,239,0.15)' : 'rgba(30,64,175,0.10)'

  const activeTab = useHotacStore((s) => s.activeTab)
  const pollingPaused = useHotacStore((s) => s.pollingPaused)
  const setPollingPaused = useHotacStore((s) => s.setPollingPaused)
  const periodCommitted = useHotacStore((s) => s.periodCommitted)
  const disabled = !periodCommitted
  const { openHelp } = useHelp()

  return (
    <div className="flex items-stretch gap-0 overflow-x-auto" style={{ minHeight: 120 }}>
      {activeTab === 'planning' && (
        <>
          <RibbonSection label="Pairings">
            <RibbonBtn
              icon={RefreshCw}
              label="Fetch"
              onClick={props.onFetch}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Re-fetch pairings + crew assignments"
            />
            <RibbonBtn
              icon={Sparkles}
              label="Enlist"
              onClick={props.onEnlist}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Smart-allocate rooms per layover"
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
              tooltip="Toggle booking status panel"
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
              tooltip="Cycle grouping (Station / Hotel / Date)"
            />
            <RibbonBtn
              icon={Rows3}
              label="Density"
              onClick={props.onCycleDensity}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Toggle compact / comfortable rows"
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
              tooltip={pollingPaused ? 'Resume polling' : 'Pause polling'}
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
              tooltip="Export demand table as CSV"
            />
          </RibbonSection>
        </>
      )}

      {activeTab === 'dayToDay' && (
        <>
          <RibbonSection label="Sync">
            <RibbonBtn
              icon={RefreshCw}
              label="Fetch"
              onClick={props.onFetch}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Re-fetch latest data"
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
              tooltip={pollingPaused ? 'Resume polling' : 'Pause polling'}
            />
          </RibbonSection>
          <RibbonDivider isDark={isDark} />
          <RibbonSection label="Operations">
            <RibbonBtn
              icon={AlertTriangle}
              label="Disruption"
              onClick={props.onOpenDisruptions}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="IROPS panel — flights affecting hotel nights"
            />
            <RibbonBtn
              icon={BedDouble}
              label="Check-In"
              onClick={props.onOpenCheckIn}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Crew hotel check-in monitor"
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
        </>
      )}

      {activeTab === 'communication' && (
        <>
          <RibbonSection label="Mail">
            <RibbonBtn
              icon={Inbox}
              label="Incoming"
              onClick={props.onOpenIncoming}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Incoming messages from hotels"
            />
            <RibbonBtn
              icon={Send}
              label="Outgoing"
              onClick={props.onOpenOutgoing}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Outgoing messages to hotels"
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
              tooltip="Compose a held email — amend before send"
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
              tooltip="Release selected held emails"
            />
            <RibbonBtn
              icon={X}
              label="Discard"
              onClick={props.onDiscardSelected}
              disabled={disabled}
              isDark={isDark}
              hoverBg={hoverBg}
              activeBg={activeBg}
              tooltip="Discard selected held emails"
            />
          </RibbonSection>
        </>
      )}

      {/* ── Help — always rightmost, regardless of active tab ── */}
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
    </div>
  )
}
