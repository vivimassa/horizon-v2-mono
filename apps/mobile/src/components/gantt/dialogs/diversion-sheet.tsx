// Apply diversion / air-return / ramp-return to a flight.

import { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { api } from '@skyhub/api'
import { useAuthStore } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell, FieldLabel } from './dialog-shell'

type Kind = 'divert' | 'airReturn' | 'rampReturn'

const KIND_OPTIONS: { value: Kind; label: string; needsAirport: boolean }[] = [
  { value: 'divert', label: 'Divert', needsAirport: true },
  { value: 'airReturn', label: 'Air Return', needsAirport: false },
  { value: 'rampReturn', label: 'Ramp Return', needsAirport: false },
]

export function DiversionSheet() {
  const { palette, accent, isDark } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const flights = useMobileGanttStore((s) => s.flights)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)

  const open = target?.kind === 'divert'
  const flightId = open ? target.flightId : null
  const flight = useMemo(() => flights.find((f) => f.id === flightId), [flights, flightId])

  const [kind, setKind] = useState<Kind>('divert')
  const [divertAirportIcao, setDivertAirportIcao] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [confirming, setConfirming] = useState(false)

  const needsAirport = KIND_OPTIONS.find((k) => k.value === kind)?.needsAirport ?? false
  const validAirport = !needsAirport || /^[A-Z]{4}$/.test(divertAirportIcao)

  if (!flight) {
    return <DialogShell open={open} title="Disruption" />
  }

  async function handleConfirm() {
    if (!operatorId || !flightId || !validAirport) return
    setConfirming(true)
    try {
      await api.ganttDivertFlight(flightId, {
        kind,
        divertAirportIcao: needsAirport ? divertAirportIcao.toUpperCase() : null,
        reasonText: reasonText || null,
      })
      showToast('success', 'Disruption applied.')
      closeMutationSheet()
      await refresh(operatorId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <DialogShell
      open={open}
      title="Disrupt flight"
      primaryLabel="Apply"
      primaryDisabled={confirming || !validAirport}
      primaryLoading={confirming}
      onPrimary={handleConfirm}
      secondaryLabel="Cancel"
    >
      <Text style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace', marginBottom: 12 }}>
        {flight.flightNumber} · {flight.depStation}-{flight.arrStation} · {flight.operatingDate}
      </Text>

      <FieldLabel label="DISRUPTION TYPE" palette={palette} />
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {KIND_OPTIONS.map((opt, i) => {
          const active = opt.value === kind
          return (
            <Pressable
              key={opt.value}
              onPress={() => setKind(opt.value)}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.18)' : 'rgba(62,123,250,0.10)') : 'transparent',
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: palette.cardBorder,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? accent : palette.text }}>
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {needsAirport && (
        <>
          <FieldLabel label="DIVERT AIRPORT (ICAO)" palette={palette} />
          <TextInput
            value={divertAirportIcao}
            onChangeText={(v) => setDivertAirportIcao(v.toUpperCase())}
            placeholder="VVTS"
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
            style={{
              height: 40,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: validAirport ? palette.cardBorder : '#FF3B3B',
              backgroundColor: palette.background,
              paddingHorizontal: 10,
              fontSize: 14,
              color: palette.text,
              fontFamily: 'monospace',
              marginBottom: 12,
            }}
          />
        </>
      )}

      <FieldLabel label="REASON" palette={palette} />
      <TextInput
        value={reasonText}
        onChangeText={setReasonText}
        placeholder="Operational notes…"
        placeholderTextColor={palette.textTertiary}
        multiline
        numberOfLines={3}
        style={{
          minHeight: 70,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          backgroundColor: palette.background,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 13,
          color: palette.text,
          textAlignVertical: 'top',
        }}
      />
    </DialogShell>
  )
}
