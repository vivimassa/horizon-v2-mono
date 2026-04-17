'use client'

import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Keyboard,
  Library,
  Search,
  ScrollText,
  Sparkles,
  Users,
  UserCog,
  Plane,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HELP_REGISTRY } from '@/components/help'

export function HelpCenterShell() {
  const router = useRouter()
  const authoredCount = HELP_REGISTRY.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-hz-text-secondary hover:bg-hz-border/30 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-bold text-hz-text leading-tight">Help Center</h1>
          <p className="text-[13px] text-hz-text-secondary mt-0.5">Guides, references, and the glossary for Sky Hub</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="max-w-[1080px] mx-auto flex flex-col gap-8">
          {/* Search (disabled shell) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-hz-text-secondary/60" />
            <input
              type="text"
              disabled
              placeholder="Search help — coming soon"
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-hz-card border border-hz-border text-[14px] text-hz-text placeholder:text-hz-text-secondary/60 disabled:cursor-not-allowed disabled:opacity-60 backdrop-blur-xl"
            />
          </div>

          <Section title="Learn by role" subtitle="Task-oriented tracks tailored to how you use Sky Hub.">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <RoleCard
                icon={Plane}
                title="Dispatcher"
                description="Movement control, disruption recovery, crewing touchpoints."
                pending
              />
              <RoleCard
                icon={Users}
                title="Crew Ops"
                description="Rosters, fatigue, pairings, compliance records."
                pending
              />
              <RoleCard
                icon={UserCog}
                title="Admin"
                description="Master data, users & roles, operator configuration."
                pending
              />
              <RoleCard
                icon={ShieldCheck}
                title="System Admin"
                description="Tenants, integrations, observability, deployments."
                pending
              />
            </div>
          </Section>

          <Section title="Quick references" subtitle="Things you'll want to check without leaving your workflow.">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <QuickCard
                icon={GraduationCap}
                title="Getting Started"
                description="A 10-minute tour of the six tabs and what lives where."
                pending
              />
              <QuickCard
                icon={Keyboard}
                title="Keyboard Shortcuts"
                description="F1 opens this help anywhere. Full cheatsheet coming soon."
                pending
              />
              <QuickCard
                icon={Library}
                title="Glossary"
                description="Airline jargon demystified — ICAO, IATA, SSIM, UTC and more."
                pending
              />
              <QuickCard
                icon={ScrollText}
                title="Release Notes"
                description="What shipped and when. Tied to operator deployment version."
                pending
              />
              <QuickCard
                icon={BookOpen}
                title="Module Guides"
                description={`${authoredCount} of ~90 modules documented. The rest arrive as we author them.`}
                pending
              />
              <QuickCard
                icon={Sparkles}
                title="What's New"
                description="Recent feature launches, grouped by module."
                pending
              />
            </div>
          </Section>

          <Section title="Need more help?" subtitle="Not finding what you're looking for?">
            <div className="rounded-xl border border-hz-border bg-hz-card backdrop-blur-xl p-5">
              <p className="text-[14px] text-hz-text/90 leading-[1.6]">
                Every page has a <span className="font-semibold text-module-accent">?</span> icon in its header. Click
                it (or press{' '}
                <kbd className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-hz-border bg-black/5 dark:bg-white/5 font-mono text-[13px] font-medium">
                  F1
                </kbd>
                ) to open contextual help for whatever you're looking at.
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-[3px] h-[16px] rounded-sm bg-module-accent" />
        <h2 className="text-[16px] font-semibold text-hz-text">{title}</h2>
      </div>
      {subtitle ? (
        <p className="text-[13px] text-hz-text-secondary mb-4 pl-[11px]">{subtitle}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  )
}

function RoleCard({
  icon: Icon,
  title,
  description,
  pending,
}: {
  icon: LucideIcon
  title: string
  description: string
  pending?: boolean
}) {
  return (
    <div
      className={[
        'relative rounded-xl border border-hz-border bg-hz-card backdrop-blur-xl p-4 flex flex-col gap-2',
        'transition-colors',
        pending ? 'opacity-70' : 'hover:border-module-accent/40 cursor-pointer',
      ].join(' ')}
    >
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-module-accent/10">
        <Icon className="h-[18px] w-[18px] text-module-accent" strokeWidth={1.8} />
      </div>
      <h3 className="text-[14px] font-semibold text-hz-text">{title}</h3>
      <p className="text-[13px] text-hz-text-secondary leading-snug">{description}</p>
      {pending ? <PendingTag /> : null}
    </div>
  )
}

function QuickCard({
  icon: Icon,
  title,
  description,
  pending,
}: {
  icon: LucideIcon
  title: string
  description: string
  pending?: boolean
}) {
  return (
    <div
      className={[
        'relative rounded-xl border border-hz-border bg-hz-card backdrop-blur-xl p-4 flex items-start gap-3',
        'transition-colors',
        pending ? 'opacity-70' : 'hover:border-module-accent/40 cursor-pointer',
      ].join(' ')}
    >
      <div className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-module-accent/10">
        <Icon className="h-[18px] w-[18px] text-module-accent" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-semibold text-hz-text">{title}</h3>
        <p className="text-[13px] text-hz-text-secondary leading-snug mt-0.5">{description}</p>
      </div>
      {pending ? <PendingTag /> : null}
    </div>
  )
}

function PendingTag() {
  return (
    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-hz-border/50 text-[13px] font-medium text-hz-text-secondary">
      Coming soon
    </span>
  )
}
