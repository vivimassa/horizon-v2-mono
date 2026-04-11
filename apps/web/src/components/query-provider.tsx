'use client'

import { QueryProvider as SharedQueryProvider } from '@skyhub/ui'
import type { ReactNode } from 'react'

/**
 * Thin client-component wrapper around @skyhub/ui's QueryProvider.
 *
 * @skyhub/ui's QueryProvider uses React hooks (useState, QueryClientProvider
 * context), so it can't be rendered from a Next.js Server Component. This
 * wrapper carries the 'use client' directive so the RootLayout (server
 * component) can wrap its children with React Query cleanly.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return <SharedQueryProvider>{children}</SharedQueryProvider>
}
