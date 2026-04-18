'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export interface AirportOption {
  code: string
  iata: string
  icao: string
  name: string
  city: string
  country: string
}

interface AirportComboBoxProps {
  options: AirportOption[]
  value: string
  onChange: (code: string) => void
  placeholder?: string
  disabled?: boolean
}

export function AirportComboBox({
  options,
  value,
  onChange,
  placeholder = 'Type to search airport...',
  disabled,
}: AirportComboBoxProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })
  const [highlight, setHighlight] = useState(0)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const selected = useMemo(() => options.find((o) => o.code === value) ?? null, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 200)
    return options
      .filter((o) => {
        return (
          o.iata.toLowerCase().includes(q) ||
          o.icao.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q) ||
          o.country.toLowerCase().includes(q)
        )
      })
      .slice(0, 200)
  }, [options, query])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelH = 320
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < panelH + 8 ? rect.top - panelH - 4 : rect.bottom + 4
    setPanelPos({ top, left: rect.left, width: rect.width })
  }, [open, filtered.length])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current && !triggerRef.current.contains(t) && panelRef.current && !panelRef.current.contains(t)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const triggerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const triggerBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const accent = 'var(--module-accent, #2563eb)'

  function select(code: string) {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) select(opt.code)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between gap-2 px-3 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40"
        style={{ background: triggerBg, border: `1px solid ${triggerBorder}` }}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0 text-hz-text">
            <span className="font-semibold" style={{ color: accent }}>
              {selected.iata || selected.icao}
            </span>
            <span className="truncate text-hz-text-secondary">{selected.city || selected.name}</span>
          </span>
        ) : (
          <span className="truncate" style={{ color: textMuted }}>
            {placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              className="p-0.5 rounded hover:bg-hz-border/30 transition-colors"
            >
              <X size={12} style={{ color: textMuted }} />
            </span>
          )}
          <ChevronDown size={13} style={{ color: textMuted }} />
        </div>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed rounded-xl overflow-hidden z-[1000] flex flex-col"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: 320,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              boxShadow: isDark ? '0 10px 32px rgba(0,0,0,0.45)' : '0 10px 32px rgba(96,97,112,0.16)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div
              className="flex items-center gap-2 px-3 h-10 shrink-0"
              style={{ borderBottom: `1px solid ${panelBorder}` }}
            >
              <Search size={13} style={{ color: textMuted }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search by code, city, or name..."
                className="flex-1 bg-transparent outline-none text-[13px] font-medium text-hz-text placeholder:text-hz-text-tertiary"
              />
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px] font-medium" style={{ color: textMuted }}>
                  No matching airports
                </div>
              ) : (
                filtered.map((o, idx) => {
                  const active = idx === highlight
                  const isSel = o.code === value
                  return (
                    <button
                      key={o.code}
                      onClick={() => select(o.code)}
                      onMouseEnter={() => setHighlight(idx)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                      style={{ background: active ? hoverBg : 'transparent' }}
                    >
                      <span
                        className="text-[13px] font-bold tabular-nums shrink-0 w-12"
                        style={{ color: isSel ? accent : isDark ? '#F5F2FD' : '#1C1C28' }}
                      >
                        {o.iata || o.icao}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-hz-text truncate">
                          {o.city || o.name}
                        </span>
                        <span className="block text-[13px] font-medium truncate" style={{ color: textMuted }}>
                          {o.country || o.icao}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
