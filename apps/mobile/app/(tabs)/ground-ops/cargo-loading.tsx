import { useState } from 'react'
import { View, ScrollView, Pressable, Text, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronUp, ChevronDown, PlaneTakeoff } from 'lucide-react-native'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useCargoState } from '../../../hooks/useCargoState'
import { FlightPickerBar } from '../../../components/cargo/FlightPickerBar'
import { FlightCard } from '../../../components/cargo/FlightCard'
import { KpiStrip } from '../../../components/cargo/KpiStrip'
import { HoldTabBar } from '../../../components/cargo/HoldTabBar'
import { AircraftWorkspace } from '../../../components/cargo/AircraftWorkspace'
import { CgSection } from '../../../components/cargo/CgSection'
import { ManifestSection } from '../../../components/cargo/ManifestSection'
import { CargoActionBar } from '../../../components/cargo/CargoActionBar'
import { CargoEmptyState } from '../../../components/cargo/CargoEmptyState'
import { LoadingDock } from '../../../components/cargo/LoadingDock'

export default function CargoLoading() {
  const { palette, accent, isDark, isTablet } = useAppTheme()
  const state = useCargoState()
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const insets = useSafeAreaInsets()
  const tabBarHeight = 60 + insets.bottom // dock height + safe area

  if (isTablet)
    return (
      <View className="flex-1" style={{ backgroundColor: palette.background }}>
        <BreadcrumbHeader moduleCode="5.1.1" />

        {/* Full-screen aircraft workspace */}
        <View className="flex-1" style={{ position: 'relative' }}>
          <AircraftWorkspace
            activeHold={state.activeHold}
            hasSelection={state.hasSelection}
            onSelectHold={state.setActiveHold}
            accent={accent}
            isDark={isDark}
            fullScreen
            showConnector
          />

          {/* Hold tabs — floating at top */}
          {state.hasSelection && (
            <View style={{ position: 'absolute', top: 12, left: 320, right: 12 }}>
              <HoldTabBar
                active={state.activeHold}
                onSelect={state.setActiveHold}
                holds={state.allHolds}
                accent={accent}
                palette={palette}
                isDark={isDark}
              />
            </View>
          )}

          {/* Loading dock — floating right */}
          {state.hasSelection && (
            <View
              style={{
                position: 'absolute',
                right: 12,
                bottom: tabBarHeight + 8,
                width: 280,
              }}
            >
              <LoadingDock items={state.dockItems} accent={accent} palette={palette} isDark={isDark} />
            </View>
          )}

          {/* Left panel — floating, collapsible */}
          <View
            style={{
              position: 'absolute',
              left: 12,
              bottom: tabBarHeight + 8,
              width: 300,
              ...(!panelCollapsed ? { top: 12 } : {}),
            }}
          >
            {panelCollapsed ? (
              /* Collapsed: faint minimal card */
              <Pressable
                onPress={() => setPanelCollapsed(false)}
                className="rounded-xl p-3.5"
                style={{
                  backgroundColor: isDark ? 'rgba(20,20,24,0.6)' : 'rgba(255,255,255,0.5)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)',
                }}
              >
                <View className="items-center mb-1.5" style={{ opacity: 0.7 }}>
                  <ChevronUp size={16} strokeWidth={2.5} color={palette.text} />
                </View>
                {state.selectedFlight ? (
                  <>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>
                        {state.selectedFlight.id}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 10,
                          overflow: 'hidden',
                          backgroundColor: `${accent}20`,
                          color: accent,
                        }}
                      >
                        {state.selectedFlight.status.charAt(0).toUpperCase() + state.selectedFlight.status.slice(1)}
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-1.5">
                      <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>
                        {state.selectedFlight.dep}
                      </Text>
                      <View
                        className="flex-1 mx-2"
                        style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                      />
                      <PlaneTakeoff size={13} color={palette.textTertiary} style={{ marginHorizontal: 4 }} />
                      <View
                        className="flex-1 mx-2"
                        style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                      />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>
                        {state.selectedFlight.arr}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text style={{ fontSize: 11, color: palette.textTertiary }}>
                        {state.selectedFlight.std} — {state.selectedFlight.sta}
                      </Text>
                      <Text style={{ fontSize: 11, color: palette.textTertiary }}>
                        {state.selectedFlight.aircraftType} · {state.selectedFlight.tailNumber}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={{ fontSize: 13, color: palette.textTertiary, textAlign: 'center', paddingVertical: 4 }}>
                    Select a flight
                  </Text>
                )}
              </Pressable>
            ) : (
              /* Expanded: full panel */
              <ScrollView
                className="flex-1 rounded-xl"
                contentContainerStyle={{ padding: 12 }}
                style={{
                  backgroundColor: isDark ? 'rgba(20,20,24,0.85)' : 'rgba(255,255,255,0.75)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)',
                  borderRadius: 12,
                }}
              >
                <Pressable
                  onPress={() => setPanelCollapsed(true)}
                  className="items-center mb-1"
                  style={{ opacity: 0.7 }}
                >
                  <ChevronDown size={16} strokeWidth={2.5} color={palette.text} />
                </Pressable>
                <FlightPickerBar
                  selectedFlight={state.selectedFlight}
                  showPicker={state.showPicker}
                  setShowPicker={state.setShowPicker}
                  search={state.searchQuery}
                  setSearch={state.setSearchQuery}
                  filteredFlights={state.filteredFlights}
                  onPickFlight={state.selectFlight}
                  selectedId={state.selectedFlightId}
                  palette={palette}
                  accent={accent}
                  isDark={isDark}
                />

                {state.selectedFlight ? (
                  <>
                    <FlightCard flight={state.selectedFlight} accent={accent} />
                    <KpiStrip
                      totalWeight={state.totalWeight}
                      totalCapacity={state.totalCapacity}
                      cgMac={state.cgMac}
                      dockCount={state.dockCount}
                      accent={accent}
                      palette={palette}
                    />
                    <CgSection cgMac={state.cgMac} accent={accent} palette={palette} isDark={isDark} />
                    <ManifestSection holds={state.allHolds} accent={accent} palette={palette} isDark={isDark} />
                    <CargoActionBar accent={accent} palette={palette} isDark={isDark} />
                  </>
                ) : (
                  <CargoEmptyState palette={palette} />
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    )

  // ── Phone layout ──
  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="5.1.1" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <FlightPickerBar
          selectedFlight={state.selectedFlight}
          showPicker={state.showPicker}
          setShowPicker={state.setShowPicker}
          search={state.searchQuery}
          setSearch={state.setSearchQuery}
          filteredFlights={state.filteredFlights}
          onPickFlight={state.selectFlight}
          selectedId={state.selectedFlightId}
          palette={palette}
          accent={accent}
          isDark={isDark}
        />

        {state.selectedFlight ? (
          <>
            <FlightCard flight={state.selectedFlight} accent={accent} />
            <KpiStrip
              totalWeight={state.totalWeight}
              totalCapacity={state.totalCapacity}
              cgMac={state.cgMac}
              dockCount={state.dockCount}
              accent={accent}
              palette={palette}
            />
            <HoldTabBar
              active={state.activeHold}
              onSelect={state.setActiveHold}
              holds={state.allHolds}
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
            <CgSection cgMac={state.cgMac} accent={accent} palette={palette} isDark={isDark} />
            <ManifestSection holds={state.allHolds} accent={accent} palette={palette} isDark={isDark} />
            <LoadingDock items={state.dockItems} accent={accent} palette={palette} isDark={isDark} />
            <CargoActionBar accent={accent} palette={palette} isDark={isDark} />
          </>
        ) : (
          <CargoEmptyState palette={palette} />
        )}
      </ScrollView>
    </View>
  )
}
