'use client'

import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import { positionColor } from '../common/position-colors'
import { useEngineCompute } from '../common/use-engine-compute'
import type { ManpowerEngineBundle } from '../manpower-planning-shell'

interface Props {
  bundle: ManpowerEngineBundle
}

export function GapAnalysisTab({ bundle }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const { months, positions, required, available, gap } = useEngineCompute(bundle)

  return (
    <div className="p-5 space-y-5">
      <header className="flex items-center gap-2">
        <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
        <h3 className="text-[15px] font-bold" style={{ color: palette.text }}>
          Gap Analysis — Available − Required
        </h3>
      </header>

      {/* Heatmap */}
      <section
        className="rounded-xl overflow-hidden"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
          border: `1px solid ${border}`,
        }}
      >
        <div
          className="grid text-[13px] font-semibold uppercase tracking-wide"
          style={{
            gridTemplateColumns: '140px repeat(12, minmax(70px, 1fr))',
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            color: palette.textSecondary,
          }}
        >
          <div className="px-3 py-2">Position</div>
          {months.map((m) => (
            <div key={m} className="px-3 py-2 text-center">
              {m}
            </div>
          ))}
        </div>
        {gap.map((row) => (
          <div
            key={row.position}
            className="grid text-[13px] border-t"
            style={{
              gridTemplateColumns: '140px repeat(12, minmax(70px, 1fr))',
              borderColor: border,
              color: palette.text,
            }}
          >
            <div className="px-3 py-3 flex items-center gap-2 font-medium">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: positionColor(row.positionCode, row.positionColor) }}
              />
              {row.positionCode} — {row.position}
            </div>
            {row.cells.map((c) => {
              const sev = c.gap < 0 ? 'red' : c.gap === 0 ? 'amber' : 'green'
              const bg =
                sev === 'red'
                  ? isDark
                    ? 'rgba(230,53,53,0.18)'
                    : 'rgba(230,53,53,0.10)'
                  : sev === 'amber'
                    ? isDark
                      ? 'rgba(255,136,0,0.14)'
                      : 'rgba(255,136,0,0.08)'
                    : isDark
                      ? 'rgba(6,194,112,0.14)'
                      : 'rgba(6,194,112,0.08)'
              const fg = sev === 'red' ? '#E63535' : sev === 'amber' ? '#FF8800' : '#06C270'
              return (
                <div
                  key={c.monthIndex}
                  className="px-3 py-2 text-center font-mono font-semibold"
                  style={{ background: bg, color: fg }}
                  title={`${row.position} · ${c.month}: avail ${c.available} − req ${c.required} = ${c.gap}`}
                >
                  {c.gap > 0 ? '+' : ''}
                  {c.gap}
                </div>
              )
            })}
          </div>
        ))}
      </section>

      {/* Raw avail / req detail */}
      <section
        className="rounded-xl overflow-hidden"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
          border: `1px solid ${border}`,
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: border }}>
          <h4 className="text-[15px] font-bold" style={{ color: palette.text }}>
            Available / Required
          </h4>
        </div>
        <div
          className="grid text-[13px] font-semibold uppercase tracking-wide"
          style={{
            gridTemplateColumns: '140px repeat(12, minmax(70px, 1fr))',
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            color: palette.textSecondary,
          }}
        >
          <div className="px-3 py-2">Position</div>
          {months.map((m) => (
            <div key={m} className="px-3 py-2 text-center">
              {m}
            </div>
          ))}
        </div>
        {positions.map((p) => {
          const reqArr = required[p.name] ?? []
          const availArr = available[p.name] ?? []
          return (
            <div
              key={p.id}
              className="grid text-[13px] border-t"
              style={{
                gridTemplateColumns: '140px repeat(12, minmax(70px, 1fr))',
                borderColor: border,
                color: palette.text,
              }}
            >
              <div className="px-3 py-3 font-medium flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: positionColor(p.code, p.color) }}
                />
                {p.code} — {p.name}
              </div>
              {months.map((_m, mi) => (
                <div key={mi} className="px-2 py-2 text-center font-mono">
                  <div>{availArr[mi] ?? 0}</div>
                  <div style={{ color: palette.textTertiary }}>/ {reqArr[mi] ?? 0}</div>
                </div>
              ))}
            </div>
          )
        })}
      </section>
    </div>
  )
}
