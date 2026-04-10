import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'

export default function CrewBaseDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [airport, setAirport] = useState<AirportRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<AirportRef>>({})

  useEffect(() => {
    if (!id) return
    setError(null)
    api.getAirport(id)
      .then(setAirport)
      .catch((err: any) => setError(err.message || 'Failed to load crew base'))
      .finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!airport || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateAirport(airport._id, draft)
      setAirport(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [airport, draft])

  const handleRemoveBase = useCallback(() => {
    if (!airport) return
    Alert.alert(
      'Remove Crew Base',
      `Remove crew base status from ${airport.name} (${airport.icaoCode})?\n\nThe airport record will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.updateAirport(airport._id, { isCrewBase: false })
              router.back()
            } catch (err: any) {
              Alert.alert('Remove Failed', err.message || 'Could not remove crew base status')
            }
          },
        },
      ]
    )
  }, [airport, router])

  if (loading || (!airport && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading...' : 'Crew base not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!airport) return null

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 }} numberOfLines={1}>
              {airport.name}
            </Text>
          </View>

          {/* Actions */}
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraft({}) }} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="px-4 py-2.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => { setDraft({}); setEditing(true) }}
                className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                <Pencil size={15} color={accent} strokeWidth={1.8} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Map */}
      {airport.latitude != null && airport.longitude != null && (
        <View style={{ height: isTablet ? 300 : 250, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: airport.latitude,
              longitude: airport.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            mapType="standard"
          >
            <Marker
              coordinate={{ latitude: airport.latitude, longitude: airport.longitude }}
              title={airport.name}
              description={`${airport.iataCode ?? ''} / ${airport.icaoCode}`}
              pinColor={accent}
            />
          </MapView>

          {/* Code overlay on map */}
          <View className="absolute top-3 left-3 flex-row" style={{ gap: 6 }}>
            <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.88)', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }) }}>
              <Text style={{ fontSize: 13, color: '#666' }}>IATA: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: '#111' }}>{airport.iataCode ?? '\u2014'}</Text></Text>
            </View>
            <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.88)', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }) }}>
              <Text style={{ fontSize: 13, color: '#666' }}>ICAO: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: '#111' }}>{airport.icaoCode}</Text></Text>
            </View>
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Airport Information (read-only) */}
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Airport Information</Text>
        </View>
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field label="IATA Code" value={airport.iataCode} palette={palette} half={isTablet} />
          <Field label="ICAO Code" value={airport.icaoCode} palette={palette} half={isTablet} />
          <Field label="City" value={airport.city} palette={palette} half={isTablet} />
          <Field label="Country" value={airport.countryName ?? airport.country} palette={palette} half={isTablet} />
          <Field label="Timezone" value={airport.timezone} palette={palette} half={isTablet} />
          <Field label="UTC Offset" value={airport.utcOffsetHours != null ? `UTC${airport.utcOffsetHours >= 0 ? '+' : ''}${airport.utcOffsetHours}` : null} palette={palette} half={isTablet} />
        </View>

        {/* Crew Base Configuration (editable) */}
        <View className="flex-row items-center mt-6 mb-2" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Crew Base Configuration</Text>
        </View>
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <EditableField
            label="Crew Reporting Time (min)"
            value={airport.crewReportingTimeMinutes != null ? `${airport.crewReportingTimeMinutes} min` : null}
            editing={editing}
            fieldKey="crewReportingTimeMinutes"
            editValue={get('crewReportingTimeMinutes')}
            onChange={handleFieldChange}
            palette={palette}
            accent={accent}
            numeric
            half={isTablet}
          />
          <EditableField
            label="Crew Debrief Time (min)"
            value={airport.crewDebriefTimeMinutes != null ? `${airport.crewDebriefTimeMinutes} min` : null}
            editing={editing}
            fieldKey="crewDebriefTimeMinutes"
            editValue={get('crewDebriefTimeMinutes')}
            onChange={handleFieldChange}
            palette={palette}
            accent={accent}
            numeric
            half={isTablet}
          />
          <ToggleField
            label="Crew Facilities"
            value={airport.hasCrewFacilities}
            editing={editing}
            fieldKey="hasCrewFacilities"
            editValue={get('hasCrewFacilities')}
            onChange={handleFieldChange}
            palette={palette}
            isDark={isDark}
            half={isTablet}
          />
        </View>

        {/* Remove Crew Base */}
        {!editing && (
          <View
            className="mt-8 p-4 rounded-xl"
            style={{
              borderWidth: 1,
              borderColor: isDark ? 'rgba(220,38,38,0.3)' : '#fecaca',
              backgroundColor: isDark ? 'rgba(220,38,38,0.08)' : '#fef2f2',
            }}
          >
            <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
              <Trash2 size={16} color={isDark ? '#f87171' : '#dc2626'} strokeWidth={1.8} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>
                Remove Crew Base
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 12 }}>
              This will remove crew base status from this airport. The airport record will not be deleted.
            </Text>
            <Pressable
              onPress={handleRemoveBase}
              className="self-start px-4 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#fee2e2' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>
                Remove Base
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Field components ──

function Field({ label, value, palette, half }: {
  label: string; value: any; palette: Palette; half?: boolean
}) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...(half ? { width: '50%', paddingRight: 12 } : {}) }}>
      <Text style={{ fontSize: 15, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '\u2014'}</Text>
    </View>
  )
}

function EditableField({ label, value, editing, fieldKey, editValue, onChange, palette, accent, numeric, half }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; accent: string; numeric?: boolean; half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 15, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)}
          keyboardType={numeric ? 'numeric' : 'default'}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, borderBottomWidth: 1, borderBottomColor: accentTint(accent, 0.3), paddingVertical: 4 }}
          placeholderTextColor={palette.textTertiary}
          placeholder={numeric ? 'Enter minutes' : undefined}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text style={{ fontSize: 15, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '\u2014'}</Text>
    </View>
  )
}

function ToggleField({ label, value, editing, fieldKey, editValue, onChange, palette, isDark, half }: {
  label: string; value: boolean; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean; half?: boolean
}) {
  const current = editing ? !!editValue : value
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...(half ? { width: '50%', paddingRight: 12 } : {}) }}>
      <Text style={{ fontSize: 15, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {editing ? (
        <Pressable onPress={() => onChange(fieldKey, !editValue)}
          className="self-start px-3 py-1 rounded-lg"
          style={{ backgroundColor: current ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>
            {current ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary }}>
          {value ? 'Yes' : 'No'}
        </Text>
      )}
    </View>
  )
}
