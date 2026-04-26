// Pax tab — read-only counts (live data wiring is server-side).

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { InfoRow, InfoSection } from './info-shared'

export function PassengersTab({ flight }: { flight: GanttFlight }) {
  const { palette } = useAppTheme()

  return (
    <View>
      <InfoSection title="Passengers" palette={palette}>
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 8 }}>
          Pax counts populate from FlightInstance once boarding is captured. Edit will be wired in a follow-up.
        </Text>
        <InfoRow label="Adults expected" value={null} palette={palette} />
        <InfoRow label="Children" value={null} palette={palette} />
        <InfoRow label="Infants" value={null} palette={palette} />
        <InfoRow label="Boarded" value={null} palette={palette} />
        <InfoRow label="Load factor" value={null} palette={palette} />
      </InfoSection>
      <InfoSection title="Service" palette={palette}>
        <InfoRow label="Type" value={flight.serviceType} palette={palette} />
        <InfoRow label="Route" value={`${flight.depStation}-${flight.arrStation}`} palette={palette} mono />
      </InfoSection>
    </View>
  )
}
