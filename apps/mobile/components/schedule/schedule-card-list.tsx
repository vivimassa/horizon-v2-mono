import { memo } from 'react'
import { Text, View, FlatList, Pressable } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import type { ScheduledFlightRef } from '@skyhub/api'
import { formatDate } from '@skyhub/logic'
import { FrequencyDots } from './frequency-picker'
import { useOperatorStore } from '../../src/stores/use-operator-store'

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  active: '#16a34a',
  suspended: '#f59e0b',
  cancelled: '#dc2626',
}

function fmtMinutes(min: number | null): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60),
    m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export const ScheduleCardList = memo(function ScheduleCardList({
  flights,
  dirtyMap,
  newIds,
  deletedIds,
  onPress,
  palette,
  accent,
  isDark,
}: {
  flights: ScheduledFlightRef[]
  dirtyMap: Map<string, Partial<ScheduledFlightRef>>
  newIds: Set<string>
  deletedIds: Set<string>
  onPress: (id: string) => void
  palette: Palette
  accent: string
  isDark: boolean
}) {
  const dateFormat = useOperatorStore((s) => s.dateFormat)
  return (
    <FlatList
      data={flights}
      keyExtractor={(f) => f._id}
      contentContainerStyle={{ paddingBottom: 100 }}
      renderItem={({ item: flight }) => {
        const isDirty = dirtyMap.has(flight._id)
        const isNew = newIds.has(flight._id)
        const isDeleted = deletedIds.has(flight._id)
        const statusColor = STATUS_COLORS[flight.status] ?? palette.textTertiary

        const hasSeparator = (flight.formatting as any)?.separatorBelow

        return (
          <View>
            <Pressable
              onPress={() => onPress(flight._id)}
              className="active:opacity-70"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: palette.border,
                borderLeftWidth: isDirty || isNew ? 3 : 0,
                borderLeftColor: isNew ? '#16a34a' : accent,
                opacity: isDeleted ? 0.35 : flight.status === 'suspended' ? 0.6 : 1,
              }}
            >
              {/* Row 1: Flight + AC Type + Status */}
              <View className="flex-row items-center mb-1">
                <Text
                  style={{ fontSize: 17, fontWeight: '700', fontFamily: 'monospace', color: accent, marginRight: 8 }}
                >
                  {flight.airlineCode}
                  {flight.flightNumber}
                </Text>
                {flight.aircraftTypeIcao && (
                  <View
                    className="px-1.5 py-0.5 rounded mr-2"
                    style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', fontFamily: 'monospace', color: accent }}>
                      {flight.aircraftTypeIcao}
                    </Text>
                  </View>
                )}
                <View className="flex-1" />
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statusColor}20` }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor, textTransform: 'uppercase' }}>
                    {flight.status}
                  </Text>
                </View>
              </View>

              {/* Row 2: Route + Times */}
              <View className="flex-row items-center mb-1">
                <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: palette.text }}>
                  {flight.depStation}
                </Text>
                <Text style={{ fontSize: 13, color: palette.textTertiary, marginHorizontal: 6 }}>{'\u2192'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: palette.text }}>
                  {flight.arrStation}
                </Text>
                <View className="flex-1" />
                <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: 'monospace', color: palette.text }}>
                  {flight.stdUtc}
                </Text>
                <Text style={{ fontSize: 13, color: palette.textTertiary, marginHorizontal: 4 }}>{'\u2014'}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: 'monospace', color: palette.text }}>
                  {flight.staUtc}
                </Text>
                {flight.blockMinutes != null && flight.blockMinutes > 0 && (
                  <Text style={{ fontSize: 12, color: palette.textTertiary, marginLeft: 6 }}>
                    ({fmtMinutes(flight.blockMinutes)})
                  </Text>
                )}
              </View>

              {/* Row 3: Dates + Frequency */}
              <View className="flex-row items-center">
                <Text style={{ fontSize: 13, color: palette.textSecondary }}>
                  {formatDate(flight.effectiveFrom, dateFormat)} — {formatDate(flight.effectiveUntil, dateFormat)}
                </Text>
                <View className="flex-1" />
                <FrequencyDots value={flight.daysOfWeek} accent={accent} palette={palette} size={16} />
              </View>
            </Pressable>
            {hasSeparator && (
              <View
                style={{
                  height: 12,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  borderTopWidth: 1,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                }}
              />
            )}
          </View>
        )
      }}
      ListEmptyComponent={
        <View className="flex-1 justify-center items-center pt-20">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>No flights match your filters</Text>
        </View>
      }
    />
  )
})
