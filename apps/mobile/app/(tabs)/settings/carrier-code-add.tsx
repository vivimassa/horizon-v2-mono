import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, Building2 } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CATEGORIES = ['Air', 'Ground', 'Other']

export default function CarrierCodeAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ iataCode: '', icaoCode: '', name: '', category: 'Air' })

  const handleCreate = useCallback(async () => {
    if (!form.iataCode.trim() || !form.name.trim()) {
      setError('IATA code and name are required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createCarrierCode({
        operatorId,
        iataCode: form.iataCode.toUpperCase().trim(),
        icaoCode: form.icaoCode.toUpperCase().trim() || null,
        name: form.name.trim(),
        category: form.category as any,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const p = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'This carrier code already exists.' : p.error || msg
        }
      } catch {}
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [form, operatorId, router])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View
        className="flex-row items-center px-4 pt-2 pb-3"
        style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
      >
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
          <ChevronLeft size={24} color={accent} strokeWidth={2} />
        </Pressable>
        <View
          className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
        >
          <Building2 size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Carrier Code</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="IATA Code *"
            value={form.iataCode}
            flex={isTablet ? 0.3 : 1}
            onChangeText={(v) => setForm((p) => ({ ...p, iataCode: v.toUpperCase() }))}
            palette={palette}
            mono
            maxLength={2}
            placeholder="e.g. VJ"
          />
          <FormField
            label="ICAO Code"
            value={form.icaoCode}
            flex={isTablet ? 0.3 : 1}
            onChangeText={(v) => setForm((p) => ({ ...p, icaoCode: v.toUpperCase() }))}
            palette={palette}
            mono
            maxLength={3}
            placeholder="e.g. VJC"
          />
          <FormField
            label="Name *"
            value={form.name}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            palette={palette}
            placeholder="e.g. VietJet Air"
          />
        </View>

        <Text
          style={{
            fontSize: 12,
            color: palette.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: '600',
            marginBottom: 6,
          }}
        >
          Category
        </Text>
        <View className="flex-row" style={{ gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map((cat) => {
            const active = form.category === cat
            return (
              <Pressable
                key={cat}
                onPress={() => setForm((p) => ({ ...p, category: cat }))}
                className="flex-row items-center px-3 py-2.5 rounded-lg flex-1 justify-center"
                style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}
                >
                  {cat}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {error ? (
          <View
            className="rounded-lg px-3 py-2 mb-3"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleCreate}
          disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
            {creating ? 'Creating...' : 'Add Carrier'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function FormField({
  label,
  value,
  onChangeText,
  palette,
  flex = 1,
  mono,
  maxLength,
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: any
  flex?: number
  mono?: boolean
  maxLength?: number
  placeholder?: string
}) {
  return (
    <View style={{ flex, marginBottom: 4 }}>
      <Text
        style={{
          fontSize: 12,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        style={{
          fontSize: 15,
          fontWeight: '500',
          color: palette.text,
          fontFamily: mono ? 'monospace' : undefined,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: palette.card,
        }}
      />
    </View>
  )
}
