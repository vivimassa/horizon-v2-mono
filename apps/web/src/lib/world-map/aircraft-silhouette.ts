/**
 * Parametric top-down aircraft silhouette generator.
 *
 * Given real-world dimensions (wingspan, fuselage length, sweep angle,
 * engine count & position), emits an SVG string keyed to a 256×256 canvas
 * at 3 px/meter. That keeps the A380 (80m span → 240px) fitting the canvas
 * while an ATR72 (27m → 81px) reads as visibly smaller at the same zoom.
 *
 * The Mapbox symbol layer rasterizes and tints these via the existing
 * icon pipeline. Output fills white; color is applied downstream.
 */

export interface AircraftShape {
  /** Wingspan in meters. */
  wingspan: number
  /** Fuselage length in meters. */
  length: number
  /** Fuselage diameter/width in meters (top-down projection). */
  fuselageWidth: number

  /** Wing leading-edge root position, 0..1 along fuselage from nose. */
  wingRootPosition: number
  /** Wing chord at root, in meters. */
  wingChordRoot: number
  /** Wing chord at tip, in meters. */
  wingChordTip: number
  /** Leading-edge sweep angle in degrees (e.g. A320=25, A380=33.5). */
  wingSweepDeg: number

  /** Horizontal stabilizer span in meters. */
  stabSpan: number
  /** Stab leading-edge root position, 0..1 from nose. */
  stabRootPosition: number
  stabChordRoot: number
  stabChordTip: number
  stabSweepDeg: number

  /** Engine count (2 twins, 4 quads). Must equal engineOffsets.length * 2. */
  engineCount: 2 | 4
  /**
   * Right-wing engine lateral offsets from centerline in meters. Left wing
   * is mirrored. Twin = [5.75]. Quad = [inner, outer] e.g. [8.8, 18.7].
   */
  engineOffsets: number[]
  /**
   * Engine position along fuselage, 0..1 from nose. Only used when
   * engineMount === 'rear' (rear-fuselage engines like CRJ). For wing
   * mounts, each engine's Y is computed dynamically from the wing's
   * leading edge at its lateral offset, so inner engines on a quad don't
   * get swallowed by the wing root.
   */
  enginePosition: number
  /** Engine nacelle length (meters). */
  engineLength: number
  /** Engine nacelle diameter (meters). */
  engineDiameter: number
  /** Where engines attach. Default 'wing'. */
  engineMount?: 'wing' | 'rear'

  /** Turboprop — nacelle + translucent prop disc instead of long nacelle. */
  turboprop?: boolean
}

const PX_PER_METER = 3
const CANVAS = 256
const CX = CANVAS / 2
const CY = CANVAS / 2

function n(v: number): string {
  return v.toFixed(2)
}

