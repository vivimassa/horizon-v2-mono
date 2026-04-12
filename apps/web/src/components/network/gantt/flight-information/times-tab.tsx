'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

function fmtUtc(epochMs: number | null): string {
  if (!epochMs) return ''
  const d = new Date(epochMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Parse "HH:MM" to epoch ms on the same UTC date as the reference time (STD).
 *  This handles day offsets correctly — if STD is on April 12 due to offset,
 *  the entered time is placed on April 12 too, not the operating date. */
function parseTimeToMs(hhmm: string, _opDate: string, refUtcMs?: number): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  // Use the UTC date of the reference time (STD) so day offsets are respected
  const refDate = refUtcMs ? new Date(refUtcMs) : new Date(_opDate + 'T00:00:00Z')
  const dayMs = Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate())
  return dayMs + h * 3_600_000 + min * 60_000
}

function varianceBadge(actual: number | null, scheduled: number): { text: string; color: string } | null {
  if (!actual) return null
  const totalMin = Math.round((actual - scheduled) / 60_000)
  if (totalMin === 0) return null
  const sign = totalMin > 0 ? '+' : '-'
  const abs = Math.abs(totalMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const text = h > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}` : `${sign}0:${String(m).padStart(2, '0')}`
  return { text, color: totalMin > 0 ? '#E63535' : '#22c55e' }
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

  function handleActualChange(key: (typeof OOOI)[number]['key'], value: string) {
    const ms = value ? parseTimeToMs(value, data.operatingDate, data.stdUtc) : null
    onUpdate((d) => {
      d.actual[key] = ms
    })
  }

  function handleEstimatedChange(key: 'etdUtc' | 'etaUtc', value: string) {
    const ref = key === 'etdUtc' ? data.stdUtc : data.staUtc
    const ms = value ? parseTimeToMs(value, data.operatingDate, ref) : null
    onUpdate((d) => {
      d.estimated = { ...d.estimated, [key]: ms }
    })
  }

  // For backwards compat — keep the old name used by OooiRow
  const handleTimeChange = handleActualChange

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

  // Estimated times from FlightDetail
  const etd = data.estimated?.etdUtc ?? null
  const eta = data.estimated?.etaUtc ?? null

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '5fr 3.5fr 3.5fr' }}>
      {/* Left column: OOOI timeline with estimated + actual */}
      <div className="rounded-2xl p-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: accent }}>
          Movement Times
        </h3>

        <div className="space-y-2">
          {/* D.CLOSE — actual only */}
          <TimeRow
            label="D.CLOSE"
            actualValue={data.actual.doorCloseUtc}
            onActualChange={(v) => handleActualChange('doorCloseUtc', v)}
            isComplete={data.actual.doorCloseUtc != null}
            isCurrent={nextIdx === 0}
            isPending={nextIdx < 0 || nextIdx > 0}
            opDate={data.operatingDate}
            refUtcMs={data.stdUtc}
            isDark={isDark}
            muted={muted}
            textPrimary={textPrimary}
            inputBg={inputBg}
            inputBorder={inputBorder}
          />

          {/* DEP (OUT) — estimated + actual */}
          <TimeRow
            label="DEP (OUT)"
            estimatedLabel="ETD"
            estimatedValue={etd}
            onEstimatedChange={(v) => handleEstimatedChange('etdUtc', v)}
            actualValue={data.actual.atdUtc}
            onActualChange={(v) => handleActualChange('atdUtc', v)}
            variance={varianceBadge(data.actual.atdUtc, data.stdUtc)}
            isComplete={data.actual.atdUtc != null}
            isCurrent={nextIdx === 1}
            isPending={nextIdx < 1}
            opDate={data.operatingDate}
            refUtcMs={data.stdUtc}
            isDark={isDark}
            muted={muted}
            textPrimary={textPrimary}
            inputBg={inputBg}
            inputBorder={inputBorder}
          />

          {/* T/O (OFF) — actual only */}
          <TimeRow
            label="T/O (OFF)"
            actualValue={data.actual.offUtc}
            onActualChange={(v) => handleActualChange('offUtc', v)}
            isComplete={data.actual.offUtc != null}
            isCurrent={nextIdx === 2}
            isPending={nextIdx < 2}
            opDate={data.operatingDate}
            refUtcMs={data.stdUtc}
            isDark={isDark}
            muted={muted}
            textPrimary={textPrimary}
            inputBg={inputBg}
            inputBorder={inputBorder}
          />

          {/* T/D (ON) — actual only */}
          <TimeRow
            label="T/D (ON)"
            actualValue={data.actual.onUtc}
            onActualChange={(v) => handleActualChange('onUtc', v)}
            isComplete={data.actual.onUtc != null}
            isCurrent={nextIdx === 3}
            isPending={nextIdx < 3}
            opDate={data.operatingDate}
            refUtcMs={data.staUtc}
            isDark={isDark}
            muted={muted}
            textPrimary={textPrimary}
            inputBg={inputBg}
            inputBorder={inputBorder}
          />

          {/* ARR (IN) — estimated + actual */}
          <TimeRow
            label="ARR (IN)"
            estimatedLabel="ETA"
            estimatedValue={eta}
            onEstimatedChange={(v) => handleEstimatedChange('etaUtc', v)}
            actualValue={data.actual.ataUtc}
            onActualChange={(v) => handleActualChange('ataUtc', v)}
            variance={varianceBadge(data.actual.ataUtc, data.staUtc)}
            isComplete={data.actual.ataUtc != null}
            isCurrent={nextIdx === 4}
            isPending={nextIdx < 4}
            opDate={data.operatingDate}
            refUtcMs={data.staUtc}
            isDark={isDark}
            muted={muted}
            textPrimary={textPrimary}
            inputBg={inputBg}
            inputBorder={inputBorder}
          />
        </div>
      </div>

      {/* Middle column: Origin */}
      <div
        className="rounded-2xl p-3 relative overflow-hidden"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: accent }}>
          Origin
        </h3>
        <div className="text-[14px] font-medium tracking-tight mb-2 truncate" style={{ color: textPrimary }}>
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
          className="absolute bottom-0 right-1 z-0 text-[56px] font-mono font-black tracking-tighter leading-none select-none pointer-events-none"
          style={{ color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
        >
          {data.depStation}
        </span>
      </div>

      {/* Right column: Destination */}
      <div
        className="rounded-2xl p-3 relative overflow-hidden"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: accent }}>
          Destination
        </h3>
        <div className="text-[14px] font-medium tracking-tight mb-2 truncate" style={{ color: textPrimary }}>
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
          className="absolute bottom-0 right-1 z-0 text-[56px] font-mono font-black tracking-tighter leading-none select-none pointer-events-none"
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

/** OOOI row with local input state so typing is visible immediately */
function OooiRow({
  phase,
  index,
  nextIdx,
  data,
  scheduledMap,
  onTimeChange,
  isDark,
  muted,
  textPrimary,
  inputBg,
  inputBorder,
}: {
  phase: (typeof OOOI)[number]
  index: number
  nextIdx: number
  data: FlightDetail
  scheduledMap: Record<string, number>
  onTimeChange: (key: (typeof OOOI)[number]['key'], value: string) => void
  isDark: boolean
  muted: string
  textPrimary: string
  inputBg: string
  inputBorder: string
}) {
  const val = data.actual[phase.key]
  const isComplete = val != null
  const isCurrent = index === nextIdx
  const displayLabel = isComplete ? phase.label : phase.schedLabel
  const scheduledRef = scheduledMap[phase.key]
  const variance = scheduledRef != null ? varianceBadge(val, scheduledRef) : null

  // Local state for the text input — shows what the user types immediately
  const [localValue, setLocalValue] = useState(fmtUtc(val))

  // Sync from data when external changes happen (e.g. after save)
  useEffect(() => {
    setLocalValue(fmtUtc(val))
  }, [val])

  const handleChange = (text: string) => {
    setLocalValue(text)
    // Only commit if user typed with colon (e.g. "10:20")
    if (/^\d{1,2}:\d{2}$/.test(text)) {
      onTimeChange(phase.key, text)
    } else if (text === '') {
      onTimeChange(phase.key, '')
    }
  }

  const handleBlur = () => {
    // Auto-format on blur: "1020" → "10:20", "920" → "9:20"
    const digits = localValue.replace(/[^0-9]/g, '')
    let fmt: string | null = null
    if (digits.length === 4) fmt = `${digits.slice(0, 2)}:${digits.slice(2)}`
    else if (/^\d{1,2}:\d{2}$/.test(localValue)) fmt = localValue

    if (fmt && /^\d{1,2}:\d{2}$/.test(fmt)) {
      setLocalValue(fmt)
      onTimeChange(phase.key, fmt)
    } else if (localValue === '') {
      onTimeChange(phase.key, '')
    } else {
      setLocalValue(fmtUtc(val))
    }
  }

  return (
    <div className="flex items-center gap-3">
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
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className="w-[76px] h-[36px] text-center rounded-lg text-[15px] font-mono font-bold outline-none"
        style={{
          background: inputBg,
          border: `1px solid ${inputBorder}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          color: isComplete || localValue ? textPrimary : `${muted}40`,
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
}

