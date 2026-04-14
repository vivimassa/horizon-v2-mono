'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
}

export function CtaPanel({
  title,
  subtitle,
  primaryLabel = 'Book a Demo',
  primaryHref = '/contact',
  secondaryLabel = 'Login',
  secondaryHref = '/login',
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="mkt-glass mkt-glow-accent relative overflow-hidden px-8 py-14 md:px-14 md:py-20 text-center"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: 'radial-gradient(600px 400px at 50% 100%, rgba(62,123,250,0.35), transparent 70%)',
        }}
      />
      <div className="relative z-10 max-w-3xl mx-auto">
        <h3
          className="text-[32px] md:text-[44px] font-bold tracking-tight leading-[1.05]"
          style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="mt-4 text-[16px] md:text-[18px] leading-[1.55]" style={{ color: 'var(--mkt-text-dim)' }}>
            {subtitle}
          </p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, var(--mkt-accent) 0%, var(--mkt-accent-violet) 100%)',
              boxShadow: '0 12px 32px -8px rgba(62,123,250,0.6)',
            }}
          >
            {primaryLabel}
            <ArrowRight size={15} strokeWidth={2.4} />
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-[14px] font-semibold transition-colors"
            style={{
              color: 'var(--mkt-text)',
              background: 'transparent',
              border: '1px solid var(--mkt-border)',
            }}
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
