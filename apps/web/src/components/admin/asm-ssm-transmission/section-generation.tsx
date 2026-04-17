'use client'

/**
 * 7.1.5.1 Generation & Release section.
 *
 * Two adjacent concerns:
 *   - Generation: ASM/SSM on/off, trigger points, allowed message types,
 *     priority. Stored in OperatorMessagingConfig.asmSsm.generation.
 *   - Auto-Release: the background sweep that moves held → fan-out queue.
 *     Structurally identical to 7.1.5.2's scheduler block.
 *
 * Form primitives (Toggle, FormRow, etc.) come from
 * apps/web/src/components/admin/_shared/form-primitives.tsx so this
 * section looks identical to 7.1.5.2 scheduler.
 */

import { Check, HelpCircle, X } from 'lucide-react'
import type { AsmSsmActionCode } from '@skyhub/api'
import { HelpBlock, FormRow, SectionCard, Toggle, RangeStepper } from '@/components/admin/_shared/form-primitives'
import { Tooltip } from '@/components/ui/tooltip'

/** Draft for the Generation & Release section. Persisted to
 *  OperatorMessagingConfig.asmSsm on Save. */
export interface GenerationDraft {
  generation: {
    asmEnabled: boolean
    ssmEnabled: boolean
    triggerOnCommit: boolean
    triggerOnPlaygroundCommit: boolean
    messageTypeAllow: AsmSsmActionCode[]
    priority: 'high' | 'medium' | 'low'
  }
  autoRelease: {
    enabled: boolean
    intervalMin: number
    ageGateMin: number
    actionAllow: AsmSsmActionCode[]
  }
}

export const DEFAULT_GENERATION_DRAFT: GenerationDraft = {
  generation: {
    asmEnabled: true,
    ssmEnabled: true,
    triggerOnCommit: true,
    triggerOnPlaygroundCommit: false,
    messageTypeAllow: ['NEW', 'CNL', 'TIM', 'EQT', 'RRT'],
    priority: 'high',
  },
  autoRelease: {
    enabled: false,
    intervalMin: 5,
    ageGateMin: 2,
    actionAllow: ['TIM'],
  },
}

// Only codes the diff engine + IATA formatter + inbound apply actually support.
// Unsupported (CON, RPL, FLT, SKD, ADM) were removed 2026-04-17 — they appeared
// in the UI but produced no outbound messages and silently dropped on inbound.
// Re-add as the codegen catches up.
const TYPE_CATALOG: Array<{ key: AsmSsmActionCode; meaning: string }> = [
  { key: 'NEW', meaning: 'New Flight — add a flight to the schedule' },
  { key: 'CNL', meaning: 'Cancellation — remove a scheduled flight' },
  { key: 'TIM', meaning: 'Time Change — adjust STD / STA without route change' },
  { key: 'EQT', meaning: 'Equipment Change — swap aircraft type' },
  { key: 'RRT', meaning: 'Re-route — change departure or arrival station' },
  { key: 'RIN', meaning: 'Reinstatement — restore a previously cancelled flight' },
]

