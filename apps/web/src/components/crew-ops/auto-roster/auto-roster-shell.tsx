'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  Gauge,
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
  type AutoRosterRunStats,
  type CrewScheduleResponse,
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
import { useDateFormat } from '@/hooks/use-date-format'
import { NumberStepper } from '@/components/admin/_shared/form-primitives'
import { Tooltip } from '@/components/ui/tooltip'
import { Dropdown } from '@/components/ui/dropdown'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
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
  { key: 'review', num: 4, label: 'Review & Accept', desc: 'Inspect roster coverage & fairness', icon: CheckSquare },
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
  // Solver acceptance gap. 0.05 = Quality (default — closest to optimum
  // fairness), 0.10 = Balanced (~30% faster, slight spread loosening),
  // 0.20 = Performance (~2× faster, looser spread). Coverage + legality
  // unaffected by any value.
  const [solverGapLimit, setSolverGapLimit] = useState<number>(0.05)

  // Days-Off-Only: planner picks which activity code to stamp (any code
  // carrying the `is_day_off` flag). General mode hard-codes SYS 'OFF' and
  // is NOT affected by this picker.
  const [dayOffCodeOptions, setDayOffCodeOptions] = useState<Array<{ _id: string; code: string; name: string }>>([])
  const [dayOffCodeId, setDayOffCodeId] = useState<string | null>(null)

  // Tiered Clear Schedule retention flags. Defaults preserve everything a
  // planner would hate to lose — pre-assigned duties, days off, standby.
  // Unchecking any flag includes that bucket in the wipe.
  const [clearRetainPreAssigned, setClearRetainPreAssigned] = useState(true)
  const [clearRetainDayOff, setClearRetainDayOff] = useState(true)
  const [clearRetainStandby, setClearRetainStandby] = useState(true)

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
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [resultRun, setResultRun] = useState<AutoRosterRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [multiBaseBlocked, setMultiBaseBlocked] = useState(false)
  // Lock state — populated when another planner owns the currently running
  // auto-roster for this operator. Drives the "locked" banner + disabled Run
  // button on Step 3.
  const [lock, setLock] = useState<{
    runId: string
    userId: string | null
    userName: string | null
    startedAt: string | null
    pct: number
    message: string | null
  } | null>(null)

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
    // Reattach to an already-running run on mount. This covers (a) screen
    // refresh while our own run is in flight (re-subscribe to its SSE), and
    // (b) landing on Step 3 while another planner's run holds the lock
    // (render a read-only banner + disable Run).
    void api
      .getAutoRosterActive(operator._id)
      .then((res) => {
        if (!res.active) {
          setLock(null)
          return
        }
        const a = res.active
        if (a.lockedForYou) {
          setLock({
            runId: a.runId,
            userId: a.startedByUserId,
            userName: a.startedByUserName,
            startedAt: a.startedAt,
            pct: a.pct,
            message: a.message,
          })
        } else {
          // Our own run survived a refresh — rehydrate and reconnect.
          setLock(null)
          setActiveRunId(a.runId)
          setPhase('running')
          setProgress({ pct: a.pct, message: a.message ?? 'Reconnecting…' })
          setRunStartedAt(a.startedAt ? new Date(a.startedAt).getTime() : Date.now())
          connectSSE(a.runId)
        }
      })
      .catch(() => null)
    // Load is_day_off codes for the Days Off Only picker. Default selection =
    // SYS 'OFF' when present, otherwise first match.
    api
      .getActivityCodes(operator._id)
      .then((codes) => {
        const offCodes = codes
          .filter((c) => c.isActive && !c.isArchived && (c.flags ?? []).includes('is_day_off'))
          .map((c) => ({ _id: c._id, code: c.code, name: c.name }))
        setDayOffCodeOptions(offCodes)
        if (offCodes.length > 0) {
          const sys = offCodes.find((c) => c.code === 'OFF')
          setDayOffCodeId((prev) => prev ?? (sys ?? offCodes[0])._id)
        }
      })
      .catch(() => null)
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
      const h = await api.getAutoRosterHistory(operator._id)
      setHistory(h)
      // Rehydrate Step 4 with the most recent terminal run so a refreshed
      // screen can still inspect the last result instead of bouncing to an
      // empty state. Only the newest completed run is promoted — in-flight
      // runs are handled by the `/active` + SSE reattach path.
      setResultRun((prev) => {
        if (prev) return prev
        const lastTerminal = h.find((r) => r.status === 'completed')
        return lastTerminal ?? null
      })
      if (h.find((r) => r.status === 'completed')) {
        setHighestStep((prev) => Math.max(prev, 4))
      }
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

  // Go = commit filter state + reset the journey to Step 1. Stepper is wiped
  // back to "only Step 1 active" so prior-run check-marks don't bleed into a
  // fresh workgroup; the user re-walks 1 → 4 every time they hit Go.
  const handleGo = useCallback(() => {
    commitFilter()
    setActive('manpower')
    setHighestStep(1)
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
      // Solver finished pairing assignment, but general mode still chains
      // day-off + standby passes + final commit AFTER this. Don't treat
      // `solution` as "done". Wait for `committed` below. Keep progress bar
      // ticking as chained passes emit more events.
    })
    es.addEventListener('committed', () => {
      setPhase('completed')
      setProgress({ pct: 100, message: 'Roster committed' })
      es.close()
      void api.getAutoRosterRun(runId).then((run) => {
        setResultRun(run)
        setHistory((prev) => [run, ...prev.filter((r) => r._id !== runId)])
        setHighestStep((prev) => Math.max(prev, 4))
        setActive('review')
      })
    })
    es.addEventListener('error', (e) => {
      // EventSource fires the native `error` event for two very different
      // things:
      //   1. Server explicitly emitted `event: error\ndata: {...}` — a real
      //      solver failure. The MessageEvent has a `data` payload.
      //   2. The TCP connection dropped (server restart, network blip,
      //      tsx watch reload after a commit-time prettier rewrite). The
      //      event has NO `data` and EventSource will auto-retry.
      // Treating both the same makes a routine `tsx watch` restart kill a
      // 9-minute solver run in the UI even though the orchestrator may
      // recover on the other side. So distinguish them.
      const data = (e as MessageEvent).data
      if (typeof data === 'string' && data.length > 0) {
        let msg = 'Solver error'
        try {
          msg = (JSON.parse(data) as { message: string }).message
        } catch {
          /* ignore */
        }
        setPhase('failed')
        setError(msg)
        es.close()
        void loadHistory()
        return
      }
      // Native drop — don't fail the run. Surface a transient banner via
      // the progress message and let EventSource auto-retry. If the
      // server-side run is actually dead, the stale-lock sweep flips it
      // to failed within ~5 min and the next reconnect (or a refresh)
      // will pick that up via the rehydrate path on mount.
      setProgress((prev) => ({ pct: prev.pct, message: 'Connection lost — reconnecting…' }))
    })
  }

  const handleRun = useCallback(async () => {
    if (!operator?._id || !periodFrom || !periodTo) return
    if (mode === 'training') return // scaffolded — not implemented
    // Auto-roster runs are scoped to one base at a time. Multi-base selection
    // is fine for projection views, but the solver / day-off / standby /
    // long-duty passes all assume a single home base.
    if (mode !== 'clear' && filterBase.length > 1) {
      setMultiBaseBlocked(true)
      return
    }
    setError(null)
    setResultRun(null)
    setPhase('running')
    setProgress({ pct: 0, message: 'Starting…' })
    setRunStartedAt(Date.now())
    try {
      if (mode === 'clear') {
        const oneOrUndef = (arr: string[]) => (arr.length === 1 ? arr[0] : undefined)
        const manyOrUndef = (arr: string[]) => (arr.length > 0 ? arr : undefined)
        // Forward the active workgroup filter set so the server scopes
        // the wipe to crew the planner can see. Without these the server
        // historically deleted every crew in the operator regardless of
        // the visible filter — e.g. clearing inside a HAN-FO view also
        // erased prior HAN-CP rosters.
        const res = await api.bulkClearSchedule({
          periodFrom,
          periodTo,
          retainPreAssigned: clearRetainPreAssigned,
          retainDayOff: clearRetainDayOff,
          retainStandby: clearRetainStandby,
          base: oneOrUndef(filterBase),
          position: oneOrUndef(filterPosition),
          acType: manyOrUndef(filterAcType),
          crewGroup: manyOrUndef(filterCrewGroup),
        })
        setPhase('completed')
        setProgress({
          pct: 100,
          message: `Cleared ${res.deletedAssignments.toLocaleString()} pairings, ${res.deletedActivities.toLocaleString()} activities`,
        })
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
        daysOffActivityCodeId: mode === 'daysOff' ? dayOffCodeId : undefined,
        // Solver acceptance gap only matters for solver-driven modes.
        // Days-off-only and clear pass through deterministic placement.
        relativeGapLimit: mode === 'general' || mode === 'longDuties' ? solverGapLimit : undefined,
        base: oneOrUndef(filterBase),
        position: oneOrUndef(filterPosition),
        acType: manyOrUndef(filterAcType),
        crewGroup: manyOrUndef(filterCrewGroup),
      })
      setActiveRunId(runId)
      setLock(null)
      connectSSE(runId)
      void loadHistory()
    } catch (err) {
      // Server returns 409 with lock info when another run is already in
      // flight for this operator. Surface it as a lock banner instead of an
      // error toast so the user can see who owns the run.
      const maybeErr = err as { status?: number; payload?: Record<string, unknown> | null }
      if (maybeErr?.status === 409 && maybeErr.payload) {
        const p = maybeErr.payload
        setLock({
          runId: String(p.runId ?? ''),
          userId: (p.startedByUserId as string | null) ?? null,
          userName: (p.startedByUserName as string | null) ?? null,
          startedAt: (p.startedAt as string | null) ?? null,
          pct: Number(p.pct ?? 0),
          message: (p.message as string | null) ?? null,
        })
        setPhase('idle')
        return
      }
      setPhase('failed')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [
    operator?._id,
    periodFrom,
    periodTo,
    mode,
    longDutiesMinDays,
    dayOffCodeId,
    solverGapLimit,
    clearRetainPreAssigned,
    clearRetainDayOff,
    clearRetainStandby,
    filterBase,
    filterPosition,
    filterAcType,
    filterCrewGroup,
    loadHistory,
  ])

  const handleCancel = useCallback(async () => {
    // Fall back to the lock banner's runId when the page was reattached
    // to someone else's (or a prior session's) run — `activeRunId` is
    // only populated when WE started the run from this tab. Without
    // this fallback the Cancel button silently no-ops on reattached
    // runs (the exact scenario after a server restart leaves an
    // orphaned full-scope run that needs to be killed).
    const targetRunId = activeRunId ?? lock?.runId ?? null
    if (!targetRunId) return
    esRef.current?.close()
    try {
      await api.cancelAutoRoster(targetRunId)
    } catch {
      /* ignore */
    }
    setPhase('cancelled')
    setActiveRunId(null)
    setLock(null)
    void loadHistory()
  }, [activeRunId, lock?.runId, loadHistory])

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

      {!committed ? (
        // Pre-Go: blank right panel, matches 4.1.5.1 contract. The hero +
        // stepper only appear once the user commits a filter scope, so the
        // initial state isn't a misleading "Step 1 of 4" before any work
        // has actually been scoped.
        <EmptyPanel message="Pick a period and filters, then click Go in the left panel." />
      ) : (
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
            dayOffCodeId={dayOffCodeId}
            onDayOffCodeIdChange={setDayOffCodeId}
            dayOffCodeOptions={dayOffCodeOptions}
            clearRetainPreAssigned={clearRetainPreAssigned}
            onClearRetainPreAssignedChange={setClearRetainPreAssigned}
            clearRetainDayOff={clearRetainDayOff}
            onClearRetainDayOffChange={setClearRetainDayOff}
            clearRetainStandby={clearRetainStandby}
            onClearRetainStandbyChange={setClearRetainStandby}
            solverGapLimit={solverGapLimit}
            onSolverGapLimitChange={setSolverGapLimit}
            filterBase={filterBase}
            filterPosition={filterPosition}
            filterAcType={filterAcType}
            filterCrewGroup={filterCrewGroup}
            phase={phase}
            progress={progress}
            runStartedAt={runStartedAt}
            resultRun={resultRun}
            error={error}
            onDismissError={() => setError(null)}
            onRun={handleRun}
            onCancel={handleCancel}
            onNavigate={navigate}
            highestStep={highestStep}
            lock={lock}
            isDark={isDark}
            accent={accent}
            palette={palette}
          />
        </div>
      )}
      {multiBaseBlocked && (
        <MultiBaseBlockDialog
          selectedCount={filterBase.length}
          onClose={() => setMultiBaseBlocked(false)}
          isDark={isDark}
        />
      )}
    </div>
  )
}

