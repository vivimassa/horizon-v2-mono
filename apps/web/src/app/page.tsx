'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'
import { MODULE_REGISTRY, type ModuleEntry } from '@skyhub/constants'
import { useRouter } from 'next/navigation'
import { WallpaperBg } from '@/components/wallpaper-bg'
import { useUser } from '@/components/user-provider'
import { useAuth } from '@/components/auth-provider'
import { useTheme } from '@/components/theme-provider'

// ── Domain colors ──

const DOMAIN_COLORS: Record<string, string> = {
  network: '#eab308',
  operations: '#ef4444',
  workforce: '#22c55e',
  ground: '#06b6d4',
  admin: '#64748b',
}

// ── Theme-aware glass palette ──

function useGlass() {
  const { theme } = useTheme()
  const d = theme === 'dark'
  return useMemo(
    () => ({
      isDark: d,
      card: d ? 'rgba(15,15,25,0.45)' : 'rgba(255,255,255,0.55)',
      cardHover: d ? 'rgba(25,25,40,0.55)' : 'rgba(255,255,255,0.72)',
      border: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      borderHov: d ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)',
      text: d ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.85)',
      textSec: d ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.45)',
      textMuted: d ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)',
      textFaint: d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      input: d ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.50)',
      inputBdr: d ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
      menuBg: d ? 'rgba(15,15,25,0.92)' : 'rgba(255,255,255,0.92)',
      menuBdr: d ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
      menuHover: d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      menuSep: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      menuText: d ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.70)',
      addBg: d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      addBdr: d ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      addBdrHov: d ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)',
      addBgHov: d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      gripBg: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      gripBdr: d ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
      gripIcon: d ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)',
      logoFilter: d
        ? 'brightness(0) invert(1) drop-shadow(0 1px 8px rgba(0,0,0,0.4))'
        : 'drop-shadow(0 1px 8px rgba(0,0,0,0.15))',
    }),
    [d],
  )
}

// ── Icon resolution ──

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>
function getIcon(name: string): LucideIcons.LucideIcon {
  return iconMap[name] ?? LucideIcons.Box
}

// ── Module data ──

const SKIP = new Set(['home', 'settings', 'integration'])
const ALL_MODULES = MODULE_REGISTRY.filter((m) => m.level === 2 && !SKIP.has(m.module))
const MODULE_MAP = new Map(ALL_MODULES.map((m) => [m.code, m]))

const DEFAULT_CODES = [
  '1.1.1',
  '1.1.2',
  '1.2.1',
  '1.3.1',
  '1.3.5',
  '2.1.1',
  '2.1.2',
  '2.1.6',
  '2.3.2',
  '3.1.6',
  '3.1.7',
  '3.1.5',
  '5.1.1',
  '4.2.2',
  '4.2.3',
]

const STORAGE_KEY = 'skyhub.dashboard.shortcuts'

function loadShortcuts(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CODES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      const valid = parsed.filter((c) => MODULE_MAP.has(c))
      if (valid.length > 0) return valid
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CODES
}

function saveShortcuts(codes: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(codes))
}

// ── Page ──

