/**
 * Legacy adapter for the airport-originated FieldRow.
 *
 * 13 admin shells (aircraft, lopa, expiry, delay, crew, etc.) still import
 * from this path with the old API (`fieldKey` + `onChange(key, v)` + `inputType`).
 * The canonical component lives at `@/components/ui/FieldRow` with a cleaner API
 * (`onChangeValue(v)` + `type`). Rather than rename 13 files in this sprint,
 * this shim maps the old API to the new one.
 *
 * When each legacy shell migrates to `@/components/ui`, delete this file.
 */
import type { ReactNode } from 'react'
import { FieldRow as UiFieldRow, type FieldRowType, type FieldRowOption } from '@/components/ui'

interface LegacyFieldRowProps {
  label: string
  value?: ReactNode
  editing?: boolean
  fieldKey?: string
  editValue?: string | number | boolean | null
  onChange?: (key: string, value: string | number | boolean | null) => void
  inputType?: 'text' | 'number' | 'toggle' | 'select'
  selectOptions?: string[]
}

export function FieldRow({
  label,
  value,
  editing,
  fieldKey,
  editValue,
  onChange,
  inputType = 'text',
  selectOptions,
}: LegacyFieldRowProps) {
  const type: FieldRowType = inputType
  const options: FieldRowOption[] | undefined = selectOptions?.map((s) => ({
    label: s,
    value: s,
  }))

  return (
    <UiFieldRow
      label={label}
      value={value as any}
      editing={editing}
      editValue={editValue}
      onChangeValue={onChange && fieldKey ? (v) => onChange(fieldKey, v ?? null) : undefined}
      type={type}
      options={options}
    />
  )
}
