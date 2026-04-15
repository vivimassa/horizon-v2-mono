'use client'

import { useRouter, usePathname } from 'next/navigation'
import * as LucideIcons from 'lucide-react'
import { MODULE_REGISTRY, MODULE_THEMES, resolveModule } from '@skyhub/constants'
import { useTheme } from '@/components/theme-provider'
import { revealNavigate } from '@/lib/nav-transition'

/**
 * 7.4 — Company Document (STUB).
 *
 * Single source of truth for operational documents. Lives under System
 * Administration so admins own uploads and versioning; operational modules
 * (Flight Ops / Ground Ops / Crew Ops / AI Customization) consume filtered
 * views by tag.
 */

const PLANNED_SCOPE: Array<{ title: string; detail: string }> = [
  {
    title: 'Upload & paste',
    detail:
      'PDF, Word and plain-text uploads. Paste-in for quick procedures. Server parses text, keeps the original file in object storage (not MongoDB).',
  },
  {
    title: 'Domain tagging',
    detail:
      'Each document is tagged Flight Ops, Ground Ops, Crew Ops or Common. Multi-select — the Ops Manual usually spans all three. Module pages show filtered views so teams still feel ownership.',
  },
  {
    title: 'Versioning',
    detail:
      'Every re-upload creates a new version. Old versions stay archived with timestamps, not deleted. Rollback is one click.',
  },
  {
    title: 'Last-reviewed dates',
    detail:
      'Admin marks a document as “reviewed on DD/MM/YYYY”. UI warns when a document has not been reviewed in N months (configurable).',
  },
  {
    title: 'Per-tag upload permissions',
    detail:
      'Flight-ops managers can upload and tag as Flight or Common, but not Crew. Tight control without splitting the library into separate silos.',
  },
  {
    title: 'Module-level read views',
    detail:
      'Flight Ops, Ground Ops, Crew Ops pages gain a Documents tab that shows a filtered, read-only view. One library, many windows.',
  },
  {
    title: 'AI corpus flag',
    detail:
      'Each document has an “indexed by advisor” toggle. AI Customization reads this — the advisor only retrieves from documents the operator has explicitly opted in.',
  },
  {
    title: 'Search',
    detail:
      'Full-text search across titles, section headers and body. Bonus: semantic search via the same embedding index used by the AI advisor.',
  },
  {
    title: 'Citations',
    detail:
      'When the AI references a document, it returns the section and version. Controllers can open the source directly from the recommendation.',
  },
]

const PHASED_ROADMAP: Array<{ phase: string; detail: string }> = [
  {
    phase: 'v1 (first ship)',
    detail:
      'Upload + domain tagging + version history + search + AI corpus opt-in. Enough to unblock AI Customization and give teams one place to find SOPs.',
  },
  {
    phase: 'v2',
    detail:
      'OneDrive / SharePoint read-sync. Index-in-place — files stay in the airline’s tenant, SkyHub keeps a text + vector shadow.',
  },
  {
    phase: 'v3',
    detail:
      'Sign-off workflows, crew acknowledgments, distribution tracking. This is where the module graduates into a full DMS.',
  },
  {
    phase: 'v4',
    detail: 'Two-way OneDrive sync, regulator export, change-notification broadcasting to affected crew/modules.',
  },
]

const STORAGE_NOTE = [
  'Raw PDFs live in object storage (S3 / Cloudflare R2 / Azure Blob) — never MongoDB.',
  'MongoDB keeps metadata, parsed text chunks and vector embeddings only.',
  'Rough size budget: ~50 MB per operator in Mongo. Fully manageable.',
  'Never duplicate uploads across modules — one library, many filtered views.',
]

const iconMap = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>

