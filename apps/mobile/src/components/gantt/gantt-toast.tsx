// Lightweight toast for Gantt mutations. Driven by store.toastMessage.
// Auto-dismisses after 3.2s.

import { useEffect } from 'react'
import { View, Text, Pressable } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { CheckCircle, XCircle, Info } from 'lucide-react-native'
import { Icon, shadowStyles } from '@skyhub/ui'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'

const COLORS = {
  success: '#06C270',
  error: '#FF3B3B',
  info: '#0063F7',
}

export function GanttToast() {
  const { palette, isDark } = useAppTheme()
  const toast = useMobileGanttStore((s) => s.toastMessage)
  const dismiss = useMobileGanttStore((s) => s.dismissToast)
  const offsetY = useSharedValue(80)

  useEffect(() => {
    if (toast) {
      offsetY.value = withTiming(0, { duration: 220 })
      const id = setTimeout(() => {
        offsetY.value = withTiming(80, { duration: 220 }, () => {})
        setTimeout(dismiss, 220)
      }, 3200)
      return () => clearTimeout(id)
    }
    offsetY.value = withTiming(80, { duration: 200 })
    return undefined
  }, [toast, dismiss, offsetY])

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offsetY.value }] }))
  if (!toast) return null

  const IconCmp = toast.kind === 'success' ? CheckCircle : toast.kind === 'error' ? XCircle : Info
  const color = COLORS[toast.kind]
  const bg = isDark ? 'rgba(25,25,33,0.96)' : 'rgba(255,255,255,0.97)'

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 24,
          zIndex: 1000,
        },
        animStyle,
      ]}
    >
      <Pressable onPress={dismiss}>
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: bg,
              borderRadius: 10,
              borderLeftWidth: 3,
              borderLeftColor: color,
            },
            shadowStyles.overlay,
          ]}
        >
          <Icon icon={IconCmp} size="sm" color={color} />
          <Text style={{ flex: 1, fontSize: 13, color: palette.text }}>{toast.text}</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}
