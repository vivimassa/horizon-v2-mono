'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from './theme-provider'
import { useUser } from './user-provider'
import { colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { BreadcrumbNav } from './navigation/breadcrumb-nav'
import { api, setApiBaseUrl } from '@skyhub/api'

setApiBaseUrl('http://localhost:3002')

export function Breadcrumb() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const accent = '#1e40af'
  const { user } = useUser()
  const initials = user ? `${user.profile.firstName[0]}${user.profile.lastName[0]}` : ''
  const fullName = user ? `${user.profile.firstName} ${user.profile.lastName}` : ''
  const userRole = user?.role ?? ''

  const [operatorLogo, setOperatorLogo] = useState<string | null>(null)

  const fetchLogo = useCallback(() => {
    api
      .getOperators()
      .then((ops) => {
        if (ops.length > 0 && ops[0].logoUrl) {
          const url = ops[0].logoUrl
          setOperatorLogo(url.startsWith('/uploads/') ? `http://localhost:3002${url}` : url)
        } else {
          setOperatorLogo(null)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchLogo()
  }, [fetchLogo])

  // Listen for logo changes from Operator Config
  useEffect(() => {
    const handler = () => fetchLogo()
    window.addEventListener('operator-logo-changed', handler)
    return () => window.removeEventListener('operator-logo-changed', handler)
  }, [fetchLogo])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="relative z-10 px-5 pt-1 pb-0 select-none">
      {/* Top row: logo left, avatar right */}
      <div className="flex items-center justify-between mb-1">
        <img
          src={operatorLogo ?? '/skyhub-logo.png'}
          alt="Sky Hub"
          className="h-[55px] w-auto object-contain select-none"
          draggable={false}
          style={{
            filter: !operatorLogo && isDark ? 'brightness(0) invert(1)' : 'none',
          }}
        />
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div
              className="text-[16px] font-bold leading-tight uppercase tracking-wide"
              style={{ color: palette.text }}
            >
              {fullName}
            </div>
            <div
              className="text-[13px] leading-tight"
              style={{ color: palette.textSecondary, textTransform: 'capitalize' }}
            >
              {userRole}
            </div>
          </div>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: accent }}
          >
            <span className="text-[15px] font-bold text-white">{initials}</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb bar — desktop/tablet only */}
      <div className="hidden md:flex items-center justify-between">
        <div
          className="py-1.5 px-1.5 rounded-2xl"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(12px) saturate(150%)',
            WebkitBackdropFilter: 'blur(12px) saturate(150%)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <BreadcrumbNav />
        </div>
        <span className="text-[11px] pr-2 shrink-0" style={{ color: palette.textTertiary }}>
          {today}
        </span>
      </div>
    </div>
  )
}
