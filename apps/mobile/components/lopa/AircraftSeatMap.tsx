import { memo, useMemo, useState } from 'react'
import { View, Text, Image, LayoutChangeEvent, useWindowDimensions } from 'react-native'
import Svg, { Rect, G, Text as SvgText, Line, Path } from 'react-native-svg'
import { modeColor, type Palette } from '@skyhub/ui/theme'
import type { CabinClassRef, CabinEntry } from '@skyhub/api'

// Fuselage images mapped by ICAO type — require() calls must be static
const FUSELAGE_IMAGES: Record<string, any> = {
  A320: require('../../assets/aircraft/A320/fuselage.png'),
  A321: require('../../assets/aircraft/A321/fuselage.png'),
  A350: require('../../assets/aircraft/A350/fuselage.png'),
  A380: require('../../assets/aircraft/A380/fuselage.png'),
}

// Cabin cutout region as % of the fuselage image (where seats go)
// Tuned for the fuselage template PNGs
const CABIN_REGION = { left: 14, right: 77, top: 35, bottom: 65 }

interface AircraftSeatMapProps {
  cabins: CabinEntry[]
  cabinClasses: CabinClassRef[]
  aircraftType?: string
  palette: Palette
  isDark: boolean
}

interface CabinSection {
  classCode: string
  color: string
  name: string
  seats: number
  layout: number[]
  seatsPerRow: number
  rows: number
}

function parseSections(cabins: CabinEntry[], cabinClasses: CabinClassRef[], isDark: boolean): CabinSection[] {
  const sorted = [...cabins].sort((a, b) => {
    const aOrder = cabinClasses.find(c => c.code === a.classCode)?.sortOrder ?? 99
    const bOrder = cabinClasses.find(c => c.code === b.classCode)?.sortOrder ?? 99
    return aOrder - bOrder
  })

  return sorted.map(cabin => {
    const cc = cabinClasses.find(c => c.code === cabin.classCode)
    const layout = (cc?.seatLayout || '3-3').split('-').map(Number)
    const seatsPerRow = layout.reduce((s, g) => s + g, 0)
    const rows = Math.ceil(cabin.seats / seatsPerRow)
    return {
      classCode: cabin.classCode,
      color: modeColor(cc?.color || '#9ca3af', isDark),
      name: cc?.name || cabin.classCode,
      seats: cabin.seats,
      layout,
      seatsPerRow,
      rows,
    }
  })
}

const SEAT_GAP = 1.5
const AISLE_W = 8
const ROW_GAP = 2
const CABIN_GAP = 4

export const AircraftSeatMap = memo(function AircraftSeatMap({
  cabins, cabinClasses, aircraftType, palette, isDark,
}: AircraftSeatMapProps) {
  const sections = useMemo(() => parseSections(cabins, cabinClasses, isDark), [cabins, cabinClasses, isDark])
  const imgType = aircraftType?.toUpperCase() || ''
  const fuselageImg = FUSELAGE_IMAGES[imgType]
  const [imgError, setImgError] = useState(false)

  if (sections.length === 0) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: palette.textSecondary }}>No cabin data to display</Text>
      </View>
    )
  }

  // Use image-based rendering if we have a fuselage PNG
  if (fuselageImg && !imgError) {
    return (
      <ImageSeatMap
        sections={sections}
        fuselageImg={fuselageImg}
        onImgError={() => setImgError(true)}
        palette={palette}
        isDark={isDark}
      />
    )
  }

  // Fallback: SVG-only rendering
  return <FallbackSeatMap sections={sections} palette={palette} />
})

// ── Image-based seat map with fuselage PNG ──

function ImageSeatMap({ sections, fuselageImg, onImgError, palette, isDark }: {
  sections: CabinSection[]
  fuselageImg: any
  onImgError: () => void
  palette: Palette
  isDark: boolean
}) {
  const [containerW, setContainerW] = useState(0)
  const { width: screenW } = useWindowDimensions()
  const isTablet = screenW >= 768
  const imgH = isTablet ? 300 : 120

  const onLayout = (e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width)

  // Compute SVG viewBox dimensions for the seat overlay
  const PAD = 2
  const maxAbreast = Math.max(...sections.map(s => s.seatsPerRow))
  const maxGroups = Math.max(...sections.map(s => s.layout.length))
  const aisleCount = maxGroups - 1

  const seatH = 10
  const seatW = 8

  const getRowGap = (seatsPerRow: number) => {
    const ratio = maxAbreast / Math.max(1, seatsPerRow)
    return ROW_GAP + (ratio - 1) * seatH * 0.25
  }

  const totalGaps = Math.max(0, sections.length - 1) * CABIN_GAP
  const svgW = sections.reduce((w, sec) => {
    const gap = getRowGap(sec.seatsPerRow)
    const sh = sec.seatsPerRow <= 2 ? seatH * 1.2 : seatH
    return w + sec.rows * (sh + gap)
  }, 0) + totalGaps + PAD * 2
  const svgH = maxAbreast * (seatW + SEAT_GAP) + aisleCount * AISLE_W + PAD * 2

  // Build seat elements
  const seatElements = buildSeatElements(sections, {
    PAD, seatH, seatW, maxAbreast, svgH,
    getRowGap,
  })

  return (
    <View style={{ width: '100%' }} onLayout={onLayout}>
      {/* Fuselage image */}
      <View style={{ width: '100%', height: imgH, borderRadius: 12, overflow: 'hidden' }}>
        <Image
          source={fuselageImg}
          style={{ width: '100%', height: imgH, opacity: isDark ? 0.85 : 1 }}
          resizeMode="stretch"
          onError={onImgError}
        />

        {/* Dark mode desaturation overlay — mutes the fuselage colors */}
        {isDark && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,30,34,0.3)' }} />
        )}

        {/* SVG seat overlay positioned within the cabin cutout region */}
        <View
          style={{
            position: 'absolute',
            left: `${CABIN_REGION.left}%`,
            top: `${CABIN_REGION.top}%`,
            width: `${CABIN_REGION.right - CABIN_REGION.left}%`,
            height: `${CABIN_REGION.bottom - CABIN_REGION.top}%`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.9)',
          }}
        >
          <Svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            {seatElements}
          </Svg>
        </View>
      </View>
    </View>
  )
}

