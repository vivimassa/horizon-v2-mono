'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, Clock, Link2, Timer, Repeat, GitBranch, HelpCircle, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useRecoveryConfigStore } from '@/stores/use-recovery-config-store'
import type { RecoveryConfig } from './recovery-config-panel'

const TOOLTIPS: Record<string, string> = {
  respectCurfews: 'Block arrivals during airport noise curfew windows. Uses curfew data from Airport master data.',
  connectionProtectionMinutes:
    'Minimum connection time between flights. Delays that break passenger connections are penalized more heavily.',
  maxCrewDutyHours: 'Maximum block hours per aircraft duty. Prevents unrealistically long duties.',
  maxSwapsPerAircraft: 'Maximum number of foreign flights an aircraft can pick up. 0 = unlimited.',
  propagationMultiplier:
    'Multiply delay cost by remaining rotation legs. Penalizes early-rotation delays that cascade downstream.',
  delayCostPerMinute: 'USD per pax per minute of delay. Industry avg: $15-50.',
  cancelCostPerFlight: 'Total cost of cancelling one flight.',
  fuelPricePerKg: 'Current jet fuel price per kg.',
  maxSolutions: 'Number of alternative recovery options to generate.',
  maxSolveSeconds: 'Maximum solver runtime.',
  minImprovementUsd: 'Filter solutions that differ by less than this amount.',
}

export function RecoveryParametersPanel({
  anchorRef,
  open,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  onClose: () => void
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const config = useRecoveryConfigStore((s) => s.config)
  const setConfig = useRecoveryConfigStore((s) => s.setConfig)

  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const [costOpen, setCostOpen] = useState(false)
  const [solverOpen, setSolverOpen] = useState(false)

  // Position below anchor button
  useEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const panelWidth = 380
    setPos({
      top: r.bottom + 6,
      left: Math.min(r.left, window.innerWidth - panelWidth - 16),
    })
  }, [open, anchorRef])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, anchorRef])

  if (!open) return null

  const text = isDark ? '#F5F2FD' : '#1C1C28'
  const muted = isDark ? '#8F90A6' : '#555770'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const accent = isDark ? '#5B8DEF' : '#1e40af'
  const panelBg = isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.97)'

  const activeConstraints = [
    config.respectCurfews,
    config.connectionProtectionMinutes > 0,
    config.maxCrewDutyHours > 0,
    config.maxSwapsPerAircraft > 0,
    config.propagationMultiplier > 1.0,
  ].filter(Boolean).length

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] rounded-xl select-none overflow-hidden"
      style={{
        top: pos.top,
        left: pos.left,
        width: 380,
        maxHeight: 'calc(100vh - 180px)',
        background: panelBg,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        backdropFilter: 'blur(24px)',
        boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
        <SlidersHorizontal size={15} style={{ color: accent }} />
        <span className="text-[14px] font-semibold" style={{ color: text }}>
          Solver Parameters
        </span>
      </div>

      <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        {/* ── Operational Constraints ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: muted }}>
              Operational Constraints
            </div>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background:
                  activeConstraints > 0
                    ? isDark
                      ? 'rgba(6,194,112,0.12)'
                      : 'rgba(6,194,112,0.08)'
                    : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                color: activeConstraints > 0 ? '#06C270' : muted,
              }}
            >
              {activeConstraints} of 5 active
            </span>
          </div>
          <div className="space-y-0.5">
            <ConstraintToggle
              icon={Clock}
              label="Airport curfews"
              description="Block arrivals during noise restriction hours"
              enabled={config.respectCurfews}
              onToggle={() => setConfig({ respectCurfews: !config.respectCurfews })}
              isDark={isDark}
              text={text}
              muted={muted}
              accent={accent}
            />
            <ConstraintToggle
              icon={Link2}
              label="Connection protection"
              description="Min connection time between flights"
              enabled={config.connectionProtectionMinutes > 0}
              onToggle={() =>
                setConfig({ connectionProtectionMinutes: config.connectionProtectionMinutes > 0 ? 0 : 45 })
              }
              value={config.connectionProtectionMinutes}
              onValueChange={(v) => setConfig({ connectionProtectionMinutes: v })}
              unit="min"
              min={15}
              max={180}
              step={5}
              isDark={isDark}
              text={text}
              muted={muted}
              accent={accent}
            />
            <ConstraintToggle
              icon={Timer}
              label="Max block hours"
              description="Cap block hours per aircraft duty"
              enabled={config.maxCrewDutyHours > 0}
              onToggle={() => setConfig({ maxCrewDutyHours: config.maxCrewDutyHours > 0 ? 0 : 12 })}
              value={config.maxCrewDutyHours}
              onValueChange={(v) => setConfig({ maxCrewDutyHours: v })}
              unit="hrs"
              min={4}
              max={20}
              step={0.5}
              isDark={isDark}
              text={text}
              muted={muted}
              accent={accent}
            />
            <ConstraintToggle
              icon={Repeat}
              label="Max swaps/aircraft"
              description="Limit reassignment complexity"
              enabled={config.maxSwapsPerAircraft > 0}
              onToggle={() => setConfig({ maxSwapsPerAircraft: config.maxSwapsPerAircraft > 0 ? 0 : 3 })}
              value={config.maxSwapsPerAircraft}
              onValueChange={(v) => setConfig({ maxSwapsPerAircraft: v })}
              unit=""
              min={1}
              max={10}
              step={1}
              isDark={isDark}
              text={text}
              muted={muted}
              accent={accent}
            />
            <ConstraintToggle
              icon={GitBranch}
              label="Delay propagation"
              description="Penalize early-rotation delays that cascade"
              enabled={config.propagationMultiplier > 1.0}
              onToggle={() => setConfig({ propagationMultiplier: config.propagationMultiplier > 1.0 ? 1.0 : 1.5 })}
              value={config.propagationMultiplier}
              onValueChange={(v) => setConfig({ propagationMultiplier: v })}
              unit="x"
              min={1.0}
              max={5.0}
              step={0.5}
              isDark={isDark}
              text={text}
              muted={muted}
              accent={accent}
            />
          </div>
        </div>

        {/* ── Cost Model (collapsible) ── */}
        <CollapsibleSection
          title="Cost Model"
          summary={`$${config.delayCostPerMinute}/min · $${(config.cancelCostPerFlight / 1000).toFixed(0)}k · $${config.fuelPricePerKg}/kg`}
          open={costOpen}
          onToggle={() => setCostOpen(!costOpen)}
          isDark={isDark}
          text={text}
          muted={muted}
          border={border}
        >
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <ParamInput
              label="Delay cost"
              unit="$/min"
              value={config.delayCostPerMinute}
              onChange={(v) => setConfig({ delayCostPerMinute: v })}
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
              unit="$/flt"
              value={config.cancelCostPerFlight}
              onChange={(v) => setConfig({ cancelCostPerFlight: v })}
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
              value={config.fuelPricePerKg}
              onChange={(v) => setConfig({ fuelPricePerKg: v })}
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
        </CollapsibleSection>

        {/* ── Solver (collapsible) ── */}
        <CollapsibleSection
          title="Solver"
          summary={`${config.maxSolutions} options · ${config.maxSolveSeconds}s · $${config.minImprovementUsd} min`}
          open={solverOpen}
          onToggle={() => setSolverOpen(!solverOpen)}
          isDark={isDark}
          text={text}
          muted={muted}
          border={border}
        >
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <ParamInput
              label="Solutions"
              unit=""
              value={config.maxSolutions}
              onChange={(v) => setConfig({ maxSolutions: v })}
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
              label="Timeout"
              unit="sec"
              value={config.maxSolveSeconds}
              onChange={(v) => setConfig({ maxSolveSeconds: v })}
              min={5}
              max={300}
              step={5}
              isDark={isDark}
              inputBg={inputBg}
              border={border}
              text={text}
              muted={muted}
            />
            <ParamInput
              label="Min impr."
              unit="$"
              value={config.minImprovementUsd}
              onChange={(v) => setConfig({ minImprovementUsd: v })}
              min={0}
              max={100000}
              step={500}
              isDark={isDark}
              inputBg={inputBg}
              border={border}
              text={text}
              muted={muted}
            />
          </div>
        </CollapsibleSection>
      </div>
    </div>,
    document.body,
  )
}