export default function HomePage() {
  const router = useRouter()
  const { theme, toggle: toggleTheme } = useTheme()
  const g = useGlass()
  const { user } = useUser()
  const { logout } = useAuth()
  const initials = user ? `${user.profile.firstName[0]}${user.profile.lastName[0]}` : ''
  const fullName = user ? `${user.profile.firstName} ${user.profile.lastName}` : ''
  const userRole = user?.role ?? ''
  const userEmail = user?.profile.email ?? ''
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const [codes, setCodes] = useState(loadShortcuts)
  const [search, setSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragNode = useRef<HTMLDivElement | null>(null)

  const allModules = codes.map((c) => MODULE_MAP.get(c)).filter(Boolean) as ModuleEntry[]
  const modules = search.trim()
    ? allModules.filter((m) => {
        const q = search.trim().toLowerCase()
        return m.name.toLowerCase().includes(q) || m.code.includes(q) || m.description.toLowerCase().includes(q)
      })
    : allModules

  const update = useCallback((next: string[]) => {
    setCodes(next)
    saveShortcuts(next)
  }, [])
  const remove = useCallback(
    (code: string) => {
      update(codes.filter((c) => c !== code))
    },
    [codes, update],
  )
  const add = useCallback(
    (code: string) => {
      if (!codes.includes(code)) update([...codes, code])
      setPickerOpen(false)
      setPickerSearch('')
    },
    [codes, update],
  )

  // ── Drag & drop ──
  const handleDragStart = useCallback((idx: number, e: React.DragEvent) => {
    setDragIdx(idx)
    dragNode.current = e.currentTarget as HTMLDivElement
    e.dataTransfer.effectAllowed = 'move'
    if (dragNode.current)
      setTimeout(() => {
        if (dragNode.current) dragNode.current.style.opacity = '0.4'
      }, 0)
  }, [])
  const handleDragEnd = useCallback(() => {
    if (dragNode.current) dragNode.current.style.opacity = '1'
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const next = [...codes]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(dragOverIdx, 0, moved)
      update(next)
    }
    setDragIdx(null)
    setDragOverIdx(null)
    dragNode.current = null
  }, [dragIdx, dragOverIdx, codes, update])
  const handleDragOver = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIdx(idx)
  }, [])

  const codesSet = new Set(codes)
  const available = ALL_MODULES.filter((m) => !codesSet.has(m.code))
  const filteredAvailable = pickerSearch.trim()
    ? available.filter((m) => {
        const q = pickerSearch.trim().toLowerCase()
        return m.name.toLowerCase().includes(q) || m.code.includes(q)
      })
    : available

  const pickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
        setPickerSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const backdrop = {
    backdropFilter: 'blur(40px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
  } as const

  return (
    <div className="relative min-h-full">
      <WallpaperBg blur={g.isDark ? 6 : 16} lightOverlay={!g.isDark} />

      <div className="relative z-10 px-5 pt-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <img src="/skyhub-logo.png" alt="SkyHub" style={{ height: 55, filter: g.logoFilter }} />
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-3 rounded-xl px-2 py-1 transition-opacity hover:opacity-90 active:opacity-80 focus:outline-none"
            >
              <div className="text-right">
                <div className="text-[16px] font-bold leading-tight uppercase tracking-wide" style={{ color: g.text }}>
                  {fullName}
                </div>
                <div className="text-[13px] leading-tight capitalize" style={{ color: g.textSec }}>
                  {userRole}
                </div>
              </div>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#1e40af' }}
              >
                <span className="text-[15px] font-bold text-white">{initials}</span>
              </div>
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl overflow-hidden"
                style={{
                  background: g.menuBg,
                  ...backdrop,
                  border: `1px solid ${g.menuBdr}`,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${g.menuSep}` }}>
                  <div className="text-[14px] font-semibold" style={{ color: g.text }}>
                    {fullName}
                  </div>
                  {userEmail && (
                    <div className="text-[13px] mt-0.5 truncate" style={{ color: g.textMuted }}>
                      {userEmail}
                    </div>
                  )}
                </div>
                {/* Theme toggle */}
                <MenuItem
                  icon={theme === 'dark' ? LucideIcons.Sun : LucideIcons.Moon}
                  label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  color={g.menuText}
                  hoverBg={g.menuHover}
                  onClick={toggleTheme}
                />
                <MenuItem
                  icon={LucideIcons.UserCircle}
                  label="Open User Profile"
                  color={g.menuText}
                  hoverBg={g.menuHover}
                  onClick={() => {
                    setUserMenuOpen(false)
                    router.push('/settings/account/profile')
                  }}
                />
                <MenuItem
                  icon={LucideIcons.Lock}
                  label="Change Password"
                  color={g.menuText}
                  hoverBg={g.menuHover}
                  onClick={() => {
                    setUserMenuOpen(false)
                    router.push('/settings/account/security')
                  }}
                />
                <div style={{ borderTop: `1px solid ${g.menuSep}` }}>
                  <MenuItem
                    icon={LucideIcons.LogOut}
                    label="Log out"
                    color="#dc2626"
                    hoverBg="rgba(220,38,38,0.12)"
                    onClick={() => {
                      setUserMenuOpen(false)
                      logout()
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div
            className="flex items-center gap-3 rounded-xl px-4"
            style={{ height: 48, background: g.input, border: `1px solid ${g.inputBdr}`, ...backdrop }}
          >
            <LucideIcons.Search size={18} style={{ color: g.textMuted }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search module or type code (e.g. Gantt or 2.1.2)..."
              className="flex-1 bg-transparent outline-none text-[14px]"
              style={{ color: g.text }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ color: g.textMuted }}>
                <LucideIcons.X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Shortcuts grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {modules.map((entry, idx) => {
            const color = DOMAIN_COLORS[entry.module] ?? '#64748b'
            const Icon = getIcon(entry.icon)
            const isDragOver = dragOverIdx === idx && dragIdx !== idx
            return (
              <div
                key={entry.code}
                draggable
                onDragStart={(e) => handleDragStart(idx, e)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(idx, e)}
                className="group relative"
                style={{
                  borderLeft: isDragOver ? '3px solid rgba(91,141,239,0.6)' : '3px solid transparent',
                  transition: 'border-color 150ms ease',
                }}
              >
                <Link href={entry.route || '#'} className="no-underline block">
                  <div
                    className="relative flex flex-col items-center justify-center gap-3 rounded-[14px] p-5 overflow-hidden transition-all duration-200"
                    style={{ background: g.card, ...backdrop, border: `1px solid ${g.border}`, minHeight: 140 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = g.cardHover
                      e.currentTarget.style.borderColor = g.borderHov
                      e.currentTarget.style.boxShadow = `0 8px 32px ${color}18`
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = g.card
                      e.currentTarget.style.borderColor = g.border
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    }}
                  >
                    <span
                      className="absolute select-none pointer-events-none font-mono"
                      style={{
                        right: 8,
                        bottom: 4,
                        fontSize: 38,
                        lineHeight: 1,
                        color: g.textFaint,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {entry.code}
                    </span>
                    <div
                      className="flex items-center justify-center rounded-xl"
                      style={{ width: 48, height: 48, background: `${color}20` }}
                    >
                      <Icon size={24} strokeWidth={1.8} style={{ color }} />
                    </div>
                    <div className="text-[14px] font-semibold leading-tight text-center" style={{ color: g.text }}>
                      {entry.name}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    remove(entry.code)
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center rounded-lg"
                  style={{
                    width: 28,
                    height: 28,
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    cursor: 'pointer',
                    zIndex: 5,
                  }}
                >
                  <LucideIcons.X size={14} style={{ color: '#ef4444' }} />
                </button>
                <div
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center rounded-lg cursor-grab active:cursor-grabbing"
                  style={{ width: 28, height: 28, background: g.gripBg, border: `1px solid ${g.gripBdr}`, zIndex: 5 }}
                >
                  <LucideIcons.GripVertical size={14} style={{ color: g.gripIcon }} />
                </div>
              </div>
            )
          })}

          {/* Add shortcut */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen((o) => !o)}
              className="flex flex-col items-center justify-center gap-2 rounded-[14px] w-full transition-all duration-200"
              style={{
                border: `1px dashed ${g.addBdr}`,
                background: pickerOpen ? g.addBgHov : g.addBg,
                cursor: 'pointer',
                minHeight: 140,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = g.addBdrHov
                e.currentTarget.style.background = g.addBgHov
              }}
              onMouseLeave={(e) => {
                if (!pickerOpen) {
                  e.currentTarget.style.borderColor = g.addBdr
                  e.currentTarget.style.background = g.addBg
                }
              }}
            >
              <LucideIcons.Plus size={24} style={{ color: g.textMuted }} />
              <span className="text-[13px] font-medium" style={{ color: g.textMuted }}>
                Add shortcut
              </span>
            </button>

            {pickerOpen && (
              <div
                className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden"
                style={{
                  width: 320,
                  maxHeight: 400,
                  background: g.menuBg,
                  ...backdrop,
                  border: `1px solid ${g.menuBdr}`,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                  zIndex: 50,
                }}
              >
                <div className="p-3" style={{ borderBottom: `1px solid ${g.menuSep}` }}>
                  <div className="flex items-center gap-2 px-3 rounded-lg" style={{ height: 36, background: g.input }}>
                    <LucideIcons.Search size={14} style={{ color: g.textMuted }} />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Search modules..."
                      autoFocus
                      className="flex-1 bg-transparent outline-none text-[13px]"
                      style={{ color: g.text }}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
                  {filteredAvailable.length === 0 && (
                    <div className="px-4 py-6 text-center text-[13px]" style={{ color: g.textMuted }}>
                      {available.length === 0 ? 'All modules added' : 'No match'}
                    </div>
                  )}
                  {filteredAvailable.map((m) => {
                    const color = DOMAIN_COLORS[m.module] ?? '#64748b'
                    const Icon = getIcon(m.icon)
                    return (
                      <button
                        key={m.code}
                        onClick={() => add(m.code)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = g.menuHover
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div
                          className="flex items-center justify-center rounded-lg shrink-0"
                          style={{ width: 32, height: 32, background: `${color}18` }}
                        >
                          <Icon size={16} strokeWidth={1.8} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold truncate" style={{ color: g.text }}>
                            {m.name}
                          </div>
                          <div className="text-[11px] font-mono" style={{ color: g.textMuted }}>
                            {m.code}
                          </div>
                        </div>
                        <LucideIcons.Plus size={14} style={{ color: g.textMuted }} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Menu item helper ──

function MenuItem({
  icon: Icon,
  label,
  color,
  hoverBg,
  onClick,
}: {
  icon: LucideIcons.LucideIcon
  label: string
  color: string
  hoverBg: string
  onClick: () => void
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
      style={{ color }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={16} strokeWidth={1.8} />
      <span className="text-[14px] font-medium">{label}</span>
    </button>
  )
}
