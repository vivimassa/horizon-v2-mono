'use client'

/**
 * 7.1.5.2 ACARS/MVT/LDM Transmission — admin shell.
 *
 * Mirrors 2.1.3.3 Disruption Customization: MasterDetailLayout with a
 * sectioned sidebar + center panel (hero banner + section body).
 * Persists to `OperatorMessagingConfig` via /operator-messaging-config.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  EyeOff,
  GitMerge,
  Key,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import {
  api,
  type MessageActionCode,
  type OperatorMessagingConfig,
  type OperatorMessagingConfigUpsert,
} from '@skyhub/api'
import { MODULE_THEMES } from '@skyhub/constants'
import { accentTint, colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { MasterDetailLayout } from '@/components/layout'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { collapseDock } from '@/lib/dock-store'
import {
  HelpBlock,
  FormRow,
  SectionCard,
  Toggle,
  RangeStepper,
  NumberStepper,
} from '@/components/admin/_shared/form-primitives'

/** System Administration module accent (MODULE_THEMES.sysadmin.accent).
 *  Warm amber — legible against dark mode; the tenant operator accent
 *  (often cool blue) is not used here because 7.1.5.2 lives under
 *  System Administration, not under the operator's own branding scope. */
const ADMIN_ACCENT = MODULE_THEMES.sysadmin.accent
import { SchedulerHero, ValidationHero, OverwriteHero, InboundAccessHero } from './section-heroes'

type SectionKey = 'scheduler' | 'validation' | 'overwrite' | 'inbound'

interface SectionDef {
  key: SectionKey
  label: string
  desc: string
  icon: LucideIcon
}

const SECTIONS: SectionDef[] = [
  { key: 'scheduler', label: 'Auto-Transmit Scheduler', desc: 'Outbound release cadence', icon: Clock },
  { key: 'validation', label: 'Inbound Validation', desc: 'Quality gates before ingestion', icon: Shield },
  { key: 'overwrite', label: 'Source Priority', desc: 'Which source wins a collision', icon: GitMerge },
  { key: 'inbound', label: 'Inbound Access', desc: 'External webhook token', icon: Key },
]

const ACTION_CATALOG: Array<{ key: MessageActionCode; label: string }> = [
  { key: 'AD', label: 'AD — Actual Departure' },
  { key: 'AA', label: 'AA — Actual Arrival' },
  { key: 'ED', label: 'ED — Estimated Departure' },
  { key: 'EA', label: 'EA — Estimated Arrival' },
  { key: 'NI', label: 'NI — Next Information' },
  { key: 'RR', label: 'RR — Return to Ramp' },
  { key: 'FR', label: 'FR — Forced Return' },
]

/* ── Draft state & defaults ─────────────────────────────────────── */

interface Draft {
  autoTransmit: {
    enabled: boolean
    intervalMin: number
    ageGateMin: number
    actionAllow: MessageActionCode[]
    respectFilter: boolean
  }
  validation: {
    rejectFutureTs: boolean
    futureTsToleranceMin: number
    rejectExcessiveDelay: boolean
    delayThresholdHours: number
    enforceSequence: boolean
    touchAndGoGuardSec: number
    blockTimeDiscrepancyPct: number
    matchByReg: boolean
  }
  overwrite: {
    acarsOverwriteManual: boolean
    acarsOverwriteMvt: boolean
    mvtOverwriteManual: boolean
  }
}

const DEFAULT_DRAFT: Draft = {
  autoTransmit: {
    enabled: false,
    intervalMin: 5,
    ageGateMin: 1,
    actionAllow: ['AD', 'AA'],
    respectFilter: true,
  },
  validation: {
    rejectFutureTs: true,
    futureTsToleranceMin: 5,
    rejectExcessiveDelay: true,
    delayThresholdHours: 8,
    enforceSequence: true,
    touchAndGoGuardSec: 120,
    blockTimeDiscrepancyPct: 30,
    matchByReg: false,
  },
  overwrite: {
    acarsOverwriteManual: false,
    acarsOverwriteMvt: false,
    mvtOverwriteManual: true,
  },
}

