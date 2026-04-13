import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/lib/env' // validates env + sets API base URL (side-effect import, must be first)
import './globals.css'
import './mapbox-fix.css'
import { AppShell } from '@/components/app-shell'
import { ThemeProvider } from '@/components/theme-provider'
import { DisplayProvider } from '@/components/display-provider'
import { UserProvider } from '@/components/user-provider'
import { AuthProvider } from '@/components/auth-provider'
import { QueryProvider } from '@/components/query-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sky Hub',
  description: 'Airline Operations Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.className} dark`} suppressHydrationWarning>
      <body className="flex flex-col h-screen bg-hz-bg text-hz-text">
        <QueryProvider>
          <ThemeProvider>
            <DisplayProvider>
              <AuthProvider>
                <UserProvider>
                  <AppShell>{children}</AppShell>
                </UserProvider>
              </AuthProvider>
            </DisplayProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
