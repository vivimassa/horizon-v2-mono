// SkyHub — Animated Background for React Native
// Replicates the V1 oklch hue-rotation gradients using Reanimated + LinearGradient.
// Pre-computed color lookup tables since RN has no oklch support.
import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  useDerivedValue,
  Easing,
} from 'react-native-reanimated'
import type { BackgroundPreset } from '../stores/useThemeStore'

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient)

// ── oklch → sRGB conversion (pre-compute helper) ──────────────
// oklch(L, C, H) → hex. Simplified for the narrow L/C ranges we use.
function oklchToHex(L: number, C: number, H: number): string {
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  // OKLab → linear sRGB
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  // Gamma correction
  const gamma = (x: number) => {
    x = Math.max(0, Math.min(1, x))
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
  }

  const toHex = (v: number) => {
    const clamped = Math.round(gamma(v) * 255)
    return clamped.toString(16).padStart(2, '0')
  }

  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

// ── Pre-compute color lookup tables ───────────────────────────
// For each preset, generate 37 color pairs (every 10 degrees of animation progress)
const STEPS = 36

interface PresetConfig {
  hue1Start: number
  hue1End: number
  hue2Start: number
  hue2End: number
  duration: number
  pingPong: boolean // true = oscillate, false = continuous rotation
}

const PRESET_CONFIGS: Record<Exclude<BackgroundPreset, 'none'>, PresetConfig> = {
  aurora: { hue1Start: 200, hue1End: 260, hue2Start: 260, hue2End: 320, duration: 5000, pingPong: true },
  ember: { hue1Start: 10, hue1End: 40, hue2Start: 40, hue2End: 65, duration: 6000, pingPong: true },
  lagoon: { hue1Start: 170, hue1End: 210, hue2Start: 210, hue2End: 245, duration: 7000, pingPong: true },
  prism: { hue1Start: 0, hue1End: 360, hue2Start: 180, hue2End: 540, duration: 6000, pingPong: false },
}

interface ColorTable {
  light: { c1: string[]; c2: string[] }
  dark: { c1: string[]; c2: string[] }
}

function buildColorTable(config: PresetConfig): ColorTable {
  const lightL1 = 0.97,
    lightC1 = 0.025
  const lightL2 = 0.96,
    lightC2 = 0.035
  const darkL1 = 0.18,
    darkC1 = 0.045
  const darkL2 = 0.14,
    darkC2 = 0.055

  const table: ColorTable = {
    light: { c1: [], c2: [] },
    dark: { c1: [], c2: [] },
  }

  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const h1 = config.hue1Start + (config.hue1End - config.hue1Start) * t
    const h2 = config.hue2Start + (config.hue2End - config.hue2Start) * t
    table.light.c1.push(oklchToHex(lightL1, lightC1, h1 % 360))
    table.light.c2.push(oklchToHex(lightL2, lightC2, h2 % 360))
    table.dark.c1.push(oklchToHex(darkL1, darkC1, h1 % 360))
    table.dark.c2.push(oklchToHex(darkL2, darkC2, h2 % 360))
  }

  return table
}

const COLOR_TABLES: Record<Exclude<BackgroundPreset, 'none'>, ColorTable> = {
  aurora: buildColorTable(PRESET_CONFIGS.aurora),
  ember: buildColorTable(PRESET_CONFIGS.ember),
  lagoon: buildColorTable(PRESET_CONFIGS.lagoon),
  prism: buildColorTable(PRESET_CONFIGS.prism),
}

// ── Interpolate between two hex colors ────────────────────────
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16)
  const r = Math.round(parse(a, 1) + (parse(b, 1) - parse(a, 1)) * t)
  const g = Math.round(parse(a, 3) + (parse(b, 3) - parse(a, 3)) * t)
  const bl = Math.round(parse(a, 5) + (parse(b, 5) - parse(a, 5)) * t)
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function getInterpolatedColors(table: { c1: string[]; c2: string[] }, progress: number): [string, string] {
  const pos = progress * STEPS
  const idx = Math.floor(pos)
  const frac = pos - idx
  const i0 = Math.min(idx, STEPS)
  const i1 = Math.min(idx + 1, STEPS)
  return [lerpColor(table.c1[i0], table.c1[i1], frac), lerpColor(table.c2[i0], table.c2[i1], frac)]
}

// ── Component ─────────────────────────────────────────────────
interface AnimatedBackgroundProps {
  preset: Exclude<BackgroundPreset, 'none'>
  isDark: boolean
  children: React.ReactNode
}

export function AnimatedBackground({ preset, isDark, children }: AnimatedBackgroundProps) {
  const config = PRESET_CONFIGS[preset]
  const table = COLOR_TABLES[preset]
  const modeTable = isDark ? table.dark : table.light

  const progress = useSharedValue(0)

  useEffect(() => {
    if (config.pingPong) {
      progress.value = 0
      progress.value = withRepeat(
        withTiming(1, { duration: config.duration / 2, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    } else {
      progress.value = 0
      progress.value = withRepeat(withTiming(1, { duration: config.duration, easing: Easing.linear }), -1, false)
    }
  }, [preset, config.duration, config.pingPong])

  // Since AnimatedLinearGradient doesn't support animatedProps for colors easily,
  // we use a simpler approach: render with JS-driven updates at ~30fps
  const [gradientColors, setGradientColors] = React.useState<[string, string]>(() =>
    getInterpolatedColors(modeTable, 0),
  )

  useEffect(() => {
    let raf: ReturnType<typeof requestAnimationFrame>
    let lastTime = 0
    const animate = (time: number) => {
      // Throttle to ~30fps
      if (time - lastTime > 33) {
        const p = progress.value
        setGradientColors(getInterpolatedColors(modeTable, p))
        lastTime = time
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [modeTable, preset])

  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
      {children}
    </LinearGradient>
  )
}
