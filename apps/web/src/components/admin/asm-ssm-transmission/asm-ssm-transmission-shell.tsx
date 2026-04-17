'use client'

/**
 * 7.1.5.1 ASM/SSM Transmission — admin shell.
 *
 * Mirrors 7.1.5.2 ACARS/MVT/LDM Transmission (transmission-config-shell.tsx).
 * Same MasterDetailLayout + sidebar + hero + section-body pattern. Uses the
 * System Administration accent (warm amber) because this screen lives under
 * the sysadmin module, not the operator's branding scope.
 *
 *   generation — Generation & Release (form, persists to OperatorMessagingConfig.asmSsm)
 *   consumers  — Delivery directory CRUD (pull_api / sftp / smtp)
 *   held       — Held queue with bulk Release / Discard
 *   log        — Delivery log with per-consumer status
 *
 * The Save / Reset Section buttons only appear on the `generation` section —
 * the other three sections manage their own state via direct API calls.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Clock,
  Inbox,
  Loader2,
  PauseCircle,
  RotateCcw,
  Save,
  Check,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { api, type OperatorMessagingConfig, type AsmSsmConfigUpsert } from '@skyhub/api'
import { MODULE_THEMES } from '@skyhub/constants'
import { accentTint, colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { MasterDetailLayout } from '@/components/layout'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { collapseDock } from '@/lib/dock-store'
import { GenerationHero, ConsumersHero, HeldQueueHero, DeliveryLogHero } from './section-heroes'
import { GenerationSection, type GenerationDraft, DEFAULT_GENERATION_DRAFT } from './section-generation'
import { ConsumersSection } from './section-consumers'
import { HeldQueueSection } from './section-held'
import { DeliveryLogSection } from './section-log'

const ADMIN_ACCENT = MODULE_THEMES.sysadmin.accent

type SectionKey = 'generation' | 'consumers' | 'held' | 'log'

interface SectionDef {
  key: SectionKey
  label: string
  desc: string
  icon: LucideIcon
}

const SECTIONS: SectionDef[] = [
  { key: 'generation', label: 'Generation & Release', desc: 'What fires, and when', icon: Clock },
  { key: 'consumers', label: 'Consumers', desc: 'Where messages are delivered', icon: Users },
  { key: 'held', label: 'Held Queue', desc: 'Pre-send review & release', icon: PauseCircle },
  { key: 'log', label: 'Delivery Log', desc: 'Per-consumer audit trail', icon: ClipboardList },
]

function configToDraft(cfg: OperatorMessagingConfig | null): GenerationDraft {
  if (!cfg?.asmSsm) return DEFAULT_GENERATION_DRAFT
  return {
    generation: {
      ...DEFAULT_GENERATION_DRAFT.generation,
      ...(cfg.asmSsm.generation ?? {}),
    },
    autoRelease: {
      ...DEFAULT_GENERATION_DRAFT.autoRelease,
      ...(cfg.asmSsm.autoRelease ?? {}),
    },
  }
}

function draftToUpsert(operatorId: string, d: GenerationDraft): AsmSsmConfigUpsert {
  return {
    generation: d.generation,
    autoRelease: d.autoRelease,
  }
}

export function AsmSsmTransmissionShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const accent = ADMIN_ACCENT

  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])

  useEffect(() => {
    collapseDock()
  }, [])

  const [config, setConfig] = useState<OperatorMessagingConfig | null>(null)
  const [draft, setDraft] = useState<GenerationDraft>(DEFAULT_GENERATION_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('generation')

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getOperatorMessagingConfig(operator._id)
      .then((doc) => {
        if (!alive) return
        setConfig(doc)
        setDraft(configToDraft(doc))
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load config'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [operator?._id])

  const hasDraft = useMemo(() => JSON.stringify(draft) !== JSON.stringify(configToDraft(config)), [draft, config])

  const handleSave = useCallback(async () => {
    if (!operator?._id || !hasDraft) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await api.upsertOperatorMessagingConfig({
        operatorId: operator._id,
        asmSsm: draftToUpsert(operator._id, draft),
      })
      setConfig(updated)
      setDraft(configToDraft(updated))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [operator?._id, hasDraft, draft])

  const handleResetSection = useCallback(() => {
    setDraft(DEFAULT_GENERATION_DRAFT)
  }, [])

  if (!operator?._id) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[14px] text-hz-text-secondary">Loading operator…</span>
      </div>
    )
  }

  return (
    <MasterDetailLayout
      left={
        <Sidebar
          sections={SECTIONS}
          activeSection={activeSection}
          onSelect={setActiveSection}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
      }
      center={
        <Center
          activeSection={activeSection}
          operatorId={operator._id}
          draft={draft}
          setDraft={setDraft}
          onSave={handleSave}
          onResetSection={handleResetSection}
          saving={saving}
          saved={saved}
          hasDraft={hasDraft}
          error={error}
          setError={setError}
          loading={loading}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />
      }
    />
  )
}

/* ── Sidebar ────────────────────────────────────────────────────── */

