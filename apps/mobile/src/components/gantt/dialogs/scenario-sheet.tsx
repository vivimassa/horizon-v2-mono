// Scenario sheet — list, switch active, create new.

import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native'
import { Plus, CheckCircle, Inbox } from 'lucide-react-native'
import { Icon, useAuthStore } from '@skyhub/ui'
import { api, type ScenarioRef } from '@skyhub/api'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell, FieldLabel } from './dialog-shell'

export function ScenarioSheet() {
  const { palette, accent, isDark } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const closeMutationSheet = useMobileGanttStore((s) => s.closeMutationSheet)
  const scenarioId = useMobileGanttStore((s) => s.scenarioId)
  const setScenarioId = useMobileGanttStore((s) => s.setScenarioId)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const showToast = useMobileGanttStore((s) => s.showToast)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const [scenarios, setScenarios] = useState<ScenarioRef[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingName, setCreatingName] = useState('')
  const [creating, setCreating] = useState(false)

  const open = target?.kind === 'scenario'

  useEffect(() => {
    if (!open || !operatorId) return
    setLoading(true)
    api
      .getScenarios({ operatorId })
      .then(setScenarios)
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false))
  }, [open, operatorId])

  const handleSwitch = async (id: string | null) => {
    setScenarioId(id)
    showToast('info', id ? 'Scenario activated.' : 'Production view active.')
    closeMutationSheet()
    if (operatorId) await refresh(operatorId)
  }

  const handleCreate = async () => {
    if (!operatorId || !creatingName.trim()) return
    setCreating(true)
    try {
      const s = await api.createScenario({
        operatorId,
        name: creatingName,
        seasonCode: scenarios[0]?.seasonCode ?? 'S26',
        status: 'draft',
      })
      setScenarios((prev) => [s, ...prev])
      setCreatingName('')
      showToast('success', `Scenario "${s.name}" created.`)
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <DialogShell open={open} title="Scenarios" snapPercent={85} secondaryLabel="Close">
      <FieldLabel label="ACTIVE" palette={palette} />
      <Pressable
        onPress={() => handleSwitch(null)}
        style={{
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: scenarioId == null ? accent : palette.cardBorder,
          marginBottom: 12,
          backgroundColor:
            scenarioId == null ? (isDark ? 'rgba(62,123,250,0.15)' : 'rgba(62,123,250,0.10)') : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Icon icon={Inbox} size="sm" color={scenarioId == null ? accent : palette.textSecondary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Production (no scenario)</Text>
        {scenarioId == null && <Icon icon={CheckCircle} size="sm" color={accent} />}
      </Pressable>

      <FieldLabel label="SCENARIOS" palette={palette} />
      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={accent} style={{ marginVertical: 12 }} />}
        {!loading &&
          scenarios.map((s) => {
            const active = scenarioId === s._id
            return (
              <Pressable
                key={s._id}
                onPress={() => handleSwitch(s._id)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: active ? accent : palette.cardBorder,
                  marginBottom: 8,
                  backgroundColor: active
                    ? isDark
                      ? 'rgba(62,123,250,0.15)'
                      : 'rgba(62,123,250,0.10)'
                    : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{s.name}</Text>
                    <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>
                      {s.seasonCode} · {s.status}
                    </Text>
                  </View>
                  {active && <Icon icon={CheckCircle} size="sm" color={accent} />}
                </View>
              </Pressable>
            )
          })}
        {!loading && scenarios.length === 0 && (
          <Text style={{ fontSize: 13, color: palette.textTertiary, paddingVertical: 12 }}>
            No scenarios yet. Create one below.
          </Text>
        )}
      </ScrollView>

      <FieldLabel label="CREATE NEW" palette={palette} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={creatingName}
          onChangeText={setCreatingName}
          placeholder="Scenario name"
          placeholderTextColor={palette.textTertiary}
          autoCapitalize="sentences"
          style={{
            flex: 1,
            height: 40,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.background,
            paddingHorizontal: 10,
            fontSize: 14,
            color: palette.text,
          }}
        />
        <Pressable
          onPress={handleCreate}
          disabled={!creatingName.trim() || creating}
          style={{
            height: 40,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: accent,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: !creatingName.trim() || creating ? 0.5 : 1,
            flexDirection: 'row',
            gap: 6,
          }}
        >
          <Icon icon={Plus} size="sm" color={palette.card} />
          <Text style={{ color: palette.card, fontSize: 13, fontWeight: '700' }}>Create</Text>
        </Pressable>
      </View>
    </DialogShell>
  )
}
