import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, Armchair } from 'lucide-react-native'
import { accentTint, modeColor } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { SeatRowPreview } from '../../../components/lopa/SeatRowPreview'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'

interface SeatPreset {
  label: string; seatLayout: string; seatPitchIn: string; seatWidthIn: string
  seatType: string; hasIfe: boolean; hasPower: boolean
}

const SEAT_PRESETS: SeatPreset[] = [
  { label: 'First / Suite', seatLayout: '1-1', seatPitchIn: '82', seatWidthIn: '36', seatType: 'suite', hasIfe: true, hasPower: true },
  { label: 'Business', seatLayout: '2-2', seatPitchIn: '42', seatWidthIn: '21', seatType: 'lie-flat', hasIfe: true, hasPower: true },
  { label: 'Premium Eco', seatLayout: '3-3', seatPitchIn: '34', seatWidthIn: '19', seatType: 'premium', hasIfe: true, hasPower: true },
  { label: 'Economy', seatLayout: '3-3', seatPitchIn: '29', seatWidthIn: '17', seatType: 'standard', hasIfe: false, hasPower: true },
  { label: 'Eco (HD)', seatLayout: '3-3', seatPitchIn: '28', seatWidthIn: '17', seatType: 'standard', hasIfe: false, hasPower: false },
]

const SEAT_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard', premium: 'Premium', 'lie-flat': 'Lie-Flat', suite: 'Suite',
}
const SEAT_TYPES = ['standard', 'premium', 'lie-flat', 'suite'] as const

