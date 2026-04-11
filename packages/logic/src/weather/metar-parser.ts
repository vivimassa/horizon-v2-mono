// logic/weather/metar-parser.ts

export interface ParsedMetar {
  stationIcao: string
  observedAt: Date
  rawMetar: string
  windDirectionDeg: number | null
  windSpeedKts: number | null
  windGustKts: number | null
  windVariable: boolean
  visibilityMeters: number | null
  ceilingFeet: number | null
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'
  temperatureC: number | null
  dewpointC: number | null
  altimeterHpa: number | null
  weatherPhenomena: string[]
  clouds: { code: string; baseFeet: number | null }[]
  remarks: string | null
}

export function computeFlightCategory(
  ceilingFeet: number | null,
  visibilityMeters: number | null,
): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  const ceil = ceilingFeet ?? 99999
  const vis = visibilityMeters ?? 99999
  if (ceil < 500 || vis < 1600) return 'LIFR'
  if (ceil < 1000 || vis < 5000) return 'IFR'
  if (ceil <= 3000 || vis <= 8000) return 'MVFR'
  return 'VFR'
}

function parseMetarTimestamp(token: string, ref: Date): Date {
  const day = parseInt(token.slice(0, 2), 10)
  const hour = parseInt(token.slice(2, 4), 10)
  const min = parseInt(token.slice(4, 6), 10)
  const d = new Date(ref)
  d.setUTCDate(day)
  d.setUTCHours(hour, min, 0, 0)
  if (d.getTime() > ref.getTime() + 86400000) d.setUTCMonth(d.getUTCMonth() - 1)
  return d
}

function parseWind(token: string) {
  const m = token.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT$/)
  if (!m) return null
  return {
    direction: m[1] === 'VRB' ? null : parseInt(m[1], 10),
    speed: parseInt(m[2], 10),
    gust: m[3] ? parseInt(m[3], 10) : null,
    variable: m[1] === 'VRB',
  }
}

function parseVisibility(token: string): number | null {
  if (/^\d{4}$/.test(token)) return parseInt(token, 10)
  if (token === 'P6SM') return 9999
  const sm = token.match(/^(\d+(?:\/\d+)?)SM$/)
  if (sm) {
    const parts = sm[1].split('/')
    const val = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : parseFloat(sm[1])
    return Math.round(val * 1609.34)
  }
  return null
}

function parseCloud(token: string): { code: string; baseFeet: number | null } | null {
  if (['CLR', 'SKC', 'NCD', 'NSC', 'CAVOK'].includes(token)) return { code: token, baseFeet: null }
  const m = token.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/)
  if (!m) return null
  return { code: m[1], baseFeet: parseInt(m[2], 10) * 100 }
}

function parseTemp(token: string): { temp: number; dewpoint: number } | null {
  const m = token.match(/^(M?\d{1,2})\/(M?\d{1,2})$/)
  if (!m) return null
  const p = (s: string) => (s.startsWith('M') ? -parseInt(s.slice(1), 10) : parseInt(s, 10))
  return { temp: p(m[1]), dewpoint: p(m[2]) }
}

function parseAltimeter(token: string): number | null {
  if (token.startsWith('Q')) return parseInt(token.slice(1), 10)
  if (token.startsWith('A')) return Math.round(parseInt(token.slice(1), 10) * 0.338639)
  return null
}

const WX_CODES = new Set([
  'DZ',
  'RA',
  'SN',
  'SG',
  'IC',
  'PL',
  'GR',
  'GS',
  'UP',
  'BR',
  'FG',
  'FU',
  'VA',
  'DU',
  'SA',
  'HZ',
  'PY',
  'PO',
  'SQ',
  'FC',
  'SS',
  'DS',
  'TS',
  'SH',
  'FZ',
  'MI',
  'PR',
  'BC',
  'DR',
  'BL',
])

function isWeatherPhenomena(token: string): boolean {
  const clean = token.replace(/^[+-]/, '').replace(/^VC/, '')
  for (let i = 0; i < clean.length; i += 2) {
    if (!WX_CODES.has(clean.slice(i, i + 2))) return false
  }
  return clean.length > 0 && clean.length % 2 === 0
}

export function parseMetar(raw: string, referenceDate = new Date()): ParsedMetar {
  const tokens = raw.trim().split(/\s+/)
  let idx = 0

  if (tokens[idx] === 'METAR' || tokens[idx] === 'SPECI') idx++
  const stationIcao = tokens[idx++] || ''
  const observedAt = parseMetarTimestamp(tokens[idx++] || '', referenceDate)
  if (tokens[idx] === 'AUTO' || tokens[idx] === 'COR') idx++

  let windDirectionDeg: number | null = null
  let windSpeedKts: number | null = null
  let windGustKts: number | null = null
  let windVariable = false
  let visibilityMeters: number | null = null
  const weatherPhenomena: string[] = []
  const clouds: { code: string; baseFeet: number | null }[] = []
  let temperatureC: number | null = null
  let dewpointC: number | null = null
  let altimeterHpa: number | null = null
  let remarks: string | null = null

  while (idx < tokens.length) {
    const tok = tokens[idx]
    if (tok === 'RMK') {
      remarks = tokens.slice(idx + 1).join(' ')
      break
    }
    if (tok === 'CAVOK') {
      visibilityMeters = 9999
      clouds.push({ code: 'CAVOK', baseFeet: null })
      idx++
      continue
    }

    const wind = parseWind(tok)
    if (wind) {
      windDirectionDeg = wind.direction
      windSpeedKts = wind.speed
      windGustKts = wind.gust
      windVariable = wind.variable
      idx++
      if (idx < tokens.length && /^\d{3}V\d{3}$/.test(tokens[idx])) idx++
      continue
    }

    const vis = parseVisibility(tok)
    if (vis !== null) {
      visibilityMeters = vis
      idx++
      continue
    }

    if (isWeatherPhenomena(tok)) {
      weatherPhenomena.push(tok)
      idx++
      continue
    }

    const cloud = parseCloud(tok)
    if (cloud) {
      clouds.push(cloud)
      idx++
      continue
    }

    const temp = parseTemp(tok)
    if (temp) {
      temperatureC = temp.temp
      dewpointC = temp.dewpoint
      idx++
      continue
    }

    const alt = parseAltimeter(tok)
    if (alt !== null) {
      altimeterHpa = alt
      idx++
      continue
    }

    idx++
  }

  const ceilingLayer = clouds.find((c) => ['BKN', 'OVC', 'VV'].includes(c.code))
  const ceilingFeet = ceilingLayer?.baseFeet ?? null
  const flightCategory = computeFlightCategory(ceilingFeet, visibilityMeters)

  return {
    stationIcao,
    observedAt,
    rawMetar: raw,
    windDirectionDeg,
    windSpeedKts,
    windGustKts,
    windVariable,
    visibilityMeters,
    ceilingFeet,
    flightCategory,
    temperatureC,
    dewpointC,
    altimeterHpa,
    weatherPhenomena,
    clouds,
    remarks,
  }
}
