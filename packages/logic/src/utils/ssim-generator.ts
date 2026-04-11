/**
 * SSIM Chapter 7 Generator
 *
 * Generates valid IATA SSIM Chapter 7 fixed-width (200 chars/line) text files.
 * Column positions match the verified positions in ssim-parser.ts.
 *
 * All column references are 0-indexed.
 */

// ---- Types ------------------------------------------------------------------

export interface SSIMExportOptions {
  airlineCode: string        // 2-3 char IATA airline code (e.g. "HZ")
  airlineName: string        // Full airline name (up to 35 chars)
  seasonStart: string        // ISO date YYYY-MM-DD
  seasonEnd: string          // ISO date YYYY-MM-DD
  actionCode?: string        // H=new, R=replace, etc. Default "H"
  releaseCode?: string       // Numeric release version
  creator?: string           // Creator identifier (up to 8 chars)
}

export interface SSIMFlightRecord {
  suffix?: string
  airlineCode: string
  flightNumber: number
  itineraryVariation: string
  legSequence: string
  serviceType: string
  periodStart: string        // ISO date YYYY-MM-DD
  periodEnd: string          // ISO date YYYY-MM-DD
  daysOfOperation: string    // "1234567" format, 7 chars
  depStation: string         // 3-char IATA
  stdUtc: string           // HH:MM or HHMM
  depUtcOffset: string       // +HHMM or -HHMM (5 chars)
  arrStation: string         // 3-char IATA
  staUtc: string           // HH:MM or HHMM
  arrUtcOffset: string       // +HHMM or -HHMM (5 chars)
  aircraftTypeIata: string   // 3-char IATA aircraft type
  seatConfig?: Record<string, number>  // e.g. { C: 12, Y: 365 }
  /** Next leg in the rotation cycle — IATA carrier of the onward flight */
  onwardAirlineCode?: string
  /** Next leg flight number (numeric) */
  onwardFlightNumber?: number
}

// ---- Constants --------------------------------------------------------------

const LINE_WIDTH = 200
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// Legacy export kept for compatibility — no longer needed since DB stores SSIM codes directly
const ICAO_TO_IATA_AIRCRAFT: Record<string, string> = {}
export { ICAO_TO_IATA_AIRCRAFT }

// ---- Date Formatting --------------------------------------------------------

/** Format ISO date "YYYY-MM-DD" -> SSIM date "DDMMMYY" */
export function formatSsimDate(isoDate: string): string {
  if (!isoDate || typeof isoDate !== 'string') return '       '
  // Accept "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss..."; reject anything else
  const m = isoDate.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return '       '
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day = m[3]
  if (month < 0 || month > 11) return '       '
  const yy = String(year % 100).padStart(2, '0')
  return `${day}${MONTHS[month]}${yy}`
}

/** Format seat config { C: 12, Y: 365 } -> "C012Y365" (padded 3-digit counts) */
export function formatSeatConfig(config: Record<string, number>): string {
  if (!config || Object.keys(config).length === 0) return ''
  // Canonical IATA cabin order: F (First), C/J (Business), W (Premium Economy), Y (Economy).
  // Anything outside the canonical set sorts last, alphabetically.
  const order = ['F', 'C', 'J', 'W', 'Y']
  return Object.entries(config)
    .sort(([a], [b]) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.localeCompare(b)
    })
    .map(([cabin, count]) => `${cabin}${String(count).padStart(3, '0')}`)
    .join('')
}

/** Format days of operation for display: "1234567" -> human string */
export function formatDaysOfOperation(days: string): string {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const active: string[] = []
  for (let i = 0; i < 7 && i < days.length; i++) {
    if (days[i] !== ' ') active.push(dayNames[i])
  }
  if (active.length === 7) return 'Daily'
  return active.join(', ')
}

/** Resolve aircraft type code to SSIM 3-char code.
 *  Since DB now stores SSIM codes directly (320, 321, 330), this is a pass-through. */
