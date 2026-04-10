import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, UserRound } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CATEGORIES: Array<{ key: 'cockpit' | 'cabin'; label: string }> = [
  { key: 'cockpit', label: 'Flight Deck' },
  { key: 'cabin', label: 'Cabin Crew' },
]

export default function CrewPositionAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'cockpit' as 'cockpit' | 'cabin',
    rankOrder: '',
    isPic: false,
    canDownrank: false,
    color: '#4338ca',
    description: '',
  })

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name) { setError('Code and name are required'); return }
    if (!form.rankOrder) { setError('Rank order is required'); return }
    setCreating(true); setError('')
    try {
      await api.createCrewPosition({
        operatorId,
        code: form.code.toUpperCase(),
        name: form.name,
        category: form.category,
        rankOrder: Number(form.rankOrder),
        isPic: form.category === 'cockpit' ? form.isPic : false,
        canDownrank: form.canDownrank,
        color: form.color || null,
        description: form.description || null,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const p = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'This position code already exists.' : p.error || msg
        }
      } catch {}
      setError(msg)
    } finally { setCreating(false) }
  }, [form, router])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="flex-row items-center px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}>
          <UserRound size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Crew Position</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Code + Rank side by side */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField label="Code *" value={form.code} flex={0.5}
            onChangeText={(v) => setForm(p => ({ ...p, code: v.toUpperCase() }))}
            palette={palette} mono maxLength={3} placeholder="e.g. CP" />
          <FormField label="Rank Order *" value={form.rankOrder} flex={0.5}
            onChangeText={(v) => setForm(p => ({ ...p, rankOrder: v }))}
            palette={palette} numeric placeholder="e.g. 1" />
        </View>

        <FormField label="Name *" value={form.name}
          onChangeText={(v) => setForm(p => ({ ...p, name: v }))}
          palette={palette} placeholder="e.g. Captain" />

        {/* Category picker */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginTop: 12, marginBottom: 6 }}>Category</Text>
        <View className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
          {CATEGORIES.map(cat => {
            const active = form.category === cat.key
            return (
              <Pressable key={cat.key} onPress={() => setForm(p => ({ ...p, category: cat.key, isPic: cat.key === 'cabin' ? false : p.isPic }))}
                className="flex-row items-center px-3 py-2.5 rounded-lg flex-1 justify-center"
                style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent', borderWidth: 1, borderColor: active ? accent : palette.cardBorder }}>
                <Text style={{ fontSize: 14, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>{cat.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Toggles */}
        {form.category === 'cockpit' && (
          <ToggleRow label="Pilot in Command (PIC)" value={form.isPic}
            onToggle={() => setForm(p => ({ ...p, isPic: !p.isPic }))} palette={palette} isDark={isDark} />
        )}
        <ToggleRow label="Can Downrank" value={form.canDownrank}
          onToggle={() => setForm(p => ({ ...p, canDownrank: !p.canDownrank }))} palette={palette} isDark={isDark} />

        {/* Color */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginTop: 12, marginBottom: 6 }}>Color</Text>
        <View style={{ marginBottom: 12 }}>
          <ColorSwatchPicker value={form.color} onChange={(v) => setForm(p => ({ ...p, color: v }))}
            palette={palette} isDark={isDark} editing />
        </View>

        {/* Description */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>Description</Text>
          <TextInput value={form.description}
            onChangeText={(v) => setForm(p => ({ ...p, description: v }))}
            placeholder="Optional description..."
            placeholderTextColor={palette.textTertiary}
            multiline
            style={{ fontSize: 15, color: palette.text, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.card }} />
        </View>

        {/* Error */}
        {error ? (
          <View className="rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* Create button */}
        <Pressable onPress={handleCreate} disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{creating ? 'Creating...' : 'Add Position'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function FormField({ label, value, onChangeText, palette, flex = 1, mono, maxLength, numeric, placeholder }: {
  label: string; value: string; onChangeText: (v: string) => void; palette: any; flex?: number;
  mono?: boolean; maxLength?: number; numeric?: boolean; placeholder?: string
}) {
  return (
    <View style={{ flex, marginBottom: 4 }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} maxLength={maxLength}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined, borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.card }} />
    </View>
  )
}

function ToggleRow({ label, value, onToggle, palette, isDark }: {
  label: string; value: boolean; onToggle: () => void; palette: any; isDark: boolean
}) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-center justify-between py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{label}</Text>
      <View className="px-3 py-1 rounded-lg"
        style={{ backgroundColor: value ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: value ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>
          {value ? 'Yes' : 'No'}
        </Text>
      </View>
    </Pressable>
  )
}
