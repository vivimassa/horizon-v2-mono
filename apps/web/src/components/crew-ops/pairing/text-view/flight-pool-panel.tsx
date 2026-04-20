'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { api } from '@skyhub/api'
import { usePairingStore } from '@/stores/use-pairing-store'
import { useFlightGridSelection } from '@/stores/use-flight-grid-selection'
import { FlightGrid } from './flight-grid/flight-grid'
import { LayoverChip } from './layover-chip'
import { DeletePairingDialog } from '../dialogs/delete-pairing-dialog'

const ACCENT = '#7c3aed'

/**
 * Center pane of Crew Pairing 4.1.5.1. Renders the Scheduling-XL grid and the
 * layover chip. Save/dialog state for create-pairing lives in the Inspector
 * Panel — the grid's Enter and right-click menu dispatch intent through
 * `usePairingStore.requestCreatePairing(ids, workflow, label)` which the
 * Inspector picks up and runs through its guard chain.
 */
export function FlightPoolPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const flights = usePairingStore((s) => s.flights)
  const pairings = usePairingStore((s) => s.pairings)
  const removePairing = usePairingStore((s) => s.removePairing)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)
  const setError = usePairingStore((s) => s.setError)
  const requestCreatePairing = usePairingStore((s) => s.requestCreatePairing)
  const layoverMode = usePairingStore((s) => s.layoverMode)
  const startLayover = usePairingStore((s) => s.startLayover)
  const clearLayover = usePairingStore((s) => s.clearLayover)
  const selectedRowIds = useFlightGridSelection((s) => s.selectedRowIds)
  const setSelectedRows = useFlightGridSelection((s) => s.setSelectedRows)

  // When layover mode is live, watch for the planner's next click. If the
  // clicked flight is a different replica of the intended return (same
  // flight-number + dep/arr but on the wrong operating date), swap it for
  // the correct-date sibling so the pairing ends up with the declared
  // number of layover nights.
  const layoverBaselineRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!layoverMode) {
      layoverBaselineRef.current = null
      return
    }
    if (layoverBaselineRef.current == null) {
      layoverBaselineRef.current = new Set(selectedRowIds)
      return
    }
    const baseline = layoverBaselineRef.current
    if (selectedRowIds.size <= baseline.size) return

    const newlyAdded = [...selectedRowIds].filter((id) => !baseline.has(id))
    if (newlyAdded.length === 0) return
    const clickedId = newlyAdded[0]
    const clicked = flights.find((f) => f.id === clickedId)
    const afterFlight = flights.find((f) => f.id === layoverMode.afterFlightId)
    if (!clicked || !afterFlight) {
      clearLayover()
      return
    }

    const expectedDate = addDaysIso(afterFlight.staUtc.slice(0, 10), layoverMode.days)
    if (clicked.instanceDate === expectedDate) {
      clearLayover()
      return
    }

    const sibling = flights.find(
      (f) =>
        f.flightNumber === clicked.flightNumber &&
        f.departureAirport === clicked.departureAirport &&
        f.arrivalAirport === clicked.arrivalAirport &&
        f.instanceDate === expectedDate,
    )
    if (sibling) {
      const next = new Set(selectedRowIds)
      next.delete(clickedId)
      next.add(sibling.id)
      setSelectedRows([...next])
    } else {
      setError(
        `No instance of ${clicked.flightNumber} on ${expectedDate} — adjust the layover nights or pick a different return.`,
      )
    }
    clearLayover()
  }, [layoverMode, selectedRowIds, flights, clearLayover, setSelectedRows, setError])

  const [pendingDelete, setPendingDelete] = useState<{ pairingId: string; pairingCode: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

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
          Drag to select · Shift+click to extend · Use the Inspector to create Draft or Final
        </span>
      </div>

      <FlightGrid
        canCreate
        onCreateDraft={(ids) => requestCreatePairing(ids, 'draft', 'Draft')}
        onCreateFinal={(ids) => requestCreatePairing(ids, 'committed', 'Final')}
        onInspectPairing={(pairingId) => inspectPairing(pairingId)}
        onDeletePairing={(pairingId) => {
          const p = pairings.find((x) => x.id === pairingId)
          if (!p) return
          setPendingDelete({ pairingId, pairingCode: p.pairingCode })
        }}
        onStartLayover={(flightId, station, x, y) => startLayover(flightId, station, x, y)}
      />

      <LayoverChip />

      {pendingDelete && (
        <DeletePairingDialog
          pairingCode={pendingDelete.pairingCode}
          busy={deleting}
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={async () => {
            setDeleting(true)
            try {
              await api.deletePairing(pendingDelete.pairingId)
              removePairing(pendingDelete.pairingId)
              setPendingDelete(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete pairing')
            } finally {
              setDeleting(false)
            }
          }}
        />
      )}
    </div>
  )
}

/** YYYY-MM-DD + N whole days, UTC. */
function addDaysIso(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
