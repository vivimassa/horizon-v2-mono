'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Save, Settings as SettingsIcon, Clock, AlertTriangle, Plane, FileText, Hourglass } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useCheckInConfigStore } from '@/stores/use-check-in-config-store'
import type { OperatorCheckInConfig } from '@skyhub/api'
import { ToggleSwitch } from '@/components/ui/toggle-switch'

interface Props {
  open: boolean
  onClose: () => void
}

type SectionKey = 'basic' | 'lateInfo' | 'delayed' | 'groundDuties' | 'precheckIn'

const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'basic', label: 'Basic', icon: SettingsIcon },
  { key: 'lateInfo', label: 'Late Info', icon: AlertTriangle },
  { key: 'delayed', label: 'Delayed Flights', icon: Plane },
  { key: 'groundDuties', label: 'Ground Duties', icon: FileText },
  { key: 'precheckIn', label: 'Pre-Check-In', icon: Hourglass },
]

/**
 * 4.1.7.1 Settings drawer — slide-over from the right. Mirrors the HOTAC
 * config shell but compressed into a single drawer because Check-In has
 * fewer sections.
 */
export function CrewCheckInSettingsDrawer({ open, onClose }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const config = useCheckInConfigStore((s) => s.config)
  const save = useCheckInConfigStore((s) => s.save)

  const [draft, setDraft] = useState<OperatorCheckInConfig | null>(config)
  const [section, setSection] = useState<SectionKey>('basic')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    setDraft(config)
  }, [config])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config])

  if (!open || !draft) return null

  const onSave = async () => {
    setSaving(true)
    try {
      await save(draft)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 3000)
    } catch (err) {
      console.error('[crew-checkin] save config failed', err)
    } finally {
      setSaving(false)
    }
  }

  const updateBasic = (patch: Partial<OperatorCheckInConfig['basic']>) =>
    setDraft({ ...draft, basic: { ...draft.basic, ...patch } })
  const updateLate = (patch: Partial<OperatorCheckInConfig['lateInfo']>) =>
    setDraft({ ...draft, lateInfo: { ...draft.lateInfo, ...patch } })
  const updateDelayed = (patch: Partial<OperatorCheckInConfig['delayed']>) =>
    setDraft({ ...draft, delayed: { ...draft.delayed, ...patch } })
  const updateGround = (patch: Partial<OperatorCheckInConfig['groundDuties']>) =>
    setDraft({ ...draft, groundDuties: { ...draft.groundDuties, ...patch } })
  const updatePrecheck = (patch: Partial<OperatorCheckInConfig['precheckIn']>) =>
    setDraft({ ...draft, precheckIn: { ...draft.precheckIn, ...patch } })

  return (
    <>
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="pointer-events-auto flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 'min(1200px, 100%)',
            height: 'min(720px, 92vh)',
            background: isDark ? 'rgba(14,14,20,0.98)' : 'rgba(255,255,255,0.99)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Header */}
          <div className="h-14 px-4 flex items-center gap-3 border-b border-hz-border">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--module-accent, #1e40af)' }} />
            <span className="text-[15px] font-bold tracking-tight">Crew Check-In Settings</span>
            <span className="text-[13px] text-hz-text-tertiary">4.1.7.1</span>

            <div className="flex-1" />

            {savedAt && (
              <span className="text-[13px] font-semibold" style={{ color: '#06C270' }}>
                Saved
              </span>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--module-accent, #1e40af)' }}
            >
              <Save size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-hz-background-hover"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex">
            {/* Sidebar */}
            <div className="w-56 shrink-0 border-r border-hz-border py-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon
                const active = section === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    className="w-full text-left px-4 h-10 flex items-center gap-2.5 text-[13px] font-medium relative hover:bg-hz-background-hover transition-colors"
                    style={{
                      color: active ? 'var(--module-accent, #1e40af)' : undefined,
                      background: active ? 'rgba(62,123,250,0.08)' : undefined,
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-0.5"
                        style={{ background: 'var(--module-accent, #1e40af)' }}
                      />
                    )}
                    <Icon size={14} />
                    {s.label}
                  </button>
                )
              })}
            </div>

            {/* Section body */}
            <div className="flex-1 min-w-0 overflow-auto p-6">
              {section === 'basic' && (
                <Section title="Basic Configuration" subtitle="When and how crew may report.">
                  <SelectRow
                    label="Check-in is allowed"
                    value={draft.basic.scope}
                    onChange={(v) => updateBasic({ scope: v as OperatorCheckInConfig['basic']['scope'] })}
                    options={[
                      { key: 'pairing-start', label: 'At pairing start only' },
                      { key: 'every-duty', label: 'At each duty' },
                      { key: 'free', label: 'Free (controller decides)' },
                    ]}
                  />
                  <NumberRow
                    label="Earliest check-in window before RRT"
                    suffix="min"
                    value={draft.basic.earliestCheckInMinutesBeforeRrt}
                    min={0}
                    max={24 * 60}
                    step={5}
                    onChange={(v) => updateBasic({ earliestCheckInMinutesBeforeRrt: v })}
                    hint="Crew may check-in at most this many minutes before their Required Reporting Time."
                  />
                </Section>
              )}

              {section === 'lateInfo' && (
                <Section
                  title="Late Information"
                  subtitle="Thresholds that drive the LATE / VERY LATE / NO-SHOW pills."
                >
                  <NumberRow
                    label="Late after"
                    suffix="min past RRT"
                    value={draft.lateInfo.lateAfterMinutes}
                    min={1}
                    max={60}
                    onChange={(v) => updateLate({ lateAfterMinutes: v })}
                  />
                  <NumberRow
                    label="Very Late after"
                    suffix="min past RRT"
                    value={draft.lateInfo.veryLateAfterMinutes}
                    min={5}
                    max={120}
                    onChange={(v) => updateLate({ veryLateAfterMinutes: v })}
                  />
                  <NumberRow
                    label="Standby Late after"
                    suffix="min past standby start"
                    value={draft.lateInfo.standbyLateAfterMinutes}
                    min={1}
                    max={60}
                    onChange={(v) => updateLate({ standbyLateAfterMinutes: v })}
                  />
                  <NumberRow
                    label="No-Show after"
                    suffix="min past RRT"
                    value={draft.lateInfo.noShowAfterMinutes}
                    min={10}
                    max={240}
                    onChange={(v) => updateLate({ noShowAfterMinutes: v })}
                  />
                </Section>
              )}

              {section === 'delayed' && (
                <Section title="Delayed Flights" subtitle="Surface crew assigned to delayed flights with stale RRT.">
                  <ToggleRow
                    label="Flag crew when flight is delayed and RRT was not amended"
                    checked={draft.delayed.flagWhenRrtNotAmended}
                    onChange={(v) => updateDelayed({ flagWhenRrtNotAmended: v })}
                  />
                  <NumberRow
                    label="Minimum delay before flagging"
                    suffix="min"
                    value={draft.delayed.minimumDelayMinutes}
                    min={0}
                    max={480}
                    step={5}
                    disabled={!draft.delayed.flagWhenRrtNotAmended}
                    onChange={(v) => updateDelayed({ minimumDelayMinutes: v })}
                  />
                </Section>
              )}

              {section === 'groundDuties' && (
                <Section title="Ground Duties" subtitle="Which non-flight duties require crew check-in.">
                  <TextRow
                    label="Activity codes that require check-in"
                    hint="Comma-separated codes (e.g. SBY, OFC, TRN). Empty = no ground duties require check-in."
                    value={draft.groundDuties.requireCheckInFor.join(', ')}
                    onChange={(v) =>
                      updateGround({
                        requireCheckInFor: v
                          .split(/[,\s]+/)
                          .map((s) => s.trim().toUpperCase())
                          .filter(Boolean),
                      })
                    }
                  />
                  <ToggleRow
                    label="Suppress check-in for ground duties not in the list above (even inside a pairing)"
                    checked={draft.groundDuties.suppressOthersInPairing}
                    onChange={(v) => updateGround({ suppressOthersInPairing: v })}
                  />
                </Section>
              )}

              {section === 'precheckIn' && (
                <Section title="Pre-Check-In" subtitle="Allow crew to pre-report early via web or kiosk.">
                  <NumberRow
                    label="Pre-check-in window"
                    suffix="min before RRT (0 = disabled)"
                    value={draft.precheckIn.windowMinutesBeforeRrt}
                    min={0}
                    max={24 * 60}
                    step={15}
                    onChange={(v) => updatePrecheck({ windowMinutesBeforeRrt: v })}
                  />
                  <NumberRow
                    label="Pre-check-in is LATE within"
                    suffix="min before RRT"
                    value={draft.precheckIn.lateThresholdMinutesBeforeRrt}
                    min={0}
                    max={24 * 60}
                    step={15}
                    disabled={draft.precheckIn.windowMinutesBeforeRrt === 0}
                    onChange={(v) => updatePrecheck({ lateThresholdMinutesBeforeRrt: v })}
                  />
                </Section>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Form primitives ───────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-hz-border">
        <span className="w-1 h-5 rounded-full" style={{ background: 'var(--module-accent, #1e40af)' }} />
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-[13px] text-hz-text-tertiary -mt-2">{subtitle}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-3 items-start py-2">
      <div className="col-span-7 pt-1.5">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[13px] text-hz-text-tertiary mt-0.5">{hint}</div>}
      </div>
      <div className="col-span-5 flex justify-end">{children}</div>
    </div>
  )
}

function NumberRow({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  return (
    <FieldRow label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
          className="w-24 h-10 px-2 rounded-lg border border-hz-border text-[14px] text-right disabled:opacity-50 focus:outline-none focus:border-module-accent"
          style={{ background: 'transparent' }}
        />
        {suffix && <span className="text-[13px] text-hz-text-tertiary">{suffix}</span>}
      </div>
    </FieldRow>
  )
}

function SelectRow({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  options: { key: string; label: string }[]
}) {
  return (
    <FieldRow label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-2 rounded-lg border border-hz-border text-[14px] focus:outline-none focus:border-module-accent"
        style={{ background: 'transparent' }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  )
}

function TextRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <FieldRow label={label} hint={hint}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="SBY, OFC, TRN"
        className="w-72 h-10 px-2 rounded-lg border border-hz-border text-[14px] focus:outline-none focus:border-module-accent"
        style={{ background: 'transparent' }}
      />
    </FieldRow>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FieldRow label={label}>
      <ToggleSwitch checked={checked} onChange={onChange} size="md" />
    </FieldRow>
  )
}
