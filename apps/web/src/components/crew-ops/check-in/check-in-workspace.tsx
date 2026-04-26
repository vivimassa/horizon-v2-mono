'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, type AirportRef } from '@skyhub/api'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { useCheckInConfigStore } from '@/stores/use-check-in-config-store'
import { deriveCheckInData } from '@/lib/crew-checkin/derive-duties'
import { useTheme } from '@/components/theme-provider'
import { CheckInDutiesGrid } from './check-in-duties-grid'
import { CheckInPairingDetail } from './check-in-pairing-detail'
import { CrewCheckInCommPanel } from './check-in-comm-panel'

const TICK_INTERVAL_MS = 30_000

/** 4.1.7.1 split-pane workspace: duties grid (60%) + crew list (40%). */
export function CrewCheckInWorkspace() {
  const stations = useCrewCheckInStore((s) => s.stations)
  const date = useCrewCheckInStore((s) => s.date)
  const filters = useCrewCheckInStore((s) => s.filters)
  const pairings = useCrewCheckInStore((s) => s.pairings)
  const assignments = useCrewCheckInStore((s) => s.assignments)
  const crew = useCrewCheckInStore((s) => s.crew)
  const positions = useCrewCheckInStore((s) => s.positions)
  const uncrewed = useCrewCheckInStore((s) => s.uncrewed)
  const selectedPairingId = useCrewCheckInStore((s) => s.selectedPairingId)
  const selectPairing = useCrewCheckInStore((s) => s.selectPairing)
  const config = useCheckInConfigStore((s) => s.config)
  const commPanelMode = useCrewCheckInStore((s) => s.commPanelMode)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const cardStyle: React.CSSProperties = {
    background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
    backdropFilter: 'blur(24px)',
    boxShadow: '0 2px 12px rgba(96,97,112,0.06)',
  }

  // Tick re-evaluates "late / very late" without a refetch.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // Pull airports once for IATA↔ICAO mapping. Pairing legs may store either
  // code depending on how they were created — without this map a filter
  // typed as IATA "SGN" wouldn't match a leg stored as ICAO "VVTS".
  const [airports, setAirports] = useState<AirportRef[]>([])
  useEffect(() => {
    void api
      .getAirports()
      .then(setAirports)
      .catch((err) => console.warn('[crew-checkin] airports map load failed', err))
  }, [])

  // Expand each selected IATA into [IATA, ICAO] so derive matches both.
  const expandedStations = useMemo(() => {
    if (stations.length === 0) return [] as string[]
    const byIata = new Map(airports.filter((a) => a.iataCode).map((a) => [a.iataCode as string, a]))
    const byIcao = new Map(airports.filter((a) => a.icaoCode).map((a) => [a.icaoCode as string, a]))
    const out = new Set<string>()
    for (const code of stations) {
      const a = byIata.get(code) ?? byIcao.get(code)
      if (a?.iataCode) out.add(a.iataCode)
      if (a?.icaoCode) out.add(a.icaoCode)
      out.add(code) // fallback when airport not in master data
    }
    return Array.from(out)
  }, [stations, airports])

  const data = useMemo(
    () =>
      deriveCheckInData({
        pairings,
        assignments,
        crew,
        positions,
        stations: expandedStations,
        veryLateAfterMinutes: config?.lateInfo.veryLateAfterMinutes,
        onDateUtc: date,
      }),
    [pairings, assignments, crew, positions, expandedStations, config?.lateInfo.veryLateAfterMinutes, date],
  )

  // Diagnostic: always log post-fetch so the controller can see in DevTools
  //   • pairings:0       ⇒ date range or scenario mismatch
  //   • pairings>0, derived:0 ⇒ station filter mismatch (paste the sample)
  //   • derived>0, crewCount:0 ⇒ assignments empty for those pairings
  useEffect(() => {
    const sample = pairings.slice(0, 2).map((p) => ({
      _id: p._id,
      baseAirport: p.baseAirport,
      firstLegDep: p.legs[0]?.depStation,
      firstLegStd: p.legs[0]?.stdUtcIso,
      startDate: p.startDate,
      endDate: p.endDate,
    }))
    const assignmentSample = assignments.slice(0, 2).map((a) => ({
      _id: a._id,
      pairingId: a.pairingId,
      crewId: a.crewId,
      seatPositionId: a.seatPositionId,
      status: a.status,
    }))
    // Per-pairing assignment counts grouped by aircraft type. Surfaces
    // "auto-roster ran for fleet X but not fleet Y" cases where some duties
    // legitimately have 0 crew because nothing was rostered to them.
    const byAcType = new Map<string, { duties: number; withCrew: number; assignmentCount: number }>()
    for (const d of data.duties) {
      const key = d.aircraftTypeIcao ?? 'UNKNOWN'
      const cur = byAcType.get(key) ?? { duties: 0, withCrew: 0, assignmentCount: 0 }
      cur.duties += 1
      if (d.crewCount > 0) cur.withCrew += 1
      cur.assignmentCount += d.crewCount
      byAcType.set(key, cur)
    }
    // Per-pairing missing-seat counts grouped by aircraft type so a planner
    // can see "auto-roster left A350 CP unassigned" without leaving DevTools.
    const uncrewedByAc = new Map<string, { count: number; missingCpCount: number }>()
    const pairingById = new Map(pairings.map((p) => [p._id, p]))
    for (const u of uncrewed) {
      const p = pairingById.get(u.pairingId)
      const key = p?.aircraftTypeIcao ?? 'UNKNOWN'
      const cur = uncrewedByAc.get(key) ?? { count: 0, missingCpCount: 0 }
      cur.count += 1
      cur.missingCpCount += u.missing.reduce(
        (s, m) => s + ((m as { code?: string }).code?.toUpperCase().includes('CP') ? m.count : 0),
        0,
      )
      uncrewedByAc.set(key, cur)
    }
    console.info('[crew-checkin] data', {
      stations,
      expandedStations,
      pairings: pairings.length,
      assignments: assignments.length,
      crew: crew.length,
      positions: positions.length,
      uncrewed: uncrewed.length,
      uncrewedByAcType: Object.fromEntries(uncrewedByAc),
      derivedDuties: data.duties.length,
      coverageByAcType: Object.fromEntries(byAcType),
      pairingSample: sample,
      assignmentSample,
    })
  }, [pairings, assignments, crew.length, positions.length, data.duties.length, stations, expandedStations])

  // Auto-select the first visible duty so the right-hand crew list is never
  // empty when there's data to show. Also clear stale selection if the old
  // pairing dropped out of the current dataset (e.g. station filter changed).
  useEffect(() => {
    const ids = new Set(data.duties.map((d) => d.pairingId))
    if (selectedPairingId && !ids.has(selectedPairingId)) {
      selectPairing(null)
      return
    }
    if (!selectedPairingId && data.duties.length > 0) {
      selectPairing(data.duties[0].pairingId)
    }
  }, [data.duties, selectedPairingId, selectPairing])

  const visibleDuties = useMemo(() => {
    let rows = data.duties
    if (filters.hideDeparted) rows = rows.filter((r) => !r.departed)
    if (filters.hideAllCheckedIn) rows = rows.filter((r) => !r.allCheckedIn)
    if (filters.aircraftTypes.length > 0) {
      const acSet = new Set(filters.aircraftTypes.map((s) => s.toUpperCase()))
      rows = rows.filter((r) => (r.aircraftTypeIcao ? acSet.has(r.aircraftTypeIcao.toUpperCase()) : false))
    }
    return rows
  }, [data.duties, filters])

  const selectedPairing = useMemo(
    () => (selectedPairingId ? data.pairingsById.get(selectedPairingId) : undefined),
    [selectedPairingId, data.pairingsById],
  )
  const selectedAssignments = useMemo(
    () => (selectedPairingId ? (data.byPairing.get(selectedPairingId) ?? []) : []),
    [selectedPairingId, data.byPairing],
  )

  return (
    <div className="flex-1 flex min-h-0 gap-3">
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          ...cardStyle,
          width: commPanelMode ? '40%' : '60%',
          minWidth: 360,
        }}
      >
        <CheckInDutiesGrid duties={visibleDuties} selectedPairingId={selectedPairingId} onSelect={selectPairing} />
      </div>

      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          ...cardStyle,
          width: commPanelMode ? '40%' : '40%',
          minWidth: 360,
        }}
      >
        <CheckInPairingDetail
          pairing={selectedPairing}
          assignments={selectedAssignments}
          crewById={data.crewById}
          positionsById={data.positionsById}
        />
      </div>

      <CrewCheckInCommPanel
        pairing={selectedPairing}
        assignments={selectedAssignments}
        crewById={data.crewById}
        positionsById={data.positionsById}
      />
    </div>
  )
}
