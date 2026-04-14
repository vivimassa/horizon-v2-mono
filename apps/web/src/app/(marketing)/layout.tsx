'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { MarketingHeader } from '@/components/marketing/marketing-header'
import { MarketingFooter } from '@/components/marketing/marketing-footer'
import { useAuth } from '@/components/auth-provider'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    // Authenticated users hitting the public landing go straight to /hub.
    // Deeper marketing pages remain browsable while logged in.
    if (isAuthenticated && pathname === '/') router.replace('/hub')
  }, [isAuthenticated, pathname, router])

  return (
    <div className="marketing">
      <MarketingHeader />
      <main className="pt-0">{children}</main>
      <MarketingFooter />
    </div>
  )
}
