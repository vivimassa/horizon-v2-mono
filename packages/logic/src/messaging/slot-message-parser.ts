/**
 * IATA SSIM Chapter 6 Slot Message Parser
 *
 * Parses SCR, SAL, SHL, SMA and related slot coordination messages.
 * Structured plain-text, space-delimited, line-based (NOT fixed-width Chapter 7).
 */

// TODO: Replace @/components/network/slots/slot-types — define SlotSeries locally

/** Minimal SlotSeries shape needed by the converter */
export interface SlotSeries {
  operator_id: string
  airport_iata: string | null
  season_code: string | null
  arrival_flight_number: string | null
  departure_flight_number: string | null
  arrival_origin_iata: string | null
  departure_dest_iata: string | null
  requested_arrival_time: number | null
  requested_departure_time: number | null
  allocated_arrival_time: number | null
  allocated_departure_time: number | null
  overnight_indicator: number
  period_start: string | null
  period_end: string | null
  days_of_operation: string | null
  frequency_rate: number
  seats: number | null
  aircraft_type_icao: string | null
  arrival_service_type: string | null
  departure_service_type: string | null
  status: 'draft' | 'submitted' | 'confirmed' | 'offered' | 'refused' | 'historic' | 'conditional' | 'cancelled'
  priority_category: 'historic' | 'changed_historic' | 'new_entrant' | 'new'
  historic_eligible: boolean
  last_action_code: string | null
  last_coordinator_code: string | null
  flexibility_arrival: string | null
  flexibility_departure: string | null
  min_turnaround_minutes: number | null
  coordinator_reason_arrival: string | null
  coordinator_reason_departure: string | null
  [key: string]: unknown
}

// ── Types ──

export interface ParsedSlotMessage {
  messageType: string
  creatorRef: string | null
  seasonCode: string
  date: string
  airportIata: string
  replyRef: string | null
  dataLines: ParsedSlotLine[]
  supplementaryInfo: string[]
  generalInfo: string[]
  errors: ParseError[]
}

export interface ParsedSlotLine {
  lineNumber: number
  rawLine: string
  actionCode: string
  arrivalFlight: string | null
  departureFlight: string | null
  periodStart: string
  periodEnd: string
  daysOfOperation: string
  seats: number
  aircraftType: string
  arrivalOrigin: string | null
  arrivalTime: number | null
  departureTime: number | null
  departureDestination: string | null
  overnightIndicator: number
  arrivalServiceType: string
  departureServiceType: string
  isArrivalOnly: boolean
  isDepartureOnly: boolean
  labels: Record<string, string>
}

export interface ParseError {
  line: number
  message: string
  severity: 'error' | 'warning'
}

// ── Constants ──

const KNOWN_SMI = ['SCR', 'SAL', 'SHL', 'SMA', 'SIR', 'SAQ', 'WCR', 'WIR']

const AIRLINE_ACTION_CODES = new Set([
  'N', 'Y', 'B', 'V', 'F', 'C', 'M', 'R', 'L', 'I', 'D', 'A', 'P', 'Z',
])
const COORDINATOR_ACTION_CODES = new Set(['K', 'H', 'O', 'U', 'X', 'T', 'W'])
const ALL_ACTION_CODES = new Set([...AIRLINE_ACTION_CODES, ...COORDINATOR_ACTION_CODES])

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
}

const MONTH_NAMES = Object.keys(MONTHS)

// ── Main Parser ──

