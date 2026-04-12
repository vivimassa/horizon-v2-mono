'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Zap, Shield } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { authedFetch } from '@/lib/authed-fetch'
import { getApiBaseUrl } from '@skyhub/api'
import { useRecoveryConfigStore } from '@/stores/use-recovery-config-store'
import { RecoveryConfigPanel, type RecoveryConfig } from './recovery-config-panel'
import { RecoverySolutionsPanel, type RecoverySolution } from './recovery-solutions-panel'

type Phase = 'config' | 'solving' | 'results'

interface LockedCounts {
  departed: number
  within_threshold: number
  beyond_horizon: number
  available: number
}

interface ProgressState {
  phase: string
  iteration: number
  objective_value: number
  columns_generated: number
  elapsed_ms: number
}

export function RecoveryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const periodFrom = useGanttStore((s) => s.periodFrom)
  const periodTo = useGanttStore((s) => s.periodTo)
  const operatorId = useOperatorStore((s) => s.operator?._id ?? '')

  const config = useRecoveryConfigStore((s) => s.config)
  const setConfig = useRecoveryConfigStore((s) => s.setConfig)
  const configLoaded = useRecoveryConfigStore((s) => s.loaded)
  const setConfigLoaded = useRecoveryConfigStore((s) => s.setLoaded)

  const [phase, setPhase] = useState<Phase>('config')
  const [solving, setSolving] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [solutions, setSolutions] = useState<RecoverySolution[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [locked, setLocked] = useState<LockedCounts | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load operator recovery config defaults once
  useEffect(() => {
    if (!operatorId || configLoaded) return
    authedFetch(`${getApiBaseUrl()}/operators/${operatorId}`)
      .then((res) => res.json())
      .then((op) => {
        if (op?.recoveryConfig) {
          const rc = op.recoveryConfig
          setConfig({
            objective: rc.defaultObjective ?? config.objective,
            horizonHours: rc.horizonHours ?? config.horizonHours,
            lockThresholdMinutes: rc.lockThresholdMinutes ?? config.lockThresholdMinutes,
            maxSolutions: rc.maxSolutions ?? config.maxSolutions,
            maxSolveSeconds: rc.maxSolveSeconds ?? config.maxSolveSeconds,
            delayCostPerMinute: rc.delayCostPerMinute ?? config.delayCostPerMinute,
            cancelCostPerFlight: rc.cancelCostPerFlight ?? config.cancelCostPerFlight,
            fuelPricePerKg: rc.fuelPricePerKg ?? config.fuelPricePerKg,
            maxDelayPerFlightMinutes: rc.maxDelayPerFlightMinutes ?? config.maxDelayPerFlightMinutes,
            connectionProtectionMinutes: rc.connectionProtectionMinutes ?? config.connectionProtectionMinutes,
            respectCurfews: rc.respectCurfews ?? config.respectCurfews,
            maxCrewDutyHours: rc.maxCrewDutyHours ?? config.maxCrewDutyHours,
            maxSwapsPerAircraft: rc.maxSwapsPerAircraft ?? config.maxSwapsPerAircraft,
            propagationMultiplier: rc.propagationMultiplier ?? config.propagationMultiplier,
            minImprovementUsd: rc.minImprovementUsd ?? config.minImprovementUsd,
          })
        }
        setConfigLoaded()
      })
      .catch(() => {})
  }, [operatorId, configLoaded])

  const handleSolve = useCallback(async () => {
    if (!operatorId || !periodFrom || !periodTo) return
    setSolving(true)
    setPhase('solving')
    setError(null)
    setSolutions([])
    setProgress(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await authedFetch(`${getApiBaseUrl()}/recovery/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId,
          from: periodFrom,
          to: periodTo,
          config,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        setError(`Solver error: ${text}`)
        setPhase('config')
        setSolving(false)
        return
      }

      // Parse SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              if (currentEvent === 'progress') {
                setProgress(parsed)
              } else if (currentEvent === 'solution') {
                setSolutions((prev) => [...prev, parsed])
              } else if (currentEvent === 'locked') {
                setLocked(parsed)
              } else if (currentEvent === 'result') {
                setSolutions(parsed.solutions ?? [])
                if (parsed.locked) {
                  setLocked((prev) => ({ ...prev, ...parsed.locked }))
                }
              } else if (currentEvent === 'error') {
                setError(parsed.message ?? 'Unknown solver error')
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      setPhase('results')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('config')
      }
    } finally {
      setSolving(false)
      abortRef.current = null
    }
  }, [operatorId, periodFrom, periodTo, config])

  const handleApply = useCallback(async () => {
    const sol = solutions[selectedIndex]
    if (!sol || !operatorId) return

    // No assignments = nothing to apply, just close
    if (sol.assignments.length === 0) {
      onClose()
      return
    }

    setApplying(true)

    // Group assignments by target registration, including delay data
    const byReg = new Map<
      string,
      {
        flightIds: string[]
        delays: { flightId: string; delayMinutes: number; newStdUtcMs: number; newStaUtcMs: number }[]
      }
    >()
    for (const a of sol.assignments) {
      const entry = byReg.get(a.toReg) ?? { flightIds: [], delays: [] }
      entry.flightIds.push(a.flightId)
      if (a.newStdUtc && a.newStaUtc && a.delayMinutes > 0) {
        entry.delays.push({
          flightId: a.flightId,
          delayMinutes: a.delayMinutes,
          newStdUtcMs: a.newStdUtc,
          newStaUtcMs: a.newStaUtc,
        })
      }
      byReg.set(a.toReg, entry)
    }
    const assignments = [...byReg.entries()].map(([registration, { flightIds, delays }]) => ({
      registration,
      flightIds,
      ...(delays.length > 0 ? { delays } : {}),
    }))

    try {
      await authedFetch(`${getApiBaseUrl()}/gantt/bulk-assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId, assignments }),
      })
      // Exit What-If mode and refresh gantt with production data
      useOperatorStore.getState().setActiveScenarioId(null)
      useGanttStore.getState().setScenarioId(null)
      useGanttStore.getState().commitPeriod()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }, [solutions, selectedIndex, operatorId, onClose])

  const handleClose = useCallback(() => {
    abortRef.current?.abort()
    onClose()
  }, [onClose])

  if (!open) return null

  const bg = isDark ? '#1C1C28' : '#FAFAFC'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className="rounded-2xl w-[780px] max-h-[85vh] flex flex-col overflow-hidden"
        style={{ background: bg, border: `1px solid ${border}`, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: isDark ? 'rgba(91,141,239,0.15)' : 'rgba(30,64,175,0.10)' }}
          >
            <Zap size={18} color={isDark ? '#5B8DEF' : '#1e40af'} />
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-semibold" style={{ color: palette.text }}>
              Disruption Recovery
            </div>
            <div className="text-[13px]" style={{ color: palette.textTertiary }}>
              {phase === 'config' && 'Configure solver parameters'}
              {phase === 'solving' && 'Running column generation solver...'}
              {phase === 'results' && `${solutions.length} solution${solutions.length !== 1 ? 's' : ''} found`}
            </div>
          </div>
          {locked && (
            <div className="flex gap-3 text-[11px]" style={{ color: palette.textTertiary }}>
              <span>
                <Shield size={11} className="inline mr-0.5" />
                {locked.departed} departed
              </span>
              <span>{locked.within_threshold} locked</span>
              <span>{locked.beyond_horizon} frozen</span>
              <span style={{ color: locked.available > 0 ? '#06C270' : '#E63535', fontWeight: 600 }}>
                {locked.available} available
              </span>
            </div>
          )}
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: palette.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div
              className="mb-4 p-3 rounded-lg text-[13px] font-medium"
              style={{ background: 'rgba(230,53,53,0.10)', color: '#E63535', border: '1px solid rgba(230,53,53,0.20)' }}
            >
              {error}
            </div>
          )}

          {phase === 'config' && (
            <RecoveryConfigPanel
              config={config}
              onChange={setConfig}
              onSolve={handleSolve}
              solving={solving}
              isDark={isDark}
            />
          )}

          {phase === 'solving' && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              {/* Pulsing SkyHub logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/skyhub-logo.png"
                alt=""
                aria-hidden="true"
                className="select-none"
                style={{
                  width: 240,
                  filter: isDark ? 'brightness(10) grayscale(1)' : 'grayscale(1) brightness(0)',
                  opacity: isDark ? 0.08 : 0.06,
                  animation: 'solver-logo-breathe 2.5s ease-in-out infinite',
                }}
                draggable={false}
              />

              {/* Progress bar */}
              <div className="w-full max-w-md">
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: isDark ? '#5B8DEF' : '#1e40af',
                      animation: 'solver-progress-indeterminate 1.8s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>

              <div className="text-[15px] font-semibold" style={{ color: palette.text }}>
                {!progress && 'Connecting to solver...'}
                {progress?.phase === 'building_network' && 'Building flight network...'}
                {progress?.phase === 'cg_iteration' && `CG Iteration ${progress.iteration}`}
                {progress?.phase === 'generating_solutions' && 'Generating solutions...'}
              </div>

              {progress && (
                <div className="grid grid-cols-3 gap-8 text-center">
                  <div>
                    <div
                      className="text-[20px] font-bold tabular-nums"
                      style={{ color: isDark ? '#5B8DEF' : '#1e40af' }}
                    >
                      {progress.columns_generated}
                    </div>
                    <div className="text-[11px]" style={{ color: palette.textTertiary }}>
                      Columns
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[20px] font-bold tabular-nums"
                      style={{ color: isDark ? '#5B8DEF' : '#1e40af' }}
                    >
                      {progress.objective_value.toFixed(0)}
                    </div>
                    <div className="text-[11px]" style={{ color: palette.textTertiary }}>
                      Objective
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[20px] font-bold tabular-nums"
                      style={{ color: isDark ? '#5B8DEF' : '#1e40af' }}
                    >
                      {(progress.elapsed_ms / 1000).toFixed(1)}s
                    </div>
                    <div className="text-[11px]" style={{ color: palette.textTertiary }}>
                      Elapsed
                    </div>
                  </div>
                </div>
              )}

              {solutions.length > 0 && (
                <div className="text-[13px]" style={{ color: '#06C270' }}>
                  {solutions.length} solution{solutions.length !== 1 ? 's' : ''} found so far...
                </div>
              )}

              <style
                dangerouslySetInnerHTML={{
                  __html: `
                @keyframes solver-logo-breathe {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.6; transform: scale(1.03); }
                }
                @keyframes solver-progress-indeterminate {
                  0% { width: 0%; margin-left: 0%; }
                  50% { width: 60%; margin-left: 20%; }
                  100% { width: 0%; margin-left: 100%; }
                }
              `,
                }}
              />
            </div>
          )}

          {phase === 'results' && (
            <RecoverySolutionsPanel
              solutions={solutions}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onApply={handleApply}
              applying={applying}
              isDark={isDark}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
