'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, PlayCircle, Sparkles, Brain, Layers, Radio } from 'lucide-react'
import { HeroAurora } from '@/components/marketing/hero-aurora'
import { SectionHeading } from '@/components/marketing/section-heading'
import { BentoGrid } from '@/components/marketing/bento-grid'
import { StatsStrip } from '@/components/marketing/stats-strip'
import { LogoMarquee } from '@/components/marketing/logo-marquee'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { mktImages } from '@/components/marketing/mkt-images'

const CORE_SUITES = [
  {
    key: 'network',
    title: 'Network',
    description:
      'Design, schedule, and optimise your network — routes, slots, codeshare, SSIM, and season planning in one place.',
    icon: 'Route' as const,
    href: '/products#network',
    accent: '#3E7BFA',
    bullets: ['SSIM import & export', 'Slot management', 'Fleet assignment'],
    span: 2 as const,
    image: mktImages.network,
  },
  {
    key: 'flight-ops',
    title: 'Flight Ops',
    description: 'Real-time OCC, movement messages, and AI-assisted disruption recovery.',
    icon: 'Plane' as const,
    href: '/products#flight-ops',
    accent: '#06C270',
    bullets: ['Live OOOI tracking', 'OCC dashboard', 'CG-based recovery'],
    image: mktImages.flightOps,
  },
  {
    key: 'ground-ops',
    title: 'Ground Ops',
    description: 'Turnaround, cargo, fueling, and ramp coordination — synchronised with flight ops in real time.',
    icon: 'Truck' as const,
    href: '/products#ground-ops',
    accent: '#FF8800',
    bullets: ['Turnaround sequencing', 'Load control', 'Maintenance interface'],
    image: mktImages.groundOps,
  },
  {
    key: 'crew-ops',
    title: 'Crew Ops',
    description: 'Rostering, pairing, FDTL, qualifications — compliant with CAAV VAR 15 and EASA.',
    icon: 'Users' as const,
    href: '/products#crew-ops',
    accent: '#7C5CFF',
    bullets: ['Auto-pairing', 'FDTL checks', 'Crew self-service'],
    span: 2 as const,
    image: mktImages.crewOps,
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Unify',
    body: 'One platform replaces 6+ legacy systems. Single source of truth, operator-owned data.',
    icon: Layers,
    image: mktImages.stepUnify,
  },
  {
    num: '02',
    title: 'Automate',
    body: 'AI copilots handle pairing, recovery, and compliance checks — your team stays in the loop.',
    icon: Brain,
    image: mktImages.stepAutomate,
  },
  {
    num: '03',
    title: 'Decide',
    body: 'Disruption? See options, tradeoffs, and cost impact in seconds — not hours.',
    icon: Radio,
    image: mktImages.stepDecide,
  },
]

