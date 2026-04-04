import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type AircraftTypeRef, type LopaConfigRef, type CabinClassRef } from '@skyhub/api'
import {
  ChevronLeft, Pencil, Save, X, Trash2,
  Info, Gauge, Clock, Armchair, Package, Users, CloudRain, Star,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'

type TabKey = 'basic' | 'perf' | 'tat' | 'seating' | 'cargo' | 'crew' | 'weather'
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'basic', label: 'Basic', icon: Info },
  { key: 'perf', label: 'Performance', icon: Gauge },
  { key: 'tat', label: 'TAT', icon: Clock },
  { key: 'seating', label: 'Seats', icon: Armchair },
  { key: 'cargo', label: 'Cargo', icon: Package },
  { key: 'crew', label: 'Crew', icon: Users },
  { key: 'weather', label: 'Weather', icon: CloudRain },
]

const MANUFACTURERS = ['Airbus', 'Boeing', 'Embraer', 'ATR', 'Bombardier', 'Comac']
const CATEGORIES = [
  { value: 'narrow_body', label: 'Narrow Body' },
  { value: 'wide_body', label: 'Wide Body' },
  { value: 'regional', label: 'Regional' },
  { value: 'turboprop', label: 'Turboprop' },
]
const REST_CLASSES = ['None', 'Class 1', 'Class 2', 'Class 3']
const ILS_CATS = ['None', 'Cat I', 'Cat II', 'Cat IIIa', 'Cat IIIb', 'Cat IIIc']

// Aircraft hero images (static require)
const AIRCRAFT_IMAGES: Record<string, any> = {
  A320: require('../../../assets/A320.png'),
  A321: require('../../../assets/A321.png'),
  A350: require('../../../assets/A350.png'),
  A380: require('../../../assets/A380.png'),
}

function minsToHmm(m: number | null): string {
  if (m == null) return '---'
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}

