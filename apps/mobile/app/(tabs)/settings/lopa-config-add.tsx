import { useState, useCallback, useEffect, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CabinClassRef, type CabinEntry, type AircraftTypeRef } from '@skyhub/api'
import {
  ChevronLeft, Plane, ChevronDown, Search, Check,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { AircraftSeatMap } from '../../../components/lopa/AircraftSeatMap'
import { CabinEntryRow } from '../../../components/lopa/CabinEntryRow'

export default function LopaConfigAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()

  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([])
  const [aircraftTypes, setAircraftTypes] = useState<AircraftTypeRef[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Aircraft type picker
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [typeSearch, setTypeSearch] = useState('')

  const [form, setForm] = useState({
    aircraftType: '',
    configName: '',
    isDefault: false,
    notes: '',
    cabins: [{ classCode: 'Y', seats: 180 }] as CabinEntry[],
  })

  useEffect(() => {
    Promise.all([api.getCabinClasses(), api.getAircraftTypes()])
      .then(([classes, types]) => { setCabinClasses(classes); setAircraftTypes(types) })
      .catch(console.error)
  }, [])

  const classOptions = useMemo(
    () => cabinClasses.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [cabinClasses]
  )

  const filteredTypes = useMemo(() => {
    const q = typeSearch.toLowerCase()
    const list = q
      ? aircraftTypes.filter(t => t.icaoType.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      : aircraftTypes
    return list.slice(0, 30)
  }, [aircraftTypes, typeSearch])

  const selectedType = aircraftTypes.find(t => t.icaoType === form.aircraftType)

  const enabledCodes = new Set(form.cabins.map(c => c.classCode))

  const toggleCabinClass = useCallback((code: string) => {
    setForm(p => {
      const exists = p.cabins.find(c => c.classCode === code)
      if (exists) {
        const next = p.cabins.filter(c => c.classCode !== code)
        return { ...p, cabins: next.length > 0 ? next : p.cabins }
      }
      const cc = cabinClasses.find(c => c.code === code)
      const layout = (cc?.seatLayout || '3-3').split('-').map(Number)
      const perRow = layout.reduce((s, g) => s + g, 0)
      const defaultSeats = perRow <= 2 ? 8 : perRow <= 4 ? 24 : 180
      return { ...p, cabins: [...p.cabins, { classCode: code, seats: defaultSeats }] }
    })
  }, [cabinClasses])

  const totalSeats = useMemo(() => form.cabins.reduce((s, c) => s + c.seats, 0), [form.cabins])

  const handleCreate = useCallback(async () => {
    if (!form.aircraftType || !form.configName || form.cabins.length === 0) {
      setError('Aircraft type, config name, and at least one cabin are required'); return
    }
    setCreating(true); setError('')
    try {
      await api.createLopaConfig({
        operatorId,
        aircraftType: form.aircraftType.toUpperCase(),
        configName: form.configName,
        cabins: form.cabins,
        isDefault: form.isDefault,
        notes: form.notes || null,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const match = msg.match(/API (\d+): (.+)/)
        if (match) { const parsed = JSON.parse(match[2]); msg = parsed.error || msg }
      } catch { /* raw */ }
      setError(msg)
    } finally { setCreating(false) }
  }, [form, router])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View
          className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
        >
          <Plane size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add LOPA Config</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Aircraft Type Picker */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>
          Aircraft Type *
        </Text>
        <Pressable
          onPress={() => setTypePickerOpen(!typePickerOpen)}
          className="flex-row items-center rounded-xl mb-1"
          style={{
            borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card,
            paddingHorizontal: 12, paddingVertical: 10, gap: 8,
          }}>
          {selectedType ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
                {selectedType.icaoType}
              </Text>
              <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }} numberOfLines={1}>
                {selectedType.name}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: palette.textTertiary, flex: 1 }}>Select aircraft type...</Text>
          )}
          <ChevronDown size={16} color={palette.textTertiary} strokeWidth={1.8}
            style={{ transform: [{ rotate: typePickerOpen ? '180deg' : '0deg' }] }} />
        </Pressable>

        {typePickerOpen && (
          <View className="rounded-xl mb-3" style={{
            borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card,
            maxHeight: 200, overflow: 'hidden',
          }}>
            <View className="flex-row items-center px-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
              <Search size={14} color={palette.textTertiary} strokeWidth={1.8} />
              <TextInput
                value={typeSearch}
                onChangeText={setTypeSearch}
                placeholder="Search types..."
                placeholderTextColor={palette.textTertiary}
                style={{ fontSize: 13, color: palette.text, flex: 1, paddingVertical: 8, marginLeft: 8 }}
                autoCapitalize="none"
              />
            </View>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {filteredTypes.map(t => (
                <Pressable key={t._id}
                  onPress={() => { setForm(p => ({ ...p, aircraftType: t.icaoType })); setTypePickerOpen(false); setTypeSearch('') }}
                  className="flex-row items-center px-3 py-2.5 active:opacity-70"
                  style={{ borderBottomWidth: 1, borderBottomColor: palette.border, gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 40 }}>
                    {t.icaoType}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.text, flex: 1 }} numberOfLines={1}>{t.name}</Text>
                  {form.aircraftType === t.icaoType && <Check size={14} color={accent} strokeWidth={2.5} />}
                </Pressable>
              ))}
              {filteredTypes.length === 0 && (
                <Text style={{ fontSize: 13, color: palette.textTertiary, padding: 12 }}>No types found</Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Config Name */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>
            Config Name *
          </Text>
          <TextInput
            value={form.configName}
            onChangeText={(v) => setForm(p => ({ ...p, configName: v }))}
            placeholder="e.g. High Density, Premium Mix"
            placeholderTextColor={palette.textTertiary}
            style={{
              fontSize: 15, fontWeight: '500', color: palette.text,
              borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.card,
            }}
          />
        </View>

        {/* Default toggle */}
        <Pressable
          onPress={() => setForm(p => ({ ...p, isDefault: !p.isDefault }))}
          className="flex-row items-center mb-4"
          style={{ gap: 8 }}
        >
          <View style={{
            width: 20, height: 20, borderRadius: 4,
            backgroundColor: form.isDefault ? accent : 'transparent',
            borderWidth: form.isDefault ? 0 : 1.5, borderColor: palette.textTertiary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {form.isDefault && <Check size={12} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>Set as default configuration</Text>
        </Pressable>

        {/* Cabin Classes toggle chips */}
        <View className="flex-row items-center justify-between mb-2">
          <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' }}>
            Cabin Classes
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>{totalSeats} total seats</Text>
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {classOptions.map(cc => {
            const active = enabledCodes.has(cc.code)
            const color = modeColor(cc.color || '#9ca3af', isDark)
            return (
              <Pressable key={cc.code} onPress={() => toggleCabinClass(cc.code)}
                className="flex-row items-center px-3 py-2 rounded-xl active:opacity-70"
                style={{
                  borderWidth: 1,
                  borderColor: active ? `${color}66` : palette.cardBorder,
                  backgroundColor: active ? `${color}18` : 'transparent',
                  opacity: active ? 1 : 0.5,
                  gap: 6,
                }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
                <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: active ? color : palette.text }}>
                  {cc.code}
                </Text>
                <Text style={{ fontSize: 12, color: active ? color : palette.textSecondary }}>{cc.name}</Text>
                {active && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color, fontFamily: 'monospace', opacity: 0.7 }}>
                    {form.cabins.find(c => c.classCode === cc.code)?.seats ?? 0}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>

        {/* Cabin entry rows */}
        {form.cabins.length > 0 && (
          <View style={{ gap: 8, marginBottom: 16 }}>
            {form.cabins.map((cabin, i) => (
              <CabinEntryRow
                key={cabin.classCode}
                cabin={cabin}
                cabinClasses={cabinClasses}
                palette={palette}
                isDark={isDark}
                onChangeSeats={(seats) => {
                  const u = [...form.cabins]; u[i] = { ...u[i], seats }
                  setForm(p => ({ ...p, cabins: u }))
                }}
                onRemove={form.cabins.length > 1 ? () => toggleCabinClass(cabin.classCode) : undefined}
              />
            ))}
          </View>
        )}

        {/* Live seat map preview */}
        {form.cabins.length > 0 && form.cabins.some(c => c.seats > 0) && (
          <View style={{
            marginBottom: 16, paddingVertical: 12, paddingHorizontal: 8,
            borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 12,
            backgroundColor: palette.card,
          }}>
            <AircraftSeatMap cabins={form.cabins} cabinClasses={cabinClasses} aircraftType={form.aircraftType} palette={palette} isDark={isDark} />
          </View>
        )}

        {/* Notes */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>
            Notes
          </Text>
          <TextInput
            value={form.notes}
            onChangeText={(v) => setForm(p => ({ ...p, notes: v }))}
            placeholder="Optional notes..."
            placeholderTextColor={palette.textTertiary}
            multiline
            style={{
              fontSize: 15, color: palette.text, minHeight: 60, textAlignVertical: 'top',
              borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.card,
            }}
          />
        </View>

        {/* Error */}
        {error ? (
          <View className="rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <Pressable onPress={handleCreate} disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
            {creating ? 'Creating...' : `Add Configuration \u00B7 ${totalSeats} seats`}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
