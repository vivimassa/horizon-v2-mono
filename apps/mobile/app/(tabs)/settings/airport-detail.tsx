import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2,
  Info, Plane, Radio, Users,
  Plus, Lightbulb, Check,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'

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
  const { isTablet } = useDevice()

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
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
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
                  className="px-4 py-2.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleDelete} className="active:opacity-60">
                  <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={() => { setDraft({}); setEditing(true) }}
                  className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
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
              <Text style={{ fontSize: 13, color: '#666' }}>IATA: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: '#111' }}>{airport.iataCode ?? '—'}</Text></Text>
            </View>
            <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.88)', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }) }}>
              <Text style={{ fontSize: 13, color: '#666' }}>ICAO: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: '#111' }}>{airport.icaoCode}</Text></Text>
            </View>
          </View>
        </View>
      )}

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
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <Field label="IATA Code" value={airport.iataCode} editing={editing} fieldKey="iataCode" editValue={get('iataCode')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="ICAO Code" value={airport.icaoCode} editing={editing} fieldKey="icaoCode" editValue={get('icaoCode')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Airport Name" value={airport.name} editing={editing} fieldKey="name" editValue={get('name')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="City" value={airport.city} editing={editing} fieldKey="city" editValue={get('city')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Country" value={airport.countryName ?? airport.country} editing={editing} fieldKey="countryName" editValue={get('countryName')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Timezone" value={airport.timezone} editing={editing} fieldKey="timezone" editValue={get('timezone')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Latitude" value={airport.latitude?.toFixed(6)} editing={editing} fieldKey="latitude" editValue={get('latitude')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
            <Field label="Longitude" value={airport.longitude?.toFixed(6)} editing={editing} fieldKey="longitude" editValue={get('longitude')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
            <Field label="Elevation (ft)" value={airport.elevationFt} editing={editing} fieldKey="elevationFt" editValue={get('elevationFt')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
            <ToggleField label="Active" value={airport.isActive} editing={editing} fieldKey="isActive" editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
          </View>
        )}
        {activeTab === 'runway' && (
          <>
            {/* Runway list */}
            <RunwayList airport={airport} palette={palette} isDark={isDark} accent={accent} onRefresh={() => {
              api.getAirport(airport._id).then(setAirport).catch(console.error)
            }} />

            {/* Facilities */}
            <View className="mt-4 mb-2 flex-row items-center" style={{ gap: 6 }}>
              <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Facilities</Text>
            </View>
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <Field label="Number of Gates" value={airport.numberOfGates} editing={editing} fieldKey="numberOfGates" editValue={get('numberOfGates')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
              <Field label="Fire Category" value={airport.fireCategory} editing={editing} fieldKey="fireCategory" editValue={get('fireCategory')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
              <ToggleField label="Fuel Available" value={airport.hasFuelAvailable} editing={editing} fieldKey="hasFuelAvailable" editValue={get('hasFuelAvailable')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
              <ToggleField label="Crew Facilities" value={airport.hasCrewFacilities} editing={editing} fieldKey="hasCrewFacilities" editValue={get('hasCrewFacilities')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            </View>
          </>
        )}
        {activeTab === 'operations' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <ToggleField label="Slot Controlled" value={airport.isSlotControlled} editing={editing} fieldKey="isSlotControlled" editValue={get('isSlotControlled')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            <ToggleField label="Has Curfew" value={airport.hasCurfew} editing={editing} fieldKey="hasCurfew" editValue={get('hasCurfew')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            <Field label="Curfew Start" value={airport.curfewStart} editing={editing} fieldKey="curfewStart" editValue={get('curfewStart')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Curfew End" value={airport.curfewEnd} editing={editing} fieldKey="curfewEnd" editValue={get('curfewEnd')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <ToggleField label="Weather Monitored" value={airport.weatherMonitored} editing={editing} fieldKey="weatherMonitored" editValue={get('weatherMonitored')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            <Field label="Weather Station" value={airport.weatherStation} editing={editing} fieldKey="weatherStation" editValue={get('weatherStation')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <ToggleField label="Home Base" value={airport.isHomeBase} editing={editing} fieldKey="isHomeBase" editValue={get('isHomeBase')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            <Field label="UTC Offset" value={airport.utcOffsetHours != null ? `UTC${airport.utcOffsetHours >= 0 ? '+' : ''}${airport.utcOffsetHours}` : null} editing={editing} fieldKey="utcOffsetHours" editValue={get('utcOffsetHours')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
          </View>
        )}
        {activeTab === 'crew' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <ToggleField label="Crew Base" value={airport.isCrewBase} editing={editing} fieldKey="isCrewBase" editValue={get('isCrewBase')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            <Field label="Crew Reporting Time (min)" value={airport.crewReportingTimeMinutes != null ? `${airport.crewReportingTimeMinutes} min` : null} editing={editing} fieldKey="crewReportingTimeMinutes" editValue={get('crewReportingTimeMinutes')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
            <Field label="Crew Debrief Time (min)" value={airport.crewDebriefTimeMinutes != null ? `${airport.crewDebriefTimeMinutes} min` : null} editing={editing} fieldKey="crewDebriefTimeMinutes" editValue={get('crewDebriefTimeMinutes')} onChange={handleFieldChange} palette={palette} numeric half={isTablet} />
            <ToggleField label="Crew Facilities" value={airport.hasCrewFacilities} editing={editing} fieldKey="hasCrewFacilities" editValue={get('hasCrewFacilities')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Field components ──

function Field({ label, value, editing, fieldKey, editValue, onChange, palette, numeric, half }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; numeric?: boolean; half?: boolean
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
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3), paddingVertical: 4 }}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text style={{ fontSize: 15, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '—'}</Text>
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

// ── Runway List ──

function RunwayList({ airport, palette, isDark, accent, onRefresh }: {
  airport: AirportRef; palette: Palette; isDark: boolean; accent: string; onRefresh: () => void
}) {
  const runways = airport.runways ?? []
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ identifier: '', lengthFt: '', widthFt: '', surface: 'ASPHALT' })

  const handleAdd = useCallback(async () => {
    if (!form.identifier.trim()) { Alert.alert('Error', 'Identifier is required'); return }
    setSaving(true)
    try {
      const lengthFt = form.lengthFt ? Number(form.lengthFt) : null
      const widthFt = form.widthFt ? Number(form.widthFt) : null
      await api.addRunway(airport._id, {
        identifier: form.identifier.toUpperCase(),
        lengthFt,
        lengthM: lengthFt ? Math.round(lengthFt * 0.3048) : null,
        widthFt,
        widthM: widthFt ? Math.round(widthFt * 0.3048) : null,
        surface: form.surface || null,
        ilsCategory: null,
        lighting: false,
        status: 'active',
        notes: null,
      })
      setForm({ identifier: '', lengthFt: '', widthFt: '', surface: 'ASPHALT' })
      setShowAdd(false)
      onRefresh()
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to add runway') }
    finally { setSaving(false) }
  }, [airport._id, form, onRefresh])

  const handleDelete = useCallback((rwId: string, identifier: string) => {
    Alert.alert('Delete Runway', `Delete runway ${identifier}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRunway(airport._id, rwId)
            onRefresh()
          } catch (err: any) { Alert.alert('Error', err.message || 'Failed to delete') }
        },
      },
    ])
  }, [airport._id, onRefresh])

  return (
    <View>
      {/* Section header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Runways</Text>
          <Text style={{ fontSize: 12, color: palette.textTertiary }}>({runways.length})</Text>
        </View>
        {!showAdd && (
          <Pressable onPress={() => setShowAdd(true)}
            className="flex-row items-center px-2.5 py-1.5 rounded-lg active:opacity-60"
            style={{ backgroundColor: accent, gap: 4 }}>
            <Plus size={12} color="#fff" strokeWidth={2.5} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Add</Text>
          </Pressable>
        )}
      </View>

      {/* Add form */}
      {showAdd && (
        <View className="mb-3 p-3 rounded-xl" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text, marginBottom: 8 }}>New Runway</Text>
          <View className="flex-row" style={{ gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', marginBottom: 2 }}>IDENTIFIER</Text>
              <TextInput value={form.identifier} placeholder="e.g. 08L/26R"
                onChangeText={v => setForm(p => ({ ...p, identifier: v.toUpperCase() }))}
                style={{ fontSize: 13, fontFamily: 'monospace', color: palette.text, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 4 }}
                placeholderTextColor={palette.textTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', marginBottom: 2 }}>LENGTH (FT)</Text>
              <TextInput value={form.lengthFt} placeholder="e.g. 12000"
                onChangeText={v => setForm(p => ({ ...p, lengthFt: v }))} keyboardType="numeric"
                style={{ fontSize: 13, color: palette.text, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 4 }}
                placeholderTextColor={palette.textTertiary} />
            </View>
          </View>
          <View className="flex-row" style={{ gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', marginBottom: 2 }}>WIDTH (FT)</Text>
              <TextInput value={form.widthFt} placeholder="e.g. 150"
                onChangeText={v => setForm(p => ({ ...p, widthFt: v }))} keyboardType="numeric"
                style={{ fontSize: 13, color: palette.text, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 4 }}
                placeholderTextColor={palette.textTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', marginBottom: 2 }}>SURFACE</Text>
              <TextInput value={form.surface}
                onChangeText={v => setForm(p => ({ ...p, surface: v.toUpperCase() }))}
                style={{ fontSize: 13, color: palette.text, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 4 }}
                placeholderTextColor={palette.textTertiary} />
            </View>
          </View>
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable onPress={handleAdd} disabled={saving}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-60"
              style={{ backgroundColor: accent, gap: 4, opacity: saving ? 0.5 : 1 }}>
              <Check size={13} color="#fff" strokeWidth={2.5} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{saving ? 'Adding…' : 'Add'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowAdd(false)}
              className="px-3 py-2 rounded-lg active:opacity-60">
              <Text style={{ fontSize: 12, fontWeight: '500', color: palette.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Runway cards */}
      {runways.length === 0 && !showAdd ? (
        <View className="py-6 items-center">
          <Text style={{ fontSize: 13, color: palette.textTertiary }}>No runway data available</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {runways.map(rw => (
            <View key={rw._id} className="p-3 rounded-xl"
              style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', fontFamily: 'monospace', color: palette.text }}>{rw.identifier}</Text>
                  <View className="px-1.5 py-0.5 rounded" style={{
                    backgroundColor: rw.status === 'active' ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7')
                      : rw.status === 'closed' ? (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2')
                      : (isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7')
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600',
                      color: rw.status === 'active' ? (isDark ? '#4ade80' : '#166534')
                        : rw.status === 'closed' ? (isDark ? '#f87171' : '#991b1b')
                        : (isDark ? '#fbbf24' : '#92400e')
                    }}>{rw.status === 'under-construction' ? 'WIP' : rw.status?.toUpperCase()}</Text>
                  </View>
                  {rw.lighting && <Lightbulb size={14} color="#f59e0b" strokeWidth={2} />}
                </View>
                <Pressable onPress={() => handleDelete(rw._id, rw.identifier)} className="p-1.5 active:opacity-60">
                  <Trash2 size={14} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
              </View>
              <View className="flex-row" style={{ gap: 16 }}>
                <View>
                  <Text style={{ fontSize: 10, color: palette.textTertiary, fontWeight: '600' }}>LENGTH</Text>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text }}>
                    {rw.lengthFt ? `${rw.lengthFt.toLocaleString()} ft` : '—'}
                  </Text>
                  {rw.lengthM != null && <Text style={{ fontSize: 11, color: palette.textTertiary }}>{rw.lengthM.toLocaleString()} m</Text>}
                </View>
                <View>
                  <Text style={{ fontSize: 10, color: palette.textTertiary, fontWeight: '600' }}>WIDTH</Text>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text }}>
                    {rw.widthFt ? `${rw.widthFt.toLocaleString()} ft` : '—'}
                  </Text>
                  {rw.widthM != null && <Text style={{ fontSize: 11, color: palette.textTertiary }}>{rw.widthM.toLocaleString()} m</Text>}
                </View>
                <View>
                  <Text style={{ fontSize: 10, color: palette.textTertiary, fontWeight: '600' }}>SURFACE</Text>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text }}>{rw.surface ?? '—'}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 10, color: palette.textTertiary, fontWeight: '600' }}>ILS</Text>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text }}>{rw.ilsCategory ?? 'None'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
