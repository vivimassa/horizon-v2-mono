'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, UserCircle, type LucideIcon } from 'lucide-react'
import { colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { useAuth } from './auth-provider'
import { useTheme } from './theme-provider'
import { useUser } from './user-provider'
import { AnimatedThemeIcon } from './ui/animated-theme-icon'

type Tone = 'palette' | 'overlay'

interface UserMenuProps {
  tone?: Tone
  align?: 'left' | 'right'
}

/**
 * Global user menu: avatar trigger + dropdown with Dark/Light toggle, Profile, Logout.
 * Use tone="overlay" when placed over imagery (e.g. home hero); tone="palette" (default)
 * uses theme palette colors for standard topbar placement.
 */
export function UserMenu({ tone = 'palette', align = 'right' }: UserMenuProps) {
  const router = useRouter()
  const { theme, toggle: toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const accent = '#1e40af'
  const { user } = useUser()
  const { logout } = useAuth()

  const initials = user ? `${user.profile.firstName[0]}${user.profile.lastName[0]}` : ''
  const fullName = user ? `${user.profile.firstName} ${user.profile.lastName}` : ''
  const userEmail = user?.profile.email ?? ''
  const userRole = user?.role ?? ''

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const overlay = tone === 'overlay'
  const triggerName = overlay ? 'text-white/90' : ''
  const triggerRole = overlay ? 'text-white/55' : ''
  const dropdownBg = overlay ? (isDark ? 'rgba(15,15,25,.92)' : 'rgba(255,255,255,.92)') : palette.card
  const dropdownBorder = overlay ? (isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.10)') : palette.border
  const dividerBorder = overlay ? (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)') : palette.border
  const headerNameColor = overlay ? (isDark ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.7)') : palette.text
  const headerEmailColor = overlay ? 'rgba(128,128,128,.7)' : palette.textSecondary
  const dropdownShadow = overlay
    ? '0 12px 32px rgba(0,0,0,.4)'
    : isDark
      ? '0 12px 32px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)'
      : '0 12px 32px rgba(96,97,112,0.18), 0 4px 12px rgba(96,97,112,0.1)'
  const backdrop = overlay
    ? { backdropFilter: 'blur(48px) saturate(1.5)', WebkitBackdropFilter: 'blur(48px) saturate(1.5)' }
    : {}

  /* ── Trigger chip styling ──
     Group the name/role/avatar/chevron in a single glass pill so the user
     menu reads as a deliberate control rather than loose text floating on
     the wallpaper. Hover lifts the glass, active compresses it. */
  const triggerBg = overlay ? 'rgba(255,255,255,0.08)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.65)'
  const triggerBgHover = overlay
    ? 'rgba(255,255,255,0.14)'
    : isDark
      ? 'rgba(255,255,255,0.09)'
      : 'rgba(255,255,255,0.85)'
  const triggerBorder = overlay ? 'rgba(255,255,255,0.14)' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const triggerShadow = overlay ? '0 4px 14px rgba(0,0,0,0.25)' : isDark ? 'none' : '0 2px 10px rgba(96,97,112,0.08)'
  const chevronColor = overlay ? 'rgba(255,255,255,0.60)' : isDark ? 'rgba(255,255,255,0.50)' : palette.textSecondary
  const avatarRing = overlay
    ? '0 0 0 2px rgba(255,255,255,0.20), 0 2px 8px rgba(0,0,0,0.35)'
    : isDark
      ? '0 0 0 2px rgba(255,255,255,0.10), 0 2px 8px rgba(0,0,0,0.28)'
      : '0 0 0 2px rgba(255,255,255,0.9), 0 2px 8px rgba(96,97,112,0.18)'
  /* Neutral avatar fill — same glass family as the pill, no accent tint. */
  const avatarBg = overlay ? 'rgba(255,255,255,0.18)' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'
  const avatarInitialsColor = overlay || isDark ? 'rgba(255,255,255,0.95)' : palette.text

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3.5 rounded-full pl-5 pr-2 py-1.5 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus:outline-none"
        style={{
          background: triggerBg,
          border: `1px solid ${triggerBorder}`,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          boxShadow: triggerShadow,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = triggerBgHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = triggerBg
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="text-right">
          <div
            className={`text-[13px] font-semibold leading-tight tracking-wide ${triggerName}`}
            style={overlay ? undefined : { color: palette.text }}
          >
            {fullName}
          </div>
          <div
            className={`text-[11px] leading-tight capitalize mt-0.5 ${triggerRole}`}
            style={overlay ? undefined : { color: palette.textSecondary }}
          >
            {userRole}
          </div>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center relative"
          style={{
            background: avatarBg,
            boxShadow: avatarRing,
          }}
        >
          <span className="text-[13px] font-bold" style={{ color: avatarInitialsColor }}>
            {initials}
          </span>
          {/* Online status dot */}
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{
              background: '#06C270',
              boxShadow: `0 0 0 2px ${overlay ? 'rgba(15,15,25,0.85)' : isDark ? '#191921' : '#FFFFFF'}`,
            }}
          />
        </div>
        <ChevronDown
          size={14}
          strokeWidth={2}
          style={{
            color: chevronColor,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 180ms ease',
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-[calc(100%+8px)] z-50 w-64 rounded-xl overflow-hidden`}
          style={{
            background: dropdownBg,
            ...backdrop,
            border: `1px solid ${dropdownBorder}`,
            boxShadow: dropdownShadow,
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${dividerBorder}` }}>
            <div className="text-[14px] font-semibold leading-tight" style={{ color: headerNameColor }}>
              {fullName}
            </div>
            {userEmail && (
              <div className="text-[13px] leading-tight mt-0.5 truncate" style={{ color: headerEmailColor }}>
                {userEmail}
              </div>
            )}
          </div>
          <MenuItem
            renderIcon={() => <AnimatedThemeIcon isDark={isDark} size={16} strokeWidth={1.8} />}
            label={isDark ? 'Light' : 'Dark'}
            onClick={toggleTheme}
          />
          <MenuItem
            icon={UserCircle}
            label="Profile"
            onClick={() => {
              setOpen(false)
              router.push('/settings/account/profile')
            }}
          />
          <div style={{ borderTop: `1px solid ${dividerBorder}` }}>
            <MenuItem
              icon={LogOut}
              label="Log out"
              color="#dc2626"
              onClick={() => {
                setOpen(false)
                logout()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  renderIcon,
  label,
  color,
  onClick,
}: {
  icon?: LucideIcon
  renderIcon?: () => React.ReactNode
  label: string
  color?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none"
      style={{ color: color ?? 'inherit' }}
    >
      {renderIcon ? renderIcon() : Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
      <span className="text-[14px] font-medium">{label}</span>
    </button>
  )
}
