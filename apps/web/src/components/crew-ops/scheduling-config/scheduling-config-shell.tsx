'use client'

/**
 * 4.1.6.3 Scheduling Configurations — admin shell.
 *
 * Operator soft-rule policy for crew schedule production. NOT FDTL (regulatory).
 * These rules shape auto-roster output and surface as amber warnings in the Gantt.
 *
 * Sections: General | Days Off & Duties | Standby | Destination Rules | Optimization
 * Persists to `OperatorSchedulingConfig` via /operator-scheduling-config.
 */

// Web Crypto in the browser. Node `crypto` import gets polyfilled by Next to
// `crypto-browserify`, which does NOT expose randomUUID — calling it throws.
const newId = (): string => {
  const wc = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (wc?.randomUUID) return wc.randomUUID()
  // Fallback: RFC4122 v4 from Math.random — fine for client-side temp ids.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Loader2,
  Save,
  RotateCcw,
  Layers,
  CalendarOff,
  Clock,
  MapPin,
  Target,
  Heart,
  Moon,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  api,
  type ActivityCodeRef,
  type OperatorSchedulingConfig,
  type OperatorSchedulingConfigUpsert,
  type SchedulingDestinationRule,
  type SchedulingQolRule,
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
  Toggle,
  RangeStepper,
  NumberStepper,
  SectionCard,
} from '@/components/admin/_shared/form-primitives'
import { Tooltip } from '@/components/ui/tooltip'
import { MultiSelectField, type MultiSelectOption } from '@/components/filter-panel/fields'
import { Select } from '@/components/selection-criteria/select'
import { HelpCircle } from 'lucide-react'
import {
  GeneralHero,
  DaysOffHero,
  StandbyHero,
  DestinationHero,
  OptimizationHero,
  QolHero,
  RestBufferHero,
} from './section-heroes'

const MODULE_ACCENT = MODULE_THEMES.workforce.accent

type SectionKey = 'general' | 'days-off' | 'standby' | 'destinations' | 'qol' | 'rest-buffer' | 'optimization'

interface SectionDef {
  key: SectionKey
  label: string
  desc: string
  icon: LucideIcon
}

const SECTIONS: SectionDef[] = [
  { key: 'general', label: 'General', desc: 'Carrier mode and scheduling strategy', icon: Layers },
  { key: 'standby', label: 'Standby', desc: 'Quota, timing, and duration rules', icon: Clock },
  { key: 'optimization', label: 'Optimization', desc: 'Auto-roster objective weights', icon: Target },
  { key: 'days-off', label: 'Days Off & Duties', desc: 'Days-off caps and duty rotation limits', icon: CalendarOff },
  {
    key: 'destinations',
    label: 'Destination Rules',
    desc: 'Per-airport / country layover and separation',
    icon: MapPin,
  },
  {
    key: 'qol',
    label: 'Quality of Life',
    desc: 'Wind down before vacations, ease back into duty after',
    icon: Heart,
  },
  {
    key: 'rest-buffer',
    label: 'Rest Buffer',
    desc: 'Operator-level safety margin stacked on top of FDTL minimum rest',
    icon: Moon,
  },
]

interface Draft {
  carrierMode: 'lcc' | 'legacy'
  daysOff: {
    minPerPeriodDays: number
    maxPerPeriodDays: number
    maxConsecutiveDaysOff: number
    maxConsecutiveDutyDays: number
    maxConsecutiveDutyDaysRule: { enabled: boolean; weight: number }
    maxConsecutiveMorningDuties: number
    maxConsecutiveMorningDutiesRule: { enabled: boolean; weight: number }
    maxConsecutiveAfternoonDuties: number
    maxConsecutiveAfternoonDutiesRule: { enabled: boolean; weight: number }
  }
  standby: {
    usePercentage: boolean
    minPerDayFlat: number
    minPerDayPct: number
    homeStandbyRatioPct: number
    startTimeMode: 'auto' | 'fixed'
    autoLeadTimeMin: number
    minDurationMin: number
    maxDurationMin: number
    requireLegalRestAfter: boolean
    extraRestAfterMin: number
  }
  destinationRules: SchedulingDestinationRule[]
  qolRules: SchedulingQolRule[]
  qolBirthday: { enabled: boolean }
  restBuffer: { enabled: boolean; inBaseMin: number; outOfBaseMin: number; augmentedMin: number }
  objectives: { genderBalanceOnLayovers: boolean; genderBalanceWeight: number }
}

