'use client'

import { CheckCircle, XCircle, Clock, DollarSign, Users, ArrowRight } from 'lucide-react'

export interface RecoverySolution {
  id: string
  label: string
  summary: string
  metrics: {
    totalDelayMinutes: number
    flightsChanged: number
    cancellations: number
    estimatedCostImpact: number
    estimatedRevenueProtected: number
    paxAffected: number
  }
  assignments: Array<{
    flightId: string
    fromReg: string | null
    toReg: string
    newStdUtc: number | null
    reason: string
  }>
}

export function RecoverySolutionsPanel({
  solutions,
  selectedIndex,
  onSelect,
  onApply,
  applying,
  isDark,
}: {
  solutions: RecoverySolution[]
  selectedIndex: number
  onSelect: (i: number) => void
  onApply: () => void
  applying: boolean
  isDark: boolean
}) {
  const text = isDark ? '#F5F2FD' : '#1C1C28'
  const muted = isDark ? '#8F90A6' : '#555770'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const accent = isDark ? '#5B8DEF' : '#1e40af'

  if (solutions.length === 0) {
    return (
      <div className="text-center py-12 text-[13px]" style={{ color: muted }}>
        No solutions found. Try adjusting parameters.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: muted }}>
        Recovery Options ({solutions.length})
      </div>

      {/* Solution cards */}
      <div className="grid grid-cols-1 gap-3">
        {solutions.map((sol, i) => {
          const active = i === selectedIndex
          const m = {
            totalDelayMinutes: sol.metrics?.totalDelayMinutes ?? 0,
            flightsChanged: sol.metrics?.flightsChanged ?? 0,
            cancellations: sol.metrics?.cancellations ?? 0,
            estimatedCostImpact: sol.metrics?.estimatedCostImpact ?? 0,
            estimatedRevenueProtected: sol.metrics?.estimatedRevenueProtected ?? 0,
            paxAffected: sol.metrics?.paxAffected ?? 0,
          }
          return (
            <button
              key={sol.id}
              onClick={() => onSelect(i)}
              className="text-left rounded-xl p-4 transition-all duration-150"
              style={{
                background: active ? (isDark ? 'rgba(91,141,239,0.08)' : 'rgba(30,64,175,0.04)') : 'transparent',
                border: `1.5px solid ${active ? accent : border}`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[15px] font-semibold" style={{ color: active ? accent : text }}>
                  {sol.label}
                </span>
                {active && <CheckCircle size={16} color={accent} />}
              </div>
              <div className="text-[13px] mb-3" style={{ color: muted }}>
                {sol.summary}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MetricCell
                  icon={ArrowRight}
                  label="Changed"
                  value={String(m.flightsChanged)}
                  color={m.flightsChanged > 0 ? '#FF8800' : '#06C270'}
                  muted={muted}
                />
                <MetricCell
                  icon={XCircle}
                  label="Cancelled"
                  value={String(m.cancellations)}
                  color={m.cancellations > 0 ? '#E63535' : '#06C270'}
                  muted={muted}
                />
                <MetricCell
                  icon={Clock}
                  label="Delay"
                  value={`${m.totalDelayMinutes}min`}
                  color={m.totalDelayMinutes > 60 ? '#FF8800' : '#06C270'}
                  muted={muted}
                />
                <MetricCell
                  icon={DollarSign}
                  label="Cost"
                  value={`$${Math.abs(m.estimatedCostImpact).toLocaleString()}`}
                  color={m.estimatedCostImpact < 0 ? '#E63535' : '#06C270'}
                  muted={muted}
                />
                <MetricCell
                  icon={DollarSign}
                  label="Rev Protected"
                  value={`$${m.estimatedRevenueProtected.toLocaleString()}`}
                  color="#06C270"
                  muted={muted}
                />
                <MetricCell
                  icon={Users}
                  label="Pax Affected"
                  value={String(m.paxAffected)}
                  color={m.paxAffected > 0 ? '#FF8800' : '#06C270'}
                  muted={muted}
                />
              </div>

              {/* Assignment details (expanded for selected) */}
              {active && sol.assignments.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${border}` }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>
                    Assignments ({sol.assignments.length})
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {sol.assignments.map((a) => (
                      <div
                        key={a.flightId}
                        className="flex items-center gap-2 text-[12px] py-1 px-2 rounded-md"
                        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                      >
                        <span className="font-mono font-medium" style={{ color: text }}>
                          {a.flightId.split('|')[0]?.slice(-6)}
                        </span>
                        <span style={{ color: muted }}>{a.fromReg ?? '—'}</span>
                        <ArrowRight size={10} style={{ color: muted }} />
                        <span className="font-medium" style={{ color: accent }}>
                          {a.toReg}
                        </span>
                        <span className="flex-1 text-right truncate" style={{ color: muted }}>
                          {a.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Apply button */}
      <button
        onClick={onApply}
        disabled={applying || solutions.length === 0}
        className="w-full h-11 rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: '#06C270' }}
      >
        <CheckCircle size={16} />
        {applying ? 'Applying...' : `Apply ${solutions[selectedIndex]?.label ?? 'Solution'}`}
      </button>
    </div>
  )
}

function MetricCell({
  icon: Icon,
  label,
  value,
  color,
  muted,
}: {
  icon: typeof Clock
  label: string
  value: string
  color: string
  muted: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={12} color={color} />
      <div>
        <div className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {value}
        </div>
        <div className="text-[10px]" style={{ color: muted }}>
          {label}
        </div>
      </div>
    </div>
  )
}
