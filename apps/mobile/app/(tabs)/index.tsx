import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAppTheme } from '../../providers/ThemeProvider'
import { HubCarousel, HUB_DOMAINS, type HubDomain } from '../../components/hub/hub-carousel'
import { HubModulePanel } from '../../components/hub/hub-module-panel'
import { HubPreviewCard } from '../../components/hub/hub-preview-card'
import { WallpaperBg } from '../../components/hub/wallpaper-bg'
import { UserMenu } from '../../components/user-menu'

export default function HomeScreen() {
  const { isDark, palette } = useAppTheme()
  const { width: viewportW } = useWindowDimensions()
  const isPhone = viewportW < 768
  const router = useRouter()
  // `?domain=<key>` auto-opens that domain's module panel. Mirrors the web
  // app's `/hub?domain=settings` query flow — this is how the Database and
  // Admin tabs land the user directly inside a module panel, and also how
  // swipe-back from a sub-screen (e.g. Airports) returns to the hub with
  // Master Database already expanded.
  const params = useLocalSearchParams<{ domain?: string }>()

  const [sel, setSel] = useState<string | null>(null)
  const selDomain: HubDomain | undefined = sel ? HUB_DOMAINS.find((d) => d.key === sel) : undefined

  // Apply ?domain= once on mount and whenever the param changes. We strip
  // the param from the URL after reading so tapping the same tab again
  // doesn't retrigger the panel if the user has since pressed Back.
  useEffect(() => {
    const next = typeof params.domain === 'string' ? params.domain : null
    if (!next) return
    const match = HUB_DOMAINS.find((d) => d.key === next)
    if (!match) return
    setSel(match.key)
    router.setParams({ domain: undefined })
  }, [params.domain, router])

  // Entry animation for the content area — re-runs whenever the selection
  // flips (carousel → module view, or module view → back). Gives the premium
  // slide-and-fade feel instead of the jarring snap we had before.
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(24)).current
  useEffect(() => {
    fadeAnim.setValue(0)
    slideAnim.setValue(sel ? 36 : -36)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [sel, fadeAnim, slideAnim])

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ translateX: slideAnim }],
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Background layer — rotating aviation wallpaper while on the carousel,
         swaps to the selected domain's cover (blurred) when inside a module. */}
      {selDomain ? (
        <View style={StyleSheet.absoluteFill}>
          <ExpoImage
            source={selDomain.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            blurRadius={18}
            style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
          />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(6,6,12,0.55)' : 'rgba(15,15,25,0.35)' }]}
          />
        </View>
      ) : (
        <WallpaperBg isDark={isDark} overlayOpacity={isDark ? 0.55 : 0.35} />
      )}

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header — logo flush left, user menu right. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 0,
            paddingRight: isPhone ? 12 : 20,
            paddingTop: 6,
            paddingBottom: 4,
          }}
        >
          <Image
            source={require('../../assets/skyhub-logo.png')}
            style={{
              width: isPhone ? 170 : 210,
              height: isPhone ? 46 : 56,
              marginLeft: isPhone ? -22 : -28,
              // White on dark, black on light — follows theme, independent of
              // whether a module is selected.
              tintColor: isDark ? '#ffffff' : '#000000',
              opacity: isDark ? 0.9 : 0.85,
            }}
            resizeMode="contain"
          />
          <UserMenu overlay compact={isPhone} />
        </View>

        {/* Body — three modes:
           1. No selection → carousel
           2. Selection + phone → full-width module panel
           3. Selection + tablet → split view (card left, module panel right) */}
        <Animated.View
          style={[
            {
              flex: 1,
              paddingHorizontal: isPhone ? 12 : 20,
              paddingTop: isPhone ? 8 : 16,
              paddingBottom: 8,
            },
            animatedStyle,
          ]}
        >
          {!selDomain ? (
            <HubCarousel onSelect={setSel} isDark={isDark} />
          ) : isPhone ? (
            <HubModulePanel domain={selDomain} onBack={() => setSel(null)} isDark={isDark} />
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
              {/* LEFT: pinned preview card (~42% like web) */}
              <View style={{ flex: 42, justifyContent: 'center' }}>
                <HubPreviewCard domain={selDomain} />
              </View>
              {/* RIGHT: module tree panel (~58%) */}
              <View style={{ flex: 58 }}>
                <HubModulePanel domain={selDomain} onBack={() => setSel(null)} isDark={isDark} />
              </View>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}
