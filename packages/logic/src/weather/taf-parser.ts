// logic/weather/taf-parser.ts
// Lightweight header parser — forecast periods come from NOAA JSON API directly

export interface TafPeriod {
  from: string
  to: string
  changeType: string
  windDirectionDeg: number | null
  windSpeedKts: number | null
  windGustKts: number | null
  visibilityMeters: number | null
  ceilingFeet: number | null
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'
  weather: string[]
  clouds: { code: string; baseFeet: number | null }[]
}

export interface ParsedTaf {
  stationIcao: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
  rawTaf: string
  periods: TafPeriod[]
}

export function parseTafHeader(raw: string): {
  stationIcao: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
} | null {
  const m = raw.match(/TAF\s+(?:AMD\s+|COR\s+)?(\w{4})\s+(\d{6})Z\s+(\d{4})\/(\d{4})/)
  if (!m) return null
  const now = new Date()
  const issuedAt = new Date(now)
  issuedAt.setUTCDate(parseInt(m[2].slice(0, 2), 10))
  issuedAt.setUTCHours(parseInt(m[2].slice(2, 4), 10), parseInt(m[2].slice(4, 6), 10), 0, 0)
  const validFrom = new Date(now)
  validFrom.setUTCDate(parseInt(m[3].slice(0, 2), 10))
  validFrom.setUTCHours(parseInt(m[3].slice(2, 4), 10), 0, 0, 0)
  const validTo = new Date(now)
  validTo.setUTCDate(parseInt(m[4].slice(0, 2), 10))
  validTo.setUTCHours(parseInt(m[4].slice(2, 4), 10), 0, 0, 0)
  if (validTo < validFrom) validTo.setUTCMonth(validTo.getUTCMonth() + 1)
  return { stationIcao: m[1], issuedAt, validFrom, validTo }
}
