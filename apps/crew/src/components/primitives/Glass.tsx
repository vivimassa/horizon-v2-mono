import { type ReactNode } from 'react'
import { Platform, Pressable, View, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { useScheme } from '../../stores/use-theme-store'

export type GlassTier = 'hero' | 'standard' | 'soft'

interface Props {
  children: ReactNode
  tier?: GlassTier
  padding?: number
  style?: ViewStyle
  contentStyle?: ViewStyle
  onPress?: () => void
  /** Optional 3px left accent bar (sits flush with wrapper edge, above BlurView). */
  accentBar?: string
}

interface TierStyle {
  intensity: number
  bg: string
  borderColor: string
  borderWidth: number
  borderRadius: number
  shadow?: ViewStyle
}

const DARK: Record<GlassTier, TierStyle> = {
  hero: {
    intensity: 40,
    bg: 'rgba(28,28,40,0.58)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderRadius: 20,
    shadow: {
      shadowColor: '#000',
      shadowOpacity: 0.55,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
  },
  standard: {
    intensity: 28,
    bg: 'rgba(20,20,30,0.45)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 16,
    shadow: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  },
  soft: {
    intensity: 20,
    bg: 'rgba(20,20,30,0.30)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 14,
  },
}

const LIGHT: Record<GlassTier, TierStyle> = {
  hero: {
    intensity: 32,
    bg: 'rgba(255,255,255,0.78)',
    borderColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderRadius: 20,
    shadow: {
      shadowColor: '#1f2687',
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
  standard: {
    intensity: 24,
    bg: 'rgba(255,255,255,0.65)',
    borderColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderRadius: 16,
    shadow: {
      shadowColor: '#1f2687',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
  soft: {
    intensity: 18,
    bg: 'rgba(255,255,255,0.45)',
    borderColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderRadius: 14,
    shadow: {
      shadowColor: '#1f2687',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  },
}

/**
 * BlurView-based glass card. Three tiers (hero / standard / soft) provide
 * the depth hierarchy. Scope picked from useScheme(). Dark/light tier
 * recipes match the Claude Design balanced-intensity preset.
 */
export function Glass({ children, tier = 'standard', padding = 14, style, contentStyle, onPress, accentBar }: Props) {
  const scheme = useScheme()
  const t = (scheme === 'dark' ? DARK : LIGHT)[tier]

  const wrapperStyle: ViewStyle = {
    borderRadius: t.borderRadius,
    overflow: 'hidden',
    borderWidth: t.borderWidth,
    borderColor: t.borderColor,
    backgroundColor: t.bg,
    ...t.shadow,
    ...style,
  }

  const inner = (
    <>
      <BlurView
        intensity={Platform.OS === 'ios' ? t.intensity : Math.min(100, t.intensity * 2)}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={{ padding, ...contentStyle }}
      >
        {children}
      </BlurView>
      {accentBar && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: accentBar,
          }}
        />
      )}
    </>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={wrapperStyle}>
        {inner}
      </Pressable>
    )
  }
  return <View style={wrapperStyle}>{inner}</View>
}
