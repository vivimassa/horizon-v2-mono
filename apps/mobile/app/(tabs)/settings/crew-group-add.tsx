import { useState, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '@skyhub/api'
import { ChevronLeft, Users } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

export default function CrewGroupAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '', sortOrder: '' })

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createCrewGroup({
        operatorId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const p = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'A group with this name already exists.' : p.error || msg
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
          <Users size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Crew Group</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="Name *"
            value={form.name}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            palette={palette}
            placeholder="e.g. 50/50 Cockpit Crew"
          />
          <FormField
            label="Sort Order"
            value={form.sortOrder}
            flex={isTablet ? 0.4 : 1}
            onChangeText={(v) => setForm((p) => ({ ...p, sortOrder: v }))}
            palette={palette}
            numeric
            placeholder="e.g. 10"
          />
        </View>

        <FormField
          label="Description"
          value={form.description}
          multiline
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          palette={palette}
          placeholder="Optional description..."
        />

        {error ? (
          <View
            className="rounded-lg px-3 py-2 mt-3"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleCreate}
          disabled={creating}
          className="items-center py-3.5 rounded-xl mt-4 active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
            {creating ? 'Creating...' : 'Add Group'}
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
  numeric,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: any
  flex?: number
  numeric?: boolean
  placeholder?: string
  multiline?: boolean
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
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        multiline={multiline}
        style={{
          fontSize: 15,
          fontWeight: '500',
          color: palette.text,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: palette.card,
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? 'top' : undefined,
        }}
      />
    </View>
  )
}
