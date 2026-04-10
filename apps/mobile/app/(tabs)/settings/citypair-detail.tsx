import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { api, type CityPairRef } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2,
  Info, Clock,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'

type TabKey = 'general' | 'block-hours'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'general', label: 'General', icon: Info },
  { key: 'block-hours', label: 'Block Hours', icon: Clock },
]

function fmtBlock(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function greatCircleCoords(lat1: number, lon1: number, lat2: number, lon2: number, n = 60) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const la1 = toRad(lat1), lo1 = toRad(lon1), la2 = toRad(lat2), lo2 = toRad(lon2)
  const d = 2 * Math.asin(Math.sqrt(Math.sin((la1 - la2) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo1 - lo2) / 2) ** 2))
  if (d === 0) return [{ latitude: lat1, longitude: lon1 }]
  const pts: { latitude: number; longitude: number }[] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2)
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2)
    const z = A * Math.sin(la1) + B * Math.sin(la2)
    pts.push({ latitude: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), longitude: toDeg(Math.atan2(y, x)) })
  }
  return pts
}

export default function CityPairDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [cityPair, setCityPair] = useState<CityPairRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<CityPairRef>>({})

  useEffect(() => {
    if (!id) return
    api.getCityPair(id).then(setCityPair).catch(console.error).finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof CityPairRef) => (key in draft ? (draft as any)[key] : cityPair?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!cityPair || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateCityPair(cityPair._id, draft)
      setCityPair(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [cityPair, draft])

  const handleDelete = useCallback(() => {
    if (!cityPair) return
    const label1 = cityPair.station1Iata || cityPair.station1Icao
    const label2 = cityPair.station2Iata || cityPair.station2Icao
    Alert.alert(
      'Delete City Pair',
      `Are you sure you want to delete ${label1}–${label2}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCityPair(cityPair._id)
              router.back()
            } catch (err: any) {
              let msg = err.message || 'Delete failed'
              try {
                const match = msg.match(/API (\d+): (.+)/)
                if (match) msg = JSON.parse(match[2]).error || msg
              } catch { /* use raw */ }
              Alert.alert('Cannot Delete', msg)
            }
          },
        },
      ]
    )
  }, [cityPair, router])

  if (loading || !cityPair) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 14, color: palette.textTertiary }}>
            {loading ? 'Loading…' : 'City pair not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const label1 = cityPair.station1Iata || cityPair.station1Icao
  const label2 = cityPair.station2Iata || cityPair.station2Icao

  const routeTypeColor = cityPair.routeType === 'domestic' ? '#166534'
    : cityPair.routeType === 'regional' ? '#1e40af'
    : cityPair.routeType === 'international' ? '#92400e'
    : cityPair.routeType === 'long-haul' ? '#9d174d'
    : cityPair.routeType === 'ultra-long-haul' ? '#5b21b6' : '#374151'

  const routeTypeBg = cityPair.routeType === 'domestic' ? '#dcfce7'
    : cityPair.routeType === 'regional' ? '#dbeafe'
    : cityPair.routeType === 'international' ? '#fef3c7'
    : cityPair.routeType === 'long-haul' ? '#fce7f3'
    : cityPair.routeType === 'ultra-long-haul' ? '#ede9fe' : '#f3f4f6'

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{label1}</Text>
            <Text style={{ fontSize: 16, color: palette.textTertiary, marginHorizontal: 6 }}>↔</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{label2}</Text>
            <View className="px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? `${routeTypeBg}20` : routeTypeBg }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: routeTypeColor, textTransform: 'capitalize' }}>{cityPair.routeType}</Text>
            </View>
          </View>

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
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
                  <Pencil size={14} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Sub info */}
        <View className="flex-row items-center mt-1.5" style={{ marginLeft: 36, gap: 8 }}>
          <Text style={{ fontSize: 13, color: palette.textSecondary }}>
            {cityPair.station1City} – {cityPair.station2City}
          </Text>
          {cityPair.distanceNm != null && (
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>
              · {cityPair.distanceNm.toLocaleString()} nm
            </Text>
          )}
          {cityPair.isEtops && (
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#d97706' }}>· ETOPS</Text>
          )}
        </View>
      </View>

      {/* Map */}
      {cityPair.station1Lat != null && cityPair.station1Lon != null && cityPair.station2Lat != null && cityPair.station2Lon != null && (
        <View style={{ height: isTablet ? 300 : 250, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <CityPairMapMobile
            lat1={cityPair.station1Lat} lon1={cityPair.station1Lon}
            lat2={cityPair.station2Lat} lon2={cityPair.station2Lon}
            label1={label1} label2={label2}
            distanceNm={cityPair.distanceNm}
            isDark={isDark} accent={accent}
          />
        </View>
      )}

      {/* Tabs */}
      <View className="flex-row" style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingHorizontal: 13, paddingVertical: 8, gap: 4 }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', gap: 6 }}>
              <Icon size={14} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <Text style={{ fontSize: 13, fontWeight: active ? '600' : '500', color: active ? accent : palette.textSecondary }}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Tab content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === 'general' && (
          <>
            <View className="flex-row" style={{ gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Field label="Station 1 (ICAO)" value={cityPair.station1Icao} palette={palette} />
                <Field label="Station 1 (IATA)" value={cityPair.station1Iata} palette={palette} />
                <Field label="Station 1 City" value={cityPair.station1City} palette={palette} />
                <Field label="Distance (nm)" value={cityPair.distanceNm?.toLocaleString()} palette={palette} />
                <Field label="Standard Block (min)" value={cityPair.standardBlockMinutes} palette={palette}
                  editing={editing} fieldKey="standardBlockMinutes" editValue={get('standardBlockMinutes')} onChange={handleFieldChange} numeric />
                <ToggleField label="ETOPS" value={cityPair.isEtops} palette={palette} isDark={isDark}
                  editing={editing} fieldKey="isEtops" editValue={get('isEtops')} onChange={handleFieldChange} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Station 2 (ICAO)" value={cityPair.station2Icao} palette={palette} />
                <Field label="Station 2 (IATA)" value={cityPair.station2Iata} palette={palette} />
                <Field label="Station 2 City" value={cityPair.station2City} palette={palette} />
                <Field label="Distance (km)" value={cityPair.distanceKm?.toLocaleString()} palette={palette} />
                <Field label="Route Type" value={cityPair.routeType} palette={palette} />
                <ToggleField label="Overwater" value={cityPair.isOverwater} palette={palette} isDark={isDark}
                  editing={editing} fieldKey="isOverwater" editValue={get('isOverwater')} onChange={handleFieldChange} />
              </View>
            </View>
          </>
        )}
        {activeTab === 'block-hours' && (
          <>
            {(cityPair.blockHours ?? []).length === 0 ? (
              <View className="py-8 items-center">
                <Text style={{ fontSize: 14, color: palette.textTertiary }}>No block hours configured</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {cityPair.blockHours.map(bh => (
                  <View key={bh._id} className="p-3 rounded-xl"
                    style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text }}>{bh.aircraftTypeIcao ?? 'All'}</Text>
                        <Text style={{ fontSize: 13, color: palette.textTertiary, textTransform: 'capitalize' }}>{bh.seasonType}</Text>
                      </View>
                    </View>
                    <View className="flex-row" style={{ gap: 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: palette.textTertiary, fontWeight: '600' }}>Block {label1}→{label2}</Text>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{fmtBlock(bh.dir1BlockMinutes)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: palette.textTertiary, fontWeight: '600' }}>Block {label2}→{label1}</Text>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{fmtBlock(bh.dir2BlockMinutes)}</Text>
                      </View>
                    </View>
                    {(bh.dir1FuelKg != null || bh.dir2FuelKg != null) && (
                      <View className="flex-row mt-2" style={{ gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, color: palette.textTertiary, fontWeight: '600' }}>Fuel {label1}→{label2}</Text>
                          <Text style={{ fontSize: 14, color: palette.text }}>{bh.dir1FuelKg?.toLocaleString() ?? '—'} kg</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, color: palette.textTertiary, fontWeight: '600' }}>Fuel {label2}→{label1}</Text>
                          <Text style={{ fontSize: 14, color: palette.text }}>{bh.dir2FuelKg?.toLocaleString() ?? '—'} kg</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Map component ──

function CityPairMapMobile({ lat1, lon1, lat2, lon2, label1, label2, distanceNm, isDark, accent }: {
  lat1: number; lon1: number; lat2: number; lon2: number;
  label1: string; label2: string; distanceNm: number | null;
  isDark: boolean; accent: string;
}) {
  const routeCoords = useMemo(() => greatCircleCoords(lat1, lon1, lat2, lon2), [lat1, lon1, lat2, lon2])

  const midLat = (lat1 + lat2) / 2
  const midLon = (lon1 + lon2) / 2
  const latDelta = Math.abs(lat2 - lat1) * 1.6 + 2
  const lonDelta = Math.abs(lon2 - lon1) * 1.6 + 2

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude: midLat, longitude: midLon, latitudeDelta: latDelta, longitudeDelta: lonDelta }}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        mapType="standard"
      >
        <Polyline coordinates={routeCoords} strokeColor={accent} strokeWidth={2.5} lineDashPattern={[0]} />
        <Marker coordinate={{ latitude: lat1, longitude: lon1 }} title={label1} pinColor={accent} />
        <Marker coordinate={{ latitude: lat2, longitude: lon2 }} title={label2} pinColor={accent} />
      </MapView>

      {/* Distance overlay */}
      {distanceNm != null && (
        <View className="absolute top-3 left-3" style={{ zIndex: 2 }}>
          <View className="px-2.5 py-1 rounded-lg" style={{
            backgroundColor: 'rgba(255,255,255,0.88)',
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
              android: { elevation: 3 },
            }),
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#111' }}>{distanceNm.toLocaleString()} nm</Text>
          </View>
        </View>
      )}
    </View>
  )
}

// ── Field components ──

function Field({ label, value, palette, editing, fieldKey, editValue, onChange, numeric }: {
  label: string; value: any; palette: Palette;
  editing?: boolean; fieldKey?: string; editValue?: any; onChange?: (k: string, v: any) => void; numeric?: boolean
}) {
  if (editing && fieldKey && onChange) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 13, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v)}
          keyboardType={numeric ? 'numeric' : 'default'}
          style={{ fontSize: 14, fontWeight: '500', color: palette.text, borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3), paddingVertical: 4 }}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 13, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{value ?? '—'}</Text>
    </View>
  )
}

function ToggleField({ label, value, palette, isDark, editing, fieldKey, editValue, onChange }: {
  label: string; value: boolean; palette: Palette; isDark: boolean;
  editing?: boolean; fieldKey?: string; editValue?: any; onChange?: (k: string, v: any) => void
}) {
  const current = editing ? !!editValue : value
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 13, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {editing && fieldKey && onChange ? (
        <Pressable onPress={() => onChange(fieldKey, !editValue)}
          className="self-start px-3 py-1 rounded-lg"
          style={{ backgroundColor: current ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>
            {current ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 14, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary }}>
          {value ? 'Yes' : 'No'}
        </Text>
      )}
    </View>
  )
}
