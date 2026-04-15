// ─── World Map types & pure helpers ──────────────────────────────

export interface WorldMapFlight {
  id: string
  scheduledFlightId: string
  flightNumber: string
  depStation: string
  arrStation: string
  depLat: number
  depLng: number
  arrLat: number
  arrLng: number
  stdUtc: string // HH:MM
  staUtc: string // HH:MM
  blockMinutes: number
  status: string
  aircraftTypeIcao: string | null
  tailNumber: string | null
  flightPhase: string | null
  actualOut: string | null
  actualOff: string | null
  actualOn: string | null
  actualIn: string | null
  instanceDate: string // YYYY-MM-DD
  paxTotal: number
  loadFactor: number | null
  fuelData: Record<string, number>
  cargoData: Record<string, number>
}

export type KpiMode = 'otp' | 'fuel' | 'tat' | 'loadfactor'

export interface OtpKpi {
  totalCompleted: number
  onTimeCount: number
  delay15to30: number
  delay30to60: number
  delay60plus: number
  otpPercent: number
  avgDelayMinutes: number
  worstDelayFlight: { flightNumber: string; minutes: number } | null
}

export interface FuelKpi {
  planVsActualPct: number
  avgUpliftKg: number
  overBurnCount: number
  totalFlightsWithFuel: number
  burnByType: { acType: string; avgBurn: number; avgPlan: number }[]
}

export interface TatKpi {
  avgGroundMinutes: number
  breachCount: number
  distribution: { label: string; count: number }[]
  worstTat: { station: string; minutes: number; flightNumber: string } | null
  hasRotationData: boolean
}

export interface LoadFactorKpi {
  fleetAvgLf: number
  lfByType: { acType: string; avgLf: number; count: number }[]
  below80Count: number
  above95Count: number
  totalRevenuePax: number
}

export interface WorldMapAirport {
  iataCode: string
  name: string
  lat: number
  lng: number
  isHub: boolean
}

export interface FlightPosition {
  id: string
  lng: number
  lat: number
  bearing: number
  progress: number
  flight: WorldMapFlight
}

export interface MapFilter {
  aircraftTypes: string[]
  statuses: string[]
  tailSearch: string
}

export const EMPTY_FILTER: MapFilter = {
  aircraftTypes: [],
  statuses: [],
  tailSearch: '',
}

export type MapStyleKey = 'auto' | 'light' | 'dark' | 'streets' | 'satellite' | 'outdoors'

export interface MapStyleOption {
  key: MapStyleKey
  label: string
  url: string
  urlDark?: string
  darkFog: boolean | 'auto'
}

