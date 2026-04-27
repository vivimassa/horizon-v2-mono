// Filter sheet for the mobile Gantt — period + AC type + status + view tweaks
// + overlay toggles + Go.

import { useMemo, useRef, useEffect, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { LinearGradient } from 'expo-linear-gradient'
import { Switch } from '@skyhub/ui'
import type { ColorMode, BarLabelMode } from '@skyhub/types'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'

interface Props {
  operatorId: string | null
}

const STATUS_OPTIONS = ['draft', 'active', 'suspended', 'cancelled']
const COLOR_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'ac_type', label: 'AC Type' },
  { value: 'service_type', label: 'Service' },
  { value: 'route_type', label: 'Route' },
]
const LABEL_OPTIONS: { value: BarLabelMode; label: string }[] = [
  { value: 'flightNo', label: 'Flight #' },
  { value: 'sector', label: 'Sector' },
]

export function GanttFilterSheet({ operatorId }: Props) {
  const { palette, isDark, accent } = useAppTheme()
  const ref = useRef<BottomSheet>(null)
  const open = useMobileGanttStore((s) => s.filterSheetOpen)
  const setOpen = useMobileGanttStore((s) => s.setFilterSheetOpen)
  const periodFrom = useMobileGanttStore((s) => s.periodFrom)
  const periodTo = useMobileGanttStore((s) => s.periodTo)
  const setPeriod = useMobileGanttStore((s) => s.setPeriod)
  const acTypeFilter = useMobileGanttStore((s) => s.acTypeFilter)
  const setAcTypeFilter = useMobileGanttStore((s) => s.setAcTypeFilter)
  const statusFilter = useMobileGanttStore((s) => s.statusFilter)
  const setStatusFilter = useMobileGanttStore((s) => s.setStatusFilter)
  const aircraftTypes = useMobileGanttStore((s) => s.aircraftTypes)
  const commitPeriod = useMobileGanttStore((s) => s.commitPeriod)
  const colorMode = useMobileGanttStore((s) => s.colorMode)
  const setColorMode = useMobileGanttStore((s) => s.setColorMode)
  const barLabelMode = useMobileGanttStore((s) => s.barLabelMode)
  const setBarLabelMode = useMobileGanttStore((s) => s.setBarLabelMode)
  const showTat = useMobileGanttStore((s) => s.showTat)
  const toggleTat = useMobileGanttStore((s) => s.toggleTat)
  const showSlots = useMobileGanttStore((s) => s.showSlots)
  const toggleSlots = useMobileGanttStore((s) => s.toggleSlots)
  const showMissingTimes = useMobileGanttStore((s) => s.showMissingTimes)
  const toggleMissingTimes = useMobileGanttStore((s) => s.toggleMissingTimes)
  const showDelays = useMobileGanttStore((s) => s.showDelays)
  const toggleDelays = useMobileGanttStore((s) => s.toggleDelays)

  useEffect(() => {
    if (open) ref.current?.snapToIndex(0)
    else ref.current?.close()
  }, [open])

  const snapPoints = useMemo(() => ['75%'], [])

  const toggleAc = useCallback(
    (icao: string) => {
      const cur = acTypeFilter ?? []
      const next = cur.includes(icao) ? cur.filter((t) => t !== icao) : [...cur, icao]
      setAcTypeFilter(next.length ? next : null)
    },
    [acTypeFilter, setAcTypeFilter],
  )
  const toggleStatus = useCallback(
    (s: string) => {
      const cur = statusFilter ?? []
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
      setStatusFilter(next.length ? next : null)
    },
    [statusFilter, setStatusFilter],
  )

  const handleGo = async () => {
    if (!operatorId) return
    setOpen(false)
    await commitPeriod(operatorId)
  }

  return (
    <BottomSheet
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      index={-1}
      onClose={() => setOpen(false)}
      backgroundStyle={{ backgroundColor: palette.card }}
      handleIndicatorStyle={{ backgroundColor: palette.textTertiary }}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 16 }}>Filters</Text>

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Section label="PERIOD" palette={palette}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DateField label="From" value={periodFrom} onChange={(v) => setPeriod(v, periodTo)} palette={palette} />
              <DateField label="To" value={periodTo} onChange={(v) => setPeriod(periodFrom, v)} palette={palette} />
            </View>
          </Section>

          <Section label="AIRCRAFT TYPE" palette={palette}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {aircraftTypes.length === 0 && (
                <Text style={{ fontSize: 13, color: palette.textTertiary }}>
                  Hit Go once to load aircraft types from your operator.
                </Text>
              )}
              {aircraftTypes.map((t) => {
                const active = acTypeFilter?.includes(t.icaoType)
                return (
                  <Chip
                    key={t.icaoType}
                    label={t.icaoType}
                    active={!!active}
                    onPress={() => toggleAc(t.icaoType)}
                    palette={palette}
                    accent={accent}
                    isDark={isDark}
                  />
                )
              })}
            </View>
          </Section>

          <Section label="STATUS" palette={palette}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {STATUS_OPTIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={!!statusFilter?.includes(s)}
                  onPress={() => toggleStatus(s)}
                  palette={palette}
                  accent={accent}
                  isDark={isDark}
                />
              ))}
            </View>
          </Section>

          <Section label="COLOR BY" palette={palette}>
            <Segmented
              options={COLOR_OPTIONS}
              value={colorMode}
              onChange={(v) => setColorMode(v as ColorMode)}
              palette={palette}
              accent={accent}
              isDark={isDark}
            />
          </Section>

          <Section label="BAR LABEL" palette={palette}>
            <Segmented
              options={LABEL_OPTIONS}
              value={barLabelMode}
              onChange={(v) => setBarLabelMode(v as BarLabelMode)}
              palette={palette}
              accent={accent}
              isDark={isDark}
            />
          </Section>

          <Section label="OVERLAYS" palette={palette}>
            <ToggleRow label="TAT minutes" value={showTat} onChange={toggleTat} palette={palette} />
            <ToggleRow label="Slot risk" value={showSlots} onChange={toggleSlots} palette={palette} />
            <ToggleRow
              label="Missing OOOI flags"
              value={showMissingTimes}
              onChange={toggleMissingTimes}
              palette={palette}
            />
            <ToggleRow label="Delays" value={showDelays} onChange={toggleDelays} palette={palette} />
          </Section>

          <Pressable
            onPress={handleGo}
            disabled={!operatorId}
            style={{
              marginTop: 12,
              borderRadius: 10,
              overflow: 'hidden',
              opacity: operatorId ? 1 : 0.5,
            }}
          >
            <LinearGradient
              colors={[accent, accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Go</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
  )
}

