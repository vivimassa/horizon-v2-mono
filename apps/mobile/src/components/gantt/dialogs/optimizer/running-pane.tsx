// Optimizer step 2 — show greedy + SA progress.

import { View, Text, ActivityIndicator } from 'react-native'
import { shadowStyles } from '@skyhub/ui'
import type { OptimizerProgress } from '@skyhub/logic'
import { StatLine } from './stat-line'

export function RunningPane({
  progress,
  palette,
  accent,
}: {
  progress: OptimizerProgress | null
  palette: { text: string; textSecondary: string; textTertiary: string; cardBorder: string }
  accent: string
}) {
  return (
    <View style={{ paddingVertical: 24, gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <ActivityIndicator color={accent} size="large" />
        <Text style={{ fontSize: 14, color: palette.text, fontWeight: '700' }}>
          {progress?.phase === 'greedy'
            ? 'Greedy assignment'
            : progress?.phase === 'sa'
              ? 'Simulated annealing'
              : 'Starting…'}
        </Text>
      </View>
      {progress && (
        <>
          <View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: palette.cardBorder, overflow: 'hidden' }}>
              <View style={{ height: 4, backgroundColor: accent, width: `${progress.percent}%` }} />
            </View>
            <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 4, textAlign: 'right' }}>
              {progress.percent}% · {Math.round(progress.elapsedMs / 1000)}s
            </Text>
          </View>
          <View
            style={[
              {
                borderRadius: 8,
                borderWidth: 1,
                borderColor: palette.cardBorder,
                padding: 12,
                gap: 6,
              },
              shadowStyles.card,
            ]}
          >
            <StatLine label="Cost" value={String(Math.round(progress.cost))} palette={palette} />
            <StatLine label="Best cost" value={String(Math.round(progress.bestCost))} palette={palette} />
            <StatLine label="Assigned" value={String(progress.stats.assigned)} palette={palette} />
            <StatLine label="Overflow" value={String(progress.stats.overflow)} palette={palette} />
            <StatLine label="Chain breaks" value={String(progress.stats.chainBreaks)} palette={palette} />
          </View>
        </>
      )}
    </View>
  )
}
