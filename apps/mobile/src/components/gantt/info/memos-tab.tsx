// Memos tab — local edit, save TBD via /gantt/flight-instance.

import { useState } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import type { GanttFlight } from '@skyhub/types'
import { useAppTheme } from '../../../../providers/ThemeProvider'
import { useMobileGanttStore } from '../../../stores/use-mobile-gantt-store'
import { InfoSection } from './info-shared'

export function MemosTab({ flight }: { flight: GanttFlight }) {
  const { palette, accent } = useAppTheme()
  const showToast = useMobileGanttStore((s) => s.showToast)
  const [memo, setMemo] = useState('')

  const save = () => {
    if (!memo.trim()) return
    showToast('info', 'Memo saved locally — server sync TBD.')
    setMemo('')
  }

  return (
    <View>
      <InfoSection title="Add memo" palette={palette}>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="Operational note…"
          placeholderTextColor={palette.textTertiary}
          multiline
          numberOfLines={4}
          style={{
            minHeight: 90,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            backgroundColor: palette.background,
            paddingHorizontal: 10,
            paddingVertical: 8,
            fontSize: 13,
            color: palette.text,
            textAlignVertical: 'top',
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
          <Pressable
            onPress={save}
            disabled={!memo.trim()}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: accent,
              opacity: memo.trim() ? 1 : 0.4,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save memo</Text>
          </Pressable>
        </View>
      </InfoSection>
      <InfoSection title="Existing memos" palette={palette}>
        <Text style={{ fontSize: 13, color: palette.textTertiary }}>
          {`Memos for ${flight.flightNumber} on ${flight.operatingDate} appear here once the API is wired.`}
        </Text>
      </InfoSection>
    </View>
  )
}
