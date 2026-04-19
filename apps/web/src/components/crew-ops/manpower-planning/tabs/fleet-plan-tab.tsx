'use client'

import { useMemo, useState } from 'react'
import { MONTHS } from '@skyhub/logic'
import { api, useInvalidateManpower } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import { useEngineCompute } from '../common/use-engine-compute'
import type { ManpowerEngineBundle } from '../manpower-planning-shell'

interface Props {
  bundle: ManpowerEngineBundle
  activePlanId: string
}

/** Fleet Plan tab — aircraft count per type × month, editable. Blank cells
 *  fall through to the default (schedule-derived or utilisation-based). */
export function FleetPlanTab({ bundle, activePlanId }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const { activeFleets } = useEngineCompute(bundle)
  const invalidate = useInvalidateManpower()

  const overrideByKey = useMemo(() => {
    const map = new Map<string, { id: string; acCount: number }>()
    for (const o of bundle.overrides) {
      map.set(`${o.aircraftTypeIcao}|${o.monthIndex}`, { id: o._id, acCount: o.acCount })
    }
    return map
  }, [bundle.overrides])

  const [busyKey, setBusyKey] = useState<string | null>(null)

  const commit = async (icao: string, monthIndex: number, raw: string) => {
    const key = `${icao}|${monthIndex}`
    setBusyKey(key)
    try {
      if (raw.trim() === '') {
        const existing = overrideByKey.get(key)
        if (existing) {
          await api.deleteManpowerFleetOverride(activePlanId, existing.id)
        }
      } else {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0) return
        await api.upsertManpowerFleetOverride(activePlanId, {
          aircraftTypeIcao: icao,
          monthIndex,
          planYear: bundle.year,
          acCount: Math.round(n),
        })
      }
      await invalidate.invalidatePlan(activePlanId)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="p-5 space-y-4">
      <header className="flex items-center gap-2">
        <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
        <h3 className="text-[15px] font-bold" style={{ color: palette.text }}>
          Fleet Plan — aircraft count per month
        </h3>
        <p className="ml-auto text-[13px]" style={{ color: palette.textTertiary }}>
          Blank cells use schedule / utilisation defaults.
        </p>
      </header>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF', border: `1px solid ${border}` }}
      >
        <div
          className="grid text-[13px] font-semibold uppercase tracking-wide"
          style={{
            gridTemplateColumns: '120px repeat(12, minmax(70px, 1fr))',
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            color: palette.textSecondary,
          }}
        >
          <div className="px-3 py-2">A/C Type</div>
          {MONTHS.map((m) => (
            <div key={m} className="px-3 py-2 text-center">
              {m}
            </div>
          ))}
        </div>
        {activeFleets.length === 0 && (
          <div className="px-3 py-8 text-center text-[13px]" style={{ color: palette.textTertiary }}>
            No fleet data available for this plan.
          </div>
        )}
        {activeFleets.map((icao) => {
          const defaults = bundle.monthlyAcCount[icao] ?? new Array(12).fill(0)
          return (
            <div
              key={icao}
              className="grid text-[13px] border-t"
              style={{
                gridTemplateColumns: '120px repeat(12, minmax(70px, 1fr))',
                borderColor: border,
                color: palette.text,
              }}
            >
              <div className="px-3 py-3 font-mono font-semibold">{icao}</div>
              {MONTHS.map((_m, mi) => {
                const key = `${icao}|${mi}`
                const override = overrideByKey.get(key)
                const def = defaults[mi] ?? 0
                return (
                  <div key={mi} className="px-1 py-1 text-center">
                    <input
                      type="number"
                      min={0}
                      defaultValue={override ? String(override.acCount) : ''}
                      placeholder={String(def)}
                      disabled={busyKey === key}
                      onBlur={(e) => {
                        if (e.currentTarget.value !== (override ? String(override.acCount) : '')) {
                          void commit(icao, mi, e.currentTarget.value)
                        }
                      }}
                      className="w-full h-9 px-2 text-[13px] text-center outline-none rounded-md"
                      style={{
                        background: override ? `${accent}1a` : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${override ? `${accent}66` : 'transparent'}`,
                        color: override ? accent : palette.textTertiary,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
