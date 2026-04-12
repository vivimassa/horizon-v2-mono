'use client'

import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

function fmtUtc(epochMs: number | null): string {
  if (!epochMs) return ''
  const d = new Date(epochMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Parse "HH:MM" to epoch ms on the flight's operating date */
function parseTimeToMs(hhmm: string, opDate: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  const dayMs = new Date(opDate + 'T00:00:00Z').getTime()
  return dayMs + h * 3_600_000 + min * 60_000
}

function varianceBadge(actual: number | null, scheduled: number): { text: string; color: string } | null {
  if (!actual) return null
  const diff = Math.round((actual - scheduled) / 60_000)
  if (diff === 0) return null
  return diff > 0 ? { text: `+${diff}m`, color: '#E63535' } : { text: `${diff}m`, color: '#22c55e' }
}

const OOOI = [
  { key: 'doorCloseUtc' as const, label: 'D.CLOSE', schedLabel: 'D.CLOSE' },
  { key: 'atdUtc' as const, label: 'ATD (OUT)', schedLabel: 'STD (OUT)' },
  { key: 'offUtc' as const, label: 'T/O (OFF)', schedLabel: 'T/O (OFF)' },
  { key: 'onUtc' as const, label: 'T/D (ON)', schedLabel: 'T/D (ON)' },
  { key: 'ataUtc' as const, label: 'ATA (IN)', schedLabel: 'STA (IN)' },
] as const

interface TimesTabProps {
  data: FlightDetail
  onUpdate: (updater: (d: FlightDetail) => void) => void
}

export function TimesTab({ data, onUpdate }: TimesTabProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const accent = 'var(--module-accent, #1e40af)'
  const muted = isDark ? '#8F90A6' : '#555770'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#fff'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const greenLine = '#22c55e'

  const scheduledMap: Record<string, number> = { atdUtc: data.stdUtc, ataUtc: data.staUtc }
  const nextIdx = OOOI.findIndex((p) => data.actual[p.key] == null)

  function handleTimeChange(key: (typeof OOOI)[number]['key'], value: string) {
    const ms = value ? parseTimeToMs(value, data.operatingDate) : null
    onUpdate((d) => {
      d.actual[key] = ms
    })
  }

  function handleDepInfoChange(field: 'terminal' | 'gate' | 'stand' | 'ctot', value: string) {
    onUpdate((d) => {
      d.depInfo[field] = value || null
    })
  }

  function handleArrInfoChange(field: 'terminal' | 'gate' | 'stand', value: string) {
    onUpdate((d) => {
      d.arrInfo[field] = value || null
    })
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Left column: Actual Times OOOI vertical timeline */}
      <div className="col-span-4 rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-[14px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: accent }}>
          Actual Times
        </h3>

        {/* label(96px) + gap(12px) + dot center(12px) = 120px */}
        <div className="relative">
          <div
            className="absolute w-[2px] top-[12px] bottom-[12px]"
            style={{ left: 119, background: nextIdx > 0 ? greenLine : cardBorder }}
          />

          <div className="space-y-4">
            {OOOI.map((phase, i) => {
              const val = data.actual[phase.key]
              const isComplete = val != null
              const isCurrent = i === nextIdx
              const displayLabel = isComplete ? phase.label : phase.schedLabel
              const scheduledRef = scheduledMap[phase.key]
              const variance = scheduledRef != null ? varianceBadge(val, scheduledRef) : null

              return (
                <div key={phase.key} className="flex items-center gap-3">
                  <span className="text-[13px] font-bold w-[96px] text-right shrink-0" style={{ color: muted }}>
                    {displayLabel}
                  </span>

                  <div className="w-[24px] h-[24px] flex items-center justify-center relative z-10">
                    {isComplete ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: '#22c55e', boxShadow: '0 0 10px rgba(34,197,94,0.35)' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 6l2.5 2.5L9.5 4"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    ) : isCurrent ? (
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ background: '#F59E0B', boxShadow: '0 0 10px rgba(245,158,11,0.35)' }}
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{
                          border: `2px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)'}`,
                          background: isDark ? '#1F1F28' : '#F2F2F5',
                        }}
                      />
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={fmtUtc(val)}
                    onChange={(e) => handleTimeChange(phase.key, e.target.value)}
                    className="w-[76px] h-[36px] text-center rounded-lg text-[15px] font-mono font-bold outline-none"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      color: isComplete ? textPrimary : `${muted}40`,
                    }}
                  />

                  {variance && (
                    <span
                      className="px-2 py-0.5 rounded-full text-white text-[13px] font-mono font-bold"
                      style={{ background: variance.color }}
                    >
                      {variance.text}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Middle column: Origin card */}
      <div
        className="col-span-4 rounded-2xl p-4 relative overflow-hidden"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <h3 className="text-[14px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: accent }}>
          Origin
        </h3>
        <div className="text-[16px] font-medium tracking-tight mb-4" style={{ color: textPrimary, minHeight: 44 }}>
          {data.depAirport?.name ?? data.depStation}
        </div>

        <StationInput
          label="Terminal"
          value={data.depInfo.terminal ?? ''}
          onChange={(v) => handleDepInfoChange('terminal', v)}
          inputBg={inputBg}
          inputBorder={inputBorder}
          muted={muted}
          text={textPrimary}
        />
        <StationInput
          label="Gate"
          value={data.depInfo.gate ?? ''}
          onChange={(v) => handleDepInfoChange('gate', v)}
          inputBg={inputBg}
          inputBorder={inputBorder}
          muted={muted}
          text={textPrimary}
        />
        <StationInput
          label="Stand"
          value={data.depInfo.stand ?? ''}
          onChange={(v) => handleDepInfoChange('stand', v)}
          inputBg={inputBg}
          inputBorder={inputBorder}
          muted={muted}
          text={textPrimary}
        />
        <StationInput
          label="CTOT"
          value={data.depInfo.ctot ?? ''}
          onChange={(v) => handleDepInfoChange('ctot', v)}
          inputBg={inputBg}
          inputBorder={inputBorder}
          muted={muted}
          text={textPrimary}
          placeholder="HH:MM"
        />

        <span
          className="absolute bottom-0 right-2 z-0 text-[80px] font-mono font-black tracking-tighter leading-none select-none pointer-events-none"
          style={{ color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
        >
          {data.depStation}
        </span>
      </div>

      {/* Right column: Destination card */}
      <div
        className="col-span-4 rounded-2xl p-4 relative overflow-hidden"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <h3 className="text-[14px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: accent }}>
          Destination
        </h3>
        <div className="text-[16px] font-medium tracking-tight mb-4" style={{ color: textPrimary, minHeight: 44 }}>
          {data.arrAirport?.name ?? data.arrStation}
        </div>

        <StationInput
          label="Terminal"
          value={data.arrInfo.terminal ?? ''}
          onChange={(v) => handleArrInfoChange('terminal', v)}
          inputBg={inputBg}
          inputBorder={inputBorder}
          muted={muted}
          text={textPrimary}
        />
        <StationInput
          label="Gate"
          value={data.arrInfo.gate ?? ''}
          onChange={(v) => handleArrInfoChange('gate', v)}
          inputBg={inputBg}
          inputBorder={inputBorder}
          muted={muted}
          text={textPrimary}
        />
        <StationInput
          label="Stand"
          value={data.arrInfo.stand ?? ''}
          onChange={(v) => handleArrInfoChange('stand', v)}
          inputBg={inputBg}
          inputBorder={inputBorder}
          muted={muted}
          text={textPrimary}
        />

        <span
          className="absolute bottom-0 right-2 z-0 text-[80px] font-mono font-black tracking-tighter leading-none select-none pointer-events-none"
          style={{ color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
        >
          {data.arrStation}
        </span>
      </div>
    </div>
  )
}

function StationInput({
  label,
  value,
  onChange,
  placeholder,
  inputBg,
  inputBorder,
  muted,
  text,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputBg: string
  inputBorder: string
  muted: string
  text: string
}) {
  return (
    <div className="flex items-center gap-3 mb-3 relative z-10">
      <span className="text-[13px] font-bold uppercase w-[72px] text-right shrink-0" style={{ color: muted }}>
        {label}
      </span>
      <input
        type="text"
        placeholder={placeholder ?? '—'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[120px] h-[36px] text-center rounded-lg text-[15px] font-bold outline-none"
        style={{
          background: inputBg,
          border: `1px solid ${inputBorder}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          color: value ? text : `${muted}50`,
        }}
      />
    </div>
  )
}
