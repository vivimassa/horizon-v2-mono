'use client'

import { useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { applyFlightDisruption } from '@/lib/gantt/flight-detail-api'
import { FormField, AirportSelectField, SelectField } from '@/components/admin/form-primitives'
import { ActionModalShell } from './action-modal-shell'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

type TabKey = 'DIV' | 'FR' | 'RR'

const TABS: Array<{ id: TabKey; label: string; description: string }> = [
  { id: 'DIV', label: 'DIV', description: 'Divert to alternate airport' },
  { id: 'FR', label: 'FR', description: 'Air Return (after takeoff)' },
  { id: 'RR', label: 'RR', description: 'Ramp Return (before takeoff)' },
]

const REASON_OPTIONS = [
  { value: 'WX', label: 'WX — Weather' },
  { value: 'TECH', label: 'TECH — Technical / MEL' },
  { value: 'MED', label: 'MED — Medical emergency' },
  { value: 'SEC', label: 'SEC — Security' },
  { value: 'ATC', label: 'ATC — Air traffic control' },
  { value: 'OPS', label: 'OPS — Operational decision' },
  { value: 'FUEL', label: 'FUEL — Fuel / divert minimum' },
  { value: 'OTH', label: 'OTH — Other' },
]

interface DisruptionDialogProps {
  open: boolean
  flight: FlightDetail
  onClose: () => void
  onApplied: () => void
}

function toEpochMs(local: string): number | null {
  if (!local) return null
  // Treat datetime-local input as UTC (no TZ offset applied)
  const ts = Date.parse(local + ':00Z')
  return Number.isFinite(ts) ? ts : null
}

function epochToLocalInput(ms: number | null | undefined): string {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function DisruptionDialog({ open, flight, onClose, onApplied }: DisruptionDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const existingKind = flight.disruption.kind
  const initialTab: TabKey =
    existingKind === 'divert'
      ? 'DIV'
      : existingKind === 'airReturn'
        ? 'FR'
        : existingKind === 'rampReturn'
          ? 'RR'
          : 'DIV'

  const [tab, setTab] = useState<TabKey>(initialTab)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // DIV state
  const [divAirport, setDivAirport] = useState<string | null>(flight.disruption.divertAirportIcao ?? null)
  const [divEta, setDivEta] = useState<string>(epochToLocalInput(flight.disruption.etaUtc))
  const [divReason, setDivReason] = useState<string>(flight.disruption.reasonCode ?? 'WX')
  const [divNextFn, setDivNextFn] = useState<string>(flight.disruption.nextFlightNumber ?? '')
  const [divNextEtd, setDivNextEtd] = useState<string>(epochToLocalInput(flight.disruption.nextEtdUtc))
  const [divNoNext, setDivNoNext] = useState<boolean>(!!flight.disruption.doNotGenerateNextFlight)

  // FR / RR state
  const [ataInput, setAtaInput] = useState<string>(epochToLocalInput(flight.disruption.ataUtc))
  const [returnReason, setReturnReason] = useState<string>(flight.disruption.reasonCode ?? 'TECH')
  const [reasonText, setReasonText] = useState<string>(flight.disruption.reasonText ?? '')

  const handleApply = async () => {
    setSaving(true)
    setError(null)
    try {
      if (tab === 'DIV') {
        if (!divAirport) {
          setError('Divert airport is required')
          setSaving(false)
          return
        }
        await applyFlightDisruption(flight.id, {
          kind: 'divert',
          divertAirportIcao: divAirport,
          etaUtc: toEpochMs(divEta),
          reasonCode: divReason,
          reasonText,
          nextFlightNumber: divNextFn || null,
          nextEtdUtc: toEpochMs(divNextEtd),
          doNotGenerateNextFlight: divNoNext,
        })
      } else {
        await applyFlightDisruption(flight.id, {
          kind: tab === 'FR' ? 'airReturn' : 'rampReturn',
          ataUtc: toEpochMs(ataInput),
          reasonCode: returnReason,
          reasonText,
        })
      }
      onApplied()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const accent = 'var(--module-accent, #1e40af)'

  return (
    <ActionModalShell
      open={open}
      title={`Disrupt flight ${flight.flightNumber}`}
      subtitle={`${flight.depStation} → ${flight.arrStation} · ${flight.operatingDate}`}
      onClose={onClose}
      onConfirm={handleApply}
      confirmLabel="Apply"
      saving={saving}
      width={600}
      hint={error ? undefined : 'AIMS §5.4 — divert or return the flight. An audit entry is recorded.'}
    >
      {/* Tabs */}
      <div className="mb-5">
        <div
          className="flex rounded-full p-1"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}` }}
        >
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 text-[13px] font-semibold rounded-full py-2 transition-all"
                style={{
                  color: active ? accent : palette.textSecondary,
                  background: active ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.70)') : 'transparent',
                  fontWeight: active ? 700 : 600,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <p className="text-[12px] mt-2" style={{ color: palette.textTertiary }}>
          {TABS.find((t) => t.id === tab)?.description}
        </p>
      </div>

      {tab === 'DIV' && (
        <div className="flex flex-col gap-4">
          <AirportSelectField
            label="Divert Airport"
            value={divAirport}
            onChange={setDivAirport}
            palette={palette}
            isDark={isDark}
            required
            hint="Pick the alternate airport where the aircraft will land."
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
                style={{ color: palette.textSecondary }}
              >
                New ETA (UTC)
              </label>
              <input
                type="datetime-local"
                value={divEta}
                onChange={(e) => setDivEta(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${border}`,
                  color: palette.text,
                }}
              />
            </div>
            <SelectField
              label="Divert Reason"
              value={divReason}
              options={REASON_OPTIONS}
              onChange={setDivReason}
              palette={palette}
              isDark={isDark}
            />
          </div>

          <FormField
            label="Notes / remarks"
            value={reasonText}
            fieldKey="reasonText"
            onChange={(_, v) => setReasonText(v ?? '')}
            palette={palette}
            isDark={isDark}
            hint="Free-text details shown in audit."
          />

          <div
            className="rounded-xl p-3"
            style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${border}`,
            }}
          >
            <p
              className="text-[12px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: palette.textSecondary }}
            >
              Onward Flight
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Next flight number"
                value={divNextFn}
                fieldKey="nextFn"
                onChange={(_, v) => setDivNextFn(v ?? '')}
                palette={palette}
                isDark={isDark}
                placeholder="e.g. VJ123"
              />
              <div>
                <label
                  className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
                  style={{ color: palette.textSecondary }}
                >
                  Next ETD (UTC)
                </label>
                <input
                  type="datetime-local"
                  value={divNextEtd}
                  onChange={(e) => setDivNextEtd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${border}`,
                    color: palette.text,
                  }}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={divNoNext}
                onChange={(e) => setDivNoNext(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-[13px]" style={{ color: palette.text }}>
                Do not generate next flight
              </span>
            </label>
          </div>
        </div>
      )}

      {(tab === 'FR' || tab === 'RR') && (
        <div className="flex flex-col gap-4">
          <div>
            <label
              className="text-[12px] uppercase tracking-wider font-semibold mb-1.5 block"
              style={{ color: palette.textSecondary }}
            >
              ATA — Actual arrival back (UTC) *
            </label>
            <input
              type="datetime-local"
              value={ataInput}
              onChange={(e) => setAtaInput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${border}`,
                color: palette.text,
              }}
            />
            <p className="text-[11px] mt-1" style={{ color: palette.textTertiary }}>
              {tab === 'FR'
                ? 'Time the aircraft landed back at the departure airport after takeoff.'
                : 'Time the aircraft returned to the ramp/gate before takeoff.'}
            </p>
          </div>

          <SelectField
            label={tab === 'FR' ? 'Air Return Reason' : 'Ramp Return Reason'}
            value={returnReason}
            options={REASON_OPTIONS}
            onChange={setReturnReason}
            palette={palette}
            isDark={isDark}
          />

          <FormField
            label="Notes / remarks"
            value={reasonText}
            fieldKey="reasonText"
            onChange={(_, v) => setReasonText(v ?? '')}
            palette={palette}
            isDark={isDark}
          />
        </div>
      )}

      {error && (
        <p className="text-[12px] mt-3" style={{ color: '#E63535' }}>
          {error}
        </p>
      )}
    </ActionModalShell>
  )
}
