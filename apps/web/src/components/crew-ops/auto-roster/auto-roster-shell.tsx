'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarOff,
  CalendarRange,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  GraduationCap,
  GripVertical,
  HelpCircle,
  History,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Table as TableIcon,
  Target,
  Trash2,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import {
  api,
  type AutoRosterRun,
  type DayBreakdown,
  type OperatorSchedulingConfig,
  type PeriodBreakdown,
} from '@skyhub/api'
import { MODULE_THEMES } from '@skyhub/constants'
import { accentTint, colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { AutoRosterFilterPanel } from './auto-roster-filter-panel'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useAutoRosterFilterStore } from '@/stores/use-auto-roster-filter-store'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { NumberStepper } from '@/components/admin/_shared/form-primitives'
import { Tooltip } from '@/components/ui/tooltip'
import { collapseDock } from '@/lib/dock-store'

const MODULE_ACCENT = MODULE_THEMES.workforce.accent

// ── Types ─────────────────────────────────────────────────────────────────────

type StepKey = 'manpower' | 'analysis' | 'generate' | 'review'
type ActiveKey = StepKey | 'history'
type RunPhase = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

interface StepDef {
  key: StepKey
  num: number
  label: string
  desc: string
  icon: LucideIcon
}

const STEPS: StepDef[] = [
  { key: 'manpower', num: 1, label: 'Manpower Projection', desc: 'Verify crew pool vs pairing demand', icon: Users },
  { key: 'analysis', num: 2, label: 'Roster Analysis', desc: 'Review constraints and priorities', icon: ListChecks },
  { key: 'generate', num: 3, label: 'Generate Roster', desc: 'Run CP-SAT solver', icon: Sparkles },
  { key: 'review', num: 4, label: 'Review & Accept', desc: 'Inspect results · publish to Gantt', icon: CheckSquare },
]

type AssignmentMode = 'general' | 'daysOff' | 'standby' | 'longDuties' | 'training' | 'clear'

// ── Shell ─────────────────────────────────────────────────────────────────────

export function AutoRosterShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const accent = MODULE_ACCENT

  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)

  const [active, setActive] = useState<ActiveKey>('manpower')
  const [highestStep, setHighestStep] = useState(1)
  const [config, setConfig] = useState<OperatorSchedulingConfig | null>(null)
  const [history, setHistory] = useState<AutoRosterRun[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Session-scoped filter state (clears on page refresh)
  const periodFrom = useAutoRosterFilterStore((s) => s.periodFrom)
  const periodTo = useAutoRosterFilterStore((s) => s.periodTo)
  const filterBase = useAutoRosterFilterStore((s) => s.filterBase)
  const filterPosition = useAutoRosterFilterStore((s) => s.filterPosition)
  const filterAcType = useAutoRosterFilterStore((s) => s.filterAcType)
  const filterCrewGroup = useAutoRosterFilterStore((s) => s.filterCrewGroup)
  const committed = useAutoRosterFilterStore((s) => s.committed)
  const setPeriodFrom = useAutoRosterFilterStore((s) => s.setPeriodFrom)
  const setPeriodTo = useAutoRosterFilterStore((s) => s.setPeriodTo)
  const setFilterBase = useAutoRosterFilterStore((s) => s.setFilterBase)
  const setFilterPosition = useAutoRosterFilterStore((s) => s.setFilterPosition)
  const setFilterAcType = useAutoRosterFilterStore((s) => s.setFilterAcType)
  const setFilterCrewGroup = useAutoRosterFilterStore((s) => s.setFilterCrewGroup)
  const commitFilter = useAutoRosterFilterStore((s) => s.commit)

  const [mode, setMode] = useState<AssignmentMode>('general')
  const [longDutiesMinDays, setLongDutiesMinDays] = useState(2)

  // One breakdown per selected position (fan-out). Single entry when 0 or 1
  // position is selected. `activeBreakdownIdx` is the tab the user is viewing.
  const [breakdowns, setBreakdowns] = useState<
    Array<{
      positionId: string | null
      label: string
      data: PeriodBreakdown
    }>
  >([])
  const [activeBreakdownIdx, setActiveBreakdownIdx] = useState(0)
  const breakdown: PeriodBreakdown | null = breakdowns[activeBreakdownIdx]?.data ?? null
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [breakdownError, setBreakdownError] = useState<string | null>(null)

  // Position labels for tab headers.
  const allPositions = useCrewScheduleStore((s) => s.positions)

  const [phase, setPhase] = useState<RunPhase>('idle')
  const [progress, setProgress] = useState({ pct: 0, message: '' })
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [resultRun, setResultRun] = useState<AutoRosterRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])
  useEffect(() => {
    collapseDock()
  }, [])
  useEffect(() => {
    if (!operator?._id) return
    api
      .getOperatorSchedulingConfig(operator._id)
      .then(setConfig)
      .catch(() => null)
    void loadHistory()
  }, [operator?._id])

  useEffect(() => {
    setBreakdowns([])
    setActiveBreakdownIdx(0)
    setBreakdownError(null)
  }, [periodFrom, periodTo, filterBase, filterPosition, filterAcType, filterCrewGroup])

  const loadHistory = useCallback(async () => {
    if (!operator?._id) return
    setHistoryLoading(true)
    try {
      setHistory(await api.getAutoRosterHistory(operator._id))
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false)
    }
  }, [operator?._id])

  const handleAnalyze = useCallback(async () => {
    if (!operator?._id || !periodFrom || !periodTo) return
    setBreakdownLoading(true)
    setBreakdownError(null)
    try {
      const sharedFilters = {
        base: filterBase.length ? filterBase : undefined,
        acType: filterAcType.length ? filterAcType : undefined,
        crewGroup: filterCrewGroup.length ? filterCrewGroup : undefined,
      }
      // Fan out one request per position. If user picked none, fall back to
      // all active positions (still one chart per position, never stacked).
      // Sort cockpit-first then by rankOrder so tabs read CP → FO → PU → CA.
      const fanoutIds =
        filterPosition.length > 0
          ? filterPosition
          : allPositions
              .filter((p) => p.isActive)
              .slice()
              .sort((a, b) => {
                if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
                return (a.rankOrder ?? 9999) - (b.rankOrder ?? 9999)
              })
              .map((p) => p._id)
      const results = await Promise.all(
        fanoutIds.map(async (posId) => {
          const data = await api.getAutoRosterPeriodBreakdown(operator._id, periodFrom, periodTo, {
            ...sharedFilters,
            position: [posId],
          })
          const p = allPositions.find((x) => x._id === posId)
          const label = p ? `${p.code} · ${p.name}` : posId
          return { positionId: posId, label, data }
        }),
      )
      setBreakdowns(results)
      setActiveBreakdownIdx(0)
      setHighestStep((prev) => Math.max(prev, 1))
    } catch (e) {
      setBreakdownError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setBreakdownLoading(false)
    }
  }, [operator?._id, periodFrom, periodTo, filterBase, filterPosition, filterAcType, filterCrewGroup, allPositions])

  // Go = commit filter state + land on Manpower Check (where user clicks Analyze
  // to actually fetch the breakdown). Panel collapses via FilterGoButton.
  const handleGo = useCallback(() => {
    commitFilter()
    setActive('manpower')
    setHighestStep((prev) => Math.max(prev, 1))
  }, [commitFilter])

  const navigate = useCallback((to: ActiveKey) => {
    if (to !== 'history') {
      const toNum = STEPS.find((s) => s.key === to)?.num
      if (toNum) setHighestStep((prev) => Math.max(prev, toNum))
    }
    setActive(to)
  }, [])

  function connectSSE(runId: string) {
    if (esRef.current) esRef.current.close()
    const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002').replace(/\/$/, '')
    const token = typeof window !== 'undefined' ? (localStorage.getItem('skyhub.accessToken') ?? '') : ''
    const es = new EventSource(
      `${base}/auto-roster/${encodeURIComponent(runId)}/stream?token=${encodeURIComponent(token)}`,
    )
    esRef.current = es

    es.addEventListener('progress', (e) => {
      try {
        const d = JSON.parse(e.data) as { pct: number; message: string }
        setProgress({ pct: d.pct ?? 0, message: d.message ?? 'Solving…' })
      } catch {
        /* ignore */
      }
    })
    es.addEventListener('solution', () => {
      setPhase('completed')
      setProgress({ pct: 100, message: 'Assignments committed' })
      es.close()
      void api.getAutoRosterRun(runId).then((run) => {
        setResultRun(run)
        setHistory((prev) => [run, ...prev.filter((r) => r._id !== runId)])
        setHighestStep((prev) => Math.max(prev, 4))
        setActive('review')
      })
    })
    es.addEventListener('error', (e) => {
      let msg = 'Solver error'
      try {
        msg = (JSON.parse((e as MessageEvent).data) as { message: string }).message
      } catch {
        /* ignore */
      }
      setPhase('failed')
      setError(msg)
      es.close()
      void loadHistory()
    })
  }

  const handleRun = useCallback(async () => {
    if (!operator?._id || !periodFrom || !periodTo) return
    if (mode === 'training') return // scaffolded — not implemented
    setError(null)
    setResultRun(null)
    setPhase('running')
    setProgress({ pct: 0, message: 'Starting…' })
    try {
      if (mode === 'clear') {
        await api.bulkDeleteAssignments({ periodFrom, periodTo })
        setPhase('completed')
        setProgress({ pct: 100, message: 'Schedule cleared' })
        void loadHistory()
        return
      }
      const oneOrUndef = (arr: string[]) => (arr.length === 1 ? arr[0] : undefined)
      const manyOrUndef = (arr: string[]) => (arr.length > 0 ? arr : undefined)
      const { runId } = await api.startAutoRoster({
        operatorId: operator._id,
        periodFrom,
        periodTo,
        mode,
        longDutiesMinDays: mode === 'longDuties' ? longDutiesMinDays : undefined,
        base: oneOrUndef(filterBase),
        position: oneOrUndef(filterPosition),
        acType: manyOrUndef(filterAcType),
        crewGroup: manyOrUndef(filterCrewGroup),
      })
      setActiveRunId(runId)
      connectSSE(runId)
      void loadHistory()
    } catch (err) {
      setPhase('failed')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [
    operator?._id,
    periodFrom,
    periodTo,
    mode,
    longDutiesMinDays,
    filterBase,
    filterPosition,
    filterAcType,
    filterCrewGroup,
    loadHistory,
  ])

  const handleCancel = useCallback(async () => {
    if (!activeRunId) return
    esRef.current?.close()
    try {
      await api.cancelAutoRoster(activeRunId)
    } catch {
      /* ignore */
    }
    setPhase('cancelled')
    setActiveRunId(null)
    void loadHistory()
  }, [activeRunId, loadHistory])

  if (!operator?._id) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-hz-text-secondary" />
      </div>
    )
  }

  const glassBg = isDark ? 'rgba(25,25,33,0.55)' : 'rgba(255,255,255,0.60)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const panelStyle: React.CSSProperties = {
    background: glassBg,
    border: `1px solid ${glassBorder}`,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.22)' : '0 8px 24px rgba(96,97,112,0.10)',
  }

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <AutoRosterFilterPanel
          periodFrom={periodFrom}
          periodTo={periodTo}
          onPeriodFrom={setPeriodFrom}
          onPeriodTo={setPeriodTo}
          filterBase={filterBase}
          filterPosition={filterPosition}
          filterAcType={filterAcType}
          filterCrewGroup={filterCrewGroup}
          onFilterBase={setFilterBase}
          onFilterPosition={setFilterPosition}
          onFilterAcType={setFilterAcType}
          onFilterCrewGroup={setFilterCrewGroup}
          onGo={handleGo}
          loading={breakdownLoading}
        />
      </div>

      <div className="flex-1 min-w-0 rounded-2xl overflow-hidden flex flex-col" style={panelStyle}>
        <Center
          active={active}
          config={config}
          onConfigChange={setConfig}
          history={history}
          historyLoading={historyLoading}
          onRefreshHistory={loadHistory}
          periodFrom={periodFrom}
          periodTo={periodTo}
          committed={committed}
          breakdown={breakdown}
          breakdowns={breakdowns}
          activeBreakdownIdx={activeBreakdownIdx}
          onSelectBreakdown={setActiveBreakdownIdx}
          breakdownLoading={breakdownLoading}
          breakdownError={breakdownError}
          onAnalyze={handleAnalyze}
          mode={mode}
          onModeChange={setMode}
          longDutiesMinDays={longDutiesMinDays}
          onLongDutiesMinDaysChange={setLongDutiesMinDays}
          phase={phase}
          progress={progress}
          resultRun={resultRun}
          error={error}
          onDismissError={() => setError(null)}
          onRun={handleRun}
          onCancel={handleCancel}
          onNavigate={navigate}
          highestStep={highestStep}
          isDark={isDark}
          accent={accent}
          palette={palette}
        />
      </div>
    </div>
  )
}

