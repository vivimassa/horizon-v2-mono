import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, FlatList, TextInput, Pressable, Alert, LayoutAnimation, Platform, UIManager } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type FlightServiceTypeRef } from '@skyhub/api'
import { ChevronDown, Tag, Pencil, X, Trash2 } from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { ListScreenHeader, SearchInput, Text } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useHubBack } from '../../../lib/use-hub-back'
import { ColorSwatchPicker } from '../../../components/lopa/ColorSwatchPicker'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function ServiceTypesList() {
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')
  const { isTablet } = useDevice()
  const [types, setTypes] = useState<FlightServiceTypeRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<FlightServiceTypeRef>>({})
  const router = useRouter()

  const fetchTypes = useCallback(() => {
    setLoading(true)
    api
      .getFlightServiceTypes()
      .then(setTypes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchTypes()
    }, [fetchTypes]),
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? types.filter(
          (t) =>
            t.code.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q),
        )
      : types
    return [...list].sort((a, b) => a.code.localeCompare(b.code))
  }, [types, search])

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedId((prev) => {
      if (prev === id) {
        setEditingId(null)
        setDraft({})
        return null
      }
      setEditingId(null)
      setDraft({})
      return id
    })
  }, [])

  const startEdit = useCallback((item: FlightServiceTypeRef) => {
    setEditingId(item._id)
    setDraft({})
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setDraft({})
  }, [])

  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(
    async (item: FlightServiceTypeRef) => {
      if (Object.keys(draft).length === 0) {
        cancelEdit()
        return
      }
      setSaving(true)
      try {
        const updated = await api.updateFlightServiceType(item._id, draft)
        setTypes((prev) => prev.map((t) => (t._id === item._id ? updated : t)))
        setEditingId(null)
        setDraft({})
      } catch (err: any) {
        Alert.alert('Save Failed', err.message || 'Could not save changes')
      } finally {
        setSaving(false)
      }
    },
    [draft, cancelEdit],
  )

  const handleDelete = useCallback(
    (item: FlightServiceTypeRef) => {
      Alert.alert('Delete Service Type', `Delete ${item.code} — ${item.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteFlightServiceType(item._id)
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
              setTypes((prev) => prev.filter((t) => t._id !== item._id))
              if (expandedId === item._id) setExpandedId(null)
            } catch (err: any) {
              let msg = err.message || 'Delete failed'
              try {
                const match = msg.match(/API (\d+): (.+)/)
                if (match) {
                  const parsed = JSON.parse(match[2])
                  msg = parsed.error || msg
                }
              } catch {
                /* raw */
              }
              Alert.alert('Cannot Delete', msg)
            }
          },
        },
      ])
    },
    [expandedId],
  )

  const get = useCallback(
    (item: FlightServiceTypeRef, key: keyof FlightServiceTypeRef) => {
      return editingId === item._id && key in draft ? (draft as any)[key] : item[key]
    },
    [editingId, draft],
  )

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        {/* Header */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={Tag}
            title="Flight Service Types"
            count={types.length}
            filteredCount={filtered.length}
            countLabel="type"
            onAdd={() => router.push('/(tabs)/settings/service-type-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search code, name, description..." value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8">
            <Tag size={40} color={palette.textTertiary} strokeWidth={1.2} />
            <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
              {types.length === 0 ? 'No service types yet.\nTap + to create one.' : 'No results found.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isExpanded = expandedId === item._id
              const isEditing = editingId === item._id
              const color = modeColor((get(item, 'color') as string) || '#9ca3af', isDark)

              return (
                <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
                  {/* Row header */}
                  <Pressable
                    onPress={() => toggleExpand(item._id)}
                    className="flex-row items-center active:opacity-70"
                    style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                  >
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, marginRight: 10 }} />
                    <Text
                      style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 32 }}
                    >
                      {item.code}
                    </Text>
                    <View className="flex-1 ml-2">
                      <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {!isExpanded && item.description && (
                        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }} numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {!item.isActive && (
                      <View
                        className="px-1.5 py-0.5 rounded-full mr-2"
                        style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>
                          Inactive
                        </Text>
                      </View>
                    )}
                    <ChevronDown
                      size={14}
                      color={palette.textTertiary}
                      strokeWidth={1.8}
                      style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                    />
                  </Pressable>

                  {/* Accordion content */}
                  {isExpanded && (
                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingBottom: 16,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                      }}
                    >
                      {/* Action bar */}
                      <View className="flex-row items-center justify-end mb-3" style={{ gap: 8 }}>
                        {isEditing ? (
                          <>
                            <Pressable onPress={cancelEdit} className="active:opacity-60">
                              <X size={18} color={palette.textSecondary} strokeWidth={1.8} />
                            </Pressable>
                            <Pressable
                              onPress={() => handleSave(item)}
                              disabled={saving}
                              className="px-4 py-2 rounded-lg active:opacity-60"
                              style={{ backgroundColor: accent }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                                {saving ? 'Saving...' : 'Save'}
                              </Text>
                            </Pressable>
                          </>
                        ) : (
                          <>
                            <Pressable onPress={() => handleDelete(item)} className="active:opacity-60">
                              <Trash2 size={16} color={palette.textTertiary} strokeWidth={1.8} />
                            </Pressable>
                            <Pressable
                              onPress={() => startEdit(item)}
                              className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                              style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 5 }}
                            >
                              <Pencil size={13} color={accent} strokeWidth={1.8} />
                              <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Edit</Text>
                            </Pressable>
                          </>
                        )}
                      </View>

                      {/* Fields — 2 columns on tablet */}
                      <View className={isTablet ? 'flex-row flex-wrap' : ''}>
                        <DetailField
                          label="Code"
                          value={item.code}
                          palette={palette}
                          half={isTablet}
                          editing={isEditing}
                          editValue={get(item, 'code')}
                          onChange={(v) => handleFieldChange('code', v.toUpperCase())}
                          mono
                        />
                        <DetailField
                          label="Name"
                          value={item.name}
                          palette={palette}
                          half={isTablet}
                          editing={isEditing}
                          editValue={get(item, 'name')}
                          onChange={(v) => handleFieldChange('name', v)}
                        />
                        <DetailField
                          label="Description"
                          value={item.description}
                          palette={palette}
                          half={isTablet}
                          editing={isEditing}
                          editValue={get(item, 'description')}
                          onChange={(v) => handleFieldChange('description', v)}
                        />
                        <View style={{ paddingVertical: 8, ...(isTablet ? { width: '50%', paddingRight: 12 } : {}) }}>
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
                          <ColorSwatchPicker
                            value={(get(item, 'color') as string) || '#9ca3af'}
                            onChange={(v) => handleFieldChange('color', v)}
                            palette={palette}
                            isDark={isDark}
                            editing={isEditing}
                          />
                        </View>
                        <View style={{ paddingVertical: 8, ...(isTablet ? { width: '50%', paddingRight: 12 } : {}) }}>
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
                            Active
                          </Text>
                          {isEditing ? (
                            <Pressable
                              onPress={() => handleFieldChange('isActive', !get(item, 'isActive'))}
                              className="self-start px-3 py-1 rounded-lg"
                              style={{
                                backgroundColor: get(item, 'isActive')
                                  ? isDark
                                    ? 'rgba(22,163,74,0.15)'
                                    : '#dcfce7'
                                  : isDark
                                    ? 'rgba(220,38,38,0.15)'
                                    : '#fee2e2',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '600',
                                  color: get(item, 'isActive')
                                    ? isDark
                                      ? '#4ade80'
                                      : '#16a34a'
                                    : isDark
                                      ? '#f87171'
                                      : '#dc2626',
                                }}
                              >
                                {get(item, 'isActive') ? 'Yes' : 'No'}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: '600',
                                color: item.isActive ? (isDark ? '#4ade80' : '#16a34a') : palette.textSecondary,
                              }}
                            >
                              {item.isActive ? 'Yes' : 'No'}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )
            }}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

function DetailField({
  label,
  value,
  palette,
  half,
  editing,
  editValue,
  onChange,
  mono,
}: {
  label: string
  value: any
  palette: Palette
  half?: boolean
  editing?: boolean
  editValue?: any
  onChange?: (v: string) => void
  mono?: boolean
}) {
  return (
    <View style={{ paddingVertical: 8, ...(half ? { width: '50%', paddingRight: 12 } : {}) }}>
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
      {editing && onChange ? (
        <TextInput
          value={editValue != null ? String(editValue) : ''}
          onChangeText={onChange}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          maxLength={mono ? 2 : undefined}
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: palette.text,
            fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1,
            borderBottomColor: accentTint('#1e40af', 0.3),
            paddingVertical: 4,
          }}
          placeholderTextColor={palette.textTertiary}
        />
      ) : (
        <Text
          style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}
        >
          {value ?? '---'}
        </Text>
      )}
    </View>
  )
}
