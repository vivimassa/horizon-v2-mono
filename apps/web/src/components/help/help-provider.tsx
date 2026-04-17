'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { HelpPanel } from './help-panel'
import { resolveHelp } from './help-registry'

export interface HelpOpenInput {
  code?: string
  title?: string
  subtitle?: string
}

interface HelpState {
  open: boolean
  code?: string
  title?: string
  subtitle?: string
}

interface HelpContextValue extends HelpState {
  openHelp: (input?: HelpOpenInput) => void
  closeHelp: () => void
  toggleHelp: (input?: HelpOpenInput) => void
}

const HelpContext = createContext<HelpContextValue | null>(null)

export function HelpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HelpState>({ open: false })
  const pathname = usePathname()
  const lastPath = useRef(pathname)

  const openHelp = useCallback((input?: HelpOpenInput) => {
    setState({ open: true, ...input })
  }, [])

  const closeHelp = useCallback(() => {
    setState((s) => ({ ...s, open: false }))
  }, [])

  const toggleHelp = useCallback((input?: HelpOpenInput) => {
    setState((s) => (s.open ? { ...s, open: false } : { open: true, ...input }))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        setState((s) => ({ ...s, open: !s.open }))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      setState((s) => (s.open ? { open: false } : s))
    }
  }, [pathname])

  const value = useMemo<HelpContextValue>(
    () => ({ ...state, openHelp, closeHelp, toggleHelp }),
    [state, openHelp, closeHelp, toggleHelp],
  )

  const resolved = useMemo(() => {
    if (!state.open) return null
    return resolveHelp({ code: state.code, pathname })
  }, [state.open, state.code, pathname])

  const panelCode = state.code ?? resolved?.meta.code
  const panelTitle = state.title ?? resolved?.meta.title
  const panelSubtitle = state.subtitle ?? resolved?.meta.subtitle
  const Content = resolved?.Content

  return (
    <HelpContext.Provider value={value}>
      {children}
      <HelpPanel open={state.open} onClose={closeHelp} code={panelCode} title={panelTitle} subtitle={panelSubtitle}>
        {Content ? <Content /> : null}
      </HelpPanel>
    </HelpContext.Provider>
  )
}

export function useHelp() {
  const ctx = useContext(HelpContext)
  if (!ctx) {
    throw new Error('useHelp must be used inside <HelpProvider>')
  }
  return ctx
}