export default function Page() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const mod = resolveModule(pathname)
  const accent = mod ? (MODULE_THEMES[mod.module]?.accent ?? '#d97706') : '#d97706'
  const parent = MODULE_REGISTRY.find((x) => x.code === mod?.parent_code)
  const Icon = mod ? (iconMap[mod.icon] ?? LucideIcons.FolderOpen) : LucideIcons.FolderOpen

  const cardBg = isDark ? 'rgba(25,25,33,0.72)' : 'rgba(255,255,255,0.82)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const innerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'
  const innerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(71,85,105,0.80)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'

  function goBack() {
    revealNavigate(router, '/hub?domain=sysadmin', {
      origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      accent,
      direction: 'out',
    })
  }

  return (
    <div className="h-full w-full overflow-y-auto py-10 px-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            backdropFilter: 'blur(18px) saturate(150%)',
            WebkitBackdropFilter: 'blur(18px) saturate(150%)',
            boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.35)' : '0 12px 40px rgba(96,97,112,0.12)',
          }}
        >
          <div
            className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: 420,
              height: 220,
              background: `radial-gradient(ellipse at center, ${accent}33 0%, transparent 65%)`,
              filter: 'blur(24px)',
            }}
          />

          <div className="relative px-8 pt-10 pb-8 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center rounded-2xl shrink-0"
                style={{
                  width: 56,
                  height: 56,
                  background: accent,
                  boxShadow: `0 8px 24px ${accent}55`,
                }}
              >
                <Icon size={26} strokeWidth={1.8} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: accent }}>
                    {mod?.code ?? '7.4'}
                  </span>
                  {parent && (
                    <>
                      <span className="text-[11px]" style={{ color: textTertiary }}>
                        ·
                      </span>
                      <span
                        className="text-[11px] font-semibold tracking-wide uppercase"
                        style={{ color: textTertiary }}
                      >
                        {parent.name}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-[22px] font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
                  {mod?.name ?? 'Company Document'}
                </h1>
                {mod?.description && (
                  <p className="text-[13px] leading-relaxed mt-1.5" style={{ color: textSecondary }}>
                    {mod.description}
                  </p>
                )}
              </div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0"
                style={{
                  background: `${accent}18`,
                  border: `1px solid ${accent}33`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                />
                <span className="text-[13px] font-semibold tracking-wide" style={{ color: accent }}>
                  Planned
                </span>
              </div>
            </div>

            {/* Planned scope */}
            <div className="rounded-xl px-5 py-4" style={{ background: innerBg, border: `1px solid ${innerBorder}` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-[14px] rounded-full" style={{ background: accent }} />
                <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                  Planned scope
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {PLANNED_SCOPE.map((f) => (
                  <li key={f.title} className="flex items-start gap-3">
                    <LucideIcons.Dot size={20} strokeWidth={3} color={accent} className="shrink-0 mt-[1px]" />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold" style={{ color: textPrimary }}>
                        {f.title}
                      </div>
                      <div className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
                        {f.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Phased roadmap */}
            <div className="rounded-xl px-5 py-4" style={{ background: innerBg, border: `1px solid ${innerBorder}` }}>
              <div className="flex items-center gap-2 mb-3">
                <LucideIcons.Milestone size={14} strokeWidth={2.2} color={accent} />
                <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                  Phased roadmap
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {PHASED_ROADMAP.map((p) => (
                  <li key={p.phase} className="flex items-start gap-3">
                    <span
                      className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded shrink-0 mt-[1px]"
                      style={{ background: `${accent}22`, color: accent }}
                    >
                      {p.phase}
                    </span>
                    <div className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
                      {p.detail}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Storage note */}
            <div
              className="rounded-xl px-5 py-4"
              style={{ background: `${accent}10`, border: `1px solid ${accent}28` }}
            >
              <div className="flex items-start gap-3">
                <LucideIcons.HardDrive size={16} strokeWidth={2} color={accent} className="shrink-0 mt-[2px]" />
                <div>
                  <div className="text-[13px] font-semibold mb-2" style={{ color: textPrimary }}>
                    Storage architecture — don’t forget
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {STORAGE_NOTE.map((n) => (
                      <li key={n} className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
                        — {n}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Back button */}
            <div>
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80 active:scale-[0.98]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
                  color: textPrimary,
                }}
              >
                <LucideIcons.ArrowLeft size={14} strokeWidth={2} />
                Back to System Administration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
