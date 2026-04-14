'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import * as Lucide from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'

export interface BentoItem {
  key: string
  title: string
  description: string
  icon: keyof typeof Lucide
  href?: string
  accent?: string
  span?: 1 | 2
  bullets?: string[]
  image?: string
}

const iconMap = Lucide as unknown as Record<string, Lucide.LucideIcon>

export function BentoGrid({ items }: { items: BentoItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
      {items.map((item, i) => {
        const Icon = iconMap[item.icon] ?? Lucide.Box
        const accent = item.accent ?? 'var(--mkt-accent)'
        const span = item.span ?? 1
        const Body = (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={`mkt-glass group relative overflow-hidden h-full flex flex-col ${
              span === 2 ? 'md:col-span-2' : ''
            }`}
            whileHover={{ y: -4 }}
          >
            {/* Image banner */}
            {item.image && (
              <div
                className="relative w-full overflow-hidden shrink-0"
                style={{ aspectRatio: span === 2 ? '16 / 6' : '16 / 9' }}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, rgba(10,11,16,0.15) 0%, rgba(10,11,16,0.35) 60%, ${accent}30 100%)`,
                  }}
                />
                <div
                  className="absolute top-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md"
                  style={{
                    background: `${accent}28`,
                    border: `1px solid ${accent}60`,
                    color: '#fff',
                    boxShadow: `0 4px 18px ${accent}40`,
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                </div>
              </div>
            )}

            <div className={`relative z-10 flex-1 flex flex-col ${item.image ? 'p-6 md:p-7' : 'p-6 md:p-7'}`}>
              {/* Accent glow — only when no image */}
              {!item.image && (
                <>
                  <div
                    aria-hidden
                    className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none opacity-60 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
                      filter: 'blur(30px)',
                    }}
                  />
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 relative"
                    style={{
                      background: `${accent}18`,
                      border: `1px solid ${accent}30`,
                      color: accent,
                    }}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                </>
              )}
              <h3
                className="text-[20px] md:text-[22px] font-bold tracking-tight mb-2"
                style={{ color: 'var(--mkt-text)' }}
              >
                {item.title}
              </h3>
              <p className="text-[14px] leading-[1.55] mb-4" style={{ color: 'var(--mkt-text-dim)' }}>
                {item.description}
              </p>
              {item.bullets && (
                <ul className="mt-1 mb-4 flex flex-col gap-1.5">
                  {item.bullets.map((b) => (
                    <li key={b} className="text-[13px] flex items-start gap-2" style={{ color: 'var(--mkt-text-dim)' }}>
                      <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: accent }} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              {item.href && (
                <div
                  className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: accent }}
                >
                  Learn more
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2.4}
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )

        return item.href ? (
          <Link key={item.key} href={item.href} className={span === 2 ? 'md:col-span-2' : ''}>
            {Body}
          </Link>
        ) : (
          <div key={item.key} className={span === 2 ? 'md:col-span-2' : ''}>
            {Body}
          </div>
        )
      })}
    </div>
  )
}
