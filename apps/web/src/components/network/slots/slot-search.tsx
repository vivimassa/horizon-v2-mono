"use client"

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface SlotSearchProps {
  open: boolean
  onClose: () => void
  onQueryChange: (query: string) => void
}

export function SlotSearch({ open, onClose, onQueryChange }: SlotSearchProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      onQueryChange('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    onQueryChange(query)
  }, [query, onQueryChange])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const glassBg = isDark ? 'rgba(25,25,33,0.90)' : 'rgba(255,255,255,0.92)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'

  return (
    <div
      className="absolute top-3 right-4 z-30 rounded-xl overflow-hidden"
      style={{
        width: 340,
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
          : '0 8px 32px rgba(96,97,112,0.14), 0 2px 8px rgba(96,97,112,0.06)',
        animation: 'bc-dropdown-in 100ms ease-out',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <Search size={14} style={{ color: palette.textTertiary }} />
        <span className="text-[13px] font-semibold flex-1" style={{ color: palette.text }}>Search Slot Series</span>
        <button onClick={onClose} className="p-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <X size={14} style={{ color: palette.textTertiary }} />
        </button>
      </div>

      <div className="px-3 py-3 space-y-2.5">
        {/* Search input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Flight number, airport, or name..."
            className="w-full h-10 pl-3 pr-10 rounded-lg text-[14px] outline-none transition-colors"
            style={{
              background: inputBg,
              border: `1px solid ${query ? 'var(--module-accent)' : glassBorder}`,
              color: palette.text,
              boxShadow: query ? '0 0 0 2px rgba(30,64,175,0.10)' : undefined,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <X size={12} style={{ color: palette.textTertiary }} />
            </button>
          )}
        </div>

        {/* Helper text */}
        <div className="text-[13px]" style={{ color: palette.textTertiary }}>
          {query
            ? 'Filtering airports and series in real-time'
            : 'Type to filter by flight number, airport code, or airport name'
          }
        </div>
      </div>
    </div>
  )
}
