import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ArrowLeft, SlidersHorizontal, Languages, Clock,
  Calendar, Hash, Ruler, Save, Check, ChevronDown,
  type LucideIcon,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useUser } from '../../../providers/UserProvider'

const ACCENT = '#1e40af'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'ja', label: '日本語 (Japanese)' },
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'th', label: 'ไทย (Thai)' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
]

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'UTC', label: 'UTC' },
]

const DATE_FORMATS = [
  { value: 'dd/MM/yyyy', label: '31/12/2026' },
  { value: 'MM/dd/yyyy', label: '12/31/2026' },
  { value: 'yyyy-MM-dd', label: '2026-12-31' },
  { value: 'dd MMM yyyy', label: '31 Dec 2026' },
  { value: 'MMM dd, yyyy', label: 'Dec 31, 2026' },
]

const TIME_FORMATS = [
  { value: '24h', label: '24-hour', example: '14:30' },
  { value: '12h', label: '12-hour', example: '2:30 PM' },
]

const UNIT_SYSTEMS = [
  { value: 'metric', label: 'Metric', example: 'kg, km, °C' },
  { value: 'imperial', label: 'Imperial', example: 'lb, mi, °F' },
]

const NUMBER_FORMATS = [
  { value: 'comma', label: '1,000.00', example: 'Comma' },
  { value: 'dot', label: '1.000,00', example: 'Dot' },
  { value: 'space', label: '1 000.00', example: 'Space' },
]

interface Prefs {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  units: string
  numberFormat: string
}

const INITIAL: Prefs = {
  language: 'en',
  timezone: 'Asia/Ho_Chi_Minh',
  dateFormat: 'dd MMM yyyy',
  timeFormat: '24h',
  units: 'metric',
  numberFormat: 'comma',
}

