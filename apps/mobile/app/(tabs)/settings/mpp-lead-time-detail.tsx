import { useState, useCallback, useEffect } from 'react'
import { Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api, type MppLeadTimeGroupRef, type MppLeadTimeItemRef } from '@skyhub/api'
import { ChevronLeft, Pencil, X, Trash2, Plus } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CREW_TYPES: Array<{ key: string; label: string }> = [
  { key: 'cockpit', label: 'Cockpit' },
  { key: 'cabin', label: 'Cabin' },
  { key: 'other', label: 'Other' },
]

export default function MppLeadTimeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()

  const [group, setGroup] = useState<MppLeadTimeGroupRef | null>(null)
  const [items, setItems] = useState<MppLeadTimeItemRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState({ label: '', valueMonths: '', consumedBy: '' })

  const fetchData = useCallback(() => {
    if (!id || !operatorId) return
    setError(null)
    Promise.all([api.getMppLeadTimeGroups(operatorId), api.getMppLeadTimeItems(operatorId, id)])
      .then(([gs, its]) => {
        setGroup(gs.find((g) => g._id === id) ?? null)
        setItems(its.sort((a, b) => a.sortOrder - b.sortOrder))
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, operatorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const get = (key: string) => (key in draft ? draft[key] : (group as any)?.[key])
  const handleFieldChange = useCallback((key: string, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSaveGroup = useCallback(async () => {
    if (!group || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateMppLeadTimeGroup(group._id, draft)
      setGroup(updated)
      setDraft({})
      setEditing(false)
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [group, draft])

  const handleDeleteGroup = useCallback(() => {
    if (!group) return
    Alert.alert('Delete Group', `Delete "${group.label}" and all its items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMppLeadTimeGroup(group._id)
            router.back()
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed')
          }
        },
      },
    ])
  }, [group, router])

  const handleAddItem = useCallback(async () => {
    if (!group || !newItem.label.trim() || !newItem.valueMonths) return
    try {
      await api.createMppLeadTimeItem({
        operatorId,
        groupId: group._id,
        label: newItem.label.trim(),
        valueMonths: Number(newItem.valueMonths),
        consumedBy: newItem.consumedBy.trim() || null,
      })
      setNewItem({ label: '', valueMonths: '', consumedBy: '' })
      setAddingItem(false)
      fetchData()
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add item')
    }
  }, [group, operatorId, newItem, fetchData])

  const handleDeleteItem = useCallback(
    (item: MppLeadTimeItemRef) => {
      Alert.alert('Delete Item', `Delete "${item.label}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMppLeadTimeItem(item._id)
              fetchData()
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed')
            }
          },
        },
      ])
    },
    [fetchData],
  )

  const handleUpdateItemMonths = useCallback(
    async (item: MppLeadTimeItemRef, val: string) => {
      const n = parseInt(val, 10)
      if (isNaN(n) || n < 1 || n > 120) return
      try {
        await api.updateMppLeadTimeItem(item._id, { valueMonths: n })
        fetchData()
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed')
      }
    },
    [fetchData],
  )

  if (loading || (!group && !error)) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>{loading ? 'Loading...' : 'Not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (error || !group) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <Pressable onPress={() => router.back()} className="active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center' }}>
            {error ?? 'Not found'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View className="px-2 py-0.5 rounded mr-2" style={{ backgroundColor: `${group.color}20` }}>
              <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: group.color }}>
                {group.code}
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.text, flex: 1 }} numberOfLines={1}>
              {group.label}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {editing ? (
              <>
                <Pressable
                  onPress={() => {
                    setEditing(false)
                    setDraft({})
                  }}
                  className="active:opacity-60"
                >
                  <X size={20} color={palette.textSecondary} strokeWidth={1.8} />
                </Pressable>
                <Pressable
                  onPress={handleSaveGroup}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleDeleteGroup} className="active:opacity-60">
                  <Trash2 size={18} color={palette.textTertiary} strokeWidth={1.8} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDraft({})
                    setEditing(true)
                  }}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-60"
                  style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
                >
                  <Pencil size={15} color={accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: accent, marginLeft: 6 }}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Group info */}
        <SectionBar label="Group Information" color={accent} />
        <View className={isTablet ? 'flex-row flex-wrap' : ''}>
          <Field
            label="Code"
            value={group.code}
            editing={editing}
            fieldKey="code"
            editValue={get('code')}
            onChange={handleFieldChange}
            palette={palette}
            mono
            maxLength={6}
            half={isTablet}
          />
          <Field
            label="Label"
            value={group.label}
            editing={editing}
            fieldKey="label"
            editValue={get('label')}
            onChange={handleFieldChange}
            palette={palette}
            half={isTablet}
            maxLength={80}
          />
        </View>
        {editing && (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
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
            <View className="flex-row" style={{ gap: 6 }}>
              {CREW_TYPES.map((ct) => {
                const active = (get('crewType') ?? group.crewType) === ct.key
                return (
                  <Pressable
                    key={ct.key}
                    onPress={() => handleFieldChange('crewType', ct.key)}
                    className="px-3 py-2 rounded-lg flex-1 items-center"
                    style={{
                      backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                      borderWidth: 1,
                      borderColor: active ? accent : palette.cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: active ? '600' : '400',
                        color: active ? accent : palette.text,
                      }}
                    >
                      {ct.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}
        {!editing && (
          <Field
            label="Crew Type"
            value={CREW_TYPES.find((c) => c.key === group.crewType)?.label ?? group.crewType}
            editing={false}
            fieldKey=""
            editValue=""
            onChange={() => {}}
            palette={palette}
          />
        )}
        <Field
          label="Description"
          value={group.description}
          editing={editing}
          fieldKey="description"
          editValue={get('description')}
          onChange={handleFieldChange}
          palette={palette}
          multiline
        />

        {/* Items */}
        <View className="flex-row items-center justify-between mt-6 mb-2">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: group.color }} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: group.color }}>Lead Time Items</Text>
            <Text style={{ fontSize: 14, color: palette.textTertiary }}>({items.length})</Text>
          </View>
          {!addingItem && (
            <Pressable
              onPress={() => setAddingItem(true)}
              className="flex-row items-center px-2.5 py-1.5 rounded-lg active:opacity-60"
              style={{ backgroundColor: accent, gap: 4 }}
            >
              <Plus size={12} color="#fff" strokeWidth={2.5} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Add</Text>
            </Pressable>
          )}
        </View>

        {/* Add item form */}
        {addingItem && (
          <View
            className="mb-3 p-3 rounded-xl"
            style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
          >
            <View className={isTablet ? 'flex-row' : ''} style={{ gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', marginBottom: 2 }}>
                  LABEL *
                </Text>
                <TextInput
                  value={newItem.label}
                  onChangeText={(v) => setNewItem((p) => ({ ...p, label: v }))}
                  placeholder="e.g. FO External Hire"
                  placeholderTextColor={palette.textTertiary}
                  style={{
                    fontSize: 14,
                    color: palette.text,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                    paddingVertical: 4,
                  }}
                />
              </View>
              <View style={{ width: isTablet ? 100 : undefined }}>
                <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', marginBottom: 2 }}>
                  MONTHS *
                </Text>
                <TextInput
                  value={newItem.valueMonths}
                  onChangeText={(v) => setNewItem((p) => ({ ...p, valueMonths: v }))}
                  keyboardType="numeric"
                  placeholder="e.g. 5"
                  placeholderTextColor={palette.textTertiary}
                  style={{
                    fontSize: 14,
                    color: palette.text,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                    paddingVertical: 4,
                  }}
                />
              </View>
            </View>
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', marginBottom: 2 }}>
                CONSUMED BY
              </Text>
              <TextInput
                value={newItem.consumedBy}
                onChangeText={(v) => setNewItem((p) => ({ ...p, consumedBy: v }))}
                placeholder="e.g. MPP · AOC FO event"
                placeholderTextColor={palette.textTertiary}
                style={{
                  fontSize: 14,
                  color: palette.text,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                  paddingVertical: 4,
                }}
              />
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={handleAddItem}
                className="flex-row items-center px-3 py-2 rounded-lg active:opacity-60"
                style={{ backgroundColor: accent, gap: 4 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Add</Text>
              </Pressable>
              <Pressable onPress={() => setAddingItem(false)} className="px-3 py-2 rounded-lg active:opacity-60">
                <Text style={{ fontSize: 12, fontWeight: '500', color: palette.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Items list */}
        {items.length > 0 ? (
          <View
            className="rounded-lg overflow-hidden"
            style={{ borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card }}
          >
            {items.map((item, i) => (
              <ItemRow
                key={item._id}
                item={item}
                groupColor={group.color}
                palette={palette}
                accent={accent}
                isDark={isDark}
                isFirst={i === 0}
                onDelete={() => handleDeleteItem(item)}
                onUpdateMonths={(v) => handleUpdateItemMonths(item, v)}
              />
            ))}
          </View>
        ) : !addingItem ? (
          <Text style={{ fontSize: 14, color: palette.textTertiary, fontStyle: 'italic', paddingVertical: 8 }}>
            No items yet
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function ItemRow({
  item,
  groupColor,
  palette,
  accent,
  isDark,
  isFirst,
  onDelete,
  onUpdateMonths,
}: {
  item: MppLeadTimeItemRef
  groupColor: string
  palette: Palette
  accent: string
  isDark: boolean
  isFirst: boolean
  onDelete: () => void
  onUpdateMonths: (v: string) => void
}) {
  const [editingMonths, setEditingMonths] = useState(false)
  const [draftMonths, setDraftMonths] = useState(String(item.valueMonths))

  return (
    <View
      className="flex-row items-center px-3 py-3"
      style={{ borderTopWidth: isFirst ? 0 : 1, borderTopColor: palette.cardBorder }}
    >
      <View className="flex-1 mr-2">
        <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{item.label}</Text>
        {item.consumedBy && (
          <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 1 }}>{item.consumedBy}</Text>
        )}
      </View>
      {editingMonths ? (
        <TextInput
          value={draftMonths}
          onChangeText={setDraftMonths}
          onBlur={() => {
            onUpdateMonths(draftMonths)
            setEditingMonths(false)
          }}
          onSubmitEditing={() => {
            onUpdateMonths(draftMonths)
            setEditingMonths(false)
          }}
          autoFocus
          keyboardType="numeric"
          textAlign="center"
          style={{
            fontSize: 16,
            fontWeight: '700',
            fontFamily: 'monospace',
            color: groupColor,
            width: 50,
            borderWidth: 1,
            borderColor: groupColor,
            borderRadius: 6,
            paddingVertical: 2,
          }}
        />
      ) : (
        <Pressable
          onPress={() => {
            setDraftMonths(String(item.valueMonths))
            setEditingMonths(true)
          }}
          className="px-2.5 py-1 rounded"
          style={{ backgroundColor: accentTint(groupColor, isDark ? 0.15 : 0.08) }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: 'monospace', color: groupColor }}>
            {item.valueMonths}m
          </Text>
        </Pressable>
      )}
      <Pressable onPress={onDelete} className="ml-2 p-1.5 active:opacity-60">
        <Trash2 size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </Pressable>
    </View>
  )
}

function SectionBar({ label, color }: { label: string; color: string }) {
  return (
    <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 14, fontWeight: '700', color }}>{label}</Text>
    </View>
  )
}

function Field({
  label,
  value,
  editing,
  fieldKey,
  editValue,
  onChange,
  palette,
  mono,
  maxLength,
  multiline,
  half,
}: {
  label: string
  value: any
  editing: boolean
  fieldKey: string
  editValue: any
  onChange: (k: string, v: any) => void
  palette: Palette
  mono?: boolean
  maxLength?: number
  multiline?: boolean
  half?: boolean
}) {
  const halfStyle = half ? { width: '50%' as const, paddingRight: 12 } : {}
  if (editing) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
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
          value={editValue != null ? String(editValue) : ''}
          onChangeText={(v) => {
            if (mono) v = v.toUpperCase()
            onChange(fieldKey, v)
          }}
          autoCapitalize={mono ? 'characters' : 'sentences'}
          maxLength={maxLength}
          multiline={multiline}
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: palette.text,
            fontFamily: mono ? 'monospace' : undefined,
            borderBottomWidth: 1,
            borderBottomColor: accentTint(palette.text, 0.15),
            paddingVertical: 4,
            minHeight: multiline ? 60 : undefined,
            textAlignVertical: multiline ? 'top' : undefined,
          }}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
    )
  }
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, ...halfStyle }}>
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
      <Text
        style={{ fontSize: 15, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined }}
      >
        {value ?? '\u2014'}
      </Text>
    </View>
  )
}
