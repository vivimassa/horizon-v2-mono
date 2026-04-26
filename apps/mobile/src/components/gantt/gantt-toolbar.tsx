// Top toolbar for the mobile Gantt — read-only subset for Phase 4.
// Back, title, zoom, row-height, color cycle, refresh, search, go-to-today,
// help, filter sheet trigger.

import { View, Text, Pressable, Alert, useWindowDimensions } from 'react-native'
import {
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  SlidersHorizontal,
  LayoutGrid,
  Palette,
  Plus,
  Search,
  Calendar,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { Icon } from '@skyhub/ui'
import { dateToMs, computeNowLineX, computePixelsPerHour } from '@skyhub/logic'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useGanttScroll } from './gantt-scroll-context'

interface Props {
  operatorId: string | null
}

const COLOR_MODES = ['status', 'ac_type', 'service_type', 'route_type'] as const

export function GanttToolbar({ operatorId }: Props) {
  const router = useRouter()
  const { palette, accent } = useAppTheme()
  const win = useWindowDimensions()
  const isTablet = win.width >= 768
  const zoom = useMobileGanttStore((s) => s.zoom)
  const cycleZoom = useMobileGanttStore((s) => s.cycleZoom)
  const cycleRowHeight = useMobileGanttStore((s) => s.cycleRowHeight)
  const refresh = useMobileGanttStore((s) => s.refresh)
  const setColorMode = useMobileGanttStore((s) => s.setColorMode)
  const colorMode = useMobileGanttStore((s) => s.colorMode)
  const setFilterSheetOpen = useMobileGanttStore((s) => s.setFilterSheetOpen)
  const setSearchSheetOpen = useMobileGanttStore((s) => s.setSearchSheetOpen)
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)
  const loading = useMobileGanttStore((s) => s.loading)
  const isStale = useMobileGanttStore((s) => s.isStale)
  const pendingCount = useMobileGanttStore((s) => s.pendingMutationsCount)
  const periodFrom = useMobileGanttStore((s) => s.periodFrom)
  const periodTo = useMobileGanttStore((s) => s.periodTo)
  const containerWidth = useMobileGanttStore((s) => s.containerWidth)
  const layout = useMobileGanttStore((s) => s.layout)
  const { scrollX } = useGanttScroll()

  const cycleColorMode = () => {
    const idx = COLOR_MODES.indexOf(colorMode as (typeof COLOR_MODES)[number])
    const next = COLOR_MODES[(idx + 1) % COLOR_MODES.length]
    setColorMode(next)
  }

  const goToToday = () => {
    if (!layout || containerWidth <= 0) return
    const startMs = dateToMs(periodFrom)
    const endMs = dateToMs(periodTo) + 86_400_000
    const days = Math.round((endMs - startMs) / 86_400_000)
    const pph = computePixelsPerHour(containerWidth, zoom)
    const nowX = computeNowLineX(startMs, days, pph)
    if (nowX == null) return
    const target = nowX - containerWidth / 2
    const maxX = Math.max(0, layout.totalWidth - containerWidth)
    scrollX.value = Math.max(0, Math.min(maxX, target))
  }

  const showHelp = () => {
    Alert.alert(
      'Schedule Gantt',
      [
        '• Pan / pinch to navigate.',
        '• Tap bar for details. Long-press to multi-select.',
        '• Use the filter sheet for period, fleet, status & overlays.',
        '• Color cycles status / type / service / route.',
      ].join('\n'),
    )
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <IconBtn onPress={() => router.back()} color={palette.text}>
        <Icon icon={ChevronLeft} size="sm" color={palette.text} />
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

      <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary, marginRight: 6 }}>{zoom}</Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          marginRight: 'auto',
          borderWidth: 1,
          borderColor: isStale ? '#FF8800' : pendingCount > 0 ? accent : palette.cardBorder,
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: isStale ? '#FF8800' : pendingCount > 0 ? accent : '#06C270',
          }}
        />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: isStale ? '#FF8800' : pendingCount > 0 ? accent : palette.textSecondary,
          }}
        >
          {isStale ? 'Offline' : pendingCount > 0 ? `Pending ${pendingCount}` : 'Synced'}
        </Text>
      </View>

      {isTablet && (
        <>
          <IconBtn onPress={() => openMutationSheet({ kind: 'addFlight' })} color={accent}>
            <Icon icon={Plus} size="sm" color={accent} />
          </IconBtn>
          <IconBtn onPress={() => openMutationSheet({ kind: 'scenario' })} color={palette.textSecondary}>
            <Icon icon={Layers} size="sm" color={palette.textSecondary} />
          </IconBtn>
          <IconBtn onPress={() => openMutationSheet({ kind: 'optimizer' })} color={palette.textSecondary}>
            <Icon icon={Sparkles} size="sm" color={palette.textSecondary} />
          </IconBtn>
        </>
      )}
      <IconBtn onPress={() => setSearchSheetOpen(true)} color={palette.textSecondary}>
        <Icon icon={Search} size="sm" color={palette.textSecondary} />
      </IconBtn>
      <IconBtn onPress={goToToday} color={accent}>
        <Icon icon={Calendar} size="sm" color={accent} />
      </IconBtn>
      <IconBtn onPress={() => cycleZoom(-1)} color={accent}>
        <Icon icon={ZoomIn} size="sm" color={accent} />
      </IconBtn>
      <IconBtn onPress={() => cycleZoom(1)} color={accent}>
        <Icon icon={ZoomOut} size="sm" color={accent} />
      </IconBtn>
      <IconBtn onPress={cycleRowHeight} color={palette.textSecondary}>
        <Icon icon={LayoutGrid} size="sm" color={palette.textSecondary} />
      </IconBtn>
      <IconBtn onPress={cycleColorMode} color={palette.textSecondary}>
        <Icon icon={Palette} size="sm" color={palette.textSecondary} />
      </IconBtn>
      <IconBtn
        onPress={() => operatorId && refresh(operatorId)}
        color={palette.textSecondary}
        disabled={loading || !operatorId}
      >
        <Icon icon={RefreshCw} size="sm" color={palette.textSecondary} />
      </IconBtn>
      <IconBtn onPress={showHelp} color={palette.textSecondary}>
        <Icon icon={HelpCircle} size="sm" color={palette.textSecondary} />
      </IconBtn>
      <IconBtn onPress={() => setFilterSheetOpen(true)} color={accent}>
        <Icon icon={SlidersHorizontal} size="sm" color={accent} />
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
