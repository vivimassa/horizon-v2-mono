'use client'

import { motion } from 'framer-motion'
import { GraduationCap, ShieldCheck, UserCog, Wrench, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { HeroAurora } from '@/components/marketing/hero-aurora'
import { CtaPanel } from '@/components/marketing/cta-panel'
import { mktImages } from '@/components/marketing/mkt-images'

const SERVICES = [
  {
    icon: GraduationCap,
    accent: '#3E7BFA',
    image: mktImages.training,
    title: 'Training & Implementation',
    pitch:
      'End-to-end onboarding — from kick-off through go-live and hypercare. Role-based training tracks for controllers, planners, crew schedulers, and administrators.',
    bullets: [
      'Dedicated implementation lead & solutions engineer',
      'Data migration from legacy systems and in-house tools',
      'Role-based training: controllers, planners, admins',
      'Hypercare support through first schedule season',
    ],
  },
  {
    icon: ShieldCheck,
    accent: '#06C270',
    image: mktImages.audit,
    title: 'Audits & Compliance',
    pitch:
      'Independent reviews of your FDTL setup, roster legality, and operations control workflows. CAAV VAR 15, EASA FTL, and ICAO-aligned.',
    bullets: [
      'FDTL rule audit and calibration',
      'Roster legality spot-check & remediation',
      'Disruption management process review',
      'Regulatory documentation for CAAV & ICAO',
    ],
  },
  {
    icon: UserCog,
    accent: '#7C5CFF',
    image: mktImages.crewPlanning,
    title: 'Crew Planning Services',
    pitch:
      'Outsource rostering and pairing to our planning cell — or use us to cover seasonal peaks. Works seamlessly on top of your SkyHub data.',
    bullets: [
      'Full-season pairing and rostering',
      'Peak-period augmentation for your ops team',
      'Bid-line construction and roster publication',
      'Same-day roster adjustments during disruption',
    ],
  },
  {
    icon: Wrench,
    accent: '#FF8800',
    image: mktImages.customization,
    title: 'Software Customization',
    pitch:
      'Every airline is different. We build custom modules, reports, and integrations on top of the SkyHub core — without forking your upgrade path.',
    bullets: [
      'Custom workflows, reports, and dashboards',
      'Integrations with your existing maintenance, reservations, and ERP systems',
      'White-label crew self-service apps',
      'API extensions for your internal systems',
    ],
  },
]

export default function ServicesPage() {
  return (
    <>
      <HeroAurora>
        <div className="text-center max-w-3xl mx-auto">
          <div
            className="text-[13px] uppercase tracking-[0.22em] font-bold mb-5"
            style={{ color: 'var(--mkt-accent)' }}
          >
            Services
          </div>
          <h1
            className="text-[40px] md:text-[64px] leading-[1.05] font-bold tracking-tight"
            style={{ color: 'var(--mkt-text)', letterSpacing: '-0.02em' }}
          >
            More than software. <span className="mkt-gradient-text">An ops partner.</span>
          </h1>
          <p className="mt-6 text-[17px] md:text-[19px] leading-[1.55]" style={{ color: 'var(--mkt-text-dim)' }}>
            From implementation through day-to-day operations — our team of ex-airline operators, planners, and
            engineers works alongside yours.
          </p>
        </div>
      </HeroAurora>

      <section className="py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="mkt-glass relative overflow-hidden group flex flex-col"
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 8' }}>
                  <img
                    src={s.image}
                    alt={s.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, rgba(10,11,16,0.15) 0%, rgba(10,11,16,0.55) 70%, ${s.accent}28 100%)`,
                    }}
                  />
                  <div
                    className="absolute top-4 left-4 w-11 h-11 rounded-xl flex items-center justify-center backdrop-blur-md"
                    style={{
                      background: `${s.accent}28`,
                      border: `1px solid ${s.accent}60`,
                      color: '#fff',
                      boxShadow: `0 6px 18px ${s.accent}40`,
                    }}
                  >
                    <s.icon size={20} strokeWidth={2} />
                  </div>
                </div>
                <div className="p-7 md:p-8 flex flex-col flex-1">
                  <h3
                    className="relative z-10 text-[22px] md:text-[26px] font-bold tracking-tight mb-3"
                    style={{ color: 'var(--mkt-text)', letterSpacing: '-0.01em' }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="relative z-10 text-[14px] md:text-[15px] leading-[1.6] mb-5"
                    style={{ color: 'var(--mkt-text-dim)' }}
                  >
                    {s.pitch}
                  </p>
                  <ul className="relative z-10 flex flex-col gap-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="text-[14px] flex items-start gap-2.5" style={{ color: 'var(--mkt-text)' }}>
                        <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.accent }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/contact"
                    className="relative z-10 mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform group-hover:translate-x-0.5"
                    style={{ color: s.accent }}
                  >
                    Talk to us <ArrowRight size={14} strokeWidth={2.4} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1280px] mx-auto px-6">
          <CtaPanel
            title="Scope your engagement in 30 minutes."
            subtitle="Tell us what you're running today and where the pain is. We'll map out the shortest path to value."
          />
        </div>
      </section>
    </>
  )
}
