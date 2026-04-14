'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './auth-provider'

const STORAGE_PREFIX = 'skyhub.lastWelcomeShownMs.'
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const VISIBLE_MS = 4000
const FADE_MS = 600

type Phase = 'hidden' | 'visible' | 'fading'

export function WelcomeOverlay() {
  const { user, isAuthenticated } = useAuth()
  const [phase, setPhase] = useState<Phase>('hidden')
  const [greeting, setGreeting] = useState<string>('')

  useEffect(() => {
    if (!isAuthenticated || !user?._id) return
    if (phase !== 'hidden') return

    const key = `${STORAGE_PREFIX}${user._id}`
    let lastShown = 0
    try {
      const raw = window.localStorage.getItem(key)
      lastShown = raw ? Number.parseInt(raw, 10) : 0
    } catch {}

    const now = Date.now()
    if (now - lastShown < ONE_DAY_MS) return

    const firstName = user.profile?.firstName?.trim()
    const isReturning = lastShown > 0
    setGreeting(
      firstName
        ? `${isReturning ? 'Welcome back' : 'Welcome'}, ${firstName}`
        : isReturning
          ? 'Welcome back'
          : 'Welcome',
    )
    setPhase('visible')

    try {
      window.localStorage.setItem(key, String(now))
    } catch {}

    const fadeTimer = window.setTimeout(() => setPhase('fading'), VISIBLE_MS)
    const hideTimer = window.setTimeout(() => setPhase('hidden'), VISIBLE_MS + FADE_MS)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
    }
  }, [isAuthenticated, user?._id, user?.profile?.firstName, phase])

  if (phase === 'hidden') return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0E0E14]"
      style={{
        opacity: phase === 'fading' ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: phase === 'fading' ? 'none' : 'auto',
      }}
    >
      <h1 className="text-4xl font-semibold text-white sm:text-5xl md:text-6xl">{greeting}</h1>
    </div>
  )
}
