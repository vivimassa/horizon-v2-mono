import { useState, useEffect, useCallback, useMemo } from 'react'
import { Text, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type ExpiryCodeCategoryRef } from '@skyhub/api'
import { ChevronLeft, FileCheck } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { EXPIRY_FORMULAS, SEVERITY_DEFINITIONS } from '@skyhub/logic'

const CREW_CATS: Array<{ key: string; label: string }> = [
  { key: 'both', label: 'All Crew' },
  { key: 'cockpit', label: 'Flight Deck' },
  { key: 'cabin', label: 'Cabin Crew' },
]

export default function ExpiryCodeAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [categories, setCategories] = useState<ExpiryCodeCategoryRef[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    code: '',
    name: '',
    categoryId: '',
    crewCategory: 'both',
    description: '',
    formula: 'fixed_validity',
    formulaParams: {} as Record<string, any>,
    warningDays: '30',
    severity: ['block_auto_assign', 'include_in_reports', 'show_validation_warning'] as string[],
    notes: '',
  })

  useEffect(() => {
    if (!operatorId) return
    api
      .getExpiryCodeCategories(operatorId)
      .then((cats) => {
        setCategories(cats)
        if (cats.length > 0 && !form.categoryId) setForm((p) => ({ ...p, categoryId: cats[0]._id }))
      })
      .catch(console.error)
  }, [operatorId])

  const formulaDef = useMemo(() => EXPIRY_FORMULAS.find((f) => f.id === form.formula), [form.formula])

  const handleCreate = useCallback(async () => {
    if (!form.code || !form.name) {
      setError('Code and name are required')
      return
    }
    if (!form.categoryId) {
      setError('Category is required')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api.createExpiryCode({
        operatorId,
        categoryId: form.categoryId,
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        description: form.description || null,
        crewCategory: form.crewCategory as any,
        formula: form.formula,
        formulaParams: form.formulaParams,
        warningDays: form.warningDays ? Number(form.warningDays) : null,
        severity: form.severity,
        notes: form.notes || null,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const p = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'This expiry code already exists.' : p.error || msg
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
          <FileCheck size={18} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Expiry Code</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Code + Name */}
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="Code *"
            value={form.code}
            flex={isTablet ? 0.4 : 1}
            onChangeText={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))}
            palette={palette}
            mono
            maxLength={10}
            placeholder="e.g. MED1"
          />
          <FormField
            label="Name *"
            value={form.name}
            flex={1}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            palette={palette}
            placeholder="e.g. Medical Class 1"
          />
        </View>

        {/* Category */}
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
          Category *
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {categories.map((cat) => {
            const active = form.categoryId === cat._id
            return (
              <Pressable
                key={cat._id}
                onPress={() => setForm((p) => ({ ...p, categoryId: cat._id }))}
                className="flex-row items-center px-2.5 py-1.5 rounded-lg"
                style={{
                  backgroundColor: active ? accentTint(cat.color, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? cat.color : palette.cardBorder,
                  gap: 4,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cat.color }} />
                <Text
                  style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? cat.color : palette.text }}
                >
                  {cat.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Crew Category */}
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
          Crew Category
        </Text>
        <View className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
          {CREW_CATS.map((c) => {
            const active = form.crewCategory === c.key
            return (
              <Pressable
                key={c.key}
                onPress={() => setForm((p) => ({ ...p, crewCategory: c.key }))}
                className="flex-row items-center px-3 py-2 rounded-lg flex-1 justify-center"
                style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}
                >
                  {c.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Formula */}
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
          Formula
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
          {EXPIRY_FORMULAS.map((f) => {
            const active = form.formula === f.id
            return (
              <Pressable
                key={f.id}
                onPress={() => setForm((p) => ({ ...p, formula: f.id, formulaParams: {} }))}
                className="px-2.5 py-1.5 rounded-lg"
                style={{
                  backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}
                >
                  {f.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Formula params */}
        {formulaDef && formulaDef.fields.length > 0 && (
          <View className={isTablet ? 'flex-row flex-wrap' : ''} style={{ gap: 12, marginBottom: 12 }}>
            {formulaDef.fields.map((f) => (
              <FormField
                key={f.key}
                label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}
                value={form.formulaParams[f.key] != null ? String(form.formulaParams[f.key]) : ''}
                onChangeText={(v) =>
                  setForm((p) => ({
                    ...p,
                    formulaParams: {
                      ...p.formulaParams,
                      [f.key]: f.type === 'number' ? (v === '' ? undefined : Number(v)) : v,
                    },
                  }))
                }
                palette={palette}
                numeric={f.type === 'number'}
                flex={isTablet ? 0.5 : 1}
                placeholder={f.placeholder}
              />
            ))}
          </View>
        )}

        {/* Warning days */}
        <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12, marginBottom: 12 }}>
          <FormField
            label="Warning Days"
            value={form.warningDays}
            onChangeText={(v) => setForm((p) => ({ ...p, warningDays: v }))}
            palette={palette}
            numeric
            flex={isTablet ? 0.4 : 1}
            placeholder="e.g. 30"
          />
        </View>

        {/* Severity */}
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
          Enforcement Rules
        </Text>
        <View style={{ gap: 6, marginBottom: 12 }}>
          {SEVERITY_DEFINITIONS.map((sev) => {
            const active = form.severity.includes(sev.key)
            return (
              <Pressable
                key={sev.key}
                onPress={() =>
                  setForm((p) => {
                    const s = [...p.severity]
                    const i = s.indexOf(sev.key)
                    if (i >= 0) s.splice(i, 1)
                    else s.push(sev.key)
                    return { ...p, severity: s }
                  })
                }
                className="flex-row items-start p-3 rounded-lg"
                style={{
                  backgroundColor: active
                    ? accentTint(sev.isDestructive ? '#ef4444' : accent, isDark ? 0.1 : 0.05)
                    : 'transparent',
                  borderWidth: 1,
                  borderColor: active
                    ? sev.isDestructive
                      ? isDark
                        ? 'rgba(239,68,68,0.3)'
                        : '#fecaca'
                      : accentTint(accent, 0.2)
                    : palette.cardBorder,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: active ? (sev.isDestructive ? '#ef4444' : accent) : palette.textTertiary,
                    backgroundColor: active ? (sev.isDestructive ? '#ef4444' : accent) : 'transparent',
                    marginRight: 10,
                    marginTop: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
                <View className="flex-1">
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: sev.isDestructive && active ? (isDark ? '#f87171' : '#dc2626') : palette.text,
                    }}
                  >
                    {sev.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>{sev.description}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>

        {/* Description + Notes */}
        <FormField
          label="Description"
          value={form.description}
          multiline
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          palette={palette}
          placeholder="Optional description..."
        />
        <View style={{ height: 8 }} />
        <FormField
          label="Notes"
          value={form.notes}
          multiline
          onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
          palette={palette}
          placeholder="Optional notes..."
        />

        {/* Error */}
        {error ? (
          <View
            className="rounded-lg px-3 py-2 mt-3"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <Text style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</Text>
          </View>
        ) : null}

        {/* Create */}
        <Pressable
          onPress={handleCreate}
          disabled={creating}
          className="items-center py-3.5 rounded-xl mt-4 active:opacity-70"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
            {creating ? 'Creating...' : 'Add Expiry Code'}
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
  numeric,
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
        maxLength={maxLength}
        autoCapitalize={mono ? 'characters' : 'sentences'}
        keyboardType={numeric ? 'numeric' : 'default'}
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
