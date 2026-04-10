import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type CarrierCodeRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2, Building2 } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CATEGORIES = ['Air', 'Ground', 'Other']

function minutesToHHMM(m: number | null | undefined): string {
  if (m == null) return '\u2014'
  const h = Math.floor(m / 60), mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}
function hhmmToMinutes(s: string): number | null {
  const hm = s.match(/^(\d{1,3}):(\d{2})$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

export default function CarrierCodeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [carrier, setCarrier] = useState<CarrierCodeRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<'basic' | 'contact' | 'times'>('basic')
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    if (!id || !operatorId) return
    setError(null)
    setLogoFailed(false)
    api.getCarrierCodes(operatorId)
      .then(list => setCarrier(list.find(c => c._id === id) ?? null))
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  const get = (key: string) => (key in draft ? draft[key] : (carrier as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!carrier || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateCarrierCode(carrier._id, draft)
      setCarrier(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save')
    } finally { setSaving(false) }
  }, [carrier, draft])

  const handleDelete = useCallback(() => {
    if (!carrier) return
    Alert.alert('Delete Carrier', `Delete ${carrier.iataCode} — ${carrier.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteCarrierCode(carrier._id); router.back() }
        catch (err: any) { Alert.alert('Cannot Delete', err.message || 'Failed') }
      }},
    ])
  }, [carrier, router])

  if (loading || (!carrier && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (error || !carrier) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center' }}>{error ?? 'Not found'}</Text>
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
            <Text style={{ fontSize: 24, fontWeight: '700', fontFamily: 'monospace', color: accent, marginRight: 8 }}>
              {carrier.iataCode}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>{carrier.name}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraft({}) }} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving}
                  className="px-4 py-2.5 rounded-lg active:opacity-60" style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
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
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
        <View className="flex-row items-center mt-2 flex-wrap" style={{ gap: 6, marginLeft: 36 }}>
          {carrier.icaoCode && <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary }}>{carrier.icaoCode}</Text>}
          <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#818cf8' : '#4338ca' }}>{carrier.category}</Text>
          </View>
          {carrier.isActive ? (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>Active</Text>
            </View>
          ) : (
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
            </View>
          )}
        </View>
      </View>

      {/* Airline logo banner */}
      <View className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
        <View className="items-center justify-center rounded-xl overflow-hidden mr-4"
          style={{ width: 80, height: 50, borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: '#fff' }}>
          {carrier.iataCode && !logoFailed ? (
            <Image
              source={{ uri: `https://pics.avs.io/200/80/${carrier.iataCode}.png` }}
              style={{ width: 70, height: 40 }}
              resizeMode="contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Building2 size={20} color={palette.textTertiary} strokeWidth={1.5} />
          )}
        </View>
        <View className="flex-1">
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>{carrier.name}</Text>
          <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: accent }}>{carrier.iataCode}</Text>
            {carrier.icaoCode && (
              <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary }}>{carrier.icaoCode}</Text>
            )}
            {carrier.defaultCurrency && (
              <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary }}>{carrier.defaultCurrency}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row" style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
        {([['basic', 'Basic'], ['contact', 'Contact'], ['times', 'Report & Debrief']] as const).map(([k, label]) => {
          const active = tab === k
          return (
            <Pressable key={k} onPress={() => setTab(k)}
              className="px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent' }}>
              <Text style={{ fontSize: 14, fontWeight: active ? '600' : '500', color: active ? accent : palette.textSecondary }}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {tab === 'basic' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <Field label="IATA Code" value={carrier.iataCode} editing={editing} fieldKey="iataCode" editValue={get('iataCode')} onChange={handleFieldChange} palette={palette} mono maxLength={2} half={isTablet} />
            <Field label="ICAO Code" value={carrier.icaoCode} editing={editing} fieldKey="icaoCode" editValue={get('icaoCode')} onChange={handleFieldChange} palette={palette} mono maxLength={3} half={isTablet} />
            <Field label="Name" value={carrier.name} editing={editing} fieldKey="name" editValue={get('name')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            {editing ? (
              <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...(isTablet ? { width: '50%', paddingRight: 12 } : {}) }}>
                <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>Category</Text>
                <View className="flex-row" style={{ gap: 6 }}>
                  {CATEGORIES.map(cat => {
                    const active = (get('category') ?? carrier.category) === cat
                    return (
                      <Pressable key={cat} onPress={() => handleFieldChange('category', cat)}
                        className="px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? accent : palette.cardBorder }}>
                        <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>{cat}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : (
              <Field label="Category" value={carrier.category} editing={false} fieldKey="" editValue="" onChange={() => {}} palette={palette} half={isTablet} />
            )}
            <Field label="Vendor Number" value={carrier.vendorNumber} editing={editing} fieldKey="vendorNumber" editValue={get('vendorNumber')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Default Currency" value={carrier.defaultCurrency} editing={editing} fieldKey="defaultCurrency" editValue={get('defaultCurrency')} onChange={handleFieldChange} palette={palette} mono half={isTablet} />
            {editing && (
              <ToggleField label="Active" value={carrier.isActive} editing fieldKey="isActive" editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} half={isTablet} />
            )}
          </View>
        )}

        {tab === 'contact' && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''}>
            <Field label="Contact Name" value={carrier.contactName} editing={editing} fieldKey="contactName" editValue={get('contactName')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Position" value={carrier.contactPosition} editing={editing} fieldKey="contactPosition" editValue={get('contactPosition')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Phone" value={carrier.phone} editing={editing} fieldKey="phone" editValue={get('phone')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="Email" value={carrier.email} editing={editing} fieldKey="email" editValue={get('email')} onChange={handleFieldChange} palette={palette} half={isTablet} />
            <Field label="SITA" value={carrier.sita} editing={editing} fieldKey="sita" editValue={get('sita')} onChange={handleFieldChange} palette={palette} mono half={isTablet} />
            <Field label="Website" value={carrier.website} editing={editing} fieldKey="website" editValue={get('website')} onChange={handleFieldChange} palette={palette} half={isTablet} />
          </View>
        )}

        {tab === 'times' && (
          <>
            <SectionBar label="Cockpit Crew" color={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <TimeField label="Report Time" value={carrier.cockpitTimes?.reportMinutes} editing={editing}
                onChange={(v) => handleFieldChange('cockpitTimes', { ...(get('cockpitTimes') ?? carrier.cockpitTimes ?? {}), reportMinutes: v })}
                palette={palette} accent={accent} half={isTablet} />
              <TimeField label="Debrief Time" value={carrier.cockpitTimes?.debriefMinutes} editing={editing}
                onChange={(v) => handleFieldChange('cockpitTimes', { ...(get('cockpitTimes') ?? carrier.cockpitTimes ?? {}), debriefMinutes: v })}
                palette={palette} accent={accent} half={isTablet} />
            </View>

            <SectionBar label="Cabin Crew" color={accent} />
            <View className={isTablet ? 'flex-row flex-wrap' : ''}>
              <TimeField label="Report Time" value={carrier.cabinTimes?.reportMinutes} editing={editing}
                onChange={(v) => handleFieldChange('cabinTimes', { ...(get('cabinTimes') ?? carrier.cabinTimes ?? {}), reportMinutes: v })}
                palette={palette} accent={accent} half={isTablet} />
              <TimeField label="Debrief Time" value={carrier.cabinTimes?.debriefMinutes} editing={editing}
                onChange={(v) => handleFieldChange('cabinTimes', { ...(get('cabinTimes') ?? carrier.cabinTimes ?? {}), debriefMinutes: v })}
                palette={palette} accent={accent} half={isTablet} />
            </View>

            <SectionBar label="Capacity" color={accent} />
            <Field label="Passengers" value={carrier.capacity} editing={editing} fieldKey="capacity"
              editValue={get('capacity')} onChange={handleFieldChange} palette={palette} numeric />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionBar({ label, color }: { label: string; color: string }) {
  return (
    <View className="flex-row items-center mt-4 mb-2" style={{ gap: 6 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 14, fontWeight: '700', color }}>{label}</Text>
    </View>
  )
}

function Field({ label, value, editing, fieldKey, editValue, onChange, palette, mono, maxLength, numeric, half }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; mono?: boolean; maxLength?: number; numeric?: boolean; half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => { if (mono) v = v.toUpperCase(); onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v) }}
          autoCapitalize={mono ? 'characters' : 'sentences'} keyboardType={numeric ? 'numeric' : 'default'} maxLength={maxLength}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1, borderBottomColor: accentTint(palette.text, 0.15), paddingVertical: 4 }}
          placeholderTextColor={palette.textTertiary} />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}>{value ?? '\u2014'}</Text>
    </View>
  )
}

function TimeField({ label, value, editing, onChange, palette, accent, half }: {
  label: string; value: number | null | undefined; editing: boolean;
  onChange: (v: number | null) => void; palette: Palette; accent: string; half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput value={value != null ? minutesToHHMM(value) : ''}
          onChangeText={(v) => onChange(hhmmToMinutes(v))}
          placeholder="H:MM" placeholderTextColor={palette.textTertiary}
          keyboardType="numbers-and-punctuation"
          style={{ fontSize: 15, fontWeight: '600', fontFamily: 'monospace', color: palette.text,
            borderBottomWidth: 1, borderBottomColor: accentTint(accent, 0.2), paddingVertical: 4 }} />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', fontFamily: 'monospace', color: palette.text }}>{minutesToHHMM(value ?? null)}</Text>
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
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {editing ? (
        <Pressable onPress={() => onChange(fieldKey, !editValue)} className="self-start px-3 py-1 rounded-lg"
          style={{ backgroundColor: current ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>
            {current ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary }}>{value ? 'Yes' : 'No'}</Text>
      )}
    </View>
  )
}
