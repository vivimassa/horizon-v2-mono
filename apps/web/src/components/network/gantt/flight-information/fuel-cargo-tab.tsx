"use client"

import { Fuel, Package } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

type FuelKey = 'initial' | 'uplift' | 'burn' | 'flightPlan'

const FUEL_FIELDS: { key: FuelKey; label: string; computed: boolean; hint?: string }[] = [
  { key: 'initial', label: 'Initial', computed: false },
  { key: 'uplift', label: 'Uplift', computed: false },
  { key: 'initial', label: 'Ramp', computed: true, hint: 'Initial + Uplift' },
  { key: 'burn', label: 'Burn', computed: false },
  { key: 'burn', label: 'Shutdown', computed: true, hint: 'Ramp \u2212 Burn' },
  { key: 'flightPlan', label: 'Flight Plan', computed: false },
]

const CARGO_CATEGORIES = ['Baggage', 'Cargo', 'Mail'] as const

interface FuelCargoTabProps {
  data: FlightDetail
  onUpdate: (updater: (d: FlightDetail) => void) => void
}

export function FuelCargoTab({ data, onUpdate }: FuelCargoTabProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const muted = isDark ? '#8F90A6' : '#555770'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = 'var(--module-accent, #1e40af)'
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#fff'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const fuel = data.fuel ?? { initial: null, uplift: null, burn: null, flightPlan: null }
  const ramp = (fuel.initial ?? 0) + (fuel.uplift ?? 0)
  const shutdown = ramp - (fuel.burn ?? 0)

  function updateFuel(key: FuelKey, value: number | null) {
    onUpdate(d => {
      if (!d.fuel) d.fuel = { initial: null, uplift: null, burn: null, flightPlan: null }
      d.fuel[key] = value
    })
  }

  // Ensure cargo array has the 3 categories
  const cargoMap = new Map(data.cargo.map(c => [c.category, c]))

  function updateCargo(category: string, field: 'weight' | 'pieces', value: number | null) {
    onUpdate(d => {
      const existing = d.cargo.find(c => c.category === category)
      if (existing) {
        existing[field] = value
      } else {
        d.cargo.push({ category, weight: field === 'weight' ? value : null, pieces: field === 'pieces' ? value : null })
      }
    })
  }

  const totalWeight = CARGO_CATEGORIES.reduce((sum, cat) => sum + (cargoMap.get(cat)?.weight ?? 0), 0)
  const totalPieces = CARGO_CATEGORIES.reduce((sum, cat) => sum + (cargoMap.get(cat)?.pieces ?? 0), 0)

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Fuel */}
      <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Fuel size={14} style={{ color: accent }} />
          <h3 className="text-[14px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>Fuel</h3>
        </div>
        <div className="space-y-3">
          {FUEL_FIELDS.map((f) => {
            const isRamp = f.label === 'Ramp'
            const isShutdown = f.label === 'Shutdown'
            const computedValue = isRamp ? ramp : isShutdown ? shutdown : null
            const currentValue = f.computed ? computedValue : fuel[f.key]

            return (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-[100px] text-right shrink-0 flex items-center justify-end gap-1">
                  <span className="text-[14px] font-medium" style={{ color: f.computed ? textPrimary : muted, fontWeight: f.computed ? 700 : 500 }}>
                    {f.label}
                  </span>
                  {f.hint && (
                    <span className="relative group">
                      <span
                        className="w-[16px] h-[16px] rounded-full flex items-center justify-center cursor-help shrink-0"
                        style={{ background: `${accent}15`, color: accent, fontSize: 10, fontWeight: 700 }}
                      >?</span>
                      <span
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        style={{
                          background: isDark ? 'rgba(244,244,245,0.95)' : 'rgba(28,28,40,0.92)',
                          color: isDark ? '#18181b' : '#fafafa',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                      >{f.hint}</span>
                    </span>
                  )}
                </div>
                {f.computed ? (
                  <div className="flex-1 h-[40px] flex items-center justify-center rounded-lg text-[15px] font-mono font-bold"
                    style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', border: `1px dashed ${inputBorder}`, color: currentValue ? textPrimary : `${muted}40` }}>
                    {currentValue || '—'}
                  </div>
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={currentValue ?? ''}
                    onChange={e => updateFuel(f.key, e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="—"
                    className="flex-1 h-[40px] text-center rounded-lg text-[15px] font-mono font-bold outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: currentValue != null ? textPrimary : `${muted}40` }}
                  />
                )}
                <span className="text-[13px] font-mono w-[24px] shrink-0" style={{ color: `${muted}50` }}>kg</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cargo & Load */}
      <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Package size={14} style={{ color: accent }} />
          <h3 className="text-[14px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>Cargo & Load</h3>
        </div>
        {/* Headers */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          <div />
          <div className="text-[13px] font-bold uppercase text-center" style={{ color: muted }}>Weight</div>
          <div className="text-[13px] font-bold uppercase text-center" style={{ color: muted }}>Pieces</div>
        </div>
        {CARGO_CATEGORIES.map(cat => {
          const item = cargoMap.get(cat)
          return (
            <div key={cat} className="grid grid-cols-3 gap-3 mb-2 items-center">
              <span className="text-[13px] font-medium" style={{ color: textPrimary }}>{cat}</span>
              <input
                type="number"
                min={0}
                value={item?.weight ?? ''}
                onChange={e => updateCargo(cat, 'weight', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="—"
                className="h-[36px] text-center rounded-lg text-[14px] font-mono font-bold outline-none"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: item?.weight != null ? textPrimary : `${muted}40` }}
              />
              <input
                type="number"
                min={0}
                value={item?.pieces ?? ''}
                onChange={e => updateCargo(cat, 'pieces', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="—"
                className="h-[36px] text-center rounded-lg text-[14px] font-mono font-bold outline-none"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: item?.pieces != null ? textPrimary : `${muted}40` }}
              />
            </div>
          )
        })}
        {/* Totals */}
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
          <div className="grid grid-cols-3 gap-3 items-center">
            <span className="text-[13px] font-bold" style={{ color: textPrimary }}>Total</span>
            <div className="text-center text-[15px] font-mono font-bold" style={{ color: totalWeight ? textPrimary : `${muted}40` }}>
              {totalWeight || '—'}
            </div>
            <div className="text-center text-[15px] font-mono font-bold" style={{ color: totalPieces ? textPrimary : `${muted}40` }}>
              {totalPieces || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
