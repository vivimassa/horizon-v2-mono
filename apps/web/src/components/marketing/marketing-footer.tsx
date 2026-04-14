'use client'

import Link from 'next/link'
import { Shield, Lock, Globe } from 'lucide-react'

const COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Network', href: '/products#network' },
      { label: 'Flight Ops', href: '/products#flight-ops' },
      { label: 'Ground Ops', href: '/products#ground-ops' },
      { label: 'Crew Ops', href: '/products#crew-ops' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Services', href: '/services' },
      { label: 'Contact', href: '/contact' },
      { label: 'Login', href: '/login' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/contact' },
      { label: 'Terms', href: '/contact' },
      { label: 'DPA', href: '/contact' },
    ],
  },
]

export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="relative mt-32 border-t" style={{ borderColor: 'var(--mkt-border)' }}>
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <img
                src="/skyhub-logo.png"
                alt="SkyHub"
                style={{ height: 40, filter: 'brightness(0) invert(1)', opacity: 0.9 }}
                className="hidden dark:block"
              />
              <img
                src="/skyhub-logo.png"
                alt="SkyHub"
                style={{ height: 40, filter: 'brightness(0)', opacity: 0.9 }}
                className="block dark:hidden"
              />
            </Link>
            <p className="text-[13px] leading-relaxed max-w-xs" style={{ color: 'var(--mkt-text-dim)' }}>
              The first true all-in-one application for airline operations. One source of truth for Network, Flight,
              Crew, and Ground.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div
                className="text-[11px] uppercase tracking-[0.12em] font-bold mb-4"
                style={{ color: 'var(--mkt-accent)' }}
              >
                {col.title}
              </div>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] transition-colors hover:opacity-100"
                      style={{ color: 'var(--mkt-text-dim)' }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 pt-8 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          style={{ borderColor: 'var(--mkt-border)' }}
        >
          <div className="text-[13px]" style={{ color: 'var(--mkt-text-dim)' }}>
            © {year} SkyHub · Aviation Management System
          </div>
          <div className="flex items-center gap-4" style={{ color: 'var(--mkt-text-dim)' }}>
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <Shield size={14} strokeWidth={2} /> SOC 2
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <Lock size={14} strokeWidth={2} /> GDPR
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <Globe size={14} strokeWidth={2} /> ICAO-aligned
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