export function parseSlotMessage(rawText: string): ParsedSlotMessage {
  const result: ParsedSlotMessage = {
    messageType: '',
    creatorRef: null,
    seasonCode: '',
    date: '',
    airportIata: '',
    replyRef: null,
    dataLines: [],
    supplementaryInfo: [],
    generalInfo: [],
    errors: [],
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trimEnd())
  let headerParsed = false
  let lineIndex = 0

  // Step 1 & 2: Parse header lines
  for (; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim()
    if (!line) continue

    // SMI detection
    if (!result.messageType && KNOWN_SMI.includes(line)) {
      result.messageType = line
      continue
    }

    // Creator reference
    if (line.startsWith('/') && !result.creatorRef && !line.includes('.')) {
      result.creatorRef = line.substring(1).trim()
      continue
    }

    // Season code
    if (!result.seasonCode && /^[SW]\d{2}$/.test(line)) {
      result.seasonCode = line
      continue
    }

    // Date (DDMMM)
    if (!result.date && /^\d{2}[A-Z]{3}$/.test(line)) {
      result.date = line
      continue
    }

    // Airport IATA
    if (!result.airportIata && /^[A-Z]{3}$/.test(line) && !KNOWN_SMI.includes(line)) {
      result.airportIata = line
      headerParsed = true
      lineIndex++
      break
    }

    // Reply reference
    if (line.startsWith('REYT')) {
      result.replyRef = line.substring(4).trim()
      continue
    }

    // If we hit a data line before finding all header fields, back up
    if (line.length > 3 && ALL_ACTION_CODES.has(line[0]) && /[A-Z]/.test(line[1])) {
      headerParsed = true
      break
    }
  }

  if (!result.messageType) {
    result.errors.push({ line: 0, message: 'No valid SMI found in header', severity: 'error' })
  }
  if (!result.seasonCode) {
    result.errors.push({ line: 0, message: 'No season code found in header', severity: 'warning' })
  }
  if (!result.airportIata) {
    result.errors.push({ line: 0, message: 'No airport IATA found in header', severity: 'warning' })
  }

  // Step 3: Parse data lines + footer
  let pendingLabels: Record<string, string> = {}

  for (; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim()
    if (!line) continue

    // Supplementary labels line (starts with /)
    if (line.startsWith('/') && line.endsWith('/')) {
      const labelContent = line.slice(1, -1).trim()
      const labelParts = labelContent.split(/\s+/)
      for (const part of labelParts) {
        const dotIdx = part.indexOf('.')
        if (dotIdx > 0) {
          const key = part.substring(0, dotIdx)
          const val = part.substring(dotIdx + 1)
          pendingLabels[key] = val
        }
      }
      // Attach to the most recent data line
      if (result.dataLines.length > 0) {
        const last = result.dataLines[result.dataLines.length - 1]
        last.labels = { ...last.labels, ...pendingLabels }
        pendingLabels = {}
      }
      continue
    }

    // SI line
    if (line.startsWith('SI ') || line === 'SI') {
      result.supplementaryInfo.push(line.substring(2).trim())
      continue
    }

    // GI line
    if (line.startsWith('GI ') || line === 'GI') {
      result.generalInfo.push(line.substring(2).trim())
      continue
    }

    // Try to parse as data line
    if (line.length > 10 && ALL_ACTION_CODES.has(line[0])) {
      const parsed = parseDataLine(line, lineIndex + 1, result.errors)
      if (parsed) {
        result.dataLines.push(parsed)
      }
    } else if (line.length > 10) {
      result.errors.push({
        line: lineIndex + 1,
        message: `Unrecognized line: ${line.substring(0, 40)}...`,
        severity: 'warning',
      })
    }
  }

  // Step 5: Validate
  if (result.seasonCode && !/^[SW]\d{2}$/.test(result.seasonCode)) {
    result.errors.push({ line: 0, message: `Invalid season code: ${result.seasonCode}`, severity: 'error' })
  }

  for (const dl of result.dataLines) {
    if (dl.arrivalTime !== null && (dl.arrivalTime < 0 || dl.arrivalTime > 2359)) {
      result.errors.push({ line: dl.lineNumber, message: `Invalid arrival time: ${dl.arrivalTime}`, severity: 'error' })
    }
    if (dl.departureTime !== null && (dl.departureTime < 0 || dl.departureTime > 2359)) {
      result.errors.push({ line: dl.lineNumber, message: `Invalid departure time: ${dl.departureTime}`, severity: 'error' })
    }
  }

  return result
}

// ── Data Line Parser ──

