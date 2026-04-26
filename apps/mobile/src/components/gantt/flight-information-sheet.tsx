// Flight Information Sheet — 95% snap, top tab bar, 8 tabs.
// Reachable via the "Edit details" button on the flight detail sheet.

import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { X } from 'lucide-react-native'
import { Icon } from '@skyhub/ui'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { TimesTab } from './info/times-tab'
import { DelaysTab } from './info/delays-tab'
import { PassengersTab } from './info/passengers-tab'
import { FuelCargoTab } from './info/fuel-cargo-tab'
import { CrewTab } from './info/crew-tab'
import { MemosTab } from './info/memos-tab'
import { MessagesTab } from './info/messages-tab'
import { AuditTab } from './info/audit-tab'

const TABS = [
  { key: 'times', label: 'Times' },
  { key: 'delays', label: 'Delays' },
  { key: 'pax', label: 'Pax' },
  { key: 'fuelcargo', label: 'Fuel/Cargo' },
  { key: 'crew', label: 'Crew' },
  { key: 'memos', label: 'Memos' },
  { key: 'messages', label: 'Messages' },
  { key: 'audit', label: 'Audit' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function FlightInformationSheet() {
  const { palette, accent } = useAppTheme()
  const ref = useRef<BottomSheet>(null)
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)

  const open = target?.kind === 'editFlight'
  const flightId = open ? target.flightId : null
  const flight = useMemo(() => flights.find((f) => f.id === flightId) ?? null, [flights, flightId])

  const [tab, setTab] = useState<TabKey>('times')

  useEffect(() => {
    if (open) {
      setTab('times')
      ref.current?.snapToIndex(0)
    } else {
      ref.current?.close()
    }
  }, [open])

  const snapPoints = useMemo(() => ['95%'], [])

  return (
    <BottomSheet
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      index={-1}
      onClose={() => closeMutationSheet()}
      backgroundStyle={{ backgroundColor: palette.card }}
      handleIndicatorStyle={{ backgroundColor: palette.textTertiary }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingBottom: 8,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text, fontFamily: 'monospace' }}>
              {flight ? `${flight.flightNumber} · ${flight.depStation}-${flight.arrStation}` : 'Flight'}
            </Text>
            {flight && (
              <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>
                {flight.operatingDate} · {flight.aircraftReg ?? 'unassigned'} · {flight.status}
              </Text>
            )}
          </View>
          <Pressable onPress={() => closeMutationSheet()} hitSlop={8} style={{ padding: 4 }}>
            <Icon icon={X} size="md" color={palette.textSecondary} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 6,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? accent : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : palette.text }}>
                  {t.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Body */}
        <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {flight && tab === 'times' && <TimesTab flight={flight} />}
          {flight && tab === 'delays' && <DelaysTab flight={flight} />}
          {flight && tab === 'pax' && <PassengersTab flight={flight} />}
          {flight && tab === 'fuelcargo' && <FuelCargoTab flight={flight} />}
          {flight && tab === 'crew' && <CrewTab flight={flight} />}
          {flight && tab === 'memos' && <MemosTab flight={flight} />}
          {flight && tab === 'messages' && <MessagesTab flight={flight} />}
          {flight && tab === 'audit' && <AuditTab flight={flight} />}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheet>
  )
}