// ── SVG-only fallback (no fuselage image) ──

function FallbackSeatMap({ sections, palette }: {
  sections: CabinSection[]
  palette: Palette
}) {
  const SW = 8, SH = 7, PY = 14, NOSE = 40, TAIL = 30
  const borderColor = palette.border

  const maxW = Math.max(...sections.map(s => {
    const gw = s.layout.map(c => c * SW + (c - 1) * SEAT_GAP)
    return gw.reduce((a, b) => a + b, 0) + (s.layout.length - 1) * AISLE_W
  }))

  const totalRowsLen = sections.reduce((len, sec, i) =>
    len + sec.rows * (SH + ROW_GAP) + (i < sections.length - 1 ? CABIN_GAP : 0), 0)

  const fH = maxW + PY * 2
  const totalW = NOSE + totalRowsLen + TAIL + 20
  const totalH = fH + 36
  const cY = totalH / 2
  const fR = fH / 2
  const bL = NOSE - 6
  const bR = NOSE + totalRowsLen + 14

  // Build elements
  const elements: React.ReactElement[] = []
  let curX = NOSE + 10

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]
    const sW = sec.rows * (SH + ROW_GAP)

    elements.push(
      <G key={`l-${si}`}>
        <Line
          x1={curX} y1={cY - fR - 6}
          x2={curX + sW - ROW_GAP} y2={cY - fR - 6}
          stroke={sec.color} strokeWidth={1.5} opacity={0.5}
        />
        <SvgText
          x={curX + (sW - ROW_GAP) / 2} y={cY - fR - 13}
          textAnchor="middle" fontSize={8} fontWeight="700" fill={sec.color}
        >
          {sec.name}
        </SvgText>
      </G>
    )

    const fbFullRows = Math.floor(sec.seats / sec.seatsPerRow)
    const fbRemainder = sec.seats % sec.seatsPerRow
    let fbLastRowActive: boolean[] = []
    if (fbRemainder > 0 && sec.layout.length >= 2) {
      let rem = fbRemainder
      const gFill = sec.layout.map(() => 0)
      while (rem > 0) {
        for (let gi = 0; gi < sec.layout.length && rem > 0; gi++) {
          if (gFill[gi] < sec.layout[gi]) { gFill[gi]++; rem-- }
        }
      }
      for (let gi = 0; gi < sec.layout.length; gi++) {
        const gs = sec.layout[gi], f = gFill[gi], off = Math.floor((gs - f) / 2)
        for (let s = 0; s < gs; s++) fbLastRowActive.push(s >= off && s < off + f)
      }
    }

    for (let row = 0; row < sec.rows; row++) {
      const rX = curX + row * (SH + ROW_GAP)
      const secW = sec.layout.map(c => c * SW + (c - 1) * SEAT_GAP).reduce((a, b) => a + b, 0) + (sec.layout.length - 1) * AISLE_W
      let sY = cY - secW / 2
      let flatIdx = 0
      for (let g = 0; g < sec.layout.length; g++) {
        for (let s = 0; s < sec.layout[g]; s++) {
          const isLastPartial = row === fbFullRows && fbRemainder > 0
          const active = row < fbFullRows ? true : isLastPartial ? (fbLastRowActive[flatIdx] ?? false) : false
          flatIdx++
          const bw = Math.round(SH * 0.3)
          elements.push(
            <G key={`s-${si}-${row}-${g}-${s}`} opacity={active ? 1 : 0.2}>
              <Rect x={rX} y={sY} width={SH} height={SW} rx={1.5}
                fill={sec.color} opacity={0.18} stroke={sec.color} strokeWidth={0.5} />
              <Rect x={rX + 0.5} y={sY + 0.5} width={bw} height={SW - 1}
                rx={1.5} fill={sec.color} opacity={0.45} />
            </G>
          )
          sY += SW + SEAT_GAP
        }
        if (g < sec.layout.length - 1) sY += AISLE_W - SEAT_GAP
      }
    }
    curX += sW
    if (si < sections.length - 1) curX += CABIN_GAP
  }

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <Svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        style={{ aspectRatio: totalW / totalH, maxHeight: 200 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <Rect
          x={bL} y={cY - fR} width={bR - bL} height={fH}
          rx={fR} fill={borderColor} opacity={0.15}
        />
        <Path
          d={`M ${bL + fR} ${cY - fR} C ${bL - 4} ${cY - fR}, 18 ${cY - fR * 0.55}, 6 ${cY} C 18 ${cY + fR * 0.55}, ${bL - 4} ${cY + fR}, ${bL + fR} ${cY + fR} Z`}
          fill={borderColor} opacity={0.15}
        />
        {elements}
      </Svg>
    </View>
  )
}