export function GenerationSection({
  draft,
  setDraft,
  accent,
  isDark,
}: {
  draft: GenerationDraft
  setDraft: React.Dispatch<React.SetStateAction<GenerationDraft>>
  accent: string
  isDark: boolean
}) {
  const patchGen = (p: Partial<GenerationDraft['generation']>) =>
    setDraft((prev) => ({ ...prev, generation: { ...prev.generation, ...p } }))
  const patchAuto = (p: Partial<GenerationDraft['autoRelease']>) =>
    setDraft((prev) => ({ ...prev, autoRelease: { ...prev.autoRelease, ...p } }))

  const toggleMsgType = (k: AsmSsmActionCode) => {
    patchGen({
      messageTypeAllow: draft.generation.messageTypeAllow.includes(k)
        ? draft.generation.messageTypeAllow.filter((x) => x !== k)
        : [...draft.generation.messageTypeAllow, k],
    })
  }
  const toggleReleaseAction = (k: AsmSsmActionCode) => {
    patchAuto({
      actionAllow: draft.autoRelease.actionAllow.includes(k)
        ? draft.autoRelease.actionAllow.filter((x) => x !== k)
        : [...draft.autoRelease.actionAllow, k],
    })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* ─── Left: Generation rules ─── */}
      <SectionCard title="Generation rules" subtitle="What the diff engine may emit">
        <HelpBlock>
          Controls when the scenario-vs-production diff engine emits held ASM / SSM messages. Types outside the
          allowlist are suppressed entirely.
        </HelpBlock>

        <FormRow label="Generate ASM" description="Ad-hoc schedule messages — specific-date, flight-level changes.">
          <Toggle checked={draft.generation.asmEnabled} onChange={(v) => patchGen({ asmEnabled: v })} accent={accent} />
        </FormRow>

        <FormRow label="Generate SSM" description="Standard schedule messages — seasonal pattern changes (date-range).">
          <Toggle checked={draft.generation.ssmEnabled} onChange={(v) => patchGen({ ssmEnabled: v })} accent={accent} />
        </FormRow>

        <FormRow
          label="Trigger on schedule commit"
          description="Emit messages automatically when a schedule edit is applied to production."
        >
          <Toggle
            checked={draft.generation.triggerOnCommit}
            onChange={(v) => patchGen({ triggerOnCommit: v })}
            accent={accent}
          />
        </FormRow>

        <FormRow
          label="Trigger on playground commit"
          description="Also emit when a What-If scenario is committed to the live system."
        >
          <Toggle
            checked={draft.generation.triggerOnPlaygroundCommit}
            onChange={(v) => patchGen({ triggerOnPlaygroundCommit: v })}
            accent={accent}
          />
        </FormRow>

        <FormRow
          label="Priority"
          description="IATA priority flag carried on every generated message. Most airlines use High."
        >
          <PrioritySelector
            value={draft.generation.priority}
            onChange={(v) => patchGen({ priority: v })}
            accent={accent}
            isDark={isDark}
          />
        </FormRow>

        <FormRow
          label="Allowed message types"
          description="Only these action codes will be generated. Hover a code to see its meaning."
          stacked
        >
          <div className="flex flex-wrap gap-1.5">
            {TYPE_CATALOG.map((a) => (
              <CodeChip
                key={a.key}
                code={a.key}
                meaning={a.meaning}
                active={draft.generation.messageTypeAllow.includes(a.key)}
                onClick={() => toggleMsgType(a.key)}
                isDark={isDark}
              />
            ))}
          </div>
        </FormRow>
      </SectionCard>

      {/* ─── Right: Auto-release ─── */}
      <SectionCard title="Auto-release scheduler" subtitle="Hands-off release of held messages">
        <HelpBlock>
          Periodically sweeps held messages and pushes them into consumer delivery. Leave disabled if your team prefers
          manual release from the Held Queue tab.
        </HelpBlock>

        <FormRow label="Enabled" description="Arms the background sweep for this operator.">
          <Toggle
            checked={draft.autoRelease.enabled}
            onChange={(v) => patchAuto({ enabled: v })}
            accent={accent}
            danger
          />
        </FormRow>

        <FormRow label="Interval" description="Time between sweeps (2–30 min).">
          <RangeStepper
            value={draft.autoRelease.intervalMin}
            onChange={(v) => patchAuto({ intervalMin: v })}
            min={2}
            max={30}
            suffix="m"
            accent={accent}
          />
        </FormRow>

        <FormRow
          label="Review window"
          description="Messages must have been held at least this long before auto-release may release them."
        >
          <RangeStepper
            value={draft.autoRelease.ageGateMin}
            onChange={(v) => patchAuto({ ageGateMin: v })}
            min={0}
            max={60}
            suffix="m"
            accent={accent}
          />
        </FormRow>

        <FormRow
          label="Auto-release types"
          description="Only these codes may auto-release. Everything else requires manual review."
          stacked
        >
          <div className="flex flex-wrap gap-1.5">
            {TYPE_CATALOG.filter((t) => draft.generation.messageTypeAllow.includes(t.key)).map((a) => (
              <CodeChip
                key={a.key}
                code={a.key}
                meaning={a.meaning}
                active={draft.autoRelease.actionAllow.includes(a.key)}
                onClick={() => toggleReleaseAction(a.key)}
                isDark={isDark}
              />
            ))}
          </div>
        </FormRow>
      </SectionCard>
    </div>
  )
}

/**
 * Compact action-code chip. Displays the 3-letter code; hovering (or
 * keyboard-focusing) the chip reveals the meaning in a tooltip. The `?`
 * icon is a visual cue that info is available; the whole chip is the
 * hover target (easier to aim for).
 */
function CodeChip({
  code,
  meaning,
  active,
  onClick,
  isDark,
}: {
  code: string
  meaning: string
  active: boolean
  onClick: () => void
  isDark: boolean
}) {
  return (
    <Tooltip content={`${code} — ${meaning}`}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={`${code} — ${meaning}`}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold font-mono tracking-wide transition-colors"
        style={{
          background: active ? 'rgba(6,194,112,0.12)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(96,97,112,0.06)',
          border: `1px solid ${active ? 'rgba(6,194,112,0.32)' : 'transparent'}`,
          color: active ? '#06C270' : 'var(--color-hz-text-secondary)',
        }}
      >
        {active ? <Check size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} className="opacity-60" />}
        <span>{code}</span>
        <HelpCircle size={11} className="opacity-50" strokeWidth={1.8} />
      </button>
    </Tooltip>
  )
}

function PrioritySelector({
  value,
  onChange,
  accent,
  isDark,
}: {
  value: 'high' | 'medium' | 'low'
  onChange: (v: 'high' | 'medium' | 'low') => void
  accent: string
  isDark: boolean
}) {
  const options: Array<{ key: 'high' | 'medium' | 'low'; label: string }> = [
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ]
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--color-hz-border)' }}
    >
      {options.map((o, i) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="h-10 px-4 text-[13px] font-medium transition-colors"
            style={{
              background: active ? accent : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              color: active ? '#fff' : 'var(--color-hz-text-secondary)',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-hz-border)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
