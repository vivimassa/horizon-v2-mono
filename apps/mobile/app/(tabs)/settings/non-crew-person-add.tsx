import { useState, useCallback } from 'react'
import { Text as RNText, View, ScrollView, Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type NonCrewPersonCreate } from '@skyhub/api'
import { parseDate, datePlaceholder } from '@skyhub/logic'
import { ChevronLeft, Contact } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorStore } from '../../../src/stores/use-operator-store'

const GENDER_OPTS: Array<{ value: 'M' | 'F' | 'X'; label: string }> = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'X', label: 'Unspecified' },
]

const PRIORITY_OPTS: Array<{ value: 'low' | 'normal' | 'high'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
]

interface FormState {
  first: string
  middle: string
  last: string
  dateOfBirth: string
  gender: 'M' | 'F' | 'X'
  nationality: string
  passportNumber: string
  passportCountry: string
  passportExpiry: string
  email: string
  phone: string
  company: string
  department: string
  jumpseatPriority: 'low' | 'normal' | 'high'
}

const INITIAL: FormState = {
  first: '',
  middle: '',
  last: '',
  dateOfBirth: '',
  gender: 'M',
  nationality: '',
  passportNumber: '',
  passportCountry: '',
  passportExpiry: '',
  email: '',
  phone: '',
  company: '',
  department: '',
  jumpseatPriority: 'normal',
}

function validate(dobIso: string, expIso: string, form: FormState): string | null {
  if (!form.first.trim()) return 'First name required'
  if (!form.last.trim()) return 'Last name required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) return 'Date of birth is not a valid date'
  if (form.nationality.trim().length !== 3) return 'Nationality must be ISO 3166-1 alpha-3 (e.g. VNM)'
  if (!form.passportNumber.trim()) return 'Passport number required'
  if (form.passportCountry.trim().length !== 3) return 'Passport country of issue must be ISO 3166-1 alpha-3'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expIso)) return 'Passport expiry is not a valid date'
  return null
}

