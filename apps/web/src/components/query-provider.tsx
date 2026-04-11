'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/**
 * Web-local QueryProvider.
 *
 * We deliberately do NOT import the shared QueryProvider from @skyhub/ui
 * on the web. The ui package's main barrel re-exports PageShell, which
 * pulls in AnimatedBackground → react-native-reanimated → react-native,
 * and Next.js's bundler chokes on React Native's Flow-typed source. The
 * web already uses the @skyhub/ui/theme subpath export to access tokens
 * without triggering the full barrel.
 *
 * The QueryClient configuration below is kept in sync with
 * packages/ui/src/providers/QueryProvider.tsx so mobile + web behave the
 * same. If you change defaults there, mirror them here.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            refetchOnWindowFocus: false,
            gcTime: 10 * 60 * 1000,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
