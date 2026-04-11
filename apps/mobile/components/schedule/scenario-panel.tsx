import { useState, useCallback, memo } from 'react'
import { Text, View, Pressable, TextInput, Modal, FlatList, Alert } from 'react-native'
import { X, Plus, Copy, Upload, Trash2, Check } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { api, type ScenarioRef } from '@skyhub/api'

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  review: '#f59e0b',
  published: '#16a34a',
  archived: '#8b5cf6',
}

interface ScenarioPanelProps {
  visible: boolean
  onClose: () => void
  scenarios: ScenarioRef[]
  activeScenarioId: string | null
  onSelect: (id: string | null) => void
  onRefresh: () => void
  operatorId: string
  palette: Palette
  accent: string
  isDark: boolean
}

export const ScenarioPanel = memo(function ScenarioPanel({
  visible,
  onClose,
  scenarios,
  activeScenarioId,
  onSelect,
  onRefresh,
  operatorId,
  palette,
  accent,
  isDark,
}: ScenarioPanelProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    setBusy(true)
    try {
      const s = await api.createScenario({ operatorId, name: newName.trim(), createdBy: 'mobile' })
      setNewName('')
      setCreating(false)
      onRefresh()
      onSelect(s._id)
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create scenario')
    } finally {
      setBusy(false)
    }
  }, [newName, operatorId, onRefresh, onSelect])

  const handleClone = useCallback(
    async (scenario: ScenarioRef) => {
      setBusy(true)
      try {
        const result = await api.cloneScenario(scenario._id, `${scenario.name} (copy)`, 'mobile')
        onRefresh()
        onSelect(result.id)
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to clone')
      } finally {
        setBusy(false)
      }
    },
    [onRefresh, onSelect],
  )

  const handlePublish = useCallback(
    async (scenario: ScenarioRef) => {
      Alert.alert('Publish Scenario', `Publish "${scenario.name}" to production? This will merge changes.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            setBusy(true)
            try {
              await api.publishMergeScenario(scenario._id, 'mobile')
              onRefresh()
              onSelect(null)
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to publish')
            } finally {
              setBusy(false)
            }
          },
        },
      ])
    },
    [onRefresh, onSelect],
  )

  const handleDelete = useCallback(
    async (scenario: ScenarioRef) => {
      Alert.alert('Delete Scenario', `Delete "${scenario.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            try {
              await api.deleteScenario(scenario._id)
              if (activeScenarioId === scenario._id) onSelect(null)
              onRefresh()
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete')
            } finally {
              setBusy(false)
            }
          },
        },
      ])
    },
    [activeScenarioId, onRefresh, onSelect],
  )

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
        <View className="flex-1 mt-16 rounded-t-2xl" style={{ backgroundColor: palette.background }}>
          <Pressable onPress={() => {}}>
            {/* Header */}
            <View
              className="flex-row items-center px-4 pt-4 pb-3"
              style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 }}>Scenarios</Text>
              {!creating && (
                <Pressable
                  onPress={() => setCreating(true)}
                  className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-70 mr-2"
                  style={{ backgroundColor: accent, gap: 4 }}
                >
                  <Plus size={14} color="#fff" strokeWidth={2} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>New</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} className="p-2 active:opacity-60">
                <X size={20} color={palette.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Create form */}
            {creating && (
              <View
                className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: palette.border, gap: 8 }}
              >
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Scenario name..."
                  placeholderTextColor={palette.textTertiary}
                  autoFocus
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: palette.text,
                    borderWidth: 1,
                    borderColor: palette.cardBorder,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: palette.card,
                  }}
                />
                <Pressable
                  onPress={handleCreate}
                  disabled={busy || !newName.trim()}
                  className="px-3 py-2 rounded-lg active:opacity-70"
                  style={{ backgroundColor: accent, opacity: busy || !newName.trim() ? 0.4 : 1 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Create</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCreating(false)
                    setNewName('')
                  }}
                  className="px-2 py-2 active:opacity-60"
                >
                  <Text style={{ fontSize: 13, color: palette.textSecondary }}>Cancel</Text>
                </Pressable>
              </View>
            )}

            {/* Production row */}
            <Pressable
              onPress={() => {
                onSelect(null)
                onClose()
              }}
              className="flex-row items-center px-4 py-3 active:opacity-70"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: palette.border,
                backgroundColor: activeScenarioId === null ? accentTint(accent, isDark ? 0.1 : 0.04) : undefined,
                borderLeftWidth: activeScenarioId === null ? 3 : 0,
                borderLeftColor: accent,
              }}
            >
              <View className="flex-1">
                <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Production</Text>
                <Text style={{ fontSize: 13, color: palette.textSecondary }}>Live schedule data</Text>
              </View>
              {activeScenarioId === null && <Check size={16} color={accent} strokeWidth={2} />}
            </Pressable>

            {/* Scenario list */}
            <FlatList
              data={scenarios}
              keyExtractor={(s) => s._id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item: scenario }) => {
                const isActive = activeScenarioId === scenario._id
                const statusColor = STATUS_COLORS[scenario.status] ?? palette.textTertiary
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(scenario._id)
                      onClose()
                    }}
                    className="flex-row items-center px-4 py-3 active:opacity-70"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: palette.border,
                      backgroundColor: isActive ? accentTint(accent, isDark ? 0.1 : 0.04) : undefined,
                      borderLeftWidth: isActive ? 3 : 0,
                      borderLeftColor: accent,
                    }}
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center" style={{ gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{scenario.name}</Text>
                        <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${statusColor}20` }}>
                          <Text
                            style={{ fontSize: 10, fontWeight: '600', color: statusColor, textTransform: 'uppercase' }}
                          >
                            {scenario.status}
                          </Text>
                        </View>
                      </View>
                      {scenario.description && (
                        <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }} numberOfLines={1}>
                          {scenario.description}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Pressable onPress={() => handleClone(scenario)} className="p-2 active:opacity-60">
                        <Copy size={14} color={palette.textTertiary} strokeWidth={1.8} />
                      </Pressable>
                      {scenario.status === 'draft' && (
                        <Pressable onPress={() => handlePublish(scenario)} className="p-2 active:opacity-60">
                          <Upload size={14} color="#16a34a" strokeWidth={1.8} />
                        </Pressable>
                      )}
                      <Pressable onPress={() => handleDelete(scenario)} className="p-2 active:opacity-60">
                        <Trash2 size={14} color={palette.textTertiary} strokeWidth={1.8} />
                      </Pressable>
                      {isActive && <Check size={16} color={accent} strokeWidth={2} />}
                    </View>
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
})
