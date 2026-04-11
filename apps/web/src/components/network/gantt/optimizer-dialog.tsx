'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Wand2,
  X,
  Play,
  Square,
  Check,
  AlertTriangle,
  Zap,
  Clock,
  Flame,
  Plane,
  Link2,
  Unlink2,
  TriangleAlert,
  RotateCcw,
  TrendingDown,
  Scale,
  Fuel,
  Info,
  Plus,
  BarChart3,
  Timer,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { bulkAssignFlights, saveOptimizerRun } from '@/lib/gantt/api'
import {
  runOptimizer,
  serializeResult,
  generateRunName,
  type OptimizerPreset,
  type OptimizerMethod,
  type OptimizerProgress,
  type OptimizerResult,
  type TypeBreakdown,
} from '@/lib/gantt/tail-optimizer'

// ── CSS for wave animation (injected once) ───────────────────
const WAVE_CSS = `
@keyframes opt-aurora {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes opt-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
@keyframes opt-glow-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
@keyframes opt-report-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
`

interface OptimizerDialogProps {
  open: boolean
  onClose: () => void
}

export function OptimizerDialog({ open, onClose }: OptimizerDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const [mounted, setMounted] = useState(false)

  const flights = useGanttStore((s) => s.flights)
  const aircraft = useGanttStore((s) => s.aircraft)
  const aircraftTypes = useGanttStore((s) => s.aircraftTypes)

  const [preset, setPreset] = useState<OptimizerPreset>('normal')
  const [method, setMethod] = useState<OptimizerMethod>('minimize')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<OptimizerProgress | null>(null)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [applied, setApplied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      setPreset('normal')
      setMethod('minimize')
      setRunning(false)
      setProgress(null)
      setResult(null)
      setApplied(false)
      setAddedToCompare(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, running])

  const beforeStats = useMemo(() => {
    const total = flights.length
    const assigned = flights.filter((f) => f.aircraftReg).length
    return { total, assigned, unassigned: total - assigned }
  }, [flights])

  const handleRun = useCallback(async () => {
    setRunning(true)
    setResult(null)
    setApplied(false)
    setAddedToCompare(false)
    const abort = new AbortController()
    abortRef.current = abort
    try {
      const r = await runOptimizer(
        flights,
        aircraft,
        aircraftTypes,
        { preset, method },
        (p) => setProgress(p),
        abort.signal,
      )
      setResult(r)
    } catch {
      /* aborted */
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }, [flights, aircraft, aircraftTypes, preset, method])

  const [saving, setSaving] = useState(false)
  const [addedToCompare, setAddedToCompare] = useState(false)
  const [addingToCompare, setAddingToCompare] = useState(false)

  const handleApply = useCallback(async () => {
    if (!result) return
    setSaving(true)
    const newAssignments = new Map<string, string[]>()
    for (const [fid, reg] of result.assignments) {
      const f = flights.find((f) => f.id === fid)
      if (f && !f.aircraftReg) {
        const list = newAssignments.get(reg) ?? []
        list.push(fid)
        newAssignments.set(reg, list)
      }
    }
    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    const assignments = [...newAssignments.entries()].map(([registration, flightIds]) => ({ registration, flightIds }))
    try {
      // Wait for server to persist before closing
      await bulkAssignFlights(operatorId, assignments)
      // Apply to local state
      const updated = useGanttStore.getState().flights.map((f) => {
        const reg = result.assignments.get(f.id)
        return reg && !f.aircraftReg ? { ...f, aircraftReg: reg } : f
      })
      useGanttStore.setState({ flights: updated })
      useGanttStore.getState()._recomputeLayout()
      setApplied(true)
      setTimeout(onClose, 400)
    } catch (e) {
      console.error('Failed to save optimizer results:', e)
      await useGanttStore.getState()._fetchFlights()
    } finally {
      setSaving(false)
    }
  }, [result, flights, onClose])

  const periodFrom = useGanttStore((s) => s.periodFrom)
  const periodTo = useGanttStore((s) => s.periodTo)

  const handleAddToCompare = useCallback(async () => {
    if (!result || addedToCompare) return
    setAddingToCompare(true)
    try {
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      const serialized = serializeResult(result, { preset, method })
      const name = generateRunName({ preset, method })
      await saveOptimizerRun(operatorId, {
        name,
        periodFrom,
        periodTo,
        ...serialized,
      })
      setAddedToCompare(true)
    } catch (e) {
      console.error('Failed to save optimizer run:', e)
    } finally {
      setAddingToCompare(false)
    }
  }, [result, preset, method, periodFrom, periodTo, addedToCompare])

  if (!mounted || !open) return null

  const accent = 'var(--module-accent)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'
  const glowBg = isDark ? 'rgba(62,123,250,0.06)' : 'rgba(30,64,175,0.03)'
  const stats = progress?.stats ?? result?.stats
  const pct = result ? 100 : (progress?.percent ?? 0)
  const isComplete = !!result && !running

  // Dialog widens when report panel appears
  const dialogWidth = isComplete ? 1140 : 800

  return createPortal(
    <>
      <style>{WAVE_CSS}</style>
      <div
        data-gantt-overlay
        className="fixed inset-0 z-[9998] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.45)' }}
      >
        <div
          className="rounded-xl overflow-hidden flex flex-col"
          style={{
            width: dialogWidth,
            maxWidth: '95vw',
            maxHeight: '90vh',
            background: palette.card,
            border: `1px solid ${palette.border}`,
            boxShadow: isDark
              ? '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
              : '0 24px 64px rgba(96,97,112,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
            animation: 'bc-dropdown-in 150ms ease-out',
            transition: 'width 400ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* ── Accent strip ── */}
          <div style={{ height: 3, background: accent }} />

          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: glowBg }}>
              <Wand2 size={18} className="text-module-accent" />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-bold" style={{ color: palette.text }}>
                Tail Assignment Optimizer
              </div>
              <div className="text-[12px]" style={{ color: palette.textTertiary }}>
                Automatically assign flights to aircraft registrations
              </div>
            </div>
            <button
              onClick={() => {
                if (!running) onClose()
              }}
              className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ opacity: running ? 0.3 : 1, pointerEvents: running ? 'none' : 'auto' }}
            >
              <X size={16} style={{ color: palette.textTertiary }} />
            </button>
          </div>

          {/* ── Body — 2 or 3 columns ── */}
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full" style={{ borderTop: `1px solid ${palette.border}` }}>
              {/* ─── Col 1: Config ─── */}
              <div
                className="flex-1 min-w-0 px-6 py-5 space-y-5 overflow-y-auto"
                style={{ borderRight: `1px solid ${palette.border}` }}
              >
                {/* Presets */}
                <div>
                  <label
                    className="text-[11px] font-semibold uppercase tracking-wider mb-2 block"
                    style={{ color: palette.textTertiary }}
                  >
                    Optimization Level
                  </label>
                  <div className="space-y-2">
                    {[
                      {
                        key: 'quick' as const,
                        icon: Zap,
                        label: 'Quick',
                        desc: 'Greedy + light SA refinement',
                        color: '#06C270',
                      },
                      {
                        key: 'normal' as const,
                        icon: Clock,
                        label: 'Normal',
                        desc: 'Balanced greedy + simulated annealing',
                        color: '#3E7BFA',
                      },
                      {
                        key: 'deep' as const,
                        icon: Flame,
                        label: 'Deep',
                        desc: 'Thorough SA search for optimal result',
                        color: '#FF8800',
                      },
                    ].map((p) => {
                      const active = preset === p.key
                      return (
                        <button
                          key={p.key}
                          onClick={() => {
                            if (!running) setPreset(p.key)
                          }}
                          disabled={running}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
                          style={{
                            background: active ? (isDark ? 'rgba(62,123,250,0.10)' : 'rgba(30,64,175,0.06)') : cardBg,
                            border: `1.5px solid ${active ? p.color : 'transparent'}`,
                            opacity: running ? 0.5 : 1,
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: active ? `${p.color}18` : inputBg }}
                          >
                            <p.icon size={16} style={{ color: active ? p.color : palette.textTertiary }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span
                              className="text-[13px] font-semibold"
                              style={{ color: active ? palette.text : palette.textSecondary }}
                            >
                              {p.label}
                            </span>
                            <div className="text-[11px] mt-0.5" style={{ color: palette.textTertiary }}>
                              {p.desc}
                            </div>
                          </div>
                          {active && (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: p.color }}
                            >
                              <Check size={12} color="#fff" strokeWidth={2.5} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Strategy */}
                <div>
                  <label
                    className="text-[11px] font-semibold uppercase tracking-wider mb-2 block"
                    style={{ color: palette.textTertiary }}
                  >
                    Strategy
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'minimize' as const, icon: TrendingDown, label: 'Minimize Gaps', desc: 'Tight rotations' },
                      { key: 'balance' as const, icon: Scale, label: 'Balance Fleet', desc: 'Even utilization' },
                      { key: 'fuel' as const, icon: Fuel, label: 'Fuel Efficient', desc: 'Minimize fuel' },
                    ].map((s) => {
                      const active = method === s.key
                      return (
                        <button
                          key={s.key}
                          onClick={() => {
                            if (!running) setMethod(s.key)
                          }}
                          disabled={running}
                          className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                          style={{
                            background: active ? accent : cardBg,
                            color: active ? '#fff' : palette.text,
                            border: `1.5px solid ${active ? 'transparent' : palette.border}`,
                            opacity: running ? 0.5 : 1,
                          }}
                        >
                          <s.icon size={18} strokeWidth={1.6} />
                          <span className="text-[12px] font-semibold">{s.label}</span>
                          <span className="text-[11px] px-2 text-center leading-tight" style={{ opacity: 0.7 }}>
                            {s.desc}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ─── Col 2: Status ─── */}
              <div
                className="w-[300px] shrink-0 px-5 py-5 space-y-4 overflow-y-auto"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.015)',
                  borderRight: isComplete ? `1px solid ${palette.border}` : undefined,
                }}
              >
                {/* Before stats */}
                <div>
                  <label
                    className="text-[11px] font-semibold uppercase tracking-wider mb-2 block"
                    style={{ color: palette.textTertiary }}
                  >
                    {isComplete ? 'Before' : 'Current State'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat
                      icon={Plane}
                      label="Flights"
                      value={beforeStats.total}
                      color={palette.text}
                      bg={inputBg}
                      textMuted={palette.textTertiary}
                    />
                    <MiniStat
                      icon={Unlink2}
                      label="Unassigned"
                      value={beforeStats.unassigned}
                      color={beforeStats.unassigned > 0 ? '#FF8800' : '#06C270'}
                      bg={inputBg}
                      textMuted={palette.textTertiary}
                    />
                    <MiniStat
                      icon={Link2}
                      label="Assigned"
                      value={beforeStats.assigned}
                      color="#06C270"
                      bg={inputBg}
                      textMuted={palette.textTertiary}
                    />
                    <MiniStat
                      icon={Plane}
                      label="Aircraft"
                      value={aircraft.length}
                      color={palette.text}
                      bg={inputBg}
                      textMuted={palette.textTertiary}
                    />
                  </div>
                </div>

                {/* Progress */}
                {(running || isComplete) && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: palette.textTertiary }}
                        >
                          {running ? 'Optimizing' : 'Complete'}
                        </span>
                        {progress && (
                          <span className="text-[11px] font-mono" style={{ color: palette.textTertiary }}>
                            {(progress.elapsedMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      {/* Wave progress bar */}
                      <WaveProgressBar percent={pct} isComplete={isComplete} isDark={isDark} />
                      {running && (
                        <div className="text-[11px]" style={{ color: palette.textTertiary }}>
                          {progress?.phase === 'greedy'
                            ? 'Phase 1: Building initial assignment...'
                            : 'Phase 2: Simulated annealing refinement...'}
                        </div>
                      )}
                    </div>

                    {/* After stats */}
                    {stats && (
                      <div>
                        <label
                          className="text-[11px] font-semibold uppercase tracking-wider mb-2 block"
                          style={{ color: palette.textTertiary }}
                        >
                          {isComplete ? 'After' : 'Progress'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <MiniStat
                            icon={Link2}
                            label="Assigned"
                            value={stats.assigned}
                            color="#06C270"
                            bg={inputBg}
                            textMuted={palette.textTertiary}
                          />
                          <MiniStat
                            icon={Unlink2}
                            label="Overflow"
                            value={stats.overflow}
                            color={stats.overflow > 0 ? '#FF8800' : '#06C270'}
                            bg={inputBg}
                            textMuted={palette.textTertiary}
                          />
                          <MiniStat
                            icon={TriangleAlert}
                            label="Chain Brk"
                            value={stats.chainBreaks}
                            color={stats.chainBreaks > 0 ? '#FF8800' : '#06C270'}
                            bg={inputBg}
                            textMuted={palette.textTertiary}
                          />
                          {isComplete && result && (
                            <MiniStat
                              icon={Timer}
                              label="Time"
                              value={`${(result.elapsedMs / 1000).toFixed(1)}s`}
                              color={palette.text}
                              bg={inputBg}
                              textMuted={palette.textTertiary}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Overflow warning */}
                    {isComplete && result && result.stats.overflow > 0 && (
                      <div
                        className="flex items-start gap-2 rounded-xl p-2.5"
                        style={{
                          background: isDark ? 'rgba(255,136,0,0.06)' : 'rgba(255,136,0,0.04)',
                          border: '1px solid rgba(255,136,0,0.15)',
                        }}
                      >
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#FF8800' }} />
                        <span
                          className="text-[11px] leading-relaxed"
                          style={{ color: isDark ? 'rgba(255,200,120,0.85)' : 'rgba(180,100,0,0.85)' }}
                        >
                          {result.stats.overflow} flight{result.stats.overflow !== 1 ? 's' : ''} couldn't fit.
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Idle hint */}
                {!running && !result && (
                  <div
                    className="flex-1 flex flex-col items-center justify-center py-6"
                    style={{ color: palette.textTertiary }}
                  >
                    <Wand2 size={32} strokeWidth={1.2} style={{ opacity: 0.3 }} />
                    <div className="text-[12px] mt-3 text-center leading-relaxed">
                      Configure and run the optimizer
                      <br />
                      to see results here
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Col 3: Report (slides in on completion) ─── */}
              {isComplete && result && (
                <div
                  className="w-[340px] shrink-0 px-5 py-5 space-y-4 overflow-y-auto"
                  style={{
                    background: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.01)',
                    animation: 'opt-report-in 400ms cubic-bezier(0.4,0,0.2,1)',
                    maxHeight: 'calc(90vh - 140px)',
                  }}
                >
                  {/* Coverage ring + improvement */}
                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${palette.border}` }}>
                    <div className="flex items-center gap-4">
                      <CoverageRing assigned={stats!.assigned} total={stats!.totalFlights} isDark={isDark} />
                      <div className="flex-1 space-y-1">
                        <div className="text-[20px] font-bold" style={{ color: '#06C270' }}>
                          +{stats!.assigned - beforeStats.assigned}
                        </div>
                        <div className="text-[12px] font-medium" style={{ color: palette.textSecondary }}>
                          Newly assigned flights
                        </div>
                        <div className="text-[11px]" style={{ color: palette.textTertiary }}>
                          {beforeStats.unassigned} unassigned → {stats!.overflow} remaining
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fleet utilization by type */}
                  {result.typeBreakdown.length > 0 && (
                    <div>
                      <label
                        className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                        style={{ color: palette.textTertiary }}
                      >
                        <BarChart3 size={12} /> Fleet Utilization
                      </label>
                      <div className="space-y-2">
                        {result.typeBreakdown.map((tb) => (
                          <TypeBar key={tb.icaoType} data={tb} isDark={isDark} palette={palette} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fuel Analysis */}
                  {result.stats.totalFuelKg != null && (
                    <div>
                      <label
                        className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                        style={{ color: palette.textTertiary }}
                      >
                        <Fuel size={12} /> Fuel Analysis
                      </label>
                      <div
                        className="rounded-xl p-3 space-y-3"
                        style={{ background: cardBg, border: `1px solid ${palette.border}` }}
                      >
                        <FuelComparisonBar
                          optimized={result.stats.totalFuelKg}
                          baseline={result.stats.baselineFuelKg ?? 0}
                          isDark={isDark}
                          palette={palette}
                        />
                        {(result.stats.fuelSavingsPercent ?? 0) > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <Fuel size={14} style={{ color: '#06C270' }} />
                            <span className="text-[13px] font-bold" style={{ color: '#06C270' }}>
                              {result.stats.fuelSavingsPercent}% fuel savings
                            </span>
                            <span className="text-[11px]" style={{ color: palette.textTertiary }}>
                              vs. baseline
                            </span>
                          </div>
                        )}
                        {result.stats.totalFuelKg === 0 && (
                          <div className="flex items-start gap-2">
                            <Info size={12} className="shrink-0 mt-0.5" style={{ color: '#0063F7' }} />
                            <span className="text-[11px]" style={{ color: palette.textTertiary }}>
                              No fuel burn rates entered. Add rates in Aircraft Registrations → Performance.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center justify-between px-6 py-3.5"
            style={{ borderTop: `1px solid ${palette.border}` }}
          >
            <div className="text-[11px]" style={{ color: palette.textTertiary }}>
              {isComplete && result
                ? `Completed in ${(result.elapsedMs / 1000).toFixed(1)}s`
                : running
                  ? `${preset.charAt(0).toUpperCase() + preset.slice(1)} mode — ${method === 'minimize' ? 'minimizing gaps' : method === 'balance' ? 'balancing fleet' : 'optimizing fuel'}`
                  : ''}
            </div>
            <div className="flex items-center gap-2.5">
              {!running && !result && (
                <>
                  <button
                    onClick={onClose}
                    className="h-10 px-5 rounded-lg text-[13px] font-medium"
                    style={{ color: palette.text, border: `1px solid ${palette.border}` }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRun}
                    disabled={beforeStats.unassigned === 0}
                    className="h-10 px-6 rounded-lg text-[13px] font-semibold text-white flex items-center gap-2"
                    style={{
                      background: accent,
                      opacity: beforeStats.unassigned === 0 ? 0.4 : 1,
                      boxShadow: isDark ? '0 2px 12px rgba(62,123,250,0.3)' : '0 2px 12px rgba(30,64,175,0.2)',
                    }}
                  >
                    <Play size={14} /> Run Optimizer
                  </button>
                </>
              )}
              {running && (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="h-10 px-5 rounded-lg text-[13px] font-medium flex items-center gap-2"
                  style={{
                    color: '#E63535',
                    border: '1px solid rgba(230,53,53,0.25)',
                    background: isDark ? 'rgba(230,53,53,0.06)' : 'rgba(230,53,53,0.04)',
                  }}
                >
                  <Square size={12} fill="currentColor" /> Stop
                </button>
              )}
              {isComplete && (
                <>
                  <button
                    onClick={() => {
                      setResult(null)
                      setProgress(null)
                    }}
                    className="h-10 px-4 rounded-lg text-[13px] font-medium flex items-center gap-1.5"
                    style={{ color: palette.textSecondary, border: `1px solid ${palette.border}` }}
                  >
                    <RotateCcw size={13} /> Re-run
                  </button>
                  <button
                    onClick={handleAddToCompare}
                    disabled={addedToCompare || addingToCompare}
                    className="h-10 px-4 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors"
                    style={{
                      color: addedToCompare ? '#06C270' : palette.text,
                      border: `1px solid ${addedToCompare ? 'rgba(6,194,112,0.3)' : palette.border}`,
                      background: addedToCompare
                        ? isDark
                          ? 'rgba(6,194,112,0.08)'
                          : 'rgba(6,194,112,0.05)'
                        : undefined,
                      opacity: addingToCompare ? 0.5 : 1,
                    }}
                  >
                    {addedToCompare ? (
                      <>
                        <Check size={13} /> Added
                      </>
                    ) : addingToCompare ? (
                      <>
                        <Clock size={13} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Plus size={13} /> Add to Compare
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={applied || saving}
                    className="h-10 px-6 rounded-lg text-[13px] font-semibold text-white flex items-center gap-2"
                    style={{
                      background: '#06C270',
                      opacity: applied || saving ? 0.4 : 1,
                      boxShadow: !(applied || saving) ? '0 2px 12px rgba(6,194,112,0.3)' : undefined,
                    }}
                  >
                    {saving ? (
                      <>
                        <Clock size={14} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check size={14} /> Apply Changes
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── Visual components ────────────────────────────────────────

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
  bg,
  textMuted,
}: {
  icon: typeof Plane
  label: string
  value: number | string
  color: string
  bg: string
  textMuted: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: bg }}>
      <Icon size={13} style={{ color, opacity: 0.7 }} />
      <div>
        <div className="text-[14px] font-bold leading-none" style={{ color }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-[10px] font-medium mt-0.5" style={{ color: textMuted }}>
          {label}
        </div>
      </div>
    </div>
  )
}

/** Premium aurora gradient progress bar */
function WaveProgressBar({ percent, isComplete, isDark }: { percent: number; isComplete: boolean; isDark: boolean }) {
  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
      {/* Aurora gradient fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${percent}%`,
          background: isComplete ? '#06C270' : 'linear-gradient(90deg, #3E7BFA, #7C3AED, #06B6D4, #3E7BFA)',
          backgroundSize: isComplete ? undefined : '200% 100%',
          animation: isComplete ? undefined : 'opt-aurora 3s ease infinite',
        }}
      />
      {/* Shimmer highlight sweep */}
      {!isComplete && percent > 0 && (
        <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${percent}%` }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.25) 55%, transparent 100%)',
              animation: 'opt-shimmer 2.4s ease-in-out infinite',
              width: '50%',
            }}
          />
        </div>
      )}
      {/* Pulsing glow under the bar */}
      {!isComplete && percent > 0 && (
        <div
          className="absolute rounded-full"
          style={{
            left: 0,
            right: `${100 - percent}%`,
            top: -2,
            bottom: -2,
            background: 'linear-gradient(90deg, rgba(62,123,250,0.0), rgba(124,58,237,0.3), rgba(6,182,212,0.2))',
            filter: 'blur(6px)',
            animation: 'opt-glow-pulse 2s ease-in-out infinite',
          }}
        />
      )}
    </div>
  )
}

/** CSS conic-gradient donut ring */
function CoverageRing({ assigned, total, isDark }: { assigned: number; total: number; isDark: boolean }) {
  const pct = total > 0 ? Math.round((assigned / total) * 100) : 0
  const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#06C270 ${pct * 3.6}deg, ${trackColor} ${pct * 3.6}deg)`,
        }}
      />
      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          inset: 8,
          background: isDark ? '#191921' : '#fff',
        }}
      >
        <span className="text-[16px] font-bold" style={{ color: '#06C270' }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

/** Horizontal bar showing per-type utilization */
function TypeBar({ data, isDark, palette }: { data: TypeBreakdown; isDark: boolean; palette: typeof colors.dark }) {
  const pct = data.totalFlights > 0 ? Math.round((data.assigned / data.totalFlights) * 100) : 0
  const blockH = Math.round(data.totalBlockHours)
  const barTrack = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-bold" style={{ color: palette.text }}>
          {data.icaoType}
        </span>
        <div className="flex items-center gap-2 text-[11px]">
          <span style={{ color: palette.textTertiary }}>
            {data.assigned}/{data.totalFlights}
          </span>
          <span className="font-mono" style={{ color: palette.textSecondary }}>
            {blockH}h
          </span>
          <span className="font-mono font-bold" style={{ color: '#3E7BFA' }}>
            {data.avgBhPerDay}h/d
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: barTrack }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pct === 100 ? '#06C270' : '#3E7BFA' }}
        />
      </div>
    </div>
  )
}

/** Side-by-side fuel comparison bars */
function FuelComparisonBar({
  optimized,
  baseline,
  isDark,
  palette,
}: {
  optimized: number
  baseline: number
  isDark: boolean
  palette: typeof colors.dark
}) {
  const max = Math.max(optimized, baseline, 1)
  const optPct = Math.round((optimized / max) * 100)
  const basePct = Math.round((baseline / max) * 100)
  const barTrack = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const fmt = (kg: number) => {
    if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)}M kg`
    if (kg >= 1_000) return `${(kg / 1000).toFixed(1)}t`
    return `${Math.round(kg)} kg`
  }

  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium" style={{ color: '#06C270' }}>
            Optimized
          </span>
          <span className="text-[12px] font-bold font-mono" style={{ color: '#06C270' }}>
            {fmt(optimized)}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: barTrack }}>
          <div className="h-full rounded-full" style={{ width: `${optPct}%`, background: '#06C270' }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium" style={{ color: palette.textTertiary }}>
            Baseline
          </span>
          <span className="text-[12px] font-bold font-mono" style={{ color: palette.textSecondary }}>
            {fmt(baseline)}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: barTrack }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${basePct}%`, background: palette.textTertiary, opacity: 0.5 }}
          />
        </div>
      </div>
    </div>
  )
}
