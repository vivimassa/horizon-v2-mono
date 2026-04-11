import { useState, useCallback } from 'react'
import type { HoldKey } from '../types/cargo'
import { MOCK_FLIGHTS, MOCK_HOLDS, MOCK_DOCK } from '../data/mock-cargo'

export function useCargoState() {
  const [selectedFlightId, setSelectedFlightId] = useState('')
  const [activeHold, setActiveHold] = useState<HoldKey>('fwd')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const selectedFlight = MOCK_FLIGHTS.find((f) => f.id === selectedFlightId)
  const hasSelection = selectedFlightId !== ''

  const filteredFlights = searchQuery
    ? MOCK_FLIGHTS.filter(
        (f) =>
          f.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.dep.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.arr.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : MOCK_FLIGHTS

  const allHolds = MOCK_HOLDS
  const dockItems = MOCK_DOCK
  const totalWeight = Object.values(allHolds).reduce((sum, h) => sum + h.weight, 0)
  const totalCapacity = Object.values(allHolds).reduce((sum, h) => sum + h.capacity, 0)
  const cgMac = 28.4
  const dockCount = dockItems.length

  const selectFlight = useCallback((id: string) => {
    setSelectedFlightId(id)
    setActiveHold('fwd')
    setShowPicker(false)
    setSearchQuery('')
  }, [])

  return {
    selectedFlightId,
    selectedFlight,
    hasSelection,
    selectFlight,
    activeHold,
    setActiveHold,
    searchQuery,
    setSearchQuery,
    showPicker,
    setShowPicker,
    filteredFlights,
    allHolds,
    dockItems,
    totalWeight,
    totalCapacity,
    cgMac,
    dockCount,
  }
}