// ── Center: Stepper + Step body ───────────────────────────────────────────────

function Center({
  active,
  config,
  onConfigChange,
  history,
  historyLoading,
  onRefreshHistory,
  periodFrom,
  periodTo,
  committed,
  breakdown,
  breakdowns,
  activeBreakdownIdx,
  onSelectBreakdown,
  breakdownLoading,
  breakdownError,
  onAnalyze,
  mode,
  onModeChange,
  longDutiesMinDays,
  onLongDutiesMinDaysChange,
  phase,
  progress,
  resultRun,
  error,
  onDismissError,
  onRun,
  onCancel,
  onNavigate,
  highestStep,
  isDark,
  accent,
  palette,
}: {
  active: ActiveKey
  config: OperatorSchedulingConfig | null
  onConfigChange: (cfg: OperatorSchedulingConfig) => void
  history: AutoRosterRun[]
  historyLoading: boolean
  onRefreshHistory: () => void
  periodFrom: string
  periodTo: string
  committed: boolean
  breakdown: PeriodBreakdown | null
  breakdowns: Array<{ positionId: string | null; label: string; data: PeriodBreakdown }>
  activeBreakdownIdx: number
  onSelectBreakdown: (idx: number) => void
  breakdownLoading: boolean
  breakdownError: string | null
  onAnalyze: () => void
  mode: AssignmentMode
  onModeChange: (m: AssignmentMode) => void
  longDutiesMinDays: number
  onLongDutiesMinDaysChange: (v: number) => void
  phase: RunPhase
  progress: { pct: number; message: string }
  resultRun: AutoRosterRun | null
  error: string | null
  onDismissError: () => void
  onRun: () => void
  onCancel: () => void
  onNavigate: (to: ActiveKey) => void
  highestStep: number
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const isHistory = active === 'history'
  const step = STEPS.find((s) => s.key === active)
  const sectionKey: HeroKey = isHistory ? 'history' : (step?.key ?? 'manpower')
  const sectionTitle = isHistory ? 'Run History' : (step?.label ?? '')
  const sectionDesc = isHistory
    ? 'Past auto-roster runs — inspect duration, coverage, and outcomes.'
    : (step?.desc ?? '')
  const eyebrow = isHistory ? 'Run History' : `Step ${step?.num ?? 1} of ${STEPS.length}`

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero header — modern gradient + SVG per step */}
      <div className="px-6 pt-4 pb-0 shrink-0">
        <SectionHero
          variant={sectionKey}
          eyebrow={eyebrow}
          title={sectionTitle}
          caption={sectionDesc}
          accent={accent}
          isDark={isDark}
          trailing={
            isHistory ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRefreshHistory}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium text-hz-text-tertiary hover:opacity-70 transition-opacity"
                >
                  <RefreshCw size={13} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('manpower')}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium"
                  style={{ color: accent }}
                >
                  ← Back to Steps
                </button>
              </div>
            ) : null
          }
        />
      </div>

      {/* Horizontal stepper */}
      {!isHistory && (
        <Stepper active={active as StepKey} highestStep={highestStep} onNavigate={onNavigate} isDark={isDark} />
      )}

      {/* Error banner */}
      {error && (
        <div
          className="mx-6 mt-3 px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3"
          style={{
            borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fecaca',
            backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2',
            color: '#EF4444',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="text-[13px]">{error}</span>
          </div>
          <button type="button" onClick={onDismissError} className="text-[13px] text-hz-text-tertiary shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Step body */}
      <div className="flex-1 overflow-y-auto">
        {active === 'manpower' && (
          <ManpowerBody
            periodFrom={periodFrom}
            periodTo={periodTo}
            committed={committed}
            breakdowns={breakdowns}
            activeBreakdownIdx={activeBreakdownIdx}
            onSelectBreakdown={onSelectBreakdown}
            breakdownLoading={breakdownLoading}
            breakdownError={breakdownError}
            onAnalyze={onAnalyze}
            isDark={isDark}
            accent={accent}
            palette={palette}
          />
        )}
        {active === 'analysis' && (
          <AnalysisBody
            config={config}
            onConfigChange={onConfigChange}
            onNavigate={onNavigate}
            isDark={isDark}
            accent={accent}
            palette={palette}
          />
        )}
        {active === 'generate' && (
          <GenerateBody
            mode={mode}
            onModeChange={onModeChange}
            longDutiesMinDays={longDutiesMinDays}
            onLongDutiesMinDaysChange={onLongDutiesMinDaysChange}
            phase={phase}
            progress={progress}
            onRun={onRun}
            onCancel={onCancel}
            onNavigate={onNavigate}
            isDark={isDark}
            accent={accent}
            palette={palette}
          />
        )}
        {active === 'review' && (
          <ReviewBody resultRun={resultRun} onNavigate={onNavigate} isDark={isDark} accent={accent} palette={palette} />
        )}
        {active === 'history' && (
          <HistoryBody history={history} loading={historyLoading} isDark={isDark} accent={accent} />
        )}
      </div>
    </div>
  )
}

// ── Section Hero ──────────────────────────────────────────────────────────────

type HeroKey = StepKey | 'history'

function SectionHero({
  variant,
  eyebrow,
  title,
  caption,
  accent,
  isDark,
  trailing,
}: {
  variant: HeroKey
  eyebrow: string
  title: string
  caption: string
  accent: string
  isDark: boolean
  trailing?: React.ReactNode
}) {
  const HERO_HEIGHT = 132
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{
        height: HERO_HEIGHT,
        background: isDark
          ? `linear-gradient(135deg, ${accent}12 0%, ${accent}04 45%, rgba(25,25,33,0.2) 100%)`
          : `linear-gradient(135deg, ${accent}0D 0%, ${accent}04 45%, rgba(255,255,255,0.2) 100%)`,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
      }}
    >
      {/* Radial glow bottom-right — very subtle */}
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          right: -80,
          bottom: -80,
          width: 220,
          height: 220,
          background: `radial-gradient(circle, ${accent}14 0%, transparent 65%)`,
          filter: 'blur(28px)',
        }}
      />
      {/* Fine grid overlay — faint */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at right, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at right, black 0%, transparent 75%)',
        }}
      />

      {/* Per-variant SVG illustration on the right */}
      <HeroArt variant={variant} accent={accent} isDark={isDark} />

      {/* Trailing actions (top-right) */}
      {trailing && <div className="absolute top-3 right-4 z-10">{trailing}</div>}

      {/* Title block */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 max-w-[55%]">
        <div className="text-[13px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: accent }}>
          {eyebrow}
        </div>
        <h1
          className="text-[22px] font-bold tracking-tight leading-tight mb-1"
          style={{ color: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.95)' }}
        >
          {title}
        </h1>
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(71,85,105,0.80)' }}
        >
          {caption}
        </p>
      </div>
    </div>
  )
}