export default function NonCrewPersonAddScreen() {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const dateFormat = useOperatorStore((s) => s.dateFormat)
  const datePH = datePlaceholder(dateFormat)

  const [form, setForm] = useState<FormState>(INITIAL)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const upd = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleCreate = useCallback(async () => {
    const dobIso = parseDate(form.dateOfBirth, dateFormat)
    const expIso = parseDate(form.passportExpiry, dateFormat)
    const err = validate(dobIso, expIso, form)
    if (err) {
      setError(err)
      return
    }
    setCreating(true)
    setError('')
    try {
      const payload: NonCrewPersonCreate = {
        fullName: {
          first: form.first.trim(),
          middle: form.middle.trim() || null,
          last: form.last.trim(),
        },
        dateOfBirth: dobIso,
        gender: form.gender,
        nationality: form.nationality.trim().toUpperCase(),
        passport: {
          number: form.passportNumber.trim(),
          countryOfIssue: form.passportCountry.trim().toUpperCase(),
          expiryDate: expIso,
        },
        contact: {
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        },
        company: form.company.trim() || null,
        department: form.department.trim() || null,
        jumpseatPriority: form.jumpseatPriority,
        doNotList: false,
        terminated: false,
      }
      await api.createNonCrewPerson(payload)
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Failed'
      try {
        const m = msg.match(/API (\d+): (.+)/)
        if (m) {
          const parsed = JSON.parse(m[2])
          msg = Number(m[1]) === 409 ? 'A person with that passport already exists.' : parsed.error || msg
        }
      } catch {
        /* use raw */
      }
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [form, router, dateFormat])

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
          <Contact size={18} color={accent} strokeWidth={1.8} />
        </View>
        <RNText style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Non-Crew Person</RNText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionTitle palette={palette} accent={accent}>
          Identity
        </SectionTitle>

        <View className="flex-row" style={{ gap: 10, marginBottom: 4 }}>
          <FormField
            label="First Name *"
            value={form.first}
            onChangeText={(v) => upd('first', v)}
            palette={palette}
            flex={1}
          />
          <FormField
            label="Last Name *"
            value={form.last}
            onChangeText={(v) => upd('last', v)}
            palette={palette}
            flex={1}
          />
        </View>
        <FormField label="Middle Name" value={form.middle} onChangeText={(v) => upd('middle', v)} palette={palette} />

        <View className="flex-row" style={{ gap: 10 }}>
          <FormField
            label="Date of Birth *"
            value={form.dateOfBirth}
            onChangeText={(v) => upd('dateOfBirth', v)}
            palette={palette}
            mono
            placeholder={datePH}
            flex={1}
          />
          <FormField
            label="Nationality *"
            value={form.nationality}
            onChangeText={(v) => upd('nationality', v.toUpperCase())}
            palette={palette}
            mono
            maxLength={3}
            placeholder="e.g. VNM"
            flex={1}
          />
        </View>

        <SelectRow
          label="Gender *"
          value={form.gender}
          options={GENDER_OPTS}
          onChange={(v) => upd('gender', v)}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />

        <SectionTitle palette={palette} accent={accent}>
          Passport (required for APIS)
        </SectionTitle>
        <FormField
          label="Passport Number *"
          value={form.passportNumber}
          onChangeText={(v) => upd('passportNumber', v)}
          palette={palette}
          mono
        />
        <View className="flex-row" style={{ gap: 10 }}>
          <FormField
            label="Country of Issue *"
            value={form.passportCountry}
            onChangeText={(v) => upd('passportCountry', v.toUpperCase())}
            palette={palette}
            mono
            maxLength={3}
            placeholder="e.g. VNM"
            flex={1}
          />
          <FormField
            label="Expiry Date *"
            value={form.passportExpiry}
            onChangeText={(v) => upd('passportExpiry', v)}
            palette={palette}
            mono
            placeholder={datePH}
            flex={1}
          />
        </View>

        <SectionTitle palette={palette} accent={accent}>
          Contact & Employer
        </SectionTitle>
        <View className="flex-row" style={{ gap: 10 }}>
          <FormField
            label="Email"
            value={form.email}
            onChangeText={(v) => upd('email', v)}
            palette={palette}
            flex={1}
          />
          <FormField
            label="Phone"
            value={form.phone}
            onChangeText={(v) => upd('phone', v)}
            palette={palette}
            flex={1}
          />
        </View>
        <View className="flex-row" style={{ gap: 10 }}>
          <FormField
            label="Company"
            value={form.company}
            onChangeText={(v) => upd('company', v)}
            palette={palette}
            placeholder="e.g. MRO vendor"
            flex={1}
          />
          <FormField
            label="Department"
            value={form.department}
            onChangeText={(v) => upd('department', v)}
            palette={palette}
            flex={1}
          />
        </View>

        <SectionTitle palette={palette} accent={accent}>
          Jumpseat
        </SectionTitle>
        <SelectRow
          label="Priority"
          value={form.jumpseatPriority}
          options={PRIORITY_OPTS}
          onChange={(v) => upd('jumpseatPriority', v)}
          palette={palette}
          isDark={isDark}
          accent={accent}
        />

        {error ? (
          <View
            className="rounded-lg px-3 py-2 mt-3"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
          >
            <RNText style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626' }}>{error}</RNText>
          </View>
        ) : null}

        <Pressable
          onPress={handleCreate}
          disabled={creating}
          className="items-center py-3.5 rounded-xl active:opacity-70 mt-4"
          style={{ backgroundColor: accent, opacity: creating ? 0.5 : 1 }}
        >
          <RNText style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {creating ? 'Creating…' : 'Add Person'}
          </RNText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionTitle({ children, palette, accent }: { children: string; palette: Palette; accent: string }) {
  return (
    <View className="flex-row items-center" style={{ marginTop: 16, marginBottom: 8 }}>
      <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: accent, marginRight: 8 }} />
      <RNText
        style={{
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: palette.text,
        }}
      >
        {children}
      </RNText>
    </View>
  )
}

function FormField({
  label,
  value,
  onChangeText,
  palette,
  mono,
  maxLength,
  placeholder,
  flex,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  palette: Palette
  mono?: boolean
  maxLength?: number
  placeholder?: string
  flex?: number
}) {
  return (
    <View style={{ marginBottom: 12, flex }}>
      <RNText
        style={{
          fontSize: 13,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </RNText>
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
          paddingVertical: 10,
          backgroundColor: palette.card,
        }}
      />
    </View>
  )
}

function SelectRow<V extends string>({
  label,
  value,
  options,
  onChange,
  palette,
  isDark,
  accent,
}: {
  label: string
  value: V
  options: Array<{ value: V; label: string }>
  onChange: (v: V) => void
  palette: Palette
  isDark: boolean
  accent: string
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <RNText
        style={{
          fontSize: 13,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 6,
        }}
      >
        {label}
      </RNText>
      <View className="flex-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className="flex-row items-center px-3 py-2 rounded-lg"
              style={{
                backgroundColor: active ? accentTint(accent, isDark ? 0.18 : 0.1) : 'transparent',
                borderWidth: 1,
                borderColor: active ? accent : palette.cardBorder,
              }}
            >
              <RNText
                style={{
                  fontSize: 14,
                  fontWeight: active ? '600' : '500',
                  color: active ? accent : palette.text,
                }}
              >
                {opt.label}
              </RNText>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
