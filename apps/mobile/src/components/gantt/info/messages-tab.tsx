// Messages tab — read-only list (driven by future /gantt/flight-detail extension).

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { InfoSection } from './info-shared'

export function MessagesTab({ flight }: { flight: GanttFlight }) {
  const { palette } = useAppTheme()
  return (
    <View>
      <InfoSection title="Messages" palette={palette}>
        <Text style={{ fontSize: 13, color: palette.textTertiary }}>
          {`Crew / dispatch messages for ${flight.flightNumber} appear here once the messaging integration ships.`}
        </Text>
      </InfoSection>
    </View>
  )
}
