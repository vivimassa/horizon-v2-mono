'use client'

import type { ReactNode } from 'react'
import { Text } from './Text'

export type FieldRowType = 'text' | 'number' | 'toggle' | 'select' | 'time-hhmm' | 'multiline' | 'readonly'

export interface FieldRowOption {
  label: string
  value: string
  color?: string
}

type FieldRowValue = string | number | boolean | null | undefined

interface FieldRowProps {
  label: string
  value?: FieldRowValue | ReactNode
  editing?: boolean
  editValue?: FieldRowValue
  onChangeValue?: (value: FieldRowValue) => void
  type?: FieldRowType
  options?: FieldRowOption[]
  mono?: boolean
  maxLength?: number
  placeholder?: string
  /** 50% width — used inside grids */
  half?: boolean
  suffix?: string
  icon?: ReactNode
}

export function FieldRow({
  label,
  value,
  editing = false,
  editValue,
  onChangeValue,
  type = 'text',
  options,
  mono = false,
  maxLength,
  placeholder,
  suffix,
  icon,
}: FieldRowProps) {
  // Edit mode — toggle
  if (editing && type === 'toggle') {
    const on = Boolean(editValue)
    return (
      <div className="py-2.5 border-b border-hz-border/50">
        <Text variant="fieldLabel" muted as="div" className="mb-1">
          {label}
        </Text>
        <button
          type="button"
          onClick={() => onChangeValue?.(!on)}
          className="inline-flex items-center rounded-lg px-3 py-1.5 transition-colors"
          style={{
            backgroundColor: on ? 'rgba(6,194,112,0.12)' : 'rgba(255,59,59,0.12)',
            color: on ? '#06C270' : '#E63535',
          }}
        >
          <Text variant="cardTitle" as="span" className="!font-semibold" style={{ color: 'inherit' }}>
            {on ? 'Yes' : 'No'}
          </Text>
        </button>
      </div>
    )
  }

  // Edit mode — select/picker
  if (editing && type === 'select' && options) {
    return (
      <div className="py-2.5 border-b border-hz-border/50">
        <Text variant="fieldLabel" muted as="div" className="mb-1.5">
          {label}
        </Text>
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = String(editValue ?? '') === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeValue?.(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border transition-colors ${
                  active
                    ? 'border-module-accent bg-module-accent/10'
                    : 'border-hz-border bg-transparent hover:bg-hz-border/30'
                }`}
              >
                {opt.color ? (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                ) : null}
                <Text
                  variant="cardTitle"
                  as="span"
                  className={active ? '!text-module-accent !font-semibold' : '!font-medium'}
                >
                  {opt.label}
                </Text>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Edit mode — text / number / multiline / time-hhmm
  if (editing && type !== 'readonly') {
    const isNumber = type === 'number'
    const isTime = type === 'time-hhmm'
    const isMultiline = type === 'multiline'
    const rawEdit =
      editValue === null || editValue === undefined
        ? ''
        : isTime && typeof editValue === 'number'
          ? minutesToHHMM(editValue)
          : String(editValue)

    const inputClasses = `w-full bg-transparent border-b border-module-accent/40 outline-none focus:border-module-accent py-1 text-[14px] text-hz-text font-medium ${
      mono || isTime ? 'font-mono' : ''
    }`

    return (
      <div className="py-2.5 border-b border-hz-border/50">
        <Text variant="fieldLabel" muted as="div" className="mb-1">
          {label}
        </Text>
        <div className="flex items-center gap-1.5">
          {icon}
          {isMultiline ? (
            <textarea
              value={rawEdit}
              onChange={(e) => onChangeValue?.(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              rows={3}
              className={`${inputClasses} resize-y min-h-[60px]`}
            />
          ) : (
            <input
              type={isNumber ? 'number' : 'text'}
              value={rawEdit}
              placeholder={placeholder ?? (isTime ? 'H:MM' : undefined)}
              maxLength={maxLength}
              onChange={(e) => {
                const v = e.target.value
                if (isNumber) onChangeValue?.(v === '' ? null : Number(v))
                else if (isTime) onChangeValue?.(v === '' ? null : hhmmToMinutes(v))
                else onChangeValue?.(v)
              }}
              className={inputClasses}
            />
          )}
          {suffix ? (
            <Text variant="secondary" muted as="span" className="shrink-0">
              {suffix}
            </Text>
          ) : null}
        </div>
      </div>
    )
  }

  // View mode
  const display = renderDisplayValue(value, type, options)
  const isYesColor = type === 'toggle' && value

  return (
    <div className="py-2.5 border-b border-hz-border/50">
      <Text variant="fieldLabel" muted as="div" className="mb-1">
        {label}
      </Text>
      <div className="flex items-center gap-1.5">
        {icon}
        <Text
          variant="body"
          as="span"
          className={`!font-medium flex-1 ${mono ? 'font-mono' : ''}`}
          style={isYesColor ? { color: '#06C270' } : undefined}
        >
          {display}
        </Text>
        {suffix && display !== '\u2014' ? (
          <Text variant="secondary" muted as="span">
            {suffix}
          </Text>
        ) : null}
      </div>
    </div>
  )
}

function renderDisplayValue(
  value: FieldRowValue | ReactNode,
  type: FieldRowType,
  options?: FieldRowOption[],
): ReactNode {
  if (value === null || value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))) {
    return '\u2014'
  }
  if (type === 'toggle') return value ? 'Yes' : 'No'
  if (type === 'time-hhmm' && typeof value === 'number') {
    return minutesToHHMM(value)
  }
  if (type === 'select' && options && (typeof value === 'string' || typeof value === 'number')) {
    const match = options.find((o) => o.value === String(value))
    return match?.label ?? String(value)
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  // React node passthrough
  return value as ReactNode
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function hhmmToMinutes(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.includes(':')) {
    const [hStr, mStr] = trimmed.split(':')
    const h = parseInt(hStr ?? '0', 10)
    const m = parseInt(mStr ?? '0', 10)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const n = parseInt(trimmed, 10)
  return Number.isNaN(n) ? null : n
}
