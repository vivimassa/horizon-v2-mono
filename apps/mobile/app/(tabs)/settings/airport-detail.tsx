import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, setApiBaseUrl, type AirportRef } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2,
  Info, Plane, Radio, Users,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'

setApiBaseUrl('http://192.168.1.101:3002')

type TabKey = 'basic' | 'runway' | 'operations' | 'crew'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'basic', label: 'Basic', icon: Info },
  { key: 'runway', label: 'Runway', icon: Plane },
  { key: 'operations', label: 'Ops', icon: Radio },
  { key: 'crew', label: 'Crew', icon: Users },
]

export default function AirportDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()

  const [airport, setAirport] = useState<AirportRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<AirportRef>>({})

  useEffect(() => {
    if (!id) return
    api.getAirport(id).then(setAirport).catch(console.error).finally(() => setLoading(false))
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

  const handleDelete = useCallback(() => {
    if (!airport) return
    Alert.alert(
      'Delete Airport',
      `Are you sure you want to delete ${airport.name} (${airport.icaoCode})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAirport(airport._id)
              router.back()
            } catch (err: any) {
              // Parse friendly error
              let msg = err.message || 'Delete failed'
              try {
                const match = msg.match(/API (\d+): (.+)/)
                if (match) {
                  const parsed = JSON.parse(match[2])
                  msg = parsed.error || msg
                }
              } catch { /* use raw */ }
              Alert.alert('Cannot Delete', msg)
            }
          },
        },
      ]
    )
  }, [airport, router])

  if (loading || !airport) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>
            {loading ? 'Loading…' : 'Airport not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 }} numberOfLines={1}>
              {airport.name}
            </Text>
            {airport.isActive ? (
              <View className="px-2.5 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
              </View>
            ) : (
              <View className="px-2.5 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraft({}) }} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleDelete} className="active:opacity-60">
                  <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={() => { setDraft({}); setEditing(true) }}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Code pills */}
        <View className="flex-row items-center mt-2" style={{ gap: 8, marginLeft: 36 }}>
          <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>IATA: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: palette.text }}>{airport.iataCode ?? '—'}</Text></Text>
          </View>
          <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>ICAO: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: palette.text }}>{airport.icaoCode}</Text></Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row" style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', gap: 6 }}>
              <Icon size={15} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <Text style={{ fontSize: 15, fontWeight: active ? '600' : '500', color: active ? accent : palette.textSecondary }}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Tab content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === 'basic' && (
          <>
            <Field label="IATA Code" value={airport.iataCode} editing={editing} fieldKey="iataCode" editValue={get('iataCode')} onChange={handleFieldChange} palette={palette} />
            <Field label="ICAO Code" value={airport.icaoCode} editing={editing} fieldKey="icaoCode" editValue={get('icaoCode')} onChange={handleFieldChange} palette={palette} />
            <Field label="Airport Name" value={airport.name} editing={editing} fieldKey="name" editValue={get('name')} onChange={handleFieldChange} palette={palette} />
            <Field label="City" value={airport.city} editing={editing} fieldKey="city" editValue={get('city')} onChange={handleFieldChange} palette={palette} />
            <Field label="Country" value={airport.countryName ?? airport.country} editing={editing} fieldKey="countryName" editValue={get('countryName')} onChange={handleFieldChange} palette={palette} />
            <Field label="Timezone" value={airport.timezone} editing={editing} fieldKey="timezone" editValue={get('timezone')} onChange={handleFieldChange} palette={palette} />
            <Field label="Latitude" value={airport.latitude?.toFixed(6)} editing={editing} fieldKey="latitude" editValue={get('latitude')} onChange={handleFieldChange} palette={palette} numeric />
            <Field label="Longitude" value={airport.longitude?.toFixed(6)} editing={editing} fieldKey="longitude" editValue={get('longitude')} onChange={handleFieldChange} palette={palette} numeric />
            <Field label="Elevation (ft)" value={airport.elevationFt} editing={editing} fieldKey="elevationFt" editValue={get('elevationFt')} onChange={handleFieldChange} palette={palette} numeric />
            <ToggleField label="Active" value={airport.isActive} editing={editing} fieldKey="isActive" editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
          </>
        )}
        {activeTab === 'runway' && (
          <>
            <Field label="Number of Runways" value={airport.numberOfRunways} editing={editing} fieldKey="numberOfRunways" editValue={get('numberOfRunways')} onChange={handleFieldChange} palette={palette} numeric />
            <Field label="Longest Runway (ft)" value={airport.longestRunwayFt?.toLocaleString()} editing={editing} fieldKey="longestRunwayFt" editValue={get('longestRunwayFt')} onChange={handleFieldChange} palette={palette} numeric />
            <Field label="Number of Gates" value={airport.numberOfGates} editing={editing} fieldKey="numberOfGates" editValue={get('numberOfGates')} onChange={handleFieldChange} palette={palette} numeric />
            <Field label="Fire Category" value={airport.fireCategory} editing={editing} fieldKey="fireCategory" editValue={get('fireCategory')} onChange={handleFieldChange} palette={palette} numeric />
            <ToggleField label="Fuel Available" value={airport.hasFuelAvailable} editing={editing} fieldKey="hasFuelAvailable" editValue={get('hasFuelAvailable')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
            <ToggleField label="Crew Facilities" value={airport.hasCrewFacilities} editing={editing} fieldKey="hasCrewFacilities" editValue={get('hasCrewFacilities')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
          </>
        )}
        {activeTab === 'operations' && (
          <>
            <ToggleField label="Slot Controlled" value={airport.isSlotControlled} editing={editing} fieldKey="isSlotControlled" editValue={get('isSlotControlled')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
            <ToggleField label="Has Curfew" value={airport.hasCurfew} editing={editing} fieldKey="hasCurfew" editValue={get('hasCurfew')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
            <Field label="Curfew Start" value={airport.curfewStart} editing={editing} fieldKey="curfewStart" editValue={get('curfewStart')} onChange={handleFieldChange} palette={palette} />
            <Field label="Curfew End" value={airport.curfewEnd} editing={editing} fieldKey="curfewEnd" editValue={get('curfewEnd')} onChange={handleFieldChange} palette={palette} />
            <ToggleField label="Weather Monitored" value={airport.weatherMonitored} editing={editing} fieldKey="weatherMonitored" editValue={get('weatherMonitored')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
            <Field label="Weather Station" value={airport.weatherStation} editing={editing} fieldKey="weatherStation" editValue={get('weatherStation')} onChange={handleFieldChange} palette={palette} />
            <ToggleField label="Home Base" value={airport.isHomeBase} editing={editing} fieldKey="isHomeBase" editValue={get('isHomeBase')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
            <Field label="UTC Offset" value={airport.utcOffsetHours != null ? `UTC${airport.utcOffsetHours >= 0 ? '+' : ''}${airport.utcOffsetHours}` : null} editing={editing} fieldKey="utcOffsetHours" editValue={get('utcOffsetHours')} onChange={handleFieldChange} palette={palette} numeric />
          </>
        )}
        {activeTab === 'crew' && (
          <>
            <ToggleField label="Crew Base" value={airport.isCrewBase} editing={editing} fieldKey="isCrewBase" editValue={get('isCrewBase')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
            <Field label="Crew Reporting Time (min)" value={airport.crewReportingTimeMinutes != null ? `${airport.crewReportingTimeMinutes} min` : null} editing={editing} fieldKey="crewReportingTimeMinutes" editValue={get('crewReportingTimeMinutes')} onChange={handleFieldChange} palette={palette} numeric />
            <Field label="Crew Debrief Time (min)" value={airport.crewDebriefTimeMinutes != null ? `${airport.crewDebriefTimeMinutes} min` : null} editing={editing} fieldKey="crewDebriefTimeMinutes" editValue={get('crewDebriefTimeMinutes')} onChange={handleFieldChange} palette={palette} numeric />
            <ToggleField label="Crew Facilities" value={airport.hasCrewFacilities} editing={editing} fieldKey="hasCrewFacilities" editValue={get('hasCrewFacilities')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Field components ──

function Field({ label, value, editing, fieldKey, editValue, onChange, palette, numeric }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; numeric?: boolean
}) {
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 15, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)}
          keyboardType={numeric ? 'numeric' : 'default'}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3), paddingVertical: 4 }}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 15, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '—'}</Text>
    </View>
  )
}

function ToggleField({ label, value, editing, fieldKey, editValue, onChange, palette, isDark }: {
  label: string; value: boolean; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean
}) {
  const current = editing ? !!editValue : value
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
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