export default function CabinClassAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    code: '', name: '', color: '#3b82f6', sortOrder: '0',
    seatLayout: '3-3', seatPitchIn: '29', seatWidthIn: '17',
    seatType: 'standard', hasIfe: false, hasPower: true,
  })

  const applyPreset = (preset: SeatPreset) => {
    setForm(p => ({
      ...p,
      seatLayout: preset.seatLayout, seatPitchIn: preset.seatPitchIn,
      seatWidthIn: preset.seatWidthIn, seatType: preset.seatType,
      hasIfe: preset.hasIfe, hasPower: preset.hasPower,
    }))
  }

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name) { setError('Code and name are required'); return }
    setCreating(true); setError('')
    try {
      await api.createCabinClass({
        operatorId,
        code: form.code.toUpperCase(),
        name: form.name,
        color: form.color || null,
        sortOrder: Number(form.sortOrder) || 0,
        seatLayout: form.seatLayout || null,
        seatPitchIn: form.seatPitchIn ? Number(form.seatPitchIn) : null,
        seatWidthIn: form.seatWidthIn ? Number(form.seatWidthIn) : null,
        seatType: (form.seatType as any) || null,
        hasIfe: form.hasIfe,
        hasPower: form.hasPower,
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

  const classColor = modeColor(form.color || '#9ca3af', isDark)

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
          <Armchair size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Cabin Class</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Presets */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 8 }}>
          Start from Preset
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }}
          contentContainerStyle={{ gap: 6 }}>
          {SEAT_PRESETS.map(preset => {
            const active = form.seatLayout === preset.seatLayout && form.seatType === preset.seatType
            return (
              <Pressable key={preset.label} onPress={() => applyPreset(preset)}
                className="px-3 py-2 rounded-lg"
                style={{
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                }}>
                <Text style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? accent : palette.text }}>
                  {preset.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Code + Name */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField label="Code *" value={form.code} flex={0.4}
            onChangeText={(v) => setForm(p => ({ ...p, code: v.toUpperCase() }))}
            palette={palette} maxLength={2} mono />
          <FormField label="Name *" value={form.name} flex={1}
            onChangeText={(v) => setForm(p => ({ ...p, name: v }))}
            palette={palette} />
        </View>

        {/* Color */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>
          Color
        </Text>
        <View style={{ marginBottom: 12 }}>
          <ColorSwatchPicker value={form.color} onChange={(v) => setForm(p => ({ ...p, color: v }))} palette={palette} isDark={isDark} editing />
        </View>

        {/* Sort Order + Layout */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField label="Sort Order" value={form.sortOrder} flex={0.5}
            onChangeText={(v) => setForm(p => ({ ...p, sortOrder: v }))}
            palette={palette} numeric />
          <FormField label="Seat Layout" value={form.seatLayout} flex={0.5}
            onChangeText={(v) => setForm(p => ({ ...p, seatLayout: v }))}
            palette={palette} mono />
        </View>

        {/* Pitch + Width */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField label="Pitch (in)" value={form.seatPitchIn} flex={1}
            onChangeText={(v) => setForm(p => ({ ...p, seatPitchIn: v }))}
            palette={palette} numeric />
          <FormField label="Width (in)" value={form.seatWidthIn} flex={1}
            onChangeText={(v) => setForm(p => ({ ...p, seatWidthIn: v }))}
            palette={palette} numeric />
        </View>

        {/* Seat Type */}
        <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 6 }}>
          Seat Type
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {SEAT_TYPES.map(st => {
            const active = form.seatType === st
            return (
              <Pressable key={st} onPress={() => setForm(p => ({ ...p, seatType: st }))}
                className="px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1, borderColor: active ? accent : palette.cardBorder,
                }}>
                <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>
                  {SEAT_TYPE_LABELS[st]}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Toggles */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 16 }}>
          <ToggleChip label="IFE Screen" value={form.hasIfe} onToggle={() => setForm(p => ({ ...p, hasIfe: !p.hasIfe }))} palette={palette} isDark={isDark} accent={accent} />
          <ToggleChip label="Power Outlet" value={form.hasPower} onToggle={() => setForm(p => ({ ...p, hasPower: !p.hasPower }))} palette={palette} isDark={isDark} accent={accent} />
        </View>

        {/* Live preview */}
        {form.seatLayout && (
          <View style={{
            marginBottom: 16, paddingVertical: 16, paddingHorizontal: 12,
            borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 12,
            backgroundColor: palette.card,
          }}>
            <SeatRowPreview
              seatLayout={form.seatLayout}
              color={classColor}
              seatType={form.seatType as any}
              pitchIn={form.seatPitchIn ? Number(form.seatPitchIn) : null}
              palette={palette}
            />
          </View>
        )}

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
            {creating ? 'Creating...' : 'Add Cabin Class'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Form field ──
function FormField({ label, value, onChangeText, palette, flex = 1, numeric, mono, maxLength }: {
  label: string; value: string; onChangeText: (v: string) => void; palette: any
  flex?: number; numeric?: boolean; mono?: boolean; maxLength?: number
}) {
  return (
    <View style={{ flex }}>
      <Text style={{ fontSize: 12, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        keyboardType={numeric ? 'numeric' : 'default'}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        style={{
          fontSize: 15, fontWeight: '500', color: palette.text,
          fontFamily: mono ? 'monospace' : undefined,
          borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 8,
          paddingHorizontal: 12, paddingVertical: 8,
          backgroundColor: palette.card,
        }}
        placeholderTextColor={palette.textTertiary}
      />
    </View>
  )
}

// ── Toggle chip ──
function ToggleChip({ label, value, onToggle, palette, isDark, accent }: {
  label: string; value: boolean; onToggle: () => void; palette: any; isDark: boolean; accent: string
}) {
  return (
    <Pressable onPress={onToggle}
      className="flex-row items-center flex-1 px-3 py-2.5 rounded-lg"
      style={{
        borderWidth: 1,
        borderColor: value ? accent : palette.cardBorder,
        backgroundColor: value ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
        gap: 8,
      }}>
      <View style={{
        width: 18, height: 18, borderRadius: 4,
        backgroundColor: value ? accent : 'transparent',
        borderWidth: value ? 0 : 1.5, borderColor: palette.textTertiary,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {value && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
      </View>
      <Text style={{ fontSize: 13, fontWeight: '500', color: value ? accent : palette.text }}>{label}</Text>
    </Pressable>
  )
}
