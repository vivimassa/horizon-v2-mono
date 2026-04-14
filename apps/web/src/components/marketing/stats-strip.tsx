'use client'

import { motion } from 'framer-motion'

export interface Stat {
  value: string
  label: string
}

export function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div
      className="mkt-glass grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0"
      style={{ borderColor: 'var(--mkt-border)' }}
    >
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="px-6 py-7 text-center"
          style={{ borderColor: 'var(--mkt-border)' }}
        >
          <div
            className="text-[34px] md:text-[44px] font-bold tracking-tight leading-none"
            style={{
              background: 'linear-gradient(135deg, var(--mkt-accent) 0%, var(--mkt-accent-violet) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            {s.value}
          </div>
          <div
            className="mt-2 text-[13px] uppercase tracking-[0.12em] font-semibold"
            style={{ color: 'var(--mkt-text-dim)' }}
          >
            {s.label}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
