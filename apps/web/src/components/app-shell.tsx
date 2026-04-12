'use client'

import { useAuth } from './auth-provider'
import { AnimatedBodyBg } from './AnimatedBodyBg'
import { Breadcrumb } from './Breadcrumb'
import { SpotlightDock } from './SpotlightDock'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()

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
      <Breadcrumb />
      <main className="flex-1 overflow-y-auto pb-22 -mt-1">{children}</main>
      <SpotlightDock />
    </>
  )
}
