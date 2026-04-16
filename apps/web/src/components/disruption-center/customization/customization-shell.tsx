'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CheckCircle2,
  Hash,
  ListChecks,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Tag,
  Type,
  type LucideIcon,
} from 'lucide-react'
import {
  api,
  type DisruptionIssueRef,
  type FeedStatusFilter,
  type OperatorDisruptionConfig,
  type OperatorDisruptionConfigUpsert,
  type OperatorDisruptionResolutionType,
} from '@skyhub/api'
import { colors, accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'
import { MasterDetailLayout } from '@/components/layout'
import { Dropdown } from '@/components/ui/dropdown'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useDisruptionStore } from '@/stores/use-disruption-store'
import {
  CATEGORY_LABEL as DEFAULT_CATEGORY_LABEL,
  STATUS_LABEL as DEFAULT_STATUS_LABEL,
  SLA_MINUTES as DEFAULT_SLA_MINUTES,
  OPEN_BACKLOG_THRESHOLD as DEFAULT_OPEN_BACKLOG_THRESHOLD,
  DEFAULT_RESOLUTION_TYPES,
  DEFAULT_ROLLING_STOPS,
  OPS_ACCENT,
} from '@/components/disruption-center/severity-utils'
import {
  SlaHero,
  BacklogHero,
  RollingHero,
  FeedHero,
  CategoriesHero,
  StatusesHero,
  ResolutionsHero,
} from './section-heroes'

type Category = DisruptionIssueRef['category']
type Status = DisruptionIssueRef['status']

type SectionKey = 'sla' | 'backlog' | 'rolling' | 'feed' | 'categories' | 'statuses' | 'resolutions'

interface SectionDef {
  key: SectionKey
  label: string
  desc: string
  icon: LucideIcon
}

const SECTIONS: SectionDef[] = [
  { key: 'sla', label: 'SLA Targets', desc: 'Breach thresholds by severity', icon: AlertTriangle },
  { key: 'backlog', label: 'Backlog Threshold', desc: 'Red-glow cutoff', icon: Hash },
  { key: 'rolling', label: 'Rolling Period', desc: 'Slider stops for the filter', icon: CalendarRange },
  { key: 'feed', label: 'Default Feed Status', desc: 'Initial filter on page load', icon: ListChecks },
  { key: 'categories', label: 'Category Labels', desc: 'Rename the 9 categories', icon: Tag },
  { key: 'statuses', label: 'Status Labels', desc: 'Rename lifecycle states', icon: Type },
  { key: 'resolutions', label: 'Resolution Types', desc: 'Resolve dialog vocabulary', icon: CheckCircle2 },
]

const ROLLING_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

// Example alternative names shown as input placeholders so operators
// see a realistic suggestion of what they might rename each key to.
// These are not persisted anywhere — purely UI hints.
const CATEGORY_PLACEHOLDER_EXAMPLES: Record<Category, string> = {
  TAIL_SWAP: 'e.g. Aircraft rotation',
  DELAY: 'e.g. Late departure',
  CANCELLATION: 'e.g. Sector cancelled',
  DIVERSION: 'e.g. Reroute',
  CONFIG_CHANGE: 'e.g. Aircraft swap',
  MISSING_OOOI: 'e.g. OOOI gap',
  MAINTENANCE_RISK: 'e.g. MX risk',
  CURFEW_VIOLATION: 'e.g. Night curfew',
  TAT_VIOLATION: 'e.g. Turnaround breach',
}

const STATUS_PLACEHOLDER_EXAMPLES: Record<Status, string> = {
  open: 'e.g. New',
  assigned: 'e.g. Claimed',
  in_progress: 'e.g. Working',
  resolved: 'e.g. Done',
  closed: 'e.g. Archived',
}