function configToDraft(cfg: OperatorMessagingConfig | null): Draft {
  if (!cfg) return DEFAULT_DRAFT
  return {
    autoTransmit: { ...DEFAULT_DRAFT.autoTransmit, ...(cfg.autoTransmit ?? {}) },
    validation: { ...DEFAULT_DRAFT.validation, ...(cfg.validation ?? {}) },
    overwrite: { ...DEFAULT_DRAFT.overwrite, ...(cfg.overwrite ?? {}) },
  }
}

function draftToUpsert(operatorId: string, d: Draft): OperatorMessagingConfigUpsert {
  return { operatorId, autoTransmit: d.autoTransmit, validation: d.validation, overwrite: d.overwrite }
}

/* ── Shell ──────────────────────────────────────────────────────── */

export function TransmissionConfigShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const accent = ADMIN_ACCENT

  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])

  useEffect(() => {
    collapseDock()
  }, [])

  const [config, setConfig] = useState<OperatorMessagingConfig | null>(null)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('scheduler')

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getOperatorMessagingConfig(operator._id)
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
      const updated = await api.upsertOperatorMessagingConfig(draftToUpsert(operator._id, draft))
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

  const handleResetSection = useCallback((section: SectionKey) => {
    setDraft((prev) => {
      const next = { ...prev }
      if (section === 'scheduler') next.autoTransmit = { ...DEFAULT_DRAFT.autoTransmit }
      if (section === 'validation') next.validation = { ...DEFAULT_DRAFT.validation }
      if (section === 'overwrite') next.overwrite = { ...DEFAULT_DRAFT.overwrite }
      // 'inbound' section has no draft state — token is a separate operator-level API
      return next
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
          onResetSection={handleResetSection}
          saving={saving}
          saved={saved}
          hasDraft={hasDraft}
          error={error}
          setError={setError}
          loading={loading}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
      }
    />
  )
}

/* ── Sidebar ────────────────────────────────────────────────────── */

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
  onSelect: (key: SectionKey) => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header — title stack */}
      <div className="px-4 py-3 border-b border-hz-border shrink-0">
        <h2 className="text-[15px] font-bold text-hz-text">Transmission</h2>
        <p className="text-[13px] text-hz-text-secondary mt-0.5">ACARS / MVT / LDM configuration</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon
            const active = activeSection === section.key
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onSelect(section.key)}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 ${
                  active
                    ? 'border-l-[3px] bg-module-accent/[0.08]'
                    : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                }`}
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
                    {section.label}
                  </div>
                  <div className="text-[13px] text-hz-text-secondary truncate">{section.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Center ─────────────────────────────────────────────────────── */

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
  palette,
  isDark,
  accent,
}: {
  activeSection: SectionKey
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  onSave: () => void
  onResetSection: (s: SectionKey) => void
  saving: boolean
  saved: boolean
  hasDraft: boolean
  error: string | null
  setError: (e: string | null) => void
  loading: boolean
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const section = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0]
  const Icon = section.icon

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
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
          {activeSection !== 'inbound' && (
            <button
              type="button"
              onClick={() => onResetSection(section.key)}
              className="h-9 px-3 rounded-lg text-[13px] font-medium text-hz-text-tertiary hover:opacity-80 flex items-center gap-1.5"
            >
              <RotateCcw size={13} /> Reset section
            </button>
          )}
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

      {/* Error */}
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

      {/* Body */}
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
              palette={palette}
              isDark={isDark}
              accent={accent}
            />
          </>
        )}
      </div>
    </div>
  )
}

function SectionHero({ section, accent, isDark }: { section: SectionKey; accent: string; isDark: boolean }) {
  switch (section) {
    case 'scheduler':
      return <SchedulerHero accent={accent} isDark={isDark} />
    case 'validation':
      return <ValidationHero accent={accent} isDark={isDark} />
    case 'overwrite':
      return <OverwriteHero accent={accent} isDark={isDark} />
    case 'inbound':
      return <InboundAccessHero accent={accent} isDark={isDark} />
  }
}

/* ── Section bodies ─────────────────────────────────────────────── */

function SectionBody({
  section,
  draft,
  setDraft,
  isDark,
  accent,
}: {
  section: SectionKey
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const patchAuto = (p: Partial<Draft['autoTransmit']>) =>
    setDraft((prev) => ({ ...prev, autoTransmit: { ...prev.autoTransmit, ...p } }))
  const patchValidation = (p: Partial<Draft['validation']>) =>
    setDraft((prev) => ({ ...prev, validation: { ...prev.validation, ...p } }))
  const patchOverwrite = (p: Partial<Draft['overwrite']>) =>
    setDraft((prev) => ({ ...prev, overwrite: { ...prev.overwrite, ...p } }))

  const toggleAction = (k: MessageActionCode) => {
    patchAuto({
      actionAllow: draft.autoTransmit.actionAllow.includes(k)
        ? draft.autoTransmit.actionAllow.filter((x) => x !== k)
        : [...draft.autoTransmit.actionAllow, k],
    })
  }

  switch (section) {
    case 'scheduler':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            Periodically sweeps Held MVT/LDM messages and transmits any whose action code is in the allowlist. Changes
            apply on the next scheduler tick (within 60 s).
          </HelpBlock>

          <FormRow label="Enabled" description="Arms the background scheduler for this operator.">
            <Toggle
              checked={draft.autoTransmit.enabled}
              onChange={(v) => patchAuto({ enabled: v })}
              accent={accent}
              danger
            />
          </FormRow>

          <FormRow label="Interval" description="Time between transmission sweeps (2–15 min).">
            <RangeStepper
              value={draft.autoTransmit.intervalMin}
              onChange={(v) => patchAuto({ intervalMin: v })}
              min={2}
              max={15}
              suffix="m"
              accent={accent}
            />
          </FormRow>

          <FormRow
            label="Review window"
            description="Messages must have been Held at least this long before the scheduler may transmit them."
          >
            <RangeStepper
              value={draft.autoTransmit.ageGateMin}
              onChange={(v) => patchAuto({ ageGateMin: v })}
              min={0}
              max={10}
              suffix="m"
              accent={accent}
            />
          </FormRow>

          <FormRow
            label="Action code allowlist"
            description="Only these codes may auto-transmit. Everything else stays Held for manual release."
            verticalAlign
          >
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-[360px]">
              {ACTION_CATALOG.map((a) => {
                const active = draft.autoTransmit.actionAllow.includes(a.key)
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggleAction(a.key)}
                    className="flex items-center gap-2 px-3 h-10 rounded-lg text-[13px] font-medium text-left transition-colors"
                    style={{
                      background: active
                        ? 'rgba(6,194,112,0.12)'
                        : isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(96,97,112,0.06)',
                      border: `1px solid ${active ? 'rgba(6,194,112,0.32)' : 'transparent'}`,
                    }}
                  >
                    {active ? (
                      <CheckCircle size={14} style={{ color: '#06C270' }} />
                    ) : (
                      <XCircle size={14} className="text-hz-text-secondary" />
                    )}
                    <span className="flex-1 text-hz-text">{a.label}</span>
                  </button>
                )
              })}
            </div>
          </FormRow>

          <FormRow
            label="Respect active filter"
            description="When ON, the scheduler only transmits messages matching the Communication Deck's current filter."
          >
            <Toggle
              checked={draft.autoTransmit.respectFilter}
              onChange={(v) => patchAuto({ respectFilter: v })}
              accent={accent}
            />
          </FormRow>
        </div>
      )

    case 'validation':
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* ─── Left: Input rejection rules ─── */}
          <SectionCard title="Input rejection rules" subtitle="Bounce malformed or impossible telex">
            <HelpBlock>
              Applied to every incoming MVT, LDM and ACARS message before it touches flight data. Failing rules mark the
              message <em>rejected</em> in the Incoming column.
            </HelpBlock>

            <FormRow
              label="Reject future-timestamped messages"
              description="Messages whose action timestamp is in the future (beyond the tolerance) are bounced as malformed."
            >
              <Toggle
                checked={draft.validation.rejectFutureTs}
                onChange={(v) => patchValidation({ rejectFutureTs: v })}
                accent={accent}
              />
            </FormRow>

            {draft.validation.rejectFutureTs && (
              <FormRow label="Future tolerance" indent description="Clock drift allowance.">
                <NumberStepper
                  value={draft.validation.futureTsToleranceMin}
                  onChange={(v) => patchValidation({ futureTsToleranceMin: v })}
                  min={0}
                  max={60}
                  suffix="min"
                />
              </FormRow>
            )}

            <FormRow
              label="Reject excessive delay"
              description="Reject messages whose ATD−STD or ATA−STA exceeds the threshold."
            >
              <Toggle
                checked={draft.validation.rejectExcessiveDelay}
                onChange={(v) => patchValidation({ rejectExcessiveDelay: v })}
                accent={accent}
              />
            </FormRow>

            {draft.validation.rejectExcessiveDelay && (
              <FormRow label="Delay threshold" indent description="Beyond this, reject the message.">
                <NumberStepper
                  value={draft.validation.delayThresholdHours}
                  onChange={(v) => patchValidation({ delayThresholdHours: v })}
                  min={1}
                  max={48}
                  suffix="h"
                />
              </FormRow>
            )}

            <FormRow
              label="Enforce event sequence"
              description="Reject AA before AD, IN before ON, etc. Prevents out-of-order ACARS from corrupting flight state."
            >
              <Toggle
                checked={draft.validation.enforceSequence}
                onChange={(v) => patchValidation({ enforceSequence: v })}
                accent={accent}
              />
            </FormRow>
          </SectionCard>

          {/* ─── Right: Matching & deduplication ─── */}
          <SectionCard title="Matching & deduplication" subtitle="How messages attach to flights and suppress echo">
            <HelpBlock>
              Guards against duplicate relays, wildly-off block times, and ambiguous flight matches. Applied after the
              rejection rules pass.
            </HelpBlock>

            <FormRow
              label="Touch-and-go guard"
              description="Ignore duplicate AD/AA updates within this window. Catches relay echo from multiple ACARS channels."
            >
              <NumberStepper
                value={draft.validation.touchAndGoGuardSec}
                onChange={(v) => patchValidation({ touchAndGoGuardSec: v })}
                min={0}
                max={600}
                suffix="sec"
                step={30}
              />
            </FormRow>

            <FormRow
              label="Block-time discrepancy"
              description="Reject if derived block time differs from scheduled by more than this percentage."
            >
              <NumberStepper
                value={draft.validation.blockTimeDiscrepancyPct}
                onChange={(v) => patchValidation({ blockTimeDiscrepancyPct: v })}
                min={5}
                max={100}
                suffix="%"
                step={5}
              />
            </FormRow>

            <FormRow
              label="Match by aircraft registration"
              description="When ON, incoming messages match flights by ARCID instead of flight designator + date."
            >
              <Toggle
                checked={draft.validation.matchByReg}
                onChange={(v) => patchValidation({ matchByReg: v })}
                accent={accent}
              />
            </FormRow>
          </SectionCard>
        </div>
      )

    case 'overwrite':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            Which source wins when multiple updates land on the same field. Manual edits (UI) always take precedence
            over automated sources by default.
          </HelpBlock>

          <FormRow
            label="ACARS may overwrite manual edits"
            description="When OFF, ACARS updates are ignored for fields already touched in the UI."
          >
            <Toggle
              checked={draft.overwrite.acarsOverwriteManual}
              onChange={(v) => patchOverwrite({ acarsOverwriteManual: v })}
              accent={accent}
            />
          </FormRow>

          <FormRow
            label="ACARS may overwrite MVT"
            description="When OFF, incoming MVT messages take precedence over ACARS OOOI updates."
          >
            <Toggle
              checked={draft.overwrite.acarsOverwriteMvt}
              onChange={(v) => patchOverwrite({ acarsOverwriteMvt: v })}
              accent={accent}
            />
          </FormRow>

          <FormRow
            label="MVT may overwrite manual edits"
            description="When ON, a human-transmitted MVT may correct a previous manual entry."
          >
            <Toggle
              checked={draft.overwrite.mvtOverwriteManual}
              onChange={(v) => patchOverwrite({ mvtOverwriteManual: v })}
              accent={accent}
            />
          </FormRow>
        </div>
      )

    case 'inbound':
      return <InboundSection accent={accent} isDark={isDark} />
  }
}

/* ── Inbound token panel ────────────────────────────────────────── */

function InboundSection({ accent, isDark }: { accent: string; isDark: boolean }) {
  const [tokenInfo, setTokenInfo] = useState<{
    exists: boolean
    masked: string | null
    rotatedAt: string | null
  } | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    api
      .getInboundMessageToken()
      .then(setTokenInfo)
      .catch(() => setTokenInfo(null))
  }, [])

  const rotate = async () => {
    setRotating(true)
    try {
      const res = await api.rotateInboundMessageToken()
      setFreshToken(res.token)
      setTokenInfo({ exists: true, masked: res.masked, rotatedAt: res.rotatedAt })
      setReveal(true)
    } finally {
      setRotating(false)
      setConfirming(false)
    }
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const display = freshToken && reveal ? freshToken : (tokenInfo?.masked ?? 'Not yet generated')

  const inputBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(96,97,112,0.08)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const curl = `curl -X POST ${typeof window !== 'undefined' ? window.location.origin.replace(/:\\d+$/, ':3002') : 'http://host'}/movement-messages/inbound \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"rawMessage":"MVT\\nHZ111/15.HAN\\nAA0305/0320"}'`

  return (
    <div className="max-w-2xl space-y-6">
      <HelpBlock>
        Bearer token used by external systems to POST raw MVT/LDM/ACARS telex into SkyHub. Rotate if the token leaks —
        the previous value stops working immediately.
      </HelpBlock>

      <div>
        <div className="text-[13px] font-medium text-hz-text-secondary mb-1.5">Inbound token</div>
        <div className="flex items-center gap-2">
          <div
            className="h-10 px-3 rounded-lg text-[13px] font-mono flex items-center flex-1"
            style={{
              background: inputBg,
              border: `1px solid ${inputBorder}`,
              color: tokenInfo?.exists ? undefined : 'var(--color-hz-text-secondary)',
            }}
          >
            {display}
          </div>
          {freshToken && (
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="h-10 w-10 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
              title={reveal ? 'Hide token' : 'Reveal new token'}
              style={{ border: `1px solid ${inputBorder}` }}
            >
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          {freshToken && reveal && (
            <button
              type="button"
              onClick={() => copy(freshToken)}
              className="h-10 px-3 rounded-lg text-[13px] font-medium flex items-center gap-2 hover:bg-hz-border/30 transition-colors"
              style={{ border: `1px solid ${inputBorder}` }}
            >
              {copied ? <Check size={14} style={{ color: '#06C270' }} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        <div className="text-[13px] text-hz-text-secondary mt-1.5">
          {tokenInfo?.rotatedAt
            ? `Last rotated ${new Date(tokenInfo.rotatedAt).toLocaleString()}.`
            : 'No token generated yet. Rotate to create one.'}
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium text-hz-text-secondary mb-1.5">Rotate token</div>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={rotating}
            className="h-10 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-colors"
            style={{
              background: 'rgba(230,53,53,0.10)',
              color: '#E63535',
              border: '1px solid rgba(230,53,53,0.28)',
            }}
          >
            <RefreshCw size={14} />
            {tokenInfo?.exists ? 'Rotate token' : 'Generate token'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-hz-text-secondary">Are you sure?</span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-10 px-3 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
              style={{ border: `1px solid ${inputBorder}` }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={rotate}
              disabled={rotating}
              className="h-10 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2"
              style={{ background: '#E63535', color: '#fff' }}
            >
              {rotating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Yes, rotate
            </button>
          </div>
        )}
        <div className="text-[13px] text-hz-text-secondary mt-1.5">
          Issues a fresh token and invalidates the previous one. The new token is shown once — copy it before leaving
          the page.
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium text-hz-text-secondary mb-1.5">Example — POST a raw telex</div>
        <pre
          className="text-[13px] font-mono whitespace-pre-wrap rounded-lg p-3 overflow-x-auto"
          style={{
            background: inputBg,
            border: `1px solid ${inputBorder}`,
            color: isDark ? '#C0C0D0' : '#1C1C28',
          }}
        >
          {curl}
        </pre>
      </div>
    </div>
  )
}

// Suppress unused imports warning — AlertTriangle reserved for future per-section error UI.
void AlertTriangle