function HeroArt({ variant, accent, isDark }: { variant: HeroKey; accent: string; isDark: boolean }) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const body = isDark ? '#13131A' : '#FAFAFC'
  const common = {
    className: 'absolute right-6 top-1/2 -translate-y-1/2',
    viewBox: '0 0 240 110',
    width: 240,
    height: 110,
    'aria-hidden': true,
  } as const

  if (variant === 'manpower') {
    // Rows of crew avatars + demand bars — "supply vs demand"
    return (
      <svg {...common}>
        {/* Crew roster column */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(22 ${14 + i * 22})`}>
            <circle r="8" fill={`${accent}22`} stroke={accent} strokeWidth="1.2" />
            <circle r="3" cx="0" cy="-2" fill={accent} opacity="0.7" />
            <path d="M -5 5 Q 0 0 5 5 Z" fill={accent} opacity="0.5" />
            <rect x="14" y="-3" width={40 + i * 8} height="6" rx="2" fill={`${accent}55`} />
          </g>
        ))}
        {/* Arrow */}
        <path d="M 108 54 L 134 54" stroke={accent} strokeWidth="1.5" strokeDasharray="3 3" />
        <polygon points="134,50 142,54 134,58" fill={accent} />
        {/* Demand bars — faint, matches chart palette */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={150 + i * 14}
            y={70 - i * 10}
            width="10"
            height={30 + i * 10}
            fill={i >= 3 ? '#F43F5E' : accent}
            opacity={i >= 3 ? 0.42 : 0.32}
            rx="1.5"
          />
        ))}
        <line x1="148" y1="102" x2="222" y2="102" stroke={dim} strokeWidth="0.8" opacity="0.6" />
      </svg>
    )
  }

  if (variant === 'analysis') {
    // Rule chips → bar meter (priorities)
    return (
      <svg {...common}>
        {['FDTL', 'DAYS OFF', 'STANDBY', 'FAIRNESS'].map((t, i) => (
          <g key={t} transform={`translate(14 ${10 + i * 22})`}>
            <rect x="0" y="-7" width="72" height="14" rx="4" fill={`${accent}15`} stroke={accent} strokeWidth="0.8" />
            <circle cx="10" cy="0" r="3" fill={accent} />
            <text x="20" y="3" fontSize="8" fontWeight="700" fontFamily="system-ui" fill={accent}>
              {t}
            </text>
          </g>
        ))}
        {['P1', 'P2', 'P3', 'P4'].map((p, i) => (
          <g key={p} transform={`translate(104 ${10 + i * 22})`}>
            <text x="-3" y="3" fontSize="8" textAnchor="end" fontWeight="700" fill={accent} fontFamily="system-ui">
              {p}
            </text>
            <rect
              x="2"
              y="-5"
              width="110"
              height="10"
              rx="3"
              fill={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            />
            <rect x="2" y="-5" width={[96, 72, 52, 32][i]} height="10" rx="3" fill={accent} opacity={0.85 - i * 0.15} />
          </g>
        ))}
      </svg>
    )
  }

  if (variant === 'generate') {
    // Optimizer node with spinning dots + output bars
    return (
      <svg {...common}>
        <g transform="translate(70 55)">
          <circle r="32" fill={body} stroke={accent} strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2
            return (
              <circle
                key={i}
                cx={Math.cos(a) * 22}
                cy={Math.sin(a) * 22}
                r="2.2"
                fill={`${accent}${i < 4 ? 'CC' : '55'}`}
              />
            )
          })}
          <circle r="8" fill="none" stroke={accent} strokeWidth="1.5" />
          <circle r="2.5" fill={accent} />
          <text y="46" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="system-ui" fill={accent}>
            CP-SAT
          </text>
        </g>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={150 + i * 14}
            y={30 + i * 6}
            width="10"
            height={40 + (i % 2) * 14}
            fill={accent}
            opacity={0.75 - i * 0.1}
            rx="1.5"
          />
        ))}
        <path d="M 108 55 L 140 55" stroke={accent} strokeWidth="1.3" strokeDasharray="2 2" />
        <polygon points="140,51 148,55 140,59" fill={accent} />
      </svg>
    )
  }

  if (variant === 'review') {
    // Check + rows + stat pill
    return (
      <svg {...common}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(20 ${16 + i * 20})`}>
            <rect
              x="0"
              y="-6"
              width="120"
              height="12"
              rx="3"
              fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
            />
            <rect x="0" y="-6" width={80 + i * 8} height="12" rx="3" fill={accent} opacity={0.55 - i * 0.08} />
            <circle cx="128" cy="0" r="5" fill="#06C270" />
            <polyline
              points="125,0 127.5,2.5 131,-2"
              stroke="#fff"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        ))}
        <g transform="translate(168 40)">
          <rect x="0" y="0" width="60" height="40" rx="8" fill={`${accent}22`} stroke={accent} strokeWidth="1" />
          <text x="30" y="18" textAnchor="middle" fontSize="18" fontWeight="800" fontFamily="system-ui" fill={accent}>
            4/5
          </text>
          <text x="30" y="32" textAnchor="middle" fontSize="8" fontFamily="system-ui" fill={dim}>
            covered
          </text>
        </g>
      </svg>
    )
  }

  // history
  return (
    <svg {...common}>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(20 ${14 + i * 18})`}>
          <circle cx="0" cy="0" r="3.5" fill={accent} opacity={1 - i * 0.15} />
          <rect x="12" y="-3" width="160" height="6" rx="2" fill={`${accent}${['99', '77', '55', '33', '22'][i]}`} />
          <rect
            x="178"
            y="-4"
            width="32"
            height="8"
            rx="2"
            fill={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
          />
        </g>
      ))}
      <line x1="-2" y1="4" x2="-2" y2="94" stroke={`${accent}55`} strokeWidth="1.5" />
    </svg>
  )
}

// ── Horizontal Stepper ────────────────────────────────────────────────────────

function Stepper({
  active,
  highestStep,
  onNavigate,
  isDark,
}: {
  active: StepKey
  highestStep: number
  onNavigate: (to: ActiveKey) => void
  isDark: boolean
}) {
  // Neutral palette — works in light + dark, no module accent.
  const filledBg = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.88)'
  const filledFg = isDark ? 'rgba(15,23,42,0.92)' : '#FFFFFF'
  const idleBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.20)'
  const idleFg = isDark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.45)'
  const activeText = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.92)'
  const reachedText = isDark ? 'rgba(255,255,255,0.80)' : 'rgba(15,23,42,0.80)'
  const connectorOn = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const connectorOff = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  return (
    <div
      className="px-6 pt-5 pb-4 shrink-0 border-b"
      style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const completed = step.num < highestStep
          const isActive = active === step.key
          const reached = completed || isActive
          const Icon = step.icon
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => onNavigate(step.key)}
                className="group flex items-center gap-2.5 min-w-0 cursor-pointer"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold border-2 shrink-0 transition-all"
                  style={{
                    background: reached ? filledBg : 'transparent',
                    borderColor: reached ? filledBg : idleBorder,
                    color: reached ? filledFg : idleFg,
                  }}
                >
                  {completed ? <Check size={14} strokeWidth={2.5} /> : step.num}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} color={isActive ? activeText : reached ? reachedText : idleFg} strokeWidth={1.8} />
                    <span
                      className="text-[13px] font-semibold leading-none"
                      style={{
                        color: isActive ? activeText : reached ? reachedText : idleFg,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-3"
                  style={{ background: step.num < highestStep ? connectorOn : connectorOff }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 1: Manpower Check ────────────────────────────────────────────────────

function ManpowerBody({
  periodFrom,
  periodTo,
  committed,
  breakdowns,
  activeBreakdownIdx,
  onSelectBreakdown,
  breakdownLoading,
  breakdownError,
  onAnalyze,
  isDark,
  accent,
  palette,
}: {
  periodFrom: string
  periodTo: string
  committed: boolean
  breakdowns: Array<{ positionId: string | null; label: string; data: PeriodBreakdown }>
  activeBreakdownIdx: number
  onSelectBreakdown: (idx: number) => void
  breakdownLoading: boolean
  breakdownError: string | null
  onAnalyze: () => void
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const breakdown: PeriodBreakdown | null = breakdowns[activeBreakdownIdx]?.data ?? null
  const canAnalyze = committed && !!periodFrom && !!periodTo && !breakdownLoading
  const [showStats, setShowStats] = useState(false)
  const activeLabel = breakdowns[activeBreakdownIdx]?.label ?? ''

  return (
    <div className="px-6 py-6 flex flex-col gap-5 h-full min-h-0">
      {/* Top action bar — position tabs left, Show Statistics + Analyze right */}
      <div className="flex items-center justify-between gap-3 pb-1 shrink-0">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {breakdowns.length > 1 &&
            !breakdownLoading &&
            breakdowns.map((b, idx) => {
              const isActive = idx === activeBreakdownIdx
              return (
                <button
                  key={b.positionId ?? idx}
                  type="button"
                  onClick={() => onSelectBreakdown(idx)}
                  className="h-8 px-3 rounded-lg text-[13px] font-medium transition-colors"
                  style={{
                    background: isActive ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') : 'transparent',
                    color: isActive
                      ? isDark
                        ? 'rgba(255,255,255,0.92)'
                        : 'rgba(15,23,42,0.92)'
                      : isDark
                        ? 'rgba(255,255,255,0.55)'
                        : 'rgba(0,0,0,0.55)',
                    border: `1px solid ${
                      isActive ? (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)') : 'transparent'
                    }`,
                  }}
                >
                  {b.label}
                </button>
              )
            })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {breakdown && (
            <button
              type="button"
              onClick={() => setShowStats(true)}
              className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-semibold border transition-colors"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
                color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)',
                background: 'transparent',
              }}
            >
              <TableIcon size={13} /> Show Statistics
            </button>
          )}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className="flex items-center gap-2 px-5 h-9 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity shrink-0"
            style={{ backgroundColor: accent }}
          >
            {breakdownLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Analyzing…
              </>
            ) : breakdown ? (
              <>
                <RefreshCw size={13} /> Re-analyze
              </>
            ) : (
              <>
                <BarChart3 size={13} /> Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {showStats && breakdown && (
        <StatisticsDialog
          data={breakdown}
          contextLabel={activeLabel}
          onClose={() => setShowStats(false)}
          isDark={isDark}
        />
      )}

      {breakdownError && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px]"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
        >
          <AlertTriangle size={13} className="shrink-0" />
          <span className="flex-1">{breakdownError}</span>
          <button type="button" onClick={onAnalyze} className="font-semibold underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {breakdownLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: accent }} />
          <p className="text-[13px] text-hz-text-secondary">Running crew requirements projection…</p>
        </div>
      )}

      {breakdown && !breakdownLoading && (
        <div className="flex-1 min-h-0">
          <ManpowerChart data={breakdown} isDark={isDark} accent={accent} palette={palette} />
        </div>
      )}

      {!breakdown && !breakdownLoading && !breakdownError && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <BarChart3 size={32} style={{ color: palette.textTertiary, opacity: 0.4 }} />
          <p className="text-[13px] text-hz-text-tertiary max-w-xs">
            {!committed
              ? 'Pick a period and filters, then click Go in the left panel.'
              : 'Click Analyze to project crew requirements for the selected scope.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Manpower Chart (AIMS-style stacked bar) ───────────────────────────────────

// Stack order: bottom → top. Each segment resolves its per-day value from the
// DayBreakdown row; Open Flight Duties uses `seatsDemand` (pairing side).
interface ChartSegment {
  key: string
  label: string
  color: (accent: string) => string
  value: (d: DayBreakdown) => number
}
// Premium palette — Tailwind v3 500/400 anchors. Cohesive, pastel-leaning,
// still distinguishable across 8 slots. Red/orange tamed vs previous pure hex.
const CHART_SEGMENTS: ChartSegment[] = [
  { key: 'preAssigned', label: 'Pre-Assigned', color: () => '#8B5CF6', value: (d) => d.assigned }, // violet-500
  { key: 'training', label: 'Training', color: () => '#0EA5E9', value: (d) => d.inTraining }, // sky-500
  { key: 'groundDuty', label: 'Ground Duty', color: () => '#F472B6', value: (d) => d.onGroundDuty ?? 0 }, // pink-400
  { key: 'openDuties', label: 'Open Flight Duties', color: () => '#F43F5E', value: (d) => d.seatsDemand ?? 0 }, // rose-500
  { key: 'standbyHome', label: 'Home Standby', color: () => '#22D3EE', value: (d) => d.onStandbyHome ?? 0 }, // cyan-400
  { key: 'standbyAirport', label: 'Airport Standby', color: () => '#10B981', value: (d) => d.onStandbyAirport ?? 0 }, // emerald-500
  { key: 'dayOff', label: 'Day Off', color: () => '#94A3B8', value: (d) => d.onDayOff }, // slate-400
  { key: 'leave', label: 'Leave', color: () => '#F59E0B', value: (d) => d.onLeave }, // amber-500
]

interface ChartHover {
  label: string
  value: number
  color: string
  x: number
  y: number
}

function ChartTooltip({ hover, isDark }: { hover: ChartHover; isDark: boolean }) {
  // SkyHub tooltip: inverted-contrast surface, 4px radius, 13px text, level-03 shadow.
  const bg = isDark ? 'rgba(245,242,253,0.96)' : '#1C1C28'
  const fg = isDark ? '#1C1C28' : '#FFFFFF'
  const shadow = isDark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 8px 24px rgba(96,97,112,0.30)'

  // Clamp to viewport — tooltip may overflow right/bottom edges. Measure after
  // mount and flip to the opposite side of the cursor when needed.
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: hover.x + 14,
    top: hover.y - 32,
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 8
    let left = hover.x + 14
    let top = hover.y - 32
    if (left + rect.width + margin > vw) left = hover.x - rect.width - 14
    if (left < margin) left = margin
    if (top + rect.height + margin > vh) top = hover.y - rect.height - 12
    if (top < margin) top = margin
    setPos({ left, top })
  }, [hover.x, hover.y, hover.label, hover.value])

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-9999"
      style={{
        left: pos.left,
        top: pos.top,
        background: bg,
        color: fg,
        borderRadius: 4,
        padding: '6px 10px',
        boxShadow: shadow,
        minHeight: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: hover.color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{hover.label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {hover.value.toLocaleString()}
      </span>
    </div>
  )
}

// ── Statistics Dialog ────────────────────────────────────────────────────────

function StatisticsDialog({
  data,
  contextLabel,
  onClose,
  isDark,
}: {
  data: PeriodBreakdown
  contextLabel: string
  onClose: () => void
  isDark: boolean
}) {
  const panelBg = isDark ? '#191921' : '#FFFFFF'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const rowAlt = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.015)'
  const textMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'

  // Row labels mirror CHART_SEGMENTS. Total row appended at the bottom.
  const rows = [
    ...CHART_SEGMENTS.map((seg) => ({ key: seg.key, label: seg.label, color: seg.color(''), value: seg.value })),
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-9999 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: panelBg,
          border: `1px solid ${borderCol}`,
          width: 'min(92vw, 1200px)',
          maxHeight: '82vh',
          boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.55)' : '0 24px 60px rgba(96,97,112,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${borderCol}` }}
        >
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-hz-text">Activity Statistics</div>
            <p className="text-[13px] text-hz-text-secondary mt-0.5 truncate">
              Crew by activity type per day{contextLabel ? ` · ${contextLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-hz-border/30 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="border-collapse" style={{ fontSize: 13, borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10" style={{ background: panelBg }}>
              <tr>
                <th
                  className="text-left sticky left-0 z-20"
                  style={{
                    background: panelBg,
                    minWidth: 168,
                    width: 168,
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: textMuted,
                    borderBottom: `1px solid ${borderCol}`,
                    borderRight: `1px solid ${borderCol}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Activity
                </th>
                {data.days.map((day) => (
                  <th
                    key={day.date}
                    style={{
                      minWidth: 42,
                      width: 42,
                      padding: '6px 4px',
                      textAlign: 'center',
                      borderBottom: `1px solid ${borderCol}`,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.1,
                    }}
                  >
                    <div style={{ color: textMuted, fontSize: 11, fontWeight: 600 }}>{day.dayOfWeek}</div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: textMuted,
                        fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
                      }}
                    >
                      {day.date.slice(8)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                const rowBg = rIdx % 2 ? rowAlt : 'transparent'
                return (
                  <tr key={row.key} style={{ background: rowBg }}>
                    <td
                      className="sticky left-0"
                      style={{
                        background: panelBg,
                        padding: '6px 12px',
                        borderRight: `1px solid ${borderCol}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }} className="text-hz-text">
                          {row.label}
                        </span>
                      </div>
                    </td>
                    {data.days.map((day) => {
                      const v = row.value(day)
                      return (
                        <td
                          key={day.date}
                          style={{
                            padding: '6px 4px',
                            textAlign: 'center',
                            color: v > 0 ? undefined : textMuted,
                            fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {v > 0 ? v : '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {/* Total row */}
              <tr style={{ borderTop: `1px solid ${borderCol}` }}>
                <td
                  className="sticky left-0"
                  style={{
                    background: panelBg,
                    padding: '8px 12px',
                    borderTop: `1px solid ${borderCol}`,
                    borderRight: `1px solid ${borderCol}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                    className="text-hz-text"
                  >
                    Total
                  </span>
                </td>
                {data.days.map((day) => {
                  const v = CHART_SEGMENTS.reduce((s, seg) => s + seg.value(day), 0)
                  return (
                    <td
                      key={day.date}
                      style={{
                        padding: '8px 4px',
                        textAlign: 'center',
                        fontWeight: 700,
                        borderTop: `1px solid ${borderCol}`,
                        fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {v}
                    </td>
                  )
                })}
              </tr>
              {/* Qualified crew (reference) */}
              <tr>
                <td
                  className="sticky left-0"
                  style={{
                    background: panelBg,
                    padding: '6px 12px',
                    borderRight: `1px solid ${borderCol}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FDDD48', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }} className="text-hz-text">
                      Qualified crew
                    </span>
                  </div>
                </td>
                {data.days.map((day) => (
                  <td
                    key={day.date}
                    style={{
                      padding: '6px 4px',
                      textAlign: 'center',
                      color: textMuted,
                      fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {data.crewTotal}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-2.5 shrink-0"
          style={{ borderTop: `1px solid ${borderCol}` }}
        >
          <span className="text-[13px]" style={{ color: textMuted }}>
            {data.days.length} days · {CHART_SEGMENTS.length} activity types
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-3 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ManpowerChart({
  data,
  isDark,
  accent,
  palette,
}: {
  data: PeriodBreakdown
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const [hover, setHover] = useState<ChartHover | null>(null)

  // Measured container — chart fills whatever height the parent gives it.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 800, h: 240 })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect
      setDims({ w: Math.max(300, cr.width), h: Math.max(140, cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const LEGEND_H = 38 // reserved for legend row below SVG
  const W = dims.w
  const H = Math.max(140, dims.h - LEGEND_H)
  const PL = 52
  const PR = 16
  const PT = 16
  const PB = 48
  const plotW = W - PL - PR
  const plotH = H - PT - PB

  // Single stacked bar per day — sum of all segments (see CHART_SEGMENTS order).
  const maxBarVal = Math.max(...data.days.map((d) => CHART_SEGMENTS.reduce((sum, seg) => sum + seg.value(d), 0)), 1)
  const maxY = Math.max(data.crewTotal, maxBarVal, 4)
  const yScale = plotH / maxY
  const slotW = plotW / Math.max(data.days.length, 1)
  const barW = Math.max(4, Math.min(34, slotW * 0.78))
  const barRadius = Math.min(barW / 2, 5)

  const toY = (v: number) => PT + plotH - v * yScale
  const toX = (i: number) => PL + i * slotW + (slotW - barW) / 2

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'
  const axisColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
  const labelColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.38)'

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxY))
  const showDayLabel = (i: number) => data.days.length <= 16 || i % 2 === 0

  return (
    <div
      ref={wrapRef}
      className="rounded-xl overflow-hidden relative flex flex-col h-full min-h-0"
      style={{
        background: isDark
          ? 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)'
          : 'linear-gradient(180deg, rgba(15,23,42,0.025) 0%, rgba(15,23,42,0.005) 100%)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
      }}
    >
      {hover && <ChartTooltip hover={hover} isDark={isDark} />}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', width: '100%', height: H }}>
        <defs>
          {/* Soft top-to-bottom gradient per segment — lighter crown, firm core. */}
          {CHART_SEGMENTS.map((seg) => {
            const c = seg.color(accent)
            return (
              <linearGradient key={seg.key} id={`bar-grad-${seg.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.55" />
                <stop offset="55%" stopColor={c} stopOpacity="0.82" />
                <stop offset="100%" stopColor={c} stopOpacity="0.95" />
              </linearGradient>
            )
          })}
          {/* Glass highlight — thin white sheen at top of each stack. */}
          <linearGradient id="bar-glass-highlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          {/* Inner shadow at base — grounds stacks on axis. */}
          <linearGradient id="bar-base-shadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity={isDark ? 0.35 : 0.18} />
          </linearGradient>
          {/* Per-day rounded-top clip so each day's stack reads as one shape. */}
          {data.days.map((day, i) => {
            const x = toX(i)
            const total = CHART_SEGMENTS.reduce((s, seg) => s + seg.value(day), 0)
            if (total <= 0) return null
            const yTop = toY(total)
            const yBot = toY(0)
            const r = Math.min(barRadius, (yBot - yTop) / 2)
            return (
              <clipPath key={day.date} id={`day-clip-${i}`}>
                <path
                  d={
                    `M ${x} ${yBot} ` +
                    `L ${x} ${yTop + r} ` +
                    `Q ${x} ${yTop} ${x + r} ${yTop} ` +
                    `L ${x + barW - r} ${yTop} ` +
                    `Q ${x + barW} ${yTop} ${x + barW} ${yTop + r} ` +
                    `L ${x + barW} ${yBot} Z`
                  }
                />
              </clipPath>
            )
          })}
          {/* Soft drop shadow for each stack. */}
          <filter id="bar-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity={isDark ? 0.45 : 0.18} />
          </filter>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PL}
              y1={toY(v)}
              x2={W - PR}
              y2={toY(v)}
              stroke={v === 0 ? axisColor : gridColor}
              strokeWidth={v === 0 ? 1 : 0.5}
            />
            <text
              x={PL - 8}
              y={toY(v) + 4}
              textAnchor="end"
              fontSize={13}
              fontWeight={500}
              fontFamily="system-ui"
              fill={labelColor}
            >
              {v}
            </text>
          </g>
        ))}

        {data.days.map((day, i) => {
          let cumulative = 0
          const x = toX(i)
          const total = CHART_SEGMENTS.reduce((s, seg) => s + seg.value(day), 0)
          if (total <= 0) return <g key={day.date} />
          const yTop = toY(total)
          const yBot = toY(0)
          return (
            <g key={day.date} filter="url(#bar-shadow)">
              <g clipPath={`url(#day-clip-${i})`}>
                {CHART_SEGMENTS.map((seg) => {
                  const val = seg.value(day)
                  if (val <= 0) return null
                  const segH = val * yScale
                  const y = toY(cumulative + val)
                  cumulative += val
                  const fill = seg.color(accent)
                  return (
                    <rect
                      key={seg.key}
                      x={x}
                      y={y - 0.5}
                      width={barW}
                      height={segH + 1}
                      fill={`url(#bar-grad-${seg.key})`}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) =>
                        setHover({
                          label: seg.label,
                          value: val,
                          color: fill,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : null))}
                      onMouseLeave={() => setHover(null)}
                    />
                  )
                })}
                {/* Glass sheen on top ~18% of stack */}
                <rect
                  x={x}
                  y={yTop}
                  width={barW}
                  height={Math.min(18, (yBot - yTop) * 0.22)}
                  fill="url(#bar-glass-highlight)"
                  pointerEvents="none"
                />
                {/* Base grounding shadow */}
                <rect x={x} y={yBot - 6} width={barW} height={6} fill="url(#bar-base-shadow)" pointerEvents="none" />
              </g>
              {/* Outer 1px stroke for crisp silhouette */}
              <rect
                x={x + 0.5}
                y={yTop + 0.5}
                width={barW - 1}
                height={yBot - yTop - 0.5}
                fill="none"
                rx={barRadius}
                ry={barRadius}
                stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                strokeWidth="0.8"
                pointerEvents="none"
              />
            </g>
          )
        })}

        <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke={axisColor} strokeWidth={1} />

        {/* Qualified-crew reference line — drawn last so it sits on top of bars. */}
        {data.crewTotal > 0 &&
          (() => {
            const y = toY(data.crewTotal)
            const borderColor = isDark ? '#0E0E14' : 'rgba(15,23,42,0.85)'
            return (
              <g style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={borderColor} strokeWidth={6} strokeLinecap="round" />
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#FDDD48" strokeWidth={3} strokeLinecap="round" />
                <g>
                  <rect x={W - PR - 108} y={y - 26} width={104} height={22} rx={4} fill={borderColor} />
                  <text
                    x={W - PR - 56}
                    y={y - 11}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={700}
                    fontFamily="'Inter', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif"
                    fill="#FDDD48"
                  >
                    Total {data.crewTotal}
                  </text>
                </g>
              </g>
            )
          })()}

        {data.days.map((day, i) => {
          if (!showDayLabel(i)) return null
          const cx = PL + i * slotW + slotW / 2
          return (
            <g key={day.date}>
              <text x={cx} y={H - PB + 14} textAnchor="middle" fontSize={8} fontFamily="system-ui" fill={labelColor}>
                {day.dayOfWeek}
              </text>
              <text x={cx} y={H - PB + 26} textAnchor="middle" fontSize={9} fontFamily="system-ui" fill={labelColor}>
                {day.date.slice(8)}
              </text>
            </g>
          )
        })}

        <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke={axisColor} strokeWidth={1} />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-4 pb-3 pt-1">
        {CHART_SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: seg.color(accent) }} />
            <span className="text-[13px]" style={{ color: palette.textTertiary }}>
              {seg.label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <svg width="20" height="12" aria-hidden>
            <line
              x1={1}
              y1={6}
              x2={19}
              y2={6}
              stroke={isDark ? '#0E0E14' : 'rgba(15,23,42,0.85)'}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <line x1={1} y1={6} x2={19} y2={6} stroke="#FDDD48" strokeWidth={3} strokeLinecap="round" />
          </svg>
          <span className="text-[13px]" style={{ color: palette.textTertiary }}>
            Qualified crew
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Roster Analysis ───────────────────────────────────────────────────

interface ObjectiveDef {
  key: string
  label: string
  softOnly?: boolean
}

const DEFAULT_PRIORITY_ORDER = ['coverage', 'blockHours', 'legCount', 'layoverFairness', 'destinationRules']

interface AnalysisDraft {
  carrierMode: 'lcc' | 'legacy'
  minPerPeriodDays: number
  maxPerPeriodDays: number
  maxConsecutiveDutyDays: number
  standbyUsePct: boolean
  standbyMinPct: number
  standbyMinFlat: number
  homeStandbyRatioPct: number
  genderBalanceOnLayovers: boolean
  genderBalanceWeight: number
  priorityOrder: string[]
}

function configToDraft(cfg: OperatorSchedulingConfig | null, visibleKeys: string[]): AnalysisDraft {
  const saved = cfg?.objectives?.priorityOrder ?? []
  const order = [
    ...saved.filter((k) => visibleKeys.includes(k)),
    ...DEFAULT_PRIORITY_ORDER.filter((k) => visibleKeys.includes(k) && !saved.includes(k)),
  ]
  return {
    carrierMode: (cfg?.carrierMode as 'lcc' | 'legacy') ?? 'lcc',
    minPerPeriodDays: cfg?.daysOff?.minPerPeriodDays ?? 8,
    maxPerPeriodDays: cfg?.daysOff?.maxPerPeriodDays ?? 10,
    maxConsecutiveDutyDays: cfg?.daysOff?.maxConsecutiveDutyDays ?? 4,
    standbyUsePct: cfg?.standby?.usePercentage ?? true,
    standbyMinPct: cfg?.standby?.minPerDayPct ?? 10,
    standbyMinFlat: cfg?.standby?.minPerDayFlat ?? 2,
    homeStandbyRatioPct: cfg?.standby?.homeStandbyRatioPct ?? 80,
    genderBalanceOnLayovers: cfg?.objectives?.genderBalanceOnLayovers ?? true,
    genderBalanceWeight: cfg?.objectives?.genderBalanceWeight ?? 80,
    priorityOrder: order,
  }
}

function AnalysisBody({
  config,
  onConfigChange,
  onNavigate,
  isDark,
  accent,
  palette,
}: {
  config: OperatorSchedulingConfig | null
  onConfigChange: (cfg: OperatorSchedulingConfig) => void
  onNavigate: (to: ActiveKey) => void
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const operator = useOperatorStore((s) => s.operator)
  const activeDestRules = config?.destinationRules?.filter((r) => r.enabled).length ?? 0

  const catalogue: Record<string, ObjectiveDef> = {
    coverage: { key: 'coverage', label: 'Flight duty coverage' },
    blockHours: { key: 'blockHours', label: 'Fair distribution of block hours' },
    legCount: { key: 'legCount', label: 'Fair distribution of flight legs' },
    layoverFairness: { key: 'layoverFairness', label: 'Fair distribution of layover duties' },
    destinationRules: {
      key: 'destinationRules',
      label: `Destination rules (${activeDestRules} active)`,
      softOnly: true,
    },
  }

  const [draft, setDraft] = useState<AnalysisDraft>(() => {
    const vis = Object.keys(catalogue).filter((k) => {
      if (k === 'destinationRules') return activeDestRules > 0
      return true
    })
    return configToDraft(config, vis)
  })
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedPulse, setSavedPulse] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Visibility is derived from active dest rules (dest rules hidden when none).
  const visibleKeys = Object.keys(catalogue).filter((k) => {
    if (k === 'destinationRules') return activeDestRules > 0
    return true
  })
  // Prune order to visible items on dest-rule change.
  useEffect(() => {
    setDraft((d) => ({
      ...d,
      priorityOrder: [
        ...d.priorityOrder.filter((k) => visibleKeys.includes(k)),
        ...DEFAULT_PRIORITY_ORDER.filter((k) => visibleKeys.includes(k) && !d.priorityOrder.includes(k)),
      ],
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDestRules])

  // Reset draft when config refreshes from outside.
  useEffect(() => {
    setDraft(configToDraft(config, visibleKeys))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?._id, config?.updatedAt])

  const baseline = configToDraft(config, visibleKeys)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)

  const patch = (p: Partial<AnalysisDraft>) => setDraft((d) => ({ ...d, ...p }))

  function handleDragStart(idx: number, e: React.DragEvent) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(idx: number, e: React.DragEvent) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setDraft((d) => {
      const next = [...d.priorityOrder]
      const [item] = next.splice(dragIdx, 1)
      next.splice(idx, 0, item)
      setDragIdx(idx)
      return { ...d, priorityOrder: next }
    })
  }
  function handleDragEnd() {
    setDragIdx(null)
  }
  function movePriority(idx: number, delta: -1 | 1) {
    const target = idx + delta
    if (target < 0 || target >= draft.priorityOrder.length) return
    setDraft((d) => {
      const next = [...d.priorityOrder]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return { ...d, priorityOrder: next }
    })
  }

  async function handleSave() {
    if (!operator?._id || !dirty || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await api.upsertOperatorSchedulingConfig({
        operatorId: operator._id,
        carrierMode: draft.carrierMode,
        daysOff: {
          minPerPeriodDays: draft.minPerPeriodDays,
          maxPerPeriodDays: draft.maxPerPeriodDays,
          maxConsecutiveDutyDays: draft.maxConsecutiveDutyDays,
        },
        standby: {
          usePercentage: draft.standbyUsePct,
          minPerDayPct: draft.standbyMinPct,
          minPerDayFlat: draft.standbyMinFlat,
          homeStandbyRatioPct: draft.homeStandbyRatioPct,
        },
        objectives: {
          genderBalanceOnLayovers: draft.genderBalanceOnLayovers,
          genderBalanceWeight: draft.genderBalanceWeight,
          priorityOrder: draft.priorityOrder,
        },
      })
      onConfigChange(updated)
      setSavedPulse(true)
      setTimeout(() => setSavedPulse(false), 2400)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const subtle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const rowDivider = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
  const neutralBar = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.22)'
  const neutralFg = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)'
  const neutralTint = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)'
  const neutralActiveBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'
  const neutralActiveFg = isDark ? '#F5F2FD' : '#1C1C28'

  return (
    <div className="px-6 py-6 space-y-5 w-full">
      {/* ── Scheduling config — 2-column grouped sections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Days Off & Duties */}
        <ConfigSection
          icon={CalendarOff}
          title="Days Off & Duties"
          desc="Rest quotas (leave-aware) and duty rotation"
          accent={accent}
          subtle={subtle}
          cardBorder={cardBorder}
        >
          <InlineRow
            label="When days are available, prioritize"
            hint="Day off rests crew first. Standby keeps them available."
            borderTop={false}
            rowDivider={rowDivider}
          >
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
              {(
                [
                  ['legacy', 'Day off'],
                  ['lcc', 'Standby'],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patch({ carrierMode: m })}
                  className="px-3.5 h-9 text-[13px] font-medium transition-colors"
                  style={{
                    background: draft.carrierMode === m ? neutralActiveBg : 'transparent',
                    color: draft.carrierMode === m ? neutralActiveFg : palette.textSecondary,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </InlineRow>
          <InlineRow
            label="Minimum Days Off"
            hint="Floor per crew. Pre-booked leave counts toward it."
            tooltip="Minimum total rest days per crew per period. Includes pre-booked Annual Leave, Sick Leave, and any activity flagged as rest. If leave already meets the floor, solver adds no extra day-offs."
            rowDivider={rowDivider}
          >
            <NumberStepper
              value={draft.minPerPeriodDays}
              onChange={(v) => patch({ minPerPeriodDays: v })}
              min={0}
              max={31}
              suffix="days"
            />
          </InlineRow>
          <InlineRow
            label="Max Rest Days / Period"
            hint="Hard cap. Pre-booked leave counts toward it."
            tooltip="Maximum total rest days per crew per period. Counts pre-booked Annual Leave, Sick Leave, and any rest-flagged activity. If leave alone exceeds this cap, crew row shows amber — solver cannot assign further day-offs, standby fills remaining days."
            rowDivider={rowDivider}
          >
            <NumberStepper
              value={draft.maxPerPeriodDays}
              onChange={(v) => patch({ maxPerPeriodDays: v })}
              min={0}
              max={31}
              suffix="days"
            />
          </InlineRow>
          <InlineRow
            label="Max Consecutive Duties"
            hint="Amber warning after N duty days in a row."
            rowDivider={rowDivider}
          >
            <NumberStepper
              value={draft.maxConsecutiveDutyDays}
              onChange={(v) => patch({ maxConsecutiveDutyDays: v })}
              min={1}
              max={14}
              suffix="days"
            />
          </InlineRow>
        </ConfigSection>

        {/* Standby */}
        <ConfigSection
          icon={Clock}
          title="Standby"
          desc="Quota and coverage rules"
          accent={accent}
          subtle={subtle}
          cardBorder={cardBorder}
        >
          <InlineRow
            label="Standby Quota Mode"
            hint="Percentage of operating crew, or fixed count per day."
            borderTop={false}
            rowDivider={rowDivider}
          >
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
              {(
                [
                  ['pct', 'Percentage', true],
                  ['flat', 'Flat count', false],
                ] as const
              ).map(([k, l, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => patch({ standbyUsePct: v })}
                  className="px-3.5 h-9 text-[13px] font-medium transition-colors"
                  style={{
                    background: draft.standbyUsePct === v ? neutralActiveBg : 'transparent',
                    color: draft.standbyUsePct === v ? neutralActiveFg : palette.textSecondary,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </InlineRow>
          {draft.standbyUsePct ? (
            <InlineRow label="Standby % of operating crew" hint="Min crew on standby each day." rowDivider={rowDivider}>
              <NumberStepper
                value={draft.standbyMinPct}
                onChange={(v) => patch({ standbyMinPct: v })}
                min={0}
                max={100}
                suffix="%"
              />
            </InlineRow>
          ) : (
            <InlineRow label="Standby flat count" hint="Min crew on standby each day." rowDivider={rowDivider}>
              <NumberStepper
                value={draft.standbyMinFlat}
                onChange={(v) => patch({ standbyMinFlat: v })}
                min={0}
                max={100}
                suffix="crew"
              />
            </InlineRow>
          )}
          <InlineRow label="Home Standby Ratio" hint="Percentage from home vs airport standby." rowDivider={rowDivider}>
            <NumberStepper
              value={draft.homeStandbyRatioPct}
              onChange={(v) => patch({ homeStandbyRatioPct: v })}
              min={0}
              max={100}
              suffix="%"
            />
          </InlineRow>
        </ConfigSection>

        {/* Optimization */}
        <ConfigSection
          icon={Target}
          title="Optimization"
          desc="Objective weights"
          accent={accent}
          subtle={subtle}
          cardBorder={cardBorder}
        >
          <InlineRow
            label="Gender Balance on Layovers"
            hint="Balance male/female mix on overnight pairings."
            borderTop={false}
            rowDivider={rowDivider}
          >
            <Toggle
              on={draft.genderBalanceOnLayovers}
              onChange={(v) => patch({ genderBalanceOnLayovers: v })}
              accent="#06C270"
            />
          </InlineRow>
          {draft.genderBalanceOnLayovers && (
            <InlineRow label="Gender Balance Weight" hint="Higher = stronger preference." rowDivider={rowDivider}>
              <NumberStepper
                value={draft.genderBalanceWeight}
                onChange={(v) => patch({ genderBalanceWeight: v })}
                min={0}
                max={100}
                suffix="%"
              />
            </InlineRow>
          )}
        </ConfigSection>

        {/* ── Solver objectives — draggable priorities ── */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: subtle, border: `1px solid ${cardBorder}` }}
        >
          <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
            <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
            <BarChart3 size={14} style={{ color: accent }} />
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-hz-text">Solver Objectives</h3>
            <span className="text-[13px] text-hz-text-tertiary ml-1 font-normal normal-case tracking-normal">
              · drag to reorder
            </span>
          </header>
          <div className="px-4 pb-4 pt-1 flex flex-col gap-1.5">
            {draft.priorityOrder.map((key, idx) => {
              const obj = catalogue[key]
              if (!obj) return null
              const isDragging = dragIdx === idx
              const isSoft = obj.softOnly === true
              const tierLabel = isSoft ? 'Soft' : `Priority ${idx + 1}`
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => handleDragStart(idx, e)}
                  onDragOver={(e) => handleDragOver(idx, e)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-3 px-3 h-10 rounded-xl transition-colors select-none"
                  style={{
                    cursor: 'grab',
                    background: isDragging
                      ? neutralActiveBg
                      : isDark
                        ? 'rgba(255,255,255,0.025)'
                        : 'rgba(15,23,42,0.025)',
                    border: `1px solid ${isDragging ? neutralBar : cardBorder}`,
                    opacity: isDragging ? 0.9 : 1,
                  }}
                >
                  <span aria-hidden className="shrink-0 text-hz-text-tertiary" style={{ lineHeight: 0 }}>
                    <GripVertical size={16} />
                  </span>
                  <span className="text-[13px] flex-1 min-w-0 truncate font-medium text-hz-text">{obj.label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => movePriority(idx, -1)}
                      disabled={idx === 0}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-hz-text-tertiary disabled:opacity-30 hover:bg-hz-border/30 transition-colors"
                      aria-label="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePriority(idx, 1)}
                      disabled={idx === draft.priorityOrder.length - 1}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-hz-text-tertiary disabled:opacity-30 hover:bg-hz-border/30 transition-colors"
                      aria-label="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <span
                    className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full ml-1 shrink-0"
                    style={{
                      background: isSoft ? neutralTint : neutralActiveBg,
                      color: isSoft ? (isDark ? 'rgba(255,255,255,0.55)' : '#6B7280') : neutralActiveFg,
                    }}
                  >
                    {tierLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <div className="flex items-center gap-2">
          {saveError && (
            <span
              className="text-[13px] font-semibold flex items-center gap-1 max-w-md truncate"
              style={{ color: '#FF3B3B' }}
            >
              <AlertTriangle size={13} /> {saveError}
            </span>
          )}
          {savedPulse && !saveError && (
            <span className="text-[13px] font-semibold flex items-center gap-1" style={{ color: '#06C270' }}>
              <CheckCircle size={13} /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border transition-colors disabled:opacity-30"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
              color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Saving…
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Analysis-body helpers ─────────────────────────────────────────────────────

function ConfigSection({
  icon: Icon,
  title,
  desc,
  accent,
  subtle,
  cardBorder,
  children,
}: {
  icon: LucideIcon
  title: string
  desc: string
  accent: string
  subtle: string
  cardBorder: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: subtle, border: `1px solid ${cardBorder}` }}
    >
      <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <div className="w-[3px] h-5 rounded-full shrink-0" style={{ background: accent }} />
        <Icon size={14} style={{ color: accent }} />
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-hz-text">{title}</h3>
        <span className="text-[13px] text-hz-text-tertiary ml-1 font-normal normal-case tracking-normal">· {desc}</span>
      </header>
      <div className="px-5 pb-2 flex-1">{children}</div>
    </section>
  )
}

function InlineRow({
  label,
  hint,
  tooltip,
  children,
  borderTop,
  rowDivider,
}: {
  label: string
  hint: string
  tooltip?: string
  children: React.ReactNode
  borderTop?: boolean
  rowDivider: string
}) {
  return (
    <div
      className="flex items-center justify-between gap-6 py-3"
      style={borderTop ? { borderTop: `1px solid ${rowDivider}` } : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-hz-text">{label}</span>
          {tooltip && (
            <Tooltip content={tooltip} multiline maxWidth={320}>
              <span
                className="inline-flex items-center text-hz-text-tertiary hover:text-hz-text-secondary cursor-help"
                aria-label={tooltip}
              >
                <HelpCircle size={13} strokeWidth={1.8} />
              </span>
            </Tooltip>
          )}
        </div>
        <div className="text-[13px] text-hz-text-secondary mt-0.5 leading-snug">{hint}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, accent }: { on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="relative w-10 h-6 rounded-full transition-colors"
      style={{
        background: on ? accent : 'rgba(125,125,140,0.35)',
      }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
        style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

// ── Step 3: Generate Roster ───────────────────────────────────────────────────

interface ModeCardDef {
  key: AssignmentMode
  icon: LucideIcon
  title: string
  desc: string
  disabled?: boolean
  badge?: string
  danger?: boolean
}

const MODE_CARDS: ModeCardDef[] = [
  {
    key: 'general',
    icon: Wand2,
    title: 'General Auto Assignment',
    desc: 'Assign day-offs, flight duties, and standby. Training excluded.',
  },
  {
    key: 'daysOff',
    icon: CalendarOff,
    title: 'Days Off Only',
    desc: 'Assign rest days only. Leaves flight duties and standby untouched.',
  },
  { key: 'standby', icon: Clock, title: 'Standby Only', desc: 'Fill standby quota. No flight or rest changes.' },
  {
    key: 'longDuties',
    icon: CalendarRange,
    title: 'Long Pairings Only',
    desc: 'Assign pairings of N days or more. Configure N below.',
  },
  {
    key: 'training',
    icon: GraduationCap,
    title: 'Training Only',
    desc: 'Schedule recurrent training slots.',
    disabled: true,
    badge: 'Coming Soon',
  },
  {
    key: 'clear',
    icon: Trash2,
    title: 'Clear Crew Schedule',
    desc: 'Remove all crew assignments in selected period.',
    danger: true,
  },
]

function GenerateBody({
  mode,
  onModeChange,
  longDutiesMinDays,
  onLongDutiesMinDaysChange,
  phase,
  progress,
  onRun,
  onCancel,
  onNavigate,
  isDark,
  accent,
  palette,
}: {
  mode: AssignmentMode
  onModeChange: (m: AssignmentMode) => void
  longDutiesMinDays: number
  onLongDutiesMinDaysChange: (v: number) => void
  phase: RunPhase
  progress: { pct: number; message: string }
  onRun: () => void
  onCancel: () => void
  onNavigate: (to: ActiveKey) => void
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const isRunning = phase === 'running'
  const selected = MODE_CARDS.find((c) => c.key === mode) ?? MODE_CARDS[0]
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const subtle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.02)'
  return (
    <div className="px-6 py-6 space-y-6 w-full">
      <FormSection title="Assignment Mode" icon={SlidersHorizontal}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {MODE_CARDS.map((card) => {
            const Icon = card.icon
            const isSelected = mode === card.key
            const dangerTint = card.danger ? '#FF3B3B' : accent
            const selectedBorder = card.danger ? '#FF3B3B' : accent
            const selectedBg = card.danger
              ? isDark
                ? 'rgba(255,59,59,0.10)'
                : 'rgba(255,59,59,0.06)'
              : accentTint(accent, isDark ? 0.15 : 0.08)
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => !card.disabled && !isRunning && onModeChange(card.key)}
                disabled={card.disabled || isRunning}
                className="relative text-left rounded-2xl p-4 transition-all disabled:cursor-not-allowed"
                style={{
                  background: isSelected ? selectedBg : subtle,
                  border: `1px solid ${isSelected ? selectedBorder : cardBorder}`,
                  opacity: card.disabled ? 0.55 : 1,
                }}
              >
                {card.badge && (
                  <span
                    className="absolute top-2.5 right-2.5 px-2 h-5 inline-flex items-center rounded-full text-[13px] font-semibold"
                    style={{
                      background: isDark ? 'rgba(255,136,0,0.18)' : 'rgba(255,136,0,0.14)',
                      color: '#FF8800',
                    }}
                  >
                    {card.badge}
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: isSelected
                        ? card.danger
                          ? 'rgba(255,59,59,0.18)'
                          : accentTint(accent, isDark ? 0.22 : 0.12)
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(15,23,42,0.05)',
                    }}
                  >
                    <Icon size={18} color={isSelected ? dangerTint : palette.textSecondary} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-hz-text leading-tight">{card.title}</div>
                    <p className="text-[13px] text-hz-text-secondary mt-1 leading-snug">{card.desc}</p>
                    {card.key === 'longDuties' && isSelected && (
                      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[13px] text-hz-text-tertiary">Min length</span>
                        <NumberStepper
                          value={longDutiesMinDays}
                          onChange={onLongDutiesMinDaysChange}
                          min={1}
                          max={14}
                          suffix="days"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </FormSection>

      {phase !== 'idle' && (
        <FormSection title="Solver Progress" icon={Sparkles}>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[13px] text-hz-text-secondary truncate max-w-[80%]">
                  {progress.message || 'Waiting…'}
                </span>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: accent }}>
                  {progress.pct}%
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress.pct}%`,
                    background:
                      phase === 'failed'
                        ? '#FF3B3B'
                        : phase === 'cancelled'
                          ? '#FF8800'
                          : phase === 'running'
                            ? accent
                            : '#06C270',
                  }}
                />
              </div>
            </div>
            <PhaseBadge phase={phase} accent={accent} />
            {phase === 'completed' && (
              <p className="text-[13px] text-hz-text-secondary">
                Assignments committed.{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('review')}
                  className="font-semibold"
                  style={{ color: accent }}
                >
                  View results →
                </button>
              </p>
            )}
          </div>
        </FormSection>
      )}

      <div className="flex justify-end items-center">
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-semibold border transition-colors"
              style={{ borderColor: '#FF3B3B', color: '#FF3B3B' }}
            >
              <Square size={13} fill="currentColor" /> Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || selected.disabled}
            className="flex items-center gap-2 px-5 h-9 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: selected.danger ? '#E63535' : accent }}
          >
            {isRunning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {selected.key === 'clear' ? ' Clearing…' : ' Solving…'}
              </>
            ) : selected.key === 'clear' ? (
              <>
                <Trash2 size={13} /> Clear Schedule
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> {selected.title}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Review & Accept ───────────────────────────────────────────────────

function ReviewBody({
  resultRun,
  onNavigate,
  isDark,
  accent,
  palette,
}: {
  resultRun: AutoRosterRun | null
  onNavigate: (to: ActiveKey) => void
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  if (!resultRun?.stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-6">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: accentTint(accent, isDark ? 0.12 : 0.08) }}
        >
          <CheckSquare size={24} color={accent} strokeWidth={1.5} />
        </div>
        <p className="text-[13px] text-hz-text-secondary max-w-xs">
          Complete <strong>Step 3 — Generate Roster</strong> to review results here.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('generate')}
          className="text-[13px] font-semibold"
          style={{ color: accent }}
        >
          Go to Generate →
        </button>
      </div>
    )
  }
  const { stats } = resultRun
  return (
    <div className="px-6 py-6 space-y-6 max-w-3xl">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Assigned Pairings" value={stats.assignedPairings} color="#06C270" isDark={isDark} />
        <StatCard
          label="Unassigned Pairings"
          value={stats.unassignedPairings}
          color={stats.unassignedPairings > 0 ? '#FF3B3B' : palette.textSecondary}
          isDark={isDark}
        />
      </div>
      <FormSection title="Run Details" icon={CheckCircle}>
        <div className="grid grid-cols-3 gap-x-8 gap-y-3">
          <ConfigRow label="Total Pairings" value={String(stats.pairingsTotal)} palette={palette} />
          <ConfigRow label="Crew Pool" value={String(stats.crewTotal)} palette={palette} />
          <ConfigRow label="Duration" value={fmtDuration(stats.durationMs)} palette={palette} />
        </div>
      </FormSection>
      {stats.unassignedPairings > 0 && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
          style={{
            background: isDark ? 'rgba(255,136,0,0.08)' : 'rgba(255,136,0,0.06)',
            border: `1px solid ${isDark ? 'rgba(255,136,0,0.2)' : 'rgba(255,136,0,0.25)'}`,
          }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#FF8800' }} />
          <p className="text-[13px]" style={{ color: '#FF8800' }}>
            {stats.unassignedPairings} pairing{stats.unassignedPairings !== 1 ? 's' : ''} could not be filled — no
            FDTL-legal crew available. Check qualifications, base coverage, or extend the solver time limit.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Link
          href="/crew-ops/control/crew-scheduling"
          className="flex items-center gap-1.5 text-[13px] font-semibold hover:opacity-80 transition-opacity"
          style={{ color: accent }}
        >
          View result in Gantt <ExternalLink size={12} />
        </Link>
        <button
          type="button"
          onClick={() => onNavigate('generate')}
          className="text-[13px] font-medium text-hz-text-secondary hover:opacity-70 transition-opacity"
        >
          ← Re-run
        </button>
      </div>
    </div>
  )
}

// ── History ───────────────────────────────────────────────────────────────────

function HistoryBody({
  history,
  loading,
  isDark,
  accent,
}: {
  history: AutoRosterRun[]
  loading: boolean
  isDark: boolean
  accent: string
}) {
  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-hz-text-secondary" />
      </div>
    )
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
        >
          <History size={20} style={{ color: accent }} />
        </div>
        <p className="text-[13px] text-hz-text-tertiary">No auto-roster runs yet.</p>
      </div>
    )
  }
  return (
    <div className="px-6 py-6 overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hz-border">
            {['Started', 'Period', 'Status', 'Assigned / Total', 'Duration'].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 text-[13px] font-semibold uppercase tracking-wide text-hz-text-tertiary text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((run) => (
            <tr key={run._id} className="border-b border-hz-border/30 hover:bg-hz-border/10 transition-colors">
              <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text-secondary tabular-nums">
                {fmtDate(run.startedAt)}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-mono tabular-nums text-hz-text">
                {run.periodFrom} → {run.periodTo}
              </td>
              <td className="px-3 py-2.5">
                <StatusChip status={run.status} />
              </td>
              <td className="px-3 py-2.5 text-[13px] tabular-nums text-hz-text">
                {run.stats ? `${run.stats.assignedPairings} / ${run.stats.pairingsTotal}` : '—'}
              </td>
              <td className="px-3 py-2.5 text-[13px] tabular-nums text-hz-text-secondary">
                {run.stats ? fmtDuration(run.stats.durationMs) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function FormSection({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-hz-text-tertiary" strokeWidth={1.8} />
          <span className="text-[13px] font-semibold text-hz-text uppercase tracking-wide">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function ConfigRow({ label, value, palette }: { label: string; value: string; palette: PaletteType }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] uppercase tracking-wide" style={{ color: palette.textTertiary }}>
        {label}
      </span>
      <span className="text-[13px] font-medium text-hz-text">{value}</span>
    </div>
  )
}

function ObjectiveRow({
  label,
  tier,
  isDark,
  accent,
}: {
  label: string
  tier: string
  isDark: boolean
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-hz-text">{label}</span>
      <span
        className="text-[13px] font-medium px-2.5 py-0.5 rounded-full ml-4 shrink-0"
        style={{
          background: accent
            ? accentTint(accent, isDark ? 0.18 : 0.1)
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.05)',
          color: accent ?? (isDark ? 'rgba(255,255,255,0.55)' : '#6B7280'),
        }}
      >
        {tier}
      </span>
    </div>
  )
}

function StatCard({ label, value, color, isDark }: { label: string; value: number; color: string; isDark: boolean }) {
  return (
    <div
      className="text-center p-5 rounded-xl"
      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }}
    >
      <div className="text-[32px] font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[13px] uppercase tracking-wide text-hz-text-tertiary mt-1">{label}</div>
    </div>
  )
}

function PhaseBadge({ phase, accent }: { phase: RunPhase; accent: string }) {
  const map: Record<RunPhase, { label: string; color: string; bg: string; icon?: React.ReactNode }> = {
    idle: { label: 'Ready', color: '#8F90A6', bg: 'rgba(143,144,166,0.12)' },
    running: {
      label: 'Running',
      color: accent,
      bg: accentTint(accent, 0.12),
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    completed: { label: 'Completed', color: '#06C270', bg: 'rgba(6,194,112,0.12)', icon: <CheckCircle size={12} /> },
    failed: { label: 'Failed', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)', icon: <AlertTriangle size={12} /> },
    cancelled: { label: 'Cancelled', color: '#FF8800', bg: 'rgba(255,136,0,0.12)' },
  }
  const s = map[phase]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      {s.icon}
      {s.label}
    </span>
  )
}

function StatusChip({ status }: { status: AutoRosterRun['status'] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    queued: { label: 'Queued', color: '#8F90A6', bg: 'rgba(143,144,166,0.12)' },
    running: { label: 'Running', color: '#0063F7', bg: 'rgba(0,99,247,0.12)' },
    completed: { label: 'Completed', color: '#06C270', bg: 'rgba(6,194,112,0.12)' },
    failed: { label: 'Failed', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)' },
    cancelled: { label: 'Cancelled', color: '#FF8800', bg: 'rgba(255,136,0,0.12)' },
  }
  const s = map[status] ?? map.queued
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[13px] font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}
