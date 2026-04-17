'use client'

/**
 * 7.1.5 Integration — parent hub listing sub-modules for outbound
 * message transmission, ACARS ingestion and external system interfaces.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, MessageSquare, Radio, Plug } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { collapseDock } from '@/lib/dock-store'

interface SubModule {
  code: string
  name: string
  description: string
  route: string
  icon: typeof MessageSquare
  status: 'available' | 'scaffolded'
}

const SUB_MODULES: SubModule[] = [
  {
    code: '7.1.5.1',
    name: 'ASM/SSM Transmission',
    description: 'Schedule change message delivery — ASM Ad-hoc and SSM seasonal — to IATA SSIM recipients',
    route: '/settings/admin/integration/asm-ssm-transmission',
    icon: MessageSquare,
    status: 'scaffolded',
  },
  {
    code: '7.1.5.2',
    name: 'ACARS/MVT/LDM Transmission',
    description:
      'Movement, load and ACARS message automation — validation rules, auto-transmit scheduler and audit trail',
    route: '/settings/admin/integration/acars-mvt-ldm-transmission',
    icon: Radio,
    status: 'available',
  },
]

export default function IntegrationPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    collapseDock()
  }, [])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,1)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="h-full p-6 overflow-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--module-accent)', opacity: 0.14 }}
          />
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center -ml-10"
            style={{ color: 'var(--module-accent)' }}
          >
            <Plug size={20} />
          </div>
          <div className="ml-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">7.1.5</div>
            <div className="text-[20px] font-semibold text-hz-text leading-tight">Integration</div>
          </div>
        </div>

        <p className="text-[13px] text-hz-text-secondary mb-6 max-w-2xl">
          Configure outbound message transmission, inbound ACARS/MVT/LDM ingestion, and external system interfaces.
          Sub-modules are admin-only.
        </p>

        {/* Sub-module list */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: glassBg,
            border: `1px solid ${glassBorder}`,
            backdropFilter: 'blur(24px)',
          }}
        >
          {SUB_MODULES.map((m, i) => {
            const Icon = m.icon
            return (
              <Link
                key={m.code}
                href={m.route}
                className="flex items-center gap-4 px-5 py-4 transition-colors group"
                style={{
                  background: cardBg,
                  borderBottom: i < SUB_MODULES.length - 1 ? `1px solid ${cardBorder}` : undefined,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `var(--module-accent, #1e40af)`,
                    opacity: 0.14,
                  }}
                />
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 -ml-14"
                  style={{ color: 'var(--module-accent, #1e40af)' }}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0 ml-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-hz-text-tertiary">{m.code}</span>
                    <span className="text-[15px] font-semibold text-hz-text">{m.name}</span>
                    {m.status === 'scaffolded' && (
                      <span
                        className="ml-1 inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold"
                        style={{
                          background: 'rgba(96,97,112,0.14)',
                          color: '#606170',
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                        }}
                      >
                        Scaffold
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-hz-text-secondary mt-0.5">{m.description}</div>
                </div>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-hz-text-tertiary group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
