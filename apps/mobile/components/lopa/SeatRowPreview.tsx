import { memo, useMemo } from 'react'
import { View, Text } from 'react-native'
import Svg, { Rect, G, Text as SvgText, Line } from 'react-native-svg'
import type { Palette } from '@skyhub/ui/theme'

interface SeatRowPreviewProps {
  seatLayout: string
  color: string
  seatType?: 'standard' | 'premium' | 'lie-flat' | 'suite' | null
  pitchIn?: number | null
  palette: Palette
  align?: 'center' | 'left'
}

const SEAT_LETTERS_LEFT: Record<number, string[]> = {
  1: ['A'],
  2: ['A', 'B'],
  3: ['A', 'B', 'C'],
  4: ['A', 'B', 'C', 'D'],
}
const SEAT_LETTERS_RIGHT: Record<number, string[]> = {
  1: ['F'],
  2: ['E', 'F'],
  3: ['D', 'E', 'F'],
  4: ['D', 'E', 'F', 'G'],
}

function getSeatLetters(groups: number[]): string[][] {
  if (groups.length === 2) {
    return [
      SEAT_LETTERS_LEFT[groups[0]] || Array.from({ length: groups[0] }, (_, i) => String.fromCharCode(65 + i)),
      SEAT_LETTERS_RIGHT[groups[1]] || Array.from({ length: groups[1] }, (_, i) => String.fromCharCode(68 + i)),
    ]
  }
  const all: string[][] = []
  let charIdx = 0
  for (const count of groups) {
    const letters: string[] = []
    for (let i = 0; i < count; i++) {
      letters.push(String.fromCharCode(65 + charIdx))
      charIdx++
    }
    all.push(letters)
  }
  return all
}

export const SeatRowPreview = memo(function SeatRowPreview({
  seatLayout,
  color,
  seatType,
  pitchIn,
  palette,
  align = 'center',
}: SeatRowPreviewProps) {
  const groups = useMemo(() => seatLayout.split('-').map(Number), [seatLayout])
  const letters = useMemo(() => getSeatLetters(groups), [groups])
  const totalSeatsPerRow = groups.reduce((s, g) => s + g, 0)

  const seatW = seatType === 'suite' ? 48 : seatType === 'lie-flat' ? 40 : seatType === 'premium' ? 34 : 30
  const seatH = seatType === 'suite' ? 52 : seatType === 'lie-flat' ? 44 : seatType === 'premium' ? 36 : 32
  const seatGap = 4
  const aisleW = 28
  const groupGap = aisleW
  const padX = 32
  const padY = 28

  const groupWidths = groups.map((count) => count * seatW + (count - 1) * seatGap)
  const totalW = groupWidths.reduce((s, w) => s + w, 0) + (groups.length - 1) * groupGap + padX * 2
  const totalH = seatH + padY * 2 + 20

  const seats: { x: number; y: number; letter: string }[] = []
  let curX = padX
  for (let g = 0; g < groups.length; g++) {
    for (let s = 0; s < groups[g]; s++) {
      seats.push({ x: curX + s * (seatW + seatGap), y: padY, letter: letters[g]?.[s] || '' })
    }
    curX += groupWidths[g] + groupGap
  }

  const seatR = seatType === 'suite' ? 6 : seatType === 'lie-flat' ? 5 : 4
  const seatBackH = Math.round(seatH * 0.25)

  // Aisle elements
  const aisles: { x: number }[] = []
  let aX = padX
  for (let g = 0; g < groups.length - 1; g++) {
    aX += groupWidths[g]
    aisles.push({ x: aX })
    aX += groupGap
  }

  return (
    <View style={{ alignItems: align === 'left' ? 'flex-start' : 'center', gap: 8 }}>
      <Svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width={Math.min(totalW * 1.2, 400)}
        height={(totalH * Math.min(totalW * 1.2, 400)) / totalW}
        style={{ maxWidth: '100%' }}
      >
        {aisles.map((aisle, i) => {
          const center = aisle.x + groupGap / 2
          return (
            <G key={`aisle-${i}`}>
              <Rect
                x={aisle.x + 4}
                y={padY - 2}
                width={groupGap - 8}
                height={seatH + 4}
                rx={4}
                fill={palette.border}
                opacity={0.3}
              />
              <Line
                x1={center}
                y1={padY + 4}
                x2={center}
                y2={padY + seatH - 4}
                stroke={palette.textTertiary}
                strokeWidth={1.5}
                strokeDasharray="4,3"
                opacity={0.3}
              />
            </G>
          )
        })}
        {seats.map((seat, i) => (
          <G key={i}>
            <Rect
              x={seat.x}
              y={seat.y}
              width={seatW}
              height={seatH}
              rx={seatR}
              fill={color}
              opacity={0.15}
              stroke={color}
              strokeWidth={1.5}
            />
            <Rect
              x={seat.x + 2}
              y={seat.y + 2}
              width={seatW - 4}
              height={seatBackH}
              rx={seatR - 1}
              fill={color}
              opacity={0.4}
            />
            <Rect
              x={seat.x - 1}
              y={seat.y + seatBackH + 4}
              width={2.5}
              height={seatH - seatBackH - 8}
              rx={1}
              fill={color}
              opacity={0.35}
            />
            <Rect
              x={seat.x + seatW - 1.5}
              y={seat.y + seatBackH + 4}
              width={2.5}
              height={seatH - seatBackH - 8}
              rx={1}
              fill={color}
              opacity={0.35}
            />
            <SvgText
              x={seat.x + seatW / 2}
              y={seat.y + seatH + 14}
              textAnchor="middle"
              fontSize={11}
              fontWeight="600"
              fontFamily="monospace"
              fill={palette.textSecondary}
            >
              {seat.letter}
            </SvgText>
          </G>
        ))}
      </Svg>

      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Text style={{ fontSize: 12, color: palette.textSecondary }}>
          Layout: <Text style={{ fontWeight: '700', fontFamily: 'monospace', color }}>{seatLayout}</Text>
        </Text>
        <Text style={{ fontSize: 12, color: palette.border }}>·</Text>
        <Text style={{ fontSize: 12, color: palette.textSecondary }}>{totalSeatsPerRow} abreast</Text>
        {pitchIn ? (
          <>
            <Text style={{ fontSize: 12, color: palette.border }}>·</Text>
            <Text style={{ fontSize: 12, color: palette.textSecondary }}>{pitchIn}" pitch</Text>
          </>
        ) : null}
      </View>
    </View>
  )
})
