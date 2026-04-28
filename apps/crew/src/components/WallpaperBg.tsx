import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'

/**
 * Animated aviation wallpaper for the login screen.
 *
 * Mirrors the web app's <WallpaperBg/> aesthetic — five dark Unsplash
 * aviation photos, cross-fading every 8s with a Ken Burns scale (1.0 →
 * 1.25 over 20s, alternating). Gradient + vignette overlays sit above the
 * imagery so foreground content reads cleanly on any frame.
 */

const WALLPAPERS = [
  'https://images.unsplash.com/photo-1751698158488-9faa95a179f8?w=1600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1510505216937-86d3219fa1fd?w=1600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1689414871831-a395df32941e?w=1600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1758473788156-e6b2ae00c77d?w=1600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1695775147307-690ce4b1ee97?w=1600&q=80&auto=format&fit=crop',
]

const SLIDE_INTERVAL_MS = 8000
const FADE_MS = 1600
const KB_DURATION_MS = 20000

interface Props {
  style?: ViewStyle
}

export function WallpaperBg({ style }: Props) {
  const [current, setCurrent] = useState(0)
  const opacities = useRef(WALLPAPERS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((p) => (p + 1) % WALLPAPERS.length)
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    opacities.forEach((opacity, i) => {
      Animated.timing(opacity, {
        toValue: i === current ? 1 : 0,
        duration: FADE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start()
    })
  }, [current, opacities])

  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a12' }, style]}
    >
      {WALLPAPERS.map((url, i) => (
        <KenBurnsLayer key={url} url={url} opacity={opacities[i]!} delaySec={i * -4} />
      ))}

      {/* Gradient overlay — preserves contrast for foreground text */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      />
    </View>
  )
}

function KenBurnsLayer({ url, opacity, delaySec }: { url: string; opacity: Animated.Value; delaySec: number }) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Stagger the start so neighboring slides aren't perfectly in sync.
    const startDelay = Math.max(0, delaySec) * 1000
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.25,
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
    }, startDelay)
    return () => clearTimeout(timer)
  }, [scale, delaySec])

  return (
    <Animated.View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity, transform: [{ scale }] }}
    >
      <Image
        source={{ uri: url }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={400}
      />
    </Animated.View>
  )
}
