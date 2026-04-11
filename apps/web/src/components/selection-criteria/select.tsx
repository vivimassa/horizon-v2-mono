'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
}

/** Single-value dropdown select */
export function Select({ value, onChange, options, placeholder = 'Select…' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full min-h-[36px] px-3 rounded-xl text-[13px] border border-black/20 dark:border-white/20 bg-white dark:bg-hz-card transition-colors hover:border-black/30 dark:hover:border-white/30"
      >
        <span className={selected ? 'text-hz-text' : 'text-hz-text-secondary/50'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-hz-text-secondary transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-hz-border bg-white dark:bg-hz-card shadow-lg max-h-[240px] overflow-y-auto py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className="flex items-center justify-between w-full px-3 py-2 text-[13px] hover:bg-hz-border/30 transition-colors"
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check className="h-3.5 w-3.5 text-module-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
