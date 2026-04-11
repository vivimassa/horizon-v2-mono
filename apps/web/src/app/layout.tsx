import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/lib/env' // validates env + sets API base URL (side-effect import, must be first)
import './globals.css'
import './mapbox-fix.css'
import { SpotlightDock } from '@/components/SpotlightDock'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ThemeProvider } from '@/components/theme-provider'
import { DisplayProvider } from '@/components/display-provider'
import { UserProvider } from '@/components/user-provider'
import { AuthProvider } from '@/components/auth-provider'
import { AnimatedBodyBg } from '@/components/AnimatedBodyBg'

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
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col h-screen bg-hz-bg text-hz-text">
        <ThemeProvider>
          <DisplayProvider>
            <AuthProvider>
              <UserProvider>
                <AnimatedBodyBg />
                <Breadcrumb />
                <main className="flex-1 overflow-y-auto pb-22 -mt-1">{children}</main>
                <SpotlightDock />
              </UserProvider>
            </AuthProvider>
          </DisplayProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
