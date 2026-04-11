import { useState, useCallback } from 'react'
import type { HoldKey } from '@/types/cargo'
import { MOCK_FLIGHTS, MOCK_HOLDS, MOCK_DOCK } from '../data/mock-data'

export function useCargoState() {
  const [selectedFlightId, setSelectedFlightId] = useState('')
  const [activeHold, setActiveHold] = useState<HoldKey>('fwd')
  const [searchQuery, setSearchQuery] = useState('')

  const selectedFlight = MOCK_FLIGHTS.find((f) => f.id === selectedFlightId) ?? MOCK_FLIGHTS[0]
  const currentHold = MOCK_HOLDS[activeHold]
  const allHolds = MOCK_HOLDS
  const dockItems = MOCK_DOCK

  const filteredFlights = searchQuery
    ? MOCK_FLIGHTS.filter(
        (f) =>
          f.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.dep.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.arr.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : MOCK_FLIGHTS

  const totalWeight = Object.values(allHolds).reduce((sum, h) => sum + h.weight, 0)
  const totalCapacity = Object.values(allHolds).reduce((sum, h) => sum + h.capacity, 0)
  const cgMac = 28.4 // Mock MAC percentage
  const dockCount = dockItems.length

  const selectFlight = useCallback((id: string) => {
    setSelectedFlightId(id)
    setActiveHold('fwd')
  }, [])

  return {
    selectedFlight,
    selectedFlightId,
    selectFlight,
    activeHold,
    setActiveHold,
    currentHold,
    allHolds,
    dockItems,
    filteredFlights,
    searchQuery,
    setSearchQuery,
    totalWeight,
    totalCapacity,
    cgMac,
    dockCount,
  }
}
