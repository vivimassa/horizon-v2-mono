// Filter sheet for the mobile Gantt — period + AC type + status + Go.

import { useMemo, useRef, useEffect, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { LinearGradient } from 'expo-linear-gradient'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'

interface Props {
  operatorId: string | null
}

const STATUS_OPTIONS = ['draft', 'active', 'suspended', 'cancelled']

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
              colors={['#1e40af', '#3b6cf5']}
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
          fontSize: 12,
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
      <Text style={{ fontSize: 11, color: palette.textSecondary, marginBottom: 4 }}>{label}</Text>
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
