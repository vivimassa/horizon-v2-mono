import { View, Text } from 'react-native'
import type { Palette } from '@skyhub/ui/theme'

interface KpiStripProps {
  totalWeight: number
  totalCapacity: number
  cgMac: number
  dockCount: number
  accent: string
  palette: Palette
}

export function KpiStrip({ totalWeight, totalCapacity, cgMac, dockCount, accent, palette }: KpiStripProps) {
  const loadPct = totalCapacity > 0 ? Math.round((totalWeight / totalCapacity) * 100) : 0

  const items = [
    { label: 'Load', value: `${loadPct}%`, hl: true },
    { label: 'Wt', value: `${totalWeight.toLocaleString()}`, hl: false },
    { label: 'CG', value: `${cgMac}%`, hl: false },
    { label: 'Dock', value: String(dockCount), hl: false },
  ]

  return (
    <View className="flex-row gap-1.5 mb-3">
      {items.map((kpi) => (
        <View
          key={kpi.label}
          className="flex-1 rounded-lg px-2 py-2"
          style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 14, fontWeight: '700', color: kpi.hl ? accent : palette.text }}>
            {kpi.value}
          </Text>
          <Text style={{ fontSize: 8, fontWeight: '600', color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {kpi.label}
          </Text>
        </View>
      ))}
    </View>
  )
}
