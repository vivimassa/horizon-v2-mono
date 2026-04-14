'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { resolveModule, MODULE_THEMES } from '@skyhub/constants'
import { darkAccent } from '@skyhub/ui/theme'

type Theme = 'light' | 'dark'
type ModuleKey = 'network' | 'operations' | 'ground' | 'workforce' | 'integration' | 'admin' | null

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  moduleKey: ModuleKey
  moduleTheme: { accent: string; bg: string; bgSubtle: string } | null
}

const ThemeCtx = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
  moduleKey: null,
  moduleTheme: null,
})

export function useTheme() {
  return useContext(ThemeCtx)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const pathname = usePathname()

  // Resolve current module
  const currentModule = resolveModule(pathname)
  const moduleKey = (currentModule?.module ?? null) as ModuleKey
  const moduleTheme = moduleKey ? (MODULE_THEMES[moduleKey] ?? null) : null

  // Resolve accent for dark mode — same hue, 80% saturation, 70% lightness
  function resolveAccent(hex: string, isDark: boolean): string {
    if (!isDark) return hex
    return darkAccent(hex)
  }

  // Apply module theme CSS custom properties
  useEffect(() => {
    const root = document.documentElement
    const isDark = theme === 'dark'
    if (moduleTheme) {
      const accent = resolveAccent(moduleTheme.accent, isDark)
      root.style.setProperty('--module-accent', accent)
      root.style.setProperty('--module-bg', isDark ? hexToRgba(accent, 0.12) : moduleTheme.bg)
      root.style.setProperty('--module-bg-subtle', isDark ? hexToRgba(accent, 0.06) : moduleTheme.bgSubtle)
    } else {
      const accent = resolveAccent('#1e40af', isDark)
      root.style.setProperty('--module-accent', accent)
      root.style.setProperty('--module-bg', isDark ? hexToRgba(accent, 0.12) : '#dbeafe')
      root.style.setProperty('--module-bg-subtle', isDark ? hexToRgba(accent, 0.06) : '#eff6ff')
    }
  }, [moduleKey, moduleTheme, theme])

  // Init theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('hz-theme') as Theme | null
    if (stored) {
      setTheme(stored)
      document.documentElement.classList.toggle('dark', stored === 'dark')
    }
  }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    const apply = () => {
      setTheme(next)
      localStorage.setItem('hz-theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
    }

    // Browsers with the View Transitions API (Chromium, Safari 18+) get a
    // native cross-fade of the entire page. Others fall back to an instant swap.
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> }
    }
    if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
      const t = doc.startViewTransition(apply)
      // Swallow AbortError/TimeoutError from slow hardware — the theme
      // still switches, we just skip the animation on that turn.
      t.finished.catch(() => {})
    } else {
      apply()
    }
  }

  return <ThemeCtx.Provider value={{ theme, toggle, moduleKey, moduleTheme }}>{children}</ThemeCtx.Provider>
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
