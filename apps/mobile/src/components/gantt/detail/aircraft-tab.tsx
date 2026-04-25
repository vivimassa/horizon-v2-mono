import { View, Text } from 'react-native'
import type { GanttFlight, GanttAircraft, GanttAircraftType } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { Row, SectionLabel, StatRow, StatTile } from './detail-ui'
import { aircraftFlights, aircraftPeriodSummary, fmtBlock, overnightStations } from './detail-helpers'

interface Props {
  registration: string
  allFlights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
}

export function AircraftTab({ registration, allFlights, aircraft, aircraftTypes }: Props) {
  const { palette, accent } = useAppTheme()
  const ac = aircraft.find((a) => a.registration === registration)
  const type = aircraftTypes.find((t) => t.icaoType === ac?.aircraftTypeIcao)
  const summary = aircraftPeriodSummary(allFlights, registration)
  const fls = aircraftFlights(allFlights, registration)
  const overnights = overnightStations(fls)

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}>
      <View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, fontFamily: 'monospace' }}>
          {registration}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
          {ac?.aircraftTypeIcao ?? '—'}
          {type?.name ? ` · ${type.name}` : ''}
        </Text>
      </View>

      <StatRow>
        <StatTile label="Flights" value={String(summary.count)} palette={palette} />
        <StatTile label="Block" value={fmtBlock(summary.blockHours * 60)} palette={palette} />
        <StatTile label="Days" value={String(summary.days)} palette={palette} accent={accent} />
      </StatRow>

      <View>
        <SectionLabel>Specs</SectionLabel>
        <Row label="Home base" value={ac?.homeBaseIcao ?? '—'} palette={palette} mono />
        <Row label="Status" value={ac?.status ?? '—'} palette={palette} />
        <Row label="Seat config" value={ac?.seatConfig ?? '—'} palette={palette} mono />
        <Row label="Avg / day" value={`${summary.avgPerDay.toFixed(1)}h`} palette={palette} mono />
      </View>

      {overnights.length > 0 && (
        <View>
          <SectionLabel>Overnight stations</SectionLabel>
          <View
            style={{
              borderRadius: 12,
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              overflow: 'hidden',
            }}
          >
            {overnights.map((o, i) => (
              <View
                key={o.date}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  borderBottomWidth: i < overnights.length - 1 ? 1 : 0,
                  borderBottomColor: palette.border,
                }}
              >
                <Text style={{ fontSize: 13, color: palette.textSecondary, fontFamily: 'monospace' }}>{o.date}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text, fontFamily: 'monospace' }}>
                  {o.station}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
