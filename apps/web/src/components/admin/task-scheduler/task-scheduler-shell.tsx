'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { api, type ScheduledTaskRef } from '@skyhub/api'
import { ListScreenHeader, Text, ToggleSwitch } from '@/components/ui'
import { Clock, ChevronRight } from 'lucide-react'
import { TaskConfigDrawer, type DrawerTab } from './task-config-drawer'
import { RunHistoryModal } from './run-history-modal'
import { TaskSchedulerToolbar, type ToolbarAction } from './task-scheduler-toolbar'
import { TaskSchedulerSearch } from './task-scheduler-search'

/**
 * 7.1.6 Task Scheduler Management — admin shell.
 *
 * Plain rows table mirroring AIMS Job Scheduler. No KPI widgets.
 * Click a row → opens the right-side config drawer.
 * "View Log" or clicking the Last Run cell → opens the run-history modal.
 */
export function TaskSchedulerShell() {
  const [tasks, setTasks] = useState<ScheduledTaskRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ScheduledTaskRef | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('description')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [historyTask, setHistoryTask] = useState<ScheduledTaskRef | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  /**
   * Two refresh modes — `loud` flips the spinner/disabled state on the
   * Refresh toolbar button (user-triggered + cold load). `silent` is for
   * background polls so the button doesn't blink every 5 seconds.
   */
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.listScheduledTasks()
      setTasks(res.tasks)
      setError(null)
    } catch (e) {
      console.warn('[task-scheduler] refresh failed:', e)
      setTasks((prev) => {
        if (prev.length === 0) {
          setError(e instanceof Error ? e.message : String(e))
        }
        return prev
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Background poll — silent so the Refresh button stays still.
  useEffect(() => {
    const id = setInterval(() => {
      if (tasks.some((t) => t.lastRunStatus === 'running' || t.lastRunStatus === 'queued')) {
        void refresh(true)
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [tasks, refresh])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => t.title.toLowerCase().includes(q) || t.taskKey.toLowerCase().includes(q))
  }, [tasks, search])

  const toggleField = async (task: ScheduledTaskRef, field: 'active' | 'auto', value: boolean) => {
    // Optimistic
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, [field]: value } : t)))
    try {
      await api.updateScheduledTask(task._id, { [field]: value })
    } catch (e) {
      console.error(e)
      void refresh()
    }
  }

  const runNow = async (task: ScheduledTaskRef) => {
    try {
      await api.runScheduledTask(task._id)
      void refresh()
      setHistoryTask(task)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const cancelRunning = async (task: ScheduledTaskRef) => {
    if (!task.lastRunId) return
    try {
      await api.cancelScheduledTaskRun(task._id, task.lastRunId)
      void refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleToolbarAction = useCallback(
    (action: ToolbarAction) => {
      switch (action) {
        case 'refresh':
          void refresh()
          return
        case 'runNow':
          if (selected) void runNow(selected)
          return
        case 'cancel':
          if (selected) void cancelRunning(selected)
          return
        case 'configure':
          if (selected) {
            setDrawerTab('description')
            setDrawerOpen(true)
          }
          return
        case 'viewLog':
          if (selected) setHistoryTask(selected)
          return
        case 'search':
          setSearchOpen((v) => !v)
          return
        // Stubbed actions — wired later
        case 'newTask':
        case 'delete':
        case 'clone':
        case 'restore':
        case 'clear':
        case 'help':
          return
      }
    },
    [refresh, selected],
  )

  return (
    <div className="flex flex-col h-full bg-hz-bg">
      {/* Header — title + count */}
      <div className="border-b border-hz-border shrink-0">
        <ListScreenHeader
          icon={Clock}
          title="Task Scheduler Management"
          count={tasks.length}
          filteredCount={filtered.length}
          countLabel="task"
        />
      </div>

      {/* Top ribbon toolbar */}
      <div className="relative">
        <TaskSchedulerToolbar
          selected={selected}
          loading={loading}
          searchActive={searchOpen}
          onAction={handleToolbarAction}
        />
        <TaskSchedulerSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          query={search}
          onQueryChange={setSearch}
          matchCount={filtered.length}
          totalCount={tasks.length}
        />
      </div>

      {error ? (
        <div className="m-4 rounded-lg border border-status-error/30 bg-status-error/5 px-3 py-2">
          <Text variant="secondary" className="!text-status-error">
            {error}
          </Text>
        </div>
      ) : null}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-[13px]">
          <thead className="sticky top-0 bg-hz-bg z-10">
            <tr className="text-hz-text-secondary border-b border-hz-border">
              <Th className="w-12">ID</Th>
              <Th className="w-20 text-center">Active</Th>
              <Th className="w-20 text-center">Auto</Th>
              <Th>Application</Th>
              <Th className="w-56">Schedule</Th>
              <Th className="w-44">Last Run</Th>
              <Th className="w-44">Next Run</Th>
              <Th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {loading && tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-hz-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-hz-text-secondary">
                  No tasks configured. Built-in tasks are seeded automatically on server boot.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t._id}
                  className={`border-b border-hz-border/50 hover:bg-hz-border/15 transition-colors cursor-pointer ${
                    selected?._id === t._id ? 'bg-module-accent/[0.06]' : ''
                  }`}
                  onClick={() => setSelected(t)}
                >
                  <Td className="font-mono text-hz-text-secondary">{t.displayNumber}</Td>
                  <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <ToggleSwitch
                      checked={t.active}
                      onChange={(v) => toggleField(t, 'active', v)}
                      size="sm"
                      ariaLabel="Active"
                    />
                  </Td>
                  <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <ToggleSwitch
                      checked={t.auto}
                      onChange={(v) => toggleField(t, 'auto', v)}
                      size="sm"
                      ariaLabel="Auto"
                    />
                  </Td>
                  <Td>
                    <div className="font-medium">{t.title}</div>
                    {t.description ? (
                      <div className="text-hz-text-secondary truncate max-w-[640px]">{t.description}</div>
                    ) : null}
                  </Td>
                  <Td className="text-hz-text-secondary">{t.scheduleSummary}</Td>
                  <Td>
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setHistoryTask(t)
                      }}
                    >
                      <LastRunCell task={t} />
                    </button>
                  </Td>
                  <Td className="text-hz-text-secondary">
                    {t.nextRunAt && t.active && t.auto ? formatIso(t.nextRunAt) : '—'}
                  </Td>
                  <Td className="text-right">
                    <ChevronRight className="h-4 w-4 text-hz-text-secondary inline" />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Selection footer — light status strip, just shows what's selected */}
      {selected ? (
        <div className="shrink-0 border-t border-hz-border bg-hz-bg px-4 py-2 flex items-center gap-2">
          <Text variant="secondary">
            Selected:{' '}
            <span className="font-semibold text-hz-text">
              #{selected.displayNumber} · {selected.title}
            </span>
          </Text>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-[12px] text-hz-text-secondary hover:text-hz-text underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      {drawerOpen && selected ? (
        <TaskConfigDrawer
          task={selected}
          initialTab={drawerTab}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            void refresh()
          }}
          onOpenHistory={() => {
            setHistoryTask(selected)
          }}
        />
      ) : null}

      {historyTask ? (
        <RunHistoryModal task={historyTask} onClose={() => setHistoryTask(null)} onRequestRefresh={refresh} />
      ) : null}
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-[12px] font-medium uppercase tracking-wider px-3 py-2 text-left ${className}`}>{children}</th>
  )
}

function Td({
  children,
  className = '',
  onClick,
}: {
  children?: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <td className={`px-3 py-2.5 align-middle ${className}`} onClick={onClick}>
      {children}
    </td>
  )
}

function LastRunCell({ task }: { task: ScheduledTaskRef }) {
  const status = task.lastRunStatus
  if (!task.lastRunAt) return <span className="text-hz-text-secondary">Never</span>
  const tone =
    status === 'completed'
      ? 'bg-status-success/15 text-status-success'
      : status === 'failed'
        ? 'bg-status-error/15 text-status-error'
        : status === 'cancelled'
          ? 'bg-hz-border/40 text-hz-text-secondary'
          : status === 'running' || status === 'queued'
            ? 'bg-status-info/15 text-status-info'
            : 'bg-hz-border/30 text-hz-text-secondary'
  return (
    <div className="flex items-center gap-2">
      <span className="text-hz-text">{formatIso(task.lastRunAt)}</span>
      {status ? (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${tone}`}>
          {status}
        </span>
      ) : null}
    </div>
  )
}

function formatIso(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}
