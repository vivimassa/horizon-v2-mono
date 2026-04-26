// Optimizer step 3 — assignment summary, fuel diff, type breakdown, chain breaks.

import { View, Text } from 'react-native'
import { CheckCircle2 } from 'lucide-react-native'
import { Icon, shadowStyles } from '@skyhub/ui'
import type { OptimizerResult } from '@skyhub/logic'
import { StatLine } from './stat-line'

export function ResultPane({
  result,
  palette,
  accent,
}: {
  result: OptimizerResult
  palette: { text: string; textSecondary: string; textTertiary: string; cardBorder: string; border: string }
  accent: string
}) {
  return (
    <View style={{ gap: 16 }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 10,
            backgroundColor: 'rgba(6,194,112,0.10)',
            borderWidth: 1,
            borderColor: '#06C270',
          },
          shadowStyles.card,
        ]}
      >
        <Icon icon={CheckCircle2} size="md" color="#06C270" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>
            Done in {Math.round(result.elapsedMs / 1000)}s
          </Text>
          <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 2 }}>
            {result.stats.assigned}/{result.stats.totalFlights} flights assigned · {result.chainBreaks.length} chain
            breaks · {result.stats.overflow} overflow
          </Text>
        </View>
      </View>

      {result.stats.totalFuelKg != null && result.stats.baselineFuelKg != null && (
        <View
          style={[
            {
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: palette.cardBorder,
            },
            shadowStyles.card,
          ]}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: palette.textSecondary,
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            FUEL
          </Text>
          <StatLine label="Total burn" value={`${result.stats.totalFuelKg.toLocaleString()} kg`} palette={palette} />
          <StatLine label="Baseline" value={`${result.stats.baselineFuelKg.toLocaleString()} kg`} palette={palette} />
          <StatLine
            label="Savings"
            value={`${result.stats.fuelSavingsPercent ?? 0}%`}
            palette={palette}
            highlight={accent}
          />
        </View>
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: palette.textSecondary,
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          PER AIRCRAFT TYPE
        </Text>
        {result.typeBreakdown.map((t) => (
          <View
            key={t.icaoType}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <Text style={{ fontSize: 13, color: palette.text, fontFamily: 'monospace' }}>{t.icaoType}</Text>
            <Text style={{ fontSize: 13, color: palette.textTertiary }}>
              {t.assigned}/{t.totalFlights} · {t.totalBlockHours.toFixed(1)} bh · {t.avgBhPerDay} bh/day
            </Text>
          </View>
        ))}
      </View>

      {result.chainBreaks.length > 0 && (
        <View
          style={{
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#FF8800',
            backgroundColor: 'rgba(255,136,0,0.08)',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF8800', marginBottom: 6 }}>
            {result.chainBreaks.length} chain break{result.chainBreaks.length === 1 ? '' : 's'}
          </Text>
          {result.chainBreaks.slice(0, 4).map((cb) => (
            <Text key={cb.flightId} style={{ fontSize: 13, color: palette.textSecondary, fontFamily: 'monospace' }}>
              {cb.prevArr} → {cb.nextDep}
            </Text>
          ))}
          {result.chainBreaks.length > 4 && (
            <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 4 }}>
              + {result.chainBreaks.length - 4} more
            </Text>
          )}
        </View>
      )}
    </View>
  )
}
