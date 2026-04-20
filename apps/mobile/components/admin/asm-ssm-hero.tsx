import type { ReactElement } from 'react'
import { View, Text as RNText } from 'react-native'
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

// Mobile port of apps/web/src/components/admin/asm-ssm-transmission/section-heroes.tsx.
// Same visual grammar: gradient frame + grid mask + right-side illustration +
// left-side title block. Kept pixel-close to the web version so the screens
// feel like one product across platforms.

interface HeroProps {
  accent: string
  isDark: boolean
  eyebrow: string
  title: string
  caption: string
  illustration: 'generation' | 'consumers' | 'held' | 'log'
  /** Override internal hero height. Defaults to 180 (matches web). */
  height?: number
}

const DEFAULT_HEIGHT = 180
const ILLUSTRATION_HEIGHT = 150

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

export function AsmSsmHero({
  accent,
  isDark,
  eyebrow,
  title,
  caption,
  illustration,
  height = DEFAULT_HEIGHT,
}: HeroProps) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.95)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(71,85,105,0.85)'
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const panelFill = isDark ? '#13131A' : '#FAFAFC'
  const dim = isDark ? '#8F90A6' : '#555770'

  return (
    <View
      style={{
        height,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor,
        marginBottom: 16,
      }}
    >
      {/* Gradient + grid backdrop */}
      <Svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <Defs>
          <LinearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity={isDark ? 0.16 : 0.12} />
            <Stop offset="0.4" stopColor={accent} stopOpacity={0.04} />
            <Stop offset="1" stopColor={isDark ? '#191921' : '#FFFFFF'} stopOpacity={0.5} />
          </LinearGradient>
          <RadialGradient id="hero-glow" cx="0.85" cy="0.9" rx="0.55" ry="0.55">
            <Stop offset="0" stopColor={accent} stopOpacity={0.25} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="grid-mask" cx="0.85" cy="0.5" rx="0.9" ry="0.9">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero-bg)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero-glow)" />
        <GridLines accent={accent} opacity={0.18} />
      </Svg>

      {/* Illustration (right side, absolutely positioned) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 12,
          top: (height - ILLUSTRATION_HEIGHT) / 2,
          width: 200,
          height: ILLUSTRATION_HEIGHT,
        }}
      >
        {illustration === 'generation' && <GenerationIllustration accent={accent} dim={dim} panelFill={panelFill} />}
        {illustration === 'consumers' && <ConsumersIllustration accent={accent} dim={dim} panelFill={panelFill} />}
        {illustration === 'held' && <HeldIllustration accent={accent} dim={dim} />}
        {illustration === 'log' && <LogIllustration accent={accent} dim={dim} panelFill={panelFill} />}
      </View>

      {/* Title block (left) */}
      <View
        style={{
          position: 'absolute',
          left: 18,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          maxWidth: '56%',
        }}
      >
        <RNText
          style={{
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: accent,
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </RNText>
        <RNText
          numberOfLines={2}
          style={{
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: -0.2,
            lineHeight: 22,
            color: textPrimary,
            marginBottom: 4,
          }}
        >
          {title}
        </RNText>
        <RNText numberOfLines={3} style={{ fontSize: 13, lineHeight: 18, color: textSecondary }}>
          {caption}
        </RNText>
      </View>
    </View>
  )
}

/* ── Grid overlay ── */

function GridLines({ accent, opacity = 0.18 }: { accent: string; opacity?: number }) {
  const cells = 8
  const rows = 6
  const lines: ReactElement[] = []
  for (let i = 1; i < cells; i++) {
    const x = `${(100 / cells) * i}%`
    lines.push(
      <Line key={`v${i}`} x1={x} y1="0" x2={x} y2="100%" stroke={accent} strokeWidth="1" opacity={opacity * 0.5} />,
    )
  }
  for (let i = 1; i < rows; i++) {
    const y = `${(100 / rows) * i}%`
    lines.push(
      <Line key={`h${i}`} x1="0" y1={y} x2="100%" y2={y} stroke={accent} strokeWidth="1" opacity={opacity * 0.5} />,
    )
  }
  return <G>{lines}</G>
}

