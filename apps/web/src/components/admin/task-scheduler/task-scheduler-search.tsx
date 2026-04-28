'use client'

import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

/**
 * Task Scheduler — search box.
 *
 * Mirrors the 2.1.1 GanttSearch glass-popover aesthetic
 * (apps/web/src/components/network/gantt/gantt-search.tsx). Opens from the
 * toolbar Search button. Floats top-right of the page; backdrop-blur + glass.
 */
interface TaskSchedulerSearchProps {
  open: boolean
  onClose: () => void
  query: string
  onQueryChange: (v: string) => void
  matchCount: number
  totalCount: number
}

export function TaskSchedulerSearch({
  open,
  onClose,
  query,
  onQueryChange,
  matchCount,
  totalCount,
}: TaskSchedulerSearchProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

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
  const hasQuery = query.trim().length > 0
  const noMatch = hasQuery && matchCount === 0

  return (
    <div
      className="absolute top-3 right-3 z-30 rounded-xl overflow-hidden"
      style={{
        width: 360,
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
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <Search size={14} style={{ color: palette.textTertiary }} />
        <span className="text-[13px] font-semibold flex-1" style={{ color: palette.text }}>
          Search Tasks
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Close"
        >
          <X size={14} style={{ color: palette.textTertiary }} />
        </button>
      </div>

      <div className="px-3 py-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Application name or task key…"
            className="w-full h-10 pl-3 pr-20 rounded-lg text-[14px] outline-none transition-colors"
            style={{
              background: inputBg,
              border: `1px solid ${noMatch ? '#E63535' : hasQuery ? 'var(--module-accent)' : glassBorder}`,
              color: palette.text,
              boxShadow: hasQuery ? '0 0 0 2px rgba(30,64,175,0.10)' : undefined,
            }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {hasQuery && (
              <span
                className="text-[11px] font-mono font-medium px-1"
                style={{ color: noMatch ? '#E63535' : palette.textTertiary }}
              >
                {noMatch ? 'No match' : `${matchCount}/${totalCount}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
