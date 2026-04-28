'use client'

import type { ScheduledTaskNotifications } from '@skyhub/api'
import { ToggleSwitch } from '@/components/ui'

/**
 * SkyHub canonical task-notifications editor.
 *
 * Reuse target for every cron / scheduled-job UI in Horizon — pairs with
 * `<SchedulePolicyForm>` to form a complete task config dialog.
 *
 * @example
 *   <NotificationsPolicyForm value={notifications} onChange={setNotifications} />
 */
export interface NotificationsPolicyFormProps {
  value: ScheduledTaskNotifications
  onChange: (next: ScheduledTaskNotifications) => void
  disabled?: boolean
}

export function NotificationsPolicyForm({ value, onChange, disabled }: NotificationsPolicyFormProps) {
  const setRecipients = (raw: string): void => {
    onChange({
      ...value,
      userIds: raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }

  return (
    <div className="space-y-3">
      <ToggleRow
        label="On missed start"
        sub="Job did not fire at its scheduled time"
        checked={value.onMissedStart}
        onChange={(v) => onChange({ ...value, onMissedStart: v })}
        disabled={disabled}
      />
      <ToggleRow
        label="On terminated"
        sub="Job was cancelled before completion"
        checked={value.onTerminated}
        onChange={(v) => onChange({ ...value, onTerminated: v })}
        disabled={disabled}
      />
      <ToggleRow
        label="On error"
        sub="Job failed with an error"
        checked={value.onError}
        onChange={(v) => onChange({ ...value, onError: v })}
        disabled={disabled}
      />
      <Field label="Recipients (user IDs)">
        <textarea
          value={value.userIds.join(', ')}
          onChange={(e) => setRecipients(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="Comma-separated user IDs"
          className="w-full px-3 py-2 rounded-lg border border-hz-border bg-hz-card text-[13px] text-hz-text outline-none focus:border-module-accent focus:ring-2 focus:ring-module-accent/30"
        />
      </Field>
    </div>
  )
}

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
  disabled,
}: {
  label: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <ToggleSwitch checked={checked} onChange={onChange} size="md" ariaLabel={label} disabled={disabled} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-hz-text">{label}</div>
        <div className="text-[12px] text-hz-text-secondary">{sub}</div>
      </div>
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