export function icaoToIataAircraftType(code: string): string {
  return code.substring(0, 3)
}

// ---- Line Builders ----------------------------------------------------------

/** Pad a string to exactly `width` chars, left-justified */
function padRight(s: string, width: number): string {
  return s.padEnd(width).substring(0, width)
}

/** Pad a number/string to exactly `width` chars, right-justified */
function padLeft(s: string, width: number): string {
  return s.padStart(width).substring(0, width)
}

/** Normalize time: "HH:MM" -> "HHMM", or keep "HHMM" as-is */
function normalizeTime(t: string): string {
  if (!t) return '0000'
  return t.replace(':', '')
}

/** Compute local time from UTC HHMM + offset string (+HHMM/-HHMM) */
function utcToLocalHHMM(utcHHMM: string, offset: string): string {
  if (!utcHHMM || utcHHMM.length < 4 || !offset || offset.length < 5) return utcHHMM
  const utcMin = parseInt(utcHHMM.slice(0, 2), 10) * 60 + parseInt(utcHHMM.slice(2, 4), 10)
  const sign = offset[0] === '-' ? -1 : 1
  const offH = parseInt(offset.slice(1, 3), 10)
  const offM = parseInt(offset.slice(3, 5), 10)
  let localMin = utcMin + sign * (offH * 60 + offM)
  if (localMin < 0) localMin += 1440
  if (localMin >= 1440) localMin -= 1440
  return `${String(Math.floor(localMin / 60)).padStart(2, '0')}${String(localMin % 60).padStart(2, '0')}`
}

/** Build a fixed-width 200-char line from positional segments */
function buildLine(segments: { pos: number; value: string }[]): string {
  const chars = new Array(LINE_WIDTH).fill(' ')

  for (const seg of segments) {
    for (let i = 0; i < seg.value.length && seg.pos + i < LINE_WIDTH; i++) {
      chars[seg.pos + i] = seg.value[i]
    }
  }

  return chars.join('')
}

// ---- Record Generators ------------------------------------------------------

function generateType1(): string {
  return buildLine([
    { pos: 0, value: '1' },
    { pos: 1, value: 'AIRLINE STANDARD SCHEDULE DATA SET' },
  ])
}

function generateType2(options: SSIMExportOptions, creationDate: string): string {
  const airline3 = padRight(options.airlineCode, 3)
  const actionCode = options.actionCode || 'H'
  const seasonStartSsim = formatSsimDate(options.seasonStart)
  const seasonEndSsim = formatSsimDate(options.seasonEnd)
  const creationSsim = formatSsimDate(creationDate)
  const airlineName = padRight(options.airlineName, 35)
  const releaseCode = options.releaseCode || ' '
  const creator = padRight(options.creator || '', 8)

  return buildLine([
    { pos: 0, value: '2' },
    { pos: 1, value: actionCode },
    { pos: 2, value: airline3 },
    { pos: 14, value: seasonStartSsim },
    { pos: 21, value: seasonEndSsim },
    { pos: 28, value: creationSsim },
    { pos: 36, value: airlineName },
    { pos: 71, value: releaseCode },
    { pos: 72, value: creator },
    { pos: 194, value: '000001' },
  ])
}

