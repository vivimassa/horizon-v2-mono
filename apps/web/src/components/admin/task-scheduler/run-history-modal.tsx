'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type ScheduledTaskRef, type ScheduledTaskRunRef } from '@skyhub/api'
import { Text } from '@/components/ui'
import { X, Play, RefreshCw, Square } from 'lucide-react'

interface RunHistoryModalProps {
  task: ScheduledTaskRef
  onClose: () => void
  onRequestRefresh: () => void
}

export function RunHistoryModal({ task, onClose, onRequestRefresh }: RunHistoryModalProps) {
  const [runs, setRuns] = useState<ScheduledTaskRunRef[]>([])
  const [selected, setSelected] = useState<ScheduledTaskRunRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Manual rerun picker state
  const yesterdayIso = useMemo(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), [])
  const [fromIso, setFromIso] = useState(yesterdayIso)
  const [toIso, setToIso] = useState(yesterdayIso)
  const [rerunBusy, setRerunBusy] = useState(false)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listScheduledTaskRuns(task._id, 50)
      setRuns(res.runs)
      // Refresh selected run's logs if a row is open
      if (selected) {
        try {
          const fresh = await api.getScheduledTaskRun(task._id, selected._id)
          setSelected(fresh.run)
        } catch {
          /* selected may have been deleted */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [task._id, selected])

  useEffect(() => {
    void loadRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task._id])

  // Live poll while a run is in flight.
  useEffect(() => {
    const id = setInterval(() => {
      const live =
        selected?.status === 'running' ||
        selected?.status === 'queued' ||
        runs.some((r) => r.status === 'running' || r.status === 'queued')
      if (live) void loadRuns()
    }, 3_000)
    return () => clearInterval(id)
  }, [selected, runs, loadRuns])

  const runManual = async () => {
    setRerunBusy(true)
    try {
      await api.runScheduledTask(task._id, { fromIso, toIso })
      await loadRuns()
      onRequestRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRerunBusy(false)
    }
  }

  const cancelRun = async (runId: string) => {
    try {
      await api.cancelScheduledTaskRun(task._id, runId)
      await loadRuns()
      onRequestRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[960px] max-w-full max-h-[90vh] bg-hz-card border border-hz-border rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-hz-border flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Text variant="pageTitle" as="div">
              Run History — {task.title}
            </Text>
            <Text variant="secondary" muted as="div">
              Last 50 executions
            </Text>
          </div>
          <button
            type="button"
            onClick={loadRuns}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hz-border hover:bg-hz-border/30 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-[13px] font-medium">Refresh</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Manual rerun picker */}
        <div className="shrink-0 px-4 py-3 border-b border-hz-border bg-hz-bg flex items-end gap-3 flex-wrap">
          <div>
            <div className="text-[12px] font-medium text-hz-text-secondary mb-1">From</div>
            <input
              type="date"
              value={fromIso}
              max={toIso}
              onChange={(e) => setFromIso(e.target.value)}
              className="h-10 px-3 rounded-lg border border-hz-border bg-hz-card text-[14px]"
            />
          </div>
          <div>
            <div className="text-[12px] font-medium text-hz-text-secondary mb-1">To</div>
            <input
              type="date"
              value={toIso}
              min={fromIso}
              onChange={(e) => setToIso(e.target.value)}
              className="h-10 px-3 rounded-lg border border-hz-border bg-hz-card text-[14px]"
            />
          </div>
          <button
            type="button"
            onClick={runManual}
            disabled={rerunBusy || !fromIso || !toIso || fromIso > toIso}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-module-accent text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" />
            <span className="text-[13px] font-semibold">{rerunBusy ? 'Starting…' : 'Run for date range'}</span>
          </button>
          <Text variant="secondary" muted className="ml-auto">
            Idempotent — reruns of the same date overwrite cleanly.
          </Text>
        </div>

        {error ? (
          <div className="px-4 py-2 border-b border-hz-border bg-status-error/5">
            <Text variant="secondary" className="!text-status-error">
              {error}
            </Text>
          </div>
        ) : null}

        {/* Body — runs list (left) + run detail (right) */}
        <div className="flex-1 overflow-hidden flex">
          <div className="w-[360px] shrink-0 border-r border-hz-border overflow-y-auto">
            {loading && runs.length === 0 ? (
              <div className="px-4 py-6 text-hz-text-secondary text-[13px]">Loading…</div>
            ) : runs.length === 0 ? (
              <div className="px-4 py-6 text-hz-text-secondary text-[13px]">No runs yet.</div>
            ) : (
              runs.map((r) => (
                <button
                  key={r._id}
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-2.5 border-b border-hz-border/50 hover:bg-hz-border/15 transition-colors ${
                    selected?._id === r._id ? 'bg-module-accent/[0.06] border-l-[3px] border-l-module-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <Text variant="secondary" muted className="ml-auto">
                      {r.triggeredBy}
                    </Text>
                  </div>
                  <div className="text-[13px] mt-1">{r.startedAt ? formatIso(r.startedAt) : '—'}</div>
                  {r.lastProgressMessage ? (
                    <div className="text-[12px] text-hz-text-secondary truncate">{r.lastProgressMessage}</div>
                  ) : null}
                </button>
              ))
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <RunDetail run={selected} onCancel={() => cancelRun(selected._id)} />
            ) : (
              <div className="px-4 py-6 text-hz-text-secondary text-[13px]">Select a run to view details.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RunDetail({ run, onCancel }: { run: ScheduledTaskRunRef; onCancel: () => void }) {
  const canCancel = run.status === 'queued' || run.status === 'running'
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={run.status} />
        <div className="flex-1" />
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-status-error text-white hover:opacity-90 transition-opacity"
          >
            <Square className="h-4 w-4" />
            <span className="text-[13px] font-semibold">Cancel</span>
          </button>
        ) : null}
      </div>

      {/* Progress bar */}
      {canCancel ? (
        <div>
          <div className="h-1.5 w-full bg-hz-border rounded-full overflow-hidden">
            <div
              className="h-full bg-module-accent transition-all duration-300"
              style={{ width: `${Math.max(2, run.lastProgressPct)}%` }}
            />
          </div>
          <div className="text-[12px] text-hz-text-secondary mt-1">
            {run.lastProgressPct}% · {run.lastProgressMessage ?? '—'}
          </div>
        </div>
      ) : null}

      <KeyValTable
        rows={[
          ['Run ID', run._id],
          ['Triggered by', `${run.triggeredBy}${run.triggeredByUserName ? ` (${run.triggeredByUserName})` : ''}`],
          ['Started', run.startedAt ? formatIso(run.startedAt) : '—'],
          ['Completed', run.completedAt ? formatIso(run.completedAt) : '—'],
        ]}
      />

      {Object.keys(run.params ?? {}).length > 0 ? (
        <details className="rounded-lg border border-hz-border">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium">Params</summary>
          <pre className="px-3 pb-3 text-[12px] overflow-auto">{JSON.stringify(run.params, null, 2)}</pre>
        </details>
      ) : null}

      {run.stats ? (
        <details className="rounded-lg border border-hz-border" open>
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium">Stats</summary>
          <pre className="px-3 pb-3 text-[12px] overflow-auto">{JSON.stringify(run.stats, null, 2)}</pre>
        </details>
      ) : null}

      {run.error ? (
        <div className="rounded-lg border border-status-error/40 bg-status-error/5 p-3">
          <div className="text-[13px] font-semibold text-status-error mb-1">Error</div>
          <pre className="text-[12px] whitespace-pre-wrap">{run.error}</pre>
        </div>
      ) : null}

      <div>
        <div className="text-[13px] font-medium mb-1.5">Logs</div>
        {(run.logs ?? []).length === 0 ? (
          <div className="text-[12px] text-hz-text-secondary">No log lines yet.</div>
        ) : (
          <div className="rounded-lg border border-hz-border max-h-[280px] overflow-auto bg-hz-bg">
            {(run.logs ?? []).map((l, i) => (
              <div key={i} className="px-3 py-1 text-[12px] flex gap-3 border-b border-hz-border/50 last:border-b-0">
                <span className="text-hz-text-secondary font-mono shrink-0">{l.tsUtc.slice(11, 19)}</span>
                <span
                  className={
                    l.level === 'error'
                      ? 'text-status-error'
                      : l.level === 'warn'
                        ? 'text-status-warning'
                        : 'text-hz-text'
                  }
                >
                  {l.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ScheduledTaskRunRef['status'] }) {
  const tone =
    status === 'completed'
      ? 'bg-status-success/15 text-status-success'
      : status === 'failed'
        ? 'bg-status-error/15 text-status-error'
        : status === 'cancelled'
          ? 'bg-hz-border/40 text-hz-text-secondary'
          : 'bg-status-info/15 text-status-info'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  )
}

function KeyValTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="w-full text-[12px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-hz-border/40 last:border-b-0">
            <td className="px-2 py-1.5 text-hz-text-secondary w-32">{k}</td>
            <td className="px-2 py-1.5 font-mono break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}
