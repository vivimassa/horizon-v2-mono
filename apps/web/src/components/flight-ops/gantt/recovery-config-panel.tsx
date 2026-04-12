'use client'

import { useState } from 'react'
import { Crosshair, Clock, Zap, DollarSign, Shield, TrendingUp, HelpCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface RecoveryConfig {
  objective: 'min_delay' | 'min_cancel' | 'min_cost' | 'max_revenue'
  horizonHours: number
  lockThresholdMinutes: number
  maxSolutions: number
  maxSolveSeconds: number
  delayCostPerMinute: number
  cancelCostPerFlight: number
  fuelPricePerKg: number
  referenceTimeUtc: string // ISO datetime — "now" override for testing. Empty = real now.
}

interface ObjectiveOption {
  key: RecoveryConfig['objective']
  label: string
  desc: string
  icon: LucideIcon
  color: string
}

const OBJECTIVES: ObjectiveOption[] = [
  {
    key: 'min_delay',
    label: 'Min Delay',
    desc: 'Minimize total delay across all affected flights',
    icon: Clock,
    color: '#FF8800',
  },
  {
    key: 'min_cancel',
    label: 'Min Cancel',
    desc: 'Avoid flight cancellations at all costs',
    icon: Shield,
    color: '#E63535',
  },
  {
    key: 'min_cost',
    label: 'Min Cost',
    desc: 'Minimize total operational cost impact',
    icon: DollarSign,
    color: '#06C270',
  },
  {
    key: 'max_revenue',
    label: 'Max Revenue',
    desc: 'Protect highest-revenue flights first',
    icon: TrendingUp,
    color: '#0063F7',
  },
]

const PARAM_TOOLTIPS: Record<string, string> = {
  horizonHours:
    'How far ahead the solver looks for recovery options. Flights beyond this window keep their current assignment. Shorter = faster solve, longer = better solutions.',
  lockThresholdMinutes:
    'Flights departing within this many minutes from now are locked and cannot be reassigned. Crew is already reporting, ground handling committed.',
  maxSolutions:
    'Number of alternative recovery options to generate. Each option has different trade-offs (delay vs cost vs cancellations).',
  maxSolveSeconds:
    'Maximum time the solver will run before returning the best solutions found. Longer = potentially better solutions.',
  delayCostPerMinute:
    'Estimated cost per passenger per minute of delay. Used to calculate the financial impact of delaying flights. Industry avg: $15-50.',
  cancelCostPerFlight:
    'Estimated total cost of cancelling one flight (rebooking, compensation, lost revenue). Varies by route and load.',
  fuelPricePerKg:
    'Current jet fuel price per kilogram. Used to calculate operating cost differences when swapping aircraft types.',
  referenceTimeUtc:
    'Override the current time for testing. The solver uses this instead of "now" to classify flights as departed/available/frozen. Leave empty for live operations.',
}

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

  return (
    <div className="space-y-5">
      {/* Objective selector — 4 in a row */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>
          Recovery Objective
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {OBJECTIVES.map((obj) => {
            const active = config.objective === obj.key
            const Icon = obj.icon
            return (
              <button
                key={obj.key}
                onClick={() => onChange({ objective: obj.key })}
                className="flex flex-col items-center text-center p-4 rounded-xl transition-all duration-150"
                style={{
                  background: active ? (isDark ? `${obj.color}15` : `${obj.color}08`) : 'transparent',
                  border: `1.5px solid ${active ? obj.color : border}`,
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-all duration-200"
                  style={{
                    background: active ? `${obj.color}20` : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    boxShadow: active ? `0 4px 16px ${obj.color}30` : 'none',
                  }}
                >
                  <Icon size={28} color={active ? obj.color : muted} strokeWidth={1.4} />
                </div>
                <div className="text-[14px] font-semibold mb-1" style={{ color: active ? obj.color : text }}>
                  {obj.label}
                </div>
                <div className="text-[11px] leading-snug" style={{ color: muted }}>
                  {obj.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Parameters */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>
          Parameters
        </div>
        <div className="grid grid-cols-4 gap-3">
          <ParamInput
            label="Horizon"
            unit="hours"
            tooltip={PARAM_TOOLTIPS.horizonHours}
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
            tooltip={PARAM_TOOLTIPS.lockThresholdMinutes}
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
            label="Max solutions"
            tooltip={PARAM_TOOLTIPS.maxSolutions}
            value={config.maxSolutions}
            onChange={(v) => onChange({ maxSolutions: v })}
            min={1}
            max={5}
            step={1}
            isDark={isDark}
            inputBg={inputBg}
            border={border}
            text={text}
            muted={muted}
          />
          <ParamInput
            label="Solve timeout"
            unit="sec"
            tooltip={PARAM_TOOLTIPS.maxSolveSeconds}
            value={config.maxSolveSeconds}
            onChange={(v) => onChange({ maxSolveSeconds: v })}
            min={5}
            max={300}
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
            <TooltipIcon tooltip={PARAM_TOOLTIPS.referenceTimeUtc} muted={muted} />
          </div>
          <input
            type="datetime-local"
            value={config.referenceTimeUtc}
            onChange={(e) => onChange({ referenceTimeUtc: e.target.value })}
            className="w-full h-8 px-2.5 rounded-lg text-[13px] tabular-nums outline-none transition-colors"
            style={{ background: inputBg, border: `1px solid ${border}`, color: text }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = isDark ? '#5B8DEF' : '#1e40af'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = border
            }}
          />
        </div>
      </div>

      {/* Cost weights */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>
          Cost Weights
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ParamInput
            label="Delay cost"
            unit="$/pax/min"
            tooltip={PARAM_TOOLTIPS.delayCostPerMinute}
            value={config.delayCostPerMinute}
            onChange={(v) => onChange({ delayCostPerMinute: v })}
            min={0}
            max={500}
            step={1}
            isDark={isDark}
            inputBg={inputBg}
            border={border}
            text={text}
            muted={muted}
          />
          <ParamInput
            label="Cancel cost"
            unit="$/flight"
            tooltip={PARAM_TOOLTIPS.cancelCostPerFlight}
            value={config.cancelCostPerFlight}
            onChange={(v) => onChange({ cancelCostPerFlight: v })}
            min={0}
            max={200000}
            step={1000}
            isDark={isDark}
            inputBg={inputBg}
            border={border}
            text={text}
            muted={muted}
          />
          <ParamInput
            label="Fuel price"
            unit="$/kg"
            tooltip={PARAM_TOOLTIPS.fuelPricePerKg}
            value={config.fuelPricePerKg}
            onChange={(v) => onChange({ fuelPricePerKg: v })}
            min={0}
            max={5}
            step={0.01}
            isDark={isDark}
            inputBg={inputBg}
            border={border}
            text={text}
            muted={muted}
          />
        </div>
      </div>

      {/* Solve button */}
      <button
        onClick={onSolve}
        disabled={solving}
        className="w-full h-11 rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: isDark ? '#5B8DEF' : '#1e40af' }}
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
      {/* Tooltip */}
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