function parseDataLine(line: string, lineNumber: number, errors: ParseError[]): ParsedSlotLine | null {
  const result: ParsedSlotLine = {
    lineNumber,
    rawLine: line,
    actionCode: '',
    arrivalFlight: null,
    departureFlight: null,
    periodStart: '',
    periodEnd: '',
    daysOfOperation: '',
    seats: 0,
    aircraftType: '',
    arrivalOrigin: null,
    arrivalTime: null,
    departureTime: null,
    departureDestination: null,
    overnightIndicator: 0,
    arrivalServiceType: 'J',
    departureServiceType: 'J',
    isArrivalOnly: false,
    isDepartureOnly: false,
    labels: {},
  }

  // Extract action code (first character)
  result.actionCode = line[0]

  // Detect departure-only: action code followed by space then flight
  const isDepartureOnly = line[1] === ' '
  result.isDepartureOnly = isDepartureOnly

  // Split into tokens
  const tokens = line.substring(isDepartureOnly ? 2 : 1).trim().split(/\s+/)

  if (tokens.length < 5) {
    errors.push({ line: lineNumber, message: `Too few tokens in data line (${tokens.length})`, severity: 'error' })
    return null
  }

  let tokenIdx = 0

  try {
    if (isDepartureOnly) {
      result.departureFlight = tokens[tokenIdx++]
    } else {
      result.arrivalFlight = tokens[tokenIdx++]

      if (tokenIdx < tokens.length) {
        const next = tokens[tokenIdx]
        if (/^[A-Z]{2}/.test(next) && !/^\d{2}[A-Z]{3}/.test(next)) {
          result.departureFlight = tokens[tokenIdx++]
        } else {
          result.isArrivalOnly = true
        }
      }
    }

    // Period: DDMMMDDMMM (10 chars)
    if (tokenIdx < tokens.length) {
      const periodToken = tokens[tokenIdx++]
      if (periodToken.length >= 10) {
        result.periodStart = periodToken.substring(0, 5)
        result.periodEnd = periodToken.substring(5, 10)
      } else {
        errors.push({ line: lineNumber, message: `Invalid period format: ${periodToken}`, severity: 'warning' })
      }
    }

    // DOW: 7 chars of digits/zeros
    if (tokenIdx < tokens.length) {
      const dowToken = tokens[tokenIdx++]
      if (dowToken.length === 7 && /^[\d]{7}$/.test(dowToken)) {
        result.daysOfOperation = dowToken
      } else {
        errors.push({ line: lineNumber, message: `Invalid DOW format: ${dowToken}`, severity: 'warning' })
        result.daysOfOperation = dowToken
      }
    }

    // Seats(3) + ACType(3) = 6 chars
    if (tokenIdx < tokens.length) {
      const seatsAc = tokens[tokenIdx++]
      if (seatsAc.length >= 6) {
        result.seats = parseInt(seatsAc.substring(0, 3), 10)
        result.aircraftType = seatsAc.substring(3, 6)
      } else if (seatsAc.length >= 3) {
        result.seats = parseInt(seatsAc.substring(0, 3), 10)
        result.aircraftType = seatsAc.substring(3)
        errors.push({ line: lineNumber, message: `Short seats+AC token: ${seatsAc}`, severity: 'warning' })
      }
    }

    // Origin + ArrivalTime
    if (tokenIdx < tokens.length && !result.isDepartureOnly) {
      const inRoute = tokens[tokenIdx++]
      const timeMatch = inRoute.match(/(\d{4})$/)
      if (timeMatch) {
        result.arrivalTime = parseInt(timeMatch[1], 10)
        const origin = inRoute.substring(0, inRoute.length - 4)
        result.arrivalOrigin = origin.length >= 3 ? origin.substring(origin.length - 3) : origin
      } else {
        errors.push({ line: lineNumber, message: `Cannot parse arrival route+time: ${inRoute}`, severity: 'warning' })
      }
    }

    // DepTime + optional overnight + destination
    if (tokenIdx < tokens.length && !result.isArrivalOnly) {
      const outRoute = tokens[tokenIdx++]
      const leadingDigits = outRoute.match(/^(\d+)/)
      if (leadingDigits) {
        const digits = leadingDigits[1]
        if (digits.length === 4) {
          result.departureTime = parseInt(digits, 10)
          const dest = outRoute.substring(4)
          result.departureDestination = dest.length >= 3 ? dest.substring(dest.length - 3) : dest
        } else if (digits.length === 5) {
          result.departureTime = parseInt(digits.substring(0, 4), 10)
          result.overnightIndicator = parseInt(digits[4], 10)
          const dest = outRoute.substring(5)
          result.departureDestination = dest.length >= 3 ? dest.substring(dest.length - 3) : dest
        } else {
          errors.push({ line: lineNumber, message: `Unexpected departure format: ${outRoute}`, severity: 'warning' })
        }
      }
    }

    // Service types: 1-2 chars
    if (tokenIdx < tokens.length) {
      const svcToken = tokens[tokenIdx++]
      if (/^[A-Z]{1,2}$/.test(svcToken)) {
        result.arrivalServiceType = svcToken[0]
        result.departureServiceType = svcToken.length > 1 ? svcToken[1] : svcToken[0]
      } else {
        errors.push({ line: lineNumber, message: `Unexpected service type: ${svcToken}`, severity: 'warning' })
      }
    }

    // Remaining tokens might be inline supplementary labels
    while (tokenIdx < tokens.length) {
      const remaining = tokens[tokenIdx++]
      if (remaining.startsWith('/')) {
        const labelContent = remaining.replace(/^\/|\/$/g, '')
        const parts = labelContent.split(/\s+/)
        for (const part of parts) {
          const dotIdx = part.indexOf('.')
          if (dotIdx > 0) {
            result.labels[part.substring(0, dotIdx)] = part.substring(dotIdx + 1)
          }
        }
      }
    }
  } catch (e) {
    errors.push({
      line: lineNumber,
      message: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
      severity: 'error',
    })
    return null
  }

  return result
}

