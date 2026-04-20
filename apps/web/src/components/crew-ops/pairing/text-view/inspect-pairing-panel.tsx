'use client'

import { Fragment, useMemo, useState } from 'react'
import { Plane, Users, Trash2, CheckCircle2 } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore, resolveComplementCounts } from '@/stores/use-pairing-store'
import { PairingStatusBadge } from '../shared/pairing-status-badge'
import { DeletePairingDialog } from '../dialogs/delete-pairing-dialog'
import type { Pairing, PairingFlight } from '../types'
import { usePairingLegality } from '../use-pairing-legality'
import {
  ACCENT,
  SectionHeader,
  SelectedLegRow,
  GroundTimeRow,
  LayoverRow,
  LegalityChecks,
  ActionButton,
  complementLabel,
} from './inspector-helpers'

const LAYOVER_THRESHOLD_MIN = 24 * 60

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
  const complements = usePairingStore((s) => s.complements)
  const positions = usePairingStore((s) => s.positions)
  const setError = usePairingStore((s) => s.setError)

  // Same fallback as the details dialog — resolve crewCounts from the 5.4.3
  // catalog when the pairing itself doesn't have it stored. Filter by the
  // operator's currently-active positions so retired codes (e.g. an old PS
  // from a prior config) don't leak into the crew total.
  const resolvedCrewCounts = useMemo(() => {
    const raw =
      pairing.crewCounts ??
      resolveComplementCounts(
        complements,
        pairing.aircraftTypeIcao ?? pairing.legs[0]?.aircraftTypeIcao ?? null,
        pairing.complementKey,
      )
    if (!raw) return null
    if (positions.length === 0) return raw
    const activeCodes = new Set(positions.map((p) => p.code))
    const filtered: Record<string, number> = {}
    for (const [code, n] of Object.entries(raw)) {
      if (activeCodes.has(code) && n > 0) filtered[code] = n
    }
    return filtered
  }, [pairing, complements, positions])
  const cabinCount = useMemo(() => {
    if (!resolvedCrewCounts) return 0
    const cabinCodes = new Set(positions.filter((p) => p.category === 'cabin').map((p) => p.code))
    return Object.entries(resolvedCrewCounts)
      .filter(([code]) => cabinCodes.has(code))
      .reduce((sum, [, n]) => sum + (n || 0), 0)
  }, [resolvedCrewCounts, positions])

  const [busy, setBusy] = useState<'idle' | 'deleting' | 'committing'>('idle')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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

  function handleDelete() {
    setShowDeleteDialog(true)
  }

  async function confirmDelete() {
    setBusy('deleting')
    setError(null)
    try {
      await api.deletePairing(pairing.id)
      removePairing(pairing.id)
      inspectPairing(null)
      setShowDeleteDialog(false)
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
            {resolvedCrewCounts ? `, ${cabinCount} cabin` : ''})
          </span>
        </div>
        {resolvedCrewCounts && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: textPrimary }}>
            {positions
              .slice()
              .sort((a, b) => {
                // Cockpit first, then cabin; inside each group by rankOrder.
                if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
                return a.rankOrder - b.rankOrder
              })
              .filter((p) => (resolvedCrewCounts[p.code] ?? 0) > 0)
              .map((p, i, arr) => (
                <span key={p.code} className="inline-flex items-center gap-1" title={p.name}>
                  <span className="font-semibold">{resolvedCrewCounts[p.code]}</span>
                  <span style={{ color: textSecondary }}>{p.code}</span>
                  {i < arr.length - 1 && (
                    <span className="pl-2" style={{ color: textTertiary, opacity: 0.5 }}>
                      ·
                    </span>
                  )}
                </span>
              ))}
          </div>
        )}

        <SectionHeader title={`Legs (${pairing.flightIds.length})`} isDark={isDark} />
        <div className="space-y-1">
          {pairingFlights.map((f, i) => {
            const next = pairingFlights[i + 1]
            if (!next) {
              return (
                <Fragment key={f.id}>
                  <SelectedLegRow index={i} flight={f} isDark={isDark} />
                </Fragment>
              )
            }
            const gap = groundTimeMinutes(f, next)
            return (
              <Fragment key={f.id}>
                <SelectedLegRow index={i} flight={f} isDark={isDark} />
                {gap >= LAYOVER_THRESHOLD_MIN ? (
                  <LayoverRow minutes={gap} station={f.arrivalAirport} isDark={isDark} />
                ) : (
                  <GroundTimeRow minutes={gap} station={f.arrivalAirport} isDark={isDark} />
                )}
              </Fragment>
            )
          })}
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

      {showDeleteDialog && (
        <DeletePairingDialog
          pairingCode={pairing.pairingCode}
          detail={`${pairing.flightIds.length} legs · ${pairing.routeChain}`}
          busy={busy === 'deleting'}
          onCancel={() => busy !== 'deleting' && setShowDeleteDialog(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  )
}

function groundTimeMinutes(prev: PairingFlight, next: PairingFlight): number {
  const prevArr = Date.parse(prev.staUtc)
  const nextDep = Date.parse(next.stdUtc)
  if (!Number.isFinite(prevArr) || !Number.isFinite(nextDep)) return 0
  return Math.max(0, Math.round((nextDep - prevArr) / 60000))
}