/* ── 1. Generation & Release — Gear + radiating envelopes ── */

function GenerationIllustration({ accent, dim, panelFill }: { accent: string; dim: string; panelFill: string }) {
  return (
    <Svg width="200" height="150" viewBox="0 0 200 150">
      {/* Central gear teeth */}
      <G x={100} y={75}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <Rect
            key={a}
            x="-4"
            y="-32"
            width="8"
            height="10"
            rx="1"
            fill={accent}
            opacity={0.85}
            transform={`rotate(${a})`}
          />
        ))}
        <Circle r={24} fill={panelFill} stroke={accent} strokeWidth={2} />
        <Circle r={8} fill={accent} />
      </G>

      {/* Envelopes at the corners */}
      {[
        { x: 30, y: 30 },
        { x: 170, y: 30 },
        { x: 30, y: 120 },
        { x: 170, y: 120 },
      ].map((p, i) => (
        <G key={i} x={p.x} y={p.y} opacity={0.85}>
          <Rect
            x={-12}
            y={-8}
            width={24}
            height={16}
            rx={2}
            fill={withAlpha(accent, 0.14)}
            stroke={accent}
            strokeWidth={1.2}
          />
          <Path d="M -12 -8 L 0 2 L 12 -8" stroke={accent} strokeWidth={1.2} fill="none" />
        </G>
      ))}

      {/* Dashed lines from gear to envelopes */}
      {[
        { x: 30, y: 30 },
        { x: 170, y: 30 },
        { x: 30, y: 120 },
        { x: 170, y: 120 },
      ].map((p, i) => (
        <Line
          key={i}
          x1={100}
          y1={75}
          x2={p.x}
          y2={p.y}
          stroke={dim}
          strokeWidth={1}
          strokeDasharray="3 2"
          opacity={0.45}
        />
      ))}
    </Svg>
  )
}

/* ── 2. Consumers — Outbox + three labelled endpoints ── */

function ConsumersIllustration({ accent, dim, panelFill }: { accent: string; dim: string; panelFill: string }) {
  return (
    <Svg width="220" height="150" viewBox="0 0 220 150">
      {/* Central outbox */}
      <G x={60} y={75}>
        <Rect
          x={-22}
          y={-16}
          width={44}
          height={32}
          rx={5}
          fill={withAlpha(accent, 0.14)}
          stroke={accent}
          strokeWidth={1.5}
        />
        <Line x1={-22} y1={-6} x2={22} y2={-6} stroke={accent} strokeWidth={1.2} opacity={0.6} />
        <Line x1={-22} y1={2} x2={22} y2={2} stroke={accent} strokeWidth={1.2} opacity={0.4} />
        <Line x1={-22} y1={10} x2={22} y2={10} stroke={accent} strokeWidth={1.2} opacity={0.25} />
      </G>

      {[
        { x: 180, y: 28, label: 'API' },
        { x: 190, y: 75, label: 'SFTP' },
        { x: 180, y: 122, label: '@' },
      ].map((p, i) => (
        <G key={i}>
          <Line
            x1={82}
            y1={75}
            x2={p.x - 14}
            y2={p.y}
            stroke={accent}
            strokeWidth={1.3}
            strokeDasharray="4 3"
            opacity={0.6}
          />
          <Circle cx={p.x} cy={p.y} r={15} fill={panelFill} stroke={accent} strokeWidth={1.5} />
          <SvgText
            x={p.x}
            y={p.y + 3}
            fontSize={10}
            fontWeight="700"
            textAnchor="middle"
            fontFamily="monospace"
            fill={accent}
          >
            {p.label}
          </SvgText>
        </G>
      ))}

      {/* Outbound trail dots */}
      {[110, 130, 150].map((x, i) => (
        <Circle key={i} cx={x} cy={75} r={1.5} fill={dim} opacity={0.8 - i * 0.25} />
      ))}
    </Svg>
  )
}

