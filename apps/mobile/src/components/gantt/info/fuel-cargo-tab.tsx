// Fuel/Cargo tab — read-only.

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { InfoRow, InfoSection } from './info-shared'

export function FuelCargoTab({ flight }: { flight: GanttFlight }) {
  const { palette } = useAppTheme()
  return (
    <View>
      <InfoSection title="Fuel" palette={palette}>
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginBottom: 8 }}>
          Fuel uplifted / burn populates from FlightInstance fuel block.
        </Text>
        <InfoRow label="Block fuel (kg)" value={null} palette={palette} />
        <InfoRow label="Burn (kg)" value={null} palette={palette} />
        <InfoRow label="Uplift (kg)" value={null} palette={palette} />
      </InfoSection>
      <InfoSection title="Cargo" palette={palette}>
        <InfoRow label="Cargo (kg)" value={null} palette={palette} />
        <InfoRow label="Mail (kg)" value={null} palette={palette} />
        <InfoRow label="Service" value={flight.serviceType} palette={palette} />
      </InfoSection>
    </View>
  )
}
