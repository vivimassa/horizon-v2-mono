'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

// ── Types ──

export interface DropdownOption {
  value: string
  label: string
  color?: string
  icon?: React.ReactNode
}

interface DropdownProps {
  options: DropdownOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  /** Max visible items before scrolling (default: all) */
  maxVisible?: number
}

// ── Component ──

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  size = 'md',
  className = '',
  disabled,
  maxVisible,
}: DropdownProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Position panel when opening — flip above if overflowing viewport
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelHeight = Math.min(options.length * 36 + 8, 280)
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < panelHeight + 8 ? rect.top - panelHeight - 4 : rect.bottom + 4
    setPanelPos({ top, left: rect.left, width: rect.width })
  }, [open, options.length])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current && !triggerRef.current.contains(t) && panelRef.current && !panelRef.current.contains(t))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const selected = options.find((o) => o.value === value)
  const h = size === 'sm' ? 'h-8' : 'h-9'
  const textSize = 'text-[13px]'

  // Theme colors
  const triggerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const triggerBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const panelShadow = isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(96,97,112,0.12)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const accent = 'var(--module-accent, #1e40af)'

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
        disabled={disabled}
        className={`w-full ${h} flex items-center justify-between gap-2 px-3 rounded-lg ${textSize} font-medium transition-colors disabled:opacity-40`}
        style={{ background: triggerBg, border: `1px solid ${triggerBorder}` }}
      >
        <span className="truncate" style={{ color: selected ? textPrimary : textMuted }}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.icon}
              {selected.color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selected.color }} />
              )}
              {selected.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          style={{ color: textMuted }}
        />
      </button>

      {/* Panel — portaled to body to escape overflow:hidden containers */}
      {open &&
        mounted &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[9999] rounded-xl py-1"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              minWidth: panelPos.width,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              boxShadow: panelShadow,
              backdropFilter: 'blur(20px)',
              maxHeight: maxVisible ? maxVisible * (size === 'sm' ? 32 : 36) + 8 : undefined,
              overflowY: maxVisible ? 'auto' : undefined,
            }}
          >
            {options.map((opt) => {
              const isActive = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center gap-2.5 ${h} px-3 ${textSize} font-medium transition-colors`}
                  style={{ color: isActive ? accent : textPrimary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {opt.icon}
                  {opt.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />}
                  <span className="flex-1 text-left truncate">{opt.label}</span>
                  {isActive && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                      <path
                        d="M3 7l3 3 5-5.5"
                        stroke={accent}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
