'use client'

/**
 * 4.1.5.4 Pairing Configurations — admin shell.
 *
 * Mirrors the MasterDetailLayout + sectioned sidebar + center body pattern
 * used by 7.1.5.2 ACARS/MVT/LDM Transmission. Operator-wide SOFT rules for
 * pairing construction — not FDTL, not regulatory. Warnings surface in the
 * Pairing Inspector legality strip once rules evaluate against a chain.
 *
 * Current rules:
 *   - Minimum ground time on aircraft change, parameterised by dom/intl of
 *     the incoming / outgoing flight.
 *
 * Persists to `OperatorPairingConfig` via /operator-pairing-config.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Plane, RotateCcw, Save, type LucideIcon } from 'lucide-react'
import { api, type OperatorPairingConfig, type OperatorPairingConfigUpsert } from '@skyhub/api'
import { MODULE_THEMES } from '@skyhub/constants'
import { accentTint, colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { MasterDetailLayout } from '@/components/layout'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore } from '@/stores/use-operator-store'
import { collapseDock } from '@/lib/dock-store'
import { HelpBlock, FormRow } from '@/components/admin/_shared/form-primitives'
import { AircraftChangeHero } from './section-heroes'

/** 4.1.5.x lives under the Workforce / Crew-Ops module. Use the shared
 *  workforce accent so the screen matches the Pairing Gantt / Text workspaces
 *  instead of inheriting the System Administration amber. */
const MODULE_ACCENT = MODULE_THEMES.workforce.accent

type SectionKey = 'aircraft-change'

interface SectionDef {
  key: SectionKey
  label: string
  desc: string
  icon: LucideIcon
}

const SECTIONS: SectionDef[] = [
  {
    key: 'aircraft-change',
    label: 'Aircraft Change Ground Time',
    desc: 'Minimum turnaround when the tail changes between legs',
    icon: Plane,
  },
]

/* ── Draft state & defaults ─────────────────────────────────────── */

interface Draft {
  aircraftChangeGroundTime: {
    domToDomMin: number
    domToIntlMin: number
    intlToDomMin: number
    intlToIntlMin: number
  }
}

const DEFAULT_DRAFT: Draft = {
  aircraftChangeGroundTime: {
    domToDomMin: 45,
    domToIntlMin: 60,
    intlToDomMin: 60,
    intlToIntlMin: 75,
  },
}

function configToDraft(cfg: OperatorPairingConfig | null): Draft {
  if (!cfg) return DEFAULT_DRAFT
  return {
    aircraftChangeGroundTime: {
      ...DEFAULT_DRAFT.aircraftChangeGroundTime,
      ...(cfg.aircraftChangeGroundTime ?? {}),
    },
  }
}

function draftToUpsert(operatorId: string, d: Draft): OperatorPairingConfigUpsert {
  return { operatorId, aircraftChangeGroundTime: d.aircraftChangeGroundTime }
}

/* ── Shell ──────────────────────────────────────────────────────── */

export function PairingConfigShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const accent = MODULE_ACCENT

  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])

  useEffect(() => {
    collapseDock()
  }, [])

  const [config, setConfig] = useState<OperatorPairingConfig | null>(null)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('aircraft-change')

  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getOperatorPairingConfig(operator._id)
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
      const updated = await api.upsertOperatorPairingConfig(draftToUpsert(operator._id, draft))
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

  const handleResetSection = useCallback((section: SectionKey) => {
    setDraft((prev) => {
      const next = { ...prev }
      if (section === 'aircraft-change') {
        next.aircraftChangeGroundTime = { ...DEFAULT_DRAFT.aircraftChangeGroundTime }
      }
      return next
    })
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
        <h2 className="text-[15px] font-bold text-hz-text">Pairing Configurations</h2>
        <p className="text-[13px] text-hz-text-secondary mt-0.5">Operator-wide soft rules for pairing construction</p>
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
  isDark,
  accent,
}: {
  activeSection: SectionKey
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  onSave: () => void
  onResetSection: (s: SectionKey) => void
  saving: boolean
  saved: boolean
  hasDraft: boolean
  error: string | null
  setError: (e: string | null) => void
  loading: boolean
  isDark: boolean
  accent: string
}) {
  const section = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0]
  const Icon = section.icon

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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onResetSection(section.key)}
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
            <SectionBody section={activeSection} draft={draft} setDraft={setDraft} isDark={isDark} accent={accent} />
          </>
        )}
      </div>
    </div>
  )
}

function SectionHero({ section, accent, isDark }: { section: SectionKey; accent: string; isDark: boolean }) {
  switch (section) {
    case 'aircraft-change':
      return <AircraftChangeHero accent={accent} isDark={isDark} />
  }
}

/* ── Section bodies ─────────────────────────────────────────────── */

