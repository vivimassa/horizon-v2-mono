'use client'

import { create } from 'zustand'
import { api } from '@skyhub/api'
import type { AircraftTypeRef, FlightServiceTypeRef, CityPairRef, CarrierCodeRef } from '@skyhub/api'
import { useOperatorStore, getOperatorId } from './use-operator-store'

interface ScheduleRefState {
  aircraftTypes: AircraftTypeRef[]
  serviceTypes: FlightServiceTypeRef[]
  cityPairs: CityPairRef[]
  carrierCodes: CarrierCodeRef[]
  loaded: boolean
  loading: boolean
  loadAll: () => Promise<void>

  /** Get valid carrier IATA codes (operator + defined carriers) */
  getValidCarrierCodes: () => string[]

  /** Check if a 2-letter carrier code is valid */
  isValidCarrier: (code: string) => boolean

  /** Parse flight input: extract carrier prefix + numeric part. Returns { airlineCode, flightNum } */
  parseFlightInput: (input: string) => { airlineCode: string | null; flightNum: string }

  /** Get block minutes for a DEP→ARR pair */
  getBlockMinutes: (dep: string, arr: string) => number | null

  /** Get AC type options for dropdown */
  getAcTypeOptions: () => { value: string; label: string; icao: string }[]

  /** Get service type options for dropdown */
  getSvcOptions: () => { value: string; label: string }[]

  /** Resolve shorthand or full ICAO to {id, icao} */
  resolveAcType: (input: string) => { id: string; icao: string } | null

  /** Get scheduled TAT in minutes for an aircraft type, route-type aware (DOM/INT) */
  getTatMinutes: (icao: string, dep?: string, arr?: string) => number | null
}

export const useScheduleRefStore = create<ScheduleRefState>((set, get) => ({
  aircraftTypes: [],
  serviceTypes: [],
  cityPairs: [],
  carrierCodes: [],
  loaded: false,
  loading: false,

  loadAll: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    try {
      const opId = getOperatorId()
      const [acTypes, svcTypes, cpPairs, carriers] = await Promise.all([
        api.getAircraftTypes(opId),
        api.getFlightServiceTypes(opId),
        api.getCityPairs(opId),
        api.getCarrierCodes(opId),
      ])
      set({
        aircraftTypes: acTypes,
        serviceTypes: svcTypes,
        cityPairs: cpPairs,
        carrierCodes: carriers,
        loaded: true,
      })
    } catch (e) {
      console.error('Failed to load reference data:', e)
    } finally {
      set({ loading: false })
    }
  },

  getBlockMinutes: (dep: string, arr: string) => {
    if (!dep || !arr) return null
    const depU = dep.toUpperCase()
    const arrU = arr.toUpperCase()
    const cp = get().cityPairs.find(
      (p) =>
        (p.station1Icao === depU && p.station2Icao === arrU) ||
        (p.station2Icao === depU && p.station1Icao === arrU) ||
        (p.station1Iata === depU && p.station2Iata === arrU) ||
        (p.station2Iata === depU && p.station1Iata === arrU),
    )
    return cp?.standardBlockMinutes ?? null
  },

  getAcTypeOptions: () =>
    get()
      .aircraftTypes.filter((t) => t.isActive)
      .map((t) => ({
        value: t._id,
        label: `${t.icaoType} — ${t.name}`,
        icao: t.icaoType,
      }))
      .sort((a, b) => a.icao.localeCompare(b.icao)),

  /** Resolve shorthand (320, 321) or full ICAO (A320, A321) to {id, icao} */
  resolveAcType: (input: string) => {
    const q = input.toUpperCase().trim()
    if (!q) return null
    const types = get().aircraftTypes.filter((t) => t.isActive)
    // Exact ICAO match first
    const exact = types.find((t) => t.icaoType === q)
    if (exact) return { id: exact._id, icao: exact.icaoType }
    // Shorthand: input is numeric suffix — match any type ending with it
    const byEnding = types.find((t) => t.icaoType.endsWith(q))
    if (byEnding) return { id: byEnding._id, icao: byEnding.icaoType }
    // Partial match
    const partial = types.find((t) => t.icaoType.includes(q))
    if (partial) return { id: partial._id, icao: partial.icaoType }
    return null
  },

  getSvcOptions: () =>
    get()
      .serviceTypes.filter((t) => t.isActive)
      .map((t) => ({
        value: t.code,
        label: `${t.code} — ${t.name}`,
      }))
      .sort((a, b) => a.value.localeCompare(b.value)),

  getTatMinutes: (icao: string, dep?: string, arr?: string) => {
    if (!icao) return null
    const q = icao.toUpperCase().trim()
    const acType = get().aircraftTypes.find((t) => t.icaoType === q)
    if (!acType?.tat) return null
    const tat = acType.tat

    // Determine DOM/INT for the arriving and departing legs using city pair country data
    if (dep && arr) {
      const depU = dep.toUpperCase()
      const arrU = arr.toUpperCase()
      const pairs = get().cityPairs

      // Find country for each station from city pairs
      const getCountry = (icaoCode: string): string | null => {
        for (const cp of pairs) {
          if (cp.station1Icao === icaoCode) return cp.station1CountryIso2
          if (cp.station2Icao === icaoCode) return cp.station2CountryIso2
        }
        return null
      }

      const depCountry = getCountry(depU)
      const arrCountry = getCountry(arrU)

      if (depCountry && arrCountry) {
        const isDom = depCountry === arrCountry
        // The TAT at the turnaround station depends on:
        // - arriving flight route type (the flight that just landed)
        // - departing flight route type (the next flight taking off)
        // For auto-suggest on Add, both legs share the turnaround station (prev ARR = next DEP)
        // So we use: arriving leg DOM/INT and departing leg is unknown yet → use arriving type for both
        if (isDom) return tat.domDom ?? tat.defaultMinutes ?? null
        // If different countries, it's international
        return tat.intInt ?? tat.defaultMinutes ?? null
      }
    }

    // Fallback: domDom → defaultMinutes
    return tat.domDom ?? tat.defaultMinutes ?? null
  },

  getValidCarrierCodes: () => {
    const opIata = useOperatorStore.getState().operator?.iataCode
    const carriers = get()
      .carrierCodes.filter((c) => c.isActive)
      .map((c) => c.iataCode.toUpperCase())
    if (opIata) carriers.push(opIata.toUpperCase())
    return [...new Set(carriers)]
  },

  isValidCarrier: (code: string) => {
    return get().getValidCarrierCodes().includes(code.toUpperCase())
  },

  parseFlightInput: (input: string) => {
    const s = input.toUpperCase().trim()
    if (!s) return { airlineCode: null, flightNum: '' }
    // Try to match a 2-letter alpha prefix followed by digits (e.g., "EK123", "SH456")
    const match = s.match(/^([A-Z]{2})(\d+.*)$/)
    if (match) {
      return { airlineCode: match[1], flightNum: match[2] }
    }
    // No alpha prefix — pure numeric or other format
    return { airlineCode: null, flightNum: s }
  },
}))
