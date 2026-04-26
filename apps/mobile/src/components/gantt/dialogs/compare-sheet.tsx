// Compare scenarios — read-only diff summary. Tablet-only side-by-side
// is deferred; mobile shows a stacked list.

import { useEffect, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { api, type ScenarioRef, type ScenarioEnvelopeRef } from '@skyhub/api'
import { useAuthStore } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { DialogShell, FieldLabel } from './dialog-shell'

export function CompareSheet() {
  const { palette, accent, isDark } = useAppTheme()
  const target = useMobileGanttStore((s) => s.mutationSheet)
  const operatorId = useAuthStore((s) => s.user?.operatorId ?? null)
  const [scenarios, setScenarios] = useState<ScenarioRef[]>([])
  const [envelopes, setEnvelopes] = useState<ScenarioEnvelopeRef[]>([])
  const [a, setA] = useState<string | null>(null)
  const [b, setB] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const open = target?.kind === 'compare'

  useEffect(() => {
    if (!open || !operatorId) return
    setLoading(true)
    Promise.all([api.getScenarios({ operatorId }), api.getScenarioEnvelopes({ operatorId })])
      .then(([sc, env]) => {
        setScenarios(sc)
        setEnvelopes(env)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, operatorId])

  const aEnv = envelopes.find((e) => e.scenarioId === a)
  const bEnv = envelopes.find((e) => e.scenarioId === b)

  return (
    <DialogShell open={open} title="Compare scenarios" snapPercent={85} secondaryLabel="Close">
      <FieldLabel label="LEFT" palette={palette} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
      >
        {scenarios.map((s) => {
          const active = a === s._id
          return (
            <Pressable key={s._id} onPress={() => setA(s._id)} style={pillStyle(active, accent, palette, isDark)}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? accent : palette.text }}>{s.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <FieldLabel label="RIGHT" palette={palette} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
      >
        {scenarios.map((s) => {
          const active = b === s._id
          return (
            <Pressable key={s._id} onPress={() => setB(s._id)} style={pillStyle(active, accent, palette, isDark)}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? accent : palette.text }}>{s.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
      {!loading && (
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: palette.border,
          }}
        >
          <Column env={aEnv} label="LEFT" palette={palette} />
          <View style={{ width: 1, backgroundColor: palette.border }} />
          <Column env={bEnv} label="RIGHT" palette={palette} />
        </View>
      )}
    </DialogShell>
  )
}

function pillStyle(active: boolean, accent: string, palette: { cardBorder: string }, isDark: boolean) {
  return {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? accent : palette.cardBorder,
    backgroundColor: active ? (isDark ? 'rgba(62,123,250,0.15)' : 'rgba(62,123,250,0.10)') : 'transparent',
  } as const
}

function Column({
  env,
  label,
  palette,
}: {
  env: ScenarioEnvelopeRef | undefined
  label: string
  palette: { text: string; textTertiary: string; textSecondary: string }
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 6, letterSpacing: 0.6 }}>{label}</Text>
      {!env && <Text style={{ fontSize: 13, color: palette.textTertiary }}>Select a scenario.</Text>}
      {env && (
        <>
          <Text style={{ fontSize: 13, color: palette.text, fontWeight: '700' }}>{env.flightCount ?? 0} flights</Text>
          <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
            {env.effectiveFromUtc?.slice(0, 10) ?? '—'} → {env.effectiveUntilUtc?.slice(0, 10) ?? '—'}
          </Text>
        </>
      )}
    </View>
  )
}
