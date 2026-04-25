'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, type CrewHotelRef, type AirportRef } from '@skyhub/api'

export interface HotacHotelsResult {
  /** All hotels for the operator, keyed by `_id`. */
  hotelsById: Map<string, CrewHotelRef>
  /** Hotels grouped by `airportIcao`, sorted by `priority` ascending. */
  hotelsByIcao: Map<string, CrewHotelRef[]>
  /** All airports — used for ICAO ↔ IATA + city lookups. */
  airports: AirportRef[]
  airportByIcao: Map<string, AirportRef>
  loading: boolean
  /** Refetch both hotels and airports — wired to the toolbar Refresh action. */
  refresh: () => Promise<void>
}

/**
 * Loads the master crew-hotels list and airports once on mount. The HOTAC
 * derivation layer joins these with pairings from `api.getCrewSchedule()` to
 * produce booking rows.
 */
export function useHotacHotels(): HotacHotelsResult {
  const [hotels, setHotels] = useState<CrewHotelRef[]>([])
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useMemo(
    () => async () => {
      setLoading(true)
      try {
        const [h, a] = await Promise.all([api.getCrewHotels(), api.getAirports()])
        setHotels(h)
        setAirports(a)
      } catch (err) {
        console.error('[hotac] failed to load hotels/airports', err)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const hotelsById = useMemo(() => {
    const m = new Map<string, CrewHotelRef>()
    for (const h of hotels) m.set(h._id, h)
    return m
  }, [hotels])

  const hotelsByIcao = useMemo(() => {
    const m = new Map<string, CrewHotelRef[]>()
    for (const h of hotels) {
      const arr = m.get(h.airportIcao)
      if (arr) arr.push(h)
      else m.set(h.airportIcao, [h])
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    }
    return m
  }, [hotels])

  const airportByIcao = useMemo(() => {
    const m = new Map<string, AirportRef>()
    for (const a of airports) {
      if (a.icaoCode) m.set(a.icaoCode, a)
    }
    return m
  }, [airports])

  return { hotelsById, hotelsByIcao, airports, airportByIcao, loading, refresh: fetchAll }
}
