'use client'

import { useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { delayFlight, rescheduleFlight } from '@/lib/gantt/flight-detail-api'
import { FormField, SelectField } from '@/components/admin/form-primitives'
import { ActionModalShell } from './action-modal-shell'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

// ── Delay dialog: appends a delay entry, preserves crewReportingTimeUtc ──
// ── Reschedule dialog: appends a RSC delay, nulls crewReportingTimeUtc (AIMS §5.4.4) ──

interface BaseProps {
  open: boolean
  flight: FlightDetail
  onClose: () => void
  onApplied: () => void
}

const DELAY_CODES = [
  { value: '00', label: '00 — Other / Miscellaneous' },
  { value: '11', label: '11 — Late check-in' },
  { value: '31', label: '31 — Aircraft cleaning' },
  { value: '41', label: '41 — Aircraft defects (technical)' },
  { value: '51', label: '51 — Damage to aircraft' },
  { value: '61', label: '61 — Flight plan / crew' },
  { value: '71', label: '71 — Weather' },
  { value: '81', label: '81 — ATFM — en-route demand/capacity' },
  { value: '91', label: '91 — Load connection (awaiting pax/bags)' },
  { value: '93', label: '93 — Aircraft rotation' },
  { value: '99', label: '99 — Miscellaneous (airline)' },
]

function currentEtd(flight: FlightDetail): number {
  return flight.estimated.etdUtc ?? flight.stdUtc
}

function epochToLocalInput(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function parseLocalInput(local: string): number | null {
  if (!local) return null
  const ts = Date.parse(local + ':00Z')
  return Number.isFinite(ts) ? ts : null
}

export function DelayDialog({ open, flight, onClose, onApplied }: BaseProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const etdNow = currentEtd(flight)
  const [newEtd, setNewEtd] = useState<string>(epochToLocalInput(etdNow))
  const [code, setCode] = useState<string>('00')
  const [reason, setReason] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseLocalInput(newEtd)
  const deltaMin = parsed != null ? Math.round((parsed - flight.stdUtc) / 60_000) : 0

  const handleConfirm = async () => {
    if (parsed == null) {
      setError('Provide a valid ETD')
      return
    }
    if (deltaMin <= 0) {
      setError('New ETD must be later than STD to record a delay')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await delayFlight(flight.id, {
        newEtdUtc: parsed,
        delayCode: code,
        delayMinutes: deltaMin,
        reason,
      })
      onApplied()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <ActionModalShell
      open={open}
      title={`Delay flight ${flight.flightNumber}`}
      subtitle={`${flight.depStation} → ${flight.arrStation} · ${flight.operatingDate}`}
      onClose={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Apply delay"
      saving={saving}
      hint="Crew reporting time is preserved — use Reschedule if crew must report later."
    >
      <div className="flex flex-col gap-4">
        <div>
          <label
            className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
            style={{ color: palette.textSecondary }}
          >
            New ETD (UTC) *
          </label>
          <input
            type="datetime-local"
            value={newEtd}
            onChange={(e) => setNewEtd(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${border}`,
              color: palette.text,
            }}
          />
          <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
            Delay vs STD: <strong>{deltaMin > 0 ? `+${deltaMin} min` : `${deltaMin} min`}</strong>
          </p>
        </div>

        <SelectField
          label="Delay code"
          value={code}
          options={DELAY_CODES}
          onChange={setCode}
          palette={palette}
          isDark={isDark}
        />

        <FormField
          label="Reason (remark)"
          value={reason}
          fieldKey="reason"
          onChange={(_, v) => setReason(v ?? '')}
          palette={palette}
          isDark={isDark}
        />

        {error && (
          <p className="text-[12px]" style={{ color: '#E63535' }}>
            {error}
          </p>
        )}
      </div>
    </ActionModalShell>
  )
}

export function RescheduleDialog({ open, flight, onClose, onApplied }: BaseProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const etdNow = currentEtd(flight)
  const etaNow = flight.estimated.etaUtc ?? flight.staUtc
  const [newEtd, setNewEtd] = useState<string>(epochToLocalInput(etdNow))
  const [newEta, setNewEta] = useState<string>(epochToLocalInput(etaNow))
  const [reason, setReason] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedEtd = parseLocalInput(newEtd)
  const parsedEta = parseLocalInput(newEta)

  const handleConfirm = async () => {
    if (parsedEtd == null) {
      setError('Provide a valid ETD')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await rescheduleFlight(flight.id, {
        newEtdUtc: parsedEtd,
        newEtaUtc: parsedEta,
        reason,
      })
      onApplied()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <ActionModalShell
      open={open}
      title={`Reschedule flight ${flight.flightNumber}`}
      subtitle={`${flight.depStation} → ${flight.arrStation} · ${flight.operatingDate}`}
      onClose={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Reschedule"
      saving={saving}
      hint="AIMS §5.4.4 — use when delay > 21 h or ETD is brought forward > 3 h. Crew reporting time will be reset."
    >
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl px-3 py-2.5 text-[12px]"
          style={{
            background: 'rgba(255,136,0,0.08)',
            border: '1px solid rgba(255,136,0,0.3)',
            color: isDark ? '#FFCC88' : '#B45309',
          }}
        >
          <strong>Crew reporting time will be reset.</strong> The duty engine will recompute it off the new ETD.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
              style={{ color: palette.textSecondary }}
            >
              New ETD (UTC) *
            </label>
            <input
              type="datetime-local"
              value={newEtd}
              onChange={(e) => setNewEtd(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${border}`,
                color: palette.text,
              }}
            />
          </div>
          <div>
            <label
              className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
              style={{ color: palette.textSecondary }}
            >
              New ETA (UTC)
            </label>
            <input
              type="datetime-local"
              value={newEta}
              onChange={(e) => setNewEta(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${border}`,
                color: palette.text,
              }}
            />
          </div>
        </div>

        <FormField
          label="Reason"
          value={reason}
          fieldKey="reason"
          onChange={(_, v) => setReason(v ?? '')}
          palette={palette}
          isDark={isDark}
          hint="Short justification shown in the audit history."
        />

        {error && (
          <p className="text-[12px]" style={{ color: '#E63535' }}>
            {error}
          </p>
        )}
      </div>
    </ActionModalShell>
  )
}
