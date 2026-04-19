'use client'

/**
 * Field primitives for the Crew Profile always-editable UI.
 *
 * These are thin wrappers around the admin form-primitives, tuned for:
 * - Tab-to-next-field: native DOM Tab order via sensible rendering order.
 * - Compact 2/4-column layouts via Grid.
 * - Clear "error" and "dirty" states without extra wiring.
 *
 * All styling adheres to CLAUDE.md §Critical Rules: min 13px text, 8px input
 * radius, 40px input height for primary fields, accent focus ring.
 */

import type { ReactNode } from 'react'
import { accentTint, type Palette as PaletteType } from '@skyhub/ui/theme'

const ACCENT_FALLBACK = '#14B8A6'

interface LabelProps {
  children: ReactNode
  required?: boolean
  palette: PaletteType
}
export function FieldLabel({ children, required, palette }: LabelProps) {
  return (
    <label
      className="text-[13px] uppercase tracking-wider font-medium mb-1.5 block"
      style={{ color: palette.textSecondary }}
    >
      {children}
      {required && <span style={{ color: '#E63535' }}> *</span>}
    </label>
  )
}

interface TextInputProps {
  value: string | number | null | undefined
  onChange: (v: string | null) => void
  type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'time'
  placeholder?: string
  maxLength?: number
  uppercase?: boolean
  palette: PaletteType
  isDark: boolean
  disabled?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  mono?: boolean
  step?: string
}
export function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
  uppercase,
  palette,
  isDark,
  disabled,
  onKeyDown,
  mono,
  step,
}: TextInputProps) {
  return (
    <input
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      step={step}
      onChange={(e) => {
        const v = uppercase ? e.target.value.toUpperCase() : e.target.value
        onChange(v === '' ? null : v)
      }}
      onKeyDown={onKeyDown}
      className="w-full h-10 px-3 rounded-lg text-[13px] outline-none transition-all disabled:opacity-50"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
        color: palette.text,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = accentTint(ACCENT_FALLBACK, isDark ? 0.55 : 0.35)
        e.currentTarget.style.boxShadow = `0 0 0 3px ${accentTint(ACCENT_FALLBACK, isDark ? 0.15 : 0.08)}`
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    />
  )
}

interface SelectProps<T extends string> {
  value: T | null | undefined
  options: Array<{ value: T; label: string; color?: string | null }>
  onChange: (v: T | null) => void
  placeholder?: string
  palette: PaletteType
  isDark: boolean
  allowClear?: boolean
  disabled?: boolean
}
export function SelectInput<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  palette,
  isDark,
  allowClear,
  disabled,
}: SelectProps<T>) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value
        if (!v) {
          if (allowClear) onChange(null)
          return
        }
        onChange(v as T)
      }}
      className="w-full h-10 px-3 rounded-lg text-[13px] outline-none transition-all disabled:opacity-50"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
        color: value ? palette.text : palette.textTertiary,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = accentTint(ACCENT_FALLBACK, isDark ? 0.55 : 0.35)
        e.currentTarget.style.boxShadow = `0 0 0 3px ${accentTint(ACCENT_FALLBACK, isDark ? 0.15 : 0.08)}`
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <option value="" disabled={!allowClear}>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  palette: PaletteType
  isDark: boolean
  description?: string
}
export function CheckboxField({ label, checked, onChange, palette, isDark, description }: CheckboxProps) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer py-1.5" style={{ color: palette.text }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-[16px] h-[16px] rounded"
        style={{ accentColor: ACCENT_FALLBACK }}
      />
      <span className="flex flex-col">
        <span className="text-[13px] font-medium leading-tight">{label}</span>
        {description && (
          <span className="text-[13px] leading-tight mt-0.5" style={{ color: palette.textTertiary }}>
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

interface FieldRowProps {
  label: string
  children: ReactNode
  palette: PaletteType
  required?: boolean
  hint?: string
  half?: boolean
}
export function Field({ label, children, palette, required, hint }: FieldRowProps) {
  return (
    <div>
      <FieldLabel required={required} palette={palette}>
        {label}
      </FieldLabel>
      {children}
      {hint && (
        <p className="text-[13px] mt-1" style={{ color: palette.textTertiary }}>
          {hint}
        </p>
      )}
    </div>
  )
}

export function FieldGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const cls =
    cols === 1
      ? 'grid grid-cols-1'
      : cols === 2
        ? 'grid grid-cols-1 md:grid-cols-2'
        : cols === 3
          ? 'grid grid-cols-1 md:grid-cols-3'
          : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  return <div className={`${cls} gap-4`}>{children}</div>
}
