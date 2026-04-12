'use client'

import { useState } from 'react'
import {
  Crosshair,
  Clock,
  Zap,
  DollarSign,
  Shield,
  TrendingUp,
  HelpCircle,
  Scale,
  SlidersHorizontal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Types ──

export interface RecoveryConfig {
  // Objective
  objective: 'min_delay' | 'min_cancel' | 'min_cost' | 'max_revenue' | 'custom'
  objectiveWeights: { delay: number; cost: number; cancel: number; revenue: number } | null

  // Recovery window
  horizonHours: number
  lockThresholdMinutes: number
  maxDelayPerFlightMinutes: number
  referenceTimeUtc: string

  // Constraints (configured via toolbar Parameters panel)
  respectCurfews: boolean
  connectionProtectionMinutes: number
  maxCrewDutyHours: number
  maxSwapsPerAircraft: number
  propagationMultiplier: number

  // Cost model (configured via toolbar Parameters panel)
  delayCostPerMinute: number
  cancelCostPerFlight: number
  fuelPricePerKg: number

  // Solver settings (configured via toolbar Parameters panel)
  maxSolutions: number
  maxSolveSeconds: number
  minImprovementUsd: number
}

// ── Constants ──

interface ObjectiveOption {
  key: RecoveryConfig['objective']
  label: string
  icon: LucideIcon
  color: string
}

const OBJECTIVES: ObjectiveOption[] = [
  { key: 'min_delay', label: 'Min Delay', icon: Clock, color: '#FF8800' },
  { key: 'min_cancel', label: 'Min Cancel', icon: Shield, color: '#E63535' },
  { key: 'min_cost', label: 'Min Cost', icon: DollarSign, color: '#06C270' },
  { key: 'max_revenue', label: 'Max Revenue', icon: TrendingUp, color: '#0063F7' },
  { key: 'custom', label: 'Custom', icon: Scale, color: '#AC5DD9' },
]

const TOOLTIPS: Record<string, string> = {
  horizonHours: 'How far ahead the solver looks. Flights beyond this window keep their current assignment.',
  lockThresholdMinutes:
    'Flights departing within this many minutes are locked — crew is reporting, ground handling committed.',
  maxDelayPerFlightMinutes: 'Maximum minutes each individual flight can be delayed. 0 = swap-only, no retiming.',
  referenceTimeUtc: 'Override "now" for testing. Leave empty for live operations.',
}

// ── Main Component ──

export function RecoveryConfigPanel({
  config,
  onChange,
  onSolve,
  solving,
  isDark,
}: {
  config: RecoveryConfig
  onChange: (patch: Partial<RecoveryConfig>) => void
  onSolve: () => void
  solving: boolean
  isDark: boolean
}) {
  const text = isDark ? '#F5F2FD' : '#1C1C28'
  const muted = isDark ? '#8F90A6' : '#555770'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const accent = isDark ? '#5B8DEF' : '#1e40af'

  // Build constraint summary chips
  const constraintChips: string[] = []
  if (config.respectCurfews) constraintChips.push('Curfews')
  if (config.connectionProtectionMinutes > 0) constraintChips.push(`${config.connectionProtectionMinutes}min MCT`)
  if (config.maxCrewDutyHours > 0) constraintChips.push(`${config.maxCrewDutyHours}h duty`)
  if (config.maxSwapsPerAircraft > 0) constraintChips.push(`${config.maxSwapsPerAircraft} swaps`)
  if (config.propagationMultiplier > 1.0) constraintChips.push(`${config.propagationMultiplier}x prop`)

  return (
    <div className="space-y-5">
      {/* ── Objective ── */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>
          Recovery Objective
        </div>
        <div className="grid grid-cols-5 gap-2">
          {OBJECTIVES.map((obj) => {
            const active = config.objective === obj.key
            const Icon = obj.icon
            return (
              <button
                key={obj.key}
                onClick={() => {
                  onChange({
                    objective: obj.key,
                    objectiveWeights:
                      obj.key === 'custom'
                        ? (config.objectiveWeights ?? { delay: 25, cost: 25, cancel: 25, revenue: 25 })
                        : null,
                  })
                }}
                className="flex flex-col items-center text-center p-3 rounded-xl transition-all duration-150"
                style={{
                  background: active ? (isDark ? `${obj.color}15` : `${obj.color}08`) : 'transparent',
                  border: `1.5px solid ${active ? obj.color : border}`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all duration-200"
                  style={{
                    background: active ? `${obj.color}20` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    boxShadow: active ? `0 4px 12px ${obj.color}30` : 'none',
                  }}
                >
                  <Icon size={20} color={active ? obj.color : muted} strokeWidth={1.5} />
                </div>
                <div className="text-[13px] font-semibold" style={{ color: active ? obj.color : text }}>
                  {obj.label}
                </div>
              </button>
            )
          })}
        </div>

        {/* Blend sliders — shown when Custom selected */}
        {config.objective === 'custom' && (
          <div
            className="mt-3 p-3 rounded-lg grid grid-cols-2 gap-x-6 gap-y-2.5"
            style={{
              background: isDark ? 'rgba(172,93,217,0.06)' : 'rgba(172,93,217,0.04)',
              border: `1px solid ${border}`,
            }}
          >
            {(['delay', 'cost', 'cancel', 'revenue'] as const).map((key) => {
              const labels = { delay: 'Delay', cost: 'Cost', cancel: 'Cancel', revenue: 'Revenue' }
              const clrs = { delay: '#FF8800', cost: '#06C270', cancel: '#E63535', revenue: '#0063F7' }
              const w = config.objectiveWeights ?? { delay: 25, cost: 25, cancel: 25, revenue: 25 }
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-14 text-[11px] font-medium shrink-0" style={{ color: clrs[key] }}>
                    {labels[key]}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={w[key]}
                    onChange={(e) => {
                      const newVal = parseInt(e.target.value)
                      const updated = normalizeWeights(w, key, newVal)
                      onChange({ objectiveWeights: updated })
                    }}
                    className="flex-1 h-1.5 accent-current"
                    style={{ accentColor: clrs[key] }}
                  />
                  <span className="w-8 text-[13px] font-semibold tabular-nums text-right" style={{ color: clrs[key] }}>
                    {w[key]}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Recovery Window ── */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>
          Recovery Window
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ParamInput
            label="Horizon"
            unit="hours"
            tooltip={TOOLTIPS.horizonHours}
            value={config.horizonHours}
            onChange={(v) => onChange({ horizonHours: v })}
            min={1}
            max={72}
            step={1}
            isDark={isDark}
            inputBg={inputBg}
            border={border}
            text={text}
            muted={muted}
          />
          <ParamInput
            label="Lock threshold"
            unit="min"
            tooltip={TOOLTIPS.lockThresholdMinutes}
            value={config.lockThresholdMinutes}
            onChange={(v) => onChange({ lockThresholdMinutes: v })}
            min={0}
            max={360}
            step={5}
            isDark={isDark}
            inputBg={inputBg}
            border={border}
            text={text}
            muted={muted}
          />
          <ParamInput
            label="Max delay/flight"
            unit="min"
            tooltip={TOOLTIPS.maxDelayPerFlightMinutes}
            value={config.maxDelayPerFlightMinutes}
            onChange={(v) => onChange({ maxDelayPerFlightMinutes: v })}
            min={0}
            max={180}
            step={5}
            isDark={isDark}
            inputBg={inputBg}
            border={border}
            text={text}
            muted={muted}
          />
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[11px] font-medium" style={{ color: muted }}>
              Reference time (UTC)
            </span>
            <TooltipIcon tooltip={TOOLTIPS.referenceTimeUtc} muted={muted} />
          </div>
          <input
            type="datetime-local"
            value={config.referenceTimeUtc}
            onChange={(e) => onChange({ referenceTimeUtc: e.target.value })}
            className="w-full h-8 px-2.5 rounded-lg text-[13px] tabular-nums outline-none transition-colors"
            style={{ background: inputBg, border: `1px solid ${border}`, color: text }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = accent
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = border
            }}
          />
        </div>
      </div>

      {/* ── Active Constraint Summary ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          border: `1px solid ${border}`,
        }}
      >
        <SlidersHorizontal size={13} className="shrink-0" style={{ color: muted }} />
        {constraintChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 flex-1">
            {constraintChips.map((chip) => (
              <span
                key={chip}
                className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  background: isDark ? 'rgba(91,141,239,0.10)' : 'rgba(30,64,175,0.06)',
                  color: accent,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px]" style={{ color: muted }}>
            No constraints active
          </span>
        )}
        <span className="text-[11px] shrink-0" style={{ color: muted, opacity: 0.6 }}>
          via Parameters
        </span>
      </div>

      {/* ── Solve Button ── */}
      <button
        onClick={onSolve}
        disabled={solving}
        className="w-full h-11 rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: accent }}
      >
        {solving ? (
          <>
            <Zap size={16} className="animate-pulse" /> Solving...
          </>
        ) : (
          <>
            <Crosshair size={16} /> Run Recovery Solver
          </>
        )}
      </button>
    </div>
  )
}

// ── Helpers ──

function TooltipIcon({ tooltip, muted }: { tooltip: string; muted: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block">
      <button className="shrink-0" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        <HelpCircle size={12} style={{ color: muted, opacity: 0.5 }} />
      </button>
      {show && (
        <div
          className="absolute z-50 left-4 top-0 p-2.5 rounded-lg text-[12px] leading-relaxed"
          style={{
            background: '#1C1C28',
            color: '#F5F2FD',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            maxWidth: 260,
            width: 240,
          }}
        >
          {tooltip}
        </div>
      )}
    </span>
  )
}

function ParamInput({
  label,
  unit,
  tooltip,
  value,
  onChange,
  min,
  max,
  step,
  isDark,
  inputBg,
  border,
  text,
  muted,
}: {
  label: string
  unit?: string
  tooltip?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  isDark: boolean
  inputBg: string
  border: string
  text: string
  muted: string
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  return (
    <div className="relative">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[11px] font-medium" style={{ color: muted }}>
          {label}
          {unit && <span className="ml-0.5 opacity-60">({unit})</span>}
        </span>
        {tooltip && (
          <button
            className="shrink-0"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <HelpCircle size={12} style={{ color: muted, opacity: 0.5 }} />
          </button>
        )}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
        }}
        min={min}
        max={max}
        step={step}
        className="w-full h-8 px-2.5 rounded-lg text-[13px] tabular-nums outline-none transition-colors"
        style={{ background: inputBg, border: `1px solid ${border}`, color: text }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = isDark ? '#5B8DEF' : '#1e40af'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = border
        }}
      />
      {showTooltip && tooltip && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 p-2.5 rounded-lg text-[12px] leading-relaxed"
          style={{
            background: isDark ? '#2A2A36' : '#1C1C28',
            color: '#F5F2FD',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            maxWidth: 260,
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}

function normalizeWeights(
  current: { delay: number; cost: number; cancel: number; revenue: number },
  changed: keyof typeof current,
  newValue: number,
): { delay: number; cost: number; cancel: number; revenue: number } {
  const others = (['delay', 'cost', 'cancel', 'revenue'] as const).filter((k) => k !== changed)
  const remaining = 100 - newValue
  const otherSum = others.reduce((s, k) => s + current[k], 0)

  const result = { ...current, [changed]: newValue }
  if (otherSum > 0) {
    for (const k of others) result[k] = Math.round((current[k] / otherSum) * remaining)
  } else {
    const each = Math.round(remaining / others.length)
    for (const k of others) result[k] = each
  }

  const sum = result.delay + result.cost + result.cancel + result.revenue
  if (sum !== 100) result[others[others.length - 1]] += 100 - sum
  return result
}
