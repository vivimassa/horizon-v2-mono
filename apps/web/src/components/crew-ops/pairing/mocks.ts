// Mock data for Crew Pairing (4.1.5) while the backend is being built.
// Gets replaced by real fetches through packages/api/src/client.ts once
// server/src/routes/pairings.ts lands.

import type { Pairing, PairingFlight, PairingLegMeta, LegalityCheck, LegalityResult } from './types'

/** Deterministic UTC date shifted by `offsetDays` from today. */
function shiftDate(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/** Build an ISO UTC datetime from `YYYY-MM-DD` + `HH:mm`. */
function utcIso(dateYmd: string, hhmm: string): string {
  return `${dateYmd}T${hhmm}:00.000Z`
}

/** Local datetime display string (drops seconds, matches V1 flight-card format). */
function localDt(dateYmd: string, hhmm: string): string {
  return `${dateYmd}T${hhmm}`
}

/** Factory for a single flight instance. */
function makeFlight(args: {
  scheduledFlightId: string
  instanceDate: string
  flightNumber: string
  dep: string
  arr: string
  depHHmm: string
  arrHHmm: string
  blockMinutes: number
  aircraftType?: string
  tailNumber?: string | null
  rotationId?: string | null
  rotationLabel?: string | null
  serviceType?: string | null
  daysOfWeek?: string | null
  pairingId?: string | null
}): PairingFlight {
  const {
    scheduledFlightId,
    instanceDate,
    flightNumber,
    dep,
    arr,
    depHHmm,
    arrHHmm,
    blockMinutes,
    aircraftType = 'A320',
    tailNumber = null,
    rotationId = null,
    rotationLabel = null,
    serviceType = 'J',
    daysOfWeek = '1111111',
    pairingId = null,
  } = args
  return {
    id: `${scheduledFlightId}__${instanceDate}`,
    scheduledFlightId,
    instanceDate,
    flightNumber,
    departureAirport: dep,
    arrivalAirport: arr,
    std: localDt(instanceDate, depHHmm),
    sta: localDt(instanceDate, arrHHmm),
    stdUtc: utcIso(instanceDate, depHHmm),
    staUtc: utcIso(instanceDate, arrHHmm),
    blockMinutes,
    aircraftType,
    tailNumber,
    rotationId,
    rotationLabel,
    serviceType,
    daysOfWeek,
    departureDayOffset: 1,
    arrivalDayOffset: 1,
    status: 'active',
    effectiveFrom: instanceDate,
    effectiveUntil: instanceDate,
    pairingId,
  }
}

/** Derive lightweight leg metadata from a flight (used when mocking pairings). */
function legFromFlight(f: PairingFlight, order: number, isDeadhead = false): PairingLegMeta {
  return {
    flightId: f.id,
    legOrder: order,
    isDeadhead,
    depStation: f.departureAirport,
    arrStation: f.arrivalAirport,
    flightDate: f.instanceDate,
    flightNumber: f.flightNumber,
    stdUtc: f.stdUtc.slice(11, 16),
    staUtc: f.staUtc.slice(11, 16),
    blockMinutes: f.blockMinutes,
    aircraftTypeIcao: f.aircraftType,
    stdUtcIso: f.stdUtc,
    staUtcIso: f.staUtc,
  }
}

/** Build a mock flight pool spanning ~5 operating days around today. */
export function buildMockFlights(): PairingFlight[] {
  const flights: PairingFlight[] = []
  for (let day = 0; day < 5; day += 1) {
    const date = shiftDate(day)
    // Day rotation: SGN → HAN → DAD → SGN → HAN (simulating busy VJ pattern)
    flights.push(
      makeFlight({
        scheduledFlightId: `SF-${day}-1`,
        instanceDate: date,
        flightNumber: `VJ${100 + day}`,
        dep: 'SGN',
        arr: 'HAN',
        depHHmm: '06:00',
        arrHHmm: '08:15',
        blockMinutes: 135,
        tailNumber: 'VN-A692',
        rotationId: `ROT-${day}-A`,
      }),
      makeFlight({
        scheduledFlightId: `SF-${day}-2`,
        instanceDate: date,
        flightNumber: `VJ${200 + day}`,
        dep: 'HAN',
        arr: 'DAD',
        depHHmm: '09:15',
        arrHHmm: '10:35',
        blockMinutes: 80,
        tailNumber: 'VN-A692',
        rotationId: `ROT-${day}-A`,
      }),
      makeFlight({
        scheduledFlightId: `SF-${day}-3`,
        instanceDate: date,
        flightNumber: `VJ${300 + day}`,
        dep: 'DAD',
        arr: 'SGN',
        depHHmm: '11:30',
        arrHHmm: '12:55',
        blockMinutes: 85,
        tailNumber: 'VN-A692',
        rotationId: `ROT-${day}-A`,
      }),
      makeFlight({
        scheduledFlightId: `SF-${day}-4`,
        instanceDate: date,
        flightNumber: `VJ${400 + day}`,
        dep: 'SGN',
        arr: 'BKK',
        depHHmm: '14:20',
        arrHHmm: '15:55',
        blockMinutes: 95,
        aircraftType: 'A321',
        tailNumber: 'VN-A635',
        rotationId: `ROT-${day}-B`,
      }),
      makeFlight({
        scheduledFlightId: `SF-${day}-5`,
        instanceDate: date,
        flightNumber: `VJ${500 + day}`,
        dep: 'BKK',
        arr: 'SGN',
        depHHmm: '17:00',
        arrHHmm: '18:35',
        blockMinutes: 95,
        aircraftType: 'A321',
        tailNumber: 'VN-A635',
        rotationId: `ROT-${day}-B`,
      }),
    )
  }
  return flights
}

/** Build a handful of mock pairings covering subsets of the flight pool. */
export function buildMockPairings(flights: PairingFlight[]): Pairing[] {
  if (flights.length === 0) return []

  const day0 = flights.filter((f) => f.instanceDate === shiftDate(0))
  const day1 = flights.filter((f) => f.instanceDate === shiftDate(1))
  const day2 = flights.filter((f) => f.instanceDate === shiftDate(2))

  const p1Flights = day0.slice(0, 3) // SGN-HAN-DAD-SGN — 1-day trip
  const p2Flights = [...day1.slice(0, 3), ...day2.slice(0, 3)] // 2-day trip
  const p3Flights = day0.slice(3) // SGN-BKK-SGN — 1-day, cross-base warning

  const pairings: Pairing[] = [
    buildPairing('P-0241', 'SGN', 'legal', 'committed', p1Flights),
    buildPairing('P-0242', 'SGN', 'warning', 'committed', p2Flights),
    buildPairing('P-0243', 'SGN', 'violation', 'committed', p3Flights),
  ]

  // Attach pairingId back onto the flights so the pool can gray them out.
  for (const p of pairings) {
    for (const id of p.flightIds) {
      const f = flights.find((fl) => fl.id === id)
      if (f) f.pairingId = p.id
    }
  }

  return pairings
}

function buildPairing(
  code: string,
  base: string,
  status: Pairing['status'],
  workflow: Pairing['workflowStatus'],
  flights: PairingFlight[],
): Pairing {
  const legs = flights.map((f, i) => legFromFlight(f, i))
  const routeChain = [flights[0]?.departureAirport, ...flights.map((f) => f.arrivalAirport)].filter(Boolean).join('-')
  const totalBlock = flights.reduce((sum, f) => sum + f.blockMinutes, 0)
  const dates = flights.map((f) => f.instanceDate).sort()
  const startDate = dates[0] ?? ''
  const endDate = dates[dates.length - 1] ?? ''
  const pairingDays = new Set(dates).size
  return {
    id: `pair-${code}-${startDate}`,
    pairingCode: code,
    baseAirport: base,
    aircraftTypeIcao: flights[0]?.aircraftType ?? null,
    status,
    workflowStatus: workflow,
    totalBlockMinutes: totalBlock,
    totalDutyMinutes: totalBlock + 60 * pairingDays, // rough duty estimate
    pairingDays,
    startDate,
    endDate,
    flightIds: flights.map((f) => f.id),
    deadheadFlightIds: [],
    complementKey: 'standard',
    cockpitCount: 2,
    facilityClass: null,
    crewCounts: { CP: 1, FO: 1, PU: 1, CA: 5 },
    routeChain,
    legs,
  }
}

/** Stub legality result for an arbitrary flight selection. */
export function mockLegalityResult(flights: PairingFlight[]): LegalityResult {
  if (flights.length === 0) {
    return {
      overallStatus: 'pass',
      checks: [],
      rulesSummary: [],
    }
  }

  const totalBlock = flights.reduce((sum, f) => sum + f.blockMinutes, 0)
  const blockHours = (totalBlock / 60).toFixed(1)
  const dutyMinutes = totalBlock + 90
  const dutyHours = (dutyMinutes / 60).toFixed(1)

  const checks: LegalityCheck[] = [
    {
      label: 'Flight Duty Period',
      actual: `${dutyHours}h`,
      limit: '13.0h',
      status: dutyMinutes > 13 * 60 ? 'violation' : dutyMinutes > 12 * 60 ? 'warning' : 'pass',
      fdtlRef: 'CAAV Table 01 · Row 0600–1329, Col 1-2 → 13:00 max',
      tier: 'normal',
    },
    {
      label: 'Block Time',
      actual: `${blockHours}h`,
      limit: '9.0h',
      status: totalBlock > 9 * 60 ? 'violation' : 'pass',
      fdtlRef: 'CAAV §9.2 — max block 9:00',
    },
    {
      label: 'Base Routing',
      actual: `${flights[0]?.departureAirport ?? '—'} → ${flights[flights.length - 1]?.arrivalAirport ?? '—'}`,
      limit: 'SGN / HAN / DAD',
      status:
        flights[0]?.departureAirport !== 'SGN' || flights[flights.length - 1]?.arrivalAirport !== 'SGN'
          ? 'warning'
          : 'pass',
      isBaseRouting: true,
      depStatus: flights[0]?.departureAirport === 'SGN' ? 'pass' : 'violation',
      arrStatus: flights[flights.length - 1]?.arrivalAirport === 'SGN' ? 'pass' : 'violation',
    },
  ]

  const violations = checks.filter((c) => c.status === 'violation').length
  const warnings = checks.filter((c) => c.status === 'warning').length
  const overall: LegalityResult['overallStatus'] = violations > 0 ? 'violation' : warnings > 0 ? 'warning' : 'pass'

  return {
    overallStatus: overall,
    checks,
    tableRef: 'CAAV Table 01 · 2-pilot, acclimatized',
    rulesSummary: [
      { code: 'MAX_FDP', label: 'Max FDP', value: '13:00' },
      { code: 'MIN_REST', label: 'Min rest', value: '10:00' },
      { code: 'MAX_BLOCK', label: 'Max block', value: '09:00' },
    ],
  }
}