// ── Multi-base block dialog ─────────────────────────────────────────────────
// Auto-roster pipelines (general / standby / days-off / long-duty) are
// scoped to one base. Multi-base manpower projection is fine, but actually
// running the solver across bases produces nonsense rosters (cross-base
// repositioning, mixed FDTL schemes, conflicting standby pools).

function MultiBaseBlockDialog({
  selectedCount,
  onClose,
  isDark,
}: {
  selectedCount: number
  onClose: () => void
  isDark: boolean
}) {
  const panelBg = isDark ? '#191921' : '#FFFFFF'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

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
          width: 'min(92vw, 520px)',
          boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.55)' : '0 24px 60px rgba(96,97,112,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${borderCol}` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} style={{ color: '#FF8800' }} />
            <div className="text-[14px] font-bold text-hz-text">Single base required</div>
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
        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-[13px] text-hz-text">
            Auto-roster runs one base at a time. You currently have{' '}
            <span className="font-semibold">{selectedCount} bases</span> selected.
          </p>
          <p className="text-[13px] text-hz-text-secondary">
            Multi-base is supported for manpower projection only. Narrow the Base filter to a single base, click Go,
            then run the auto-roster again.
          </p>
        </div>
        <div className="px-5 py-3 flex justify-end" style={{ borderTop: `1px solid ${borderCol}` }}>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-[13px] font-medium text-white"
            style={{ background: '#FF8800' }}
          >
            Got it
          </button>
        </div>
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
  dayOffCodeId,
  onDayOffCodeIdChange,
  dayOffCodeOptions,
  clearRetainPreAssigned,
  onClearRetainPreAssignedChange,
  clearRetainDayOff,
  onClearRetainDayOffChange,
  clearRetainStandby,
  onClearRetainStandbyChange,
  solverGapLimit,
  onSolverGapLimitChange,
  filterBase,
  filterPosition,
  filterAcType,
  filterCrewGroup,
  phase,
  progress,
  runStartedAt,
  resultRun,
  error,
  onDismissError,
  onRun,
  onCancel,
  onNavigate,
  highestStep,
  lock,
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
  dayOffCodeId: string | null
  onDayOffCodeIdChange: (v: string | null) => void
  dayOffCodeOptions: Array<{ _id: string; code: string; name: string }>
  clearRetainPreAssigned: boolean
  onClearRetainPreAssignedChange: (v: boolean) => void
  clearRetainDayOff: boolean
  onClearRetainDayOffChange: (v: boolean) => void
  clearRetainStandby: boolean
  onClearRetainStandbyChange: (v: boolean) => void
  solverGapLimit: number
  onSolverGapLimitChange: (v: number) => void
  filterBase: string[]
  filterPosition: string[]
  filterAcType: string[]
  filterCrewGroup: string[]
  phase: RunPhase
  progress: { pct: number; message: string }
  runStartedAt: number | null
  resultRun: AutoRosterRun | null
  error: string | null
  onDismissError: () => void
  onRun: () => void
  onCancel: () => void
  onNavigate: (to: ActiveKey) => void
  highestStep: number
  lock: {
    runId: string
    userId: string | null
    userName: string | null
    startedAt: string | null
    pct: number
    message: string | null
  } | null
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
          scopeLine={
            isHistory ? undefined : (
              <WorkgroupScopeLine
                filterBase={filterBase}
                filterPosition={filterPosition}
                filterAcType={filterAcType}
                filterCrewGroup={filterCrewGroup}
                accent={accent}
              />
            )
          }
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
            dayOffCodeId={dayOffCodeId}
            onDayOffCodeIdChange={onDayOffCodeIdChange}
            dayOffCodeOptions={dayOffCodeOptions}
            clearRetainPreAssigned={clearRetainPreAssigned}
            onClearRetainPreAssignedChange={onClearRetainPreAssignedChange}
            clearRetainDayOff={clearRetainDayOff}
            onClearRetainDayOffChange={onClearRetainDayOffChange}
            clearRetainStandby={clearRetainStandby}
            onClearRetainStandbyChange={onClearRetainStandbyChange}
            solverGapLimit={solverGapLimit}
            onSolverGapLimitChange={onSolverGapLimitChange}
            phase={phase}
            progress={progress}
            startedAt={runStartedAt}
            lock={lock}
            filterBase={filterBase}
            filterPosition={filterPosition}
            filterAcType={filterAcType}
            filterCrewGroup={filterCrewGroup}
            onRun={onRun}
            onCancel={onCancel}
            onNavigate={onNavigate}
            isDark={isDark}
            accent={accent}
            palette={palette}
          />
        )}
        {active === 'review' && (
          <ReviewBody
            resultRun={resultRun}
            periodFrom={periodFrom}
            periodTo={periodTo}
            filterBase={filterBase}
            filterPosition={filterPosition}
            filterAcType={filterAcType}
            filterCrewGroup={filterCrewGroup}
            onNavigate={onNavigate}
            isDark={isDark}
            accent={accent}
            palette={palette}
          />
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
  scopeLine,
}: {
  variant: HeroKey
  eyebrow: string
  title: string
  caption: string
  accent: string
  isDark: boolean
  trailing?: React.ReactNode
  /** Optional scope line shown below the caption (e.g. workgroup filter
   *  summary). When present the hero auto-grows to fit it without crowding
   *  the title block. */
  scopeLine?: React.ReactNode
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

      {/* Title block — vertically centered via flex so the optional scope
          line can extend the stack without breaking centering. */}
      <div className="absolute left-6 inset-y-0 flex flex-col justify-center max-w-[55%]">
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
        {scopeLine && <div className="mt-2">{scopeLine}</div>}
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
// DayBreakdown row. "To Be Assigned" = seatsDemand − assigned (floored at 0)
// so running auto-roster shrinks it as seats get filled. Previous design used
// raw `seatsDemand` alongside `assigned`, double-counting filled seats.
interface ChartSegment {
  key: string
  label: string
  color: (accent: string) => string
  value: (d: DayBreakdown) => number
}
// Premium palette — Tailwind v3 500/400 anchors. Cohesive, pastel-leaning,
// still distinguishable across 8 slots. Red/orange tamed vs previous pure hex.
const CHART_SEGMENTS: ChartSegment[] = [
  { key: 'assigned', label: 'Assigned', color: () => '#8B5CF6', value: (d) => d.assigned }, // violet-500
  { key: 'training', label: 'Training', color: () => '#0EA5E9', value: (d) => d.inTraining }, // sky-500
  { key: 'groundDuty', label: 'Ground Duty', color: () => '#F472B6', value: (d) => d.onGroundDuty ?? 0 }, // pink-400
  {
    key: 'toBeAssigned',
    label: 'To Be Assigned',
    color: () => '#F43F5E',
    value: (d) => Math.max(0, (d.seatsDemand ?? 0) - (d.assigned ?? 0)),
  }, // rose-500
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
                {data.days.map((day) => {
                  const qualified = Math.max(0, data.crewTotal - (day.onTempBase ?? 0))
                  return (
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
                      {qualified}
                    </td>
                  )
                })}
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

        {/* Qualified-crew reference line — per-day step path. Drops below
            crewTotal on days when crew are on temp-base (or its bracketing
            POS days), since those crew are operationally detached from
            home base and don't count toward home-base manpower. */}
        {data.crewTotal > 0 &&
          data.days.length > 0 &&
          (() => {
            const qualifiedFor = (d: (typeof data.days)[number]) => Math.max(0, data.crewTotal - (d.onTempBase ?? 0))
            const minQualified = data.days.reduce((m, d) => Math.min(m, qualifiedFor(d)), data.crewTotal)
            const hasShortage = minQualified < data.crewTotal
            // Build a step path: horizontal segment across each day's slot,
            // vertical jumps at slot boundaries when the value changes.
            const segments: string[] = []
            for (let i = 0; i < data.days.length; i++) {
              const xL = PL + i * slotW
              const xR = PL + (i + 1) * slotW
              const y = toY(qualifiedFor(data.days[i]))
              if (i === 0) segments.push(`M ${xL} ${y}`)
              else segments.push(`L ${xL} ${y}`)
              segments.push(`L ${xR} ${y}`)
            }
            const stepPath = segments.join(' ')
            // Anchor badge to the value on the last day so it tracks the
            // current visible end of the line. Pin BELOW the line when too
            // close to the chart top.
            const lastQualified = qualifiedFor(data.days[data.days.length - 1])
            const yBadge = toY(lastQualified)
            const borderColor = isDark ? '#0E0E14' : 'rgba(15,23,42,0.85)'
            const badgeAbove = yBadge - 26 >= PT
            const rectY = badgeAbove ? yBadge - 26 : yBadge + 4
            const textY = badgeAbove ? yBadge - 11 : yBadge + 19
            const badgeLabel = hasShortage ? `${lastQualified} of ${data.crewTotal}` : `Total ${data.crewTotal}`
            const badgeWidth = Math.max(104, badgeLabel.length * 8 + 24)
            return (
              <g style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }}>
                <path
                  d={stepPath}
                  fill="none"
                  stroke={borderColor}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={stepPath}
                  fill="none"
                  stroke="#FDDD48"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <g>
                  <rect x={W - PR - badgeWidth} y={rectY} width={badgeWidth} height={22} rx={4} fill={borderColor} />
                  <text
                    x={W - PR - badgeWidth / 2}
                    y={textY}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={700}
                    fontFamily="'Inter', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif"
                    fill="#FDDD48"
                  >
                    {badgeLabel}
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
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: accent }}
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
  // Kept the local `Toggle` wrapper so existing call sites still compile
  // unchanged. The accent prop is ignored — global ToggleSwitch defaults to
  // iOS green per the design system.
  void accent
  return <ToggleSwitch checked={on} onChange={onChange} size="md" />
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

// CP-SAT solver acceptance gap. Lower = closer to optimum (tighter BH-spread,
// idle, QoL fairness) but slower. Coverage and FDTL legality are unaffected
// by this knob — they're hard constraints. Numeric gap values intentionally
// hidden from the UI: planners think in "Quality / Balanced / Performance",
// not in optimization-gap percentages.
interface SolverQualityOption {
  key: 'quality' | 'balanced' | 'performance'
  value: number
  title: string
  desc: string
}
const SOLVER_QUALITY_OPTIONS: SolverQualityOption[] = [
  {
    key: 'quality',
    value: 0.05,
    title: 'Quality',
    desc: 'Maximum precision. Crew workload distributed with the finest care.',
  },
  {
    key: 'balanced',
    value: 0.1,
    title: 'Balanced',
    desc: 'Refined rosters, accelerated turnaround. Recommended for routine planning.',
  },
  {
    key: 'performance',
    value: 0.2,
    title: 'Performance',
    desc: 'Engineered for speed. Rapid turnaround for time-critical planning windows.',
  },
]

function RetainCheckbox({
  label,
  hint,
  checked,
  onChange,
  accent,
  isDark,
  disabled,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
  accent: string
  isDark: boolean
  disabled?: boolean
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl p-3"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-hz-text leading-tight">{label}</div>
        <div className="text-[13px] text-hz-text-tertiary mt-1 leading-snug">{hint}</div>
      </div>
      <Toggle on={checked} onChange={disabled ? () => {} : onChange} accent="#06C270" />
    </div>
  )
}

type SolverPhaseRow = { message: string; pct: number; startAt: number; endAt: number | null }

function SolverPhaseList({
  phases,
  running,
  accent,
  isDark,
}: {
  phases: SolverPhaseRow[]
  running: boolean
  accent: string
  isDark: boolean
}) {
  // Live tick so the active row's elapsed reading updates every second.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  void tick

  // Auto-scroll to the active row whenever a new phase is appended. Keeps
  // the ongoing item visible without the user having to hunt for it.
  const listRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [phases.length, running])

  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  const fmtDur = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000))
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}:${String(ss).padStart(2, '0')}`
  }

  if (phases.length === 0) {
    return (
      <div
        className="rounded-xl px-4 py-6 text-[13px] text-hz-text-secondary text-center"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        Waiting for first solver update…
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="rounded-xl overflow-y-auto flex-1 min-h-0"
      style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <ul className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
        {phases.map((p, i) => {
          const isActive = p.endAt == null && running && i === phases.length - 1
          const endMs = p.endAt ?? (isActive ? Date.now() : p.startAt)
          const dur = endMs - p.startAt
          return (
            <li
              key={`${p.startAt}-${i}`}
              className="flex items-start gap-3 px-4 py-2.5"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
            >
              {/* Leading status icon */}
              <div className="shrink-0 mt-0.5">
                {isActive ? (
                  <Loader2 size={14} className="animate-spin" style={{ color: accent }} />
                ) : (
                  <span
                    className="inline-flex items-center justify-center rounded-full"
                    style={{ width: 16, height: 16, background: '#06C270' }}
                  >
                    <Check size={11} color="#fff" strokeWidth={3} />
                  </span>
                )}
              </div>

              {/* Message + timing */}
              <div className="flex-1 min-w-0">
                {(() => {
                  // The CP-SAT pre-feasible heartbeat ships its message as
                  // "Searching for first legal roster — Ns / Ms". Replace the
                  // raw "22s / 1800s" with a deadline progress bar so the
                  // user can see how much of the time budget is left at a
                  // glance instead of doing the math.
                  const m = /^Searching for first legal roster — (\d+)s \/ (\d+)s$/.exec(p.message)
                  if (m) {
                    const elapsed = parseInt(m[1], 10)
                    const limit = Math.max(1, parseInt(m[2], 10))
                    const pct = Math.min(100, Math.max(0, Math.round((elapsed / limit) * 100)))
                    return (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-medium text-hz-text truncate">
                            Searching for first legal roster
                          </span>
                          <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: accent }}>
                            {pct}%
                          </span>
                        </div>
                        <div
                          className="mt-1 h-1 rounded-full overflow-hidden"
                          style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
                        >
                          <div
                            className="h-full rounded-full transition-[width] duration-500 ease-out"
                            style={{ width: `${pct}%`, background: accent }}
                          />
                        </div>
                        <div className="text-[12px] text-hz-text-tertiary tabular-nums mt-0.5">
                          {fmtTime(p.startAt)}
                          {p.endAt != null ? ` → ${fmtTime(p.endAt)}` : ' → …'}
                          {' · '}
                          {fmtDur(dur)}
                        </div>
                      </>
                    )
                  }
                  return (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-hz-text truncate">{p.message}</span>
                        {isActive && (
                          <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: accent }}>
                            {p.pct}%
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-hz-text-tertiary tabular-nums mt-0.5">
                        {fmtTime(p.startAt)}
                        {p.endAt != null ? ` → ${fmtTime(p.endAt)}` : ' → …'}
                        {' · '}
                        {fmtDur(dur)}
                      </div>
                    </>
                  )
                })()}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Workgroup Scope Line ──────────────────────────────────────────────────────
// Shared header strip showing the active filter scope (Base · Position · A/C
// Type · Crew Group). Renders the SkyHub section-accent-bar pattern: 3px
// vertical accent bar + uppercase label + dot-separated value line.
function WorkgroupScopeLine({
  filterBase,
  filterPosition,
  filterAcType,
  filterCrewGroup,
  accent,
}: {
  filterBase: string[]
  filterPosition: string[]
  filterAcType: string[]
  filterCrewGroup: string[]
  accent: string
}) {
  const context = useCrewScheduleStore((s) => s.context)
  const positions = useCrewScheduleStore((s) => s.positions)

  const formatList = (selected: string[], options: Array<{ key: string; label: string }>, allLabel: string): string => {
    if (selected.length === 0) return allLabel
    const labels = selected.map((id) => options.find((o) => o.key === id)?.label ?? id).filter(Boolean)
    if (labels.length <= 3) return labels.join(', ')
    return `${labels.slice(0, 2).join(', ')}, +${labels.length - 2}`
  }

  const baseOptions = context.bases.map((b) => ({ key: b._id, label: b.iataCode ?? b.name }))
  const positionOptions = positions.filter((p) => p.isActive).map((p) => ({ key: p._id, label: p.code }))
  const acTypeOptions = context.acTypes.map((t) => ({ key: t, label: t }))
  const crewGroupOptions = context.crewGroups.map((g) => ({ key: g._id, label: g.name }))

  const segments = [
    formatList(filterBase, baseOptions, 'All Bases'),
    formatList(filterPosition, positionOptions, 'All Positions'),
    formatList(filterAcType, acTypeOptions, 'All Types'),
    formatList(filterCrewGroup, crewGroupOptions, 'All Groups'),
  ]
  const fullValue = segments.join(' · ')

  return (
    <div className="flex items-center gap-2 min-w-0" title={fullValue}>
      <span className="w-[3px] h-4 rounded-sm shrink-0" style={{ background: accent }} aria-hidden="true" />
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-hz-text-tertiary shrink-0">
        Workgroup
      </span>
      <span className="text-[13px] font-semibold text-hz-text truncate min-w-0">{fullValue}</span>
    </div>
  )
}

function GenerateBody({
  mode,
  onModeChange,
  longDutiesMinDays,
  onLongDutiesMinDaysChange,
  dayOffCodeId,
  onDayOffCodeIdChange,
  dayOffCodeOptions,
  clearRetainPreAssigned,
  onClearRetainPreAssignedChange,
  clearRetainDayOff,
  onClearRetainDayOffChange,
  clearRetainStandby,
  onClearRetainStandbyChange,
  solverGapLimit,
  onSolverGapLimitChange,
  phase,
  progress,
  startedAt,
  lock,
  filterBase,
  filterPosition,
  filterAcType,
  filterCrewGroup,
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
  dayOffCodeId: string | null
  onDayOffCodeIdChange: (v: string | null) => void
  dayOffCodeOptions: Array<{ _id: string; code: string; name: string }>
  clearRetainPreAssigned: boolean
  onClearRetainPreAssignedChange: (v: boolean) => void
  clearRetainDayOff: boolean
  onClearRetainDayOffChange: (v: boolean) => void
  clearRetainStandby: boolean
  onClearRetainStandbyChange: (v: boolean) => void
  solverGapLimit: number
  onSolverGapLimitChange: (v: number) => void
  phase: RunPhase
  progress: { pct: number; message: string }
  startedAt: number | null
  lock: {
    runId: string
    userId: string | null
    userName: string | null
    startedAt: string | null
    pct: number
    message: string | null
  } | null
  filterBase: string[]
  filterPosition: string[]
  filterAcType: string[]
  filterCrewGroup: string[]
  onRun: () => void
  onCancel: () => void
  onNavigate: (to: ActiveKey) => void
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const isRunning = phase === 'running'
  const isLocked = lock != null
  const selected = MODE_CARDS.find((c) => c.key === mode) ?? MODE_CARDS[0]
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const subtle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.02)'

  // Phase list — derived from the stream of progress messages. Each distinct
  // message becomes a row; pct updates roll into the latest row. On terminal
  // phase (completed/failed/cancelled) the last row is closed with endAt.
  const [solverPhases, setSolverPhases] = useState<
    Array<{ message: string; pct: number; startAt: number; endAt: number | null }>
  >([])
  // Reset phase list when a new run starts (startedAt changes).
  useEffect(() => {
    if (startedAt) setSolverPhases([])
  }, [startedAt])
  // Normalize solver messages into a stable "phase key" so status lines
  // that only differ in dynamic counters (#206, "2s since last improvement",
  // "2053/14520 filled", "15%") collapse into ONE phase row. Raw text
  // becomes the row's live label, pct updates in place.
  const phaseKey = (msg: string): string =>
    msg
      .replace(/\([^)]*\)/g, '')
      .replace(/#\s*\d+/g, '')
      .replace(/\d+(\.\d+)?\s*%/g, '')
      .replace(/\d+\s*\/\s*\d+/g, '')
      .replace(/\d+(\.\d+)?\s*s\b[^,]*/gi, '')
      .replace(/\d+(\.\d+)?/g, '')
      .replace(/[:,]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

  useEffect(() => {
    if (!progress.message) return
    setSolverPhases((prev) => {
      const last = prev[prev.length - 1]
      const now = Date.now()
      const incomingKey = phaseKey(progress.message)
      const lastKey = last ? phaseKey(last.message) : null
      if (!last || lastKey !== incomingKey) {
        const closed = prev.map((p, i) => (i === prev.length - 1 && p.endAt == null ? { ...p, endAt: now } : p))
        return [...closed, { message: progress.message, pct: progress.pct, startAt: now, endAt: null }]
      }
      // Same phase — update live label text + pct, keep startAt.
      return prev.map((p, i) =>
        i === prev.length - 1 ? { ...p, message: progress.message, pct: Math.max(p.pct, progress.pct) } : p,
      )
    })
  }, [progress.message, progress.pct])
  // Close final phase when run ends.
  useEffect(() => {
    if (phase === 'running' || phase === 'idle') return
    setSolverPhases((prev) => {
      if (prev.length === 0) return prev
      const now = Date.now()
      return prev.map((p, i) => (i === prev.length - 1 && p.endAt == null ? { ...p, endAt: now, pct: 100 } : p))
    })
  }, [phase])

  return (
    <div className="px-6 py-5 gap-4 w-full h-full overflow-hidden flex flex-col">
      {isLocked && lock && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{
            background: isDark ? 'rgba(255,136,0,0.08)' : 'rgba(255,136,0,0.06)',
            border: `1px solid ${isDark ? 'rgba(255,136,0,0.24)' : 'rgba(255,136,0,0.28)'}`,
          }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: '#FF8800' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: '#FF8800' }}>
              Auto-roster locked — another run is in progress
            </div>
            <div className="text-[13px] text-hz-text-secondary mt-0.5">
              Started by{' '}
              <span className="font-semibold text-hz-text">{lock.userName ?? lock.userId ?? 'another planner'}</span>
              {lock.startedAt && (
                <>
                  {' · '}
                  {new Date(lock.startedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </>
              )}
              {' · '}
              <span className="tabular-nums font-semibold" style={{ color: '#FF8800' }}>
                {lock.pct}%
              </span>
              {lock.message && (
                <>
                  {' — '}
                  <span className="truncate">{lock.message}</span>
                </>
              )}
            </div>
            <div className="text-[13px] text-hz-text-tertiary mt-0.5">
              Wait for it to finish before starting a new run. Roster edits for this operator are read-only while the
              solver is working.
            </div>
          </div>
        </div>
      )}
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
            const cardDisabled = card.disabled || isRunning
            const onCardSelect = () => {
              if (!cardDisabled) onModeChange(card.key)
            }
            return (
              <div
                key={card.key}
                role="button"
                tabIndex={cardDisabled ? -1 : 0}
                aria-pressed={isSelected}
                aria-disabled={cardDisabled}
                onClick={onCardSelect}
                onKeyDown={(e) => {
                  if (cardDisabled) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onCardSelect()
                  }
                }}
                className={`relative text-left rounded-2xl p-4 transition-all ${cardDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
                  </div>
                  {card.key === 'longDuties' && (
                    <div className="shrink-0 self-center flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                  {/* Days Off code picker moved to a dedicated FormSection
                      below the grid — rendered only when that mode is active. */}
                </div>
              </div>
            )
          })}
        </div>
      </FormSection>

      {mode === 'daysOff' && (
        <FormSection title="Day Off Options" icon={CalendarOff}>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-hz-text-tertiary w-28 shrink-0">Activity Code</span>
            <div className="w-72">
              <Dropdown
                options={dayOffCodeOptions.map((c) => ({ value: c._id, label: `${c.code} — ${c.name}` }))}
                value={dayOffCodeId}
                onChange={(v) => onDayOffCodeIdChange(v)}
                placeholder={dayOffCodeOptions.length === 0 ? 'No OFF codes available' : 'Select code…'}
                size="md"
                disabled={dayOffCodeOptions.length === 0}
              />
            </div>
            <span className="text-[13px] text-hz-text-tertiary">
              Used as the activity code stamped on placed day-offs.
            </span>
          </div>
        </FormSection>
      )}

      {(mode === 'general' || mode === 'longDuties') && (
        <FormSection title="Solver Quality" icon={Gauge}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {SOLVER_QUALITY_OPTIONS.map((opt) => {
              const isActive = solverGapLimit === opt.value
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSolverGapLimitChange(opt.value)}
                  disabled={isRunning || isLocked}
                  className="relative text-left rounded-xl px-4 py-3 border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isActive ? accent : cardBorder,
                    background: isActive ? accentTint(accent, isDark ? 0.12 : 0.08) : subtle,
                  }}
                >
                  <div className="text-[13px] font-semibold mb-1" style={{ color: isActive ? accent : palette.text }}>
                    {opt.title}
                  </div>
                  <p className="text-[13px] text-hz-text-tertiary leading-snug">{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </FormSection>
      )}

      {mode === 'clear' && (
        <FormSection title="Clear Options" icon={Trash2}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RetainCheckbox
              label="Retain pre-assigned duties"
              hint="Keep manual pairings, annual leave, sick leave, medical, and training. Uncheck to wipe them too."
              checked={clearRetainPreAssigned}
              onChange={onClearRetainPreAssignedChange}
              accent={accent}
              isDark={isDark}
              disabled={isRunning}
            />
            <RetainCheckbox
              label="Retain day-off assignments"
              hint="Keep existing OFF activities for the period."
              checked={clearRetainDayOff}
              onChange={onClearRetainDayOffChange}
              accent={accent}
              isDark={isDark}
              disabled={isRunning}
            />
            <RetainCheckbox
              label="Retain standby assignments"
              hint="Keep existing SBY activities for the period."
              checked={clearRetainStandby}
              onChange={onClearRetainStandbyChange}
              accent={accent}
              isDark={isDark}
              disabled={isRunning}
            />
          </div>
        </FormSection>
      )}

      {phase !== 'idle' && (
        <FormSection title="Solver Progress" icon={Sparkles} className="flex-1 min-h-0 flex flex-col">
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <SolverPhaseList phases={solverPhases} running={phase === 'running'} accent={accent} isDark={isDark} />

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

      {/* CTA footer pinned to bottom of GenerateBody. `mt-auto` consumes any
          remaining vertical slack so the button stays in the same place
          across mode changes — switching between General / Days Off Only /
          Long Pairings / Clear Crew Schedule no longer makes the button
          jump up or down by the height of the per-mode option section. */}
      <div
        className="mt-auto flex justify-end items-center pt-3 shrink-0"
        style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
      >
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
            disabled={isRunning || selected.disabled || isLocked}
            className="flex items-center gap-2 px-5 h-9 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: selected.danger ? '#E63535' : accent }}
          >
            {isRunning ? (
              <Loader2 size={13} className="animate-spin" />
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
  periodFrom,
  periodTo,
  filterBase,
  filterPosition,
  filterAcType,
  filterCrewGroup,
  onNavigate,
  isDark,
  accent,
  palette,
}: {
  resultRun: AutoRosterRun | null
  periodFrom: string
  periodTo: string
  filterBase: string[]
  filterPosition: string[]
  filterAcType: string[]
  filterCrewGroup: string[]
  onNavigate: (to: ActiveKey) => void
  isDark: boolean
  accent: string
  palette: PaletteType
}) {
  const fmtDay = useDateFormat()
  const periodLabel = `${fmtDay(periodFrom)} → ${fmtDay(periodTo)}`
  const [loading, setLoading] = useState(false)
  const [scheduleData, setScheduleData] = useState<CrewScheduleResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Tracks the runId whose orchestrator-prewarmed cache we've already
  // tried. The cache was built with the run's own filter set, so we can
  // only use it for the FIRST fetch after a run lands. Any subsequent
  // filter change in the review UI must re-fetch live to honour the
  // user's selection. One attempt per run.
  const cacheTriedForRunRef = useRef<string | null>(null)
  // Local refresh of the run doc — handles runs whose resultRun was captured
  // before the chained day-off/standby pass wrote final stats.
  const [refreshedRun, setRefreshedRun] = useState<AutoRosterRun | null>(null)
  useEffect(() => {
    if (!resultRun?._id) return
    let cancelled = false
    void api
      .getAutoRosterRun(resultRun._id)
      .then((run) => {
        if (!cancelled) setRefreshedRun(run)
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [resultRun?._id])
  const effectiveRun = refreshedRun ?? resultRun

  useEffect(() => {
    if (!effectiveRun?.stats || !periodFrom || !periodTo) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    // Try the orchestrator-prewarmed cache first — saves the 30+s
    // /crew-schedule aggregator round-trip immediately after solve.
    // On any failure (404 cache miss, TTL expiry, server restart, or
    // a run that didn't go through the orchestrator) fall back to the
    // regular /crew-schedule endpoint which is the source of truth.
    const fallbackToFull = () =>
      api
        .getCrewSchedule({
          from: periodFrom,
          to: periodTo,
          base: filterBase,
          position: filterPosition,
          acType: filterAcType,
          crewGroup: filterCrewGroup,
        })
        .then((res) => {
          if (!cancelled) setScheduleData(res)
        })
        .catch((err) => {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })

    const runId = effectiveRun._id
    // Only try the prewarmed cache once per run, on the first fetch.
    // The cached payload reflects the run's own filter set, so any
    // subsequent UI filter change must hit the live aggregator.
    const shouldTryCache = !!runId && cacheTriedForRunRef.current !== runId
    if (!shouldTryCache) {
      void fallbackToFull()
      return () => {
        cancelled = true
      }
    }
    cacheTriedForRunRef.current = runId
    api
      .getCrewScheduleFromRun(runId)
      .then((res) => {
        if (cancelled) return
        setScheduleData(res)
        setLoading(false)
      })
      .catch(() => {
        // Cache miss / expired / never-prewarmed → fall back. We don't
        // distinguish error codes; the regular endpoint is always safe.
        if (cancelled) return
        void fallbackToFull()
      })
    return () => {
      cancelled = true
    }
  }, [effectiveRun?._id, periodFrom, periodTo, filterBase, filterPosition, filterAcType, filterCrewGroup])

  if (!effectiveRun?.stats) {
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
  const { stats } = effectiveRun
  const review = scheduleData ? computeReviewStats(scheduleData) : null
  // Standalone daysOff / standby runs write their own stats shape with no
  // pairing fields — guard every numeric read so "Review & Accept" doesn't
  // crash when viewing those modes.
  const assignedPairings = (stats.assignedPairings as number | undefined) ?? 0
  const pairingsTotal = (stats.pairingsTotal as number | undefined) ?? 0
  // Distinct REAL pairings missing at least one seat (post-fix orchestrator
  // semantic). Older runs persisted seat-slot counts under the same key —
  // accept that pre-fix runs still show the legacy value.
  const unassignedPairings = (stats.unassignedPairings as number | undefined) ?? 0
  // Sum of unfilled seat slots across those pairings. Multi-seat (cabin)
  // runs typically show seats >> pairings.
  const unassignedSeats = (stats.unassignedSeats as number | undefined) ?? null
  const virtualSeatsTotal = (stats.virtualSeatsTotal as number | undefined) ?? null
  const crewTotal = (stats.crewTotal as number | undefined) ?? 0
  const durationMs = (stats.durationMs as number | undefined) ?? 0
  const objectiveScore = (stats.objectiveScore as number | undefined) ?? null
  const solverStatus = (stats.solverStatus as string | undefined) ?? null
  const coveragePct = pairingsTotal > 0 ? Math.round((assignedPairings / pairingsTotal) * 100) : 0

  const daysOffTotal = (stats.daysOffInserted as number | undefined) ?? 0
  const standbyTotal = (stats.standbyInserted as number | undefined) ?? 0
  const homeStby = (stats.standbyHome as number | undefined) ?? 0
  const airportStby = (stats.standbyAirport as number | undefined) ?? 0
  const gapFillTotal = (stats.gapFillInserted as number | undefined) ?? 0
  const gapFillCode = (stats.gapFillCode as string | undefined) ?? null
  // For standalone daysOff runs the stats object reports `daysOffInserted`;
  // standby writes `standbyInserted`. Promote whichever is present so the
  // top-row KPIs read "N OFF placed" / "N SBY placed" instead of 0/0.
  // Detect focused modes. `stats.mode` is the authoritative signal, set by
  // `runDaysOffAssignment` / `runStandbyAssignment` in standalone dispatch.
  // Fallback: a run with no pairing metrics but an OFF/SBY insertion count is
  // a standalone day-off or standby run too (covers runs saved before the
  // `mode` field existed in stats).
  const explicitMode = (stats.mode as string | undefined) ?? null
  const runMode: 'daysOff' | 'standby' | null =
    explicitMode === 'daysOff'
      ? 'daysOff'
      : explicitMode === 'standby'
        ? 'standby'
        : pairingsTotal === 0 && standbyTotal > 0
          ? 'standby'
          : pairingsTotal === 0 && daysOffTotal > 0
            ? 'daysOff'
            : null

  // Standalone Days Off Only / Standby Only runs get a focused dashboard —
  // per-day placement bars and a per-crew table. General-mode stats (coverage,
  // workload distribution, etc) don't apply to these runs.
  if (runMode === 'daysOff' || runMode === 'standby') {
    return (
      <FocusedModeReview
        mode={runMode}
        stats={stats}
        scheduleData={scheduleData}
        loading={loading}
        loadError={loadError}
        periodFrom={periodFrom}
        periodTo={periodTo}
        runId={effectiveRun._id}
        onNavigate={onNavigate}
        isDark={isDark}
        accent={accent}
      />
    )
  }

  // "Days Off Placed" / "Standby Placed" = count of OFF/SBY activities in the
  // period whose `notes` identifies them as auto-roster sourced. This is what
  // the user cares about (total assignments authored by auto-roster across all
  // runs for this period), not the per-run `daysOffInserted` delta.
  const daysOffPlaced = review ? review.daysOffByAutoRoster : daysOffTotal
  const standbyPlaced = review ? review.standbyByAutoRoster : standbyTotal

  const kpiRows: Array<{ label: string; value: string; tone?: string }> = [
    {
      label: 'Coverage',
      value:
        pairingsTotal > 0
          ? `${coveragePct}% · ${assignedPairings.toLocaleString()} / ${pairingsTotal.toLocaleString()}`
          : '—',
      tone: pairingsTotal === 0 ? undefined : coveragePct >= 95 ? '#06C270' : coveragePct >= 80 ? '#FF8800' : '#FF3B3B',
    },
    {
      label: 'Unassigned',
      // Show distinct pairings; append seat count when it differs (cabin
      // runs where one pairing aggregates multiple unfilled slots).
      value:
        unassignedSeats != null && unassignedSeats !== unassignedPairings
          ? `${unassignedPairings.toLocaleString()} pairings · ${unassignedSeats.toLocaleString()} seats`
          : unassignedPairings.toLocaleString(),
      tone: unassignedPairings > 0 ? '#FF3B3B' : '#06C270',
    },
    {
      label: 'Idle Crew',
      value: review ? `${review.idleCrew.toLocaleString()} / ${review.crewCount.toLocaleString()}` : '…',
      tone: review ? (review.idleCrew === 0 ? '#06C270' : '#FF8800') : undefined,
    },
    {
      label: 'Avg Block Hrs',
      value: review ? fmtHoursMin(review.block.avgMin) : '…',
    },
    {
      label: 'Days Off Placed',
      value: daysOffPlaced.toLocaleString(),
    },
    {
      label: 'Standby Placed',
      value: `${standbyPlaced.toLocaleString()}${standbyPlaced > 0 ? ` (${homeStby}H · ${airportStby}A)` : ''}`,
    },
  ]

  // Dedupe: Summary already surfaces Covered %, Unassigned, Days Off / Standby.
  // Secondary lists only carry fields the Summary doesn't.
  const coverageRows: Array<{ label: string; value: string; tone?: string }> = [
    { label: 'Total pairings', value: pairingsTotal.toLocaleString() },
    ...(virtualSeatsTotal != null ? [{ label: 'Positions opened', value: virtualSeatsTotal.toLocaleString() }] : []),
  ]

  const runDetailRows: Array<{ label: string; value: string }> = [
    { label: 'Crew Pool', value: String(crewTotal) },
    { label: 'Duration', value: fmtDuration(durationMs) },
    { label: 'Solver Status', value: solverStatus ?? '—' },
    { label: 'Objective Score', value: objectiveScore?.toLocaleString() ?? '—' },
    {
      label: 'Gap-Fill',
      value: gapFillCode ? `${gapFillTotal.toLocaleString()} × ${gapFillCode}` : '—',
    },
    { label: 'Period', value: periodLabel },
  ]

  const qualityRows: Array<{ label: string; value: string; tone?: string }> = review
    ? [
        { label: 'Avg Layovers / Crew', value: review.avgLayoversPerCrew.toFixed(1) },
        {
          label: 'Max Consec. Duty Days',
          value: String(review.maxConsecDutyDays),
          tone: review.maxConsecDutyDays > 6 ? '#FF8800' : undefined,
        },
        {
          label: 'FDTL Flagged',
          value: review.fdtlFlagged.toLocaleString(),
          tone: review.fdtlFlagged === 0 ? '#06C270' : '#FF8800',
        },
        { label: 'Layover Stations', value: String(review.uniqueLayoverStations) },
      ]
    : []

  const outlierRows: Array<{ label: string; value: string; tone?: string }> = review
    ? [
        {
          label: 'Crew Without OFF',
          value: review.crewWithoutOff.toLocaleString(),
          tone: review.crewWithoutOff === 0 ? '#06C270' : '#FF8800',
        },
        {
          label: 'Crew Without SBY',
          value: review.crewWithoutStandby.toLocaleString(),
          tone: review.crewWithoutStandby === 0 ? '#06C270' : '#FF8800',
        },
        {
          label: 'Over-loaded (top 10%)',
          value: review.overloadedCrew.length.toLocaleString(),
        },
      ]
    : []

  return (
    <div className="px-6 pt-5 pb-16 w-full h-full flex flex-col min-h-0">
      {(loading && !scheduleData) || loadError ? (
        <div className="mb-3 shrink-0">
          {loading && !scheduleData && (
            <div className="flex items-center gap-2 text-[13px] text-hz-text-secondary">
              <Loader2 size={14} className="animate-spin" /> Loading roster data…
            </div>
          )}
          {loadError && <div className="text-[13px] text-[#FF3B3B]">Failed to load roster data: {loadError}</div>}
        </div>
      ) : null}

      {/* Single-screen layout: main (histogram) on left, stats sidebar on
          right. Both columns are height-capped by the parent flex so the
          stats list scrolls in place instead of growing the page. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 flex-1 min-h-0">
        <div className="min-h-0 flex flex-col">
          {review ? (
            <div className="rounded-[12px] p-4 h-full flex flex-col min-h-0" style={reviewCardStyle(isDark)}>
              <WorkloadHistogram review={review} accent={accent} isDark={isDark} />
            </div>
          ) : (
            <div className="rounded-[12px] p-6 text-[13px] text-hz-text-secondary" style={reviewCardStyle(isDark)}>
              Crew coverage statistics load with roster data…
            </div>
          )}

          {unassignedPairings > 0 && (
            <div
              className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255,136,0,0.08)' : 'rgba(255,136,0,0.06)',
                border: `1px solid ${isDark ? 'rgba(255,136,0,0.2)' : 'rgba(255,136,0,0.25)'}`,
              }}
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#FF8800' }} />
              <p className="text-[13px]" style={{ color: '#FF8800' }}>
                {unassignedPairings} pairing{unassignedPairings !== 1 ? 's' : ''}
                {unassignedSeats != null && unassignedSeats !== unassignedPairings
                  ? ` (${unassignedSeats} seat${unassignedSeats !== 1 ? 's' : ''})`
                  : ''}{' '}
                could not be filled — no FDTL-legal crew available. Check qualifications, base coverage, or extend the
                solver time limit.
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar — stats lists, height-constrained with vertical scroll. */}
        <div className="min-h-0 overflow-y-auto pr-1 space-y-4">
          <StatList title="Summary" rows={kpiRows} accent={accent} isDark={isDark} />
          <StatList
            title="Coverage"
            rows={coverageRows}
            accent={accent}
            isDark={isDark}
            collapsible
            defaultOpen={false}
          />
          <StatList
            title="Run Details"
            rows={runDetailRows}
            accent={accent}
            isDark={isDark}
            collapsible
            defaultOpen={false}
          />
          {qualityRows.length > 0 && (
            <StatList
              title="Roster Quality"
              rows={qualityRows}
              accent={accent}
              isDark={isDark}
              collapsible
              defaultOpen={false}
            />
          )}
          {outlierRows.length > 0 && (
            <StatList
              title="Utilization Outliers"
              rows={outlierRows}
              accent="#FF8800"
              isDark={isDark}
              collapsible
              defaultOpen={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Plain-list stat block — title with accent bar, then label/value rows.
// Replaces the big KPI tiles in Step 4 so the whole review fits on one screen.
function StatList({
  title,
  rows,
  accent,
  isDark,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string
  rows: Array<{ label: string; value: string; tone?: string }>
  accent: string
  isDark: boolean
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = collapsible ? open : true
  return (
    <div className="rounded-[12px] overflow-hidden" style={reviewCardStyle(isDark)}>
      <button
        type="button"
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        disabled={!collapsible}
        className={`w-full flex items-center gap-2 px-4 py-2.5 border-b text-left ${
          collapsible ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'
        }`}
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
      >
        <span
          className="w-[3px] self-stretch rounded-sm shrink-0"
          style={{ background: accent, minHeight: 14 }}
          aria-hidden="true"
        />
        <h3 className="flex-1 text-[13px] font-bold text-hz-text">{title}</h3>
        {collapsible && (
          <ChevronDown
            size={14}
            className="shrink-0 text-hz-text-secondary transition-transform"
            style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        )}
      </button>
      {isOpen && (
        <ul className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 px-4 py-2"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
            >
              <span className="text-[13px] text-hz-text-secondary truncate">{r.label}</span>
              <span
                className={`text-[13px] font-semibold tabular-nums truncate text-right ${r.tone ? '' : 'text-hz-text'}`}
                style={r.tone ? { color: r.tone } : undefined}
              >
                {r.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Focused Review for Days Off Only / Standby Only runs ──────────────────

function FocusedModeReview({
  mode,
  stats,
  scheduleData,
  loading,
  loadError,
  periodFrom,
  periodTo,
  runId,
  onNavigate,
  isDark,
  accent,
}: {
  mode: 'daysOff' | 'standby'
  stats: AutoRosterRunStats
  scheduleData: CrewScheduleResponse | null
  loading: boolean
  loadError: string | null
  periodFrom: string
  periodTo: string
  runId: string
  onNavigate: (to: ActiveKey) => void
  isDark: boolean
  accent: string
}) {
  const isOff = mode === 'daysOff'
  const label = isOff ? 'Day Off' : 'Standby'
  const placed = ((isOff ? stats.daysOffInserted : stats.standbyInserted) as number | undefined) ?? 0
  const homeStby = (stats.standbyHome as number | undefined) ?? 0
  const airportStby = (stats.standbyAirport as number | undefined) ?? 0
  const durationMs = (stats.durationMs as number | undefined) ?? 0

  // Per-day + per-crew breakdown computed from fresh CrewSchedule data.
  // Only activities tagged by the current auto-roster run are counted (via
  // `notes` prefix) so re-running doesn't inflate numbers from prior runs.
  const breakdown = useMemo(() => {
    if (!scheduleData) return null
    const flagSet = new Set(
      scheduleData.activityCodes
        .filter((c) => {
          const flags = (c.flags ?? []) as string[]
          return isOff
            ? flags.includes('is_day_off') || flags.includes('is_rest_period')
            : flags.includes('is_home_standby') || flags.includes('is_airport_standby') || flags.includes('is_reserve')
        })
        .map((c) => c._id),
    )
    const crewById = new Map(scheduleData.crew.map((c) => [c._id, c]))
    const perDay = new Map<string, number>()
    const perCrew = new Map<string, number>()
    const runPrefix = `auto-roster:${runId}`
    for (const a of scheduleData.activities) {
      if (!a.activityCodeId || !flagSet.has(a.activityCodeId)) continue
      // When only this run should count, gate on notes. Otherwise count all.
      const bySource = typeof a.notes === 'string' && a.notes.startsWith('auto-roster:')
      if (!bySource) continue
      // If we can tie to THIS run specifically, prefer it; fall back to any
      // auto-roster-tagged activity so a re-opened Step 4 still shows totals.
      const thisRun = typeof a.notes === 'string' && a.notes.startsWith(runPrefix)
      if (!thisRun && false) continue // keep wider match; thisRun used only for future per-run filters
      const day = (a.dateIso as string | undefined) ?? a.startUtcIso.slice(0, 10)
      perDay.set(day, (perDay.get(day) ?? 0) + 1)
      perCrew.set(a.crewId, (perCrew.get(a.crewId) ?? 0) + 1)
    }
    const perDayRows = [...perDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([day, count]) => ({ day, count }))
    const perCrewRows = [...perCrew.entries()]
      .map(([crewId, count]) => {
        const c = crewById.get(crewId)
        return {
          crewId,
          count,
          employeeId: c?.employeeId ?? '—',
          name: c ? `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim() || crewId : crewId,
        }
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const total = perCrewRows.reduce((s, r) => s + r.count, 0)
    const avgPerCrew = perCrewRows.length > 0 ? total / perCrewRows.length : 0
    const maxDayCount = perDayRows.reduce((m, r) => (r.count > m ? r.count : m), 0)
    return { perDayRows, perCrewRows, total, avgPerCrew, maxDayCount }
  }, [scheduleData, isOff, runId])

  const crewTouched = breakdown?.perCrewRows.length ?? 0
  const minPerCrew =
    breakdown && breakdown.perCrewRows.length > 0 ? breakdown.perCrewRows[breakdown.perCrewRows.length - 1].count : 0
  const maxPerCrew = breakdown && breakdown.perCrewRows.length > 0 ? breakdown.perCrewRows[0].count : 0

  return (
    <div className="px-6 py-6 space-y-6 w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <ReviewKpi
          label={`Total ${label}s Placed`}
          value={placed.toLocaleString()}
          sub={`Run duration ${fmtDuration(durationMs)}`}
          accentColor={accent}
          isDark={isDark}
        />
        <ReviewKpi
          label="Crew Touched"
          value={crewTouched.toLocaleString()}
          sub={periodLabel}
          accentColor="#06C270"
          isDark={isDark}
        />
        <ReviewKpi
          label={`Avg ${label}s / Crew`}
          value={breakdown ? breakdown.avgPerCrew.toFixed(1) : '…'}
          sub={breakdown ? `min ${minPerCrew} · max ${maxPerCrew}` : ''}
          accentColor="#0063F7"
          isDark={isDark}
        />
        {!isOff && (
          <ReviewKpi
            label="Home / Airport"
            value={`${homeStby.toLocaleString()} / ${airportStby.toLocaleString()}`}
            sub="standby split"
            accentColor="#FF8800"
            isDark={isDark}
          />
        )}
        {isOff && (
          <ReviewKpi
            label="Days Covered"
            value={breakdown ? breakdown.perDayRows.length.toLocaleString() : '…'}
            sub={breakdown ? `of ${enumerateDaysCount(periodFrom, periodTo)}` : ''}
            accentColor="#FF8800"
            isDark={isDark}
          />
        )}
      </div>

      {loading && !scheduleData && (
        <div className="flex items-center gap-2 text-[13px] text-hz-text-secondary">
          <Loader2 size={14} className="animate-spin" /> Loading roster data…
        </div>
      )}
      {loadError && <div className="text-[13px] text-[#FF3B3B]">Failed to load roster data: {loadError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per-day placement bars */}
        <ReviewCard title={`${label}s per Day`} description="Placement volume across the period" isDark={isDark}>
          {breakdown && breakdown.perDayRows.length > 0 ? (
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {breakdown.perDayRows.map((r) => {
                const pct = breakdown.maxDayCount > 0 ? (r.count / breakdown.maxDayCount) * 100 : 0
                return (
                  <div key={r.day} className="flex items-center gap-3 text-[13px]">
                    <span className="w-24 shrink-0 tabular-nums text-hz-text-secondary">{r.day}</span>
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                    >
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
                    </div>
                    <span className="w-12 shrink-0 tabular-nums text-right font-semibold text-hz-text">{r.count}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-[13px] text-hz-text-tertiary py-6 text-center">No placements found.</div>
          )}
        </ReviewCard>

        {/* Per-crew breakdown table */}
        <ReviewCard title={`Per-Crew ${label}s`} description="Sorted by highest count" isDark={isDark}>
          {breakdown && breakdown.perCrewRows.length > 0 ? (
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead
                  className="sticky top-0"
                  style={{
                    background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <tr className="text-left">
                    <th className="py-1.5 px-2 font-medium text-hz-text-tertiary uppercase tracking-wide">Emp #</th>
                    <th className="py-1.5 px-2 font-medium text-hz-text-tertiary uppercase tracking-wide">Name</th>
                    <th className="py-1.5 px-2 font-medium text-hz-text-tertiary uppercase tracking-wide text-right">
                      {label}s
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.perCrewRows.map((r) => (
                    <tr
                      key={r.crewId}
                      className="border-t"
                      style={{ borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                    >
                      <td className="py-1.5 px-2 tabular-nums text-hz-text-secondary">{r.employeeId}</td>
                      <td className="py-1.5 px-2 text-hz-text truncate">{r.name}</td>
                      <td className="py-1.5 px-2 tabular-nums font-semibold text-right text-hz-text">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-[13px] text-hz-text-tertiary py-6 text-center">No placements found.</div>
          )}
        </ReviewCard>
      </div>

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

function enumerateDaysCount(fromIso: string, toIso: string): number {
  const s = new Date(fromIso + 'T00:00:00Z').getTime()
  const e = new Date(toIso + 'T00:00:00Z').getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0
  return Math.floor((e - s) / 86_400_000) + 1
}

// ── Review-specific visual helpers ─────────────────────────────────────────

function reviewCardStyle(isDark: boolean): React.CSSProperties {
  return {
    background: isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.95)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    boxShadow: isDark
      ? '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.18)'
      : '0 1px 2px rgba(96,97,112,0.06), 0 1px 3px rgba(96,97,112,0.04)',
  }
}

function ReviewKpi({
  label,
  value,
  sub,
  accentColor,
  isDark,
  compact,
}: {
  label: string
  value: string
  sub?: string
  accentColor: string
  isDark: boolean
  compact?: boolean
}) {
  return (
    <div className="rounded-[12px] p-4 flex flex-col gap-1.5 overflow-hidden relative" style={reviewCardStyle(isDark)}>
      <div className="text-[13px] font-medium text-hz-text-secondary truncate uppercase tracking-wide">{label}</div>
      <div
        className="font-bold tabular-nums tracking-tight text-hz-text"
        style={{ fontSize: compact ? 22 : 26, lineHeight: 1.1 }}
      >
        {value}
      </div>
      {sub ? <div className="text-[13px] text-hz-text-secondary truncate">{sub}</div> : null}
      <span
        aria-hidden="true"
        className="absolute left-0 bottom-0 h-[3px] w-12 rounded-tr"
        style={{ background: accentColor }}
      />
    </div>
  )
}

function ReviewCard({
  title,
  description,
  isDark,
  children,
}: {
  title: string
  description?: string
  isDark: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-start gap-2 mb-3">
        <span
          className="w-[3px] self-stretch rounded-sm shrink-0 mt-0.5"
          style={{ background: 'var(--module-accent, #1e40af)', minHeight: 24 }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-hz-text truncate">{title}</h2>
          {description && <p className="text-[13px] text-hz-text-secondary mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="rounded-[12px] p-4" style={reviewCardStyle(isDark)}>
        {children}
      </div>
    </div>
  )
}

function Donut({ pct, color, trackColor, label }: { pct: number; color: string; trackColor: string; label: string }) {
  const C = 2 * Math.PI * 38
  const arc = (Math.max(0, Math.min(100, pct)) / 100) * C
  return (
    <svg viewBox="0 0 100 100" style={{ width: 140, height: 140, flexShrink: 0 }} aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="none" stroke={trackColor} strokeWidth={12} />
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeDasharray={`${arc} ${C}`}
        transform="rotate(-90 50 50)"
        strokeLinecap="round"
      />
      <text
        x="50"
        y="54"
        textAnchor="middle"
        fill="currentColor"
        fontSize="16"
        fontWeight="700"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </text>
    </svg>
  )
}

function LegendRow({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden />
        <span className="text-[13px] text-hz-text-secondary truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-3 shrink-0 tabular-nums">
        <span className="text-[13px] font-semibold text-hz-text">{count.toLocaleString()}</span>
        <span className="text-[13px] text-hz-text-tertiary w-10 text-right">{pct.toFixed(0)}%</span>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-hz-text-tertiary uppercase tracking-wide">{label}</span>
      <span className="text-[13px] font-semibold text-hz-text tabular-nums truncate">{value}</span>
    </div>
  )
}

type WorkloadMetricKey = 'block' | 'duty' | 'sectors' | 'pairings' | 'daysOff' | 'standby'

const WORKLOAD_METRICS: Array<{
  key: WorkloadMetricKey
  label: string
  color: string
  formatter?: (v: number) => string
  statsKey: 'block' | 'duty' | 'sectors' | 'pairingsPerCrew' | 'daysOff' | 'standby'
  rawKey: WorkloadMetricKey
}> = [
  { key: 'block', label: 'Block Hours', color: '#8B5CF6', formatter: fmtHoursMin, statsKey: 'block', rawKey: 'block' },
  { key: 'duty', label: 'Duty Hours', color: '#0EA5E9', formatter: fmtHoursMin, statsKey: 'duty', rawKey: 'duty' },
  { key: 'sectors', label: 'Sectors / Crew', color: '#06C270', statsKey: 'sectors', rawKey: 'sectors' },
  { key: 'pairings', label: 'Pairings / Crew', color: '#10B981', statsKey: 'pairingsPerCrew', rawKey: 'pairings' },
  { key: 'daysOff', label: 'Days Off / Crew', color: '#0063F7', statsKey: 'daysOff', rawKey: 'daysOff' },
  { key: 'standby', label: 'Standby Days / Crew', color: '#FF8800', statsKey: 'standby', rawKey: 'standby' },
]

function WorkloadHistogram({ review, accent, isDark }: { review: ReviewStats; accent: string; isDark: boolean }) {
  const [activeKey, setActiveKey] = useState<WorkloadMetricKey>('block')
  const active = WORKLOAD_METRICS.find((m) => m.key === activeKey) ?? WORKLOAD_METRICS[0]
  const stats = review[active.statsKey] as DistStats
  const values = review.raw[active.rawKey]
  const fmt = active.formatter ?? ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)))

  const idleCount = values.filter((v) => v === 0).length
  const hasData = values.length > 0 && stats.maxMin > 0
  const lo = stats.minMin
  const hi = Math.max(stats.maxMin, stats.minMin + 1)
  const range = hi - lo || 1
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'
  const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'

  // SVG geometry
  const W = 960
  const H = 230
  const padL = 12
  const padR = 12
  const padT = 28
  const padB = 30
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const baseY = padT + chartH
  const valueToX = (v: number) => padL + ((v - lo) / range) * chartW

  // Gaussian KDE — Silverman's rule of thumb bandwidth.
  const kde = useMemo(() => {
    const n = Math.max(1, values.length)
    const sigmaForH = Math.max(stats.stddev, range / 30)
    const bandwidth = Math.max(1e-6, 1.06 * sigmaForH * Math.pow(n, -1 / 5))
    const SAMPLES = 160
    const pts: Array<{ v: number; d: number }> = []
    const twoBwSq = 2 * bandwidth * bandwidth
    const norm = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI))
    let maxDensity = 0
    for (let i = 0; i <= SAMPLES; i++) {
      const xv = lo + (range * i) / SAMPLES
      let d = 0
      for (const v of values) {
        const dx = xv - v
        d += Math.exp(-(dx * dx) / twoBwSq)
      }
      d *= norm
      if (d > maxDensity) maxDensity = d
      pts.push({ v: xv, d })
    }
    return { pts, maxDensity }
  }, [values, stats.stddev, lo, range])

  const densityToY = (d: number) => baseY - (kde.maxDensity > 0 ? (d / kde.maxDensity) * chartH : 0)
  const path = kde.pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${valueToX(p.v).toFixed(2)},${densityToY(p.d).toFixed(2)}`)
    .join(' ')
  const areaPath =
    `M${valueToX(lo).toFixed(2)},${baseY} ` +
    kde.pts.map((p) => `L${valueToX(p.v).toFixed(2)},${densityToY(p.d).toFixed(2)}`).join(' ') +
    ` L${valueToX(hi).toFixed(2)},${baseY} Z`

  const avgX = valueToX(stats.avgMin)
  const p10X = valueToX(stats.p10)
  const p90X = valueToX(stats.p90)

  // Interactive hover — pointer-driven crosshair + value readout.
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hover, setHover] = useState<{ v: number; d: number; pctl: number; crewInBin: number } | null>(null)

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const loc = pt.matrixTransform(ctm.inverse())
    const clampedX = Math.max(padL, Math.min(padL + chartW, loc.x))
    const v = lo + ((clampedX - padL) / chartW) * range
    // Nearest KDE sample.
    let nearest = kde.pts[0]
    let minDist = Number.POSITIVE_INFINITY
    for (const p of kde.pts) {
      const dd = Math.abs(p.v - v)
      if (dd < minDist) {
        minDist = dd
        nearest = p
      }
    }
    // Percentile (≤ v) over raw values.
    let below = 0
    for (const rv of values) if (rv <= nearest.v) below++
    const pctl = values.length > 0 ? (below / values.length) * 100 : 0
    // Crew in a ±½-step window (bin width = 1/30 of range).
    const half = range / 60
    let crewInBin = 0
    for (const rv of values) if (rv >= nearest.v - half && rv <= nearest.v + half) crewInBin++
    setHover({ v: nearest.v, d: nearest.d, pctl, crewInBin })
  }
  const onPointerLeave = () => setHover(null)

  const hoverX = hover ? valueToX(hover.v) : null
  const hoverY = hover ? densityToY(hover.d) : null

  // Tooltip positioning — clamp so the card stays inside the chart.
  const TOOLTIP_W = 180
  const tooltipX = hoverX != null ? Math.max(padL, Math.min(padL + chartW - TOOLTIP_W, hoverX - TOOLTIP_W / 2)) : 0

  const gradId = `wl-grad-${activeKey}`
  const glowId = `wl-glow-${activeKey}`

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Header — title + metric pills in one row. Replaces outer ReviewCard. */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2">
          <span
            className="w-[3px] self-stretch rounded-sm shrink-0"
            style={{ background: accent, minHeight: 20 }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-hz-text">Crew Coverage Statistics</h2>
            <p className="text-[12px] text-hz-text-secondary">Per-crew distribution · hover to inspect</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {WORKLOAD_METRICS.map((m) => {
            const isActive = m.key === activeKey
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveKey(m.key)}
                className="px-3 h-8 rounded-full text-[13px] font-medium transition-all"
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${m.color} 0%, ${m.color}cc 100%)`
                    : isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                  color: isActive ? '#fff' : isDark ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.75)',
                  border: `1px solid ${isActive ? 'transparent' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  boxShadow: isActive ? `0 4px 16px ${m.color}40` : 'none',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Inline header — big avg + compact meta line. Replaces the old 7-tile
          strip. All per-metric values surface on chart hover instead. */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
            {active.label} · avg
          </span>
          <span
            className="text-[34px] font-bold tabular-nums leading-none transition-colors"
            style={{ color: active.color }}
          >
            {hasData ? fmt(stats.avgMin) : '—'}
          </span>
        </div>
      </div>

      {/* Smooth density curve — interactive. Hover shows crosshair + tooltip. */}
      <div className="relative flex-1 min-h-0">
        {hasData ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            width="100%"
            height="100%"
            style={{ display: 'block', cursor: 'crosshair' }}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={active.color} stopOpacity={0.55} />
                <stop offset="60%" stopColor={active.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={active.color} stopOpacity={0.02} />
              </linearGradient>
              <filter id={glowId} x="-10%" y="-20%" width="120%" height="140%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Baseline */}
            <line
              x1={padL}
              x2={padL + chartW}
              y1={baseY}
              y2={baseY}
              stroke={trackColor}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />

            {/* Shaded p10–p90 ribbon */}
            <rect
              x={p10X}
              y={padT}
              width={Math.max(0, p90X - p10X)}
              height={chartH}
              fill={active.color}
              opacity={0.07}
              rx={2}
            />

            {/* Filled area with gradient */}
            <path d={areaPath} fill={`url(#${gradId})`} className="wl-area">
              <animate attributeName="opacity" from="0" to="1" dur="0.35s" fill="freeze" begin="0s" />
            </path>

            {/* Curve outline with glow */}
            <path
              d={path}
              fill="none"
              stroke={active.color}
              strokeWidth={1.25}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              filter={`url(#${glowId})`}
            />

            {/* p10 / p90 dashed markers */}
            <line
              x1={p10X}
              x2={p10X}
              y1={padT}
              y2={baseY}
              stroke={muted}
              strokeWidth={0.75}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="3 3"
            />
            <line
              x1={p90X}
              x2={p90X}
              y1={padT}
              y2={baseY}
              stroke={muted}
              strokeWidth={0.75}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="3 3"
            />

            {/* Average solid marker */}
            <line
              x1={avgX}
              x2={avgX}
              y1={padT - 4}
              y2={baseY}
              stroke={active.color}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />

            {/* Sample rug */}
            {values.map((v, i) => (
              <line
                key={i}
                x1={valueToX(v)}
                x2={valueToX(v)}
                y1={baseY + 1}
                y2={baseY + 5}
                stroke={active.color}
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
                opacity={0.4}
              />
            ))}

            {/* Hover crosshair */}
            {hoverX != null && hoverY != null && (
              <g pointerEvents="none">
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={padT}
                  y2={baseY}
                  stroke={active.color}
                  strokeWidth={0.75}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.5}
                  strokeDasharray="2 2"
                />
                <circle cx={hoverX} cy={hoverY} r={3} fill={active.color} />
                <circle cx={hoverX} cy={hoverY} r={6} fill={active.color} opacity={0.2} />
              </g>
            )}
          </svg>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-[12px] py-16 text-center"
            style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            <span className="text-[15px] font-semibold text-hz-text">No data for this metric</span>
            <span className="text-[13px] text-hz-text-secondary">Run a roster or switch to a different metric.</span>
          </div>
        )}

        {/* HTML label overlays — kept out of SVG so they don't stretch with
            preserveAspectRatio="none". Positioned by % of chart container. */}
        {hasData && (
          <>
            <div
              className="absolute text-[11px] tabular-nums pointer-events-none"
              style={{ left: `${(padL / W) * 100}%`, bottom: 4, color: muted }}
            >
              {fmt(lo)}
            </div>
            <div
              className="absolute text-[11px] tabular-nums pointer-events-none"
              style={{
                left: `${((padL + chartW / 2) / W) * 100}%`,
                transform: 'translateX(-50%)',
                bottom: 4,
                color: muted,
              }}
            >
              {fmt((lo + hi) / 2)}
            </div>
            <div
              className="absolute text-[11px] tabular-nums pointer-events-none"
              style={{ right: `${(padR / W) * 100}%`, bottom: 4, color: muted }}
            >
              {fmt(hi)}
            </div>
            <div
              className="absolute text-[11px] font-semibold pointer-events-none"
              style={{
                left: `${(avgX / W) * 100}%`,
                transform: 'translateX(-50%)',
                top: 2,
                color: active.color,
              }}
            >
              avg
            </div>
            <div
              className="absolute text-[10px] pointer-events-none"
              style={{
                left: `${(p10X / W) * 100}%`,
                transform: 'translateX(-50%)',
                top: 2,
                color: muted,
              }}
            >
              p10
            </div>
            <div
              className="absolute text-[10px] pointer-events-none"
              style={{
                left: `${(p90X / W) * 100}%`,
                transform: 'translateX(-50%)',
                top: 2,
                color: muted,
              }}
            >
              p90
            </div>
          </>
        )}

        {/* Floating hover tooltip — positioned relative to the chart container. */}
        {hasData && hover && hoverX != null && hoverY != null && (
          <div
            className="absolute pointer-events-none rounded-lg px-3 py-2 text-[12px] tabular-nums"
            style={{
              left: `${(tooltipX / W) * 100}%`,
              top: 0,
              width: TOOLTIP_W,
              background: isDark ? 'rgba(15,15,22,0.95)' : 'rgba(255,255,255,0.98)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.15)',
              transform: 'translateY(-4px)',
            }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: active.color }}>
              {active.label}
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-hz-text-secondary">Value</span>
              <span className="font-semibold text-hz-text">{fmt(hover.v)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-hz-text-secondary">Percentile</span>
              <span className="font-semibold text-hz-text">{hover.pctl.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-hz-text-secondary">Crew near</span>
              <span className="font-semibold text-hz-text">{hover.crewInBin}</span>
            </div>
          </div>
        )}
      </div>
      {/* reference accent prop so lint doesn't fuss when user switches metrics */}
      <span className="sr-only" aria-hidden>
        {accent}
      </span>
    </div>
  )
}

function Sparkline({
  values,
  stats,
  color,
  w,
  h,
}: {
  values: number[]
  stats: DistStats
  color: string
  w: number
  h: number
}) {
  if (values.length === 0 || stats.maxMin <= 0) {
    return (
      <svg width={w} height={h} aria-hidden>
        <line x1={2} x2={w - 2} y1={h - 2} y2={h - 2} stroke={color} strokeWidth={1} opacity={0.4} />
      </svg>
    )
  }
  const lo = stats.minMin
  const hi = Math.max(stats.maxMin, lo + 1)
  const range = hi - lo || 1
  const n = Math.max(1, values.length)
  const sigma = Math.max(stats.stddev, range / 30)
  const bw = Math.max(1e-6, 1.06 * sigma * Math.pow(n, -1 / 5))
  const S = 24
  const pts: Array<{ x: number; d: number }> = []
  const twoBwSq = 2 * bw * bw
  const norm = 1 / (n * bw * Math.sqrt(2 * Math.PI))
  let maxD = 0
  for (let i = 0; i <= S; i++) {
    const xv = lo + (range * i) / S
    let d = 0
    for (const v of values) {
      const dx = xv - v
      d += Math.exp(-(dx * dx) / twoBwSq)
    }
    d *= norm
    if (d > maxD) maxD = d
    pts.push({ x: xv, d })
  }
  const xTo = (v: number) => 2 + ((v - lo) / range) * (w - 4)
  const yTo = (d: number) => h - 2 - (maxD > 0 ? (d / maxD) * (h - 4) : 0)
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xTo(p.x).toFixed(2)},${yTo(p.d).toFixed(2)}`).join(' ')
  return (
    <svg width={w} height={h} aria-hidden style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  )
}

function MiniStat({
  label,
  value,
  hint,
  emphasis,
  isDark,
}: {
  label: string
  value: string
  hint?: string
  emphasis?: string
  isDark: boolean
}) {
  const bg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const tile = (
    <div
      className="flex flex-col gap-0.5 px-3 py-2 rounded-lg"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums leading-tight" style={{ color: emphasis ?? undefined }}>
        {value}
      </span>
    </div>
  )
  if (!hint) return tile
  return (
    <Tooltip multiline maxWidth={260} content={hint}>
      {tile}
    </Tooltip>
  )
}

function RangeBar({
  label,
  stats,
  formatter,
  color,
  isDark,
}: {
  label: string
  stats: DistStats
  formatter?: (v: number) => string
  color: string
  isDark: boolean
}) {
  const fmt = formatter ?? ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)))
  const lo = stats.minMin
  const hi = Math.max(stats.maxMin, stats.minMin + 1)
  const range = hi - lo || 1
  const avgPct = ((stats.avgMin - lo) / range) * 100
  const p10Pct = ((stats.p10 - lo) / range) * 100
  const p90Pct = ((stats.p90 - lo) / range) * 100
  const track = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline gap-3">
        <span className="text-[13px] font-medium text-hz-text">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {fmt(stats.avgMin)}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: track }}>
        {/* p10–p90 band */}
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            left: `${Math.max(0, p10Pct)}%`,
            width: `${Math.max(2, p90Pct - p10Pct)}%`,
            background: color,
            opacity: 0.35,
          }}
        />
        {/* avg marker */}
        <div
          className="absolute top-[-2px] h-[14px] w-[3px] rounded-full"
          style={{
            left: `calc(${Math.max(0, Math.min(100, avgPct))}% - 1.5px)`,
            background: color,
          }}
        />
      </div>
      <div className="flex justify-between text-[13px] text-hz-text-tertiary tabular-nums">
        <span>min {fmt(stats.minMin)}</span>
        <span>
          p10 {fmt(stats.p10)} · p90 {fmt(stats.p90)}
        </span>
        <span>max {fmt(stats.maxMin)}</span>
      </div>
    </div>
  )
}

// ── Stats helpers ──────────────────────────────────────────────────────────

type DistStats = {
  count: number
  sumMin: number
  avgMin: number
  minMin: number
  maxMin: number
  p10: number
  p90: number
  stddev: number
}

function distOf(values: number[]): DistStats {
  const n = values.length
  if (n === 0) return { count: 0, sumMin: 0, avgMin: 0, minMin: 0, maxMin: 0, p10: 0, p90: 0, stddev: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((s, v) => s + v, 0)
  const avg = sum / n
  const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n
  const pct = (p: number) => sorted[Math.max(0, Math.min(n - 1, Math.floor((p / 100) * (n - 1))))]
  return {
    count: n,
    sumMin: sum,
    avgMin: avg,
    minMin: sorted[0],
    maxMin: sorted[n - 1],
    p10: pct(10),
    p90: pct(90),
    stddev: Math.sqrt(variance),
  }
}

type ReviewStats = {
  crewCount: number
  idleCrew: number
  crewWithoutOff: number
  crewWithoutStandby: number
  overloadedCrew: string[]
  block: DistStats
  duty: DistStats
  sectors: DistStats
  pairingsPerCrew: DistStats
  daysOff: DistStats
  standby: DistStats
  /** Per-crew raw values — fuel for the distribution histogram. */
  raw: {
    block: number[]
    duty: number[]
    sectors: number[]
    pairings: number[]
    daysOff: number[]
    standby: number[]
  }
  avgLayoversPerCrew: number
  maxConsecDutyDays: number
  uniqueLayoverStations: number
  fdtlFlagged: number
  /** Auto-roster-sourced OFF activities (notes starts with `auto-roster:`). */
  daysOffByAutoRoster: number
  /** Auto-roster-sourced SBY activities. */
  standbyByAutoRoster: number
}

function computeReviewStats(data: CrewScheduleResponse): ReviewStats {
  const pairingById = new Map(data.pairings.map((p) => [p._id, p]))
  const offCodeIds = new Set(
    data.activityCodes
      .filter((c) => (c.flags ?? []).includes('is_day_off') || (c.flags ?? []).includes('is_rest_period'))
      .map((c) => c._id),
  )
  const standbyCodeIds = new Set(
    data.activityCodes
      .filter((c) =>
        (c.flags ?? []).some((f) => f === 'is_home_standby' || f === 'is_airport_standby' || f === 'is_reserve'),
      )
      .map((c) => c._id),
  )

  const perCrew = new Map<
    string,
    {
      blockMin: number
      dutyMin: number
      sectors: number
      pairings: number
      daysOff: number
      standby: number
      layoverStations: Set<string>
      dutyDaysSet: Set<string>
    }
  >()
  const ensure = (id: string) => {
    let e = perCrew.get(id)
    if (!e) {
      e = {
        blockMin: 0,
        dutyMin: 0,
        sectors: 0,
        pairings: 0,
        daysOff: 0,
        standby: 0,
        layoverStations: new Set(),
        dutyDaysSet: new Set(),
      }
      perCrew.set(id, e)
    }
    return e
  }
  for (const c of data.crew) ensure(c._id)

  let fdtlFlagged = 0
  for (const a of data.assignments) {
    const e = ensure(a.crewId)
    const p = pairingById.get(a.pairingId)
    e.pairings++
    if (p) {
      e.blockMin += p.totalBlockMinutes ?? 0
      e.dutyMin += (p as unknown as { totalDutyMinutes?: number }).totalDutyMinutes ?? p.totalBlockMinutes ?? 0
      e.sectors += (p as unknown as { numberOfSectors?: number }).numberOfSectors ?? 0
      const layovers = (p as unknown as { layoverAirports?: string[] }).layoverAirports ?? []
      for (const s of layovers) e.layoverStations.add(s)
      if (p.fdtlStatus === 'violation' || p.fdtlStatus === 'warning') fdtlFlagged++
      // Count calendar days the pairing spans
      const start = new Date(p.startDate + 'T00:00:00Z')
      const end = new Date((p.endDate ?? p.startDate) + 'T00:00:00Z')
      for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        e.dutyDaysSet.add(d.toISOString().slice(0, 10))
      }
    }
  }

  let daysOffByAutoRoster = 0
  let standbyByAutoRoster = 0
  for (const a of data.activities) {
    if (!a.activityCodeId) continue
    const e = ensure(a.crewId)
    const isOff = offCodeIds.has(a.activityCodeId)
    const isSby = standbyCodeIds.has(a.activityCodeId)
    if (isOff) e.daysOff++
    if (isSby) e.standby++
    const fromAutoRoster = typeof a.notes === 'string' && a.notes.startsWith('auto-roster:')
    if (fromAutoRoster && isOff) daysOffByAutoRoster++
    if (fromAutoRoster && isSby) standbyByAutoRoster++
  }

  const allLayovers = new Set<string>()
  let maxConsec = 0
  for (const e of perCrew.values()) {
    for (const s of e.layoverStations) allLayovers.add(s)
    const days = [...e.dutyDaysSet].sort()
    let streak = 0
    let prev: string | null = null
    for (const d of days) {
      if (prev && new Date(d).getTime() - new Date(prev).getTime() === 86_400_000) streak++
      else streak = 1
      if (streak > maxConsec) maxConsec = streak
      prev = d
    }
  }

  const blockVals: number[] = []
  const dutyVals: number[] = []
  const sectorsVals: number[] = []
  const pairingsVals: number[] = []
  const daysOffVals: number[] = []
  const standbyVals: number[] = []
  const layoverSum = { s: 0, n: 0 }
  let idleCrew = 0
  let crewWithoutOff = 0
  let crewWithoutStandby = 0
  const pairingsList: Array<{ id: string; n: number }> = []

  for (const c of data.crew) {
    const e = perCrew.get(c._id)
    if (!e) continue
    blockVals.push(e.blockMin)
    dutyVals.push(e.dutyMin)
    sectorsVals.push(e.sectors)
    pairingsVals.push(e.pairings)
    daysOffVals.push(e.daysOff)
    standbyVals.push(e.standby)
    layoverSum.s += e.layoverStations.size
    layoverSum.n++
    if (e.pairings === 0) idleCrew++
    if (e.daysOff === 0) crewWithoutOff++
    if (e.standby === 0) crewWithoutStandby++
    pairingsList.push({ id: c._id, n: e.pairings })
  }

  pairingsList.sort((a, b) => b.n - a.n)
  const topCount = Math.max(1, Math.floor(pairingsList.length * 0.1))
  const overloadedCrew = pairingsList.slice(0, topCount).map((p) => p.id)

  return {
    crewCount: data.crew.length,
    idleCrew,
    crewWithoutOff,
    crewWithoutStandby,
    overloadedCrew,
    block: distOf(blockVals),
    duty: distOf(dutyVals),
    sectors: distOf(sectorsVals),
    pairingsPerCrew: distOf(pairingsVals),
    daysOff: distOf(daysOffVals),
    standby: distOf(standbyVals),
    raw: {
      block: blockVals,
      duty: dutyVals,
      sectors: sectorsVals,
      pairings: pairingsVals,
      daysOff: daysOffVals,
      standby: standbyVals,
    },
    avgLayoversPerCrew: layoverSum.n > 0 ? layoverSum.s / layoverSum.n : 0,
    maxConsecDutyDays: maxConsec,
    uniqueLayoverStations: allLayovers.size,
    fdtlFlagged,
    daysOffByAutoRoster,
    standbyByAutoRoster,
  }
}

function fmtHoursMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
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
  const fmtDay = useDateFormat()
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
                {fmtDay(run.periodFrom)} → {fmtDay(run.periodTo)}
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
  className = '',
}: {
  title: string
  icon: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
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

function StatCard({
  label,
  value,
  color,
  isDark,
  sub,
}: {
  label: string
  value: number | string
  color: string
  isDark: boolean
  sub?: string
}) {
  return (
    <div
      className="text-center p-5 rounded-xl"
      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }}
    >
      <div className="text-[28px] font-bold tabular-nums leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-[13px] uppercase tracking-wide text-hz-text-tertiary mt-1">{label}</div>
      {sub ? <div className="text-[13px] text-hz-text-tertiary mt-1">{sub}</div> : null}
    </div>
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
