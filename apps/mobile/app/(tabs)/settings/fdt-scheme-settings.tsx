import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type FdtlSchemeRef } from '@skyhub/api'
import { ChevronLeft, ChevronDown, Clock, Moon, BedDouble, Shield, Radio } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'

function minutesToHHMM(m: number | null | undefined): string {
  if (m == null) return ''
  const h = Math.floor(m / 60), mm = m % 60
  return `${h}:${String(mm).padStart(2, '0')}`
}
function hhmmToMinutes(s: string): number | null {
  const m = s.match(/^(\d{1,3}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

interface SectionDef {
  key: string
  label: string
  icon: LucideIcon
  fields: FieldDef[]
}

interface FieldDef {
  key: string
  label: string
  type: 'hhmm' | 'time' | 'text' | 'toggle'
}

const SECTIONS: SectionDef[] = [
  {
    key: 'reporting', label: 'Reporting & Debrief Defaults', icon: Clock,
    fields: [
      { key: 'reportTimeMinutes', label: 'Report Before STD', type: 'hhmm' },
      { key: 'postFlightMinutes', label: 'Post-Flight After STA', type: 'hhmm' },
      { key: 'debriefMinutes', label: 'Debrief Duration', type: 'hhmm' },
      { key: 'standbyResponseMinutes', label: 'Standby Response Time', type: 'hhmm' },
    ],
  },
  {
    key: 'wocl', label: 'Window of Circadian Low (WOCL)', icon: Moon,
    fields: [
      { key: 'woclStart', label: 'WOCL Start', type: 'time' },
      { key: 'woclEnd', label: 'WOCL End', type: 'time' },
    ],
  },
  {
    key: 'augmented', label: 'Augmented Crew Mapping', icon: BedDouble,
    fields: [
      { key: 'augmentedComplementKey', label: '3-Pilot Complement Key', type: 'text' },
      { key: 'doubleCrewComplementKey', label: '4-Pilot Complement Key', type: 'text' },
    ],
  },
  {
    key: 'frms', label: 'Fatigue Risk Management', icon: Shield,
    fields: [
      { key: 'frmsEnabled', label: 'FRMS Enabled', type: 'toggle' },
      { key: 'frmsApprovalReference', label: 'Approval Reference', type: 'text' },
    ],
  },
  {
    key: 'cabin', label: 'Cabin Crew Rules', icon: Radio,
    fields: [
      { key: 'cabinCrewSeparateRules', label: 'Separate Cabin Crew Rules', type: 'toggle' },
    ],
  },
]

export default function FdtSchemeSettingsScreen() {
  const router = useRouter()
  const { schemeId } = useLocalSearchParams<{ schemeId: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()

  const [scheme, setScheme] = useState<FdtlSchemeRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!schemeId) return
    // Fetch scheme by getting all and finding by id (no direct getById endpoint)
    api.getFdtlFrameworks().then(() => {
      // The scheme was passed by id; we need to re-fetch by operatorId
      // But we already have the schemeId from params — use a workaround
    }).catch(() => {})

    // Actually, getFdtlScheme returns by operatorId. We stored schemeId in params.
    // Let's just re-fetch the operator's scheme.
    import('../../../hooks/useOperatorId').then(({ getOperatorId }) => {
      const opId = getOperatorId()
      if (!opId) { setLoading(false); return }
      api.getFdtlScheme(opId)
        .then(setScheme)
        .catch(() => {})
        .finally(() => setLoading(false))
    })
  }, [schemeId])

  const hasDraft = Object.keys(draft).length > 0

  const getVal = (key: string) => (key in draft ? draft[key] : (scheme as any)?.[key])

  const handleChange = useCallback((key: string, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!scheme || !hasDraft) return
    setSaving(true)
    try {
      // Convert HH:MM fields back to minutes for API
      const payload: Record<string, any> = {}
      for (const [k, v] of Object.entries(draft)) {
        const fieldDef = SECTIONS.flatMap(s => s.fields).find(f => f.key === k)
        if (fieldDef?.type === 'hhmm') {
          payload[k] = hhmmToMinutes(String(v))
        } else {
          payload[k] = v
        }
      }
      const updated = await api.updateFdtlScheme(scheme._id, payload)
      setScheme(updated)
      setDraft({})
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save settings')
    } finally { setSaving(false) }
  }, [scheme, draft, hasDraft])

  if (loading || !scheme) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Scheme not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="px-4 pt-4 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Reporting Times</Text>
              <Text style={{ fontSize: 13, color: palette.textSecondary }}>Operator scheme settings</Text>
            </View>
          </View>
          {hasDraft && (
            <Pressable onPress={handleSave} disabled={saving}
              className="px-4 py-2.5 rounded-lg active:opacity-60" style={{ backgroundColor: accent }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {SECTIONS.map(section => {
          const Icon = section.icon
          const isCollapsed = collapsed.has(section.key)

          return (
            <View key={section.key} className="mb-3 rounded-xl overflow-hidden" style={{
              borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card,
            }}>
              {/* Accordion header */}
              <Pressable onPress={() => setCollapsed(prev => { const n = new Set(prev); n.has(section.key) ? n.delete(section.key) : n.add(section.key); return n })}
                className="flex-row items-center px-4 py-3 active:opacity-70"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }}>
                <Icon size={16} color={accent} strokeWidth={1.8} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text, flex: 1, marginLeft: 10 }}>{section.label}</Text>
                <ChevronDown size={14} color={palette.textTertiary} strokeWidth={2}
                  style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }} />
              </Pressable>

              {/* Fields */}
              {!isCollapsed && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
                  <View className={isTablet ? 'flex-row flex-wrap' : ''}>
                    {section.fields.map(field => {
                      const rawVal = getVal(field.key)

                      if (field.type === 'toggle') {
                        const current = !!rawVal
                        return (
                          <View key={field.key} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...(isTablet ? { width: '50%', paddingRight: 12 } : {}) }}>
                            <Text style={{ fontSize: 13, color: palette.textSecondary, fontWeight: '600', marginBottom: 4 }}>{field.label}</Text>
                            <Pressable onPress={() => handleChange(field.key, !current)}
                              className="self-start px-3 py-1 rounded-lg"
                              style={{ backgroundColor: current ? (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7') : (isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2') }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: current ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626') }}>
                                {current ? 'Yes' : 'No'}
                              </Text>
                            </Pressable>
                          </View>
                        )
                      }

                      // HH:MM or time or text
                      const displayVal = field.type === 'hhmm'
                        ? (field.key in draft ? String(draft[field.key]) : minutesToHHMM(rawVal))
                        : (rawVal ?? '')

                      return (
                        <View key={field.key} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...(isTablet ? { width: '50%', paddingRight: 12 } : {}) }}>
                          <Text style={{ fontSize: 13, color: palette.textSecondary, fontWeight: '600', marginBottom: 4 }}>{field.label}</Text>
                          <TextInput
                            value={String(displayVal)}
                            onChangeText={(v) => handleChange(field.key, v)}
                            placeholder={field.type === 'hhmm' || field.type === 'time' ? 'H:MM' : ''}
                            placeholderTextColor={palette.textTertiary}
                            keyboardType={field.type === 'hhmm' || field.type === 'time' ? 'numbers-and-punctuation' : 'default'}
                            style={{ fontSize: 15, fontWeight: '600', fontFamily: 'monospace', color: palette.text,
                              borderBottomWidth: 1, borderBottomColor: accentTint(accent, 0.2), paddingVertical: 4 }}
                          />
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
