'use client'

import { ToggleSwitch } from '@/components/ui/toggle-switch'

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Label + iOS-style toggle. Thin wrapper over the global ToggleSwitch. */
export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-[13px] text-hz-text-secondary group-hover:text-hz-text transition-colors">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} size="sm" />
    </label>
  )
}