// ── Converter ──

export function convertParsedLineToSlotSeries(
  line: ParsedSlotLine,
  airportIata: string,
  seasonCode: string,
  operatorId: string
): Partial<SlotSeries> {
  const statusMap: Record<string, string> = {
    K: 'confirmed',
    O: 'offered',
    U: 'refused',
    H: 'historic',
    T: 'conditional',
    X: 'cancelled',
    N: 'submitted',
    Y: 'submitted',
    B: 'submitted',
    F: 'submitted',
    V: 'submitted',
  }

  const priorityMap: Record<string, string> = {
    F: 'historic',
    C: 'changed_historic',
    M: 'changed_historic',
    B: 'new_entrant',
    V: 'new_entrant',
    N: 'new',
    Y: 'new',
  }

  const periodStartISO = ddmmmToISO(line.periodStart, seasonCode)
  const periodEndISO = ddmmmToISO(line.periodEnd, seasonCode)

  return {
    operator_id: operatorId,
    airport_iata: airportIata,
    season_code: seasonCode,
    arrival_flight_number: line.arrivalFlight,
    departure_flight_number: line.departureFlight,
    arrival_origin_iata: line.arrivalOrigin,
    departure_dest_iata: line.departureDestination,
    requested_arrival_time: line.arrivalTime,
    requested_departure_time: line.departureTime,
    allocated_arrival_time: line.labels['AA'] ? parseInt(line.labels['AA'], 10) : null,
    allocated_departure_time: line.labels['AD'] ? parseInt(line.labels['AD'], 10) : null,
    overnight_indicator: line.overnightIndicator,
    period_start: periodStartISO,
    period_end: periodEndISO,
    days_of_operation: normalizeDow(line.daysOfOperation),
    frequency_rate: 1,
    seats: line.seats || null,
    aircraft_type_icao: line.aircraftType || null,
    arrival_service_type: line.arrivalServiceType,
    departure_service_type: line.departureServiceType,
    status: (statusMap[line.actionCode] || 'draft') as SlotSeries['status'],
    priority_category: (priorityMap[line.actionCode] || 'new') as SlotSeries['priority_category'],
    historic_eligible: line.actionCode === 'H',
    last_action_code: AIRLINE_ACTION_CODES.has(line.actionCode) ? line.actionCode : null,
    last_coordinator_code: COORDINATOR_ACTION_CODES.has(line.actionCode) ? line.actionCode : null,
    flexibility_arrival: line.labels['FA'] || null,
    flexibility_departure: line.labels['FD'] || null,
    min_turnaround_minutes: line.labels['MT'] ? parseInt(line.labels['MT'], 10) : null,
    coordinator_reason_arrival: line.labels['CA'] || null,
    coordinator_reason_departure: line.labels['CD'] || null,
  }
}

// ── Date Helpers ──

/**
 * Resolve the year from a season code + DDMMM string.
 * S26: MAR-OCT -> 2026. W26: OCT-MAR spans 2026-2027.
 */
export function seasonYear(seasonCode: string, dateStr: string): number {
  const seasonType = seasonCode[0] // 'S' or 'W'
  const baseYear = 2000 + parseInt(seasonCode.substring(1), 10)

  const monthStr = dateStr.substring(2, 5).toUpperCase()
  const monthIdx = MONTHS[monthStr]

  if (monthIdx === undefined) return baseYear

  if (seasonType === 'S') {
    return baseYear
  } else {
    return monthIdx >= 9 ? baseYear : baseYear + 1
  }
}

function ddmmmToISO(ddmmm: string, seasonCode: string): string {
  if (!ddmmm || ddmmm.length < 5) return ''

  const day = parseInt(ddmmm.substring(0, 2), 10)
  const monthStr = ddmmm.substring(2, 5).toUpperCase()
  const monthIdx = MONTHS[monthStr]

  if (monthIdx === undefined || isNaN(day)) return ''

  const year = seasonYear(seasonCode, ddmmm)
  const m = String(monthIdx + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')

  return `${year}-${m}-${d}`
}

function normalizeDow(dow: string): string {
  return dow.replace(/[^0-7]/g, '0').substring(0, 7)
}

export function isoToDDMMM(isoDate: string): string {
  const d = new Date(isoDate)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = MONTH_NAMES[d.getUTCMonth()]
  return `${day}${month}`
}
