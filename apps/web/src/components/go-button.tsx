'use client'

import { forwardRef } from 'react'
import { ArrowRight, Loader2, type LucideIcon } from 'lucide-react'
import { useTheme } from './theme-provider'
import { collapseDock } from '@/lib/dock-store'

interface GoButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Button label (defaults to "Go"). */
  label?: string
  /** Icon shown on the right (defaults to ArrowRight). Pass null to hide. */
  icon?: LucideIcon | null
  /** Show a spinner instead of the icon and disable the button. */
  loading?: boolean
  /** Custom accent color. Defaults to SkyHub module accent. */
  accent?: string
  /** Size preset. */
  size?: 'md' | 'lg'
  /** Full-width (for card footers). */
  fullWidth?: boolean
  children?: React.ReactNode
}

/**
 * Primary page-level CTA. When clicked, automatically collapses the bottom
 * dock so the workspace gets full vertical space — then fires the caller's
 * onClick. Drop this on any page that takes the user into a focus view
 * (e.g. "Go" to load a schedule, "Run" to execute a solver).
 *
 * Standard SkyHub primary-button styling: accent background, white text,
 * 40/48px height, 8px radius. Uses the theme palette for disabled + hover.
 */
export const GoButton = forwardRef<HTMLButtonElement, GoButtonProps>(function GoButton(
  {
    label = 'Go',
    icon: Icon = ArrowRight,
    loading = false,
    accent,
    size = 'md',
    fullWidth = false,
    disabled,
    onClick,
    children,
    className = '',
    style,
    ...rest
  },
  ref,
) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const resolvedAccent = accent ?? '#1e40af'
  const isDisabled = disabled || loading

  const height = size === 'lg' ? 48 : 40
  const textSize = size === 'lg' ? 15 : 14
  const iconSize = size === 'lg' ? 18 : 16

  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      onClick={(e) => {
        if (isDisabled) return
        // Collapse the bottom dock so the page can use full vertical space.
        collapseDock()
        onClick?.(e)
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 active:scale-[0.98] focus:outline-none ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      style={{
        height,
        minWidth: fullWidth ? undefined : size === 'lg' ? 128 : 96,
        paddingInline: 18,
        fontSize: textSize,
        background: isDisabled ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)') : resolvedAccent,
        color: isDisabled ? (isDark ? 'rgba(255,255,255,0.40)' : 'rgba(15,23,42,0.35)') : '#fff',
        boxShadow: isDisabled ? 'none' : `0 4px 14px ${resolvedAccent}55`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return
        e.currentTarget.style.filter = 'brightness(1.08)'
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return
        e.currentTarget.style.filter = ''
      }}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} strokeWidth={2.2} className="animate-spin" />
      ) : (
        <>
          <span>{children ?? label}</span>
          {Icon && <Icon size={iconSize} strokeWidth={2.2} />}
        </>
      )}
    </button>
  )
})
