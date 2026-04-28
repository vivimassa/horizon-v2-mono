'use client'

import type { SchedulePolicyRef, ScheduleFrequency } from '@skyhub/api'
import { TextInput } from '@/components/ui'
import { Dropdown } from '@/components/ui/dropdown'
import { TimeOfDayPicker, type TimeOfDayPickerProps } from '@/components/ui/time-of-day-picker'
import { TimezoneDropdown } from '@/components/ui/timezone-dropdown'
import { X } from 'lucide-react'

/**
 * SkyHub canonical cron-schedule editor.
 *
 * Single source of truth for any task-scheduler config UI in Horizon
 * (7.1.6 Task Scheduler Management today; future ASM/SSM auto-transmit
 * windows, hotel email schedules, sync cadences, etc.).
 *
 * What it provides — composed from SkyHub primitives only:
 *   • Frequency selector (Daily / Weekly / Monthly) — `Dropdown`
 *   • Conditional day-of-week picker (Weekly)
 *   • Conditional day-of-month picker (Monthly)  — `TextInput`
 *   • Up to 6 firing times, each via `TimeOfDayPicker`
 *   • Searchable IANA `TimezoneDropdown`
 *
 * @example
 *   <SchedulePolicyForm value={schedule} onChange={setSchedule} />
 *   <SchedulePolicyForm value={schedule} onChange={setSchedule} maxTimes={3} minuteStep={1} />
 */
export interface SchedulePolicyFormProps {
  value: SchedulePolicyRef
  onChange: (next: SchedulePolicyRef) => void
  /** Max time-of-day slots. Default 6 (matches AIMS Job Scheduler). */
  maxTimes?: number
  /** Time-picker minute granularity. Default 5. */
  minuteStep?: TimeOfDayPickerProps['minuteStep']
  disabled?: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const FREQUENCY_OPTS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export function SchedulePolicyForm({
  value,
  onChange,
  maxTimes = 6,
  minuteStep = 5,
  disabled,
}: SchedulePolicyFormProps) {
  const set = <K extends keyof SchedulePolicyRef>(k: K, v: SchedulePolicyRef[K]): void => {
    onChange({ ...value, [k]: v })
  }

  const updateTimeAt = (idx: number, next: string): void => {
    const arr = [...value.timesOfDayLocal]
    arr[idx] = next
    onChange({ ...value, timesOfDayLocal: arr })
  }
  const addTime = (): void => {
    if (value.timesOfDayLocal.length >= maxTimes) return
    onChange({ ...value, timesOfDayLocal: [...value.timesOfDayLocal, '00:00'] })
  }
  const removeTime = (idx: number): void => {
    const arr = value.timesOfDayLocal.filter((_, i) => i !== idx)
    onChange({ ...value, timesOfDayLocal: arr.length > 0 ? arr : ['00:30'] })
  }

  return (
    <div className="space-y-5">
      <Field label="Frequency">
        <Dropdown
          options={FREQUENCY_OPTS}
          value={value.frequency}
          onChange={(v) => set('frequency', v as ScheduleFrequency)}
          disabled={disabled}
        />
      </Field>

      {value.frequency === 'weekly' ? (
        <Field label="Days of week">
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day, idx) => {
              const on = (value.daysOfWeek ?? []).includes(idx)
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const cur = value.daysOfWeek ?? []
                    const next = on ? cur.filter((d) => d !== idx) : [...cur, idx].sort()
                    set('daysOfWeek', next)
                  }}
                  className={`h-8 px-3 rounded-md text-[13px] font-medium border transition-colors ${
                    on
                      ? 'border-module-accent bg-module-accent text-white'
                      : 'border-hz-border text-hz-text hover:bg-hz-border/30'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </Field>
      ) : null}

      {value.frequency === 'monthly' ? (
        <Field label="Day of month">
          <div className="w-28">
            <TextInput
              type="number"
              min={1}
              max={31}
              value={value.dayOfMonth ?? 1}
              disabled={disabled}
              onChange={(e) => set('dayOfMonth', Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
            />
          </div>
        </Field>
      ) : null}

      <Field label={`Times of day${value.timesOfDayLocal.length > 1 ? ` (${value.timesOfDayLocal.length})` : ''}`}>
        <div className="space-y-2">
          {value.timesOfDayLocal.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <TimeOfDayPicker
                value={t}
                onChange={(v) => updateTimeAt(i, v)}
                minuteStep={minuteStep}
                disabled={disabled}
              />
              {value.timesOfDayLocal.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeTime(i)}
                  disabled={disabled}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
                  aria-label="Remove time"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          {value.timesOfDayLocal.length < maxTimes ? (
            <button
              type="button"
              onClick={addTime}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hz-border hover:bg-hz-border/30 transition-colors text-[13px] font-medium"
            >
              + Add time
            </button>
          ) : null}
        </div>
      </Field>

      <Field label="Timezone (IANA)">
        <TimezoneDropdown value={value.timezone} onChange={(tz) => set('timezone', tz)} disabled={disabled} />
      </Field>
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
