'use client'

import { useMemo, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { rescheduleFlight } from '@/lib/gantt/flight-detail-api'
import { FormField } from '@/components/admin/form-primitives'
import { ActionModalShell } from './flight-information/action-modal-shell'

// Standalone reschedule dialog triggered from the right-click context menu.
// Unlike the in-dialog RescheduleDialog (which reads from FlightDetail),
// this one reads from the Gantt flights store directly — no API fetch needed.

function epochToLocalInput(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function parseLocalInput(local: string): number | null {
  if (!local) return null
  const ts = Date.parse(local + ':00Z')
  return Number.isFinite(ts) ? ts : null
}

export function GanttRescheduleDialog() {
  const flightId = useGanttStore((s) => s.rescheduleDialogFlightId)
  const close = useGanttStore((s) => s.closeRescheduleDialog)
  const flights = useGanttStore((s) => s.flights)
  const refetch = useGanttStore((s) => s._fetchFlights)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const flight = useMemo(() => flights.find((f) => f.id === flightId) ?? null, [flights, flightId])

  const currentEtd = flight ? (flight.etdUtc ?? flight.stdUtc) : 0
  const currentEta = flight ? (flight.etaUtc ?? flight.staUtc) : 0

  const [newEtd, setNewEtd] = useState<string>('')
  const [newEta, setNewEta] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens on a different flight
  useMemo(() => {
    if (flight) {
      setNewEtd(epochToLocalInput(currentEtd))
      setNewEta(epochToLocalInput(currentEta))
      setReason('')
      setError(null)
    }
  }, [flight?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!flight) return null

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
      await refetch()
      close()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ActionModalShell
      open={true}
      title={`Reschedule flight ${flight.flightNumber}`}
      subtitle={`${flight.depStation} → ${flight.arrStation} · ${flight.operatingDate}`}
      onClose={close}
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
