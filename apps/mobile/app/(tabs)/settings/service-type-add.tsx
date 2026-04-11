import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, Tag } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function ServiceTypeAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    color: '#3b82f6',
  })

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name) {
      setError('Code and name are required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createFlightServiceType({
        operatorId,
        code: form.code.toUpperCase(),
        name: form.name,
        description: form.description || null,
        color: form.color || null,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const match = msg.match(/API (\d+): (.+)/)
        if (match) {
          const parsed = JSON.parse(match[2])
          if (Number(match[1]) === 409) msg = 'This service type already exists.'
          else msg = parsed.error || msg
        }
      } catch {
        /* raw */
      }
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [form, router])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
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
          <Tag size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Service Type</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Code + Name */}
        <View className="flex-row" style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="Code *"
            value={form.code}
            flex={0.4}
            onChangeText={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))}
            palette={palette}
            maxLength={2}
            mono
          />
          <FormField
            label="Name *"
            value={form.name}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            palette={palette}
          />
        </View>

        {/* Description */}
        <View style={{ marginBottom: 12 }}>
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
            Description
          </Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            placeholder="Optional description..."
            placeholderTextColor={palette.textTertiary}
            multiline
            style={{
              fontSize: 15,
              color: palette.text,
              minHeight: 60,
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: palette.cardBorder,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: palette.card,
            }}
          />
        </View>

        {/* Color */}
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
          Color
        </Text>
        <View style={{ marginBottom: 16 }}>
          <ColorSwatchPicker
            value={form.color}
            onChange={(v) => setForm((p) => ({ ...p, color: v }))}
            palette={palette}
            isDark={isDark}
            editing
          />
        </View>

        {/* Error */}
        {error ? (
          <View
            className="rounded-lg px-3 py-2 mb-3"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <Pressable
          onPress={handleCreate}
          disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
            {creating ? 'Creating...' : 'Add Service Type'}
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
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: any
  flex?: number
  mono?: boolean
  maxLength?: number
}) {
  return (
    <View style={{ flex }}>
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
        placeholderTextColor={palette.textTertiary}
      />
    </View>
  )
}
