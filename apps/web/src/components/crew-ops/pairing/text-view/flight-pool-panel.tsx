'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { api, type PairingCreateInput } from '@skyhub/api'
import { usePairingStore } from '@/stores/use-pairing-store'
import { useFlightGridSelection } from '@/stores/use-flight-grid-selection'
import { FlightGrid } from './flight-grid/flight-grid'
import { IllegalPairingDialog } from '../dialogs/illegal-pairing-dialog'
import { MAX_PAIRING_DAYS, OversizedPairingDialog } from '../dialogs/oversized-pairing-dialog'
import { pairingFromApi } from '../adapters'
import { usePairingLegality } from '../use-pairing-legality'
import type { PairingFlight, LegalityResult, PairingWorkflowStatus } from '../types'

const ACCENT = '#7c3aed'

/**
 * Center pane of Crew Pairing 4.1.5.1. Renders the Scheduling-XL-style grid
 * (read-only, Excel selection, right-click to create) and handles the actual
 * pairing-creation network call + illegal-pairing guard.
 */
export function FlightPoolPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const flights = usePairingStore((s) => s.flights)
  const pairings = usePairingStore((s) => s.pairings)
  const activeComplementKey = usePairingStore((s) => s.activeComplementKey)
  const addPairing = usePairingStore((s) => s.addPairing)
  const removePairing = usePairingStore((s) => s.removePairing)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)
  const setError = usePairingStore((s) => s.setError)
  const selectedRowIds = useFlightGridSelection((s) => s.selectedRowIds)
  const clearAll = useFlightGridSelection((s) => s.clearAll)

  // Current selection in operating-sequence order — same logic the inspector uses.
  const selectedFlights = useMemo(() => {
    const set = selectedRowIds
    return flights
      .filter((f) => set.has(f.id))
      .sort((a, b) => {
        const d = a.instanceDate.localeCompare(b.instanceDate)
        return d !== 0 ? d : a.stdUtc.localeCompare(b.stdUtc)
      })
  }, [flights, selectedRowIds])

  // Live FDTL result — real engine when configured, mock fallback otherwise.
  const { result: liveLegality } = usePairingLegality(selectedFlights, {
    complementKey: activeComplementKey,
    facilityClass: activeComplementKey === 'standard' ? undefined : 'CLASS_1',
    homeBase: selectedFlights[0]?.departureAirport,
  })

  const [pending, setPending] = useState<{
    flightIds: string[]
    workflow: PairingWorkflowStatus
    workflowLabel: 'Draft' | 'Final'
    result: LegalityResult
  } | null>(null)
  const [oversized, setOversized] = useState<{
    flightIds: string[]
    workflow: PairingWorkflowStatus
    workflowLabel: 'Draft' | 'Final'
    spanDays: number
    flightCount: number
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

  const savePairing = useCallback(
    async (flightIds: string[], workflow: PairingWorkflowStatus, result: LegalityResult) => {
      if (saving) return
      setSaving(true)
      setError(null)
      try {
        const selected = flightIds.map((id) => flights.find((f) => f.id === id)).filter(Boolean) as PairingFlight[]
        if (selected.length === 0) return

        const legs: PairingCreateInput['legs'] = selected.map((f, i) => ({
          flightId: f.id,
          flightDate: f.instanceDate,
          legOrder: i,
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

        const created = await api.createPairing({
          pairingCode: generatePairingCode(selected),
          baseAirport: selected[0].departureAirport,
          aircraftTypeIcao: selected[0].aircraftType || null,
          complementKey: activeComplementKey,
          cockpitCount: activeComplementKey === 'aug2' ? 4 : activeComplementKey === 'aug1' ? 3 : 2,
          legs,
          fdtlStatus:
            result.overallStatus === 'pass' ? 'legal' : result.overallStatus === 'warning' ? 'warning' : 'violation',
          workflowStatus: workflow,
          lastLegalityResult: result,
        })

        const local = pairingFromApi(created)
        addPairing(local)
        clearAll()
        inspectPairing(local.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create pairing')
      } finally {
        setSaving(false)
      }
    },
    [activeComplementKey, addPairing, clearAll, flights, inspectPairing, saving, setError],
  )

  /** Proceed past both guards → actually create (or open the legality dialog). */
  const proceedToLegalityCheck = useCallback(
    (flightIds: string[], workflow: PairingWorkflowStatus, label: 'Draft' | 'Final') => {
      if (liveLegality.overallStatus === 'violation') {
        setPending({ flightIds, workflow, workflowLabel: label, result: liveLegality })
        return
      }
      void savePairing(flightIds, workflow, liveLegality)
    },
    [liveLegality, savePairing],
  )

  const handleCreate = useCallback(
    (flightIds: string[], workflow: PairingWorkflowStatus, label: 'Draft' | 'Final') => {
      if (flightIds.length === 0 || saving) return
      // Step 1 guard — selection span. Short-circuits the legality check
      // because a 30-day "pairing" would almost certainly violate everything
      // and confuse the user with a red banner when the real issue is the
      // size of the selection, not the rules.
      const uniqueDates = new Set(
        flightIds.map((id) => flights.find((f) => f.id === id)?.instanceDate).filter(Boolean) as string[],
      )
      if (uniqueDates.size > MAX_PAIRING_DAYS) {
        setOversized({
          flightIds,
          workflow,
          workflowLabel: label,
          spanDays: uniqueDates.size,
          flightCount: flightIds.length,
        })
        return
      }
      proceedToLegalityCheck(flightIds, workflow, label)
    },
    [flights, proceedToLegalityCheck, saving],
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="w-0.5 h-4 rounded-full" style={{ background: ACCENT }} />
        <h3 className="text-[14px] font-bold tracking-tight" style={{ color: textPrimary }}>
          Flight Pool
        </h3>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: textTertiary }}>
          {flights.length} flights
        </span>
        <span className="flex-1" />
        <span className="text-[11px]" style={{ color: textTertiary }}>
          Drag to select · Shift+click to extend · Right-click or Enter (Draft) / Shift+Enter (Final)
        </span>
      </div>

      <FlightGrid
        canCreate={!saving && !pending && !oversized}
        onCreateDraft={(ids) => handleCreate(ids, 'draft', 'Draft')}
        onCreateFinal={(ids) => handleCreate(ids, 'committed', 'Final')}
        onInspectPairing={(pairingId) => inspectPairing(pairingId)}
        onDeletePairing={async (pairingId) => {
          const p = pairings.find((x) => x.id === pairingId)
          if (!p) return
          if (!confirm(`Delete pairing ${p.pairingCode}? This cannot be undone.`)) return
          try {
            await api.deletePairing(pairingId)
            removePairing(pairingId)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete pairing')
          }
        }}
      />

      {oversized && (
        <OversizedPairingDialog
          spanDays={oversized.spanDays}
          flightCount={oversized.flightCount}
          maxDays={MAX_PAIRING_DAYS}
          workflowLabel={oversized.workflowLabel}
          onProceed={() => {
            const snap = oversized
            setOversized(null)
            // After the user force-accepts the oversized warning, we still
            // run the legality check — they shouldn't skip BOTH guards.
            proceedToLegalityCheck(snap.flightIds, snap.workflow, snap.workflowLabel)
          }}
          onCancel={() => setOversized(null)}
        />
      )}

      {pending && (
        <IllegalPairingDialog
          result={pending.result}
          workflowLabel={pending.workflowLabel}
          onProceed={async () => {
            const snap = pending
            setPending(null)
            await savePairing(snap.flightIds, snap.workflow, snap.result)
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

/**
 * Pairing code format (per product): first letter of the first leg's departure
 * station + the numeric portion of the first flight number. E.g. SGN + SH400
 * → "S400". Replicas inherit the source's code so the same duty pattern keeps
 * the same identifier across operating days.
 */
function generatePairingCode(selected: PairingFlight[]): string {
  if (selected.length === 0) return 'P-0000'
  const first = selected[0]
  const stationLetter = (first.departureAirport || 'X').charAt(0).toUpperCase()
  const numericMatch = first.flightNumber.match(/\d+/)
  const num = numericMatch ? numericMatch[0] : first.flightNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 4)
  return `${stationLetter}${num}`
}