function Sidebar({
  sections,
  activeSection,
  onSelect,
  palette,
  isDark,
  accent,
}: {
  sections: SectionDef[]
  activeSection: SectionKey
  onSelect: (key: SectionKey) => void
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-hz-border shrink-0">
        <h2 className="text-[15px] font-bold text-hz-text">Transmission</h2>
        <p className="text-[13px] text-hz-text-secondary mt-0.5">ASM / SSM configuration</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon
            const active = activeSection === section.key
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onSelect(section.key)}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 ${
                  active
                    ? 'border-l-[3px] bg-module-accent/[0.08]'
                    : 'border-l-[3px] border-l-transparent hover:bg-hz-border/30'
                }`}
                style={active ? { borderLeftColor: accent } : undefined}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: active
                      ? accentTint(accent, isDark ? 0.18 : 0.1)
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <Icon size={16} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium" style={active ? { color: accent } : undefined}>
                    {section.label}
                  </div>
                  <div className="text-[13px] text-hz-text-secondary truncate">{section.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Center ─────────────────────────────────────────────────────── */

function Center({
  activeSection,
  operatorId,
  draft,
  setDraft,
  onSave,
  onResetSection,
  saving,
  saved,
  hasDraft,
  error,
  setError,
  loading,
  palette,
  isDark,
  accent,
}: {
  activeSection: SectionKey
  operatorId: string
  draft: GenerationDraft
  setDraft: React.Dispatch<React.SetStateAction<GenerationDraft>>
  onSave: () => void
  onResetSection: () => void
  saving: boolean
  saved: boolean
  hasDraft: boolean
  error: string | null
  setError: (e: string | null) => void
  loading: boolean
  palette: PaletteType
  isDark: boolean
  accent: string
}) {
  const section = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0]
  const Icon = section.icon
  const showSaveBar = activeSection === 'generation'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hz-border shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1 h-6 rounded-full shrink-0" style={{ background: accent }} />
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: accentTint(accent, isDark ? 0.15 : 0.08) }}
          >
            <Icon size={18} color={accent} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold text-hz-text leading-tight">{section.label}</h1>
            <p className="text-[13px] text-hz-text-secondary mt-0.5">{section.desc}</p>
          </div>
        </div>
        {showSaveBar && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onResetSection}
              className="h-9 px-3 rounded-lg text-[13px] font-medium text-hz-text-tertiary hover:opacity-80 flex items-center gap-1.5"
            >
              <RotateCcw size={13} /> Reset section
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !hasDraft}
              className="flex items-center gap-2 px-4 h-9 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: saved ? '#16a34a' : accent }}
            >
              {saved ? <Check size={14} strokeWidth={2.5} /> : <Save size={14} strokeWidth={1.8} />}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="mx-6 mt-3 px-4 py-2.5 rounded-xl border flex items-center justify-between"
          style={{
            borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fecaca',
            backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2',
            color: '#EF4444',
          }}
        >
          <span className="text-[13px]">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[13px] text-hz-text-tertiary">
            Dismiss
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-hz-text-secondary" />
          </div>
        ) : (
          <>
            <SectionHero section={activeSection} accent={accent} isDark={isDark} />
            {activeSection === 'generation' && (
              <GenerationSection draft={draft} setDraft={setDraft} accent={accent} isDark={isDark} />
            )}
            {activeSection === 'consumers' && (
              <ConsumersSection
                operatorId={operatorId}
                accent={accent}
                isDark={isDark}
                palette={palette}
                onError={setError}
              />
            )}
            {activeSection === 'held' && (
              <HeldQueueSection
                operatorId={operatorId}
                accent={accent}
                isDark={isDark}
                palette={palette}
                onError={setError}
              />
            )}
            {activeSection === 'log' && (
              <DeliveryLogSection
                operatorId={operatorId}
                accent={accent}
                isDark={isDark}
                palette={palette}
                onError={setError}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SectionHero({ section, accent, isDark }: { section: SectionKey; accent: string; isDark: boolean }) {
  switch (section) {
    case 'generation':
      return <GenerationHero accent={accent} isDark={isDark} />
    case 'consumers':
      return <ConsumersHero accent={accent} isDark={isDark} />
    case 'held':
      return <HeldQueueHero accent={accent} isDark={isDark} />
    case 'log':
      return <DeliveryLogHero accent={accent} isDark={isDark} />
  }
}

// draftToUpsert is a pure helper; keep the import-less version out of the module surface.
void draftToUpsert
