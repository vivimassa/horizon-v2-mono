import { View, Text } from 'react-native'
import type { GanttFlight, GanttAircraft } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { SectionLabel, StatRow, StatTile } from './detail-ui'
import { dayAcTypeBreakdown, fmtBlock, totalBlockHours } from './detail-helpers'

interface Props {
  date: string
  allFlights: GanttFlight[]
  aircraft: GanttAircraft[]
}

export function DayTab({ date, allFlights, aircraft }: Props) {
  const { palette, accent } = useAppTheme()
  const dayFlights = allFlights.filter((f) => f.operatingDate === date)
  const block = totalBlockHours(dayFlights)
  const inService = new Set(dayFlights.map((f) => f.aircraftReg).filter((r): r is string => Boolean(r))).size
  const breakdown = dayAcTypeBreakdown(allFlights, date)
  const fleetCount = aircraft.length

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, fontFamily: 'monospace' }}>{date}</Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
          {dayFlights.length} flights · {fmtBlock(block * 60)} block
        </Text>
      </View>

      <StatRow>
        <StatTile label="Flights" value={String(dayFlights.length)} palette={palette} />
        <StatTile
          label="AC In Use"
          value={fleetCount > 0 ? `${inService}/${fleetCount}` : String(inService)}
          palette={palette}
        />
        <StatTile label="Block" value={fmtBlock(block * 60)} palette={palette} accent={accent} />
      </StatRow>

      {breakdown.length > 0 && (
        <View>
          <SectionLabel>Breakdown by AC type</SectionLabel>
          <View
            style={{
              borderRadius: 12,
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              overflow: 'hidden',
            }}
          >
            {breakdown.map((b, i) => (
              <View
                key={b.type}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: i < breakdown.length - 1 ? 1 : 0,
                  borderBottomColor: palette.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: palette.text,
                    fontFamily: 'monospace',
                    width: 70,
                  }}
                >
                  {b.type}
                </Text>
                <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }}>{b.count} flights</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text, fontFamily: 'monospace' }}>
                  {fmtBlock(b.blockHours * 60)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
