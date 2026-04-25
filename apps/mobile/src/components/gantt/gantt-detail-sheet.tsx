// Gantt detail bottom sheet — Flight / Cycle / Aircraft / Day tabs.
// Driven by store's detailSheet target. Tab availability adapts to the target
// (e.g. Cycle hidden when no rotationId on the selected flight).

import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { FlightTab } from './detail/flight-tab'
import { CycleTab } from './detail/cycle-tab'
import { AircraftTab } from './detail/aircraft-tab'
import { DayTab } from './detail/day-tab'

type TabKey = 'flight' | 'cycle' | 'aircraft' | 'day'

export function GanttDetailSheet() {
  const { palette, isDark, accent } = useAppTheme()
  const target = useMobileGanttStore((s) => s.detailSheet)
  const closeDetailSheet = useMobileGanttStore((s) => s.closeDetailSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const aircraft = useMobileGanttStore((s) => s.aircraft)
  const aircraftTypes = useMobileGanttStore((s) => s.aircraftTypes)

  const ref = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['40%', '75%', '95%'], [])

  // Resolve the focused entity from the target.
  const flight = useMemo(() => {
    if (target?.kind !== 'flight') return null
    return flights.find((f) => f.id === target.flightId) ?? null
  }, [target, flights])

  // Default tab based on what was tapped, but the user can swap.
  const [tab, setTab] = useState<TabKey>('flight')
  useEffect(() => {
    if (!target) return
    if (target.kind === 'flight') setTab('flight')
    else if (target.kind === 'aircraft') setTab('aircraft')
    else if (target.kind === 'day') setTab('day')
  }, [target])

  // Open / close the sheet in response to target changes.
  useEffect(() => {
    if (target) ref.current?.snapToIndex(0)
    else ref.current?.close()
  }, [target])

  // Tabs available depend on the target.
  const tabs = useMemo<TabKey[]>(() => {
    if (target?.kind === 'flight') {
      const base: TabKey[] = ['flight']
      if (flight?.rotationId) base.push('cycle')
      if (flight?.aircraftReg) base.push('aircraft')
      base.push('day')
      return base
    }
    if (target?.kind === 'aircraft') return ['aircraft', 'day']
    if (target?.kind === 'day') return ['day']
    return ['flight']
  }, [target, flight])

  // Coalesce focused registration / date for non-flight tabs.
  const focusReg = target?.kind === 'aircraft' ? target.registration : (flight?.aircraftReg ?? null)
  const focusDate = target?.kind === 'day' ? target.date : (flight?.operatingDate ?? null)

  return (
    <BottomSheet
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      index={-1}
      onClose={closeDetailSheet}
      backgroundStyle={{ backgroundColor: palette.card }}
      handleIndicatorStyle={{ backgroundColor: palette.textTertiary }}
    >
      {/* Tab bar */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingBottom: 12,
          gap: 6,
        }}
      >
        {tabs.map((t) => {
          const active = tab === t
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? accent : 'transparent',
                borderWidth: 1,
                borderColor: active ? accent : palette.cardBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: active ? '#fff' : palette.text,
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {tab === 'flight' && flight && <FlightTab flight={flight} allFlights={flights} />}
        {tab === 'flight' && !flight && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, color: palette.textSecondary }}>Flight not found in the loaded period.</Text>
          </View>
        )}
        {tab === 'cycle' && flight?.rotationId && (
          <CycleTab rotationId={flight.rotationId} rotationLabel={flight.rotationLabel} allFlights={flights} />
        )}
        {tab === 'aircraft' && focusReg && (
          <AircraftTab registration={focusReg} allFlights={flights} aircraft={aircraft} aircraftTypes={aircraftTypes} />
        )}
        {tab === 'aircraft' && !focusReg && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, color: palette.textSecondary }}>No aircraft assigned.</Text>
          </View>
        )}
        {tab === 'day' && focusDate && <DayTab date={focusDate} allFlights={flights} aircraft={aircraft} />}
      </BottomSheetScrollView>
    </BottomSheet>
  )

  void isDark
}
