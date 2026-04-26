// Times tab — view all OOOI + STD/STA/ETD/ETA. Edit via reschedule sheet for now.

import { View, Text, Pressable } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { Pencil } from 'lucide-react-native'
import { Icon } from '@skyhub/ui'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { InfoRow, InfoSection, fmtUtcDateTime } from './info-shared'

export function TimesTab({ flight }: { flight: GanttFlight }) {
  const { palette, accent } = useAppTheme()
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Pressable
          onPress={() => openMutationSheet({ kind: 'reschedule', flightId: flight.id })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: accent,
          }}
        >
          <Icon icon={Pencil} size="sm" color={accent} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>Reschedule…</Text>
        </Pressable>
      </View>

      <InfoSection title="Scheduled" palette={palette}>
        <InfoRow label="STD" value={fmtUtcDateTime(flight.stdUtc)} palette={palette} mono />
        <InfoRow label="STA" value={fmtUtcDateTime(flight.staUtc)} palette={palette} mono />
        <InfoRow label="Block" value={`${flight.blockMinutes} min`} palette={palette} />
      </InfoSection>

      <InfoSection title="Estimated" palette={palette}>
        <InfoRow label="ETD" value={fmtUtcDateTime(flight.etdUtc)} palette={palette} mono />
        <InfoRow label="ETA" value={fmtUtcDateTime(flight.etaUtc)} palette={palette} mono />
      </InfoSection>

      <InfoSection title="Actual (OOOI)" palette={palette}>
        <InfoRow label="ATD (OUT)" value={fmtUtcDateTime(flight.atdUtc)} palette={palette} mono />
        <InfoRow label="OFF" value={fmtUtcDateTime(flight.offUtc)} palette={palette} mono />
        <InfoRow label="ON" value={fmtUtcDateTime(flight.onUtc)} palette={palette} mono />
        <InfoRow label="ATA (IN)" value={fmtUtcDateTime(flight.ataUtc)} palette={palette} mono />
      </InfoSection>
    </View>
  )
}
