'use client'

import { useRouter, usePathname } from 'next/navigation'
import * as LucideIcons from 'lucide-react'
import { MODULE_REGISTRY, MODULE_THEMES, resolveModule } from '@skyhub/constants'
import { useTheme } from './theme-provider'
import { revealNavigate } from '@/lib/nav-transition'

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>
function getIcon(name: string): LucideIcons.LucideIcon {
  return iconMap[name] ?? LucideIcons.Box
}

function getParent(code: string) {
  const m = MODULE_REGISTRY.find((x) => x.code === code)
  if (!m?.parent_code) return undefined
  return MODULE_REGISTRY.find((x) => x.code === m.parent_code)
}

/**
 * Shared placeholder rendered by module routes that don't have a real
 * implementation yet. Resolves the registry entry for the current
 * pathname so code / name / icon / accent match what the user just
 * clicked on Home. Better than a 404.
 */
export function ComingSoon() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const mod = resolveModule(pathname)
  const accent = mod ? (MODULE_THEMES[mod.module]?.accent ?? '#1e40af') : '#1e40af'
  const parent = mod ? getParent(mod.code) : undefined
  const Icon = mod ? getIcon(mod.icon) : LucideIcons.Construction

  const cardBg = isDark ? 'rgba(25,25,33,0.72)' : 'rgba(255,255,255,0.78)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(100,116,139,0.60)'

  function goHome() {
    // Radial "close" back to viewport center — no dock target anchor here.
    revealNavigate(router, '/', {
      origin: { x: window.innerWidth / 2, y: window.innerHeight - 40 },
      accent,
      direction: 'out',
    })
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div
        className="relative rounded-2xl overflow-hidden max-w-md w-full"
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          backdropFilter: 'blur(18px) saturate(150%)',
          WebkitBackdropFilter: 'blur(18px) saturate(150%)',
          boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.35)' : '0 12px 40px rgba(96,97,112,0.12)',
        }}
      >
        {/* Accent glow halo behind the icon */}
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            width: 260,
            height: 180,
            background: `radial-gradient(ellipse at center, ${accent}40 0%, transparent 65%)`,
            filter: 'blur(18px)',
          }}
        />

        <div className="relative px-8 pt-10 pb-8 flex flex-col items-center text-center gap-4">
          {/* Icon chip */}
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{
              width: 72,
              height: 72,
              background: accent,
              boxShadow: `0 8px 28px ${accent}60`,
            }}
          >
            <Icon size={32} strokeWidth={1.8} color="#fff" />
          </div>

          {/* Code + parent crumb */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: accent }}>
              {mod?.code ?? '—'}
            </span>
            {parent && (
              <>
                <span className="text-[11px]" style={{ color: textTertiary }}>
                  ·
                </span>
                <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: textTertiary }}>
                  {parent.name}
                </span>
              </>
            )}
          </div>

          {/* Name */}
          <h1 className="text-[22px] font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
            {mod?.name ?? 'Module'}
          </h1>

          {/* Description */}
          {mod?.description && (
            <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
              {mod.description}
            </p>
          )}

          {/* Status pill */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-2"
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}33`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="text-[12px] font-semibold tracking-wide" style={{ color: accent }}>
              In development
            </span>
          </div>

          {/* Back to Home */}
          <button
            type="button"
            onClick={goHome}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80 active:scale-[0.98]"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
              color: textPrimary,
            }}
          >
            <LucideIcons.ArrowLeft size={14} strokeWidth={2} />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
