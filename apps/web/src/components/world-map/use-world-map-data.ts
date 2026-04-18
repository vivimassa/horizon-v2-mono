'use client'

import { startTransition, useEffect, useMemo, useState } from 'react'
import { getWorldMapAirports, getWorldMapFlights } from '@/lib/world-map/api'
import type { FlightPosition, MapFilter, WorldMapAirport, WorldMapFlight } from './world-map-types'
import { EMPTY_FILTER, computeFlightProgress, getFlightMapStatus, interpolateGreatCircle } from './world-map-types'

const REFRESH_MS = 30_000
const POSITION_UPDATE_MS = 5_000

function formatUtcNow(): string {
  const d = new Date()
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function useWorldMapData() {
  const [flights, setFlights] = useState<WorldMapFlight[]>([])
  const [airports, setAirports] = useState<WorldMapAirport[]>([])
  const [filter, setFilter] = useState<MapFilter>(EMPTY_FILTER)
  const [searchQuery, setSearchQuery] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [utcTime, setUtcTime] = useState(formatUtcNow)

  useEffect(() => {
    async function load() {
      try {
        const [f, a] = await Promise.all([getWorldMapFlights(todayStr()), getWorldMapAirports()])
        startTransition(() => {
          setFlights(f)
          setAirports(a)
        })
      } catch (err) {
        console.error('[world-map] load failed', err)
      }
    }
    load()
    const iv = setInterval(() => {
      getWorldMapFlights(todayStr())
        .then((f) => startTransition(() => setFlights(f)))
        .catch(() => {})
    }, REFRESH_MS)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      setNow(new Date())
      setUtcTime(formatUtcNow())
    }, POSITION_UPDATE_MS)
    return () => clearInterval(iv)
  }, [])

  const aircraftTypes = useMemo(() => {
    const s = new Set<string>()
    for (const f of flights) if (f.aircraftTypeIcao) s.add(f.aircraftTypeIcao)
    return Array.from(s).sort()
  }, [flights])

  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      if (filter.aircraftTypes.length && (!f.aircraftTypeIcao || !filter.aircraftTypes.includes(f.aircraftTypeIcao)))
        return false
      if (filter.statuses.length) {
        const s = getFlightMapStatus(f)
        if (!filter.statuses.includes(s)) return false
      }
      if (committedSearch) {
        const q = committedSearch.toUpperCase()
        const tail = (f.tailNumber || '').toUpperCase()
        const fn = f.flightNumber.toUpperCase()
        if (!tail.includes(q) && !fn.includes(q)) return false
      }
      return true
    })
  }, [flights, filter, committedSearch])

  const positions = useMemo<FlightPosition[]>(() => {
    const result: FlightPosition[] = []
    for (const f of filteredFlights) {
      const status = getFlightMapStatus(f)
      if (status !== 'airborne') continue
      const progress = computeFlightProgress(f, now)
      if (progress <= 0 || progress >= 1) continue
      const [lng, lat, bearing] = interpolateGreatCircle(f.depLng, f.depLat, f.arrLng, f.arrLat, progress)
      result.push({ id: f.id, lng, lat, bearing, progress, flight: f })
    }
    return result
  }, [filteredFlights, now])

  const airportCounts = useMemo(() => {
    const dep = new Map<string, number>()
    const arr = new Map<string, number>()
    for (const f of filteredFlights) {
      dep.set(f.depStation, (dep.get(f.depStation) || 0) + 1)
      arr.set(f.arrStation, (arr.get(f.arrStation) || 0) + 1)
    }
    return { dep, arr }
  }, [filteredFlights])

  const flightById = useMemo(() => {
    const m = new Map<string, WorldMapFlight>()
    for (const f of filteredFlights) m.set(f.id, f)
    return m
  }, [filteredFlights])

  const airportByIata = useMemo(() => {
    const m = new Map<string, WorldMapAirport>()
    for (const a of airports) m.set(a.iataCode, a)
    return m
  }, [airports])

  return {
    flights,
    airports,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    committedSearch,
    setCommittedSearch,
    now,
    utcTime,
    aircraftTypes,
    filteredFlights,
    positions,
    airportCounts,
    flightById,
    airportByIata,
  }
}
