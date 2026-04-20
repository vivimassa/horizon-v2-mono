'use client'

import { Fragment, useMemo, useState } from 'react'
import { Plane, Users, Trash2, CheckCircle2 } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { PairingStatusBadge } from '../shared/pairing-status-badge'
import type { Pairing, PairingFlight } from '../types'
import { usePairingLegality } from '../use-pairing-legality'
import {
  ACCENT,
  SectionHeader,
  SelectedLegRow,
  GroundTimeRow,
  LegalityChecks,
  ActionButton,
  complementLabel,
} from './inspector-helpers'

/**
 * Inspector in inspect mode: shows details of an existing pairing with
 * a header, leg list, legality summary, and row of actions. Delete and
 * Commit hit the real API; Copy is a stub (multi-day pattern UI pending).
 */
export function InspectPairingPanel({ pairing, flights }: { pairing: Pairing; flights: PairingFlight[] }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const inspectPairing = usePairingStore((s) => s.inspectPairing)
  const removePairing = usePairingStore((s) => s.removePairing)
  const setPairings = usePairingStore((s) => s.setPairings)
  const pairings = usePairingStore((s) => s.pairings)
  const setError = usePairingStore((s) => s.setError)

  const [busy, setBusy] = useState<'idle' | 'deleting' | 'committing'>('idle')

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

  const pairingFlights = useMemo(
    () => pairing.flightIds.map((id) => flights.find((f) => f.id === id)).filter(Boolean) as PairingFlight[],
    [pairing.flightIds, flights],
  )

  const { result } = usePairingLegality(pairingFlights, {
    complementKey: pairing.complementKey as 'standard' | 'aug1' | 'aug2' | 'custom',
    facilityClass: pairing.facilityClass ?? undefined,
    cockpitCount: pairing.cockpitCount,
    homeBase: pairing.baseAirport,
    deadheadIds: new Set(pairing.deadheadFlightIds),
  })

  async function handleDelete() {
    if (!confirm(`Delete pairing ${pairing.pairingCode}? This cannot be undone.`)) return
    setBusy('deleting')
    setError(null)
    try {
      await api.deletePairing(pairing.id)
      removePairing(pairing.id)
      inspectPairing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pairing')
    } finally {
      setBusy('idle')
    }
  }

  async function handleCommit() {
    setBusy('committing')
    setError(null)
    try {
      await api.updatePairing(pairing.id, { workflowStatus: 'committed' })
      setPairings(pairings.map((p) => (p.id === pairing.id ? { ...p, workflowStatus: 'committed' } : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit pairing')
    } finally {
      setBusy('idle')
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-3" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-[16px] font-bold tracking-tight tabular-nums" style={{ color: textPrimary }}>
            {pairing.pairingCode}
          </h3>
          <PairingStatusBadge status={pairing.status} size="md" />
        </div>
        <div
          className="flex items-center gap-1.5 text-[12px] font-medium tabular-nums mb-1"
          style={{ color: textSecondary }}
        >
          <Plane size={11} strokeWidth={2} style={{ color: textTertiary }} />
          <span className="truncate">{pairing.routeChain}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] tabular-nums" style={{ color: textTertiary }}>
          <span>{pairing.baseAirport} base</span>
          <span>·</span>
          <span>{pairing.pairingDays}d</span>
          <span>·</span>
          <span>{(pairing.totalBlockMinutes / 60).toFixed(1)}h block</span>
          <span>·</span>
          <span>{pairing.flightIds.length} legs</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-4">
        <SectionHeader title="Complement" isDark={isDark} />
        <div className="flex items-center gap-2 text-[13px]" style={{ color: textPrimary }}>
          <Users size={13} strokeWidth={2} style={{ color: ACCENT }} />
          <span className="font-semibold">{complementLabel(pairing.complementKey)}</span>
          <span className="text-[12px]" style={{ color: textTertiary }}>
            ({pairing.cockpitCount} cockpit
            {pairing.crewCounts ? `, ${pairing.crewCounts.CA ?? 0} cabin` : ''})
          </span>
        </div>

        <SectionHeader title={`Legs (${pairing.flightIds.length})`} isDark={isDark} />
        <div className="space-y-1">
          {pairingFlights.map((f, i) => (
            <Fragment key={f.id}>
              <SelectedLegRow index={i} flight={f} isDark={isDark} />
              {i < pairingFlights.length - 1 && (
                <GroundTimeRow
                  minutes={groundTimeMinutes(f, pairingFlights[i + 1])}
                  station={f.arrivalAirport}
                  isDark={isDark}
                />
              )}
            </Fragment>
          ))}
          {pairingFlights.length === 0 && (
            <p className="text-[12px] italic" style={{ color: textTertiary }}>
              Leg flights not in current pool — reload period to fetch them.
            </p>
          )}
        </div>
      </div>

      {/* Legality — pinned directly above the action row so the FDTL result
          is always visible next to the Commit button without scrolling. */}
      <div className="shrink-0 px-4 py-3 space-y-2" style={{ borderTop: `1px solid ${divider}` }}>
        <SectionHeader title="Legality" isDark={isDark} />
        <LegalityChecks result={result} isDark={isDark} />
      </div>

      {/* Actions */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${divider}` }}>
        <ActionButton
          icon={Trash2}
          label={busy === 'deleting' ? 'Deleting…' : 'Delete'}
          isDark={isDark}
          destructive
          onClick={handleDelete}
          disabled={busy !== 'idle'}
        />
        {pairing.workflowStatus === 'draft' && (
          <ActionButton
            icon={CheckCircle2}
            label={busy === 'committing' ? 'Committing…' : 'Commit'}
            isDark={isDark}
            primary
            onClick={handleCommit}
            disabled={busy !== 'idle'}
          />
        )}
      </div>
    </div>
  )
}

function groundTimeMinutes(prev: PairingFlight, next: PairingFlight): number {
  const prevArr = Date.parse(prev.staUtc)
  const nextDep = Date.parse(next.stdUtc)
  if (!Number.isFinite(prevArr) || !Number.isFinite(nextDep)) return 0
  return Math.max(0, Math.round((nextDep - prevArr) / 60000))
}
