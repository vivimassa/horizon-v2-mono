import { View, Text, Pressable } from 'react-native'
import { Pencil } from 'lucide-react-native'
import { Icon } from '@skyhub/ui'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { Row, StatusPill, StatRow, StatTile, SectionLabel } from './detail-ui'
import { aircraftDailyUtil, fmtBlock, fmtUtcDateTime, fmtUtcTime } from './detail-helpers'

interface Props {
  flight: GanttFlight
  allFlights: GanttFlight[]
}

export function FlightTab({ flight, allFlights }: Props) {
  const { palette, isDark, accent } = useAppTheme()
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)
  const closeDetailSheet = useMobileGanttStore((s) => s.closeDetailSheet)
  const handleEdit = () => {
    closeDetailSheet()
    openMutationSheet({ kind: 'editFlight', flightId: flight.id })
  }

  const blockMs = flight.staUtc - flight.stdUtc
  const util = flight.aircraftReg ? aircraftDailyUtil(allFlights, flight.aircraftReg, flight.operatingDate) : null

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 18 }}>
      {/* Identity row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            color: palette.text,
            fontFamily: 'monospace',
            letterSpacing: -0.5,
          }}
        >
          {flight.flightNumber}
        </Text>
        <StatusPill flight={flight} isDark={isDark} />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={handleEdit}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: accent,
          }}
        >
          <Icon icon={Pencil} size="sm" color={accent} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>Edit details</Text>
        </Pressable>
      </View>

      {/* Route */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 12,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
        }}
      >
        <Endpoint code={flight.depStation} time={fmtUtcTime(flight.stdUtc)} palette={palette} />
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: palette.textSecondary }}>{fmtBlock(flight.blockMinutes)}</Text>
          <View style={{ height: 1, width: '100%', backgroundColor: palette.border }} />
          <Text style={{ fontSize: 13, color: palette.textTertiary }}>BLOCK</Text>
        </View>
        <Endpoint code={flight.arrStation} time={fmtUtcTime(flight.staUtc)} palette={palette} align="right" />
      </View>

      {/* Times grid */}
      <View>
        <SectionLabel>Schedule</SectionLabel>
        <Row label="STD" value={fmtUtcDateTime(flight.stdUtc)} palette={palette} />
        <Row label="STA" value={fmtUtcDateTime(flight.staUtc)} palette={palette} />
        <Row label="ETD" value={fmtUtcDateTime(flight.etdUtc ?? null)} palette={palette} />
        <Row label="ETA" value={fmtUtcDateTime(flight.etaUtc ?? null)} palette={palette} />
        <Row label="ATD (OUT)" value={fmtUtcDateTime(flight.atdUtc ?? null)} palette={palette} />
        <Row label="OFF" value={fmtUtcDateTime(flight.offUtc ?? null)} palette={palette} />
        <Row label="ON" value={fmtUtcDateTime(flight.onUtc ?? null)} palette={palette} />
        <Row label="ATA (IN)" value={fmtUtcDateTime(flight.ataUtc ?? null)} palette={palette} />
      </View>

      {/* Aircraft + service */}
      <View>
        <SectionLabel>Aircraft</SectionLabel>
        <Row label="Type" value={flight.aircraftTypeIcao ?? '—'} palette={palette} mono />
        <Row label="Registration" value={flight.aircraftReg ?? 'Unassigned'} palette={palette} mono />
        <Row label="Service" value={flight.serviceType ?? '—'} palette={palette} />
        <Row label="Operating Date" value={flight.operatingDate} palette={palette} mono />
      </View>

      {/* Daily aircraft utilization */}
      {util && (
        <View>
          <SectionLabel>{`${flight.aircraftReg} on ${flight.operatingDate}`}</SectionLabel>
          <StatRow>
            <StatTile label="Flights" value={String(util.count)} palette={palette} />
            <StatTile label="Block" value={fmtBlock(util.blockHours * 60)} palette={palette} />
            <StatTile label="Util" value={`${util.utilizationPct}%`} accent={accent} palette={palette} />
          </StatRow>
        </View>
      )}
    </View>
  )

  void blockMs
}

function Endpoint({
  code,
  time,
  palette,
  align,
}: {
  code: string
  time: string
  palette: { text: string; textSecondary: string }
  align?: 'right'
}) {
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, fontFamily: 'monospace' }}>{code}</Text>
      <Text style={{ fontSize: 13, color: palette.textSecondary, fontFamily: 'monospace' }}>{time}Z</Text>
    </View>
  )
}
