'use client'

import { useEffect, useState } from 'react'
import { api, type ScheduledTaskRef, type SchedulePolicyRef, type ScheduledTaskNotifications } from '@skyhub/api'
import { Text, ToggleSwitch } from '@/components/ui'
import { SchedulePolicyForm, NotificationsPolicyForm } from '@/components/scheduling'
import { X, Save, FileText } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { HeroForTask } from './task-hero-illustrations'

export type DrawerTab = 'description' | 'schedule' | 'notifications'

interface TaskConfigDrawerProps {
  task: ScheduledTaskRef
  onClose: () => void
  onSaved: () => void
  onOpenHistory: () => void
  initialTab?: DrawerTab
}

export function TaskConfigDrawer({ task, onClose, onSaved, onOpenHistory, initialTab }: TaskConfigDrawerProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const accent = '#1e40af'
  const [tab, setTab] = useState<DrawerTab>(initialTab ?? 'description')

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])
  const [draftActive, setDraftActive] = useState(task.active)
  const [draftAuto, setDraftAuto] = useState(task.auto)
  const [schedule, setSchedule] = useState<SchedulePolicyRef>(task.schedule)
  const [notifications, setNotifications] = useState<ScheduledTaskNotifications>(task.notifications)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraftActive(task.active)
    setDraftAuto(task.auto)
    setSchedule(task.schedule)
    setNotifications(task.notifications)
  }, [task])

  const dirty =
    draftActive !== task.active ||
    draftAuto !== task.auto ||
    JSON.stringify(schedule) !== JSON.stringify(task.schedule) ||
    JSON.stringify(notifications) !== JSON.stringify(task.notifications)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.updateScheduledTask(task._id, {
        active: draftActive,
        auto: draftAuto,
        schedule,
        notifications,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog — centered */}
      <div
        className="relative w-[1120px] max-w-full h-[640px] max-h-[88vh] border border-hz-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: isDark ? '#191921' : '#FFFFFF' }}
      >
        {/* Hero header — exactly 104px */}
        <div
          className="shrink-0 relative w-full overflow-hidden"
          style={{
            height: 104,
            background: isDark
              ? `linear-gradient(135deg, ${accent}22 0%, ${accent}08 40%, rgba(25,25,33,0.4) 100%)`
              : `linear-gradient(135deg, ${accent}18 0%, ${accent}08 40%, rgba(255,255,255,0.4) 100%)`,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
          }}
        >
          {/* Radial glow */}
          <div
            className="absolute pointer-events-none"
            aria-hidden
            style={{
              right: -40,
              bottom: -60,
              width: 240,
              height: 240,
              background: `radial-gradient(circle, ${accent}33 0%, transparent 60%)`,
              filter: 'blur(24px)',
            }}
          />
          {/* Grid backdrop */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.18]"
            aria-hidden
            style={{
              backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
              maskImage: 'radial-gradient(ellipse at right, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at right, black 0%, transparent 70%)',
            }}
          />
          {/* Title block — left */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 max-w-[58%]">
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: accent }}>
              Task #{task.displayNumber} · Scheduler
            </div>
            <h2
              className="text-[18px] font-bold tracking-tight leading-tight mb-0.5 truncate"
              style={{ color: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.95)' }}
            >
              {task.title}
            </h2>
            <p
              className="text-[12px] leading-snug"
              style={{ color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(71,85,105,0.80)' }}
            >
              {task.description ?? task.taskKey}
            </p>
          </div>
          {/* SVG illustration — right */}
          <div className="absolute right-14 top-1/2 -translate-y-1/2">
            <HeroForTask taskKey={task.taskKey} accent={accent} isDark={isDark} />
          </div>
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 inline-flex items-center justify-center h-8 w-8 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-hz-border flex">
          {(['description', 'schedule', 'notifications'] as DrawerTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-module-accent text-module-accent'
                  : 'border-transparent text-hz-text-secondary hover:text-hz-text'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {tab === 'description' ? (
            <DescriptionTab
              task={task}
              draftActive={draftActive}
              draftAuto={draftAuto}
              onActive={setDraftActive}
              onAuto={setDraftAuto}
              onOpenHistory={onOpenHistory}
            />
          ) : tab === 'schedule' ? (
            <SchedulePolicyForm value={schedule} onChange={setSchedule} />
          ) : (
            <NotificationsPolicyForm value={notifications} onChange={setNotifications} />
          )}
        </div>

        {/* Footer */}
        {error ? (
          <div className="border-t border-hz-border px-6 py-2 bg-status-error/5">
            <Text variant="secondary" className="!text-status-error">
              {error}
            </Text>
          </div>
        ) : null}
        <div className="shrink-0 border-t border-hz-border px-6 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-lg border border-hz-border text-hz-text hover:bg-hz-border/30 transition-colors text-[13px] font-medium"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-module-accent text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span className="text-[13px] font-semibold">{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DescriptionTab({
  task,
  draftActive,
  draftAuto,
  onActive,
  onAuto,
  onOpenHistory,
}: {
  task: ScheduledTaskRef
  draftActive: boolean
  draftAuto: boolean
  onActive: (v: boolean) => void
  onAuto: (v: boolean) => void
  onOpenHistory: () => void
}) {
  return (
    <div className="space-y-4">
      <Field label="Description">
        <Text variant="secondary" as="div" className="leading-relaxed">
          {task.description ?? '—'}
        </Text>
      </Field>

      <Field label="Active">
        <div className="flex items-center gap-3">
          <ToggleSwitch checked={draftActive} onChange={onActive} size="md" ariaLabel="Active" />
          <Text variant="secondary">Master enable. When off, the dispatcher ignores this task entirely.</Text>
        </div>
      </Field>

      <Field label="Auto (Cron)">
        <div className="flex items-center gap-3">
          <ToggleSwitch checked={draftAuto} onChange={onAuto} size="md" ariaLabel="Auto" />
          <Text variant="secondary">When off, the task only runs via manual trigger.</Text>
        </div>
      </Field>

      <button
        type="button"
        onClick={onOpenHistory}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hz-border hover:bg-hz-border/30 transition-colors"
      >
        <FileText className="h-4 w-4" />
        <span className="text-[13px] font-medium">View Run History</span>
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-hz-text-secondary mb-1.5">{label}</div>
      {children}
    </div>
  )
}
