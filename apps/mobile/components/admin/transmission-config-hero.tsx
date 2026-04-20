import type { ReactElement } from 'react'
import { View, Text as RNText } from 'react-native'
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

// Mobile port of apps/web/src/components/admin/transmission-config/section-heroes.tsx.
// Same visual grammar as the ASM/SSM heroes (7.1.5.1): gradient frame + radial
// glow + grid mask + left-side title block + right-side illustration.

interface HeroProps {
  accent: string
  isDark: boolean
  eyebrow: string
  title: string
  caption: string
  illustration: 'scheduler' | 'validation' | 'overwrite' | 'inbound'
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

export function TransmissionConfigHero({
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
  const dimMuted = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

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
      <Svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <Defs>
          <LinearGradient id="tx-bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity={isDark ? 0.16 : 0.12} />
            <Stop offset="0.4" stopColor={accent} stopOpacity={0.04} />
            <Stop offset="1" stopColor={isDark ? '#191921' : '#FFFFFF'} stopOpacity={0.5} />
          </LinearGradient>
          <RadialGradient id="tx-glow" cx="0.85" cy="0.9" rx="0.55" ry="0.55">
            <Stop offset="0" stopColor={accent} stopOpacity={0.25} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tx-bg)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tx-glow)" />
        <GridLines accent={accent} opacity={0.18} />
      </Svg>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 12,
          top: (height - ILLUSTRATION_HEIGHT) / 2,
          width: 220,
          height: ILLUSTRATION_HEIGHT,
        }}
      >
        {illustration === 'scheduler' && <SchedulerIllustration accent={accent} dim={dim} panelFill={panelFill} />}
        {illustration === 'validation' && <ValidationIllustration accent={accent} dimMuted={dimMuted} />}
        {illustration === 'overwrite' && <OverwriteIllustration accent={accent} dim={dim} />}
        {illustration === 'inbound' && <InboundAccessIllustration accent={accent} dim={dim} />}
      </View>

      <View
        style={{
          position: 'absolute',
          left: 18,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          maxWidth: '55%',
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

/* ── 1. Scheduler — Sonar pulse + digital clock ── */

function SchedulerIllustration({ accent, dim, panelFill }: { accent: string; dim: string; panelFill: string }) {
  return (
    <Svg width="170" height="140" viewBox="0 0 170 140">
      {[0, 1, 2].map((i) => (
        <Circle
          key={i}
          cx={85}
          cy={70}
          r={18 + i * 16}
          fill="none"
          stroke={accent}
          strokeWidth={1.2}
          opacity={0.6 - i * 0.18}
        />
      ))}
      <Rect x={45} y={50} width={80} height={40} rx={8} fill={panelFill} stroke={accent} strokeWidth={1.5} />
      <SvgText x={85} y={78} fontSize={22} fontWeight="700" textAnchor="middle" fontFamily="monospace" fill={accent}>
        05:00
      </SvgText>
      <Circle cx={135} cy={70} r={3} fill={accent} />
      <Circle cx={35} cy={70} r={3} fill={accent} opacity={0.5} />
      <Path d="M 150 60 Q 158 70 150 80" stroke={accent} strokeWidth={1.5} fill="none" opacity={0.6} />
      <Path d="M 20 60 Q 12 70 20 80" stroke={dim} strokeWidth={1.5} fill="none" opacity={0.4} />
    </Svg>
  )
}

/* ── 2. Validation — Funnel with check / X exits ── */

function ValidationIllustration({ accent, dimMuted }: { accent: string; dimMuted: string }) {
  return (
    <Svg width="200" height="150" viewBox="0 0 200 150">
      {/* Incoming arrows */}
      {[36, 56, 76, 96].map((y, i) => (
        <G key={i}>
          <Line x1={6} y1={y} x2={48} y2={y} stroke={accent} strokeWidth={1.2} opacity={0.3 + i * 0.1} />
          <Polygon points={`46,${y - 3} 52,${y} 46,${y + 3}`} fill={accent} opacity={0.3 + i * 0.1} />
        </G>
      ))}

      {/* Funnel top + stem */}
      <Polygon points="58,20 158,20 128,70 88,70" fill={withAlpha(accent, 0.14)} stroke={accent} strokeWidth={1.5} />
      <Polygon points="88,70 128,70 122,110 94,110" fill={dimMuted} stroke={accent} strokeWidth={1.5} opacity={0.7} />

      {/* Rule bars inside funnel */}
      {[30, 40, 50].map((y, i) => (
        <Line key={i} x1={68 + i * 4} y1={y} x2={148 - i * 4} y2={y} stroke={accent} strokeWidth={1.5} opacity={0.6} />
      ))}

      {/* Accepted check */}
      <G x={100} y={124}>
        <Circle r={10} fill="#06C270" opacity={0.18} stroke="#06C270" strokeWidth={1.2} />
        <Path
          d="M -4 0 L -1 3 L 4 -3"
          stroke="#06C270"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>

      {/* Rejected X */}
      <G x={170} y={92}>
        <Circle r={10} fill="#E63535" opacity={0.18} stroke="#E63535" strokeWidth={1.2} />
        <Line x1={-4} y1={-4} x2={4} y2={4} stroke="#E63535" strokeWidth={2} strokeLinecap="round" />
        <Line x1={4} y1={-4} x2={-4} y2={4} stroke="#E63535" strokeWidth={2} strokeLinecap="round" />
      </G>

      <Path
        d="M 135 58 Q 155 70 165 82"
        stroke="#E63535"
        strokeWidth={1.2}
        fill="none"
        strokeDasharray="3 2"
        opacity={0.7}
      />
    </Svg>
  )
}

/* ── 3. Overwrite — Three ranked lanes ── */

function OverwriteIllustration({ accent, dim }: { accent: string; dim: string }) {
  const lanes = [
    { label: 'Manual', rank: 1, alpha: 0.33 },
    { label: 'MVT', rank: 2, alpha: 0.2 },
    { label: 'ACARS', rank: 3, alpha: 0.1 },
  ]
  return (
    <Svg width="200" height="140" viewBox="0 0 200 140">
      {lanes.map((l, i) => {
        const y = 18 + i * 34
        const fill = withAlpha(accent, l.alpha)
        return (
          <G key={l.label}>
            {/* Rank pill */}
            <Circle cx={18} cy={y + 12} r={11} fill={fill} stroke={accent} strokeWidth={1} opacity={1 - i * 0.15} />
            <SvgText x={18} y={y + 16} fontSize={11} fontWeight="700" textAnchor="middle" fill={accent}>
              {l.rank}
            </SvgText>
            {/* Lane bar */}
            <Rect
              x={36}
              y={y}
              width={140 - i * 10}
              height={24}
              rx={6}
              fill={fill}
              stroke={i === 0 ? accent : 'transparent'}
              strokeWidth={i === 0 ? 1.5 : 0}
            />
            <SvgText x={46} y={y + 16} fontSize={11} fontWeight="600" fill={i === 0 ? accent : dim}>
              {l.label}
            </SvgText>
            {i < 2 && (
              <Path
                d={`M 170 ${y + 28} Q 180 ${y + 17} 170 ${y + 6}`}
                stroke={accent}
                strokeWidth={1}
                fill="none"
                opacity={0.5 - i * 0.2}
                strokeDasharray="3 2"
              />
            )}
          </G>
        )
      })}
      {/* Crown on top lane */}
      <G x={176} y={24}>
        <Path d="M 0 4 L 4 0 L 8 4 L 12 0 L 16 4 L 16 10 L 0 10 Z" fill={accent} opacity={0.85} />
      </G>
      <Line x1={194} y1={14} x2={194} y2={116} stroke={dim} strokeWidth={1} opacity={0.4} />
      <SvgText x={198} y={22} fontSize={8} fill={dim} fontFamily="monospace">
        HI
      </SvgText>
      <SvgText x={198} y={114} fontSize={8} fill={dim} fontFamily="monospace">
        LO
      </SvgText>
    </Svg>
  )
}

/* ── 4. Inbound Access — Key + lock ── */

function InboundAccessIllustration({ accent, dim }: { accent: string; dim: string }) {
  return (
    <Svg width="220" height="140" viewBox="0 0 220 140">
      {/* Incoming connection */}
      <Line x1={10} y1={70} x2={70} y2={70} stroke={accent} strokeWidth={1.4} strokeDasharray="5 3" />
      <Circle cx={10} cy={70} r={4} fill={accent} />

      {/* Key */}
      <G x={70} y={70}>
        <Circle r={14} fill="none" stroke={accent} strokeWidth={2.5} />
        <Circle r={6} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.5} />
        <Rect x={14} y={-3} width={44} height={6} fill={accent} />
        <Rect x={44} y={3} width={4} height={8} fill={accent} />
        <Rect x={52} y={3} width={4} height={6} fill={accent} />
      </G>

      {/* Lock body */}
      <G x={160} y={40}>
        <Path d="M 10 20 L 10 12 A 16 16 0 0 1 42 12 L 42 20" fill="none" stroke={dim} strokeWidth={3} />
        <Rect
          x={2}
          y={20}
          width={48}
          height={42}
          rx={5}
          fill={withAlpha(accent, 0.14)}
          stroke={accent}
          strokeWidth={1.5}
        />
        <Circle cx={26} cy={36} r={4} fill={accent} />
        <Rect x={24} y={36} width={4} height={14} fill={accent} />
        <G x={38} y={52}>
          <Circle r={8} fill="#06C270" opacity={0.28} />
          <Path
            d="M -3 0 L -0.5 2.5 L 3 -2.5"
            stroke="#06C270"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      </G>

      {/* Bitstream */}
      {[8, 20, 32, 44, 56].map((x, i) => (
        <SvgText key={i} x={x} y={118} fontSize={8} fontFamily="monospace" fill={dim} opacity={0.3 + (i % 2) * 0.2}>
          {i % 2 === 0 ? '01' : '11'}
        </SvgText>
      ))}
    </Svg>
  )
}