/** Movement time row — supports optional estimated column + actual column */
function TimeRow({
  label,
  estimatedLabel,
  estimatedValue,
  onEstimatedChange,
  actualValue,
  onActualChange,
  variance,
  isComplete,
  isCurrent,
  isPending,
  opDate,
  refUtcMs,
  isDark,
  muted,
  textPrimary,
  inputBg,
  inputBorder,
}: {
  label: string
  estimatedLabel?: string
  estimatedValue?: number | null
  onEstimatedChange?: (v: string) => void
  actualValue: number | null
  onActualChange: (v: string) => void
  variance?: { text: string; color: string } | null
  isComplete: boolean
  isCurrent: boolean
  isPending: boolean
  opDate: string
  refUtcMs: number
  isDark: boolean
  muted: string
  textPrimary: string
  inputBg: string
  inputBorder: string
}) {
  const hasEstimated = !!estimatedLabel

  return (
    <div className="flex items-center gap-2">
      {/* Status dot */}
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {isComplete ? (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.3)' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
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
            className="w-5 h-5 rounded-full"
            style={{ background: '#F59E0B', boxShadow: '0 0 8px rgba(245,158,11,0.3)' }}
          />
        ) : (
          <div
            className="w-4 h-4 rounded-full"
            style={{
              border: `2px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              background: isDark ? '#1F1F28' : '#F2F2F5',
            }}
          />
        )}
      </div>

      {/* Label */}
      <span className="text-[13px] font-semibold w-[72px] shrink-0" style={{ color: muted }}>
        {label}
      </span>

      {/* Estimated input (only for DEP/ARR) */}
      {hasEstimated ? (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase" style={{ color: isDark ? '#5B8DEF' : '#0063F7' }}>
            {estimatedLabel}
          </span>
          <TimeInput
            value={estimatedValue ?? null}
            onChange={onEstimatedChange!}
            opDate={opDate}
            refUtcMs={refUtcMs}
            isDark={isDark}
            muted={muted}
            textPrimary={isDark ? '#5B8DEF' : '#0063F7'}
            inputBg={isDark ? 'rgba(91,141,239,0.08)' : 'rgba(0,99,247,0.05)'}
            inputBorder={isDark ? 'rgba(91,141,239,0.20)' : 'rgba(0,99,247,0.15)'}
          />
        </div>
      ) : (
        <div className="w-[90px]" /> /* spacer for alignment */
      )}

      {/* Actual input */}
      <div className="flex items-center gap-1">
        {hasEstimated && (
          <span className="text-[10px] font-semibold uppercase" style={{ color: isComplete ? '#22c55e' : muted }}>
            ACT
          </span>
        )}
        <TimeInput
          value={actualValue}
          onChange={onActualChange}
          opDate={opDate}
          refUtcMs={refUtcMs}
          isDark={isDark}
          muted={muted}
          textPrimary={textPrimary}
          inputBg={inputBg}
          inputBorder={inputBorder}
        />
      </div>

      {/* Variance badge */}
      {variance && (
        <span
          className="px-1.5 py-0.5 rounded-full text-white text-[11px] font-mono font-bold shrink-0"
          style={{ background: variance.color }}
        >
          {variance.text}
        </span>
      )}
    </div>
  )
}

/** Single time input with local state for immediate typing feedback */
function TimeInput({
  value,
  onChange,
  opDate,
  refUtcMs,
  isDark,
  muted,
  textPrimary,
  inputBg,
  inputBorder,
}: {
  value: number | null
  onChange: (v: string) => void
  opDate: string
  refUtcMs: number
  isDark: boolean
  muted: string
  textPrimary: string
  inputBg: string
  inputBorder: string
}) {
  const [localValue, setLocalValue] = useState(fmtUtc(value))

  useEffect(() => {
    setLocalValue(fmtUtc(value))
  }, [value])

  const handleChange = (text: string) => {
    setLocalValue(text)
    if (/^\d{1,2}:\d{2}$/.test(text)) onChange(text)
    else if (text === '') onChange('')
  }

  const handleBlur = () => {
    const digits = localValue.replace(/[^0-9]/g, '')
    let fmt: string | null = null
    if (digits.length === 4) fmt = `${digits.slice(0, 2)}:${digits.slice(2)}`
    else if (/^\d{1,2}:\d{2}$/.test(localValue)) fmt = localValue

    if (fmt && /^\d{1,2}:\d{2}$/.test(fmt)) {
      setLocalValue(fmt)
      onChange(fmt)
    } else if (localValue === '') {
      onChange('')
    } else {
      setLocalValue(fmtUtc(value))
    }
  }

  return (
    <input
      type="text"
      placeholder="HH:MM"
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className="w-[64px] h-[32px] text-center rounded-lg text-[14px] font-mono font-bold outline-none"
      style={{
        background: inputBg,
        border: `1px solid ${inputBorder}`,
        color: value != null || localValue ? textPrimary : `${muted}40`,
      }}
    />
  )
}