function Section({
  label,
  children,
  palette,
}: {
  label: string
  children: React.ReactNode
  palette: { textSecondary: string }
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textSecondary,
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

function DateField({
  label,
  value,
  onChange,
  palette,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  palette: { text: string; textSecondary: string; cardBorder: string; card: string; textTertiary: string }
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={palette.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          height: 40,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          backgroundColor: palette.card,
          paddingHorizontal: 10,
          fontSize: 14,
          color: palette.text,
        }}
      />
    </View>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  palette,
  accent,
  isDark,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  palette: { text: string; cardBorder: string }
  accent: string
  isDark: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        overflow: 'hidden',
      }}
    >
      {options.map((opt, i) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.18)' : 'rgba(62,123,250,0.10)') : 'transparent',
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: palette.cardBorder,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: active ? accent : palette.text }}>{opt.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
  palette,
}: {
  label: string
  value: boolean
  onChange: () => void
  palette: { text: string; border: string }
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <Text style={{ fontSize: 14, color: palette.text }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  )
}

function Chip({
  label,
  active,
  onPress,
  palette,
  accent,
  isDark,
}: {
  label: string
  active: boolean
  onPress: () => void
  palette: { text: string; cardBorder: string }
  accent: string
  isDark: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? accent : palette.cardBorder,
        backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.18)' : 'rgba(62,123,250,0.10)') : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: active ? accent : palette.text,
          fontFamily: 'monospace',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