export default function PreferencesScreen() {
  const router = useRouter()
  const { isDark, palette, isTablet, fonts } = useAppTheme()
  const { user, refetch } = useUser()

  const [prefs, setPrefs] = useState<Prefs>(INITIAL)
  const [savedPrefs, setSavedPrefs] = useState<Prefs>(INITIAL)
  const [saved, setSaved] = useState(false)
  const [expandedPicker, setExpandedPicker] = useState<string | null>(null)

  // Sync from API
  React.useEffect(() => {
    if (user?.preferences) {
      const fromApi: Prefs = {
        language: user.preferences.language,
        timezone: user.preferences.timezone,
        dateFormat: user.preferences.dateFormat,
        timeFormat: user.preferences.timeFormat,
        units: user.preferences.units,
        numberFormat: user.preferences.numberFormat,
      }
      setPrefs(fromApi)
      setSavedPrefs(fromApi)
    }
  }, [user])

  const update = (key: keyof Prefs, value: string) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    setSaved(false)
    setExpandedPicker(null)
  }

  const handleSave = useCallback(async () => {
    try {
      await api.updatePreferences(prefs)
      setSavedPrefs({ ...prefs })
      setSaved(true)
      Alert.alert('Saved', 'Preferences updated successfully.')
      setTimeout(() => setSaved(false), 2000)
      refetch()
    } catch (err) {
      Alert.alert('Error', 'Failed to save preferences.')
    }
  }, [prefs, refetch])

  const hasChanges = JSON.stringify(prefs) !== JSON.stringify(savedPrefs)

  const currentLang = LANGUAGES.find((l) => l.value === prefs.language)?.label ?? prefs.language
  const currentTz = TIMEZONES.find((t) => t.value === prefs.timezone)?.label ?? prefs.timezone
  const currentDate = DATE_FORMATS.find((d) => d.value === prefs.dateFormat)?.label ?? prefs.dateFormat
  const currentTime = TIME_FORMATS.find((t) => t.value === prefs.timeFormat)?.example ?? prefs.timeFormat
  const currentNumber = NUMBER_FORMATS.find((n) => n.value === prefs.numberFormat)?.label ?? prefs.numberFormat

  const previewCard = (
    <View className="rounded-2xl border mb-4"
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder, padding: 16 }}>
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: accentTint('#0f766e', isDark ? 0.15 : 0.08) }}>
          <SlidersHorizontal size={18} color="#0f766e" strokeWidth={1.8} />
        </View>
        <View>
          <Text style={{ fontSize: fonts.lg, fontWeight: '700', color: palette.text }}>Preferences</Text>
          <Text style={{ fontSize: fonts.xs, color: palette.textSecondary }}>Regional & display</Text>
        </View>
      </View>

      <View style={{ height: 0.5, backgroundColor: palette.border, marginBottom: 12 }} />

      <PreviewRow icon={Languages} label="Language" value={currentLang} palette={palette} fonts={fonts} />
      <PreviewRow icon={Clock} label="Timezone" value={currentTz} palette={palette} fonts={fonts} />
      <PreviewRow icon={Calendar} label="Date" value={currentDate} palette={palette} fonts={fonts} />
      <PreviewRow icon={Clock} label="Time" value={currentTime} palette={palette} fonts={fonts} />
      <PreviewRow icon={Ruler} label="Units" value={prefs.units === 'metric' ? 'Metric' : 'Imperial'} palette={palette} fonts={fonts} />
      <PreviewRow icon={Hash} label="Numbers" value={currentNumber} palette={palette} fonts={fonts} />

      <View className="rounded-xl mt-2 p-3"
        style={{ backgroundColor: accentTint(ACCENT, isDark ? 0.08 : 0.04), borderWidth: 1, borderColor: accentTint(ACCENT, 0.12) }}>
        <Text style={{ fontSize: fonts.sm, fontWeight: '500', color: palette.text }}>
          {currentDate} {currentTime}
        </Text>
        <Text style={{ fontSize: fonts.xs, color: palette.textSecondary, marginTop: 3 }}>
          {prefs.units === 'metric' ? '1,250 km · 78,500 kg' : '776 mi · 173,063 lb'}
        </Text>
      </View>
    </View>
  )

  const formCards = (
    <>
      {/* Language & Region */}
      <SectionCard title="Language & Region" icon={Languages} iconColor={ACCENT} palette={palette} isDark={isDark} fonts={fonts}>
        <DropdownPicker
          label="Display Language" value={prefs.language}
          options={LANGUAGES} onChange={(v) => update('language', v)}
          expanded={expandedPicker === 'language'} onToggle={() => setExpandedPicker(expandedPicker === 'language' ? null : 'language')}
          palette={palette} isDark={isDark} fonts={fonts}
        />
        <DropdownPicker
          label="Timezone" value={prefs.timezone}
          options={TIMEZONES} onChange={(v) => update('timezone', v)}
          expanded={expandedPicker === 'timezone'} onToggle={() => setExpandedPicker(expandedPicker === 'timezone' ? null : 'timezone')}
          palette={palette} isDark={isDark} fonts={fonts}
        />
      </SectionCard>

      {/* Date & Time */}
      <SectionCard title="Date & Time" icon={Calendar} iconColor={ACCENT} palette={palette} isDark={isDark} fonts={fonts}>
        <DropdownPicker
          label="Date Format" value={prefs.dateFormat}
          options={DATE_FORMATS.map((d) => ({ value: d.value, label: d.label }))}
          onChange={(v) => update('dateFormat', v)}
          expanded={expandedPicker === 'dateFormat'} onToggle={() => setExpandedPicker(expandedPicker === 'dateFormat' ? null : 'dateFormat')}
          palette={palette} isDark={isDark} fonts={fonts}
        />
        <ToggleGroup label="Time Format" value={prefs.timeFormat} options={TIME_FORMATS}
          onChange={(v) => update('timeFormat', v)} palette={palette} isDark={isDark} fonts={fonts} />
      </SectionCard>

      {/* Units & Numbers */}
      <SectionCard title="Units & Numbers" icon={Ruler} iconColor={ACCENT} palette={palette} isDark={isDark} fonts={fonts}>
        <ToggleGroup label="Unit System" value={prefs.units} options={UNIT_SYSTEMS}
          onChange={(v) => update('units', v)} palette={palette} isDark={isDark} fonts={fonts} />
        <ToggleGroup label="Number Format" value={prefs.numberFormat} options={NUMBER_FORMATS}
          onChange={(v) => update('numberFormat', v)} palette={palette} isDark={isDark} fonts={fonts} />
      </SectionCard>
    </>
  )

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl active:opacity-70"
          style={{
            backgroundColor: accentTint(ACCENT, isDark ? 0.1 : 0.06),
            borderWidth: 1, borderColor: accentTint(ACCENT, 0.12),
          }}
        >
          <ArrowLeft size={15} color={palette.text} strokeWidth={2} />
          <Text style={{ fontSize: fonts.xs, fontWeight: '600', color: palette.text }}>Settings</Text>
        </Pressable>

        <Pressable
          onPress={hasChanges ? handleSave : undefined}
          className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl active:opacity-80"
          style={{
            backgroundColor: ACCENT,
            opacity: hasChanges ? 1 : 0.5,
          }}
        >
          {saved
            ? <Check size={14} color="#fff" strokeWidth={2.5} />
            : <Save size={14} color="#fff" strokeWidth={2} />
          }
          <Text style={{ fontSize: fonts.xs, fontWeight: '600', color: '#fff' }}>
            {saved ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {isTablet ? (
          <View className="flex-row px-4" style={{ gap: 16 }}>
            <View style={{ width: 320 }}>{previewCard}</View>
            <View className="flex-1">{formCards}</View>
          </View>
        ) : (
          <View className="px-4">
            {previewCard}
            {formCards}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sub-components ──

function PreviewRow({ icon: Icon, label, value, palette, fonts }: {
  icon: LucideIcon; label: string; value: string; palette: Palette; fonts: any;
}) {
  return (
    <View className="flex-row items-center gap-2.5 mb-3">
      <Icon size={14} color={palette.textTertiary} strokeWidth={1.8} />
      <Text style={{ fontSize: fonts.xs, color: palette.textTertiary, width: 70 }}>{label}</Text>
      <Text className="flex-1 font-medium" style={{ fontSize: fonts.sm, color: palette.text }} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function SectionCard({ title, icon: Icon, iconColor, palette, isDark, fonts, children }: {
  title: string; icon: LucideIcon; iconColor: string; palette: Palette; isDark: boolean; fonts: any; children: React.ReactNode;
}) {
  return (
    <View className="rounded-2xl border mb-4 overflow-hidden"
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}>
      <View className="flex-row items-center"
        style={{ gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="rounded-lg items-center justify-center"
          style={{ width: 32, height: 32, backgroundColor: accentTint(iconColor, isDark ? 0.15 : 0.08) }}>
          <Icon size={16} color={iconColor} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: fonts.lg, fontWeight: '700', color: palette.text }}>{title}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>{children}</View>
    </View>
  )
}

function DropdownPicker({ label, value, options, onChange, expanded, onToggle, palette, isDark, fonts }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void; expanded: boolean; onToggle: () => void;
  palette: Palette; isDark: boolean; fonts: any;
}) {
  const selected = options.find((o) => o.value === value)

  return (
    <View style={{ marginBottom: 14, borderBottomWidth: 0.5, borderBottomColor: palette.border, paddingBottom: 14 }}>
      <Text style={{ fontSize: fonts.xs, color: palette.textTertiary, marginBottom: 8 }}>{label}</Text>
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between rounded-xl active:opacity-80"
        style={{
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderWidth: 1, borderColor: expanded ? ACCENT : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
        }}
      >
        <Text style={{ fontSize: fonts.sm, fontWeight: '500', color: palette.text }}>{selected?.label ?? value}</Text>
        <ChevronDown size={16} color={palette.textTertiary} strokeWidth={1.8}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </Pressable>

      {expanded && (
        <View className="rounded-xl mt-2 overflow-hidden"
          style={{ borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card }}>
          {options.map((opt, i) => {
            const active = opt.value === value
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange(opt.value)}
                className="flex-row items-center justify-between active:opacity-70"
                style={{
                  paddingHorizontal: 14, paddingVertical: 11,
                  backgroundColor: active ? accentTint(ACCENT, isDark ? 0.1 : 0.05) : 'transparent',
                  borderBottomWidth: i < options.length - 1 ? 0.5 : 0,
                  borderBottomColor: palette.border,
                }}
              >
                <Text style={{ fontSize: fonts.sm, fontWeight: active ? '600' : '400', color: active ? ACCENT : palette.text }}>
                  {opt.label}
                </Text>
                {active && <Check size={16} color={ACCENT} strokeWidth={2.5} />}
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

function ToggleGroup({ label, value, options, onChange, palette, isDark, fonts }: {
  label: string; value: string;
  options: { value: string; label: string; example: string }[];
  onChange: (v: string) => void;
  palette: Palette; isDark: boolean; fonts: any;
}) {
  return (
    <View style={{ marginBottom: 14, borderBottomWidth: 0.5, borderBottomColor: palette.border, paddingBottom: 14 }}>
      <Text style={{ fontSize: fonts.xs, color: palette.textTertiary, marginBottom: 8 }}>{label}</Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className="flex-1 items-center rounded-xl py-2.5 active:opacity-80"
              style={{
                backgroundColor: active ? accentTint(ACCENT, isDark ? 0.12 : 0.06) : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderWidth: 1.5, borderColor: active ? ACCENT : palette.border,
              }}
            >
              <Text style={{ fontSize: fonts.sm, fontWeight: active ? '600' : '400', color: active ? ACCENT : palette.text }}>
                {opt.label}
              </Text>
              <Text style={{ fontSize: fonts.xs, color: palette.textSecondary, marginTop: 2 }}>
                {opt.example}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
