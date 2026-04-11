import { memo, useRef, useEffect } from 'react'
import { Pressable, View, Animated, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { CompartmentZone, HoldKey } from '../../types/cargo'

interface CompartmentOverlayProps {
  zone: CompartmentZone
  isActive: boolean
  onSelect: (key: HoldKey) => void
  accent: string
  containerWidth: number
  containerHeight: number
}

export const CompartmentOverlay = memo(function CompartmentOverlay({
  zone,
  isActive,
  onSelect,
  accent,
  containerWidth,
  containerHeight,
}: CompartmentOverlayProps) {
  const top = (zone.top / 100) * containerHeight
  const left = (zone.left / 100) * containerWidth
  const width = (zone.width / 100) * containerWidth
  const height = (zone.height / 100) * containerHeight

  const pulseScale = useRef(new Animated.Value(1)).current
  const boxOpacity = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.6,
            duration: 800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 800,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      )
      pulse.start()
      Animated.timing(boxOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start()
      return () => pulse.stop()
    } else {
      pulseScale.setValue(1)
      Animated.timing(boxOpacity, { toValue: 0.35, duration: 600, useNativeDriver: true }).start()
    }
  }, [isActive])

  const pulseOpacity = pulseScale.interpolate({
    inputRange: [1, 1.6],
    outputRange: [1, 0.4],
  })

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top,
        left,
        width,
        height,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: isActive ? accent : 'transparent',
        overflow: 'hidden',
        opacity: boxOpacity,
      }}
    >
      {/* Gradient fill */}
      <LinearGradient
        colors={
          isActive
            ? [`${accent}45`, `${accent}20`, `${accent}38`]
            : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.12)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Pressable
        onPress={() => onSelect(zone.holdKey)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        {isActive && (
          <>
            <Animated.View
              style={{
                position: 'absolute',
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: `${accent}40`,
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              }}
            />
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: accent,
              }}
            />
          </>
        )}
      </Pressable>
    </Animated.View>
  )
})
