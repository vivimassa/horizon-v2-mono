import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type ScheduledFlightRef } from '@skyhub/api'
import { ChevronLeft, Save, Trash2 } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { FrequencyPicker } from '../../../components/schedule/frequency-picker'
import { StationPicker } from '../../../components/schedule/station-picker'

const STATUSES = ['draft', 'active', 'suspended', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  active: '#16a34a',
  suspended: '#f59e0b',
  cancelled: '#dc2626',
}

export default function ScheduleFlightDetailScreen() {
  const router = useRouter()
  const { id, isNew } = useLocalSearchParams<{ id: string; isNew?: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [flight, setFlight] = useState<ScheduledFlightRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [stationField, setStationField] = useState<'dep' | 'arr' | null>(null)

  useEffect(() => {
    if (!id) return
    if (isNew === '1') {
      // New flight — create empty shell
      setFlight({
        _id: id,
        operatorId,
        seasonCode: '',
        airlineCode: '',
        flightNumber: '',
        suffix: null,
        depStation: '',
        arrStation: '',
        depAirportId: null,
        arrAirportId: null,
        stdUtc: '',
        staUtc: '',
        stdLocal: null,
        staLocal: null,
        blockMinutes: null,
        departureDayOffset: 1,
        arrivalDayOffset: 1,
        daysOfWeek: '1234567',
        aircraftTypeId: null,
        aircraftTypeIcao: null,
        aircraftReg: null,
        serviceType: 'J',
        status: 'draft',
        previousStatus: null,
        effectiveFrom: '',
        effectiveUntil: '',
        cockpitCrewRequired: null,
        cabinCrewRequired: null,
        isEtops: false,
        isOverwater: false,
        isActive: true,
        scenarioId: null,
        rotationId: null,
        rotationSequence: null,
        rotationLabel: null,
        source: 'manual',
        sortOrder: 0,
        formatting: {},
        createdAt: null,
        updatedAt: null,
      })
      setLoading(false)
      return
    }
    api
      .getScheduledFlight(id)
      .then(setFlight)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, isNew, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (flight as any)?.[key])
  const handleChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!flight) return
    const merged = { ...flight, ...draft }
    if (!merged.flightNumber || !merged.depStation || !merged.arrStation) {
      Alert.alert('Validation', 'Flight number, DEP, and ARR are required.')
      return
    }
    setSaving(true)
    try {
      if (isNew === '1') {
        const { _id, ...rest } = merged
        await api.createScheduledFlight(rest)
      } else {
        if (Object.keys(draft).length > 0) {
          await api.updateScheduledFlight(flight._id, draft)
        }
      }
      router.back()
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save flight')
    } finally {
      setSaving(false)
    }
  }, [flight, draft, isNew, router])

  const handleDelete = useCallback(() => {
    if (!flight || isNew === '1') {
      router.back()
      return
    }
    Alert.alert('Delete Flight', `Delete ${flight.airlineCode}${flight.flightNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteScheduledFlight(flight._id)
            router.back()
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed')
          }
        },
      },
    ])
  }, [flight, isNew, router])

  if (loading || !flight) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading...' : 'Flight not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const displayFlight = `${get('airlineCode') || ''}${get('flightNumber') || 'New Flight'}`
  const statusColor = STATUS_COLORS[get('status') ?? 'draft'] ?? palette.textTertiary

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <Text style={{ fontSize: 20, fontWeight: '700', fontFamily: 'monospace', color: accent, marginRight: 8 }}>
              {displayFlight}
            </Text>
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statusColor}20` }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor, textTransform: 'uppercase' }}>
                {get('status')}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable onPress={handleDelete} className="active:opacity-60">
              <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="flex-row items-center px-4 py-2 rounded-lg active:opacity-60"
              style={{ backgroundColor: accent, gap: 5, opacity: saving ? 0.5 : 1 }}
            >
              <Save size={15} color="#fff" strokeWidth={2} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Route & Flight */}
        <SectionBar label="Route & Flight" color={accent} />
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field
            label="Airline Code"
            value={get('airlineCode')}
            fieldKey="airlineCode"
            onChange={handleChange}
            palette={palette}
            mono
            maxLength={2}
            half={isTablet}
            placeholder="e.g. VJ"
          />
          <Field
            label="Flight Number"
            value={get('flightNumber')}
            fieldKey="flightNumber"
            onChange={handleChange}
            palette={palette}
            mono
            maxLength={8}
            half={isTablet}
            placeholder="e.g. 123"
          />
          <StationField
            label="DEP Station"
            value={get('depStation')}
            onPress={() => setStationField('dep')}
            palette={palette}
            accent={accent}
            isDark={isDark}
            half={isTablet}
          />
          <StationField
            label="ARR Station"
            value={get('arrStation')}
            onPress={() => setStationField('arr')}
            palette={palette}
            accent={accent}
            isDark={isDark}
            half={isTablet}
          />
        </View>

        {/* Timing */}
        <SectionBar label="Timing" color={accent} />
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field
            label="STD (UTC)"
            value={get('stdUtc')}
            fieldKey="stdUtc"
            onChange={handleChange}
            palette={palette}
            mono
            half={isTablet}
            placeholder="HH:MM"
            keyboard="numbers-and-punctuation"
          />
          <Field
            label="STA (UTC)"
            value={get('staUtc')}
            fieldKey="staUtc"
            onChange={handleChange}
            palette={palette}
            mono
            half={isTablet}
            placeholder="HH:MM"
            keyboard="numbers-and-punctuation"
          />
          <Field
            label="Block Minutes"
            value={get('blockMinutes')}
            fieldKey="blockMinutes"
            onChange={handleChange}
            palette={palette}
            numeric
            half={isTablet}
            placeholder="Auto"
          />
          <Field
            label="Day Offset"
            value={get('departureDayOffset')}
            fieldKey="departureDayOffset"
            onChange={handleChange}
            palette={palette}
            numeric
            half={isTablet}
            placeholder="1"
          />
        </View>

        {/* Validity & Frequency */}
        <SectionBar label="Validity & Frequency" color={accent} />
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field
            label="Effective From"
            value={get('effectiveFrom')}
            fieldKey="effectiveFrom"
            onChange={handleChange}
            palette={palette}
            mono
            half={isTablet}
            placeholder="YYYY-MM-DD"
          />
          <Field
            label="Effective Until"
            value={get('effectiveUntil')}
            fieldKey="effectiveUntil"
            onChange={handleChange}
            palette={palette}
            mono
            half={isTablet}
            placeholder="YYYY-MM-DD"
          />
        </View>
        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Text
            style={{
              fontSize: 12,
              color: palette.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontWeight: '600',
              marginBottom: 8,
            }}
          >
            Days of Week
          </Text>
          <FrequencyPicker
            value={get('daysOfWeek') ?? '1234567'}
            onChange={(v) => handleChange('daysOfWeek', v)}
            palette={palette}
            accent={accent}
          />
        </View>

        {/* Aircraft & Service */}
        <SectionBar label="Aircraft & Service" color={accent} />
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field
            label="AC Type (ICAO)"
            value={get('aircraftTypeIcao')}
            fieldKey="aircraftTypeIcao"
            onChange={handleChange}
            palette={palette}
            mono
            maxLength={4}
            half={isTablet}
            placeholder="e.g. A320"
          />
          <Field
            label="Service Type"
            value={get('serviceType')}
            fieldKey="serviceType"
            onChange={handleChange}
            palette={palette}
            half={isTablet}
            placeholder="e.g. J"
          />
          <Field
            label="Cockpit Crew"
            value={get('cockpitCrewRequired')}
            fieldKey="cockpitCrewRequired"
            onChange={handleChange}
            palette={palette}
            numeric
            half={isTablet}
          />
          <Field
            label="Cabin Crew"
            value={get('cabinCrewRequired')}
            fieldKey="cabinCrewRequired"
            onChange={handleChange}
            palette={palette}
            numeric
            half={isTablet}
          />
        </View>

        {/* Status */}
        <SectionBar label="Status" color={accent} />
        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <View className="flex-row" style={{ gap: 8 }}>
            {STATUSES.map((s) => {
              const active = (get('status') ?? 'draft') === s
              const c = STATUS_COLORS[s]
              return (
                <Pressable
                  key={s}
                  onPress={() => handleChange('status', s)}
                  className="flex-1 items-center py-2.5 rounded-lg"
                  style={{
                    backgroundColor: active ? `${c}20` : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? c : palette.cardBorder,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: active ? '700' : '400',
                      color: active ? c : palette.text,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </ScrollView>

      {/* Station picker modal */}
      <StationPicker
        visible={stationField !== null}
        onClose={() => setStationField(null)}
        onSelect={(icao) => {
          if (stationField === 'dep') handleChange('depStation', icao)
          else if (stationField === 'arr') handleChange('arrStation', icao)
        }}
        palette={palette}
        accent={accent}
        isDark={isDark}
      />
    </SafeAreaView>
  )
}

function SectionBar({ label, color }: { label: string; color: string }) {
  return (
    <View className="flex-row items-center mt-5 mb-2" style={{ gap: 6 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 14, fontWeight: '700', color }}>{label}</Text>
    </View>
  )
}

function Field({
  label,
  value,
  fieldKey,
  onChange,
  palette,
  mono,
  maxLength,
  numeric,
  half,
  placeholder,
  keyboard,
}: {
  label: string
  value: any
  fieldKey: string
  onChange: (k: string, v: any) => void
  palette: Palette
  mono?: boolean
  maxLength?: number
  numeric?: boolean
  half?: boolean
  placeholder?: string
  keyboard?: any
}) {
  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        ...(half ? { width: '50%', paddingRight: 12 } : {}),
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value != null ? String(value) : ''}
        onChangeText={(v) => {
          if (mono) v = v.toUpperCase()
          onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)
        }}
        autoCapitalize={mono ? 'characters' : 'none'}
        keyboardType={keyboard ?? (numeric ? 'numeric' : 'default')}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        style={{
          fontSize: 15,
          fontWeight: '500',
          color: palette.text,
          fontFamily: mono ? 'monospace' : undefined,
          borderBottomWidth: 1,
          borderBottomColor: accentTint(palette.text, 0.15),
          paddingVertical: 4,
        }}
      />
    </View>
  )
}

function StationField({
  label,
  value,
  onPress,
  palette,
  accent,
  isDark,
  half,
}: {
  label: string
  value: string
  onPress: () => void
  palette: Palette
  accent: string
  isDark: boolean
  half?: boolean
}) {
  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        ...(half ? { width: '50%', paddingRight: 12 } : {}),
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        className="flex-row items-center py-1"
        style={{ borderBottomWidth: 1, borderBottomColor: accentTint(accent, 0.2) }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            fontFamily: 'monospace',
            color: value ? palette.text : palette.textTertiary,
          }}
        >
          {value || 'Select ICAO...'}
        </Text>
      </Pressable>
    </View>
  )
}
