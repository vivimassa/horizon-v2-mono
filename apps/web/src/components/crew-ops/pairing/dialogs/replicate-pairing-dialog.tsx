'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Copy, CheckCircle2, AlertTriangle, XCircle, X, Loader2 } from 'lucide-react'
import { api, type PairingCreateInput } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'
import { usePairingStore } from '@/stores/use-pairing-store'
import { pairingFromApi } from '../adapters'
import type { Pairing, PairingFlight } from '../types'

interface ReplicatePairingDialogProps {
  /** The pairing being replicated. Must be a production pairing already in the store. */
  source: Pairing
  onClose: () => void
}

type RowStatus = 'source' | 'ready-legal' | 'ready-warning' | 'ready-violation' | 'missing-flights' | 'already-covered'

interface DayRow {
  date: string // YYYY-MM-DD
  weekday: number // 0 = Mon ... 6 = Sun
  status: RowStatus
  /** Resolved flight instances for this candidate date (ordered same as source legs). */
  flights: PairingFlight[]
  /** true when the source's schedule daysOfWeek bitmask includes this weekday. */
  matchesFrequency: boolean
}

/**
 * Replicate an existing pairing across matching days in the currently-loaded
 * period. One client-side POST per selected date — no new server endpoint.
 *
 * Defaults:
 *  - Only dates where every source leg has a matching flight instance are
 *    selectable.
 *  - Dates where the schedule's `daysOfWeek` bitmask includes the weekday
 *    are pre-checked.
 *  - Dates that are already covered by another pairing are shown but disabled.
 */
