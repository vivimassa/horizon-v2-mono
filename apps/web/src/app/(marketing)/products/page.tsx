'use client'

import { motion } from 'framer-motion'
import * as Lucide from 'lucide-react'
import { Check } from 'lucide-react'
import { HeroAurora } from '@/components/marketing/hero-aurora'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { mktImages } from '@/components/marketing/mkt-images'
import { ProductsDock } from '@/components/marketing/products-dock'

interface Suite {
  id: string
  eyebrow: string
  title: string
  icon: keyof typeof Lucide
  accent: string
  pitch: string
  features: string[]
  image: string
}

const SUITES: Suite[] = [
  {
    id: 'network',
    eyebrow: 'Commercial & Network',
    title: 'Network — design and publish your schedule with confidence',
    icon: 'Route',
    accent: '#3E7BFA',
    pitch:
      'Build rotations, assign aircraft, negotiate slots, and publish seasons — then compare scenarios side-by-side before anything reaches the operation. SSIM-native, codeshare-aware, and optimised for airlines running dozens to thousands of daily flights.',
    features: [
      'SSIM Chapter 7 import & export, round-trip fidelity',
      'Scenario compare with delta visualisation',
      'Slot coordination (IATA Level 2/3) with change log',
      'Codeshare & charter management',
      'Fleet assignment with utilisation dashboards',
      'Public timetable & FIDS publication',
    ],
    image: mktImages.network,
  },
  {
    id: 'flight-ops',
    eyebrow: 'Operations Control',
    title: 'Flight Ops — real-time control, AI-assisted recovery',
    icon: 'Plane',
    accent: '#06C270',
    pitch:
      'Your OCC screen, rebuilt for the web. Live movement messages, OOOI tracking, delay ripple projection, curfew and ETOPS awareness, and a column-generation recovery engine that proposes swaps, delays, and cancellations with full cost breakdowns.',
    features: [
      'World map with live OOOI positions',
      'Movement message parsing (MVT / ASM / SSM)',
      'Disruption center with CG-based recovery solver',
      'Curfew, slot, and ETOPS constraint engine',
      'Delay code attribution and ripple projection',
      'OTP reporting and delay analysis',
    ],
    image: mktImages.flightOps,
  },
  {
    id: 'ground-ops',
    eyebrow: 'Ground Operations',
    title: 'Ground Ops — turnaround, load control, and ramp coordination',
    icon: 'Truck',
    accent: '#FF8800',
    pitch:
      'Sequence turnarounds by station, coordinate with fuelers and caterers, publish load sheets, and sync with your maintenance system in real time. Every update pushes into Flight Ops and Crew Ops instantly.',
    features: [
      'Turnaround sequencing with deadline tracking',
      'Load control & weight and balance',
      'Cargo management with space/weight optimisation',
      'Maintenance system integration',
      'Aircraft status board with live condition',
      'Ramp coordination and delay attribution',
    ],
    image: mktImages.groundOps,
  },
  {
    id: 'crew-ops',
    eyebrow: 'Crew Operations',
    title: 'Crew Ops — rostering, pairing, and FDTL without the spreadsheets',
    icon: 'Users',
    accent: '#7C5CFF',
    pitch:
      'Auto-pair, auto-roster, and keep every flight duty check compliant with CAAV VAR 15 and EASA FTL. Crew self-service on mobile. Training, qualifications, and document expiry tracked alongside the roster.',
    features: [
      'Automated pairing and rostering engines',
      'FDTL and rest-period compliance (CAAV VAR 15 / EASA)',
      'Crew self-service portal (bid, swap, request)',
      'Qualification, licence, and document expiry',
      'Manpower planning and crew schedule views',
      'Roster summary and FDTL reports',
    ],
    image: mktImages.crewOps,
  },
]

const iconMap = Lucide as unknown as Record<string, Lucide.LucideIcon>

export default function ProductsPage() {
  return (
    <>
      <HeroAurora>
        <div className="text-center max-w-3xl mx-auto">
          <div
            className="text-[13px] uppercase tracking-[0.22em] font-bold mb-5"
            style={{ color: 'var(--mkt-accent)' }}
          >
            Products
          </div>
          <h1
            className="text-[40px] md:text-[64px] leading-[1.05] font-bold tracking-tight"
            style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
          >
            Four suites. <span className="mkt-gradient-text">One operational graph.</span>
          </h1>
          <p className="mt-6 text-[17px] md:text-[19px] leading-[1.55]" style={{ color: 'var(--mkt-text-dim)' }}>
            Every SkyHub module reads and writes to the same shared data model. Change a rotation in Network and Crew
            Ops sees it the instant you hit save.
          </p>
        </div>
      </HeroAurora>

      {/* Vertical sticky dock — left rail, lg+ screens */}
      <ProductsDock
        items={SUITES.map((s) => ({
          id: s.id,
          label: s.title.split(' — ')[0],
          icon: s.icon,
          accent: s.accent,
        }))}
      />

      {/* Suites */}
      {SUITES.map((suite, i) => {
        const Icon = iconMap[suite.icon] ?? Lucide.Box
        const reverse = i % 2 === 1
        return (
          <section key={suite.id} id={suite.id} className="py-20 md:py-24 scroll-mt-24">
            <div className="max-w-[1280px] mx-auto px-6">
              <div
                className={`grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.7 }}
                >
                  <div
                    className="inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.22em] font-bold mb-5"
                    style={{ color: suite.accent }}
                  >
                    <span className="w-8 h-[2px] rounded-full" style={{ background: suite.accent }} />
                    {suite.eyebrow}
                  </div>
                  <h2
                    className="text-[30px] md:text-[42px] font-bold tracking-tight leading-[1.1] mb-5"
                    style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
                  >
                    {suite.title}
                  </h2>
                  <p
                    className="text-[15px] md:text-[16px] leading-[1.65] mb-7"
                    style={{ color: 'var(--mkt-text-dim)' }}
                  >
                    {suite.pitch}
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {suite.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14px]" style={{ color: 'var(--mkt-text)' }}>
                        <span
                          className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${suite.accent}20`, color: suite.accent }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.8 }}
                  className="relative"
                >
                  <div
                    aria-hidden
                    className="absolute -inset-6 rounded-[32px] pointer-events-none opacity-70"
                    style={{
                      background: `radial-gradient(500px 300px at 50% 50%, ${suite.accent}40, transparent 70%)`,
                      filter: 'blur(40px)',
                    }}
                  />
                  <div
                    className="mkt-glass relative overflow-hidden group"
                    style={{ aspectRatio: '4 / 3', borderRadius: 24 }}
                  >
                    <img
                      src={suite.image}
                      alt={suite.eyebrow}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(180deg, rgba(10,11,16,0.20) 0%, rgba(10,11,16,0.55) 60%, ${suite.accent}30 100%)`,
                      }}
                    />
                    <div
                      className="absolute top-5 left-5 w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md"
                      style={{
                        background: `${suite.accent}28`,
                        border: `1px solid ${suite.accent}60`,
                        color: '#fff',
                        boxShadow: `0 8px 24px ${suite.accent}40`,
                      }}
                    >
                      <Icon size={22} strokeWidth={2} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <div
                        className="text-[13px] uppercase tracking-[0.18em] font-bold"
                        style={{ color: suite.accent }}
                      >
                        {suite.eyebrow}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        )
      })}

      <section className="py-16">
        <div className="max-w-[1280px] mx-auto px-6">
          <CtaPanel
            title="Ready to see the whole picture?"
            subtitle="A demo shows how the four suites work together — not four isolated tools."
          />
        </div>
      </section>
    </>
  )
}
