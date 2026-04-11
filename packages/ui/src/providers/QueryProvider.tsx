import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/**
 * Shared React Query provider for the Sky Hub mobile + web apps.
 *
 * Defaults:
 * - retry: 2
 * - refetchOnWindowFocus: false (noisy on mobile)
 * - gcTime: 10 min (garbage collection)
 * - mutations: no automatic retry (fail fast, show error)
 *
 * The QueryClient is created inside useState so the same instance survives
 * React StrictMode double-render in dev without sharing across
 * unrelated tree mounts.
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