export function ReplicatePairingDialog({ source, onClose }: ReplicatePairingDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const flights = usePairingStore((s) => s.flights)
  const periodFrom = usePairingStore((s) => s.periodFrom)
  const periodTo = usePairingStore((s) => s.periodTo)
  const addPairing = usePairingStore((s) => s.addPairing)
  const setError = usePairingStore((s) => s.setError)

  // ── Build candidate dates for the current period ─────────────────────
  const candidates = useMemo<DayRow[]>(() => {
    if (!periodFrom || !periodTo) return []

    // Per-leg offsets from the pairing's startDate — keeps multi-day pairings
    // (legs crossing UTC midnight) landing on the correct days in the replica.
    const startMs = Date.UTC(
      Number(source.startDate.slice(0, 4)),
      Number(source.startDate.slice(5, 7)) - 1,
      Number(source.startDate.slice(8, 10)),
    )
    const dayOffsets = source.legs.map((l) => {
      const ms = Date.UTC(
        Number(l.flightDate.slice(0, 4)),
        Number(l.flightDate.slice(5, 7)) - 1,
        Number(l.flightDate.slice(8, 10)),
      )
      return Math.round((ms - startMs) / 86400000)
    })

    const addDaysUtc = (ymd: string, days: number): string => {
      const d = new Date(`${ymd}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + days)
      return d.toISOString().slice(0, 10)
    }
    const shiftIsoDays = (iso: string | undefined | null, days: number): string => {
      if (!iso) return ''
      const d = new Date(iso)
      d.setUTCDate(d.getUTCDate() + days)
      return d.toISOString()
    }

    // Informational "Freq match" hint — does every source leg have a pool
    // instance on this weekday? The replicate itself no longer depends on
    // this; it's only a visual cue. Empty pool = no hint available.
    const legKey = (fn: string, dep: string, arr: string) => `${fn}|${dep}|${arr}`
    const sourceLegKeys = source.legs.map((l) => legKey(l.flightNumber ?? '', l.depStation, l.arrStation))
    const weekdaySets = new Map<string, Set<number>>()
    for (const f of flights) {
      const k = legKey(f.flightNumber, f.departureAirport, f.arrivalAirport)
      const jsDow = new Date(`${f.instanceDate}T00:00:00Z`).getUTCDay()
      const wd = (jsDow + 6) % 7
      const set = weekdaySets.get(k) ?? new Set<number>()
      set.add(wd)
      weekdaySets.set(k, set)
    }
    const matchesFreqForWeekday = (weekday: number): boolean =>
      sourceLegKeys.length > 0 && sourceLegKeys.every((k) => weekdaySets.get(k)?.has(weekday) ?? false)

    const sourceDate = source.startDate
    const rows: DayRow[] = []
    const start = new Date(`${periodFrom}T00:00:00Z`)
    const end = new Date(`${periodTo}T00:00:00Z`)
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const ymd = d.toISOString().slice(0, 10)
      const jsDow = d.getUTCDay()
      const weekday = (jsDow + 6) % 7 // 0 Mon .. 6 Sun (matches ISSM mask convention)
      const matchesFrequency = matchesFreqForWeekday(weekday)

      if (ymd === sourceDate) {
        rows.push({ date: ymd, weekday, status: 'source', flights: [], matchesFrequency })
        continue
      }

      // Synthesize each target leg by shifting the source leg's stored UTC
      // ISOs forward by the offset between the candidate date and source
      // startDate. If a matching pool instance exists, prefer it (richer
      // data — tail, rotation, pairingId for conflict detection); otherwise
      // fall back to the synthetic leg. Keeping the source leg's
      // scheduledFlightId satisfies the server's tenant-check on create.
      const tgtMs = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
      const shiftDaysFromSource = Math.round((tgtMs - startMs) / 86400000)

      const resolved: PairingFlight[] = []
      let coveredByOther = false
      for (let i = 0; i < source.legs.length; i += 1) {
        const leg = source.legs[i]
        const targetDate = addDaysUtc(ymd, dayOffsets[i] ?? 0)
        const pooled = flights.find(
          (x) =>
            x.flightNumber === leg.flightNumber &&
            x.departureAirport === leg.depStation &&
            x.arrivalAirport === leg.arrStation &&
            x.instanceDate === targetDate,
        )
        if (pooled) {
          if (pooled.pairingId && pooled.pairingId !== source.id) coveredByOther = true
          resolved.push(pooled)
        } else {
          const sourceSid = leg.flightId.split('__')[0]
          resolved.push({
            id: `${sourceSid}__${targetDate}`,
            scheduledFlightId: sourceSid,
            instanceDate: targetDate,
            flightNumber: leg.flightNumber ?? '',
            departureAirport: leg.depStation,
            arrivalAirport: leg.arrStation,
            std: shiftIsoDays(leg.stdUtcIso, shiftDaysFromSource),
            sta: shiftIsoDays(leg.staUtcIso, shiftDaysFromSource),
            stdUtc: shiftIsoDays(leg.stdUtcIso, shiftDaysFromSource),
            staUtc: shiftIsoDays(leg.staUtcIso, shiftDaysFromSource),
            blockMinutes: leg.blockMinutes ?? 0,
            aircraftType: leg.aircraftTypeIcao ?? '',
            tailNumber: null,
            rotationId: null,
            rotationLabel: null,
            serviceType: null,
            daysOfWeek: null,
            departureDayOffset: 0,
            arrivalDayOffset: 0,
            status: 'active',
            effectiveFrom: targetDate,
            effectiveUntil: targetDate,
            pairingId: null,
          })
        }
      }

      if (coveredByOther) {
        rows.push({ date: ymd, weekday, status: 'already-covered', flights: resolved, matchesFrequency })
        continue
      }

      rows.push({ date: ymd, weekday, status: 'ready-legal', flights: resolved, matchesFrequency })
    }
    return rows
  }, [periodFrom, periodTo, flights, source])

  // SSIM frequency string (e.g. "1234567", "135") read off the source pairing's
  // first leg via the flight pool. All legs of a replicable pairing share the
  // same schedule pattern, so the first leg is representative.
  const frequencySsim = useMemo(() => {
    if (source.legs.length === 0) return ''
    const firstLegSid = source.legs[0].flightId.split('__')[0]
    const anyInstance = flights.find((f) => f.scheduledFlightId === firstLegSid)
    return anyInstance?.daysOfWeek ?? ''
  }, [flights, source])

  // ── Pre-select rows that are ready + match the frequency mask ────────
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => {
    const s = new Set<string>()
    for (const r of candidates) {
      if (r.status === 'ready-legal' && r.matchesFrequency) s.add(r.date)
    }
    return s
  })

  // When candidates refresh (e.g. after selection toggles), keep the set in sync
  useEffect(() => {
    const valid = new Set(candidates.filter((r) => r.status.startsWith('ready')).map((r) => r.date))
    setSelectedDates((prev) => {
      const next = new Set<string>()
      for (const d of prev) if (valid.has(d)) next.add(d)
      // If first pass returned an empty set because candidates hadn't loaded yet,
      // fall back to frequency-matched ready rows.
      if (next.size === 0) {
        for (const r of candidates) if (r.status === 'ready-legal' && r.matchesFrequency) next.add(r.date)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.length])

  const toggleDate = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const selectAll = (filter: 'matching' | 'all') => {
    const next = new Set<string>()
    for (const r of candidates) {
      if (r.status.startsWith('ready') && (filter === 'all' || r.matchesFrequency)) next.add(r.date)
    }
    setSelectedDates(next)
  }

  const clearSelection = () => setSelectedDates(new Set())

  /** Toggle every ready row on the given SSIM weekday (1=Mon…7=Sun). */
  const toggleWeekday = (ssimDay: number) => {
    const wd = ssimDay - 1 // weekday 0..6 Mon..Sun matches DayRow.weekday
    const matching = candidates.filter((r) => r.weekday === wd && r.status.startsWith('ready'))
    if (matching.length === 0) return
    const allSelected = matching.every((r) => selectedDates.has(r.date))
    setSelectedDates((prev) => {
      const next = new Set(prev)
      for (const r of matching) {
        if (allSelected) next.delete(r.date)
        else next.add(r.date)
      }
      return next
    })
  }

  /** Per-digit selection state that drives the frequency chip visuals. */
  const weekdayChipState = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7].map((n) => {
      const wd = n - 1
      const ready = candidates.filter((r) => r.weekday === wd && r.status.startsWith('ready'))
      const selected = ready.filter((r) => selectedDates.has(r.date))
      return {
        n,
        readyCount: ready.length,
        selectedCount: selected.length,
        inSourcePattern: frequencySsim.includes(String(n)),
      }
    })
  }, [candidates, selectedDates, frequencySsim])

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  // ── Running the replication loop ──────────────────────────────────────
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })

  const runReplication = async () => {
    const toCreate = candidates.filter((r) => selectedDates.has(r.date) && r.status.startsWith('ready'))
    if (toCreate.length === 0) return
    setRunning(true)
    setProgress({ done: 0, total: toCreate.length, failed: 0 })
    setError(null)

    // Build the bulk payload — one round-trip for the whole replicate set
    // instead of N sequential POSTs (was visibly slow at 30d periods).
    const items = toCreate.map((row) => {
      const legs: PairingCreateInput['legs'] = row.flights.map((f, idx) => ({
        flightId: f.id,
        flightDate: f.instanceDate,
        legOrder: idx,
        isDeadhead: false,
        dutyDay: 1,
        depStation: f.departureAirport,
        arrStation: f.arrivalAirport,
        flightNumber: f.flightNumber,
        stdUtcIso: f.stdUtc,
        staUtcIso: f.staUtc,
        blockMinutes: f.blockMinutes,
        aircraftTypeIcao: f.aircraftType || null,
      }))
      return {
        pairingCode: source.pairingCode,
        baseAirport: source.baseAirport,
        aircraftTypeIcao: source.legs[0]?.aircraftTypeIcao ?? row.flights[0]?.aircraftType ?? null,
        complementKey: source.complementKey,
        cockpitCount: source.cockpitCount,
        facilityClass: source.facilityClass,
        legs,
        fdtlStatus: 'legal' as const,
        workflowStatus: source.workflowStatus,
      } as PairingCreateInput
    })

    try {
      const { created, failed } = await api.bulkCreatePairings(items)
      for (const c of created) addPairing(pairingFromApi(c))
      setProgress({ done: created.length, total: toCreate.length, failed })
    } catch (err) {
      console.error('bulk replicate failed', err)
      setError(err instanceof Error ? err.message : 'Bulk replicate failed')
      setProgress({ done: 0, total: toCreate.length, failed: toCreate.length })
    } finally {
      setRunning(false)
      onClose()
    }
  }

  // ── Styling ──────────────────────────────────────────────────────────
  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const accent = '#7c3aed'

  const selectedCount = selectedDates.size
  const totalFlights = selectedCount * source.legs.length
  const readyCount = candidates.filter((r) => r.status.startsWith('ready')).length

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      style={{
        background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) onClose()
      }}
    >
      <div
        className="w-full max-w-[720px] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(96,97,112,0.25)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${panelBorder}` }}>
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 40, height: 40, background: `${accent}22`, color: accent }}
          >
            <Copy size={20} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold tracking-tight" style={{ color: textPrimary }}>
              Replicate {source.pairingCode} across period
            </h3>
            <p className="text-[12px] mt-0.5 tabular-nums truncate" style={{ color: textSecondary }}>
              Pattern: {source.routeChain} · {source.legs.length} legs · {source.pairingDays}d base
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="p-1 rounded-md transition-colors hover:bg-black/10 disabled:opacity-40"
            style={{ color: textMuted }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Frequency picker — each digit toggles its weekday independently.
            1=Mon…7=Sun (SSIM convention). Filled = all ready rows for that
            weekday are selected; outlined = partial; muted = none. Digits
            outside the source's daysOfWeek pattern (or with no ready pool
            rows) are disabled. */}
        <div
          className="flex items-center gap-3 px-5 py-2.5 shrink-0"
          style={{ borderBottom: `1px solid ${panelBorder}` }}
        >
          <span className="text-[11px] font-semibold tracking-[0.10em] uppercase" style={{ color: textMuted }}>
            Frequency
          </span>
          <div className="inline-flex items-center gap-[3px]">
            {weekdayChipState.map((s) => {
              const enabled = s.readyCount > 0 && s.inSourcePattern
              const full = enabled && s.selectedCount === s.readyCount
              const partial = enabled && s.selectedCount > 0 && s.selectedCount < s.readyCount
              const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              const label = WEEKDAY_LABELS[s.n - 1]
              const bg = full
                ? accent
                : partial
                  ? 'transparent'
                  : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(15,23,42,0.04)'
              const color = full
                ? '#fff'
                : partial
                  ? accent
                  : enabled
                    ? isDark
                      ? 'rgba(255,255,255,0.55)'
                      : 'rgba(15,23,42,0.55)'
                    : isDark
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(15,23,42,0.22)'
              const border = partial ? `1.5px solid ${accent}` : '1.5px solid transparent'
              const tip = enabled
                ? `${label} — ${s.selectedCount}/${s.readyCount} selected\nClick to ${full ? 'deselect' : 'select'} all ${label}s`
                : !s.inSourcePattern
                  ? `${label} — not in source pattern (${frequencySsim || '—'})`
                  : `${label} — no ready days`
              return (
                <Tooltip key={s.n} content={tip} multiline maxWidth={220}>
                  <button
                    type="button"
                    onClick={() => toggleWeekday(s.n)}
                    disabled={running || !enabled}
                    className="inline-flex items-center justify-center rounded-[5px] tabular-nums transition-all hover:brightness-110 active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      width: 22,
                      height: 22,
                      fontSize: 12,
                      fontWeight: 700,
                      background: bg,
                      color,
                      border,
                      boxSizing: 'border-box',
                      cursor: enabled && !running ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {s.n}
                  </button>
                </Tooltip>
              )
            })}
          </div>
          <span className="flex-1" />
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: textMuted }}>
            {readyCount} day{readyCount === 1 ? '' : 's'} available
          </span>
        </div>

        {/* Date list */}
        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          <table className="w-full text-[12px] tabular-nums" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead
              style={{
                position: 'sticky',
                top: 0,
                background: panelBg,
                zIndex: 1,
              }}
            >
              <tr style={{ height: 28 }}>
                <Th isDark={isDark}>
                  <input
                    type="checkbox"
                    aria-label="Select all ready dates"
                    title="Select all / deselect all ready dates"
                    disabled={running || readyCount === 0}
                    checked={readyCount > 0 && selectedCount === readyCount}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedCount > 0 && selectedCount < readyCount
                    }}
                    onChange={(e) => {
                      if (e.target.checked) selectAll('all')
                      else clearSelection()
                    }}
                    style={{ accentColor: accent, cursor: running || readyCount === 0 ? 'not-allowed' : 'pointer' }}
                  />
                </Th>
                <Th isDark={isDark}>Date</Th>
                <Th isDark={isDark}>Day</Th>
                <Th isDark={isDark}>Freq match</Th>
                <Th isDark={isDark}>Status</Th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((row) => {
                const checked = selectedDates.has(row.date)
                const disabled = !row.status.startsWith('ready') || running
                return (
                  <tr
                    key={row.date}
                    style={{
                      height: 28,
                      background:
                        row.status === 'source'
                          ? isDark
                            ? 'rgba(124,58,237,0.12)'
                            : 'rgba(124,58,237,0.07)'
                          : checked
                            ? isDark
                              ? 'rgba(124,58,237,0.06)'
                              : 'rgba(124,58,237,0.04)'
                            : 'transparent',
                      borderBottom: `1px solid ${panelBorder}`,
                    }}
                  >
                    <Td isDark={isDark}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleDate(row.date)}
                        style={{ accentColor: accent }}
                      />
                    </Td>
                    <Td isDark={isDark}>
                      <span style={{ color: textPrimary, fontWeight: row.status === 'source' ? 700 : 500 }}>
                        {formatDMY(row.date)}
                      </span>
                    </Td>
                    <Td isDark={isDark}>
                      <span style={{ color: textSecondary }}>{WEEKDAYS[row.weekday]}</span>
                    </Td>
                    <Td isDark={isDark}>
                      {row.matchesFrequency ? (
                        <span style={{ color: '#06C270', fontWeight: 600 }}>✓</span>
                      ) : (
                        <span style={{ color: textMuted }}>—</span>
                      )}
                    </Td>
                    <Td isDark={isDark}>
                      <StatusChip status={row.status} isDark={isDark} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer — preview + actions */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{
            borderTop: `1px solid ${panelBorder}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
          }}
        >
          <div className="flex items-center gap-2 text-[12px]" style={{ color: textSecondary }}>
            <CalendarDays size={14} strokeWidth={2} style={{ color: textMuted }} />
            <span>
              Will create{' '}
              <strong style={{ color: textPrimary }}>
                {selectedCount} pairing{selectedCount === 1 ? '' : 's'}
              </strong>{' '}
              covering {totalFlights} flight{totalFlights === 1 ? '' : 's'}
            </span>
          </div>
          <span className="flex-1" />

          {running && (
            <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: accent }}>
              <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
              {progress.done} / {progress.total}
              {progress.failed > 0 && <span style={{ color: '#FF3B3B' }}>· {progress.failed} failed</span>}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
              color: textPrimary,
              border: `1px solid ${panelBorder}`,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={runReplication}
            disabled={running || selectedCount === 0}
            className="h-9 px-4 rounded-lg text-[13px] font-bold transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-40 flex items-center gap-1.5"
            style={{
              background: accent,
              color: '#fff',
              boxShadow: `0 4px 14px ${accent}55`,
            }}
          >
            <CheckCircle2 size={14} strokeWidth={2.2} />
            Replicate
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Small table helpers ──────────────────────────────────────────────────
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Th({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <th
      className="text-left px-2"
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: isDark ? '#8F90A6' : '#555770',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <td
      className="px-2"
      style={{
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
      }}
    >
      {children}
    </td>
  )
}

function StatusChip({ status, isDark }: { status: RowStatus; isDark: boolean }) {
  const cfg: Record<RowStatus, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
    source: { label: 'Source', color: '#7c3aed', Icon: Copy },
    'ready-legal': { label: 'Ready', color: '#D4A017', Icon: CheckCircle2 },
    'ready-warning': { label: 'Warning', color: '#FF8800', Icon: AlertTriangle },
    'ready-violation': { label: 'Violation', color: '#FF3B3B', Icon: XCircle },
    'missing-flights': { label: 'No flights', color: isDark ? '#8F90A6' : '#555770', Icon: XCircle },
    'already-covered': { label: 'Completed', color: '#06C270', Icon: CheckCircle2 },
  }
  const { label, color, Icon } = cfg[status]
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
    >
      <Icon size={10} strokeWidth={2.4} />
      {label}
    </span>
  )
}

function formatDMY(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}
