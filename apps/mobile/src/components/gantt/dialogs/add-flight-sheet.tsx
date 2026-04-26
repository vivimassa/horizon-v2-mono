// Add a new draft flight via createScheduledFlightsBulk.

import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { api } from '@skyhub/api'
import { useAuthStore } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell, FieldLabel } from './dialog-shell'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function todayIso(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function combineDateAndTime(dateIso: string, hhmm: string): string | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const mins = parseInt(m[2], 10)
  if (h < 0 || h > 23 || mins < 0 || mins > 59) return null
  return `${dateIso}T${pad(h)}:${pad(mins)}:00.000Z`
}

export function AddFlightSheet() {
  const { palette, accent, isDark } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const aircraftTypes = useMobileGanttStore((s) => s.aircraftTypes)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)

  const open = target?.kind === 'addFlight'

  const [flightNumber, setFlightNumber] = useState('')
  const [airlineCode, setAirlineCode] = useState('')
  const [depStation, setDepStation] = useState('')
  const [arrStation, setArrStation] = useState('')
  const [date, setDate] = useState(todayIso())
  const [stdHHMM, setStdHHMM] = useState('')
  const [staHHMM, setStaHHMM] = useState('')
  const [acTypeIcao, setAcTypeIcao] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) {
      setFlightNumber('')
      setAirlineCode('')
      setDepStation('')
      setArrStation('')
      setDate(todayIso())
      setStdHHMM('')
      setStaHHMM('')
      setAcTypeIcao(null)
    }
  }, [open])

  const stdIso = useMemo(() => combineDateAndTime(date, stdHHMM), [date, stdHHMM])
  const staIso = useMemo(() => combineDateAndTime(date, staHHMM), [date, staHHMM])
  const valid =
    flightNumber.length >= 2 &&
    /^[A-Z]{3,4}$/.test(depStation) &&
    /^[A-Z]{3,4}$/.test(arrStation) &&
    !!stdIso &&
    !!staIso &&
    !!acTypeIcao

  async function handleConfirm() {
    if (!operatorId || !valid || !stdIso || !staIso) return
    setConfirming(true)
    try {
      const blockMins = (new Date(staIso).getTime() - new Date(stdIso).getTime()) / 60_000
      await api.createScheduledFlightsBulk([
        {
          operatorId,
          flightNumber,
          airlineCode: airlineCode || flightNumber.replace(/[^A-Z]/g, '').slice(0, 2),
          depStation,
          arrStation,
          stdUtc: stdIso,
          staUtc: staIso,
          blockMinutes: Math.max(1, Math.round(blockMins)),
          aircraftTypeIcao: acTypeIcao,
          serviceType: 'J',
          status: 'draft' as const,
          source: '1.1.2 Mobile' as const,
          effectiveFrom: date,
          effectiveUntil: date,
          daysOfWeek: '1234567',
        },
      ])
      showToast('success', `Flight ${flightNumber} added.`)
      closeMutationSheet()
      await refresh(operatorId)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Add flight failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <DialogShell
      open={open}
      title="Add flight"
      snapPercent={88}
      primaryLabel="Save"
      primaryDisabled={!valid || confirming}
      primaryLoading={confirming}
      onPrimary={handleConfirm}
      secondaryLabel="Cancel"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field
            label="AIRLINE"
            value={airlineCode}
            onChange={(v) => setAirlineCode(v.toUpperCase())}
            maxLength={3}
            placeholder="VJ"
            palette={palette}
          />
          <Field
            label="FLIGHT #"
            value={flightNumber}
            onChange={(v) => setFlightNumber(v.toUpperCase())}
            maxLength={6}
            placeholder="123"
            palette={palette}
            flex={2}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field
            label="DEP (ICAO)"
            value={depStation}
            onChange={(v) => setDepStation(v.toUpperCase())}
            maxLength={4}
            placeholder="VVTS"
            palette={palette}
            mono
          />
          <Field
            label="ARR (ICAO)"
            value={arrStation}
            onChange={(v) => setArrStation(v.toUpperCase())}
            maxLength={4}
            placeholder="VVNB"
            palette={palette}
            mono
          />
        </View>

        <Field label="DATE (UTC)" value={date} onChange={setDate} placeholder="YYYY-MM-DD" palette={palette} mono />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field label="STD (UTC)" value={stdHHMM} onChange={setStdHHMM} placeholder="HH:MM" palette={palette} mono />
          <Field label="STA (UTC)" value={staHHMM} onChange={setStaHHMM} placeholder="HH:MM" palette={palette} mono />
        </View>

        <FieldLabel label="AIRCRAFT TYPE" palette={palette} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {aircraftTypes.length === 0 && (
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>Refresh the Gantt to load types.</Text>
          )}
          {aircraftTypes.map((t) => {
            const active = acTypeIcao === t.icaoType
            return (
              <Pressable
                key={t.icaoType}
                onPress={() => setAcTypeIcao(t.icaoType)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                  backgroundColor: active
                    ? isDark
                      ? 'rgba(62,123,250,0.18)'
                      : 'rgba(62,123,250,0.10)'
                    : 'transparent',
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
                  {t.icaoType}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </DialogShell>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  palette,
  maxLength,
  mono,
  flex = 1,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  palette: { text: string; textSecondary: string; cardBorder: string; background: string; textTertiary: string }
  maxLength?: number
  mono?: boolean
  flex?: number
}) {
  return (
    <View style={{ flex, marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.textSecondary,
          letterSpacing: 0.6,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={maxLength}
        style={{
          height: 40,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          backgroundColor: palette.background,
          paddingHorizontal: 10,
          fontSize: 14,
          color: palette.text,
          fontFamily: mono ? 'monospace' : undefined,
        }}
      />
    </View>
  )
}
