'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './auth-provider'
import { AnimatedBodyBg } from './AnimatedBodyBg'
import { SpotlightDock } from './SpotlightDock'
import { TopProgressBar } from './top-progress-bar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()
  const isHome = pathname === '/'

  if (!isAuthenticated) {
    return (
      <>
        <AnimatedBodyBg />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </>
    )
  }

  return (
    <>
      <AnimatedBodyBg />
      <TopProgressBar />
      <main className={`flex-1 overflow-y-auto ${isHome ? '' : 'pt-3'}`}>{children}</main>
      {!isHome && <SpotlightDock />}
    </>
  )
}