export function generateAircraftSvg(s: AircraftShape): string {
  const halfLen = (s.length * PX_PER_METER) / 2
  const halfSpan = (s.wingspan * PX_PER_METER) / 2
  const fuseW = (s.fuselageWidth * PX_PER_METER) / 2 // half-width

  const noseY = CY - halfLen
  const tailY = CY + halfLen

  // ── Fuselage — smooth tube with rounded nose, slight taper at tail ──
  const neckY = noseY + halfLen * 0.05
  const bodyStartY = noseY + halfLen * 0.1
  const bodyEndY = tailY - halfLen * 0.06
  const fuselagePath = [
    `M ${n(CX)} ${n(noseY)}`,
    `C ${n(CX - fuseW * 0.55)} ${n(noseY)} ${n(CX - fuseW)} ${n(neckY)} ${n(CX - fuseW)} ${n(bodyStartY)}`,
    `L ${n(CX - fuseW)} ${n(bodyEndY)}`,
    `C ${n(CX - fuseW)} ${n(tailY - halfLen * 0.01)} ${n(CX - fuseW * 0.35)} ${n(tailY)} ${n(CX)} ${n(tailY)}`,
    `C ${n(CX + fuseW * 0.35)} ${n(tailY)} ${n(CX + fuseW)} ${n(tailY - halfLen * 0.01)} ${n(CX + fuseW)} ${n(bodyEndY)}`,
    `L ${n(CX + fuseW)} ${n(bodyStartY)}`,
    `C ${n(CX + fuseW)} ${n(neckY)} ${n(CX + fuseW * 0.55)} ${n(noseY)} ${n(CX)} ${n(noseY)}`,
    'Z',
  ].join(' ')

  // ── Main wings ──
  const wingRootY = noseY + halfLen * 2 * s.wingRootPosition
  const wingLeRootY = wingRootY - s.wingChordRoot * PX_PER_METER * 0.35
  const wingTeRootY = wingRootY + s.wingChordRoot * PX_PER_METER * 0.65
  const sweepRad = (s.wingSweepDeg * Math.PI) / 180
  const tipDy = halfSpan * Math.tan(sweepRad)
  const wingLeTipY = wingLeRootY + tipDy
  const wingTeTipY = wingLeTipY + s.wingChordTip * PX_PER_METER

  const wingPath = (side: 1 | -1) => {
    const rootX = CX + side * fuseW
    const tipX = CX + side * (halfSpan - 1)
    const tipOuterX = CX + side * halfSpan
    return [
      `M ${n(rootX)} ${n(wingLeRootY)}`,
      `L ${n(tipX)} ${n(wingLeTipY)}`,
      `Q ${n(tipOuterX)} ${n((wingLeTipY + wingTeTipY) / 2)} ${n(tipX)} ${n(wingTeTipY)}`,
      `L ${n(rootX)} ${n(wingTeRootY)}`,
      'Z',
    ].join(' ')
  }

  // ── Horizontal stabilizers ──
  const stabRootY = noseY + halfLen * 2 * s.stabRootPosition
  const stabLeRootY = stabRootY - s.stabChordRoot * PX_PER_METER * 0.3
  const stabTeRootY = stabRootY + s.stabChordRoot * PX_PER_METER * 0.7
  const stabHalfSpan = (s.stabSpan * PX_PER_METER) / 2
  const stabSweepRad = (s.stabSweepDeg * Math.PI) / 180
  const stabTipDy = stabHalfSpan * Math.tan(stabSweepRad)
  const stabLeTipY = stabLeRootY + stabTipDy
  const stabTeTipY = stabLeTipY + s.stabChordTip * PX_PER_METER

  const stabPath = (side: 1 | -1) => {
    const rootX = CX + side * fuseW * 0.7
    const tipX = CX + side * (stabHalfSpan - 1)
    const tipOuterX = CX + side * stabHalfSpan
    return [
      `M ${n(rootX)} ${n(stabLeRootY)}`,
      `L ${n(tipX)} ${n(stabLeTipY)}`,
      `Q ${n(tipOuterX)} ${n((stabLeTipY + stabTeTipY) / 2)} ${n(tipX)} ${n(stabTeTipY)}`,
      `L ${n(rootX)} ${n(stabTeRootY)}`,
      'Z',
    ].join(' ')
  }

  // ── Engines ──
  const engineHalfLen = (s.engineLength * PX_PER_METER) / 2
  const engineHalfDia = (s.engineDiameter * PX_PER_METER) / 2
  const mount = s.engineMount ?? 'wing'
  const rearY = noseY + halfLen * 2 * s.enginePosition

  // For wing mounts, compute the wing's leading-edge Y at a given lateral
  // offset (linear interpolation between root and tip), then place the
  // engine so it straddles the leading edge: ~50% of the nacelle pokes
  // forward of the wing, ~50% sits inside the wing planform. This keeps
  // every engine visible, including the inner pair on a quad.
  const wingLeAtX = (offsetPx: number): number => {
    const span = halfSpan - fuseW
    if (span <= 0) return wingLeRootY
    const f = Math.min(1, Math.max(0, (offsetPx - fuseW) / span))
    return wingLeRootY + f * (wingLeTipY - wingLeRootY)
  }

  const engineShape = (cx: number, cy: number): string => {
    const nacelle = `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(engineHalfDia)}" ry="${n(engineHalfLen)}"/>`
    if (s.turboprop) {
      const propCy = cy - engineHalfLen - 1.5
      const prop = `<circle cx="${n(cx)}" cy="${n(propCy)}" r="${n(engineHalfDia * 2.4)}" fill-opacity="0.35"/>`
      return nacelle + prop
    }
    return nacelle
  }

  const engines = s.engineOffsets
    .flatMap((meters) => {
      const offsetPx = meters * PX_PER_METER
      const cy = mount === 'rear' ? rearY : wingLeAtX(offsetPx)
      return [engineShape(CX - offsetPx, cy), engineShape(CX + offsetPx, cy)]
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}"><g fill="#ffffff"><path d="${fuselagePath}"/><path d="${wingPath(1)}"/><path d="${wingPath(-1)}"/><path d="${stabPath(1)}"/><path d="${stabPath(-1)}"/>${engines}</g></svg>`
}

// ── Shape registry ──────────────────────────────────────────────
//
// Dimensions pulled from manufacturer type certificates / Jane's. Where a
// range exists (variants with different lengths), we pick the most common
// mainline variant. Aliases map other variants to the closest base shape.

export const AIRCRAFT_SHAPES: Record<string, AircraftShape> = {
  A320: {
    wingspan: 35.8,
    length: 37.57,
    fuselageWidth: 3.95,
    wingRootPosition: 0.43,
    wingChordRoot: 7.0,
    wingChordTip: 1.5,
    wingSweepDeg: 25,
    stabSpan: 12.45,
    stabRootPosition: 0.9,
    stabChordRoot: 4.0,
    stabChordTip: 1.5,
    stabSweepDeg: 29,
    engineCount: 2,
    engineOffsets: [5.75],
    enginePosition: 0.4,
    engineLength: 4.2,
    engineDiameter: 2.37,
  },
  A321: {
    wingspan: 35.8,
    length: 44.51,
    fuselageWidth: 3.95,
    wingRootPosition: 0.4,
    wingChordRoot: 7.0,
    wingChordTip: 1.5,
    wingSweepDeg: 25,
    stabSpan: 12.45,
    stabRootPosition: 0.91,
    stabChordRoot: 4.0,
    stabChordTip: 1.5,
    stabSweepDeg: 29,
    engineCount: 2,
    engineOffsets: [5.75],
    enginePosition: 0.38,
    engineLength: 4.2,
    engineDiameter: 2.37,
  },
  A330: {
    wingspan: 60.3,
    length: 63.66,
    fuselageWidth: 5.64,
    wingRootPosition: 0.42,
    wingChordRoot: 10.8,
    wingChordTip: 2.3,
    wingSweepDeg: 30,
    stabSpan: 19.4,
    stabRootPosition: 0.9,
    stabChordRoot: 6.0,
    stabChordTip: 2.0,
    stabSweepDeg: 32,
    engineCount: 2,
    engineOffsets: [10.1],
    enginePosition: 0.41,
    engineLength: 6.0,
    engineDiameter: 3.24,
  },
  A350: {
    wingspan: 64.75,
    length: 66.89,
    fuselageWidth: 5.96,
    wingRootPosition: 0.42,
    wingChordRoot: 11.0,
    wingChordTip: 2.3,
    wingSweepDeg: 31.9,
    stabSpan: 20.0,
    stabRootPosition: 0.89,
    stabChordRoot: 6.3,
    stabChordTip: 2.0,
    stabSweepDeg: 33,
    engineCount: 2,
    engineOffsets: [10.5],
    enginePosition: 0.42,
    engineLength: 6.14,
    engineDiameter: 3.0,
  },
  A380: {
    wingspan: 79.75,
    length: 72.72,
    fuselageWidth: 7.14,
    wingRootPosition: 0.42,
    wingChordRoot: 16.0,
    wingChordTip: 3.8,
    wingSweepDeg: 33.5,
    stabSpan: 30.37,
    stabRootPosition: 0.9,
    stabChordRoot: 9.5,
    stabChordTip: 3.0,
    stabSweepDeg: 34,
    engineCount: 4,
    engineOffsets: [8.8, 18.7],
    enginePosition: 0.43,
    engineLength: 5.5,
    engineDiameter: 2.95,
  },
  B737: {
    wingspan: 35.79,
    length: 39.47,
    fuselageWidth: 3.76,
    wingRootPosition: 0.44,
    wingChordRoot: 7.4,
    wingChordTip: 1.5,
    wingSweepDeg: 25,
    stabSpan: 14.35,
    stabRootPosition: 0.9,
    stabChordRoot: 4.5,
    stabChordTip: 1.5,
    stabSweepDeg: 30,
    engineCount: 2,
    engineOffsets: [5.3],
    enginePosition: 0.41,
    engineLength: 3.9,
    engineDiameter: 2.05,
  },
  B747: {
    wingspan: 64.4,
    length: 70.67,
    fuselageWidth: 6.5,
    wingRootPosition: 0.42,
    wingChordRoot: 13.0,
    wingChordTip: 3.5,
    wingSweepDeg: 37.5,
    stabSpan: 22.17,
    stabRootPosition: 0.9,
    stabChordRoot: 7.0,
    stabChordTip: 2.5,
    stabSweepDeg: 38,
    engineCount: 4,
    engineOffsets: [6.6, 14.8],
    enginePosition: 0.42,
    engineLength: 5.3,
    engineDiameter: 2.5,
  },
  B777: {
    wingspan: 64.8,
    length: 73.86,
    fuselageWidth: 6.2,
    wingRootPosition: 0.42,
    wingChordRoot: 12.0,
    wingChordTip: 3.0,
    wingSweepDeg: 31.6,
    stabSpan: 21.53,
    stabRootPosition: 0.9,
    stabChordRoot: 6.5,
    stabChordTip: 2.0,
    stabSweepDeg: 33,
    engineCount: 2,
    engineOffsets: [10.8],
    enginePosition: 0.42,
    engineLength: 7.3,
    engineDiameter: 3.4,
  },
  B787: {
    wingspan: 60.12,
    length: 62.81,
    fuselageWidth: 5.77,
    wingRootPosition: 0.42,
    wingChordRoot: 11.0,
    wingChordTip: 2.5,
    wingSweepDeg: 32.2,
    stabSpan: 19.5,
    stabRootPosition: 0.89,
    stabChordRoot: 6.0,
    stabChordTip: 2.0,
    stabSweepDeg: 33,
    engineCount: 2,
    engineOffsets: [10.2],
    enginePosition: 0.42,
    engineLength: 6.9,
    engineDiameter: 3.25,
  },
  AT72: {
    wingspan: 27.05,
    length: 27.17,
    fuselageWidth: 2.87,
    wingRootPosition: 0.3,
    wingChordRoot: 2.5,
    wingChordTip: 1.5,
    wingSweepDeg: 3,
    stabSpan: 7.65,
    stabRootPosition: 0.93,
    stabChordRoot: 2.2,
    stabChordTip: 1.0,
    stabSweepDeg: 8,
    engineCount: 2,
    engineOffsets: [4.1],
    enginePosition: 0.3,
    engineLength: 2.5,
    engineDiameter: 1.0,
    turboprop: true,
  },
  CRJ9: {
    wingspan: 24.85,
    length: 36.2,
    fuselageWidth: 2.69,
    wingRootPosition: 0.52,
    wingChordRoot: 3.5,
    wingChordTip: 1.2,
    wingSweepDeg: 25,
    stabSpan: 8.5,
    stabRootPosition: 0.97,
    stabChordRoot: 2.0,
    stabChordTip: 0.8,
    stabSweepDeg: 25,
    engineCount: 2,
    engineOffsets: [2.1],
    enginePosition: 0.78,
    engineLength: 3.3,
    engineDiameter: 1.4,
    engineMount: 'rear',
  },
  E190: {
    wingspan: 28.72,
    length: 36.24,
    fuselageWidth: 3.01,
    wingRootPosition: 0.44,
    wingChordRoot: 4.2,
    wingChordTip: 1.5,
    wingSweepDeg: 22,
    stabSpan: 11.24,
    stabRootPosition: 0.9,
    stabChordRoot: 3.5,
    stabChordTip: 1.5,
    stabSweepDeg: 28,
    engineCount: 2,
    engineOffsets: [5.1],
    enginePosition: 0.42,
    engineLength: 3.7,
    engineDiameter: 1.85,
  },
}

// ── ICAO → base shape aliases ───────────────────────────────────

const AIRCRAFT_ALIASES: Record<string, keyof typeof AIRCRAFT_SHAPES> = {
  // A320 family
  A318: 'A320',
  A319: 'A320',
  A20N: 'A320',
  A21N: 'A321',
  // A330 family
  A332: 'A330',
  A333: 'A330',
  A338: 'A330',
  A339: 'A330',
  A306: 'A330',
  A30B: 'A330',
  A310: 'A330',
  // A350
  A359: 'A350',
  A35K: 'A350',
  // A380
  A388: 'A380',
  A389: 'A380',
  // A340 (shape-wise close enough to a quad; use A380 params scaled down would be ideal,
  // but bucketing with B747 is a reasonable approximation until a dedicated shape is added)
  A340: 'B747',
  A342: 'B747',
  A343: 'B747',
  A345: 'B747',
  A346: 'B747',
  // 737
  B736: 'B737',
  B738: 'B737',
  B739: 'B737',
  B37M: 'B737',
  B38M: 'B737',
  B39M: 'B737',
  B3XM: 'B737',
  B703: 'B737',
  B712: 'B737',
  B722: 'B737',
  B727: 'B737',
  // 747
  B741: 'B747',
  B742: 'B747',
  B743: 'B747',
  B744: 'B747',
  B748: 'B747',
  B74R: 'B747',
  B74S: 'B747',
  // 777
  B772: 'B777',
  B773: 'B777',
  B77W: 'B777',
  B77L: 'B777',
  B778: 'B777',
  B779: 'B777',
  // 787
  B788: 'B787',
  B789: 'B787',
  B78X: 'B787',
  // 767 — treat as narrower twinjet similar to B787
  B762: 'B787',
  B763: 'B787',
  B764: 'B787',
  // ATR / Dash
  AT43: 'AT72',
  AT45: 'AT72',
  AT46: 'AT72',
  AT75: 'AT72',
  AT76: 'AT72',
  ATR: 'AT72',
  DH8A: 'AT72',
  DH8B: 'AT72',
  DH8C: 'AT72',
  DH8D: 'AT72',
  DHC6: 'AT72',
  DHC7: 'AT72',
  DHC8: 'AT72',
  SF34: 'AT72',
  SF50: 'AT72',
  // CRJ
  CRJ: 'CRJ9',
  CRJ1: 'CRJ9',
  CRJ2: 'CRJ9',
  CRJ7: 'CRJ9',
  CRJX: 'CRJ9',
  // Embraer
  E135: 'E190',
  E140: 'E190',
  E145: 'E190',
  E170: 'E190',
  E175: 'E190',
  E195: 'E190',
  E290: 'E190',
  E295: 'E190',
  E75L: 'E190',
  E75S: 'E190',
  // Fokker / others
  F50: 'AT72',
  F70: 'E190',
  F100: 'E190',
  SU95: 'E190',
}

/**
 * Resolve an ICAO type code to its drawing shape. Returns null if there's
 * no registered shape and no alias — caller should fall back to the
 * class-level silhouette in that case.
 */
export function resolveAircraftShape(icao: string | null | undefined): AircraftShape | null {
  if (!icao) return null
  const code = icao.toUpperCase().trim()
  if (AIRCRAFT_SHAPES[code]) return AIRCRAFT_SHAPES[code]
  const alias = AIRCRAFT_ALIASES[code]
  if (alias && AIRCRAFT_SHAPES[alias]) return AIRCRAFT_SHAPES[alias]
  return null
}

/**
 * Icon-size to feed Mapbox when rendering a generated silhouette. Uniform,
 * because the SVG itself encodes the real-world wingspan (3 px/meter), so
 * an A380 is naturally ~3× the pixel footprint of an ATR72.
 */
export const GENERATED_ICON_SIZE = 0.22
