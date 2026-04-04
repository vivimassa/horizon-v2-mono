import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, Plane } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'

const MANUFACTURERS = ['Airbus', 'Boeing', 'Embraer', 'ATR', 'Bombardier', 'Comac']
const CATEGORIES = [
  { value: 'narrow_body', label: 'Narrow Body' },
  { value: 'wide_body', label: 'Wide Body' },
  { value: 'regional', label: 'Regional' },
  { value: 'turboprop', label: 'Turboprop' },
]

export default function AircraftTypeAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    icaoType: '', name: '', manufacturer: 'Airbus', category: 'narrow_body', family: '',
  })

  const handleCreate = useCallback(async () => {
    if (!form.icaoType || !form.name) { setError('ICAO type and name are required'); return }
    setCreating(true); setError('')
    try {
      await api.createAircraftType({
        operatorId: 'horizon',
        icaoType: form.icaoType.toUpperCase(),
        name: form.name,
        manufacturer: form.manufacturer || null,
        category: form.category,
        family: form.family || null,
        cockpitCrewRequired: 2,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const match = msg.match(/API (\d+): (.+)/)
        if (match) {
          const parsed = JSON.parse(match[2])
          if (Number(match[1]) === 409) msg = 'This aircraft type already exists.'
          else msg = parsed.error || msg
        }
      } catch { /* raw */ }
      setError(msg)
    } finally { setCreating(false) }
  }, [form, router])

  const catLabel = CATEGORIES.find(c => c.value === form.category)?.label

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}>
          <Plane size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Aircraft Type</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled">
        {/* ICAO + Name */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField label="ICAO Type *" value={form.icaoType} flex={0.5}
            onChangeText={(v) => setForm(p => ({ ...p, icaoType: v.toUpperCase() }))}
            palette={palette} maxLength={4} mono />
          <FormField label="Name *" value={form.name} flex={1}
            onChangeText={(v) => setForm(p => ({ ...p, name: v }))}
            palette={palette} />
        </View>

        {/* Manufacturer */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>
          Manufacturer
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {MANUFACTURERS.map(m => {
            const active = form.manufacturer === m
            return (
              <Pressable key={m} onPress={() => setForm(p => ({ ...p, manufacturer: m }))}
                className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? accent : palette.cardBorder }}>
                <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>{m}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Category */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>
          Category
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {CATEGORIES.map(c => {
            const active = form.category === c.value
            return (
              <Pressable key={c.value} onPress={() => setForm(p => ({ ...p, category: c.value }))}
                className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? accent : palette.cardBorder }}>
                <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>{c.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Family */}
        <FormField label="Family" value={form.family}
          onChangeText={(v) => setForm(p => ({ ...p, family: v }))}
          palette={palette} />
        <View style={{ height: 12 }} />

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
            {creating ? 'Creating...' : 'Add Aircraft Type'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function FormField({ label, value, onChangeText, palette, flex = 1, mono, maxLength }: {
  label: string; value: string; onChangeText: (v: string) => void; palette: any
  flex?: number; mono?: boolean; maxLength?: number
}) {
  return (
    <View style={{ flex }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} maxLength={maxLength}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined, borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.card }}
        placeholderTextColor={palette.textTertiary} />
    </View>
  )
}
