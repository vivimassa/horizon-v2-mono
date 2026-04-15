export type AircraftClass = 'regional' | 'twin-narrow' | 'twin-wide' | 'quad'

// Exact-match sets. Include both ICAO doc 8643 codes (e.g. A388, A359) and
// the family-level codes operators commonly store (A380, A350, A330).
const QUAD = new Set([
  // A340 family
  'A340',
  'A342',
  'A343',
  'A345',
  'A346',
  // A380 family
  'A380',
  'A388',
  'A389',
  // 747 family
  'B747',
  'B741',
  'B742',
  'B743',
  'B744',
  'B748',
  'B74R',
  'B74S',
  'IL76',
  'IL96',
])

const TWIN_WIDE = new Set([
  // A300/A310
  'A300',
  'A306',
  'A30B',
  'A310',
  // A330 family
  'A330',
  'A332',
  'A333',
  'A338',
  'A339',
  // A350 family
  'A350',
  'A359',
  'A35K',
  // 767
  'B767',
  'B762',
  'B763',
  'B764',
  // 777
  'B777',
  'B772',
  'B773',
  'B77L',
  'B77W',
  'B778',
  'B779',
  // 787
  'B787',
  'B788',
  'B789',
  'B78X',
  'IL86',
  'IL62',
])

const REGIONAL = new Set([
  // ATR
  'AT43',
  'AT45',
  'AT46',
  'AT72',
  'AT75',
  'AT76',
  'ATP',
  'ATR',
  // CRJ
  'CRJ',
  'CRJ1',
  'CRJ2',
  'CRJ7',
  'CRJ9',
  'CRJX',
  // Dash-8
  'DH8A',
  'DH8B',
  'DH8C',
  'DH8D',
  'DHC6',
  'DHC7',
  'DHC8',
  'DH8',
  // Embraer regional
  'E135',
  'E140',
  'E145',
  'E170',
  'E175',
  'E190',
  'E195',
  'E290',
  'E295',
  'E75L',
  'E75S',
  // Other regionals / turboprops
  'SF34',
  'SF50',
  'SU95',
  'J41',
  'JS31',
  'JS32',
  'JS41',
  'F50',
  'F70',
  'F100',
  'BE20',
  'BE40',
  'BE99',
])

/**
 * Classify an aircraft by ICAO type code. Accepts either strict ICAO doc
 * 8643 codes (A388, A359) or family-level codes operators often store
 * (A380, A350, A330). Falls back to a prefix match for anything unknown,
 * so a misspelled/new variant is still assigned sanely.
 */
export function classifyAircraft(icao: string | undefined | null): AircraftClass {
  if (!icao) return 'twin-narrow'
  const code = icao.toUpperCase().trim()

  if (QUAD.has(code)) return 'quad'
  if (TWIN_WIDE.has(code)) return 'twin-wide'
  if (REGIONAL.has(code)) return 'regional'

  // Prefix-based fallback — covers variants we haven't enumerated.
  // Quads first (most specific).
  if (code.startsWith('A38') || code.startsWith('A34')) return 'quad'
  if (code.startsWith('B74')) return 'quad'

  // Widebodies.
  if (code.startsWith('A30') || code.startsWith('A31') || code.startsWith('A33') || code.startsWith('A35'))
    return 'twin-wide'
  if (code.startsWith('B76') || code.startsWith('B77') || code.startsWith('B78')) return 'twin-wide'

  // Regionals.
  if (
    code.startsWith('AT') ||
    code.startsWith('CRJ') ||
    code.startsWith('DH') ||
    code.startsWith('E1') ||
    code.startsWith('E2') ||
    code.startsWith('E7') ||
    code.startsWith('ER')
  )
    return 'regional'

  // Narrowbody default covers A32x/A22x/B73x/B72x/B71x/MD8x/etc.
  return 'twin-narrow'
}

export const AIRCRAFT_CLASSES: AircraftClass[] = ['regional', 'twin-narrow', 'twin-wide', 'quad']

export const CLASS_SVG_PATH: Record<AircraftClass, string> = {
  regional: '/aircraft/regional.svg',
  'twin-narrow': '/aircraft/twin-narrow.svg',
  'twin-wide': '/aircraft/twin-wide.svg',
  quad: '/aircraft/quad.svg',
}

/** Mapbox icon-size per class. Tuned so A380 reads ~2× an ATR visually. */
export const CLASS_ICON_SIZE: Record<AircraftClass, number> = {
  regional: 0.14,
  'twin-narrow': 0.2,
  'twin-wide': 0.28,
  quad: 0.34,
}