// ── Build seat SVG elements for image-overlay mode ──

function buildSeatElements(
  sections: CabinSection[],
  opts: {
    PAD: number; seatH: number; seatW: number; maxAbreast: number; svgH: number
    getRowGap: (seatsPerRow: number) => number
  }
) {
  const { PAD, seatH, seatW, maxAbreast, svgH, getRowGap } = opts
  const elements: React.ReactElement[] = []
  let curX = PAD

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]
    const secAbreast = sec.seatsPerRow
    const secAisleCount = sec.layout.length - 1
    const secAisleTotal = secAisleCount * AISLE_W
    const maxSeatW = seatW * 1.3
    const rawSeatW = (svgH - PAD * 2 - secAisleTotal - (secAbreast - 1) * SEAT_GAP) / secAbreast
    const secSeatW = Math.min(rawSeatW, maxSeatW)

    const usedH = secAbreast * secSeatW + (secAbreast - 1) * SEAT_GAP + secAisleTotal
    const extraGap = (svgH - PAD * 2 - usedH) / Math.max(1, secAbreast - 1 + secAisleCount)
    const secSeatGap = SEAT_GAP + extraGap
    const secAisleW = AISLE_W + extraGap

    const secRowGap = getRowGap(sec.seatsPerRow)
    const secSeatH = sec.seatsPerRow <= 2 ? seatH * 1.2 : seatH

    // Balanced last row
    const fullRows = Math.floor(sec.seats / sec.seatsPerRow)
    const remainder = sec.seats % sec.seatsPerRow
    let lastRowActive: boolean[] = []
    if (remainder > 0 && sec.layout.length >= 2) {
      let remaining = remainder
      const groupFill = sec.layout.map(() => 0)
      while (remaining > 0) {
        for (let gi = 0; gi < sec.layout.length && remaining > 0; gi++) {
          if (groupFill[gi] < sec.layout[gi]) { groupFill[gi]++; remaining-- }
        }
      }
      for (let gi = 0; gi < sec.layout.length; gi++) {
        const groupSize = sec.layout[gi]
        const filled = groupFill[gi]
        const startOffset = Math.floor((groupSize - filled) / 2)
        for (let s = 0; s < groupSize; s++) {
          lastRowActive.push(s >= startOffset && s < startOffset + filled)
        }
      }
    }

    for (let row = 0; row < sec.rows; row++) {
      const rowX = curX + row * (secSeatH + secRowGap)
      const totalUsed = secAbreast * secSeatW + (secAbreast - 1) * secSeatGap + secAisleCount * (secAisleW - secSeatGap)
      let seatY = (svgH - totalUsed) / 2

      let flatIdx = 0
      for (let g = 0; g < sec.layout.length; g++) {
        for (let s = 0; s < sec.layout[g]; s++) {
          const isLastPartialRow = row === fullRows && remainder > 0
          const isActive = row < fullRows
            ? true
            : isLastPartialRow
              ? (lastRowActive[flatIdx] ?? false)
              : false
          flatIdx++
          const seatBackW = Math.round(secSeatH * 0.3)

          elements.push(
            <G key={`seat-${si}-${row}-${g}-${s}`} opacity={isActive ? 1 : 0.12}>
              <Rect x={rowX} y={seatY} width={secSeatH} height={secSeatW}
                rx={1.2} fill={sec.color} opacity={0.2} stroke={sec.color} strokeWidth={0.4} />
              <Rect x={rowX + 0.4} y={seatY + 0.4} width={seatBackW} height={secSeatW - 0.8}
                rx={0.8} fill={sec.color} opacity={0.5} />
              <Rect x={rowX + seatBackW + 0.4} y={seatY}
                width={secSeatH - seatBackW - 1} height={0.6} rx={0.3} fill={sec.color} opacity={0.3} />
              <Rect x={rowX + seatBackW + 0.4} y={seatY + secSeatW - 0.6}
                width={secSeatH - seatBackW - 1} height={0.6} rx={0.3} fill={sec.color} opacity={0.3} />
            </G>
          )
          seatY += secSeatW + secSeatGap
        }
        if (g < sec.layout.length - 1) {
          seatY += secAisleW - secSeatGap
        }
      }
    }

    curX += sec.rows * (secSeatH + secRowGap)
    if (si < sections.length - 1) curX += CABIN_GAP
  }

  return elements
}
