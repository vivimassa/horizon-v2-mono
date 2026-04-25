import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { SectionLabel, StatRow, StatTile } from './detail-ui'
import { fmtBlock, fmtDuration, fmtUtcTime, rotationFlights, tatBetween, totalBlockHours } from './detail-helpers'

interface Props {
  rotationId: string
  rotationLabel: string | null
  allFlights: GanttFlight[]
}

export function CycleTab({ rotationId, rotationLabel, allFlights }: Props) {
  const { palette, accent } = useAppTheme()
  const flights = rotationFlights(allFlights, rotationId)

  if (flights.length === 0) {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={{ fontSize: 14, color: palette.textSecondary }}>No flights found for this rotation.</Text>
      </View>
    )
  }

  const totalBlock = totalBlockHours(flights) * 60
  const cycleStart = flights[0].stdUtc
  const cycleEnd = flights[flights.length - 1].staUtc
  const cycleDuration = cycleEnd - cycleStart
  const totalTat = flights.slice(1).reduce((s, f, i) => s + tatBetween(flights[i], f), 0)

  const stations = flights.map((f) => f.depStation).concat(flights[flights.length - 1].arrStation)
  const chain = stations.reduce<string[]>((acc, code) => {
    if (acc[acc.length - 1] !== code) acc.push(code)
    return acc
  }, [])

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, letterSpacing: -0.5 }}>
          {rotationLabel ?? 'Rotation'}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
          {flights.length} legs · {chain.join(' → ')}
        </Text>
      </View>

      <StatRow>
        <StatTile label="Block" value={fmtDuration(totalBlock)} palette={palette} />
        <StatTile label="TAT" value={fmtDuration(totalTat)} palette={palette} />
        <StatTile label="Duration" value={fmtDuration(cycleDuration)} palette={palette} accent={accent} />
      </StatRow>

      <View>
        <SectionLabel>Legs</SectionLabel>
        <View
          style={{
            borderRadius: 12,
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            overflow: 'hidden',
          }}
        >
          {flights.map((f, i) => {
            const tatMs = i > 0 ? tatBetween(flights[i - 1], f) : null
            return (
              <View key={f.id}>
                {tatMs != null && (
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 4,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderBottomWidth: 1,
                      borderBottomColor: palette.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: palette.textTertiary, fontFamily: 'monospace' }}>
                      ─ TAT {fmtDuration(tatMs)} ─
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderBottomWidth: i < flights.length - 1 ? 1 : 0,
                    borderBottomColor: palette.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      fontFamily: 'monospace',
                      color: accent,
                      width: 32,
                    }}
                  >
                    {f.rotationSequence ?? '—'}
                  </Text>
                  <Text
                    style={{ fontSize: 14, fontWeight: '700', color: palette.text, fontFamily: 'monospace', width: 80 }}
                  >
                    {f.flightNumber}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>
                      {f.depStation} → {f.arrStation}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.textSecondary, fontFamily: 'monospace', marginTop: 2 }}>
                      {fmtUtcTime(f.stdUtc)}–{fmtUtcTime(f.staUtc)}Z · {fmtBlock(f.blockMinutes)}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
