'use client'

import { motion } from 'framer-motion'
import { Brain, Cloud, HeartHandshake, Compass } from 'lucide-react'
import { HeroAurora } from '@/components/marketing/hero-aurora'
import { SectionHeading } from '@/components/marketing/section-heading'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { mktImages } from '@/components/marketing/mkt-images'

const PRINCIPLES = [
  {
    icon: Cloud,
    image: mktImages.webFirst,
    title: 'One app, every module',
    body: 'Not a portal with a dozen bolted-on tabs — a single application that feels like the modern tools your team already uses. Runs on any device, no installers, no thick clients, no VPN acrobatics.',
  },
  {
    icon: Brain,
    image: mktImages.aiCopilot,
    title: 'AI as copilot, not replacement',
    body: 'Our AI proposes roster swaps, recovery options, and compliance checks. Your controllers still own the decision — with the full reasoning on screen.',
  },
  {
    icon: HeartHandshake,
    image: mktImages.operatorOwned,
    title: 'Operator-owned data',
    body: 'Your schedule, your rosters, your flight plans — they belong to you. Single-tenant MongoDB clusters per operator, export anything at any time.',
  },
  {
    icon: Compass,
    image: mktImages.builtByOps,
    title: 'Built by ops, for ops',
    body: 'Our team has run OCC night shifts, built rosters during strikes, and recovered from volcanic ash. We know what good software feels like at 03:00.',
  },
]

export default function AboutPage() {
  return (
    <>
      <HeroAurora>
        <div className="text-center max-w-3xl mx-auto">
          <div
            className="text-[13px] uppercase tracking-[0.22em] font-bold mb-5"
            style={{ color: 'var(--mkt-accent)' }}
          >
            About SkyHub
          </div>
          <h1
            className="text-[40px] md:text-[64px] leading-[1.05] font-bold tracking-tight"
            style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
          >
            We're here to make disruption <span className="mkt-gradient-text">less disruptive.</span>
          </h1>
          <p className="mt-6 text-[17px] md:text-[19px] leading-[1.55]" style={{ color: 'var(--mkt-text-dim)' }}>
            Airlines don't run on schedules — they run on responses to broken schedules. We build the platform that lets
            your team see, decide, and act faster than the disruption can spread.
          </p>
        </div>
      </HeroAurora>

      {/* Who we are */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="md:col-span-2"
          >
            <div
              className="text-[13px] uppercase tracking-[0.22em] font-bold mb-4"
              style={{ color: 'var(--mkt-accent)' }}
            >
              Who we are
            </div>
            <h2
              className="text-[30px] md:text-[40px] font-bold tracking-tight leading-[1.1]"
              style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
            >
              A small team with large-operation scars.
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="md:col-span-3 text-[15px] md:text-[16px] leading-[1.7]"
            style={{ color: 'var(--mkt-text-dim)' }}
          >
            <p className="mb-5">
              SkyHub is built by a team of former airline dispatchers, crew planners, and software engineers. We grew up
              inside the industry's legacy stack — green-screens, thick clients, ancient portals — and watched
              operations teams work around their tools instead of through them.
            </p>
            <p className="mb-5">
              When we started SkyHub, the brief was simple: rebuild the airline ops stack the way it would have been
              designed today, if we were starting from scratch. An application, not a portal. Single source of truth.
              AI-assisted where it earns its keep — out of the way everywhere else.
            </p>
            <p>
              Today we support airlines flying tens to hundreds of aircraft across Southeast Asia, with a product
              road-map that's shaped week by week by the operators who use it.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Principles */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto px-6">
          <SectionHeading
            eyebrow="What we believe"
            title="Four principles we don't compromise on."
            accentKeyword="don't compromise on."
          />
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
            {PRINCIPLES.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                className="mkt-glass relative overflow-hidden group"
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 7' }}>
                  <img
                    src={p.image}
                    alt={p.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(180deg, rgba(10,11,16,0.20) 0%, rgba(10,11,16,0.70) 100%)',
                    }}
                  />
                  <div
                    className="absolute top-4 left-4 w-11 h-11 rounded-xl flex items-center justify-center backdrop-blur-md"
                    style={{
                      background: 'rgba(62,123,250,0.28)',
                      border: '1px solid rgba(62,123,250,0.55)',
                      color: '#fff',
                      boxShadow: '0 6px 18px rgba(62,123,250,0.35)',
                    }}
                  >
                    <p.icon size={20} strokeWidth={2} />
                  </div>
                </div>
                <div className="p-7 md:p-8">
                  <h3
                    className="text-[20px] md:text-[22px] font-bold tracking-tight mb-2"
                    style={{ color: 'var(--mkt-text)' }}
                  >
                    {p.title}
                  </h3>
                  <p className="text-[14px] md:text-[15px] leading-[1.65]" style={{ color: 'var(--mkt-text-dim)' }}>
                    {p.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-16">
        <div className="max-w-[1000px] mx-auto px-6">
          <motion.blockquote
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="mkt-glass p-10 md:p-14 relative overflow-hidden text-center"
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{
                background: 'radial-gradient(600px 300px at 50% 100%, rgba(62,123,250,0.20), transparent 70%)',
              }}
            />
            <p
              className="relative z-10 text-[22px] md:text-[28px] leading-[1.4] font-semibold tracking-tight"
              style={{ color: 'var(--mkt-text)', letterSpacing: '-0.01em' }}
            >
              "The best operations software disappears when everything is running smoothly — and reads your mind the
              moment it isn't."
            </p>
            <div
              className="relative z-10 mt-6 text-[13px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: 'var(--mkt-accent)' }}
            >
              — Our north star
            </div>
          </motion.blockquote>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1280px] mx-auto px-6">
          <CtaPanel
            title="Let's talk about your operation."
            subtitle="We'd rather have a real conversation than send you a brochure."
          />
        </div>
      </section>
    </>
  )
}
