'use client'

/**
 * 4.1.8.3 HOTAC Configurations — admin shell.
 *
 * Visual 1:1 mirror of 4.1.6.3 Scheduling Configurations:
 *   - MasterDetailLayout (320px sidebar + flex center)
 *   - Sidebar: header block + scrollable section buttons with 3px left-accent on active
 *   - Center: top bar (1px accent rule + icon + h1 + Reset/Save) → optional error → scroll body
 *   - Form primitives reused verbatim (FormRow, Toggle, NumberStepper, etc.)
 *   - hasDraft via JSON.stringify deep-equal; green-tick "Saved" affordance, 3s auto-clear
 *
 * Sections: Layover Rule | Room Allocation | Dispatch | Check-In | Email.
 * Persists to OperatorHotacConfig via /operator-hotac-config.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Loader2,
  Save,
  RotateCcw,
  BedDouble,
  Layers,
  Send,
  DoorOpen,
  Mail,
  Bus,
  type LucideIcon,
} from 'lucide-react'
import { api, type OperatorHotacConfig } from '@skyhub/api'
import { MODULE_THEMES } from '@skyhub/constants'
import { accentTint, colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { MasterDetailLayout } from '@/components/layout'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { collapseDock } from '@/lib/dock-store'
import { HelpBlock, FormRow, Toggle, NumberStepper } from '@/components/admin/_shared/form-primitives'
import { HelpButton } from '@/components/help'
import { configToDraft, DEFAULT_HOTAC_CONFIG_DRAFT, type HotacConfigDraft } from './hotac-config-defaults'
import { LayoverHero, RoomAllocationHero, DispatchHero, CheckInHero, TransportHero, EmailHero } from './section-heroes'

const MODULE_ACCENT = MODULE_THEMES.workforce.accent

type SectionKey = 'layover' | 'room-allocation' | 'dispatch' | 'check-in' | 'transport' | 'email'

interface SectionDef {
  key: SectionKey
  label: string
  desc: string
  icon: LucideIcon
}

const SECTIONS: SectionDef[] = [
  { key: 'layover', label: 'Layover Rule', desc: 'When a layover qualifies for a hotel', icon: BedDouble },
  { key: 'room-allocation', label: 'Room Allocation', desc: 'Occupancy + contract-cap behaviour', icon: Layers },
  { key: 'dispatch', label: 'Dispatch', desc: 'Auto-dispatch and SLA thresholds', icon: Send },
  { key: 'check-in', label: 'Check-In', desc: 'Auto check-in and no-show rules', icon: DoorOpen },
  { key: 'transport', label: 'Transport', desc: 'Hub vs door-to-door, buffers, flight mode', icon: Bus },
  { key: 'email', label: 'Email', desc: 'From address, signature, hold default', icon: Mail },
]

function draftToUpsert(operatorId: string, d: HotacConfigDraft) {
  return {
    operatorId,
    layoverRule: d.layoverRule,
    roomAllocation: d.roomAllocation,
    dispatch: d.dispatch,
    checkIn: d.checkIn,
    transport: d.transport,
    email: d.email,
  }
}

export function HotacConfigShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const accent = MODULE_ACCENT

  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])
  useEffect(() => {
    collapseDock()
  }, [])

  const [config, setConfig] = useState<OperatorHotacConfig | null>(null)
  const [draft, setDraft] = useState<HotacConfigDraft>(DEFAULT_HOTAC_CONFIG_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('layover')

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getOperatorHotacConfig(operator._id)
      .then((doc) => {
        if (!alive) return
        setConfig(doc)
        setDraft(configToDraft(doc))
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load config'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [operator?._id])

  const hasDraft = useMemo(() => JSON.stringify(draft) !== JSON.stringify(configToDraft(config)), [draft, config])

  const handleSave = useCallback(async () => {
    if (!operator?._id || !hasDraft) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await api.upsertOperatorHotacConfig(draftToUpsert(operator._id, draft))
      setConfig(updated)
      setDraft(configToDraft(updated))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [operator?._id, hasDraft, draft])

  const handleReset = useCallback((section: SectionKey) => {
    setDraft((prev) => {
      switch (section) {
        case 'layover':
          return { ...prev, layoverRule: { ...DEFAULT_HOTAC_CONFIG_DRAFT.layoverRule } }
        case 'room-allocation':
          return { ...prev, roomAllocation: { ...DEFAULT_HOTAC_CONFIG_DRAFT.roomAllocation } }
        case 'dispatch':
          return { ...prev, dispatch: { ...DEFAULT_HOTAC_CONFIG_DRAFT.dispatch } }
        case 'check-in':
          return { ...prev, checkIn: { ...DEFAULT_HOTAC_CONFIG_DRAFT.checkIn } }
        case 'transport':
          return { ...prev, transport: { ...DEFAULT_HOTAC_CONFIG_DRAFT.transport } }
        case 'email':
          return { ...prev, email: { ...DEFAULT_HOTAC_CONFIG_DRAFT.email } }
      }
    })
  }, [])

  if (!operator?._id) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[14px] text-hz-text-secondary">Loading operator…</span>
      </div>
    )
  }

  return (
    <MasterDetailLayout
      left={
        <Sidebar
          sections={SECTIONS}
          activeSection={activeSection}
          onSelect={setActiveSection}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
      }
      center={
        <Center
          activeSection={activeSection}
          draft={draft}
          setDraft={setDraft}
          onSave={handleSave}
          onResetSection={handleReset}
          saving={saving}
          saved={saved}
          hasDraft={hasDraft}
          error={error}
          setError={setError}
          loading={loading}
          isDark={isDark}
          accent={accent}
          palette={palette}
        />
      }
    />
  )
}

function Sidebar({
  sections,
  activeSection,
  onSelect,
  palette,
  isDark,
  accent,
}: {
  sections: SectionDef[]
  activeSection: SectionKey
  onSelect: (k: SectionKey) => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-hz-border shrink-0">
        <h2 className="text-[15px] font-bold text-hz-text">HOTAC Configurations</h2>
        <p className="text-[13px] text-hz-text-secondary mt-0.5">
          Operator policy for crew accommodation, transport, and dispatch
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {sections.map((s) => {
            const Icon = s.icon
            const active = activeSection === s.key
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect(s.key)}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 ${active ? 'border-l-[3px] bg-module-accent/8' : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'}`}
                style={active ? { borderLeftColor: accent } : undefined}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: active
                      ? accentTint(accent, isDark ? 0.18 : 0.1)
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <Icon size={16} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium" style={active ? { color: accent } : undefined}>
                    {s.label}
                  </div>
                  <div className="text-[13px] text-hz-text-secondary truncate">{s.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Center({
  activeSection,
  draft,
  setDraft,
  onSave,
  onResetSection,
  saving,
  saved,
  hasDraft,
  error,
  setError,
  loading,
  isDark,
  accent,
  palette,
}: {
  activeSection: SectionKey
  draft: HotacConfigDraft
  setDraft: React.Dispatch<React.SetStateAction<HotacConfigDraft>>
  onSave: () => void
  onResetSection: (s: SectionKey) => void
  saving: boolean
  saved: boolean
  hasDraft: boolean
  error: string | null
  setError: (e: string | null) => void
  loading: boolean
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const section = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0]!
  const Icon = section.icon
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-hz-border shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1 h-6 rounded-full shrink-0" style={{ background: accent }} />
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: accentTint(accent, isDark ? 0.15 : 0.08) }}
          >
            <Icon size={18} color={accent} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold text-hz-text leading-tight">{section.label}</h1>
            <p className="text-[13px] text-hz-text-secondary mt-0.5">{section.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <HelpButton size="sm" />
          <button
            type="button"
            onClick={() => onResetSection(section.key)}
            className="h-9 px-3 rounded-lg text-[13px] font-medium text-hz-text-tertiary hover:opacity-80 flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !hasDraft}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: saved ? '#16a34a' : accent }}
          >
            {saved ? <Check size={14} strokeWidth={2.5} /> : <Save size={14} strokeWidth={1.8} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
      {error && (
        <div
          className="mx-6 mt-3 px-4 py-2.5 rounded-xl border flex items-center justify-between"
          style={{
            borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fecaca',
            backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2',
            color: '#EF4444',
          }}
        >
          <span className="text-[13px]">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[13px] text-hz-text-tertiary">
            Dismiss
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-hz-text-secondary" />
          </div>
        ) : (
          <>
            <SectionHero section={activeSection} accent={accent} isDark={isDark} />
            <SectionBody
              section={activeSection}
              draft={draft}
              setDraft={setDraft}
              isDark={isDark}
              accent={accent}
              palette={palette}
            />
          </>
        )}
      </div>
    </div>
  )
}

function SectionHero({ section, accent, isDark }: { section: SectionKey; accent: string; isDark: boolean }) {
  switch (section) {
    case 'layover':
      return <LayoverHero accent={accent} isDark={isDark} />
    case 'room-allocation':
      return <RoomAllocationHero accent={accent} isDark={isDark} />
    case 'dispatch':
      return <DispatchHero accent={accent} isDark={isDark} />
    case 'check-in':
      return <CheckInHero accent={accent} isDark={isDark} />
    case 'transport':
      return <TransportHero accent={accent} isDark={isDark} />
    case 'email':
      return <EmailHero accent={accent} isDark={isDark} />
  }
}

function SectionBody({
  section,
  draft,
  setDraft,
  isDark,
  accent,
  palette,
}: {
  section: SectionKey
  draft: HotacConfigDraft
  setDraft: React.Dispatch<React.SetStateAction<HotacConfigDraft>>
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const patchLayover = (p: Partial<HotacConfigDraft['layoverRule']>) =>
    setDraft((prev) => ({ ...prev, layoverRule: { ...prev.layoverRule, ...p } }))
  const patchRoom = (p: Partial<HotacConfigDraft['roomAllocation']>) =>
    setDraft((prev) => ({ ...prev, roomAllocation: { ...prev.roomAllocation, ...p } }))
  const patchDispatch = (p: Partial<HotacConfigDraft['dispatch']>) =>
    setDraft((prev) => ({ ...prev, dispatch: { ...prev.dispatch, ...p } }))
  const patchCheckIn = (p: Partial<HotacConfigDraft['checkIn']>) =>
    setDraft((prev) => ({ ...prev, checkIn: { ...prev.checkIn, ...p } }))
  const patchTransport = (p: Partial<HotacConfigDraft['transport']>) =>
    setDraft((prev) => ({ ...prev, transport: { ...prev.transport, ...p } }))
  const patchEmail = (p: Partial<HotacConfigDraft['email']>) =>
    setDraft((prev) => ({ ...prev, email: { ...prev.email, ...p } }))

  switch (section) {
    case 'layover':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            A pairing leg's release is treated as a layover when block-to-block rest is at least the configured minimum.
            Hotels are matched only when the layover ICAO has at least one priority-ranked CrewHotel under an active
            contract.
          </HelpBlock>
          <FormRow
            label="Min Layover Hours"
            description="Block-to-block rest from inbound STA to outbound STD. Default 6h aligns with typical short-haul night-stop policy."
          >
            <NumberStepper
              value={draft.layoverRule.layoverMinHours}
              onChange={(v) => patchLayover({ layoverMinHours: v })}
              min={1}
              max={24}
              suffix="h"
            />
          </FormRow>
          <FormRow
            label="Exclude Home Base"
            description="Layovers ending at the crew's home base are skipped (no hotel needed). Toggle off if you want to plan hotels for home-base layovers too."
          >
            <Toggle
              checked={draft.layoverRule.excludeHomeBase}
              onChange={(v) => patchLayover({ excludeHomeBase: v })}
              accent={accent}
            />
          </FormRow>
          <FormRow
            label="Min Span Across Local Midnight"
            description="Optional gate. When > 0, only layovers that also span this many hours across local midnight qualify. 0 = disabled."
          >
            <NumberStepper
              value={draft.layoverRule.minSpanMidnightHours}
              onChange={(v) => patchLayover({ minSpanMidnightHours: v })}
              min={0}
              max={12}
              suffix="h"
            />
          </FormRow>
        </div>
      )

    case 'room-allocation':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            How rooms are counted when Enlist runs. Default occupancy applies to every position unless the position is
            in the double-occupancy list. Contract-cap behaviour decides what happens when crew count exceeds the active
            contract's per-night room cap.
          </HelpBlock>
          <FormRow label="Default Occupancy" description="Single = one room per crew. Double = two crew share.">
            <SegButtons
              value={draft.roomAllocation.defaultOccupancy}
              onChange={(v) => patchRoom({ defaultOccupancy: v as 'single' | 'double' })}
              options={[
                { key: 'single', label: 'Single' },
                { key: 'double', label: 'Double' },
              ]}
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
          </FormRow>
          <FormRow
            label="Double-Occupancy Positions"
            description="Position codes (comma-separated) allowed to share a room when default is single. Empty = none."
            stacked
          >
            <CsvInput
              value={draft.roomAllocation.doubleOccupancyPositions}
              onChange={(v) => patchRoom({ doubleOccupancyPositions: v })}
              placeholder="CCM, CSM"
              accent={accent}
            />
          </FormRow>
          <FormRow
            label="Contract Cap Behaviour"
            description="When demand exceeds the active contract's per-night cap. Reject = HOTAC manually finds another hotel; Supplement = book the extras at the contract's supplement rate."
          >
            <SegButtons
              value={draft.roomAllocation.contractCapBehaviour}
              onChange={(v) => patchRoom({ contractCapBehaviour: v as 'reject' | 'supplement' })}
              options={[
                { key: 'reject', label: 'Reject' },
                { key: 'supplement', label: 'Supplement' },
              ]}
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
          </FormRow>
        </div>
      )

    case 'dispatch':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            Auto-Dispatch can run unattended at a fixed local time each day, sweeping pending bookings and emailing
            rooming lists to hotels. Send-Before defines the lead window; Confirmation SLA flags emails that haven't
            received a reply.
          </HelpBlock>
          <FormRow
            label="Auto-Dispatch Enabled"
            description="When enabled, the daily run pushes all pending bookings to their hotels at the configured time."
          >
            <Toggle
              checked={draft.dispatch.autoDispatchEnabled}
              onChange={(v) => patchDispatch({ autoDispatchEnabled: v })}
              accent={accent}
            />
          </FormRow>
          <FormRow
            label="Auto-Dispatch Time"
            description="Local 24h time (HH:MM). Leave blank for manual-only dispatch."
            indent={!draft.dispatch.autoDispatchEnabled}
          >
            <input
              type="time"
              value={draft.dispatch.autoDispatchTime ?? ''}
              onChange={(e) => patchDispatch({ autoDispatchTime: e.target.value === '' ? null : e.target.value })}
              disabled={!draft.dispatch.autoDispatchEnabled}
              className="h-10 w-32 px-3 rounded-lg text-[13px] font-mono text-hz-text bg-transparent disabled:opacity-40"
              style={{ border: '1px solid var(--color-hz-border)' }}
            />
          </FormRow>
          <FormRow
            label="Send Before Hours"
            description="Lead window. Bookings whose check-in is within this window become eligible for the next dispatch run."
          >
            <NumberStepper
              value={draft.dispatch.sendBeforeHours}
              onChange={(v) => patchDispatch({ sendBeforeHours: v })}
              min={0}
              max={96}
              suffix="h"
            />
          </FormRow>
          <FormRow
            label="Confirmation SLA"
            description="A sent email with no hotel reply within this window is flagged overdue-confirmation in Day to Day."
          >
            <NumberStepper
              value={draft.dispatch.confirmationSlaHours}
              onChange={(v) => patchDispatch({ confirmationSlaHours: v })}
              min={1}
              max={24}
              suffix="h"
            />
          </FormRow>
        </div>
      )

    case 'check-in':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            HOTAC tracks crew check-in events from three sources: the future Crew app, hotels (via reply or webhook),
            and HOTAC operators marking manually. These two settings decide when the system advances a booking's status
            without a human action.
          </HelpBlock>
          <FormRow
            label="Auto Check-In on Arrival Delay"
            description="If no check-in event arrives within this many minutes after the inbound STA, the booking is auto-marked checked-in. 0 = disabled (HOTAC must mark manually)."
          >
            <NumberStepper
              value={draft.checkIn.autoCheckInOnArrivalDelayMinutes}
              onChange={(v) => patchCheckIn({ autoCheckInOnArrivalDelayMinutes: v })}
              min={0}
              max={240}
              step={15}
              suffix="min"
            />
          </FormRow>
          <FormRow
            label="No-Show After"
            description="Bookings still uncheckedin this many hours after STA flip to no-show, raising an exception."
          >
            <NumberStepper
              value={draft.checkIn.noShowAfterHours}
              onChange={(v) => patchCheckIn({ noShowAfterHours: v })}
              min={1}
              max={24}
              suffix="h"
            />
          </FormRow>
        </div>
      )

    case 'transport':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            Drives 4.1.8.2 Crew Transport. Pickup mode chooses between a single hub-shuttle per duty-start and per-crew
            door-to-door pickups (batched within the window). Buffer minutes pad both sides of report/release. Vehicle
            tier and SLA become defaults on auto-assign.
          </HelpBlock>
          <FormRow
            label="Pickup Mode"
            description="Hub shuttle = one consolidated trip from a hub location to the airport. Door-to-door = one trip per crew home address, batched."
          >
            <SegButtons
              value={draft.transport.pickupMode}
              onChange={(v) => patchTransport({ pickupMode: v as 'door-to-door' | 'hub-shuttle' })}
              options={[
                { key: 'hub-shuttle', label: 'Hub shuttle' },
                { key: 'door-to-door', label: 'Door-to-door' },
              ]}
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
          </FormRow>
          {draft.transport.pickupMode === 'hub-shuttle' && (
            <>
              <FormRow label="Hub Name" description="Shown on dispatch sheets and the trip inspector.">
                <TextInputBasic
                  value={draft.transport.hubLocation?.name ?? ''}
                  onChange={(v) =>
                    patchTransport({
                      hubLocation: {
                        ...(draft.transport.hubLocation ?? { addressLine: null, lat: null, lng: null }),
                        name: v,
                      },
                    })
                  }
                  placeholder="Crew Hub"
                />
              </FormRow>
              <FormRow label="Hub Address" description="Pickup address printed on dispatch sheets." stacked>
                <TextInputBasic
                  value={draft.transport.hubLocation?.addressLine ?? ''}
                  onChange={(v) =>
                    patchTransport({
                      hubLocation: {
                        ...(draft.transport.hubLocation ?? { name: 'Crew Hub', lat: null, lng: null }),
                        addressLine: v === '' ? null : v,
                      },
                    })
                  }
                  placeholder="123 Le Loi, District 1, HCMC"
                />
              </FormRow>
            </>
          )}
          <FormRow
            label="Buffer Minutes"
            description="Padding on both sides of report/release. Outbound trip leaves report − buffer − travel; inbound trip arrives release + buffer."
          >
            <NumberStepper
              value={draft.transport.bufferMinutes}
              onChange={(v) => patchTransport({ bufferMinutes: v })}
              min={0}
              max={120}
              step={5}
              suffix="min"
            />
          </FormRow>
          <FormRow
            label="Batching Window"
            description="Door-to-door only. Crew within this many minutes of each other share a vehicle."
            indent={draft.transport.pickupMode !== 'door-to-door'}
          >
            <NumberStepper
              value={draft.transport.batchingWindowMinutes}
              onChange={(v) => patchTransport({ batchingWindowMinutes: v })}
              min={0}
              max={120}
              step={5}
              suffix="min"
            />
          </FormRow>
          <FormRow
            label="Default Travel Time"
            description="Used when a crew profile has no travelTimeMinutes set. Fallback only — per-crew values always win."
          >
            <NumberStepper
              value={draft.transport.defaultTravelTimeMinutes}
              onChange={(v) => patchTransport({ defaultTravelTimeMinutes: v })}
              min={0}
              max={240}
              step={5}
              suffix="min"
            />
          </FormRow>
          <FormRow
            label="Default Vendor SLA"
            description="A trip in 'sent' status this many minutes without confirmation flips to overdue-confirmation."
          >
            <NumberStepper
              value={draft.transport.defaultVendorSlaMinutes}
              onChange={(v) => patchTransport({ defaultVendorSlaMinutes: v })}
              min={5}
              max={60}
              step={5}
              suffix="min"
            />
          </FormRow>
          <FormRow
            label="Taxi Voucher Enabled"
            description="Allow ad-hoc taxi-voucher trips when no contracted vendor is available."
          >
            <Toggle
              checked={draft.transport.taxiVoucherEnabled}
              onChange={(v) => patchTransport({ taxiVoucherEnabled: v })}
              accent={accent}
            />
          </FormRow>
          <FormRow
            label="Flight Booking Mode"
            description="Default for deadhead positioning. Ticket = revenue/non-rev ticket on a real flight; GENDEC = supernumerary placement on the operator's own flight."
          >
            <SegButtons
              value={draft.transport.flightBookingMode}
              onChange={(v) => patchTransport({ flightBookingMode: v as 'ticket-preferred' | 'gendec-preferred' })}
              options={[
                { key: 'ticket-preferred', label: 'Ticket preferred' },
                { key: 'gendec-preferred', label: 'GENDEC preferred' },
              ]}
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
          </FormRow>
        </div>
      )

    case 'email':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            SMTP transport for hotel correspondence. The signature is appended to outbound bodies. When Hold by Default
            is on, new outbound emails start as held — they require a deliberate Release before they leave SkyHub.
          </HelpBlock>
          <FormRow
            label="From Address"
            description="The Reply-To and message envelope sender for outbound rooming lists."
          >
            <TextInputBasic
              value={draft.email.fromAddress}
              onChange={(v) => patchEmail({ fromAddress: v })}
              placeholder="hotac@operator.com"
            />
          </FormRow>
          <FormRow label="Reply-To" description="Optional override if replies should go to a different address.">
            <TextInputBasic
              value={draft.email.replyTo ?? ''}
              onChange={(v) => patchEmail({ replyTo: v === '' ? null : v })}
              placeholder="(same as From)"
            />
          </FormRow>
          <FormRow label="Signature" description="Appended to every outbound email. Plain text." stacked>
            <textarea
              value={draft.email.signature}
              onChange={(e) => patchEmail({ signature: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-[13px] text-hz-text bg-transparent resize-y"
              style={{ border: '1px solid var(--color-hz-border)' }}
            />
          </FormRow>
          <FormRow
            label="Hold by Default"
            description="New outbound emails start as held until explicitly released. Off = emails go straight to the SMTP queue."
          >
            <Toggle
              checked={draft.email.holdByDefault}
              onChange={(v) => patchEmail({ holdByDefault: v })}
              accent={accent}
            />
          </FormRow>
        </div>
      )
  }
}

function SegButtons<T extends string>({
  value,
  onChange,
  options,
  accent,
  palette,
  isDark,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ key: T; label: string }>
  accent: string
  palette: PaletteType
  isDark: boolean
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}` }}
    >
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="px-4 h-9 text-[13px] font-medium transition-colors"
            style={{
              background: active ? accent : 'transparent',
              color: active ? '#fff' : palette.textSecondary,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function CsvInput({
  value,
  onChange,
  placeholder,
  accent,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  accent: string
}) {
  const [draft, setDraft] = useState(value.join(', '))
  useEffect(() => {
    setDraft(value.join(', '))
  }, [value])
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parts = draft
          .split(/[,\s]+/)
          .map((p) => p.trim().toUpperCase())
          .filter((p) => p.length > 0 && p.length <= 10)
        onChange(parts)
        setDraft(parts.join(', '))
      }}
      placeholder={placeholder}
      className="w-full h-10 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
      style={{ border: `1px solid var(--color-hz-border)`, outlineColor: accent }}
    />
  )
}

function TextInputBasic({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-72 px-3 rounded-lg text-[13px] text-hz-text bg-transparent"
      style={{ border: '1px solid var(--color-hz-border)' }}
    />
  )
}
