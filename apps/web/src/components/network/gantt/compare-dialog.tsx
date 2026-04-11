'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Plane } from 'lucide-react'
import { BarChart3, X, Trash2, Check, Clock, Loader2, Link2, Unlink2, TriangleAlert, Timer, Fuel } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import {
  listOptimizerRuns,
  getOptimizerRun,
  deleteOptimizerRun,
  bulkAssignFlights,
  type OptimizerRunSummary,
} from '@/lib/gantt/api'

interface CompareDialogProps {
  open: boolean
  onClose: () => void
}

export function CompareDialog({ open, onClose }: CompareDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const [mounted, setMounted] = useState(false)

  const periodFrom = useGanttStore((s) => s.periodFrom)
  const periodTo = useGanttStore((s) => s.periodTo)

  const [runs, setRuns] = useState<OptimizerRunSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load runs when dialog opens
  useEffect(() => {
    if (!open) return
    setSelectedId(null)
    setApplying(false)
    loadRuns()
  }, [open, periodFrom, periodTo])

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      const data = await listOptimizerRuns(operatorId, periodFrom, periodTo)
      setRuns(data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [periodFrom, periodTo])

  const handleDelete = useCallback(
    async (runId: string) => {
      setDeleting(runId)
      try {
        const operatorId = useOperatorStore.getState().operator?._id ?? ''
        await deleteOptimizerRun(operatorId, runId)
        setRuns((prev) => prev.filter((r) => r._id !== runId))
        if (selectedId === runId) setSelectedId(null)
      } catch {
        /* ignore */
      } finally {
        setDeleting(null)
      }
    },
    [selectedId],
  )

  const handleApply = useCallback(async () => {
    if (!selectedId) return
    setApplying(true)
    try {
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      const full = await getOptimizerRun(operatorId, selectedId)

      // Group assignments by registration
      const byReg = new Map<string, string[]>()
      for (const a of full.assignments) {
        // Only assign flights that aren't already assigned
        const flight = useGanttStore.getState().flights.find((f) => f.id === a.flightId)
        if (flight && !flight.aircraftReg) {
          const list = byReg.get(a.registration) ?? []
          list.push(a.flightId)
          byReg.set(a.registration, list)
        }
      }

      const assignments = [...byReg.entries()].map(([registration, flightIds]) => ({ registration, flightIds }))
      await bulkAssignFlights(operatorId, assignments)

      // Update local state
      const assignMap = new Map(full.assignments.map((a) => [a.flightId, a.registration]))
      const updated = useGanttStore.getState().flights.map((f) => {
        const reg = assignMap.get(f.id)
        return reg && !f.aircraftReg ? { ...f, aircraftReg: reg } : f
      })
      useGanttStore.setState({ flights: updated })
      useGanttStore.getState()._recomputeLayout()
      onClose()
    } catch (e) {
      console.error('Failed to apply optimizer run:', e)
      await useGanttStore.getState()._fetchFlights()
    } finally {
      setApplying(false)
    }
  }, [selectedId, onClose])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!mounted || !open) return null

  const accent = 'var(--module-accent)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'

  // Find best values for highlighting
  const bestAssigned = runs.length > 0 ? Math.max(...runs.map((r) => r.stats.assigned)) : 0
  const bestOverflow = runs.length > 0 ? Math.min(...runs.map((r) => r.stats.overflow)) : 0
  const bestChainBreaks = runs.length > 0 ? Math.min(...runs.map((r) => r.stats.chainBreaks)) : 0
  const bestFuelSavings = runs.length > 0 ? Math.max(...runs.map((r) => r.stats.fuelSavingsPercent ?? 0)) : 0

  return createPortal(
    <div
      data-gantt-overlay
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="rounded-xl overflow-hidden flex flex-col"
        style={{
          width: 1060,
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: palette.card,
          border: `1px solid ${palette.border}`,
          boxShadow: isDark
            ? '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
            : '0 24px 64px rgba(96,97,112,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
          animation: 'bc-dropdown-in 150ms ease-out',
        }}
      >
        {/* Accent strip */}
        <div style={{ height: 3, background: accent }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: isDark ? 'rgba(62,123,250,0.06)' : 'rgba(30,64,175,0.03)' }}
          >
            <BarChart3 size={18} className="text-module-accent" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold" style={{ color: palette.text }}>
              Scenario Comparison
            </div>
            <div className="text-[12px]" style={{ color: palette.textTertiary }}>
              {periodFrom} to {periodTo} — {runs.length} saved run{runs.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X size={16} style={{ color: palette.textTertiary }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ borderTop: `1px solid ${palette.border}` }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-module-accent" />
            </div>
          )}

          {!loading && runs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: palette.textTertiary }}>
              <BarChart3 size={40} strokeWidth={1.2} style={{ opacity: 0.3 }} />
              <div className="text-[13px] mt-3 text-center">
                No saved runs for this period.
                <br />
                Run the optimizer and click "Add to Compare" to save a run.
              </div>
            </div>
          )}

          {!loading && runs.length > 0 && (
            <div
              className={`grid gap-4 ${runs.length === 1 ? 'grid-cols-1 max-w-[480px] mx-auto' : runs.length === 2 ? 'grid-cols-2' : runs.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
            >
              {runs.map((run) => {
                const selected = selectedId === run._id
                const isBestAssigned = run.stats.assigned === bestAssigned && runs.length > 1
                const isBestOverflow = run.stats.overflow === bestOverflow && runs.length > 1
                const isBestChainBreaks = run.stats.chainBreaks === bestChainBreaks && runs.length > 1
                const isBestFuel =
                  (run.stats.fuelSavingsPercent ?? 0) === bestFuelSavings && bestFuelSavings > 0 && runs.length > 1
                const coveragePct =
                  run.stats.totalFlights > 0 ? Math.round((run.stats.assigned / run.stats.totalFlights) * 100) : 0

                return (
                  <button
                    key={run._id}
                    onClick={() => setSelectedId(selected ? null : run._id)}
                    className="rounded-xl p-4 text-left transition-all relative group"
                    style={{
                      background: selected ? (isDark ? 'rgba(62,123,250,0.08)' : 'rgba(30,64,175,0.04)') : cardBg,
                      border: `2px solid ${selected ? accent : 'transparent'}`,
                      boxShadow: selected
                        ? isDark
                          ? '0 0 0 2px rgba(62,123,250,0.15)'
                          : '0 0 0 2px rgba(30,64,175,0.08)'
                        : undefined,
                    }}
                  >
                    {/* Delete button */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(run._id)
                        }}
                        disabled={deleting === run._id}
                        className="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ color: palette.textTertiary }}
                      >
                        {deleting === run._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>

                    {/* Method badge */}
                    <div className="mb-2">
                      <span
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase"
                        style={{
                          background:
                            run.config.method === 'fuel'
                              ? 'rgba(255,136,0,0.12)'
                              : run.config.method === 'balance'
                                ? 'rgba(124,58,237,0.12)'
                                : 'rgba(62,123,250,0.12)',
                          color:
                            run.config.method === 'fuel'
                              ? '#FF8800'
                              : run.config.method === 'balance'
                                ? '#7C3AED'
                                : '#3E7BFA',
                        }}
                      >
                        {run.config.method === 'fuel'
                          ? 'Fuel Efficient'
                          : run.config.method === 'balance'
                            ? 'Balance Fleet'
                            : 'Minimize Gaps'}
                      </span>
                    </div>

                    {/* Preset + date */}
                    <div className="text-[13px] font-semibold pr-6" style={{ color: palette.text }}>
                      {run.config.preset === 'deep' ? 'Deep' : run.config.preset === 'normal' ? 'Normal' : 'Quick'} Run
                    </div>
                    <div className="text-[11px] font-medium mb-3" style={{ color: palette.textTertiary }}>
                      {run.createdAt
                        ? new Date(run.createdAt).toLocaleString(undefined, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>

                    {/* Coverage ring + headline stat */}
                    <div className="flex items-center gap-3 mb-4">
                      <MiniRing percent={coveragePct} isDark={isDark} />
                      <div>
                        <div className="text-[18px] font-bold" style={{ color: '#06C270' }}>
                          {run.stats.assigned.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-medium" style={{ color: palette.textTertiary }}>
                          assigned
                        </div>
                      </div>
                    </div>

                    {/* Metric grid */}
                    <div className="space-y-2">
                      <MetricRow
                        icon={Link2}
                        label="Assigned"
                        value={run.stats.assigned.toLocaleString()}
                        isBest={isBestAssigned}
                        palette={palette}
                        isDark={isDark}
                      />
                      <MetricRow
                        icon={Unlink2}
                        label="Overflow"
                        value={String(run.stats.overflow)}
                        isBest={isBestOverflow}
                        palette={palette}
                        isDark={isDark}
                      />
                      <MetricRow
                        icon={TriangleAlert}
                        label="Chain Breaks"
                        value={String(run.stats.chainBreaks)}
                        isBest={isBestChainBreaks}
                        palette={palette}
                        isDark={isDark}
                      />
                      <MetricRow
                        icon={Timer}
                        label="Time"
                        value={`${(run.elapsedMs / 1000).toFixed(1)}s`}
                        isBest={false}
                        palette={palette}
                        isDark={isDark}
                      />
                      {run.stats.fuelSavingsPercent != null && run.stats.fuelSavingsPercent > 0 && (
                        <MetricRow
                          icon={Fuel}
                          label="Fuel Savings"
                          value={`${run.stats.fuelSavingsPercent}%`}
                          isBest={isBestFuel}
                          palette={palette}
                          isDark={isDark}
                        />
                      )}
                    </div>

                    {/* Type breakdown mini-bars */}
                    {run.typeBreakdown.length > 0 && (
                      <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${palette.border}` }}>
                        {run.typeBreakdown.slice(0, 3).map((tb) => {
                          const pct = tb.totalFlights > 0 ? Math.round((tb.assigned / tb.totalFlights) * 100) : 0
                          return (
                            <div key={tb.icaoType} className="flex items-center gap-2">
                              <span
                                className="text-[11px] font-bold w-9 shrink-0"
                                style={{ color: palette.textSecondary }}
                              >
                                {tb.icaoType}
                              </span>
                              <div
                                className="flex-1 h-1.5 rounded-full overflow-hidden"
                                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, background: pct === 100 ? '#06C270' : '#3E7BFA' }}
                                />
                              </div>
                              <span
                                className="text-[11px] font-mono font-medium"
                                style={{ color: palette.textTertiary }}
                              >
                                {tb.avgBhPerDay}h/d
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Selected indicator */}
                    {selected && (
                      <div className="absolute bottom-3 right-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: accent }}
                        >
                          <Check size={14} color="#fff" strokeWidth={2.5} />
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-3.5"
          style={{ borderTop: `1px solid ${palette.border}` }}
        >
          <div className="text-[11px]" style={{ color: palette.textTertiary }}>
            {selectedId
              ? 'Click "Apply Selected" to assign flights from this run'
              : runs.length > 0
                ? 'Select a run to apply'
                : ''}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="h-10 px-5 rounded-lg text-[13px] font-medium"
              style={{ color: palette.text, border: `1px solid ${palette.border}` }}
            >
              Close
            </button>
            {selectedId && (
              <button
                onClick={handleApply}
                disabled={applying}
                className="h-10 px-6 rounded-lg text-[13px] font-semibold text-white flex items-center gap-2"
                style={{
                  background: '#06C270',
                  opacity: applying ? 0.5 : 1,
                  boxShadow: !applying ? '0 2px 12px rgba(6,194,112,0.3)' : undefined,
                }}
              >
                {applying ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Applying...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Apply Selected
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Sub-components ──

function MiniRing({ percent, isDark }: { percent: number; isDark: boolean }) {
  const track = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#06C270 ${percent * 3.6}deg, ${track} ${percent * 3.6}deg)`,
        }}
      />
      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          inset: 5,
          background: isDark ? '#191921' : '#fff',
        }}
      >
        <span className="text-[11px] font-bold" style={{ color: '#06C270' }}>
          {percent}%
        </span>
      </div>
    </div>
  )
}

function MetricRow({
  icon: Icon,
  label,
  value,
  isBest,
  palette,
}: {
  icon: typeof Plane
  label: string
  value: string
  isBest: boolean
  palette: typeof colors.dark
  isDark?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <Icon size={13} style={{ color: palette.textTertiary, opacity: 0.6 }} />
      <span className="text-[12px] font-medium flex-1" style={{ color: palette.textSecondary }}>
        {label}
      </span>
      <span
        className="text-[13px] font-bold font-mono"
        style={{
          color: isBest ? '#06C270' : palette.text,
        }}
      >
        {value}
        {isBest && (
          <span className="ml-1 text-[11px] font-semibold" style={{ color: '#06C270' }}>
            BEST
          </span>
        )}
      </span>
    </div>
  )
}
