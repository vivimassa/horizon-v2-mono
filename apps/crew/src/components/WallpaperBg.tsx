import { useEffect, useRef } from 'react'
import { Animated, Easing, View, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { useScheme } from '../stores/use-theme-store'

/**
 * Single-photo aviation wallpaper with Ken Burns scale animation.
 * Sky variant chosen via Tweaks panel ("Sky") in the design handoff.
 * Scrim is scope-aware: dark gradient under cards in dark mode, white
 * gradient in light mode so the photo still reads behind glass cards.
 */

const SKY_PHOTO = 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1600&q=80&auto=format&fit=crop'
const KB_DURATION_MS = 20000

interface Props {
  style?: ViewStyle
  /** Override scope; defaults to current theme scheme. */
  scope?: 'dark' | 'light'
}

export function WallpaperBg({ style, scope }: Props) {
  const themeScheme = useScheme()
  const s = scope ?? themeScheme
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: KB_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: KB_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }, [scale])

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: s === 'dark' ? '#0a0a12' : '#f0eee7',
        },
        style,
      ]}
    >
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ scale }] }}>
        <Image
          source={{ uri: SKY_PHOTO }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={400}
          blurRadius={8}
        />
      </Animated.View>

      {/* Scrim — keeps text readable behind glass cards */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: s === 'dark' ? 'rgba(8,8,16,0.70)' : 'rgba(245,247,250,0.90)',
        }}
      />
    </View>
  )
}