// Placeholder suggestions per resolution key. Fall back to a generic
// hint for any custom key the operator may have added later.
const RESOLUTION_LABEL_EXAMPLES: Record<string, string> = {
  swap: 'e.g. Aircraft rotation',
  delay_accepted: 'e.g. Delay absorbed',
  cancelled: 'e.g. Sector cancelled',
  reroute: 'e.g. Reroute',
  maintenance_cleared: 'e.g. MX released',
  monitoring_only: 'e.g. Observe only',
}
const RESOLUTION_HINT_EXAMPLES: Record<string, string> = {
  swap: 'Aircraft re-assigned to another rotation',
  delay_accepted: 'Operating with a tolerated delay; no further action',
  cancelled: 'Flight cancelled; pax/crew handled separately',
  reroute: 'Routing changed to another sector or station',
  maintenance_cleared: 'Underlying MX risk released; aircraft serviceable',
  monitoring_only: 'No action taken; situation observed and acceptable',
}

const FEED_STATUS_OPTIONS: Array<{ value: FeedStatusFilter; label: string }> = [
  { value: 'active', label: 'Active (Open / Assigned / In progress)' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All (incl. resolved & closed)' },
]

interface DraftState {
  slaCritical: number
  slaWarning: number
  slaInfo: number
  backlogThreshold: number
  rollingStops: number[]
  defaultFeedStatus: FeedStatusFilter
  categoryLabels: Record<Category, string>
  statusLabels: Record<Status, string>
  resolutionTypes: OperatorDisruptionResolutionType[]
}

function configToDraft(config: OperatorDisruptionConfig | null): DraftState {
  return {
    slaCritical: config?.sla?.critical ?? DEFAULT_SLA_MINUTES.critical,
    slaWarning: config?.sla?.warning ?? DEFAULT_SLA_MINUTES.warning,
    slaInfo: config?.sla?.info ?? DEFAULT_SLA_MINUTES.info,
    backlogThreshold: config?.ui?.openBacklogThreshold ?? DEFAULT_OPEN_BACKLOG_THRESHOLD,
    rollingStops: config?.ui?.rollingPeriodStops?.length
      ? [...config.ui.rollingPeriodStops]
      : [...DEFAULT_ROLLING_STOPS],
    defaultFeedStatus: config?.ui?.defaultFeedStatus ?? 'active',
    categoryLabels: {
      ...DEFAULT_CATEGORY_LABEL,
      ...((config?.vocabulary?.categoryLabels ?? {}) as Record<Category, string>),
    },
    statusLabels: { ...DEFAULT_STATUS_LABEL, ...((config?.vocabulary?.statusLabels ?? {}) as Record<Status, string>) },
    resolutionTypes: mergeResolutionTypes(config?.vocabulary?.resolutionTypes),
  }
}

function mergeResolutionTypes(overrides?: OperatorDisruptionResolutionType[]): OperatorDisruptionResolutionType[] {
  if (!overrides || overrides.length === 0) return DEFAULT_RESOLUTION_TYPES.map((d) => ({ ...d }))
  const byKey = new Map(overrides.map((r) => [r.key, r]))
  return DEFAULT_RESOLUTION_TYPES.map((d) => {
    const o = byKey.get(d.key)
    return o ? { ...d, ...o } : { ...d }
  })
}

function draftToUpsert(operatorId: string, draft: DraftState): OperatorDisruptionConfigUpsert {
  const categoryLabels: Record<string, string> = {}
  for (const [k, v] of Object.entries(draft.categoryLabels)) {
    const trimmed = v.trim()
    if (trimmed && trimmed !== DEFAULT_CATEGORY_LABEL[k as Category]) categoryLabels[k] = trimmed
  }
  const statusLabels: Record<string, string> = {}
  for (const [k, v] of Object.entries(draft.statusLabels)) {
    const trimmed = v.trim()
    if (trimmed && trimmed !== DEFAULT_STATUS_LABEL[k as Status]) statusLabels[k] = trimmed
  }
  return {
    operatorId,
    sla: {
      critical: draft.slaCritical,
      warning: draft.slaWarning,
      info: draft.slaInfo,
    },
    ui: {
      defaultFeedStatus: draft.defaultFeedStatus,
      rollingPeriodStops: [...draft.rollingStops].sort((a, b) => a - b),
      openBacklogThreshold: draft.backlogThreshold,
    },
    vocabulary: {
      categoryLabels: Object.keys(categoryLabels).length > 0 ? categoryLabels : undefined,
      statusLabels: Object.keys(statusLabels).length > 0 ? statusLabels : undefined,
      resolutionTypes: draft.resolutionTypes,
    },
  }
}

export function DisruptionCustomizationShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const accent = OPS_ACCENT

  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const refreshStoreConfig = useDisruptionStore((s) => s.refreshConfig)

  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])

  const [config, setConfig] = useState<OperatorDisruptionConfig | null>(null)
  const [draft, setDraft] = useState<DraftState>(configToDraft(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('sla')

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getOperatorDisruptionConfig(operator._id)
      .then((doc) => {
        if (!alive) return
        setConfig(doc)
        setDraft(configToDraft(doc))
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Failed to load config')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
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
      const updated = await api.upsertOperatorDisruptionConfig(draftToUpsert(operator._id, draft))
      setConfig(updated)
      setDraft(configToDraft(updated))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      void refreshStoreConfig()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [operator?._id, hasDraft, draft, refreshStoreConfig])

  const handleResetSection = useCallback((section: SectionKey) => {
    setDraft((prev) => {
      const next = { ...prev }
      switch (section) {
        case 'sla':
          next.slaCritical = DEFAULT_SLA_MINUTES.critical
          next.slaWarning = DEFAULT_SLA_MINUTES.warning
          next.slaInfo = DEFAULT_SLA_MINUTES.info
          break
        case 'backlog':
          next.backlogThreshold = DEFAULT_OPEN_BACKLOG_THRESHOLD
          break
        case 'rolling':
          next.rollingStops = [...DEFAULT_ROLLING_STOPS]
          break
        case 'feed':
          next.defaultFeedStatus = 'active'
          break
        case 'categories':
          next.categoryLabels = { ...DEFAULT_CATEGORY_LABEL }
          break
        case 'statuses':
          next.statusLabels = { ...DEFAULT_STATUS_LABEL }
          break
        case 'resolutions':
          next.resolutionTypes = DEFAULT_RESOLUTION_TYPES.map((d) => ({ ...d }))
          break
      }
      return next
    })
  }, [])

  if (!operator?._id) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[14px] text-hz-text-tertiary">Loading operator…</span>
      </div>
    )
  }

  return (
    <MasterDetailLayout
      left={
        <CustomizationSidebar
          sections={SECTIONS}
          activeSection={activeSection}
          onSelect={setActiveSection}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
      }
      center={
        <CustomizationCenter
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

// ── Sidebar ──
function CustomizationSidebar({
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
      <div className="px-4 py-3 border-b border-hz-border shrink-0">
        <h2 className="text-[15px] font-bold text-hz-text">Customization</h2>
        <p className="text-[13px] text-hz-text-secondary mt-0.5">Disruption Management overrides</p>
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

// ── Center ──
function CustomizationCenter({
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
  draft: DraftState
  setDraft: React.Dispatch<React.SetStateAction<DraftState>>
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
          <button
            type="button"
            onClick={() => onResetSection(section.key)}
            className="h-9 px-3 rounded-lg text-[13px] font-medium text-hz-text-tertiary hover:opacity-80 flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Reset section
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
            <span className="text-[14px] text-hz-text-tertiary">Loading configuration…</span>
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
    case 'sla':
      return <SlaHero accent={accent} isDark={isDark} />
    case 'backlog':
      return <BacklogHero accent={accent} isDark={isDark} />
    case 'rolling':
      return <RollingHero accent={accent} isDark={isDark} />
    case 'feed':
      return <FeedHero accent={accent} isDark={isDark} />
    case 'categories':
      return <CategoriesHero accent={accent} isDark={isDark} />
    case 'statuses':
      return <StatusesHero accent={accent} isDark={isDark} />
    case 'resolutions':
      return <ResolutionsHero accent={accent} isDark={isDark} />
  }
}

// ── Section bodies ──
function SectionBody({
  section,
  draft,
  setDraft,
  palette: _palette,
  isDark,
  accent,
}: {
  section: SectionKey
  draft: DraftState
  setDraft: React.Dispatch<React.SetStateAction<DraftState>>
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const innerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'
  const innerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  switch (section) {
    case 'sla':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            Response-time targets per severity. When an open issue's age exceeds its target, it counts as an SLA breach
            on the Response Time KPI card. Lower values = tighter OCC accountability.
          </HelpBlock>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <NumberField
              label="Critical (min)"
              value={draft.slaCritical}
              onChange={(v) => setDraft({ ...draft, slaCritical: v })}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
            <NumberField
              label="Warning (min)"
              value={draft.slaWarning}
              onChange={(v) => setDraft({ ...draft, slaWarning: v })}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
            <NumberField
              label="Info (min)"
              value={draft.slaInfo}
              onChange={(v) => setDraft({ ...draft, slaInfo: v })}
              inputBg={inputBg}
              inputBorder={inputBorder}
            />
          </div>
        </div>
      )

    case 'backlog':
      return (
        <div className="max-w-md">
          <HelpBlock>
            When the count of Open issues exceeds this number, the Workflow Status KPI card flashes a red glow so OCC
            can see the backlog is ballooning at a glance.
          </HelpBlock>
          <div className="mt-4">
            <NumberField
              label="Threshold (issues)"
              value={draft.backlogThreshold}
              onChange={(v) => setDraft({ ...draft, backlogThreshold: v })}
              inputBg={inputBg}
              inputBorder={inputBorder}
              widthClass="w-40"
            />
          </div>
        </div>
      )

    case 'rolling':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            Day-window stops shown on the rolling-period slider in the filter panel. Pick the values you want to offer.{' '}
            <span className="font-semibold">Off</span> is always present.
          </HelpBlock>
          <div className="flex flex-wrap gap-2 mt-4">
            {ROLLING_OPTIONS.map((d) => {
              const checked = draft.rollingStops.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    const next = checked ? draft.rollingStops.filter((x) => x !== d) : [...draft.rollingStops, d]
                    if (next.length === 0) return
                    setDraft({ ...draft, rollingStops: next })
                  }}
                  className="h-9 px-4 rounded-full text-[13px] font-medium transition-colors"
                  style={{
                    background: checked ? accent : 'transparent',
                    color: checked ? '#fff' : 'var(--color-hz-text)',
                    border: `1px solid ${checked ? accent : inputBorder}`,
                  }}
                >
                  {d}D
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'feed':
      return (
        <div className="max-w-md">
          <HelpBlock>
            Which status filter the feed shows when the page first opens. OCC users can still change it at any time via
            the Status dropdown.
          </HelpBlock>
          <div className="mt-4">
            <SelectField
              value={draft.defaultFeedStatus}
              onChange={(v) => setDraft({ ...draft, defaultFeedStatus: v as FeedStatusFilter })}
              options={FEED_STATUS_OPTIONS}
            />
          </div>
        </div>
      )

    case 'categories':
      return (
        <div>
          <HelpBlock>
            Override the display label for each category. Leave blank to keep the default. Historical issues always
            render under the key they were saved with, so renaming here is safe.
          </HelpBlock>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {(Object.keys(DEFAULT_CATEGORY_LABEL) as Category[]).map((k) => (
              <TextField
                key={k}
                heading={DEFAULT_CATEGORY_LABEL[k]}
                value={draft.categoryLabels[k]}
                defaultValue={DEFAULT_CATEGORY_LABEL[k]}
                placeholder={CATEGORY_PLACEHOLDER_EXAMPLES[k]}
                onChange={(v) => setDraft({ ...draft, categoryLabels: { ...draft.categoryLabels, [k]: v } })}
                inputBg={inputBg}
                inputBorder={inputBorder}
              />
            ))}
          </div>
        </div>
      )

    case 'statuses':
      return (
        <div>
          <HelpBlock>
            Rename the lifecycle states for your OCC vocabulary. Some airlines use "Escalated" or "Held" in place of
            defaults — enter the label here and it'll render everywhere in the Management module.
          </HelpBlock>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {(Object.keys(DEFAULT_STATUS_LABEL) as Status[]).map((k) => (
              <TextField
                key={k}
                heading={DEFAULT_STATUS_LABEL[k]}
                value={draft.statusLabels[k]}
                defaultValue={DEFAULT_STATUS_LABEL[k]}
                placeholder={STATUS_PLACEHOLDER_EXAMPLES[k]}
                onChange={(v) => setDraft({ ...draft, statusLabels: { ...draft.statusLabels, [k]: v } })}
                inputBg={inputBg}
                inputBorder={inputBorder}
              />
            ))}
          </div>
        </div>
      )

    case 'resolutions':
      return (
        <div className="w-full">
          <HelpBlock>
            Options offered in the Resolve dialog. Toggle off to hide an option from the picker. Keys are fixed —
            historical issues keep their resolution stored under the original key and still render correctly.
          </HelpBlock>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {draft.resolutionTypes.map((r, idx) => {
              const defaultRow = DEFAULT_RESOLUTION_TYPES.find((d) => d.key === r.key)
              const defaultLabel = defaultRow?.label ?? r.key
              const defaultHint = defaultRow?.hint ?? ''
              const labelPlaceholder = RESOLUTION_LABEL_EXAMPLES[r.key] ?? 'e.g. Custom label'
              const hintPlaceholder = RESOLUTION_HINT_EXAMPLES[r.key] ?? 'Short description shown in the Resolve dialog'
              return (
                <li
                  key={r.key}
                  className="rounded-xl p-4"
                  style={{ background: innerBg, border: `1px solid ${innerBorder}` }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...draft.resolutionTypes]
                        next[idx] = { ...next[idx], enabled: !next[idx].enabled }
                        setDraft({ ...draft, resolutionTypes: next })
                      }}
                      role="switch"
                      aria-checked={r.enabled}
                      className="h-5 w-9 rounded-full transition-colors shrink-0 relative"
                      style={{
                        background: r.enabled ? accent : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                      }}
                    >
                      <span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                        style={{ left: r.enabled ? 18 : 2 }}
                      />
                    </button>
                    <span className="text-[14px] font-semibold text-hz-text">{defaultLabel}</span>
                    {!r.enabled && <span className="text-[13px] text-hz-text-tertiary italic">Hidden from picker</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[13px] font-medium text-hz-text-secondary">Label</span>
                      <input
                        type="text"
                        value={r.label === defaultLabel ? '' : r.label}
                        onChange={(e) => {
                          const next = [...draft.resolutionTypes]
                          const v = e.target.value
                          next[idx] = { ...next[idx], label: v.trim() === '' ? defaultLabel : v }
                          setDraft({ ...draft, resolutionTypes: next })
                        }}
                        placeholder={labelPlaceholder}
                        className="w-full h-10 px-3 rounded-lg text-[14px] text-hz-text outline-none"
                        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[13px] font-medium text-hz-text-secondary">Hint</span>
                      <textarea
                        value={r.hint === defaultHint ? '' : r.hint}
                        onChange={(e) => {
                          const next = [...draft.resolutionTypes]
                          next[idx] = { ...next[idx], hint: e.target.value }
                          setDraft({ ...draft, resolutionTypes: next })
                        }}
                        rows={2}
                        placeholder={hintPlaceholder}
                        className="w-full px-3 py-2 rounded-lg text-[13px] text-hz-text-secondary outline-none resize-y"
                        style={{ background: inputBg, border: `1px solid ${inputBorder}`, minHeight: 56 }}
                      />
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )
  }
}

// ── Field primitives ──
function HelpBlock({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-hz-text-secondary leading-relaxed max-w-2xl">{children}</p>
}

function NumberField({
  label,
  value,
  onChange,
  inputBg,
  inputBorder,
  widthClass = 'w-full',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  inputBg: string
  inputBorder: string
  widthClass?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-hz-text-secondary">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10)
          if (Number.isFinite(n) && n > 0) onChange(n)
        }}
        className={`${widthClass} h-10 px-3 rounded-lg text-[14px] text-hz-text outline-none`}
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      />
    </label>
  )
}

function TextField({
  heading,
  value,
  defaultValue,
  placeholder,
  onChange,
  inputBg,
  inputBorder,
}: {
  heading: string
  value: string
  /** The hardcoded default — used to detect "no override" state. */
  defaultValue: string
  /** Example suggestion shown when the field is empty. */
  placeholder: string
  onChange: (v: string) => void
  inputBg: string
  inputBorder: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-hz-text">{heading}</span>
      <input
        type="text"
        value={value === defaultValue ? '' : value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 rounded-lg text-[14px] text-hz-text outline-none"
        style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
      />
    </label>
  )
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="w-full max-w-md">
      <Dropdown options={options} value={value} onChange={onChange} />
    </div>
  )
}
