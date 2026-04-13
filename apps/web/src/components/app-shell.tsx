'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from './auth-provider'
import { AnimatedBodyBg } from './AnimatedBodyBg'
import { Breadcrumb } from './Breadcrumb'
import { SpotlightDock } from './SpotlightDock'

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
      {!isHome && <Breadcrumb />}
      <main className={`flex-1 overflow-y-auto ${isHome ? '' : 'pb-22 -mt-1'}`}>{children}</main>
      {!isHome && <SpotlightDock />}
    </>
  )
}
