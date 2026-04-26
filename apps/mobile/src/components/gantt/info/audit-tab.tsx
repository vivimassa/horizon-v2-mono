// Audit tab — read-only timeline of changes (server feed TBD).

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { InfoSection, fmtUtcDateTime } from './info-shared'

export function AuditTab({ flight }: { flight: GanttFlight }) {
  const { palette } = useAppTheme()
  const events: { ts: number | null; label: string }[] = [
    { ts: flight.disruptionAppliedAt ?? null, label: `Disruption: ${flight.disruptionKind ?? 'none'}` },
    { ts: flight.atdUtc ?? null, label: 'ATD captured' },
    { ts: flight.offUtc ?? null, label: 'OFF captured' },
    { ts: flight.onUtc ?? null, label: 'ON captured' },
    { ts: flight.ataUtc ?? null, label: 'ATA captured' },
  ].filter((e) => e.ts != null) as { ts: number; label: string }[]
  events.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))

  return (
    <View>
      <InfoSection title="Activity" palette={palette}>
        {events.length === 0 && (
          <Text style={{ fontSize: 13, color: palette.textTertiary }}>No activity recorded.</Text>
        )}
        {events.map((e, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <Text style={{ fontSize: 13, color: palette.text }}>{e.label}</Text>
            <Text style={{ fontSize: 13, color: palette.textTertiary, fontFamily: 'monospace' }}>
              {fmtUtcDateTime(e.ts)}
            </Text>
          </View>
        ))}
      </InfoSection>
    </View>
  )
}
