/**
 * SSIM Chapter 7 parser and generator utilities.
 * Handles Record Type 1 (header), Type 2 (flight leg), Type 5 (trailer).
 * Type 2 is 200-byte fixed-width with 1-based column positions.
 */

// ─── Types ───────────────────────────────────────────────────

export interface SsimRecord {
  airline: string
  flightNumber: string
  serviceType: string
  effectiveFrom: string   // YYYY-MM-DD
  effectiveTo: string     // YYYY-MM-DD
  daysOfWeek: string      // "1234567" format (our DB format)
  departureIata: string
  std: string             // HHMM
  arrivalIata: string
  sta: string             // HHMM
  aircraftType: string    // IATA 3-letter
  rawLine: string
  lineNumber: number
  errors: string[]
}

export interface SsimParseResult {
  records: SsimRecord[]
  headerCarrier: string
  totalLines: number
  errors: { line: number; message: string; raw: string }[]
}

// ─── Month mapping ───────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Parse ddMMMyy → YYYY-MM-DD */
function parseSsimDate(s: string): string {
  if (!s || s.trim().length < 7) return ''
  const dd = s.slice(0, 2)
  const mmm = s.slice(2, 5).toUpperCase()
  const yy = s.slice(5, 7)
  const monthIdx = MONTHS.indexOf(mmm)
  if (monthIdx < 0) return ''
  const year = parseInt(yy) < 70 ? 2000 + parseInt(yy) : 1900 + parseInt(yy)
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${dd}`
}

/** Format YYYY-MM-DD → ddMMMyy */
function formatSsimDate(dateStr: string): string {
  if (!dateStr) return '       '
  const [y, m, d] = dateStr.split('-')
  const mmm = MONTHS[parseInt(m) - 1] || 'JAN'
  const yy = y.slice(2)
  return `${d}${mmm}${yy}`
}

/** Convert SSIM DOW "1 3 5  " (7 chars, space = non-op) → DB format "135" */
function parseSsimDow(s: string): string {
  let result = ''
  for (let i = 0; i < 7 && i < s.length; i++) {
    if (s[i] !== ' ') result += s[i]
  }
  return result
}

/** Convert DB DOW "135" → SSIM DOW "1 3 5  " (7 chars) */
function formatSsimDow(dow: string): string {
  let result = ''
  for (let i = 1; i <= 7; i++) {
    result += dow.includes(String(i)) ? String(i) : ' '
  }
  return result
}

// ─── Parser ──────────────────────────────────────────────────

/**
 * Parse SSIM Chapter 7 content.
 * Record Type 2 field positions (0-based):
 *   [0]     = Record type '2'
 *   [1]     = Operational suffix
 *   [2-3]   = Airline designator
 *   [4-7]   = Flight number (4 digits, right-justified)
 *   [8]     = Itinerary variation
 *   [9-10]  = Leg sequence
 *   [11]    = Service type
 *   [12-18] = Period from (ddMMMyy)
 *   [19-25] = Period to (ddMMMyy)
 *   [26-32] = Days of operation (7 chars)
 *   [33-35] = Frequency rate
 *   [36-38] = Departure station
 *   [39-42] = STD passenger (HHMM)
 *   [43-46] = STD aircraft (HHMM)
 *   [47-51] = UTC variation departure
 *   [52-54] = Arrival station
 *   [55-58] = STA passenger (HHMM)
 *   [59-62] = STA aircraft (HHMM)
 *   [63-67] = UTC variation arrival
 *   [68-70] = Aircraft type (IATA 3-letter)
 */
export function parseSsim(content: string): SsimParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  const records: SsimRecord[] = []
  const errors: { line: number; message: string; raw: string }[] = []
  let headerCarrier = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const recordType = line[0]

    if (recordType === '1') {
      // Header — extract carrier from positions 3-4 (0-based: 2-3)
      headerCarrier = line.slice(2, 4).trim()
      continue
    }

    if (recordType === '5' || recordType === '3' || recordType === '4') {
      continue // Skip trailer, segment, supplementary records
    }

    if (recordType !== '2') {
      // Try to parse as Type 2 if line is long enough
      if (line.length < 71) {
        errors.push({ line: lineNum, message: 'Unknown record type or too short', raw: line })
        continue
      }
    }

    if (line.length < 71) {
      errors.push({ line: lineNum, message: `Record too short (${line.length} chars, need at least 71)`, raw: line })
      continue
    }

    const rec: SsimRecord = {
      airline: line.slice(2, 4).trim(),
      flightNumber: line.slice(2, 8).trim().replace(/^(\D+)0*/, '$1'), // "HZ0100" → "HZ100"
      serviceType: line[11]?.trim() || 'J',
      effectiveFrom: parseSsimDate(line.slice(12, 19)),
      effectiveTo: parseSsimDate(line.slice(19, 26)),
      daysOfWeek: parseSsimDow(line.slice(26, 33)),
      departureIata: line.slice(36, 39).trim(),
      std: line.slice(39, 43).trim(),
      arrivalIata: line.slice(52, 55).trim(),
      sta: line.slice(55, 59).trim(),
      aircraftType: line.slice(68, 71).trim(),
      rawLine: line,
      lineNumber: lineNum,
      errors: [],
    }

    // Validate
    if (!rec.flightNumber) rec.errors.push('Missing flight number')
    if (!rec.departureIata || rec.departureIata.length !== 3) rec.errors.push('Invalid departure airport')
    if (!rec.arrivalIata || rec.arrivalIata.length !== 3) rec.errors.push('Invalid arrival airport')
    if (rec.std && !/^\d{4}$/.test(rec.std)) rec.errors.push('Invalid STD format')
    if (rec.sta && !/^\d{4}$/.test(rec.sta)) rec.errors.push('Invalid STA format')
    if (!rec.daysOfWeek) rec.errors.push('No operating days specified')
    if (!rec.effectiveFrom) rec.errors.push('Invalid effective-from date')

    if (rec.errors.length > 0) {
      errors.push({ line: lineNum, message: rec.errors.join('; '), raw: line })
    }

    records.push(rec)
  }

  return { records, headerCarrier, totalLines: lines.length, errors }
}

// ─── Generator ───────────────────────────────────────────────

export interface SsimFlightInput {
  flightNumber: string
  departureIata: string
  arrivalIata: string
  std: string
  sta: string
  daysOfWeek: string
  aircraftTypeIata: string
  serviceType: string
  effectiveFrom: string
  effectiveTo: string
}

/** Generate a complete SSIM Chapter 7 file */
export function generateSsim(
  carrierCode: string,
  seasonCode: string,
  flights: SsimFlightInput[],
): string {
  const lines: string[] = []
  const carrier = carrierCode.padEnd(2).slice(0, 2)

  // Record Type 1 — Header
  const header = '1'
    + ' '             // serial
    + carrier         // airline
    + '   '           // spare
    + seasonCode.padEnd(6).slice(0, 6) // season
    + '       '       // period from (optional)
    + '       '       // period to
    + formatSsimDate(new Date().toISOString().split('T')[0]) // creation date
    + 'SSIM'          // data title
    + ' '             // quality indicator
    + carrier         // airline (dup)
  lines.push(header.padEnd(200))

  // Record Type 2 — Flight legs
  for (const f of flights) {
    // Extract numeric part + carrier from flight number
    const fltNumOnly = f.flightNumber.replace(/\D/g, '')
    const fltPadded = fltNumOnly.padStart(4, '0')

    const rec = '2'                                        // [0]    Record type
      + ' '                                              // [1]    Op suffix
      + carrier                                          // [2-3]  Airline
      + fltPadded                                        // [4-7]  Flight number
      + ' '                                              // [8]    Itinerary var
      + '01'                                             // [9-10] Leg sequence
      + (f.serviceType || 'J').slice(0, 1)               // [11]   Service type
      + formatSsimDate(f.effectiveFrom)                  // [12-18] From
      + formatSsimDate(f.effectiveTo)                    // [19-25] To
      + formatSsimDow(f.daysOfWeek)                      // [26-32] DOW
      + '   '                                            // [33-35] Freq rate
      + f.departureIata.padEnd(3).slice(0, 3)            // [36-38] DEP
      + (f.std || '0000').padEnd(4).slice(0, 4)          // [39-42] STD pax
      + (f.std || '0000').padEnd(4).slice(0, 4)          // [43-46] STD a/c
      + '     '                                          // [47-51] UTC var dep
      + f.arrivalIata.padEnd(3).slice(0, 3)              // [52-54] ARR
      + (f.sta || '0000').padEnd(4).slice(0, 4)          // [55-58] STA pax
      + (f.sta || '0000').padEnd(4).slice(0, 4)          // [59-62] STA a/c
      + '     '                                          // [63-67] UTC var arr
      + (f.aircraftTypeIata || '   ').padEnd(3).slice(0, 3) // [68-70] A/C type

    lines.push(rec.padEnd(200))
  }

  // Record Type 5 — Trailer
  const trailer = '5' + carrier + String(flights.length).padStart(6, '0')
  lines.push(trailer.padEnd(200))

  return lines.join('\n')
}

// ─── ASM/SSM Helpers ─────────────────────────────────────────

export const ASM_ACTION_CODES = ['NEW', 'TIM', 'CNL', 'EQT', 'CON', 'RIN', 'RPL', 'FLT', 'SKD'] as const
export type AsmActionCode = typeof ASM_ACTION_CODES[number]

export interface AsmParsed {
  messageType: 'ASM' | 'SSM'
  actionCode: AsmActionCode | string
  airline: string
  flightNumber: string
  flightDate: string        // YYYY-MM-DD
  changes: Record<string, { from?: string; to: string }>
  rawMessage: string
  errors: string[]
}

/**
 * Parse a simplified ASM/SSM message.
 * Expected format:
 *   ASM (or SSM)
 *   TIM (action code)
 *   HZ100/15MAR25
 *   DEL0830 BOM1145
 *   738
 *
 * Or inline format:
 *   ASM TIM HZ100/15MAR25 DEL0830-BOM1145 738
 */
/**
 * Parse an ASM/SSM message (IATA SSIM Chapters 4 & 5).
 *
 * ASM structure:
 *   Line 1: ASM (or SSM)
 *   Line 2: UTC (or LT) — time mode
 *   Line 3: (optional) message reference
 *   Line 4: Action code (NEW, TIM, CNL, EQT, RIN, etc.) + optional reason
 *   Line 5: Flight identifier: {airline}{flightNumber}/{date}
 *   Line 6+: Equipment line, Leg/routing line, segment info
 */
export function parseAsmMessage(raw: string): AsmParsed {
  const result: AsmParsed = {
    messageType: 'ASM',
    actionCode: '',
    airline: '',
    flightNumber: '',
    flightDate: '',
    changes: {},
    rawMessage: raw,
    errors: [],
  }

  const lines = raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) { result.errors.push('Empty message'); return result }

  let lineIdx = 0

  // Line 1: Message type (ASM or SSM)
  const firstLine = lines[lineIdx].toUpperCase()
  if (firstLine.startsWith('SSM')) result.messageType = 'SSM'
  else if (firstLine.startsWith('ASM')) result.messageType = 'ASM'
  lineIdx++

  // Line 2: Time mode (UTC or LT) — skip
  if (lineIdx < lines.length && /^(UTC|LT)$/i.test(lines[lineIdx])) {
    lineIdx++
  }

  // Line 3: Optional message reference (contains digits and letters, often has E or /) — skip
  if (lineIdx < lines.length && /\d/.test(lines[lineIdx]) && !ASM_ACTION_CODES.includes(lines[lineIdx].split(/\s/)[0] as AsmActionCode)) {
    lineIdx++
  }

  // Line 4: Action code + optional reason (e.g., "TIM OPER", "CNL CREW", "NEW")
  if (lineIdx < lines.length) {
    const actionParts = lines[lineIdx].toUpperCase().split(/\s+/)
    for (const code of ASM_ACTION_CODES) {
      if (actionParts[0] === code) {
        result.actionCode = code
        break
      }
    }
    if (!result.actionCode) {
      result.errors.push(`No valid action code found on line ${lineIdx + 1}: "${lines[lineIdx]}"`)
    }
    lineIdx++
  }

  // Line 5+: Flight identifier
  // ASM: {airline}{flightNumber}/{date} e.g., "HZ301/22MAR" or "HZ301/22MAR26"
  // SSM: {airline}{flightNumber} on one line, period on next
  if (lineIdx < lines.length) {
    const fltLine = lines[lineIdx].toUpperCase()

    // Try ASM flight identifier with date: XX999/ddMMM or XX999/ddMMMnn
    const asmMatch = fltLine.match(/^([A-Z]{2})(\d{1,4})[A-Z]?\s*\/\s*(\d{2}[A-Z]{3}(?:\d{2})?)/)
    if (asmMatch) {
      result.airline = asmMatch[1]
      result.flightNumber = asmMatch[1] + asmMatch[2]
      const dateStr = asmMatch[3]
      if (dateStr.length >= 5) {
        result.flightDate = parseSsimDate(dateStr.length === 5 ? dateStr + '26' : dateStr)
      }
      lineIdx++
    } else {
      // Try SSM flight identifier without date
      const ssmMatch = fltLine.match(/^([A-Z]{2})(\d{1,4})/)
      if (ssmMatch) {
        result.airline = ssmMatch[1]
        result.flightNumber = ssmMatch[1] + ssmMatch[2]
        lineIdx++
        // Next line may be period: "ddMMM ddMMM 1234567"
        if (lineIdx < lines.length) {
          const periodMatch = lines[lineIdx].match(/(\d{2}[A-Z]{3}(?:\d{2})?)\s+(\d{2}[A-Z]{3}(?:\d{2})?)\s+(\d{1,7})/)
          if (periodMatch) {
            result.flightDate = parseSsimDate(periodMatch[1].length === 5 ? periodMatch[1] + '26' : periodMatch[1])
            lineIdx++
          }
        }
      } else {
        result.errors.push(`Could not parse flight identifier: "${fltLine}"`)
        lineIdx++
      }
    }
  }

  // Remaining lines: equipment and leg/routing
  for (; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].toUpperCase()

    // Equipment line: starts with service type letter + space + 3-char AC type
    // e.g., "J 789 FCYML.F10C30M75" or "J 320"
    const eqtMatch = line.match(/^([JCGFHQ])\s+(\w{3})/)
    if (eqtMatch) {
      result.changes['aircraft_type'] = { to: eqtMatch[2] }
      result.changes['service_type'] = { to: eqtMatch[1] }
      continue
    }

    // Leg/routing line: {DEP}{STD} {ARR}{STA}
    // e.g., "SGN0615 ICN1430" or "SGN0615/0600 ICN1430/1440"
    const legMatch = line.match(/^([A-Z]{3})(\d{4})(?:\/\d{4})?\s+([A-Z]{3})(\d{4})/)
    if (legMatch) {
      result.changes['dep_station'] = { to: legMatch[1] }
      result.changes['std'] = { to: legMatch[2] }
      result.changes['arr_station'] = { to: legMatch[3] }
      result.changes['sta'] = { to: legMatch[4] }
      continue
    }
  }

  return result
}

/**
 * Generate an IATA-compliant ASM message (SSIM Chapter 5).
 *
 * Output format:
 *   ASM
 *   UTC
 *   {ActionCode}
 *   {airline}{flightNumber}/{ddMMM}
 *   {serviceType} {aircraftType}       ← equipment line (if applicable)
 *   {depIATA}{STD} {arrIATA}{STA}      ← leg line (for NEW, TIM, RRT)
 */
export function generateAsmMessage(input: {
  actionCode: string
  airline: string
  flightNumber: string
  flightDate: string
  changes: Record<string, { from?: string; to: string }>
}): string {
  const lines: string[] = []

  // Header
  lines.push('ASM')
  lines.push('UTC')

  // Action code
  lines.push(input.actionCode)

  // Flight identifier: airline + flight number + /date
  // flightNumber may already include airline prefix — strip it
  const fltNum = input.flightNumber.replace(/^[A-Z]{2}/, '')
  const dateFmt = formatSsimDate(input.flightDate)
  // Format date as ddMMM (5 chars, no year for current-year messages)
  const shortDate = dateFmt.substring(0, 5)
  lines.push(`${input.airline}${fltNum}/${shortDate}`)

  if (input.actionCode === 'CNL') {
    // CNL: flight identifier is sufficient — no further lines needed
    // (the identifier line above IS the cancellation)
  } else if (input.actionCode === 'RIN') {
    // RIN (reinstatement): same as CNL — just the flight identifier
  } else if (input.actionCode === 'NEW') {
    // Equipment line: service type + aircraft type
    const acType = input.changes['aircraft_type']?.to || '---'
    lines.push(`J ${acType}`)

    // Leg line: DEP+STD ARR+STA
    const dep = input.changes['dep_station']?.to || input.changes['departure_iata']?.to || '---'
    const arr = input.changes['arr_station']?.to || input.changes['arrival_iata']?.to || '---'
    const std = formatHHMM(input.changes['std']?.to)
    const sta = formatHHMM(input.changes['sta']?.to)
    lines.push(`${dep}${std} ${arr}${sta}`)
  } else if (input.actionCode === 'TIM') {
    // TIM: new leg line with updated times
    const dep = input.changes['dep_station']?.to || input.changes['departure_iata']?.to
    const arr = input.changes['arr_station']?.to || input.changes['arrival_iata']?.to
    const std = formatHHMM(input.changes['std']?.to)
    const sta = formatHHMM(input.changes['sta']?.to)

    if (dep && arr) {
      // Full leg line
      lines.push(`${dep}${std} ${arr}${sta}`)
    } else if (std !== '----') {
      // Partial — at least show what changed
      // Use placeholder stations if not provided
      lines.push(`---${std} ---${sta}`)
    }
  } else if (input.actionCode === 'EQT') {
    // Equipment line with new type
    const acType = input.changes['aircraft_type']?.to || '---'
    const svcType = input.changes['service_type']?.to || 'J'
    lines.push(`${svcType} ${acType}`)
  } else if (input.actionCode === 'RRT') {
    // Reroute: new leg line
    const dep = input.changes['dep_station']?.to || input.changes['departure_iata']?.to || '---'
    const arr = input.changes['arr_station']?.to || input.changes['arrival_iata']?.to || '---'
    const std = formatHHMM(input.changes['std']?.to)
    const sta = formatHHMM(input.changes['sta']?.to)
    lines.push(`${dep}${std} ${arr}${sta}`)
  }

  return lines.join('\n')
}

function formatHHMM(val: string | undefined): string {
  if (!val) return '----'
  // Remove colons if present (convert 06:45 → 0645)
  const clean = val.replace(':', '')
  return clean.padStart(4, '0')
}
