'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type AirportRef, type CrewTransportVendorRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { CrewTransportFilterPanel } from '../filter-panel/crew-transport-filter-panel'
import { CrewTransportSegmentToggle } from '../toolbar/crew-transport-segment-toggle'
import { CrewTransportTabBar } from '../toolbar/crew-transport-tab-bar'
import { CrewTransportRibbonToolbar } from '../toolbar/crew-transport-ribbon-toolbar'

/**
 * 4.1.8.2 Crew Transport — top-level shell.
 *
 * Mirrors the HOTAC shell pattern (filter panel + work area). The work area
 * adds a segment toggle (Ground / Flight) above the tab bar so the action
 * set can swap by both dimensions.
 *
 * Phase B ships only the scaffold. Phase C wires Ground views; Phase D
 * wires Flight views; Phase E adds Transport config.
 */
export function CrewTransportShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const periodCommitted = useCrewTransportStore((s) => s.periodCommitted)
  const commitPeriod = useCrewTransportStore((s) => s.commitPeriod)
  const setLoading = useCrewTransportStore((s) => s.setLoading)
  const setError = useCrewTransportStore((s) => s.setError)
  const segment = useCrewTransportStore((s) => s.segment)

  const runway = useRunwayLoading()

  const [airports, setAirports] = useState<AirportRef[]>([])
  const [vendors, setVendors] = useState<CrewTransportVendorRef[]>([])
  const [referenceLoading, setReferenceLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([api.getAirports(), api.getCrewTransportVendors()])
      .then(([a, v]) => {
        if (!alive) return
        setAirports(a)
        setVendors(v)
      })
      .catch((err) => console.warn('[crew-transport] failed to load reference data', err))
      .finally(() => {
        if (alive) setReferenceLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const fetchAndDerive = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      // Phase B is scaffold-only — the real fetch arrives in Phase C/D.
      // Hold here briefly so the runway has something to do.
      await new Promise((r) => setTimeout(r, 50))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError])

  const handleGo = useCallback(async () => {
    commitPeriod()
    await runway.run(() => fetchAndDerive(), 'Loading transport demand…', 'Loaded')
  }, [runway, fetchAndDerive, commitPeriod])

  const showWorkArea = !runway.active && periodCommitted

  // Phase B: action handlers are stubs — implementations land in C/D.
  const noop = useMemo(() => () => undefined, [])

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <CrewTransportFilterPanel airports={airports} vendors={vendors} onGo={handleGo} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {showWorkArea && (
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <CrewTransportSegmentToggle />
            <CrewTransportTabBar />
            <CrewTransportRibbonToolbar
              onFetch={handleGo}
              onBatch={noop}
              onAutoAssign={noop}
              onDispatch={noop}
              onPickedUp={noop}
              onCompleted={noop}
              onNoShow={noop}
              onTrack={noop}
              onDisruption={noop}
              onToggleStatusPanel={noop}
              onCycleGroupBy={noop}
              onCycleDensity={noop}
              onExport={noop}
              onOpenIncoming={noop}
              onOpenOutgoing={noop}
              onComposeHeld={noop}
              onReleaseSelected={noop}
              onDiscardSelected={noop}
              onBookFlight={noop}
              onReplaceTicket={noop}
            />
          </div>
        )}

        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl"
          style={{
            background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
            backdropFilter: 'blur(24px)',
          }}
        >
          {runway.active ? (
            <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
          ) : !periodCommitted ? (
            <EmptyPanel
              message={
                referenceLoading
                  ? 'Loading vendors and airports…'
                  : 'Select a period and click Go to load transport demand'
              }
            />
          ) : (
            <Phase phase={`${segment}`} />
          )}
        </div>
      </div>
    </div>
  )
}

/** Phase B placeholder — Phase C/D swap in real views per (segment, tab). */
function Phase({ phase }: { phase: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center text-[13px] text-hz-text-secondary px-12">
      <div>
        <div className="text-[15px] font-semibold text-hz-text mb-2">
          {phase === 'ground' ? 'Ground transport' : 'Flight transport'} — coming in the next phase
        </div>
        <p className="max-w-md">
          Phase B ships the shell, segment toggle, and ribbon. Phase {phase === 'ground' ? 'C' : 'D'} wires the data
          layer and views.
        </p>
      </div>
    </div>
  )
}
