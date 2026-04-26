// Delays tab — list flight.delays.

import { View, Text } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { InfoSection } from './info-shared'

export function DelaysTab({ flight }: { flight: GanttFlight }) {
  const { palette } = useAppTheme()
  const delays = flight.delays ?? []
  const total = delays.reduce((s, d) => s + (d.minutes ?? 0), 0)

  return (
    <View>
      <InfoSection title={`Delays (${delays.length} entries · ${total} min)`} palette={palette}>
        {delays.length === 0 && <Text style={{ fontSize: 13, color: palette.textTertiary }}>No delays recorded.</Text>}
        {delays.map((d, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: palette.cardBorder,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text, fontFamily: 'monospace' }}>
                {d.code}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: palette.text }}>{d.minutes} min</Text>
            <Text style={{ flex: 1, fontSize: 13, color: palette.textTertiary }} numberOfLines={1}>
              {d.category}
            </Text>
          </View>
        ))}
      </InfoSection>
    </View>
  )
}
