import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CountryRef } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2,
  Info, Landmark,
} from 'lucide-react-native'
import MapView, { Marker } from 'react-native-maps'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'

type TabKey = 'basic' | 'extra'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'basic', label: 'Basic Info', icon: Info },
  { key: 'extra', label: 'Currency & Details', icon: Landmark },
]

export default function CountryDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [country, setCountry] = useState<CountryRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<CountryRef>>({})

  useEffect(() => {
    if (!id) return
    api.getCountry(id).then(setCountry).catch(console.error).finally(() => setLoading(false))
  }, [id])

  const get = (key: keyof CountryRef) => (key in draft ? (draft as any)[key] : country?.[key])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!country || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateCountry(country._id, draft)
      setCountry(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [country, draft])

  const handleDelete = useCallback(() => {
    if (!country) return
    Alert.alert(
      'Delete Country',
      `Are you sure you want to delete ${country.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCountry(country._id)
              router.back()
            } catch (err: any) {
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
  }, [country, router])

  if (loading || !country) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 14, color: palette.textTertiary }}>
            {loading ? 'Loading…' : 'Country not found'}
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
              {country.name}
            </Text>
            {country.isActive ? (
              <View className="px-2.5 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
              </View>
            ) : (
              <View className="px-2.5 py-0.5 rounded-full ml-2" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving…' : 'Save'}</Text>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Sub-info */}
        <View className="flex-row items-center mt-2" style={{ gap: 8, marginLeft: 36 }}>
          <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>ISO: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: palette.text }}>{country.isoCode2} / {country.isoCode3}</Text></Text>
          </View>
          {country.region && (
            <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}>
              <Text style={{ fontSize: 12, color: palette.textSecondary }}>{country.region}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Map */}
      {country.latitude != null && country.longitude != null && (
        <View style={{ height: isTablet ? 350 : 250, borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: country.latitude,
              longitude: country.longitude,
              latitudeDelta: 15,
              longitudeDelta: 15,
            }}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            mapType="standard"
          >
            <Marker
              coordinate={{ latitude: country.latitude, longitude: country.longitude }}
              title={country.name}
              description={country.officialName ?? undefined}
              pinColor={accent}
            />
          </MapView>

          {/* Code overlay on map */}
          <View className="absolute top-3 left-3 flex-row" style={{ gap: 6 }}>
            <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.88)', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }) }}>
              <Text style={{ fontSize: 13, color: '#666' }}>ISO: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: '#111' }}>{country.isoCode2} / {country.isoCode3}</Text></Text>
            </View>
            {country.icaoPrefix && (
              <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.88)', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }) }}>
                <Text style={{ fontSize: 13, color: '#666' }}>ICAO: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color: '#111' }}>{country.icaoPrefix}</Text></Text>
              </View>
            )}
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
              <Icon size={14} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <Text style={{ fontSize: 13, fontWeight: active ? '600' : '500', color: active ? accent : palette.textSecondary }}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Tab content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === 'basic' && (
          <>
            <Field label="Country Name" value={country.name} editing={editing} fieldKey="name" editValue={get('name')} onChange={handleFieldChange} palette={palette} />
            <Field label="Official Name" value={country.officialName} editing={editing} fieldKey="officialName" editValue={get('officialName')} onChange={handleFieldChange} palette={palette} />
            <Field label="ISO 2 Code" value={country.isoCode2} editing={editing} fieldKey="isoCode2" editValue={get('isoCode2')} onChange={handleFieldChange} palette={palette} />
            <Field label="ISO 3 Code" value={country.isoCode3} editing={editing} fieldKey="isoCode3" editValue={get('isoCode3')} onChange={handleFieldChange} palette={palette} />
            <Field label="Region" value={country.region} editing={editing} fieldKey="region" editValue={get('region')} onChange={handleFieldChange} palette={palette} />
            <Field label="Sub-region" value={country.subRegion} editing={editing} fieldKey="subRegion" editValue={get('subRegion')} onChange={handleFieldChange} palette={palette} />
            <Field label="ICAO Prefix" value={country.icaoPrefix} editing={editing} fieldKey="icaoPrefix" editValue={get('icaoPrefix')} onChange={handleFieldChange} palette={palette} />
            <Field label="Flag Emoji" value={country.flagEmoji} editing={editing} fieldKey="flagEmoji" editValue={get('flagEmoji')} onChange={handleFieldChange} palette={palette} />
            <ToggleField label="Active" value={country.isActive} editing={editing} fieldKey="isActive" editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
          </>
        )}
        {activeTab === 'extra' && (
          <>
            <Field label="Currency Code" value={country.currencyCode} editing={editing} fieldKey="currencyCode" editValue={get('currencyCode')} onChange={handleFieldChange} palette={palette} />
            <Field label="Currency Name" value={country.currencyName} editing={editing} fieldKey="currencyName" editValue={get('currencyName')} onChange={handleFieldChange} palette={palette} />
            <Field label="Currency Symbol" value={country.currencySymbol} editing={editing} fieldKey="currencySymbol" editValue={get('currencySymbol')} onChange={handleFieldChange} palette={palette} />
            <Field label="Phone Code" value={country.phoneCode} editing={editing} fieldKey="phoneCode" editValue={get('phoneCode')} onChange={handleFieldChange} palette={palette} />
            <Field label="Latitude" value={country.latitude?.toFixed(6)} editing={editing} fieldKey="latitude" editValue={get('latitude')} onChange={handleFieldChange} palette={palette} numeric />
            <Field label="Longitude" value={country.longitude?.toFixed(6)} editing={editing} fieldKey="longitude" editValue={get('longitude')} onChange={handleFieldChange} palette={palette} numeric />
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
        <Text style={{ fontSize: 11, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
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
      <Text style={{ fontSize: 11, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{value ?? '—'}</Text>
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
      <Text style={{ fontSize: 11, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {editing ? (
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
