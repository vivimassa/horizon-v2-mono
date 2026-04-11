'use client'

import { useTheme } from '@/components/theme-provider'
import { colors, type Palette as PaletteType } from '@skyhub/ui/theme'
import { FlightList } from '@/app/ground-ops/cargo/cargo-manifest/components/FlightList'
import { AircraftView } from '@/app/ground-ops/cargo/cargo-manifest/components/AircraftView'
import { useCargoState } from '@/app/ground-ops/cargo/cargo-manifest/hooks/useCargoState'

export default function EmbedCargoLoading() {
  const { theme, moduleTheme } = useTheme()
  const isDark = theme === 'dark'
  const palette: PaletteType = isDark ? colors.dark : colors.light
  const rawAccent = moduleTheme?.accent ?? '#059669'
  const accent = isDark
    ? (() => {
        const r = parseInt(rawAccent.slice(1, 3), 16)
        const g = parseInt(rawAccent.slice(3, 5), 16)
        const b = parseInt(rawAccent.slice(5, 7), 16)
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const mix = (v: number) => Math.round(v + (gray - v) * 0.2)
        const hex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
        return `#${hex(mix(r))}${hex(mix(g))}${hex(mix(b))}`
      })()
    : rawAccent

  const {
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
  } = useCargoState()

  return (
    <div className="flex flex-col h-screen w-screen p-2">
      <div className="flex-1 min-h-0">
        <AircraftView
          aircraftType={selectedFlight.aircraftType}
          activeHold={activeHold}
          onSelectHold={setActiveHold}
          holds={allHolds}
          dockItems={dockItems}
          accent={accent}
          isDark={isDark}
          hasSelection={selectedFlightId !== ''}
        >
          <FlightList
            flights={filteredFlights}
            selectedId={selectedFlightId}
            onSelect={selectFlight}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            accent={accent}
            palette={palette}
            isDark={isDark}
            selectedFlight={selectedFlight}
            currentHold={currentHold}
            allHolds={allHolds}
            totalWeight={totalWeight}
            totalCapacity={totalCapacity}
            cgMac={cgMac}
            dockCount={dockCount}
          />
        </AircraftView>
      </div>

      <style>{`
        @keyframes cargo-pulse {
          0% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.4); }
          70% { box-shadow: 0 0 0 16px rgba(5, 150, 105, 0); }
          100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0); }
        }
        @keyframes cargo-fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes panel-expand-up {
          0% { opacity: 0; max-height: 120px; }
          100% { opacity: 1; max-height: 100%; }
        }
      `}</style>
    </div>
  )
}
