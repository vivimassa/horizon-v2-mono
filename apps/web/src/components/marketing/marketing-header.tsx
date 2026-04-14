'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Sun, Moon, LogIn, ArrowRight } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

const NAV = [
  { label: 'Products', href: '/products' },
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export function MarketingHeader() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header
      className="relative z-20"
      style={{
        background: 'transparent',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}`,
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <img
            src="/skyhub-logo.png"
            alt="SkyHub"
            style={{
              height: 60,
              filter: isDark ? 'brightness(0) invert(1) drop-shadow(0 1px 8px rgba(0,0,0,0.3))' : 'brightness(0)',
              opacity: 0.95,
              transition: 'opacity 200ms',
            }}
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-3.5 py-2 rounded-lg text-[14px] font-medium transition-colors"
                style={{
                  color: active ? 'var(--mkt-text)' : 'var(--mkt-text-dim)',
                  background: active ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)') : 'transparent',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--mkt-text-dim)', background: 'transparent' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
          </button>
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-[13px] font-semibold transition-colors"
            style={{
              color: 'var(--mkt-text)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'}`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogIn size={14} strokeWidth={2.2} />
            Login
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, var(--mkt-accent) 0%, var(--mkt-accent-violet) 100%)',
              boxShadow: '0 8px 24px -8px rgba(62,123,250,0.6)',
            }}
          >
            Book a Demo
            <ArrowRight size={14} strokeWidth={2.4} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--mkt-text)' }}
            aria-label="Open menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden border-t"
          style={{
            background: isDark ? 'rgba(10,11,16,0.95)' : 'rgba(247,248,252,0.95)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="px-6 py-4 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3.5 py-2.5 rounded-lg text-[15px] font-medium"
                style={{ color: 'var(--mkt-text)' }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="mt-2 px-3.5 py-2.5 rounded-lg text-[15px] font-semibold inline-flex items-center gap-2"
              style={{
                color: 'var(--mkt-text)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'}`,
              }}
            >
              <LogIn size={15} strokeWidth={2.2} />
              Login
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