export const MAP_STYLES: MapStyleOption[] = [
  {
    key: 'auto',
    label: 'Auto (Theme)',
    url: 'mapbox://styles/mapbox/light-v11',
    urlDark: 'mapbox://styles/mapbox/dark-v11',
    darkFog: 'auto',
  },
  { key: 'light', label: 'Light', url: 'mapbox://styles/mapbox/light-v11', darkFog: false },
  { key: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11', darkFog: true },
  { key: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12', darkFog: false },
  { key: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12', darkFog: true },
  { key: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12', darkFog: false },
]

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

export function interpolateGreatCircle(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
  t: number,
): [number, number, number] {
  const φ1 = lat1 * DEG,
    λ1 = lng1 * DEG
  const φ2 = lat2 * DEG,
    λ2 = lng2 * DEG

  const dφ = φ2 - φ1
  const dλ = λ2 - λ1

  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  if (d < 1e-10) return [lng1, lat1, 0]

  const A = Math.sin((1 - t) * d) / Math.sin(d)
  const B = Math.sin(t * d) / Math.sin(d)

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
  const z = A * Math.sin(φ1) + B * Math.sin(φ2)

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD
  const lng = Math.atan2(y, x) * RAD

  const φC = lat * DEG
  const λC = lng * DEG

  const bearing =
    Math.atan2(
      Math.sin(λ2 - λC) * Math.cos(φ2),
      Math.cos(φC) * Math.sin(φ2) - Math.sin(φC) * Math.cos(φ2) * Math.cos(λ2 - λC),
    ) * RAD

  return [lng, lat, bearing]
}

export function sampleArc(lng1: number, lat1: number, lng2: number, lat2: number, segments = 40): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const [lng, lat] = interpolateGreatCircle(lng1, lat1, lng2, lat2, i / segments)
    pts.push([lng, lat])
  }
  return pts
}

function hhmmToTimestamp(hhmm: string | null, instanceDate: string): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(instanceDate + 'T00:00:00Z')
  d.setUTCHours(h, m, 0, 0)
  return d.getTime()
}

export function computeFlightProgress(f: WorldMapFlight, now: Date): number {
  const todayStr = f.instanceDate

  const offTs =
    hhmmToTimestamp(f.actualOff, todayStr) ||
    hhmmToTimestamp(f.actualOut, todayStr) ||
    hhmmToTimestamp(f.stdUtc, todayStr)
  const onTs =
    hhmmToTimestamp(f.actualOn, todayStr) ||
    hhmmToTimestamp(f.actualIn, todayStr) ||
    hhmmToTimestamp(f.staUtc, todayStr)

  if (!offTs || !onTs) return 0
  let adjOnTs = onTs
  if (onTs <= offTs) adjOnTs += 24 * 60 * 60 * 1000

  const nowTs = now.getTime()
  if (nowTs <= offTs) return 0
  // Flight has actually landed: snap to destination.
  if (f.actualIn || f.actualOn) {
    if (nowTs >= adjOnTs) return 1
  } else if (nowTs >= adjOnTs) {
    // In-flight but past scheduled arrival (running late). Clamp near
    // destination so the aircraft stays on the map instead of vanishing.
    return 0.99
  }

  return (nowTs - offTs) / (adjOnTs - offTs)
}

export function getFlightMapStatus(
  f: WorldMapFlight,
  now?: Date,
): 'airborne' | 'ground' | 'completed' | 'scheduled' | 'delayed' {
  const phase = f.flightPhase
  // ATA received = aircraft on ground at destination.
  if (phase === 'arrived' || f.actualIn) return 'ground'
  // Wheels on — taxi-in before ATA.
  if (phase === 'landing' || f.actualOn) return 'ground'
  if (phase === 'airborne' || phase === 'departed' || f.actualOff) {
    if (!f.actualIn && now && f.staUtc) {
      const [sh, sm] = f.staUtc.split(':').map(Number)
      const sta = new Date(f.instanceDate + 'T00:00:00Z')
      sta.setUTCHours(sh, sm + 15, 0, 0)
      if (f.stdUtc) {
        const [dh, dm] = f.stdUtc.split(':').map(Number)
        const std = new Date(f.instanceDate + 'T00:00:00Z')
        std.setUTCHours(dh, dm, 0, 0)
        if (sta.getTime() <= std.getTime()) sta.setUTCDate(sta.getUTCDate() + 1)
      }
      if (now.getTime() > sta.getTime()) return 'delayed'
    }
    return 'airborne'
  }
  if (phase === 'boarding' || f.actualOut) {
    if (!f.actualIn && now && f.staUtc && f.actualOut) {
      const [sh, sm] = f.staUtc.split(':').map(Number)
      const sta = new Date(f.instanceDate + 'T00:00:00Z')
      sta.setUTCHours(sh, sm + 15, 0, 0)
      const outTs = new Date(f.instanceDate + 'T00:00:00Z')
      const [oh, om] = f.actualOut.split(':').map(Number)
      outTs.setUTCHours(oh, om, 0, 0)
      if (sta.getTime() <= outTs.getTime()) sta.setUTCDate(sta.getUTCDate() + 1)
      if (now.getTime() > sta.getTime()) return 'delayed'
    }
    return 'ground'
  }

  // No actual OOOI data — flight has not yet reported pushback. Always
  // 'scheduled', regardless of where the current UTC time sits in the
  // schedule window. Inferring airborne from the schedule alone would
  // inflate the airborne count with flights that never actually departed.
  return 'scheduled'
}