const DEFAULT_DRAFT: Draft = {
  carrierMode: 'lcc',
  daysOff: {
    minPerPeriodDays: 8,
    maxPerPeriodDays: 10,
    maxConsecutiveDaysOff: 3,
    maxConsecutiveDutyDays: 4,
    maxConsecutiveDutyDaysRule: { enabled: true, weight: 5 },
    maxConsecutiveMorningDuties: 4,
    maxConsecutiveMorningDutiesRule: { enabled: true, weight: 3 },
    maxConsecutiveAfternoonDuties: 4,
    maxConsecutiveAfternoonDutiesRule: { enabled: true, weight: 3 },
  },
  standby: {
    usePercentage: true,
    minPerDayFlat: 2,
    minPerDayPct: 10,
    homeStandbyRatioPct: 80,
    startTimeMode: 'auto',
    autoLeadTimeMin: 120,
    minDurationMin: 360,
    maxDurationMin: 600,
    requireLegalRestAfter: true,
    extraRestAfterMin: 0,
  },
  destinationRules: [],
  qolRules: [],
  qolBirthday: { enabled: false },
  restBuffer: { enabled: false, inBaseMin: 0, outOfBaseMin: 0, augmentedMin: 0 },
  objectives: { genderBalanceOnLayovers: true, genderBalanceWeight: 80 },
}

function SoftRuleFormRow({
  label,
  description,
  limit,
  onLimitChange,
  rule,
  onRuleChange,
  accent,
}: {
  label: string
  description?: string
  limit: number
  onLimitChange: (v: number) => void
  rule: { enabled: boolean; weight: number }
  onRuleChange: (r: { enabled: boolean; weight: number }) => void
  accent: string
}) {
  const weightTier = rule.weight <= 3 ? 'Soft' : rule.weight <= 6 ? 'Balanced' : 'Strong'
  const weightColor = rule.weight <= 3 ? '#8F90A6' : rule.weight <= 6 ? '#0063F7' : '#FF8800'
  return (
    <FormRow label={label} description={description ?? ''}>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-3">
          <Toggle checked={rule.enabled} onChange={(v) => onRuleChange({ ...rule, enabled: v })} accent="#06C270" />
          <NumberStepper value={limit} onChange={onLimitChange} min={1} max={14} suffix="days" />
          <div className="flex items-center gap-1.5" style={{ opacity: rule.enabled ? 1 : 0.5 }}>
            <span className="text-[13px] text-hz-text-tertiary">Weight</span>
            <Tooltip
              multiline
              maxWidth={320}
              content={
                'Weight 1-10 scales how hard the solver avoids breaking this rule. Coverage of pairings always beats any soft rule.'
              }
            >
              <button
                type="button"
                aria-label="Weight help"
                className="inline-flex items-center justify-center w-4 h-4 text-hz-text-tertiary hover:text-hz-text-secondary"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </Tooltip>
            <NumberStepper
              value={rule.weight}
              onChange={(v) => onRuleChange({ ...rule, weight: v })}
              min={1}
              max={10}
              suffix=""
            />
          </div>
        </div>
        <div
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: rule.enabled ? weightColor : 'var(--color-hz-text-tertiary)' }}
        >
          {weightTier}
        </div>
      </div>
    </FormRow>
  )
}

function configToDraft(cfg: OperatorSchedulingConfig | null): Draft {
  if (!cfg) return DEFAULT_DRAFT
  return {
    carrierMode: cfg.carrierMode ?? DEFAULT_DRAFT.carrierMode,
    daysOff: { ...DEFAULT_DRAFT.daysOff, ...(cfg.daysOff ?? {}) },
    standby: { ...DEFAULT_DRAFT.standby, ...(cfg.standby ?? {}) },
    destinationRules: (cfg.destinationRules ?? []).map((r) => {
      // Migrate legacy single-code rules → codes[]
      const legacy = (r as unknown as { code?: string | null }).code
      const codes = Array.isArray(r.codes) && r.codes.length > 0 ? r.codes : legacy ? [legacy] : []
      return { ...r, codes }
    }),
    qolRules: cfg.qolRules ?? [],
    qolBirthday: { ...DEFAULT_DRAFT.qolBirthday, ...(cfg.qolBirthday ?? {}) },
    restBuffer: {
      ...DEFAULT_DRAFT.restBuffer,
      ...((cfg as { restBuffer?: Partial<Draft['restBuffer']> }).restBuffer ?? {}),
    },
    objectives: { ...DEFAULT_DRAFT.objectives, ...(cfg.objectives ?? {}) },
  }
}

function draftToUpsert(operatorId: string, d: Draft): OperatorSchedulingConfigUpsert {
  return {
    operatorId,
    carrierMode: d.carrierMode,
    daysOff: d.daysOff,
    standby: d.standby,
    destinationRules: d.destinationRules,
    qolRules: d.qolRules,
    qolBirthday: d.qolBirthday,
    restBuffer: d.restBuffer,
    objectives: d.objectives,
  }
}

