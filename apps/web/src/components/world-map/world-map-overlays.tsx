'use client'

import type { Dispatch, SetStateAction } from 'react'
import { WorldMapFilter } from './world-map-filter'
import { WorldMapSearch } from './world-map-search'
import { WorldMapStats } from './world-map-stats'
import { WorldMapKpiPanels } from './world-map-kpi-panels'
import { FlightTooltip, AirportTooltip } from './world-map-tooltip'
import type { KpiMode, MapFilter, MapStyleKey, WorldMapAirport, WorldMapFlight } from './world-map-types'

interface WorldMapOverlaysProps {
  isDark: boolean
  uiZoom: number

  showFilter: boolean
  showSearch: boolean
  showStatsBar: boolean
  showKpiPanels: boolean

  flights: WorldMapFlight[]
  aircraftTypes: string[]

  filter: MapFilter
  setFilter: Dispatch<SetStateAction<MapFilter>>
  mapStyleKey: MapStyleKey
  setMapStyleKey: Dispatch<SetStateAction<MapStyleKey>>
  filterCollapsed: boolean
  setFilterCollapsed: Dispatch<SetStateAction<boolean>>
  otpTarget: number
  setOtpTarget: Dispatch<SetStateAction<number>>
  lfTarget: number
  setLfTarget: Dispatch<SetStateAction<number>>
  tatTargetMin: number
  setTatTargetMin: Dispatch<SetStateAction<number>>
  fuelTargetPct: number
  setFuelTargetPct: Dispatch<SetStateAction<number>>

  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
  onSelectFlight: (flight: WorldMapFlight) => void
  onClearSearch: () => void

  utcTime: string
  now: Date
  activeKpis: KpiMode[]
  onToggleKpi: (mode: KpiMode) => void

  hoveredFlight: { flight: WorldMapFlight; x: number; y: number; progress: number } | null
  hoveredAirport: { airport: WorldMapAirport; x: number; y: number } | null
  flightInfoOpen: boolean
  airportDepCounts: Map<string, number>
  airportArrCounts: Map<string, number>
}

export function WorldMapOverlays(props: WorldMapOverlaysProps) {
  const {
    isDark,
    uiZoom,
    showFilter,
    showSearch,
    showStatsBar,
    showKpiPanels,
    flights,
    aircraftTypes,
    filter,
    setFilter,
    mapStyleKey,
    setMapStyleKey,
    filterCollapsed,
    setFilterCollapsed,
    otpTarget,
    setOtpTarget,
    lfTarget,
    setLfTarget,
    tatTargetMin,
    setTatTargetMin,
    fuelTargetPct,
    setFuelTargetPct,
    searchQuery,
    setSearchQuery,
    onSelectFlight,
    onClearSearch,
    utcTime,
    now,
    activeKpis,
    onToggleKpi,
    hoveredFlight,
    hoveredAirport,
    flightInfoOpen,
    airportDepCounts,
    airportArrCounts,
  } = props

  return (
    <>
      {showFilter && (
        <WorldMapFilter
          filter={filter}
          onChange={setFilter}
          aircraftTypes={aircraftTypes}
          isDark={isDark}
          mapStyleKey={mapStyleKey}
          onMapStyleChange={setMapStyleKey}
          collapsed={filterCollapsed}
          onCollapsedChange={setFilterCollapsed}
          otpTarget={otpTarget}
          onOtpTargetChange={setOtpTarget}
          lfTarget={lfTarget}
          onLfTargetChange={setLfTarget}
          tatTargetMin={tatTargetMin}
          onTatTargetChange={setTatTargetMin}
          fuelTargetPct={fuelTargetPct}
          onFuelTargetChange={setFuelTargetPct}
        />
      )}

      {showSearch && (
        <WorldMapSearch
          value={searchQuery}
          onChange={setSearchQuery}
          flights={flights}
          now={now}
          isDark={isDark}
          onSelectFlight={onSelectFlight}
          onClear={onClearSearch}
        />
      )}

      {showStatsBar && (
        <WorldMapStats
          flights={flights}
          utcTime={utcTime}
          now={now}
          isDark={isDark}
          activeKpis={activeKpis}
          onToggleKpi={onToggleKpi}
          uiZoom={uiZoom}
        />
      )}

      {showKpiPanels && activeKpis.length > 0 && (
        <WorldMapKpiPanels
          flights={flights}
          activeKpis={activeKpis}
          filterCollapsed={filterCollapsed}
          otpTarget={otpTarget}
          lfTarget={lfTarget}
          tatTargetMin={tatTargetMin}
          fuelTargetPct={fuelTargetPct}
          uiZoom={uiZoom}
        />
      )}

      {hoveredFlight && !flightInfoOpen && (
        <FlightTooltip
          flight={hoveredFlight.flight}
          x={hoveredFlight.x}
          y={hoveredFlight.y}
          progress={hoveredFlight.progress}
        />
      )}
      {hoveredAirport && (
        <AirportTooltip
          airport={hoveredAirport.airport}
          x={hoveredAirport.x}
          y={hoveredAirport.y}
          depCount={airportDepCounts.get(hoveredAirport.airport.iataCode) || 0}
          arrCount={airportArrCounts.get(hoveredAirport.airport.iataCode) || 0}
        />
      )}
    </>
  )
}