function generateType3(flight: SSIMFlightRecord, serialNumber: number): string {
  const airline3 = padRight(flight.airlineCode, 3)
  const flightNum = padLeft(String(flight.flightNumber), 4)
  const itinVar = padRight(flight.itineraryVariation || '01', 2)
  const legSeq = padRight(flight.legSequence || '01', 2)
  const serviceType = flight.serviceType || 'J'
  const periodStartSsim = formatSsimDate(flight.periodStart)
  const periodEndSsim = formatSsimDate(flight.periodEnd)
  const days = padRight(flight.daysOfOperation, 7)

  const depStation = padRight(flight.depStation, 3)
  const stdUtcNorm = normalizeTime(flight.stdUtc)
  const stdLocalNorm = utcToLocalHHMM(stdUtcNorm, flight.depUtcOffset) || stdUtcNorm
  const depOffset = padRight(flight.depUtcOffset, 5)

  const arrStation = padRight(flight.arrStation, 3)
  const staUtcNorm = normalizeTime(flight.staUtc)
  const staLocalNorm = utcToLocalHHMM(staUtcNorm, flight.arrUtcOffset) || staUtcNorm
  const arrOffset = padRight(flight.arrUtcOffset, 5)

  const acType = padRight(flight.aircraftTypeIata, 3)
  const seatStr = flight.seatConfig ? formatSeatConfig(flight.seatConfig) : ''
  const serial = padLeft(String(serialNumber), 6).replace(/ /g, '0')

  // Onward flight (next leg in rotation cycle) — pos 128-133
  // Layout: 128-129 = onward IATA carrier (2 char), 130-133 = flight number (4 digits, zero-padded)
  const onwardCode = flight.onwardAirlineCode ? padRight(flight.onwardAirlineCode, 2) : ''
  const onwardFlightNum = flight.onwardFlightNumber
    ? padLeft(String(flight.onwardFlightNumber), 4).replace(/ /g, '0')
    : ''

  const segments: { pos: number; value: string }[] = [
    { pos: 0, value: '3' },
    { pos: 1, value: flight.suffix || ' ' },
    { pos: 2, value: airline3 },
    { pos: 5, value: flightNum },
    { pos: 9, value: itinVar },
    { pos: 11, value: legSeq },
    { pos: 13, value: serviceType },
    { pos: 14, value: periodStartSsim },
    { pos: 21, value: periodEndSsim },
    { pos: 28, value: days },
    { pos: 36, value: depStation },
    { pos: 39, value: stdLocalNorm },
    { pos: 43, value: stdUtcNorm },
    { pos: 47, value: depOffset },
    { pos: 54, value: arrStation },
    { pos: 57, value: staLocalNorm },
    { pos: 61, value: staUtcNorm },
    { pos: 65, value: arrOffset },
    { pos: 72, value: acType },
    { pos: 172, value: padRight(seatStr, 20) },
    { pos: 194, value: serial },
  ]
  if (onwardCode) segments.push({ pos: 128, value: onwardCode })
  if (onwardFlightNum) segments.push({ pos: 130, value: onwardFlightNum })

  return buildLine(segments)
}

function generateType5(airlineCode: string, lastFlightSerial: number, totalRecordCount: number): string {
  const airline3 = padRight(airlineCode, 3)
  const lastSerial = padLeft(String(lastFlightSerial), 6).replace(/ /g, '0')
  const totalCount = padLeft(String(totalRecordCount), 6).replace(/ /g, '0')

  return buildLine([
    { pos: 0, value: '5' },
    { pos: 2, value: airline3 },
    { pos: 187, value: `${lastSerial}E${totalCount}` },
  ])
}

// ---- Main Generator ---------------------------------------------------------

/**
 * Generate a complete SSIM Chapter 7 file from flight records.
 *
 * @param flights - Array of flight records to include
 * @param options - Export options (airline info, season dates)
 * @returns Complete SSIM file content as a string
 */
export function generateSSIM(
  flights: SSIMFlightRecord[],
  options: SSIMExportOptions
): string {
  const lines: string[] = []

  // Type 1: Header
  lines.push(generateType1())

  // Type 2: Carrier record (serial 000001)
  const today = new Date().toISOString().split('T')[0]
  lines.push(generateType2(options, today))

  // Type 3: Flight records (serials starting at 000002)
  let serial = 2
  for (const flight of flights) {
    lines.push(generateType3(flight, serial))
    serial++
  }

  // Type 5: Trailer
  const lastFlightSerial = serial - 1
  const totalRecordCount = serial // header(not counted) + carrier(1) + flights + trailer
  lines.push(generateType5(options.airlineCode, lastFlightSerial, totalRecordCount))

  return lines.join('\n')
}
