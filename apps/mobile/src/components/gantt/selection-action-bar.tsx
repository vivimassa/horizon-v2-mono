// Top action bar shown while in long-press selection mode.
// Slides down via Reanimated when selectionMode flips on. Two-step:
//   Step A: rotation label + Select All / Done
//   Step B: scope picker — Selected Day / Entire Period
//   Step C (confirmed): mutation actions — Assign / Swap / Cancel / Reschedule

import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View, Text, Pressable } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'

const HEIGHT = 56

export function SelectionActionBar() {
  const { palette, accent, isDark } = useAppTheme()
  const selectionMode = useMobileGanttStore((s) => s.selectionMode)
  const rotationId = useMobileGanttStore((s) => s.selectionRotationId)
  const selected = useMobileGanttStore((s) => s.selectedFlightIds)
  const selectionDayDate = useMobileGanttStore((s) => s.selectionDayDate)
  const flights = useMobileGanttStore((s) => s.flights)
  const selectRotationScope = useMobileGanttStore((s) => s.selectRotationScope)
  const clearSelection = useMobileGanttStore((s) => s.clearSelection)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)
  const confirmed = useMobileGanttStore((s) => s.selectionConfirmed)

  const offsetY = useSharedValue(-HEIGHT)
  const [scopeStep, setScopeStep] = useState(false)

  useEffect(() => {
    offsetY.value = withSpring(selectionMode ? 0 : -HEIGHT, { damping: 18, stiffness: 200 })
  }, [selectionMode, offsetY])

  // Reset scope-picker step whenever selection toggles off.
  useEffect(() => {
    if (!selectionMode) setScopeStep(false)
  }, [selectionMode])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.value }],
  }))

  const rotationLabel =
    rotationId && !rotationId.startsWith('__solo_')
      ? (flights.find((f) => f.rotationId === rotationId)?.rotationLabel ?? rotationId)
      : 'Single flight'

  const selectedAcType = useMemo(() => {
    const ids = [...selected]
    if (ids.length === 0) return null
    const types = new Set(
      ids.map((id) => flights.find((f) => f.id === id)?.aircraftTypeIcao).filter(Boolean) as string[],
    )
    return types.size === 1 ? [...types][0] : null
  }, [selected, flights])

  const handleAssign = () =>
    openMutationSheet({ kind: 'assign', flightIds: [...selected], aircraftTypeIcao: selectedAcType })
  const handleCancel = () => openMutationSheet({ kind: 'cancel', flightIds: [...selected] })
  const handleReschedule = () => {
    const first = [...selected][0]
    if (!first) return
    openMutationSheet({ kind: 'reschedule', flightId: first })
  }
  const handleSwap = () => {
    const ids = [...selected]
    if (ids.length < 2) return
    const half = Math.floor(ids.length / 2)
    openMutationSheet({ kind: 'swap', aFlightIds: ids.slice(0, half), bFlightIds: ids.slice(half) })
  }
  const handleDivert = () => {
    const first = [...selected][0]
    if (!first) return
    openMutationSheet({ kind: 'divert', flightId: first })
  }

  const handleSelectAll = () => setScopeStep(true)

  const pickScope = (scope: 'day' | 'period') => {
    selectRotationScope(scope, selectionDayDate)
    setScopeStep(false)
    // Open detail sheet on Cycle tab if rotation, else Flight tab.
    const firstId = Array.from(useMobileGanttStore.getState().selectedFlightIds)[0]
    if (firstId) openDetailSheet({ kind: 'flight', flightId: firstId })
  }

  return (
    <Animated.View
      pointerEvents={selectionMode ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEIGHT,
          backgroundColor: isDark ? 'rgba(12,12,20,0.96)' : 'rgba(250,250,252,0.96)',
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          gap: 10,
          zIndex: 50,
        },
        animStyle,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: palette.textSecondary, fontWeight: '600' }} numberOfLines={1}>
          {rotationLabel}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 1 }}>{selected.size} selected</Text>
      </View>

      {!confirmed && !scopeStep && (
        <>
          <Pill label="Select All" onPress={handleSelectAll} primary accent={accent} />
          <Pill label="Done" onPress={clearSelection} palette={palette} />
        </>
      )}
      {!confirmed && scopeStep && (
        <>
          <Pill label="Selected Day" onPress={() => pickScope('day')} primary accent={accent} />
          <Pill label="Entire Period" onPress={() => pickScope('period')} primary accent={accent} />
          <Pill label="Cancel" onPress={() => setScopeStep(false)} palette={palette} />
        </>
      )}
      {confirmed && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
        >
          <Pill label="Assign" onPress={handleAssign} primary accent={accent} />
          {selected.size >= 2 && <Pill label="Swap" onPress={handleSwap} primary accent={accent} />}
          {selected.size === 1 && <Pill label="Reschedule" onPress={handleReschedule} primary accent={accent} />}
          {selected.size === 1 && <Pill label="Divert" onPress={handleDivert} primary accent={accent} />}
          <Pill label="Cancel" onPress={handleCancel} palette={palette} />
          <Pill label="Done" onPress={clearSelection} palette={palette} />
        </ScrollView>
      )}
    </Animated.View>
  )
}

function Pill({
  label,
  onPress,
  primary,
  accent,
  palette,
}: {
  label: string
  onPress: () => void
  primary?: boolean
  accent?: string
  palette?: { card: string; cardBorder: string; text: string }
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: primary ? accent : palette?.card,
        borderWidth: primary ? 0 : 1,
        borderColor: palette?.cardBorder,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: primary ? '#fff' : palette?.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
