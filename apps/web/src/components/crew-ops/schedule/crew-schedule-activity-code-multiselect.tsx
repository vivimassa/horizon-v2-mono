'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export interface ActivityCodeOption {
  id: string
  code: string
  name: string
  color: string | null
}

interface Props {
  options: ActivityCodeOption[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

/**
 * Gluestack-style multiselect dropdown for the Smart Filter's
 * "On activity code" criterion. Each row shows a colored dot + code
 * + descriptive name. The collapsed trigger shows a selection count so
 * the row stays compact even when many codes are picked.
 *
 * Kept separate from the sheet so `crew-schedule-smart-filter.tsx`
 * stays under the 400-line component limit.
 */
export function CrewScheduleActivityCodeMultiselect({
  options,
  selected,
  onChange,
  placeholder = 'Select activity codes…',
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q))
  }, [options, query])

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 h-10 px-3 rounded-lg text-[13px] transition-colors"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${borderColor}`,
        }}
      >
        <span className="flex-1 text-left truncate">
          {selected.length === 0 ? (
            <span className="text-hz-text-tertiary">{placeholder}</span>
          ) : selected.length <= 2 ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              {selected.slice(0, 2).map((id) => {
                const o = optionById.get(id)
                if (!o) return null
                return (
                  <span key={id} className="inline-flex items-center gap-1 text-[13px] font-medium">
                    {o.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />}
                    {o.code}
                  </span>
                )
              })}
            </span>
          ) : (
            <span className="text-[13px] font-medium">{selected.length} codes selected</span>
          )}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-hz-border/30 shrink-0"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5 text-hz-text-tertiary" />
          </button>
        )}
        <ChevronDown
          className={`w-4 h-4 text-hz-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden flex flex-col"
          style={{
            background: isDark ? 'rgba(25,25,33,0.98)' : '#FFFFFF',
            border: `1px solid ${borderColor}`,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(96,97,112,0.14)',
            maxHeight: 280,
          }}
        >
          <div
            className="flex items-center gap-2 px-2.5 h-10 shrink-0"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            <Search className="w-3.5 h-3.5 text-hz-text-tertiary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent outline-none text-[13px]"
            />
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[13px] text-hz-text-tertiary text-center">No codes match</div>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-hz-border/20 transition-colors"
                  >
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                      style={{
                        background: checked ? 'var(--module-accent)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--module-accent)' : 'rgba(125,125,140,0.35)'}`,
                      }}
                    >
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: opt.color ?? 'rgba(125,125,140,0.4)',
                      }}
                    />
                    <span className="text-[13px] font-semibold shrink-0">{opt.code}</span>
                    <span className="text-[13px] text-hz-text-secondary truncate">{opt.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
