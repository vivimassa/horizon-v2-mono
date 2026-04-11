import { useState, useEffect, useCallback } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type MppLeadTimeGroupRef } from '@skyhub/api'
import { ChevronLeft, Timer } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CREW_TYPES: Array<{ key: string; label: string }> = [
  { key: 'cockpit', label: 'Cockpit' },
  { key: 'cabin', label: 'Cabin' },
  { key: 'other', label: 'Other' },
]

export default function MppLeadTimeAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    code: '',
    label: '',
    description: '',
    color: '#7c3aed',
    crewType: 'cockpit',
  })

  const handleCreate = useCallback(async () => {
    if (!form.code.trim() || !form.label.trim()) {
      setError('Code and label are required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createMppLeadTimeGroup({
        operatorId,
        code: form.code.toUpperCase().trim(),
        label: form.label.trim(),
        description: form.description.trim() || null,
        color: form.color,
        crewType: form.crewType as any,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const p = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'This group code already exists.' : p.error || msg
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
          <Timer size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Lead Time Group</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="Code *"
            value={form.code}
            flex={isTablet ? 0.4 : 1}
            onChangeText={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))}
            palette={palette}
            mono
            maxLength={6}
            placeholder="e.g. PER"
          />
          <FormField
            label="Label *"
            value={form.label}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, label: v }))}
            palette={palette}
            placeholder="e.g. External Recruitment"
          />
        </View>

        {/* Crew Type */}
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
          Crew Type
        </Text>
        <View className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
          {CREW_TYPES.map((ct) => {
            const active = form.crewType === ct.key
            return (
              <Pressable
                key={ct.key}
                onPress={() => setForm((p) => ({ ...p, crewType: ct.key }))}
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
                  {ct.label}
                </Text>
              </Pressable>
            )
          })}
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
        <View className="flex-row flex-wrap" style={{ gap: 8, marginBottom: 12 }}>
          {['#7c3aed', '#0891b2', '#be185d', '#dc2626', '#ea580c', '#16a34a', '#1e40af', '#6b7280'].map((c) => (
            <Pressable
              key={c}
              onPress={() => setForm((p) => ({ ...p, color: c }))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: c,
                borderWidth: form.color === c ? 3 : 0,
                borderColor: '#fff',
                ...(form.color === c
                  ? { shadowColor: c, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }
                  : {}),
              }}
            />
          ))}
        </View>

        <FormField
          label="Description"
          value={form.description}
          multiline
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          palette={palette}
          placeholder="Optional description..."
        />

        <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 8, marginBottom: 16 }}>
          You can add lead time items after creating the group.
        </Text>

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
  mono,
  maxLength,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: any
  flex?: number
  mono?: boolean
  maxLength?: number
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
        maxLength={maxLength}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        multiline={multiline}
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
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? 'top' : undefined,
        }}
      />
    </View>
  )
}
