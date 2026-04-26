// Tail Optimizer wizard — three-step UX:
//  1. Pick objective (minimize / balance / fuel) + preset (quick / normal / deep)
//  2. Run — show greedy + SA progress, current/best cost
//  3. Result — assignment count, chain breaks, fuel diff, save run
//
// Each stage is its own file under ./optimizer to keep this orchestrator slim.

import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { AlertTriangle } from 'lucide-react-native'
import { Icon } from '@skyhub/ui'
import {
  runOptimizer,
  serializeResult,
  generateRunName,
  type OptimizerPreset,
  type OptimizerMethod,
  type OptimizerProgress,
  type OptimizerResult,
} from '@skyhub/logic'
import { api } from '@skyhub/api'
import { useAuthStore } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell } from './dialog-shell'
import { ConfigPane } from './optimizer/config-pane'
import { RunningPane } from './optimizer/running-pane'
import { ResultPane } from './optimizer/result-pane'

type Stage = 'config' | 'running' | 'done' | 'error'

export function OptimizerSheet() {
  const { palette, accent, isDark } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const aircraft = useMobileGanttStore((s) => s.aircraft)
  const aircraftTypes = useMobileGanttStore((s) => s.aircraftTypes)
  const periodFrom = useMobileGanttStore((s) => s.periodFrom)
  const periodTo = useMobileGanttStore((s) => s.periodTo)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)

  const open = target?.kind === 'optimizer'

  const [method, setMethod] = useState<OptimizerMethod>('minimize')
  const [preset, setPreset] = useState<OptimizerPreset>('quick')
  const [stage, setStage] = useState<Stage>('config')
  const [progress, setProgress] = useState<OptimizerProgress | null>(null)
  const [result, setResult] = useState<OptimizerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) {
      setStage('config')
      setProgress(null)
      setResult(null)
      setError(null)
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [open])

  async function handleRun() {
    setStage('running')
    setProgress(null)
    setResult(null)
    setError(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await runOptimizer(
        flights,
        aircraft,
        aircraftTypes,
        { method, preset },
        (p) => setProgress(p),
        ctrl.signal,
      )
      setResult(res)
      setStage('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimizer failed')
      setStage('error')
    }
  }

  async function handleApply() {
    if (!operatorId || !result) return
    setApplying(true)
    try {
      const byReg = new Map<string, string[]>()
      for (const [flightId, reg] of result.assignments) {
        const list = byReg.get(reg) ?? []
        list.push(flightId)
        byReg.set(reg, list)
      }
      for (const [reg, ids] of byReg) {
        await api.ganttAssignFlights(operatorId, ids, reg)
      }
      const ser = serializeResult(result, { method, preset })
      try {
        await fetch(`/gantt/optimizer/runs`, {
          method: 'POST',
          body: JSON.stringify({
            operatorId,
            name: generateRunName({ method, preset }),
            periodFrom,
            periodTo,
            ...ser,
          }),
        })
      } catch {
        /* ignore — run history is best-effort on mobile */
      }
      showToast('success', `Applied ${result.assignments.size} assignments.`)
      closeMutationSheet()
      await refresh(operatorId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setApplying(false)
    }
  }

  const isRunning = stage === 'running'
  const primaryLabel =
    stage === 'config' ? 'Run' : stage === 'running' ? 'Running…' : stage === 'done' ? 'Apply assignments' : 'Retry'
  const onPrimary =
    stage === 'config' ? handleRun : stage === 'running' ? () => {} : stage === 'done' ? handleApply : handleRun
  const primaryDisabled = stage === 'running' || applying

  return (
    <DialogShell
      open={open}
      title="Tail optimizer"
      snapPercent={88}
      primaryLabel={primaryLabel}
      primaryLoading={isRunning || applying}
      primaryDisabled={primaryDisabled}
      onPrimary={onPrimary}
      secondaryLabel={stage === 'running' ? 'Abort' : 'Close'}
      onSecondary={() => {
        if (stage === 'running') abortRef.current?.abort()
        else closeMutationSheet()
      }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {stage === 'config' && (
          <ConfigPane
            method={method}
            setMethod={setMethod}
            preset={preset}
            setPreset={setPreset}
            palette={palette}
            accent={accent}
            isDark={isDark}
            flightCount={flights.length}
            acCount={aircraft.length}
          />
        )}
        {stage === 'running' && <RunningPane progress={progress} palette={palette} accent={accent} />}
        {stage === 'done' && result && <ResultPane result={result} palette={palette} accent={accent} />}
        {stage === 'error' && (
          <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
            <Icon icon={AlertTriangle} size="xl" color="#FF3B3B" />
            <Text style={{ fontSize: 14, color: '#FF3B3B', textAlign: 'center' }}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </DialogShell>
  )
}
