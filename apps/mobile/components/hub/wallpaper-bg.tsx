import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

const AnimatedExpoImage = Animated.createAnimatedComponent(Image)

// Same curated aviation wallpapers as apps/web/src/components/wallpaper-bg.tsx
// so mobile and web share the same hero imagery. Unsplash URLs, free commercial.
const WALLPAPERS_DARK = [
  'https://images.unsplash.com/photo-1751698158488-9faa95a179f8?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1510505216937-86d3219fa1fd?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1689414871831-a395df32941e?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1758473788156-e6b2ae00c77d?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1695775147307-690ce4b1ee97?w=1920&q=80&auto=format&fit=crop',
]

const WALLPAPERS_LIGHT = [
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1521727857535-28d2047314ac?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=1920&q=80&auto=format&fit=crop',
]

const INTERVAL_MS = 8000
const FADE_MS = 1800

interface Props {
  isDark: boolean
  /** Dim the photo toward the theme background so foreground UI stays legible. */
  overlayOpacity?: number
}

/**
 * Rotating hero wallpaper for the mobile hub. Cross-fades between two
 * overlapping Image layers so there's no flash when the slide swaps.
 */
export function WallpaperBg({ isDark, overlayOpacity = 0.55 }: Props) {
  const set = isDark ? WALLPAPERS_DARK : WALLPAPERS_LIGHT
  const [ready, setReady] = useState(false)
  // Index is a ref, not state — we only need it to compute "the next URL" on
  // each interval tick. Keeping it out of state avoids a classic React
  // footgun: calling setFrontUrl/setBackUrl inside setIdx's updater, which
  // triggers "Cannot update a component while rendering a different component".
  const idxRef = useRef(0)
  // Two layers: the "back" holds the previous image, "front" animates the next in.
  const frontOpacity = useRef(new Animated.Value(1)).current
  const [frontUrl, setFrontUrl] = useState(set[0])
  const [backUrl, setBackUrl] = useState<string | null>(null)

  // Prefetch every URL in the active set into the expo-image memory+disk cache
  // so the crossfade never waits on the network — that wait is what reads as a
  // "snap from transparent to opaque" on the first rotation. Disk cache means
  // subsequent app launches skip the network entirely.
  useEffect(() => {
    let cancelled = false
    setReady(false)
    Image.prefetch(set, 'memory-disk')
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [set])

  useEffect(() => {
    // Reset when variant flips — keep the currently-shown slide while the new
    // set preloads naturally on the next tick.
    idxRef.current = 0
    setFrontUrl(set[0])
    setBackUrl(null)
    frontOpacity.setValue(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark])

  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => {
      const prev = idxRef.current
      const next = (prev + 1) % set.length
      idxRef.current = next
      // All state updates happen at the same level — no setState inside
      // another state's updater, so React won't complain.
      setBackUrl(set[prev])
      setFrontUrl(set[next])
      frontOpacity.setValue(0)
      Animated.timing(frontOpacity, {
        toValue: 1,
        duration: FADE_MS,
        // Quad-in-out reads smoother than linear for cross-dissolves —
        // matches the CSS `ease-in-out` default the web wallpaper uses.
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start()
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [set, frontOpacity, ready])

  const overlayColor = isDark ? `rgba(0,0,0,${overlayOpacity})` : `rgba(255,255,255,${overlayOpacity})`

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {backUrl && (
        <Image source={{ uri: backUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      )}
      <AnimatedExpoImage
        source={{ uri: frontUrl }}
        style={[StyleSheet.absoluteFill, { opacity: frontOpacity }]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
    </View>
  )
}