export function SchedulingConfigShell() {
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

  const [config, setConfig] = useState<OperatorSchedulingConfig | null>(null)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('general')

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getOperatorSchedulingConfig(operator._id)
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
      const updated = await api.upsertOperatorSchedulingConfig(draftToUpsert(operator._id, draft))
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
      if (section === 'general') return { ...prev, carrierMode: DEFAULT_DRAFT.carrierMode }
      if (section === 'days-off') return { ...prev, daysOff: { ...DEFAULT_DRAFT.daysOff } }
      if (section === 'standby') return { ...prev, standby: { ...DEFAULT_DRAFT.standby } }
      if (section === 'destinations') return { ...prev, destinationRules: [] }
      if (section === 'qol') return { ...prev, qolRules: [], qolBirthday: { ...DEFAULT_DRAFT.qolBirthday } }
      if (section === 'rest-buffer') return { ...prev, restBuffer: { ...DEFAULT_DRAFT.restBuffer } }
      if (section === 'optimization') return { ...prev, objectives: { ...DEFAULT_DRAFT.objectives } }
      return prev
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
        <h2 className="text-[15px] font-bold text-hz-text">Scheduling Configurations</h2>
        <p className="text-[13px] text-hz-text-secondary mt-0.5">Operator soft rules for crew schedule production</p>
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
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const section = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0]
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
    case 'general':
      return <GeneralHero accent={accent} isDark={isDark} />
    case 'days-off':
      return <DaysOffHero accent={accent} isDark={isDark} />
    case 'standby':
      return <StandbyHero accent={accent} isDark={isDark} />
    case 'destinations':
      return <DestinationHero accent={accent} isDark={isDark} />
    case 'qol':
      return <QolHero accent={accent} isDark={isDark} />
    case 'rest-buffer':
      return <RestBufferHero accent={accent} isDark={isDark} />
    case 'optimization':
      return <OptimizationHero accent={accent} isDark={isDark} />
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
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const patchDaysOff = (p: Partial<Draft['daysOff']>) =>
    setDraft((prev) => ({ ...prev, daysOff: { ...prev.daysOff, ...p } }))
  const patchStandby = (p: Partial<Draft['standby']>) =>
    setDraft((prev) => ({ ...prev, standby: { ...prev.standby, ...p } }))
  const patchObjectives = (p: Partial<Draft['objectives']>) =>
    setDraft((prev) => ({ ...prev, objectives: { ...prev.objectives, ...p } }))
  const patchRestBuffer = (p: Partial<Draft['restBuffer']>) =>
    setDraft((prev) => ({ ...prev, restBuffer: { ...prev.restBuffer, ...p } }))

  switch (section) {
    case 'general':
      return (
        <div className="max-w-4xl space-y-6">
          <HelpBlock>
            Carrier mode controls the solver's day-type priority. LCC mode places standby above day-off: when no flight
            duty is available, crew get standby first. Legacy mode treats days off as a scheduling benefit and may
            assign them before standby slots are filled.
          </HelpBlock>
          <SectionCard title="Carrier Mode" subtitle="Day-type assignment priority in the auto-roster solver.">
            <FormRow
              label="Carrier Mode"
              description="Controls day-type assignment priority in the auto-roster solver."
            >
              <div
                className="flex items-center gap-1 rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}` }}
              >
                {(['lcc', 'legacy'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, carrierMode: mode }))}
                    className="px-4 h-9 text-[13px] font-medium transition-colors"
                    style={{
                      background: draft.carrierMode === mode ? accent : 'transparent',
                      color: draft.carrierMode === mode ? '#fff' : palette.textSecondary,
                    }}
                  >
                    {mode === 'lcc' ? 'LCC' : 'Legacy'}
                  </button>
                ))}
              </div>
            </FormRow>
          </SectionCard>
        </div>
      )

    case 'days-off':
      return (
        <div className="max-w-4xl space-y-6">
          <HelpBlock>
            Hard caps for days-off and duty streaks. When a crew member would exceed the max days-off cap, the
            auto-roster assigns standby instead. Consecutive duty and rotation limits surface as amber warnings in the
            Gantt — they are never hard blocks.
          </HelpBlock>
          <SectionCard title="Days Off" subtitle="Period floor, cap, and consecutive OFF block limit.">
            <FormRow
              label="Min Days Off per Period"
              description="Floor. Each crew must get at least this many off in the period (FDTL-aligned)."
            >
              <NumberStepper
                value={draft.daysOff.minPerPeriodDays}
                onChange={(v) => patchDaysOff({ minPerPeriodDays: v })}
                min={0}
                max={31}
                suffix="days"
              />
            </FormRow>
            <FormRow label="Max Days Off per Period" description="Hard cap. Standby assigned instead once reached.">
              <NumberStepper
                value={draft.daysOff.maxPerPeriodDays}
                onChange={(v) => patchDaysOff({ maxPerPeriodDays: v })}
                min={0}
                max={31}
                suffix="days"
              />
            </FormRow>
            <FormRow
              label="Max Consecutive Days Off"
              description="Auto-roster won't place more than N OFF days in a row. Prevents long mini-holiday blocks. Legacy 3-4, LCC 2-3."
            >
              <NumberStepper
                value={draft.daysOff.maxConsecutiveDaysOff}
                onChange={(v) => patchDaysOff({ maxConsecutiveDaysOff: v })}
                min={1}
                max={7}
                suffix="days"
              />
            </FormRow>
          </SectionCard>
          <SectionCard
            title="Consecutive Duties"
            subtitle="Soft caps on consecutive duty days and morning/afternoon runs."
          >
            <SoftRuleFormRow
              label="Max Consecutive Duty Days"
              description="Solver penalises rosters that push crew beyond this streak. Weight = how aggressively to avoid it."
              limit={draft.daysOff.maxConsecutiveDutyDays}
              onLimitChange={(v) => patchDaysOff({ maxConsecutiveDutyDays: v })}
              rule={draft.daysOff.maxConsecutiveDutyDaysRule}
              onRuleChange={(r) => patchDaysOff({ maxConsecutiveDutyDaysRule: r })}
              accent={accent}
            />
            <SoftRuleFormRow
              label="Max Consecutive Morning Duties"
              description="Morning = report before 12:00 local. Solver penalises streaks exceeding the limit."
              limit={draft.daysOff.maxConsecutiveMorningDuties}
              onLimitChange={(v) => patchDaysOff({ maxConsecutiveMorningDuties: v })}
              rule={draft.daysOff.maxConsecutiveMorningDutiesRule}
              onRuleChange={(r) => patchDaysOff({ maxConsecutiveMorningDutiesRule: r })}
              accent={accent}
            />
            <SoftRuleFormRow
              label="Max Consecutive Afternoon Duties"
              description="Afternoon = report 12:00–18:00 local. Solver penalises streaks exceeding the limit."
              limit={draft.daysOff.maxConsecutiveAfternoonDuties}
              onLimitChange={(v) => patchDaysOff({ maxConsecutiveAfternoonDuties: v })}
              rule={draft.daysOff.maxConsecutiveAfternoonDutiesRule}
              onRuleChange={(r) => patchDaysOff({ maxConsecutiveAfternoonDutiesRule: r })}
              accent={accent}
            />
          </SectionCard>
        </div>
      )

    case 'standby':
      return (
        <div className="max-w-4xl space-y-6">
          <HelpBlock>
            Standby quota is a minimum floor filled after all flight seats are covered. The solver never drops a flight
            duty to satisfy standby quota. Duration bounds are enforced by planning — FDTL rest limits still apply on
            top.
          </HelpBlock>
          <SectionCard title="Daily Quota">
            <FormRow
              label="Quota Method"
              description="Calculate minimum standbys as a percentage of active crew or as a flat count."
            >
              <div
                className="flex items-center gap-1 rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}` }}
              >
                {(
                  [
                    ['true', 'Percentage'],
                    ['false', 'Flat count'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => patchStandby({ usePercentage: val === 'true' })}
                    className="px-3 h-9 text-[13px] font-medium transition-colors"
                    style={{
                      background: String(draft.standby.usePercentage) === val ? accent : 'transparent',
                      color: String(draft.standby.usePercentage) === val ? '#fff' : palette.textSecondary,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormRow>
            {draft.standby.usePercentage ? (
              <FormRow
                label="Min Standbys (% of active crew)"
                description="e.g. 10 = at least 10% of crew operating on that day must be on standby."
              >
                <RangeStepper
                  value={draft.standby.minPerDayPct}
                  onChange={(v) => patchStandby({ minPerDayPct: v })}
                  min={0}
                  max={50}
                  suffix="%"
                  accent={accent}
                />
              </FormRow>
            ) : (
              <FormRow
                label="Min Standbys (flat count)"
                description="Minimum number of standby crew per day regardless of active crew count."
              >
                <NumberStepper
                  value={draft.standby.minPerDayFlat}
                  onChange={(v) => patchStandby({ minPerDayFlat: v })}
                  min={0}
                  max={50}
                  suffix="crew"
                />
              </FormRow>
            )}
            <FormRow
              label="Home Standby Ratio"
              description="What percentage of the standby quota should be home standby vs airport standby."
            >
              <RangeStepper
                value={draft.standby.homeStandbyRatioPct}
                onChange={(v) => patchStandby({ homeStandbyRatioPct: v })}
                min={0}
                max={100}
                suffix="% home"
                accent={accent}
              />
            </FormRow>
          </SectionCard>
          <SectionCard title="Timing" subtitle="When standbys begin relative to the first departure of the day.">
            <FormRow
              label="Start Time Mode"
              description="Auto calculates start from first departure. Fixed uses defined local times."
            >
              <div
                className="flex items-center gap-1 rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}` }}
              >
                {(
                  [
                    ['auto', 'Auto'],
                    ['fixed', 'Fixed'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => patchStandby({ startTimeMode: val })}
                    className="px-3 h-9 text-[13px] font-medium transition-colors"
                    style={{
                      background: draft.standby.startTimeMode === val ? accent : 'transparent',
                      color: draft.standby.startTimeMode === val ? '#fff' : palette.textSecondary,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormRow>
            {draft.standby.startTimeMode === 'auto' && (
              <FormRow
                label="Lead Time Before Departure"
                description="Standby begins at least this many minutes before the day's first departure."
              >
                <NumberStepper
                  value={draft.standby.autoLeadTimeMin}
                  onChange={(v) => patchStandby({ autoLeadTimeMin: v })}
                  min={30}
                  max={480}
                  step={15}
                  suffix="min"
                />
              </FormRow>
            )}
          </SectionCard>
          <SectionCard title="Duration & Rest">
            <FormRow label="Minimum Standby Duration" description="Standby duties must be at least this long.">
              <NumberStepper
                value={draft.standby.minDurationMin}
                onChange={(v) => patchStandby({ minDurationMin: v })}
                min={60}
                max={draft.standby.maxDurationMin}
                step={30}
                suffix="min"
              />
            </FormRow>
            <FormRow
              label="Maximum Standby Duration"
              description="Standby duties must not exceed this duration (company policy — FDTL limits still apply)."
            >
              <NumberStepper
                value={draft.standby.maxDurationMin}
                onChange={(v) => patchStandby({ maxDurationMin: v })}
                min={draft.standby.minDurationMin}
                max={1440}
                step={30}
                suffix="min"
              />
            </FormRow>
            <FormRow
              label="Legal Rest Required After Standby"
              description="If a standby is called out, the following rest must meet at least the legal minimum."
            >
              <Toggle
                checked={draft.standby.requireLegalRestAfter}
                onChange={(v) => patchStandby({ requireLegalRestAfter: v })}
                accent="#06C270"
              />
            </FormRow>
            <FormRow
              label="Extra Rest After Standby (min)"
              description="Additional rest minutes beyond the legal minimum after any standby callout."
              indent
            >
              <NumberStepper
                value={draft.standby.extraRestAfterMin}
                onChange={(v) => patchStandby({ extraRestAfterMin: v })}
                min={0}
                max={480}
                step={15}
                suffix="min"
              />
            </FormRow>
          </SectionCard>
        </div>
      )

    case 'destinations':
      return (
        <DestinationRulesSection draft={draft} setDraft={setDraft} isDark={isDark} accent={accent} palette={palette} />
      )

    case 'qol':
      return <QolRulesSection draft={draft} setDraft={setDraft} isDark={isDark} accent={accent} palette={palette} />

    case 'rest-buffer':
      return (
        <div className="max-w-4xl space-y-6">
          <HelpBlock>
            Operator-level safety buffer added on top of the regulatory FDTL minimum rest. Hard rules — the auto-roster
            solver rejects any candidate pairing whose preceding rest gap is below FDTL minimum + buffer. Useful for
            operators that want a recovery margin above what the regulator requires (e.g. add 30 min to in-base rest as
            a buffer against operational delays).
          </HelpBlock>
          <SectionCard title="Rest Buffer" subtitle="Stack additional minutes on top of FDTL minimum rest.">
            <FormRow
              label="Apply Rest Buffers"
              description="Master toggle. When off, all three buffers below are ignored."
            >
              <Toggle
                checked={draft.restBuffer.enabled}
                onChange={(v) => patchRestBuffer({ enabled: v })}
                accent="#06C270"
              />
            </FormRow>
            <FormRow
              label="In-base rest buffer"
              description="Extra rest added on top of the regulatory minimum after duties that end at the crew's home base."
            >
              <NumberStepper
                value={draft.restBuffer.inBaseMin}
                onChange={(v) => patchRestBuffer({ inBaseMin: v })}
                min={0}
                max={1440}
                step={15}
                suffix="min"
              />
            </FormRow>
            <FormRow
              label="Out-of-base rest buffer"
              description="Extra rest added on top of the regulatory minimum after duties that end at a layover station away from home base."
            >
              <NumberStepper
                value={draft.restBuffer.outOfBaseMin}
                onChange={(v) => patchRestBuffer({ outOfBaseMin: v })}
                min={0}
                max={1440}
                step={15}
                suffix="min"
              />
            </FormRow>
            <FormRow
              label="Augmented-crew rest buffer"
              description="Extra rest added after pairings flown with augmented (heavy or ultra-long-range) crew. Stacks on top of the in-base or out-of-base buffer above."
            >
              <NumberStepper
                value={draft.restBuffer.augmentedMin}
                onChange={(v) => patchRestBuffer({ augmentedMin: v })}
                min={0}
                max={1440}
                step={15}
                suffix="min"
              />
            </FormRow>
          </SectionCard>
        </div>
      )

    case 'optimization':
      return (
        <div className="max-w-4xl space-y-6">
          <HelpBlock>
            Optimization objectives shape how the auto-roster solver ranks equal-coverage solutions. Gender balance on
            layover flights reduces HOTAC costs by pairing crew of the same gender in shared accommodation.
          </HelpBlock>
          <SectionCard
            title="Layover Balance"
            subtitle="Pair crew on overnight layovers to reduce shared accommodation costs."
          >
            <FormRow
              label="Balance Gender on Layover Flights"
              description="Solver tries to pair crew of the same gender on overnight layover duties to reduce shared accommodation costs."
            >
              <Toggle
                checked={draft.objectives.genderBalanceOnLayovers}
                onChange={(v) => patchObjectives({ genderBalanceOnLayovers: v })}
                accent="#06C270"
              />
            </FormRow>
            <FormRow
              label="Gender Balance Weight"
              description="Relative importance vs other balance objectives (block hours, sectors, layovers). Higher = solver tries harder."
              indent={draft.objectives.genderBalanceOnLayovers}
            >
              <RangeStepper
                value={draft.objectives.genderBalanceWeight}
                onChange={(v) => patchObjectives({ genderBalanceWeight: v })}
                min={0}
                max={100}
                suffix="%"
                accent={accent}
              />
            </FormRow>
          </SectionCard>
        </div>
      )
  }
}

function DestinationRulesSection({
  draft,
  setDraft,
  isDark,
  accent,
  palette,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const operator = useOperatorStore((s) => s.operator)
  const [airports, setAirports] = useState<MultiSelectOption[]>([])
  const [countries, setCountries] = useState<MultiSelectOption[]>([])

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    api
      .getAirports()
      .then((rows) => {
        if (!alive) return
        setAirports(
          rows
            .filter((a) => a.isActive)
            .map((a) => ({ key: a.icaoCode, label: `${a.iataCode ?? a.icaoCode} — ${a.name}` })),
        )
      })
      .catch(() => {})
    api
      .getCountries()
      .then((rows) => {
        if (!alive) return
        setCountries(
          rows
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => ({ key: c.isoCode2, label: `${c.name} (${c.isoCode2})` })),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [operator?._id])

  const addRule = () => {
    setDraft((prev) => ({
      ...prev,
      destinationRules: [
        ...prev.destinationRules,
        {
          _id: newId(),
          scope: 'airport',
          codes: [],
          maxLayoversPerPeriod: null,
          minSeparationDays: null,
          enabled: true,
        },
      ],
    }))
  }

  const patchRule = (id: string, patch: Partial<SchedulingDestinationRule>) => {
    setDraft((prev) => ({
      ...prev,
      destinationRules: prev.destinationRules.map((r) => (r._id === id ? { ...r, ...patch } : r)),
    }))
  }

  const removeRule = (id: string) => {
    setDraft((prev) => ({ ...prev, destinationRules: prev.destinationRules.filter((r) => r._id !== id) }))
  }

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(96,97,112,0.08)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div className="max-w-4xl space-y-6">
      <HelpBlock>
        Per-airport or per-country restrictions on layovers and duty separation. Hard/soft toggle per rule controls
        whether the auto-roster treats the limit as inviolable or as a preference. Amber Gantt warning shown in either
        case when the limit is exceeded.
      </HelpBlock>
      <SectionCard title="Destination Rules" subtitle="Per-airport or per-country layover and separation limits.">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-hz-text-secondary">
            {draft.destinationRules.length} rule{draft.destinationRules.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={addRule}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[13px] font-medium text-white"
            style={{ backgroundColor: accent }}
          >
            <Plus size={13} strokeWidth={2.5} /> Add Rule
          </button>
        </div>
        {draft.destinationRules.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl"
            style={{ border: `1px dashed ${borderColor}` }}
          >
            <MapPin size={28} color={palette.textTertiary} strokeWidth={1.4} className="mb-2" />
            <p className="text-[13px] text-hz-text-tertiary">No destination rules. Click Add Rule to create one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {draft.destinationRules.map((rule) => (
              <div
                key={rule._id}
                className="rounded-xl p-4"
                style={{
                  border: `1px solid ${borderColor}`,
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-[120px]">
                    <Select
                      value={rule.scope}
                      onChange={(v) => patchRule(rule._id, { scope: v as 'airport' | 'country', codes: [] })}
                      options={[
                        { value: 'airport', label: 'Airport' },
                        { value: 'country', label: 'Country' },
                      ]}
                    />
                  </div>
                  <div className="w-[180px]">
                    <MultiSelectField
                      options={rule.scope === 'airport' ? airports : countries}
                      value={rule.codes}
                      onChange={(keys) => patchRule(rule._id, { codes: keys })}
                      allLabel={rule.scope === 'airport' ? 'All airports' : 'All countries'}
                      noneLabel={rule.scope === 'airport' ? 'Select airports…' : 'Select countries…'}
                      searchable
                      searchPlaceholder={rule.scope === 'airport' ? 'Search airports…' : 'Search countries…'}
                      summaryBy="key"
                      summaryMax={3}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-hz-text-secondary">Max layovers</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={rule.maxLayoversPerPeriod ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        patchRule(rule._id, {
                          maxLayoversPerPeriod: e.target.value === '' ? null : parseInt(e.target.value, 10),
                        })
                      }
                      className="h-9 px-3 rounded-lg text-[13px] font-mono text-hz-text outline-none w-16 text-center"
                      style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-hz-text-secondary">Min sep.</span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={rule.minSeparationDays ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        patchRule(rule._id, {
                          minSeparationDays: e.target.value === '' ? null : parseInt(e.target.value, 10),
                        })
                      }
                      className="h-9 px-3 rounded-lg text-[13px] font-mono text-hz-text outline-none w-16 text-center"
                      style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
                    />
                    <span className="text-[13px] text-hz-text-secondary">days</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Toggle
                      checked={rule.enabled}
                      onChange={(v) => patchRule(rule._id, { enabled: v })}
                      accent="#06C270"
                    />
                    <button
                      type="button"
                      onClick={() => removeRule(rule._id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Remove rule"
                    >
                      <Trash2 size={14} color="#E63535" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── Quality of Life Rules Section ─────────────────────────────────────────────

function QolRulesSection({
  draft,
  setDraft,
  isDark,
  accent,
  palette,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const operator = useOperatorStore((s) => s.operator)
  const [activityCodes, setActivityCodes] = useState<ActivityCodeRef[] | null>(null)
  const [codesError, setCodesError] = useState<string | null>(null)

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    api
      .getActivityCodes(operator._id)
      .then((rows) => alive && setActivityCodes(rows.filter((c) => c.isActive && !c.isArchived)))
      .catch((e) => alive && setCodesError(e instanceof Error ? e.message : 'Failed to load activity codes'))
    return () => {
      alive = false
    }
  }, [operator?._id])

  // Use the activity CODE (e.g. "AL", "VAC") as the option key, not the
  // mongo _id. Codes are stable identifiers, render as compact summaries in
  // the trigger ("AL, VAC, +2"), and survive renames just as well as ids.
  const codeOptions = useMemo<MultiSelectOption[]>(
    () =>
      (activityCodes ?? [])
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((c) => ({ key: c.code, label: `${c.code} — ${c.name}` })),
    [activityCodes],
  )

  // Legacy migration: rules saved before the key swap stored mongo _ids.
  // Once we know the activityCodes set, rewrite any UUID-shaped entries to
  // their code. One-shot per load; the rewritten draft is what the user
  // saves on next Save Changes.
  useEffect(() => {
    if (!activityCodes || activityCodes.length === 0) return
    const idToCode = new Map<string, string>()
    for (const c of activityCodes) idToCode.set(c._id, c.code)
    setDraft((prev) => {
      let dirty = false
      const next = (prev.qolRules ?? []).map((r) => {
        const ids = r.activityCodeIds ?? []
        const fixed = ids.map((v) => idToCode.get(v) ?? v)
        if (fixed.some((v, i) => v !== ids[i])) {
          dirty = true
          return { ...r, activityCodeIds: fixed }
        }
        return r
      })
      return dirty ? { ...prev, qolRules: next } : prev
    })
  }, [activityCodes, setDraft])

  const addRule = (direction: 'before_activity' | 'after_activity') => {
    setDraft((prev) => ({
      ...prev,
      qolRules: [
        ...(prev.qolRules ?? []),
        {
          _id: newId(),
          enabled: true,
          direction,
          activityCodeIds: codeOptions[0] ? [codeOptions[0].key] : [],
          timeHHMM: '12:00',
          weight: 5,
          notes: null,
        },
      ],
    }))
  }

  const patchRule = (id: string, patch: Partial<SchedulingQolRule>) => {
    setDraft((prev) => ({
      ...prev,
      qolRules: (prev.qolRules ?? []).map((r) => (r._id === id ? { ...r, ...patch } : r)),
    }))
  }

  const removeRule = (id: string) => {
    setDraft((prev) => ({ ...prev, qolRules: (prev.qolRules ?? []).filter((r) => r._id !== id) }))
  }

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(96,97,112,0.08)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const birthday = draft.qolBirthday ?? DEFAULT_DRAFT.qolBirthday
  const patchBirthday = (p: Partial<Draft['qolBirthday']>) =>
    setDraft((prev) => ({ ...prev, qolBirthday: { ...(prev.qolBirthday ?? DEFAULT_DRAFT.qolBirthday), ...p } }))

  const beforeRules = (draft.qolRules ?? []).filter((r) => r.direction === 'before_activity')
  const afterRules = (draft.qolRules ?? []).filter((r) => r.direction === 'after_activity')

  const renderRule = (rule: SchedulingQolRule) => {
    const verb = rule.direction === 'before_activity' ? 'End duty by' : 'Start duty after'
    const conn = rule.direction === 'before_activity' ? 'the day before' : 'the day after'
    return (
      <div
        key={rule._id}
        className="flex items-center gap-3 py-2.5"
        style={{ borderBottom: `1px solid ${borderColor}`, opacity: rule.enabled ? 1 : 0.55 }}
      >
        {/* Left cluster — semantic editor (verb · time · connector · codes · weight) */}
        <span className="text-[13px] font-medium text-hz-text-secondary w-[110px] shrink-0">{verb}</span>
        <input
          type="time"
          value={rule.timeHHMM}
          onChange={(e) => patchRule(rule._id, { timeHHMM: e.target.value })}
          className="h-9 px-2 rounded-lg text-[13px] font-mono text-hz-text outline-none w-[96px] shrink-0"
          style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
        />
        <span className="text-[13px] text-hz-text-tertiary w-[100px] shrink-0">{conn}</span>
        <div className="w-[180px] shrink-0">
          <MultiSelectField
            options={codeOptions}
            value={rule.activityCodeIds ?? []}
            onChange={(keys) => patchRule(rule._id, { activityCodeIds: keys })}
            allLabel="All Codes"
            noneLabel="Select codes…"
            searchable
            searchPlaceholder="Search codes…"
            summaryBy="key"
            summaryMax={3}
          />
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="text-[12px] text-hz-text-tertiary">Weight</span>
          <NumberStepper
            value={rule.weight}
            onChange={(v) => patchRule(rule._id, { weight: v })}
            min={1}
            max={10}
            suffix=""
          />
        </div>
        {/* Right cluster — toggle anchored at row's right edge (matches Birthday FormRow) */}
        <div className="ml-auto flex items-center gap-2">
          <Toggle checked={rule.enabled} onChange={(v) => patchRule(rule._id, { enabled: v })} accent="#06C270" />
          <button
            type="button"
            onClick={() => removeRule(rule._id)}
            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Remove rule"
          >
            <Trash2 size={14} color="#E63535" />
          </button>
        </div>
      </div>
    )
  }

  const addButton = (onAdd: () => void) => (
    <div className="flex justify-end mb-3">
      <button
        type="button"
        onClick={onAdd}
        disabled={codeOptions.length === 0}
        className="h-7 px-2.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-40"
        style={{ background: 'transparent', border: `1px solid ${inputBorder}`, color: accent }}
      >
        <Plus size={13} /> Add rule
      </button>
    </div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      <HelpBlock>
        Quality-of-life soft rules. Birthday off keeps a crew's special day clear. Wind-down rules end duty earlier the
        day before a vacation/leave activity; Late-return rules start duty later the day after. Coverage of pairings
        always wins; weight controls how hard the solver tries.
      </HelpBlock>

      <SectionCard title="Birthday">
        <FormRow
          label="Birthday off"
          description="Automatic Crew Assignment will place OFF on a crew member's birthday."
        >
          <Toggle checked={birthday.enabled} onChange={(v) => patchBirthday({ enabled: v })} accent="#06C270" />
        </FormRow>
      </SectionCard>

      {codesError && (
        <div
          className="px-3 py-2 rounded-lg text-[13px]"
          style={{
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#EF4444',
          }}
        >
          {codesError}
        </div>
      )}

      <SectionCard title="Wind-down before activity" subtitle="End duty earlier the day before listed activity codes.">
        {addButton(() => addRule('before_activity'))}
        {beforeRules.length === 0 ? (
          <div
            className="rounded-lg px-3 py-2.5 text-[13px] text-hz-text-tertiary"
            style={{ border: `1px dashed ${borderColor}` }}
          >
            No wind-down rules.
          </div>
        ) : (
          beforeRules.map(renderRule)
        )}
      </SectionCard>

      <SectionCard title="Late return after activity" subtitle="Start duty later the day after listed activity codes.">
        {addButton(() => addRule('after_activity'))}
        {afterRules.length === 0 ? (
          <div
            className="rounded-lg px-3 py-2.5 text-[13px] text-hz-text-tertiary"
            style={{ border: `1px dashed ${borderColor}` }}
          >
            No late-return rules.
          </div>
        ) : (
          afterRules.map(renderRule)
        )}
      </SectionCard>
    </div>
  )
}