export default function AircraftTypeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()

  const [acType, setAcType] = useState<AircraftTypeRef | null>(null)
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([])
  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('basic')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!id) return
    api.getAircraftType(id)
      .then(t => {
        setAcType(t)
        // Fetch LOPA configs for seating tab
        Promise.all([api.getLopaConfigs('horizon', t.icaoType), api.getCabinClasses()])
          .then(([configs, classes]) => { setLopaConfigs(configs); setCabinClasses(classes) })
          .catch(console.error)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  // Nested get helper: supports dot notation like 'performance.mtowKg'
  const get = useCallback((path: string) => {
    if (path in draft) return draft[path]
    if (!acType) return null
    const parts = path.split('.')
    let val: any = acType
    for (const p of parts) val = val?.[p]
    return val
  }, [draft, acType])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  // Build nested payload from flat draft keys
  const buildPayload = useCallback(() => {
    const payload: Record<string, any> = {}
    for (const [key, value] of Object.entries(draft)) {
      const parts = key.split('.')
      if (parts.length === 1) {
        payload[key] = value
      } else {
        // Nested: e.g., 'performance.mtowKg' → { performance: { mtowKg: value } }
        if (!payload[parts[0]]) {
          payload[parts[0]] = { ...(acType as any)?.[parts[0]] }
        }
        payload[parts[0]][parts[1]] = value
      }
    }
    return payload
  }, [draft, acType])

  const handleSave = useCallback(async () => {
    if (!acType || Object.keys(draft).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.updateAircraftType(acType._id, buildPayload())
      setAcType(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [acType, draft, buildPayload])

  const handleDelete = useCallback(() => {
    if (!acType) return
    Alert.alert('Delete Aircraft Type', `Delete ${acType.icaoType} — ${acType.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await api.deleteAircraftType(acType._id); router.back() }
          catch (err: any) {
            let msg = err.message || 'Delete failed'
            try { const match = msg.match(/API (\d+): (.+)/); if (match) { msg = JSON.parse(match[2]).error || msg } } catch {}
            Alert.alert('Cannot Delete', msg)
          }
        },
      },
    ])
  }, [acType, router])

  if (loading || !acType) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Aircraft type not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const heroImg = AIRCRAFT_IMAGES[acType.icaoType]
  const catLabel = CATEGORIES.find(c => c.value === acType.category)?.label || acType.category

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View className="px-2 py-1 rounded-lg mr-2" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: palette.text }}>{acType.icaoType}</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>{acType.name}</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { setEditing(false); setDraft({}) }} className="active:opacity-60">
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg active:opacity-60" style={{ backgroundColor: accent }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
        {/* Badges */}
        <View className="flex-row items-center mt-2" style={{ gap: 6, marginLeft: 36 }}>
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#818cf8' : '#4338ca' }}>{catLabel}</Text>
          </View>
          {acType.isActive ? (
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

      {/* Hero image */}
      {heroImg && (
        <View style={{ height: 220, borderBottomWidth: 1, borderBottomColor: palette.border, overflow: 'hidden' }}>
          <Image source={heroImg} style={{ width: '100%', height: 220, opacity: isDark ? 0.6 : 0.75 }} resizeMode="contain" />
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: palette.border }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, gap: 4 }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', gap: 4 }}>
              <Icon size={14} color={active ? accent : palette.textSecondary} strokeWidth={1.8} />
              <Text style={{ fontSize: 13, fontWeight: active ? '600' : '500', color: active ? accent : palette.textSecondary }}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Tab content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {activeTab === 'basic' && (
          <>
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}>
                <Field label="ICAO Type" value={acType.icaoType} editing={editing} fieldKey="icaoType" editValue={get('icaoType')} onChange={handleFieldChange} palette={palette} mono maxLength={4} />
              </View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}>
                <Field label="IATA Type" value={acType.iataType} editing={editing} fieldKey="iataType" editValue={get('iataType')} onChange={handleFieldChange} palette={palette} />
              </View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}>
                <Field label="Name" value={acType.name} editing={editing} fieldKey="name" editValue={get('name')} onChange={handleFieldChange} palette={palette} />
              </View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}>
                <Field label="Family" value={acType.family} editing={editing} fieldKey="family" editValue={get('family')} onChange={handleFieldChange} palette={palette} />
              </View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}>
                <Field label="Cockpit Crew" value={acType.cockpitCrewRequired} editing={editing} fieldKey="cockpitCrewRequired" editValue={get('cockpitCrewRequired')} onChange={handleFieldChange} palette={palette} numeric />
              </View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}>
                <Field label="Cabin Crew" value={acType.cabinCrewRequired} editing={editing} fieldKey="cabinCrewRequired" editValue={get('cabinCrewRequired')} onChange={handleFieldChange} palette={palette} numeric />
              </View>
            </View>
            <PickerField label="Manufacturer" value={acType.manufacturer} options={MANUFACTURERS} editing={editing} fieldKey="manufacturer" editValue={get('manufacturer')} onChange={handleFieldChange} palette={palette} isDark={isDark} accent={accent} />
            <PickerField label="Category" value={catLabel} options={CATEGORIES.map(c => c.label)} editing={editing} fieldKey="category" editValue={CATEGORIES.find(c => c.value === get('category'))?.label || get('category')} onChange={(k, v) => { const cat = CATEGORIES.find(c => c.label === v); handleFieldChange(k, cat?.value || v) }} palette={palette} isDark={isDark} accent={accent} />
            <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
              <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>Schedule Color</Text>
              <ColorSwatchPicker value={get('color') || '#9ca3af'} onChange={(v) => handleFieldChange('color', v)} palette={palette} isDark={isDark} editing={editing} />
            </View>
            <Field label="Notes" value={acType.notes} editing={editing} fieldKey="notes" editValue={get('notes')} onChange={handleFieldChange} palette={palette} multiline />
            <ToggleField label="Active" value={acType.isActive} editing={editing} fieldKey="isActive" editValue={get('isActive')} onChange={handleFieldChange} palette={palette} isDark={isDark} />
          </>
        )}

        {activeTab === 'perf' && (
          <>
            <Section title="Weights" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="MTOW (kg)" value={acType.performance?.mtowKg} editing={editing} fieldKey="performance.mtowKg" editValue={get('performance.mtowKg')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="MLW (kg)" value={acType.performance?.mlwKg} editing={editing} fieldKey="performance.mlwKg" editValue={get('performance.mlwKg')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="MZFW (kg)" value={acType.performance?.mzfwKg} editing={editing} fieldKey="performance.mzfwKg" editValue={get('performance.mzfwKg')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="OEW (kg)" value={acType.performance?.oewKg} editing={editing} fieldKey="performance.oewKg" editValue={get('performance.oewKg')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
            <Section title="Fuel" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Max Fuel (kg)" value={acType.performance?.maxFuelCapacityKg} editing={editing} fieldKey="performance.maxFuelCapacityKg" editValue={get('performance.maxFuelCapacityKg')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Fuel Burn (kg/hr)" value={acType.fuelBurnRateKgPerHour} editing={editing} fieldKey="fuelBurnRateKgPerHour" editValue={get('fuelBurnRateKgPerHour')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
            <Section title="Speed & Range" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Cruising Speed (kts)" value={acType.performance?.cruisingSpeedKts} editing={editing} fieldKey="performance.cruisingSpeedKts" editValue={get('performance.cruisingSpeedKts')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Max Range (NM)" value={acType.performance?.maxRangeNm} editing={editing} fieldKey="performance.maxRangeNm" editValue={get('performance.maxRangeNm')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Ceiling (FL)" value={acType.performance?.ceilingFl} editing={editing} fieldKey="performance.ceilingFl" editValue={get('performance.ceilingFl')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
            <Section title="ETOPS" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><ToggleField label="ETOPS Capable" value={acType.etopsCapable} editing={editing} fieldKey="etopsCapable" editValue={get('etopsCapable')} onChange={handleFieldChange} palette={palette} isDark={isDark} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="ETOPS Rating (min)" value={acType.etopsRatingMinutes} editing={editing} fieldKey="etopsRatingMinutes" editValue={get('etopsRatingMinutes')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
            <Section title="Classifications" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Noise Category" value={acType.noiseCategory} editing={editing} fieldKey="noiseCategory" editValue={get('noiseCategory')} onChange={handleFieldChange} palette={palette} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Emissions Category" value={acType.emissionsCategory} editing={editing} fieldKey="emissionsCategory" editValue={get('emissionsCategory')} onChange={handleFieldChange} palette={palette} /></View>
            </View>
          </>
        )}

        {activeTab === 'tat' && (
          <>
            <Section title="Scheduled Turnaround" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="DOM → DOM" value={acType.tat?.domDom} editing={editing} fieldKey="tat.domDom" onChange={handleFieldChange} palette={palette} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="DOM → INT" value={acType.tat?.domInt} editing={editing} fieldKey="tat.domInt" onChange={handleFieldChange} palette={palette} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="INT → DOM" value={acType.tat?.intDom} editing={editing} fieldKey="tat.intDom" onChange={handleFieldChange} palette={palette} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="INT → INT" value={acType.tat?.intInt} editing={editing} fieldKey="tat.intInt" onChange={handleFieldChange} palette={palette} /></View>
            </View>
            <Section title="Minimum Turnaround" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="MIN DOM → DOM" value={acType.tat?.minDd} editing={editing} fieldKey="tat.minDd" onChange={handleFieldChange} palette={palette} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="MIN DOM → INT" value={acType.tat?.minDi} editing={editing} fieldKey="tat.minDi" onChange={handleFieldChange} palette={palette} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="MIN INT → DOM" value={acType.tat?.minId} editing={editing} fieldKey="tat.minId" onChange={handleFieldChange} palette={palette} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><TATRow label="MIN INT → INT" value={acType.tat?.minIi} editing={editing} fieldKey="tat.minIi" onChange={handleFieldChange} palette={palette} /></View>
            </View>
          </>
        )}

        {activeTab === 'seating' && (
          <>
            {lopaConfigs.length === 0 ? (
              <Text style={{ fontSize: 13, color: palette.textSecondary, paddingVertical: 16 }}>
                No LOPA configurations found for {acType.icaoType}.
              </Text>
            ) : (
              lopaConfigs.map(lc => (
                <View key={lc._id} className="rounded-xl mb-3" style={{ borderWidth: 1, borderColor: palette.cardBorder, padding: 12 }}>
                  <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{lc.configName}</Text>
                    {lc.isDefault && <Star size={12} color="#f59e0b" fill="#f59e0b" strokeWidth={1.5} />}
                    <View className="flex-1" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>{lc.totalSeats} seats</Text>
                  </View>
                  {lc.cabins.map((cabin, i) => {
                    const cc = cabinClasses.find(c => c.code === cabin.classCode)
                    const color = modeColor(cc?.color || '#9ca3af', isDark)
                    return (
                      <View key={i} className="flex-row items-center" style={{ gap: 8, paddingVertical: 4 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'monospace', color: palette.text, width: 24 }}>{cabin.classCode}</Text>
                        <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }}>{cc?.name || cabin.classCode}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'monospace', color: palette.text }}>{cabin.seats}</Text>
                      </View>
                    )
                  })}
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'cargo' && (
          <>
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Max Cargo Weight (kg)" value={acType.cargo?.maxCargoWeightKg} editing={editing} fieldKey="cargo.maxCargoWeightKg" editValue={get('cargo.maxCargoWeightKg')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Cargo Positions" value={acType.cargo?.cargoPositions} editing={editing} fieldKey="cargo.cargoPositions" editValue={get('cargo.cargoPositions')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Bulk Hold (kg)" value={acType.cargo?.bulkHoldCapacityKg} editing={editing} fieldKey="cargo.bulkHoldCapacityKg" editValue={get('cargo.bulkHoldCapacityKg')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
            <Field label="ULD Types" value={acType.cargo?.uldTypesAccepted?.join(', ')} editing={editing} fieldKey="cargo.uldTypesAccepted" editValue={get('cargo.uldTypesAccepted')?.join?.(', ') ?? get('cargo.uldTypesAccepted')} onChange={(k, v) => handleFieldChange(k, typeof v === 'string' ? v.split(',').map((s: string) => s.trim()).filter(Boolean) : v)} palette={palette} />
          </>
        )}

        {activeTab === 'crew' && (
          <>
            <Section title="Cockpit Rest Facility" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><PickerField label="Class" value={acType.crewRest?.cockpitClass} options={REST_CLASSES} editing={editing} fieldKey="crewRest.cockpitClass" editValue={get('crewRest.cockpitClass')} onChange={handleFieldChange} palette={palette} isDark={isDark} accent={accent} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Positions" value={acType.crewRest?.cockpitPositions} editing={editing} fieldKey="crewRest.cockpitPositions" editValue={get('crewRest.cockpitPositions')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
            <Section title="Cabin Rest Facility" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><PickerField label="Class" value={acType.crewRest?.cabinClass} options={REST_CLASSES} editing={editing} fieldKey="crewRest.cabinClass" editValue={get('crewRest.cabinClass')} onChange={handleFieldChange} palette={palette} isDark={isDark} accent={accent} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Positions" value={acType.crewRest?.cabinPositions} editing={editing} fieldKey="crewRest.cabinPositions" editValue={get('crewRest.cabinPositions')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
          </>
        )}

        {activeTab === 'weather' && (
          <>
            <Section title="Weather Limitations" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Min Ceiling (ft)" value={acType.weather?.minCeilingFt} editing={editing} fieldKey="weather.minCeilingFt" editValue={get('weather.minCeilingFt')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Min RVR (m)" value={acType.weather?.minRvrM} editing={editing} fieldKey="weather.minRvrM" editValue={get('weather.minRvrM')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Min Visibility (m)" value={acType.weather?.minVisibilityM} editing={editing} fieldKey="weather.minVisibilityM" editValue={get('weather.minVisibilityM')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Max Crosswind (kt)" value={acType.weather?.maxCrosswindKt} editing={editing} fieldKey="weather.maxCrosswindKt" editValue={get('weather.maxCrosswindKt')} onChange={handleFieldChange} palette={palette} numeric /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><Field label="Max Wind (kt)" value={acType.weather?.maxWindKt} editing={editing} fieldKey="weather.maxWindKt" editValue={get('weather.maxWindKt')} onChange={handleFieldChange} palette={palette} numeric /></View>
            </View>
            <Section title="Approach" accent={accent} />
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><PickerField label="ILS Category" value={acType.approach?.ilsCategoryRequired} options={ILS_CATS} editing={editing} fieldKey="approach.ilsCategoryRequired" editValue={get('approach.ilsCategoryRequired')} onChange={handleFieldChange} palette={palette} isDark={isDark} accent={accent} /></View>
              <View style={{ width: '50%', paddingHorizontal: 6 }}><ToggleField label="Autoland Capable" value={acType.approach?.autolandCapable ?? false} editing={editing} fieldKey="approach.autolandCapable" editValue={get('approach.autolandCapable')} onChange={handleFieldChange} palette={palette} isDark={isDark} /></View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Section header ──
function Section({ title, accent }: { title: string; accent: string }) {
  return (
    <View className="flex-row items-center mt-4 mb-2" style={{ gap: 6 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>{title}</Text>
    </View>
  )
}

// ── TAT row (shows H:MM format) ──
function TATRow({ label, value, editing, fieldKey, onChange, palette }: {
  label: string; value: number | null | undefined; editing: boolean; fieldKey: string;
  onChange: (k: string, v: any) => void; palette: Palette
}) {
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <TextInput
            value={value != null ? String(value) : ''}
            onChangeText={(v) => onChange(fieldKey, v === '' ? null : Number(v))}
            keyboardType="numeric" placeholder="min"
            placeholderTextColor={palette.textTertiary}
            style={{ fontSize: 15, fontWeight: '500', fontFamily: 'monospace', color: palette.text, borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3), paddingVertical: 4, width: 80 }}
          />
          <Text style={{ fontSize: 13, color: palette.textTertiary }}>min = {minsToHmm(value ?? null)}</Text>
        </View>
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', fontFamily: 'monospace', color: palette.text }}>
        {value != null ? `${value} min (${minsToHmm(value)})` : '---'}
      </Text>
    </View>
  )
}

// ── Picker field (selectable options) ──
function PickerField({ label, value, options, editing, fieldKey, editValue, onChange, palette, isDark, accent }: {
  label: string; value: any; options: string[]; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean; accent: string
}) {
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {options.map(opt => {
            const active = (editValue || value) === opt
            return (
              <Pressable key={opt} onPress={() => onChange(fieldKey, opt)} className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? accent : palette.cardBorder }}>
                <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>{opt}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{value ?? '---'}</Text>
    </View>
  )
}

// ── Field ──
function Field({ label, value, editing, fieldKey, editValue, onChange, palette, numeric, mono, maxLength, multiline }: {
  label: string; value: any; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; numeric?: boolean; mono?: boolean; maxLength?: number; multiline?: boolean
}) {
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => { if (mono) v = v.toUpperCase(); onChange(fieldKey, numeric ? (v === '' ? null : Number(v)) : v) }}
          keyboardType={numeric ? 'numeric' : 'default'}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          maxLength={maxLength} multiline={multiline}
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined, borderBottomWidth: 1, borderBottomColor: accentTint('#1e40af', 0.3), paddingVertical: 4, minHeight: multiline ? 60 : undefined, textAlignVertical: multiline ? 'top' : undefined }}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}>{value ?? '---'}</Text>
    </View>
  )
}

// ── Toggle field ──
function ToggleField({ label, value, editing, fieldKey, editValue, onChange, palette, isDark }: {
  label: string; value: boolean; editing: boolean; fieldKey: string; editValue: any;
  onChange: (k: string, v: any) => void; palette: Palette; isDark: boolean
}) {
  const current = editing ? !!editValue : value
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      {editing ? (
        <Pressable onPress={() => onChange(fieldKey, !editValue)} className="self-start px-3 py-1 rounded-lg"
          style={{ backgroundColor: current ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>{current ? 'Yes' : 'No'}</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary }}>{value ? 'Yes' : 'No'}</Text>
      )}
    </View>
  )
}
