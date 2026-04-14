'use client'

import { motion } from 'framer-motion'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  accentKeyword?: string
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'center', accentKeyword }: Props) {
  const renderTitle = () => {
    if (!accentKeyword) return title
    const parts = title.split(accentKeyword)
    if (parts.length < 2) return title
    return (
      <>
        {parts[0]}
        <span className="mkt-gradient-text">{accentKeyword}</span>
        {parts.slice(1).join(accentKeyword)}
      </>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={align === 'center' ? 'text-center max-w-3xl mx-auto' : 'max-w-3xl'}
    >
      {eyebrow && (
        <div className="text-[13px] uppercase tracking-[0.22em] font-bold mb-4" style={{ color: 'var(--mkt-accent)' }}>
          {eyebrow}
        </div>
      )}
      <h2
        className="text-[34px] md:text-[48px] leading-[1.05] font-bold tracking-tight mb-5"
        style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
      >
        {renderTitle()}
      </h2>
      {subtitle && (
        <p className="text-[16px] md:text-[18px] leading-[1.55]" style={{ color: 'var(--mkt-text-dim)' }}>
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