// ── Internal Components (same patterns as config panel) ──

function ConstraintToggle({
  icon: Icon,
  label,
  description,
  enabled,
  onToggle,
  value,
  onValueChange,
  unit,
  min,
  max,
  step,
  isDark,
  text,
  muted,
  accent,
}: {
  icon: LucideIcon
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
  value?: number
  onValueChange?: (v: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  isDark: boolean
  text: string
  muted: string
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <button
        onClick={onToggle}
        className="w-8 h-[18px] rounded-full shrink-0 transition-colors relative"
        style={{
          background: enabled ? accent : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        }}
      >
        <div
          className="w-3.5 h-3.5 rounded-full bg-white absolute top-[2px] transition-all"
          style={{ left: enabled ? 16 : 2 }}
        />
      </button>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: enabled
            ? isDark
              ? `${accent}20`
              : `${accent}10`
            : isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
        }}
      >
        <Icon size={14} color={enabled ? accent : muted} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium" style={{ color: enabled ? text : muted }}>
          {label}
        </div>
        <div className="text-[11px]" style={{ color: muted, opacity: 0.8 }}>
          {description}
        </div>
      </div>
      {value !== undefined && onValueChange && enabled && (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && min !== undefined && max !== undefined) onValueChange(Math.max(min, Math.min(max, v)))
            }}
            min={min}
            max={max}
            step={step}
            className="w-14 h-7 px-1.5 rounded-md text-[13px] tabular-nums text-center outline-none"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
              color: text,
            }}
          />
          {unit && (
            <span className="text-[11px]" style={{ color: muted }}>
              {unit}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  children,
  isDark,
  text,
  muted,
  border,
}: {
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  isDark: boolean
  text: string
  muted: string
  border: string
}) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center gap-2 py-1 text-left">
        <ChevronRight
          size={14}
          style={{ color: muted, transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none' }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: muted }}>
          {title}
        </span>
        {!open && (
          <span className="flex-1 text-right text-[11px] tabular-nums" style={{ color: muted, opacity: 0.7 }}>
            {summary}
          </span>
        )}
      </button>
      {open && (
        <div
          className="rounded-lg p-2.5 mt-1"
          style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', border: `1px solid ${border}` }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function ParamInput({
  label,
  unit,
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
  return (
    <div>
      <div className="text-[11px] font-medium mb-1" style={{ color: muted }}>
        {label}
        {unit && <span className="ml-0.5 opacity-60">({unit})</span>}
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
        className="w-full h-7 px-2 rounded-md text-[13px] tabular-nums outline-none transition-colors"
        style={{ background: inputBg, border: `1px solid ${border}`, color: text }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = isDark ? '#5B8DEF' : '#1e40af'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = border
        }}
      />
    </div>
  )
}