function SectionBody({
  section,
  draft,
  setDraft,
  isDark,
  accent,
}: {
  section: SectionKey
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  isDark: boolean
  accent: string
}) {
  const patchGround = (p: Partial<Draft['aircraftChangeGroundTime']>) =>
    setDraft((prev) => ({
      ...prev,
      aircraftChangeGroundTime: { ...prev.aircraftChangeGroundTime, ...p },
    }))

  switch (section) {
    case 'aircraft-change':
      return (
        <div className="max-w-2xl">
          <HelpBlock>
            Minimum ground time when the aircraft (tail) changes between two consecutive legs of a pairing. Applied as a
            soft rule — chains that fall below the threshold surface a warning in the Pairing Inspector. Values depend
            on the domestic / international character of the incoming and outgoing flights. Type in free-text (
            <code className="font-mono">1:30</code>, <code className="font-mono">1h30m</code>,{' '}
            <code className="font-mono">90</code>, <code className="font-mono">90m</code>) — parsed to HH:MM on blur.
          </HelpBlock>

          <FormRow label="Domestic → Domestic" description="Both legs operate between domestic airports.">
            <DurationInput
              value={draft.aircraftChangeGroundTime.domToDomMin}
              onChange={(v) => patchGround({ domToDomMin: v })}
              isDark={isDark}
              accent={accent}
            />
          </FormRow>

          <FormRow
            label="Domestic → International"
            description="Incoming leg is domestic; outgoing leg is international."
          >
            <DurationInput
              value={draft.aircraftChangeGroundTime.domToIntlMin}
              onChange={(v) => patchGround({ domToIntlMin: v })}
              isDark={isDark}
              accent={accent}
            />
          </FormRow>

          <FormRow
            label="International → Domestic"
            description="Incoming leg is international; outgoing leg is domestic."
          >
            <DurationInput
              value={draft.aircraftChangeGroundTime.intlToDomMin}
              onChange={(v) => patchGround({ intlToDomMin: v })}
              isDark={isDark}
              accent={accent}
            />
          </FormRow>

          <FormRow
            label="International → International"
            description="Both legs operate between international airports."
          >
            <DurationInput
              value={draft.aircraftChangeGroundTime.intlToIntlMin}
              onChange={(v) => patchGround({ intlToIntlMin: v })}
              isDark={isDark}
              accent={accent}
            />
          </FormRow>
        </div>
      )
  }
}

/* ── DurationInput — free-text HH:MM parser ─────────────────────── */

/** Canonical HH:MM display for a minute count (e.g. 90 → "1:30"). */
function formatHHMM(totalMin: number): string {
  const m = Math.max(0, Math.floor(totalMin))
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}

/**
 * Parse a free-text duration into minutes. Accepts any of:
 *   "1:30"    → 90
 *   "1h30m"   → 90
 *   "1h 30"   → 90
 *   "1.5h"    → 90
 *   "90"      → 90 (bare number = minutes)
 *   "90m"     → 90
 *   "2h"      → 120
 * Returns null for unparseable input so the caller can keep the previous value.
 */
function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null

  // HH:MM form
  const colon = s.match(/^(\d+)\s*:\s*(\d{1,2})$/)
  if (colon) {
    const h = parseInt(colon[1], 10)
    const m = parseInt(colon[2], 10)
    if (m >= 60) return null
    return h * 60 + m
  }

  // Hours + minutes form — covers "1h30m", "1h 30", "1.5h", "2h", "45m"
  const hm = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?)?$/)
  if (hm && (hm[1] || hm[2])) {
    const hours = hm[1] ? parseFloat(hm[1]) : 0
    const mins = hm[2] ? parseInt(hm[2], 10) : 0
    const total = Math.round(hours * 60 + mins)
    return Number.isFinite(total) && total >= 0 ? total : null
  }

  // Bare integer = minutes
  const bare = s.match(/^(\d+)$/)
  if (bare) return parseInt(bare[1], 10)

  return null
}

function DurationInput({
  value,
  onChange,
  isDark,
  accent,
}: {
  /** Current value in minutes. */
  value: number
  /** Called with the new value in minutes whenever a valid parse succeeds. */
  onChange: (minutes: number) => void
  isDark: boolean
  accent: string
}) {
  // Local string state so the user can type freely; canonicalise to HH:MM on blur.
  const [text, setText] = useState<string>(formatHHMM(value))
  const [error, setError] = useState<boolean>(false)

  // Re-sync when the external value changes (e.g. reset section, load).
  useEffect(() => {
    setText(formatHHMM(value))
    setError(false)
  }, [value])

  const bg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(96,97,112,0.08)'
  const border = error ? '#E63535' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const commit = () => {
    const parsed = parseDuration(text)
    if (parsed == null || parsed > 1440) {
      setError(true)
      // Snap back to last valid value on blur so state stays consistent.
      setText(formatHHMM(value))
      setTimeout(() => setError(false), 1200)
      return
    }
    onChange(parsed)
    setText(formatHHMM(parsed))
  }

  return (
    <input
      type="text"
      inputMode="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      placeholder="0:00"
      className="h-10 px-3 rounded-lg text-[13px] font-mono tabular-nums text-hz-text outline-none transition-colors w-[120px] text-right"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: error ? `0 0 0 2px ${accent}00` : undefined,
      }}
      aria-label="Duration in hours and minutes"
      title='Accepts "1:30", "1h30m", "1.5h", "90", "90m"'
    />
  )
}
