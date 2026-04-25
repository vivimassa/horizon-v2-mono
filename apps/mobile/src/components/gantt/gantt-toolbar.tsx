// Top toolbar for the mobile Gantt — read-only subset for Phase 1.
// Zoom in/out, row-height cycle, refresh, filter sheet trigger, help.

import { View, Text, Pressable } from 'react-native'
import { ChevronLeft, ZoomIn, ZoomOut, RefreshCw, SlidersHorizontal, LayoutGrid, Palette } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'

interface Props {
  operatorId: string | null
}

export function GanttToolbar({ operatorId }: Props) {
  const router = useRouter()
  const { palette, isDark, accent } = useAppTheme()
  const zoom = useMobileGanttStore((s) => s.zoom)
  const cycleZoom = useMobileGanttStore((s) => s.cycleZoom)
  const cycleRowHeight = useMobileGanttStore((s) => s.cycleRowHeight)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const setColorMode = useMobileGanttStore((s) => s.setColorMode)
  const colorMode = useMobileGanttStore((s) => s.colorMode)
  const setFilterSheetOpen = useMobileGanttStore((s) => s.setFilterSheetOpen)
  const loading = useMobileGanttStore((s) => s.loading)

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <IconBtn onPress={() => router.back()} color={palette.text}>
        <ChevronLeft size={18} color={palette.text} strokeWidth={2} />
      </IconBtn>

      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: palette.text,
          marginLeft: 4,
          marginRight: 6,
        }}
      >
        Schedule Gantt
      </Text>

      <Text style={{ fontSize: 12, fontFamily: 'monospace', color: palette.textTertiary, marginRight: 'auto' }}>
        {zoom}
      </Text>

      <IconBtn onPress={() => cycleZoom(-1)} color={accent}>
        <ZoomIn size={16} color={accent} strokeWidth={2} />
      </IconBtn>
      <IconBtn onPress={() => cycleZoom(1)} color={accent}>
        <ZoomOut size={16} color={accent} strokeWidth={2} />
      </IconBtn>
      <IconBtn onPress={cycleRowHeight} color={palette.textSecondary}>
        <LayoutGrid size={16} color={palette.textSecondary} strokeWidth={2} />
      </IconBtn>
      <IconBtn
        onPress={() => setColorMode(colorMode === 'status' ? 'ac_type' : 'status')}
        color={palette.textSecondary}
      >
        <Palette size={16} color={palette.textSecondary} strokeWidth={2} />
      </IconBtn>
      <IconBtn
        onPress={() => operatorId && refresh(operatorId)}
        color={palette.textSecondary}
        disabled={loading || !operatorId}
      >
        <RefreshCw size={16} color={palette.textSecondary} strokeWidth={2} />
      </IconBtn>
      <IconBtn onPress={() => setFilterSheetOpen(true)} color={accent}>
        <SlidersHorizontal size={16} color={accent} strokeWidth={2} />
      </IconBtn>
    </View>
  )
}

function IconBtn({
  children,
  onPress,
  color,
  disabled,
}: {
  children: React.ReactNode
  onPress: () => void
  color: string
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </Pressable>
  )
}