export default function LandingPage() {
  return (
    <>
      {/* HERO */}
      <HeroAurora>
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3.5 h-8 rounded-full mb-7 text-[13px] font-semibold"
            style={{
              background: 'var(--mkt-surface)',
              border: '1px solid var(--mkt-border)',
              color: 'var(--mkt-text)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles size={13} strokeWidth={2.2} style={{ color: 'var(--mkt-accent)' }} />
            <span style={{ color: 'var(--mkt-accent)' }} className="uppercase tracking-[0.14em]">
              The First All-In-One Airline App
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[44px] md:text-[72px] leading-[1.02] font-bold tracking-tight"
            style={{ color: 'var(--mkt-text)', letterSpacing: '-0.03em' }}
          >
            One platform. <span className="mkt-gradient-text">Every operation.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-[17px] md:text-[20px] leading-[1.5] max-w-2xl mx-auto"
            style={{ color: 'var(--mkt-text-dim)' }}
          >
            The first true all-in-one application for airline operations. AI-assisted, built like a modern app — not a
            legacy web portal — and unifies Network, Flight, Crew, and Ground into one source of truth.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, var(--mkt-accent) 0%, var(--mkt-accent-violet) 100%)',
                boxShadow: '0 16px 40px -12px rgba(62,123,250,0.7)',
              }}
            >
              Book a Demo
              <ArrowRight size={15} strokeWidth={2.4} />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-[14px] font-semibold transition-colors"
              style={{
                color: 'var(--mkt-text)',
                border: '1px solid var(--mkt-border)',
                background: 'var(--mkt-surface)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <PlayCircle size={16} strokeWidth={2} />
              Explore Products
            </Link>
          </motion.div>
        </div>

        {/* Floating dashboard mock */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-16 md:mt-20 max-w-5xl mx-auto"
          style={{ perspective: 1400 }}
        >
          <div
            aria-hidden
            className="absolute -inset-8 rounded-[40px] pointer-events-none"
            style={{
              background: 'radial-gradient(600px 300px at 50% 80%, rgba(62,123,250,0.35), transparent 70%)',
              filter: 'blur(30px)',
            }}
          />
          <div
            className="mkt-glass relative overflow-hidden rounded-2xl"
            style={{
              aspectRatio: '16 / 9',
              border: '1px solid var(--mkt-border)',
              boxShadow: '0 50px 100px -30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
            }}
          >
            {/* Window chrome */}
            <div
              className="relative z-10 flex items-center gap-1.5 px-4 h-9 border-b"
              style={{
                borderColor: 'rgba(255,255,255,0.08)',
                background: 'rgba(14,16,22,0.92)',
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              <div className="ml-4 text-[13px] font-medium text-white/70">
                skyhub.app / flight-ops / movement-control
              </div>
            </div>

            {/* Product screenshot */}
            <img
              src="/marketing/hero-movement-control.png"
              alt="SkyHub movement control dashboard"
              className="relative z-0 w-full h-[calc(100%-36px)] object-cover object-top"
              style={{ display: 'block' }}
            />
          </div>
        </motion.div>
      </HeroAurora>

      {/* LOGO MARQUEE */}
      <section className="py-12 md:py-14">
        <div className="max-w-[1280px] mx-auto px-6">
          <div
            className="text-center text-[13px] uppercase tracking-[0.22em] font-semibold mb-8"
            style={{ color: 'var(--mkt-text-dim)' }}
          >
            Trusted by operators building the future of flight
          </div>
          <LogoMarquee />
        </div>
      </section>

      {/* STATS */}
      <section className="py-14">
        <div className="max-w-[1280px] mx-auto px-6">
          <StatsStrip
            stats={[
              { value: '4', label: 'Core suites' },
              { value: '1', label: 'All-in-one app' },
              { value: '50+', label: 'Integrated modules' },
              { value: '24/7', label: 'Support' },
            ]}
          />
        </div>
      </section>

      {/* BENTO — core suites */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto px-6">
          <SectionHeading
            eyebrow="The Platform"
            title="Four suites. Zero silos."
            subtitle="Every module reads and writes to the same operational graph. Change a rotation in Network and it ripples through Crew, Ground, and Flight Ops instantly."
            accentKeyword="Zero silos."
          />
          <div className="mt-14">
            <BentoGrid items={CORE_SUITES} />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto px-6">
          <SectionHeading
            eyebrow="How It Works"
            title="Built for the way ops actually run."
            subtitle="SkyHub is designed around the realities of airline operations — disruption is the default, not the exception."
            accentKeyword="actually run."
          />
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="mkt-glass relative overflow-hidden group"
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
                  <img
                    src={s.image}
                    alt={s.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(180deg, rgba(10,11,16,0.25) 0%, rgba(10,11,16,0.65) 100%)',
                    }}
                  />
                  <div
                    className="absolute top-4 left-4 text-[13px] uppercase tracking-[0.22em] font-bold px-2.5 py-1 rounded-full backdrop-blur-md"
                    style={{
                      background: 'rgba(10,11,16,0.55)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: '#fff',
                    }}
                  >
                    {s.num}
                  </div>
                  <div
                    className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md"
                    style={{
                      background: 'rgba(62,123,250,0.25)',
                      border: '1px solid rgba(62,123,250,0.50)',
                      color: '#fff',
                    }}
                  >
                    <s.icon size={18} strokeWidth={2} />
                  </div>
                </div>
                <div className="p-7 md:p-8">
                  <h3 className="text-[22px] font-bold tracking-tight mb-2" style={{ color: 'var(--mkt-text)' }}>
                    {s.title}
                  </h3>
                  <p className="text-[14px] leading-[1.6]" style={{ color: 'var(--mkt-text-dim)' }}>
                    {s.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto px-6">
          <CtaPanel
            title="See SkyHub fly your operation."
            subtitle="Thirty-minute walkthrough with an operations engineer. No slides — just your data patterns in our platform."
            primaryLabel="Book a Demo"
            primaryHref="/contact"
            secondaryLabel="Login"
            secondaryHref="/login"
          />
        </div>
      </section>
    </>
  )
}
