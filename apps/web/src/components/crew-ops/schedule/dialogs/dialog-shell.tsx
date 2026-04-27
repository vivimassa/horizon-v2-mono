'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface Props {
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  /** Max-width of the modal card in px. Default 480 (SwapOverlay convention). */
  width?: number
  /** Hide the body scroll area — some dialogs (picker) manage their own. */
  bodyPadding?: boolean
  /** Optional hero SVG illustration. When set, replaces the plain 48 px
   *  title bar with a fixed-height hero band that mirrors the GCS
   *  positioning drawer treatment (grid pattern + radial glow + SVG
   *  anchored bottom-right). All hero-enabled dialogs render at the
   *  same `HERO_HEIGHT` so the visual rhythm stays consistent across
   *  the module. */
  heroSvg?: ReactNode
  /** Small accent-coloured eyebrow above the title (Hero mode only). */
  heroEyebrow?: string
  /** Subtitle line below the title (Hero mode only). */
  heroSubtitle?: string
}

/** Single source of truth for hero band height — change here and every
 *  dialog updates in lockstep. */
export const DIALOG_HERO_HEIGHT = 104

/** Reusable hero header band — used internally by `DialogShell` and by
 *  custom-shell dialogs (override / blocked / legality) that don't go
 *  through `DialogShell`. Same look across the module. */
export function DialogHeroBand({
  title,
  eyebrow,
  subtitle,
  svg,
  onClose,
  isDark,
}: {
  title: string
  eyebrow?: string
  subtitle?: string
  svg: ReactNode
  onClose: () => void
  isDark: boolean
}) {
  return (
    <div
      className="relative overflow-hidden shrink-0"
      style={{
        height: DIALOG_HERO_HEIGHT,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.10) 100%)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.10]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(var(--module-accent) 1px, transparent 1px), linear-gradient(90deg, var(--module-accent) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at right, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at right, black 0%, transparent 75%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          right: -40,
          bottom: -40,
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, var(--module-accent) 0%, transparent 65%)',
          opacity: 0.18,
          filter: 'blur(20px)',
        }}
      />
      <div className="absolute right-6 bottom-3 pointer-events-none">{svg}</div>
      <div className="relative z-10 flex items-start justify-between px-5 pt-4">
        <div className="flex items-start gap-3">
          <div className="w-1 h-7 rounded-full mt-0.5" style={{ background: 'var(--module-accent)' }} />
          <div>
            {eyebrow && (
              <div
                className="text-[11px] font-bold tracking-[0.12em] uppercase mb-0.5"
                style={{ color: 'var(--module-accent)' }}
              >
                {eyebrow}
              </div>
            )}
            <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
            {subtitle && (
              <p
                className="text-[12px] mt-0.5"
                style={{ color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(71,85,105,0.80)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="relative z-10 w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Shared dialog shell used by the Phase 2 activity/assignment dialogs.
 *
 *   • Fixed dark backdrop at 50% opacity — click outside closes.
 *   • Esc closes.
 *   • Centered card, theme-aware background + border.
 *   • Title bar with close X; footer slot for action buttons.
 *
 * Matches the SwapOverlay / CapacityErrorDialog patterns so the three
 * new dialogs feel consistent with what's already in the module.
 */
export function DialogShell({
  title,
  onClose,
  footer,
  children,
  width = 480,
  bodyPadding = true,
  heroSvg,
  heroEyebrow,
  heroSubtitle,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          width,
          maxWidth: '92vw',
          background: isDark ? 'rgba(25,25,33,0.98)' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(96,97,112,0.18)',
          color: isDark ? '#FFFFFF' : '#0E0E14',
        }}
      >
        {heroSvg ? (
          <DialogHeroBand
            title={title}
            eyebrow={heroEyebrow}
            subtitle={heroSubtitle}
            svg={heroSvg}
            onClose={onClose}
            isDark={isDark}
          />
        ) : (
          <div
            className="flex items-center justify-between px-5 h-12 shrink-0"
            style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
          >
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-y-auto ${bodyPadding ? 'px-5 py-4' : ''}`}>{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
            style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Secondary (outline) button styled for dialog footers. */
export function DialogCancelButton({
  onClick,
  disabled,
  label = 'Cancel',
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-9 px-4 rounded-lg text-[13px] font-medium hover:bg-white/10 disabled:opacity-50"
    >
      {label}
    </button>
  )
}

/** Primary (accent) button styled for dialog footers. */
export function DialogPrimaryButton({
  onClick,
  disabled,
  loading,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
      style={{ backgroundColor: 'var(--module-accent)' }}
    >
      {loading ? 'Working…' : label}
    </button>
  )
}