/* ── 3. Held Queue — Holding pen + release gate ── */

function HeldIllustration({ accent, dim }: { accent: string; dim: string }) {
  return (
    <Svg width="220" height="150" viewBox="0 0 220 150">
      <Rect
        x={20}
        y={35}
        width={120}
        height={80}
        rx={8}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        strokeDasharray="5 3"
        opacity={0.7}
      />

      {[
        { x: 45, y: 60 },
        { x: 75, y: 60 },
        { x: 105, y: 60 },
        { x: 45, y: 85 },
        { x: 75, y: 85 },
      ].map((p, i) => (
        <Rect
          key={i}
          x={p.x - 10}
          y={p.y - 7}
          width={20}
          height={14}
          rx={2}
          fill={withAlpha(accent, 0.2)}
          stroke={accent}
          strokeWidth={1}
          opacity={0.85 - i * 0.08}
        />
      ))}

      {/* Release arrow */}
      <G x={150} y={75}>
        <Line x1={0} y1={-28} x2={0} y2={28} stroke={dim} strokeWidth={1.5} />
        <Path d="M 8 -8 L 32 0 L 8 8 Z" fill={accent} opacity={0.85} />
        <Line x1={0} y1={0} x2={30} y2={0} stroke={accent} strokeWidth={1.5} />
      </G>

      {/* Approve / reject chips */}
      <G x={195} y={55}>
        <Circle r={10} fill="#06C270" opacity={0.22} stroke="#06C270" strokeWidth={1.2} />
        <Path
          d="M -4 0 L -1 3 L 4 -3"
          stroke="#06C270"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <G x={195} y={95}>
        <Circle r={10} fill="#E63535" opacity={0.18} stroke="#E63535" strokeWidth={1.2} />
        <Line x1={-4} y1={-4} x2={4} y2={4} stroke="#E63535" strokeWidth={2} strokeLinecap="round" />
        <Line x1={4} y1={-4} x2={-4} y2={4} stroke="#E63535" strokeWidth={2} strokeLinecap="round" />
      </G>
    </Svg>
  )
}

/* ── 4. Delivery Log — Ledger rows with status pills ── */

function LogIllustration({ accent, dim, panelFill }: { accent: string; dim: string; panelFill: string }) {
  const rowY = [50, 70, 90, 110]
  const pillColors = ['#06C270', '#06C270', '#E63535', '#FF8800']
  const dotColors = ['#06C270', '#FF8800', '#E63535', '#06C270']

  return (
    <Svg width="220" height="150" viewBox="0 0 220 150">
      <Rect x={10} y={20} width={200} height={110} rx={6} fill={panelFill} stroke={accent} strokeWidth={1.2} />
      <Rect x={10} y={20} width={200} height={18} rx={6} fill={withAlpha(accent, 0.14)} />
      {[100, 140, 170].map((x, i) => (
        <Line key={i} x1={x} y1={38} x2={x} y2={130} stroke={dim} strokeWidth={0.8} opacity={0.35} />
      ))}
      {rowY.map((y, i) => (
        <G key={i}>
          <Rect x={14} y={y - 6} width={80} height={12} rx={2} fill={dim} opacity={0.12} />
          <Rect x={106} y={y - 6} width={28} height={12} rx={2} fill={dim} opacity={0.1} />
          <Rect x={144} y={y - 6} width={22} height={12} rx={2} fill={dim} opacity={0.1} />
          <Rect x={176} y={y - 6} width={28} height={12} rx={6} fill={pillColors[i]} opacity={0.22} />
          <Circle cx={182} cy={y} r={2.5} fill={dotColors[i]} />
        </G>
      ))}
    </Svg>
  )
}
