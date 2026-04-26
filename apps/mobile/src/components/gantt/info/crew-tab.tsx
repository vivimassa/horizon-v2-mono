// Crew tab — placeholder list (server crew assignments would be fetched on
// open via a future api.getFlightCrew call).

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { InfoSection } from './info-shared'

export function CrewTab({ flight }: { flight: GanttFlight }) {
  const { palette } = useAppTheme()
  return (
    <View>
      <InfoSection title="Crew" palette={palette}>
        <Text style={{ fontSize: 13, color: palette.textTertiary }}>
          Crew assignments load from the FDP solver. Edit jumpseaters via the dedicated dialog (todo).
        </Text>
      </InfoSection>
      <InfoSection title="Quick facts" palette={palette}>
        <Text style={{ fontSize: 13, color: palette.text }}>
          {flight.aircraftReg ?? 'Unassigned'} · {flight.depStation}-{flight.arrStation} · {flight.operatingDate}
        </Text>
      </InfoSection>
    </View>
  )
}
