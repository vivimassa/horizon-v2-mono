import type { ParsedMvt, MvtFlightId, MvtActionCode, MvtEta, MvtDelay, MvtPassengers } from './types'

/**
 * Parse an IATA AHM 780 MVT (Movement Message) from raw telex text.
 * Handles AD, AA, ED, NI, RR, FR action codes with DL, PX, SI lines.
 */
export function parseMvtMessage(raw: string): ParsedMvt | null {
  if (!raw) return null

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Detect message type — skip envelope lines until we find MVT or COR MVT
  let bodyStart = 0
  let messageType: 'MVT' | 'COR MVT' = 'MVT'

  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase()
    if (upper === 'COR MVT') {
      messageType = 'COR MVT'
      bodyStart = i + 1
      break
    }
    if (upper === 'MVT') {
      messageType = 'MVT'
      bodyStart = i + 1
      break
    }
  }

  if (bodyStart >= lines.length) return null

  const bodyLines = lines.slice(bodyStart).filter((l) => l !== '=')

  // Parse flight identification line
  const flightId = parseFlightIdLine(bodyLines[0])
  if (!flightId) return null

  // Parse action code line and remaining lines
  const result: ParsedMvt = {
    messageType,
    flightId,
    actionCode: 'AD',
    etas: [],
    delays: [],
    supplementaryInfo: [],
    rawLines: lines,
  }

  for (let i = 1; i < bodyLines.length; i++) {
    const line = bodyLines[i]
    const upper = line.toUpperCase()

    if (upper.startsWith('AD')) {
      parseActionAD(line, result)
    } else if (upper.startsWith('AA')) {
      parseActionAA(line, result)
    } else if (upper.startsWith('ED')) {
      parseActionED(line, result)
    } else if (upper.startsWith('NI')) {
      parseActionNI(line, result)
    } else if (upper.startsWith('FR')) {
      parseActionFR(line, result)
    } else if (upper.startsWith('DLA')) {
      // AHM 732 Triple-A — check before DL to avoid prefix collision
      parseDlaLine(line, result)
    } else if (upper.startsWith('DL')) {
      parseDelayLine(line, result)
    } else if (upper.startsWith('PX')) {
      parsePassengerLine(line, result)
    } else if (upper.startsWith('SI')) {
      result.supplementaryInfo.push(line.slice(2).trim())
    }
    // Check for RR within an AD line (already handled in parseActionAD)
  }

  return result
}

// ─── Flight ID line ──────────────────────────────────────────────

function parseFlightIdLine(line: string): MvtFlightId | null {
  if (!line) return null

  // Format: SB8113/12.ECENZ.IST
  const match = line.match(/^([A-Z]{2})(\d{1,4}[A-Z]?)\/(\d{2})\.([A-Z0-9]+)\.([A-Z]{3})$/i)
  if (!match) {
    // Try looser match — some systems add extra fields
    const loose = line.match(/^([A-Z]{2})(\d{1,4}[A-Z]?)\/(\d{2})\.([A-Z0-9]+)\.([A-Z]{3})/i)
    if (!loose) return null
    return {
      airline: loose[1].toUpperCase(),
      flightNumber: loose[2],
      dayOfMonth: loose[3],
      registration: loose[4].toUpperCase(),
      station: loose[5].toUpperCase(),
    }
  }

  return {
    airline: match[1].toUpperCase(),
    flightNumber: match[2],
    dayOfMonth: match[3],
    registration: match[4].toUpperCase(),
    station: match[5].toUpperCase(),
  }
}

// ─── AD — Actual Departure ───────────────────────────────────────

function parseActionAD(line: string, result: ParsedMvt) {
  result.actionCode = 'AD'
  const upper = line.toUpperCase()

  // Check for RR (Return to Ramp): AD1623 RR1645
  const rrMatch = upper.match(/^AD(\d{4,6})(?:\/(\d{4,6}))?\s+RR(\d{4,6})/)
  if (rrMatch) {
    result.offBlocks = rrMatch[1]
    if (rrMatch[2]) result.airborne = rrMatch[2]
    result.actionCode = 'RR'
    result.returnTime = rrMatch[3]
    return
  }

  // Standard: AD1623/1626 EA2020SXF EA1830FRA
  const adMatch = upper.match(/^AD(\d{4,6})(?:\/(\d{4,6}))?/)
  if (adMatch) {
    result.offBlocks = adMatch[1]
    if (adMatch[2]) result.airborne = adMatch[2]
  }

  // Parse EA entries
  const eaPattern = /EA(\d{4,6})([A-Z]{3})/g
  let eaMatch
  while ((eaMatch = eaPattern.exec(upper)) !== null) {
    result.etas.push({ time: eaMatch[1], destination: eaMatch[2] })
  }
}

// ─── AA — Actual Arrival ─────────────────────────────────────────

function parseActionAA(line: string, result: ParsedMvt) {
  result.actionCode = 'AA'
  const upper = line.toUpperCase()

  const match = upper.match(/^AA(\d{4,6})(?:\/(\d{4,6}))?/)
  if (match) {
    result.touchdown = match[1]
    if (match[2]) result.onBlocks = match[2]
  }
}

// ─── ED — Estimated Departure ────────────────────────────────────

function parseActionED(line: string, result: ParsedMvt) {
  result.actionCode = 'ED'
  const upper = line.toUpperCase()

  const match = upper.match(/^ED(\d{4,6})/)
  if (match) {
    result.estimatedDeparture = match[1]
  }
}

// ─── NI — Next Information ───────────────────────────────────────

function parseActionNI(line: string, result: ParsedMvt) {
  result.actionCode = 'NI'
  const upper = line.toUpperCase()

  const match = upper.match(/^NI(\d{4,6})/)
  if (match) {
    result.nextInfoTime = match[1]
  }
}

// ─── FR — Forced Return ──────────────────────────────────────────

function parseActionFR(line: string, result: ParsedMvt) {
  result.actionCode = 'FR'
  const upper = line.toUpperCase()

  const match = upper.match(/^FR(\d{4,6})(?:\/(\d{4,6}))?/)
  if (match) {
    result.touchdown = match[1]
    if (match[2]) result.onBlocks = match[2]
  }
}

// ─── DL — Delay codes ────────────────────────────────────────────

function parseDelayLine(line: string, result: ParsedMvt) {
  const upper = line.toUpperCase().replace(/^DL/, '')
  const parts = upper.split('/')

  if (parts.length === 1) {
    // DL81 — single code, no duration
    result.delays.push({ code: parts[0].trim() })
  } else if (parts.length === 2) {
    // DL93/0020 — code/duration
    result.delays.push({ code: parts[0].trim(), duration: parts[1].trim() })
  } else if (parts.length === 4) {
    // DL93/81/0020/0015 — code1/code2/dur1/dur2
    result.delays.push({ code: parts[0].trim(), duration: parts[2].trim() })
    result.delays.push({ code: parts[1].trim(), duration: parts[3].trim() })
  } else if (parts.length === 3) {
    // DL93/81/0020 — code1/code2/dur1 (duration for first only)
    result.delays.push({ code: parts[0].trim(), duration: parts[2].trim() })
    result.delays.push({ code: parts[1].trim() })
  }
}

// ─── DLA — AHM 732 Triple-A delay codes ──────────────────────────

function parseDlaLine(line: string, result: ParsedMvt) {
  // Strip leading "DLA" plus any optional whitespace
  const body = line.toUpperCase().replace(/^DLA\s*/, '')
  if (!body) return

  const parts = body.split('/').map((s) => s.trim())

  const isDuration = (token: string): boolean => /^\d{4}$/.test(token)

  const tripleFromToken = (
    token: string,
  ): { code: string; ahm732?: { process: string; reason: string; stakeholder: string } } => {
    if (!token || token.length < 3) return { code: token }
    const process = token.charAt(0)
    const reason = token.charAt(1)
    const stakeholder = token.charAt(2)
    return { code: token.slice(0, 3), ahm732: { process, reason, stakeholder } }
  }

  // Strategy: walk the slots, pairing each code with the next duration-looking slot
  // if any. This handles all the real-world forms:
  //   DLA NRH           → 1 code
  //   DLA NRH/0045      → code + duration
  //   DLA NRH/TPA       → 2 codes
  //   DLA NRH/TPA/0045/0015 → 2 codes + 2 durations
  //   DLA 841/812/932/652   → 4 codes (no durations, authoritative OAG example)
  //   DLA 93B//11C/     → codes with empty slots
  const tokens = parts
  const codes: string[] = []
  const durations: (string | undefined)[] = []

  for (const t of tokens) {
    if (!t) continue
    if (isDuration(t)) {
      durations.push(t)
    } else {
      codes.push(t)
      durations.push(undefined) // reserve slot aligned with code
    }
  }

  // Collect codes and durations in order; pair positionally (DL convention:
  // CODE1/CODE2/DUR1/DUR2 → delay[i].duration = DUR[i]).
  const codeTokens: string[] = []
  const durationTokens: string[] = []
  for (const t of tokens) {
    if (!t) continue
    if (isDuration(t)) durationTokens.push(t)
    else codeTokens.push(t)
  }

  const delays = codeTokens.map((c, i) => {
    const d = tripleFromToken(c)
    if (durationTokens[i]) (d as { duration?: string }).duration = durationTokens[i]
    return d
  })

  for (const d of delays) result.delays.push(d)
}

// ─── PX — Passengers ─────────────────────────────────────────────

function parsePassengerLine(line: string, result: ParsedMvt) {
  const upper = line.toUpperCase().replace(/^PX/, '')

  // PX142+03 — total + infants
  const plusMatch = upper.match(/^(\d+)\+(\d+)/)
  if (plusMatch) {
    result.passengers = {
      total: parseInt(plusMatch[1]),
      noSeatHolders: parseInt(plusMatch[2]),
    }
    return
  }

  // PX223/100 — multi-sector
  const slashMatch = upper.match(/^(\d+(?:\/\d+)+)/)
  if (slashMatch) {
    const sectors = slashMatch[1].split('/').map(Number)
    result.passengers = {
      total: sectors[0],
      sectors,
    }
    return
  }

  // PX323 — simple total
  const simpleMatch = upper.match(/^(\d+)/)
  if (simpleMatch) {
    result.passengers = { total: parseInt(simpleMatch[1]) }
  }
}

// ─── Utility: format HHMM time for display ───────────────────────

export function formatMvtTime(time: string | undefined): string {
  if (!time) return '—'
  if (time.length === 6) {
    // DDHHMM → DD at HH:MMz
    return `${time.slice(2, 4)}:${time.slice(4, 6)}z (day ${time.slice(0, 2)})`
  }
  if (time.length === 4) {
    return `${time.slice(0, 2)}:${time.slice(2, 4)}z`
  }
  return time
}

// ─── Utility: delay code description ─────────────────────────────

const DELAY_CODE_CATEGORIES: Record<string, string> = {
  '00': 'Airline internal',
  '01': 'Airline internal – OCC',
  '06': 'Reactionary – previous flight',
  '09': 'Reactionary – other',
  '11': 'Late passenger check-in',
  '12': 'Late passengers at gate',
  '13': 'Oversales / check-in error',
  '14': 'Passenger processing',
  '15': 'Boarding: discrepancies / seating',
  '16': 'Commercial pub/agt. error',
  '17': 'Catering order: late change',
  '18': 'Baggage processing',
  '19': 'Passenger/baggage: other',
  '21': 'Freight: documentation / late positioning',
  '22': 'Freight: late acceptance',
  '23': 'Freight: late delivery to ramp',
  '24': 'Freight: inadequate packing',
  '25': 'Freight: oversales',
  '26': 'Freight: late preparation at warehouse',
  '27': 'Mail: late acceptance / documentation',
  '28': 'Mail: late delivery to ramp',
  '29': 'Cargo/mail: other',
  '31': 'Aircraft loading: excess / special',
  '32': 'Aircraft loading: excess / special cabin',
  '33': 'Loading equipment: unavailable / failure',
  '34': 'Servicing equipment: unavailable / failure',
  '35': 'Aircraft cleaning',
  '36': 'Fueling / defueling',
  '37': 'Catering: late delivery / shortage',
  '38': 'ULD/container: packing problem',
  '39': 'Ramp handling: other',
  '41': 'Aircraft defect',
  '42': 'Scheduled maintenance: late release',
  '43': 'Non-scheduled maintenance: special check',
  '44': 'Standby aircraft: not available or unfit',
  '45': 'Aircraft change: for non-tech reasons',
  '46': 'Aircraft change: for tech reasons',
  '47': 'Standby aircraft: used',
  '48': 'Technical: other',
  '51': 'Aircraft damage during ground ops',
  '52': 'Aircraft damage during flight ops',
  '55': 'IT/system failure: ops',
  '56': 'IT/system failure: check-in',
  '57': 'IT/system failure: cargo',
  '58': 'IT/system failure: other',
  '61': 'Flight plan: late completion / change',
  '62': 'Operational requirements: fuel / payload',
  '63': 'Crew: late reporting / absent',
  '64': 'Crew: operating restrictions',
  '65': 'Crew: training / examination',
  '66': 'Crew: sickness / injury',
  '67': 'Crew: industrial action',
  '68': 'Crew: flight time limitations',
  '69': 'Operations/crewing: other',
  '71': 'Weather: departure station',
  '72': 'Weather: destination',
  '73': 'Weather: en-route / alternate',
  '75': 'De-icing of aircraft',
  '76': 'De-icing: removal of snow/ice/water from runway',
  '77': 'Weather: ground handling impaired',
  '81': 'ATC: en-route flow / capacity',
  '82': 'ATC: airport flow / capacity',
  '83': 'ATC: mandatory security / customs',
  '84': 'ATC: industrial action',
  '85': 'Mandatory security',
  '86': 'Airport: immigration / customs / health',
  '87': 'Airport: facilities / services',
  '88': 'Airport: restrictions / closures',
  '89': 'Airport/governmental: other',
  '91': 'Reactionary: connecting pax / cargo',
  '92': 'Reactionary: through-check-in',
  '93': 'Reactionary: aircraft rotation',
  '94': 'Reactionary: cabin crew rotation',
  '95': 'Reactionary: cockpit crew rotation',
  '96': 'Reactionary: ops control',
  '97': 'Industrial action: own airline',
  '98': 'Industrial action: outside parties',
  '99': 'Miscellaneous',
}

export function getDelayCodeDescription(code: string): string {
  return DELAY_CODE_CATEGORIES[code] || `Delay code ${code}`
}

export function formatDelayDuration(duration: string | undefined): string {
  if (!duration || duration.length < 4) return ''
  const h = parseInt(duration.slice(0, 2))
  const m = parseInt(duration.slice(2, 4))
  if (h === 0) return `${m}min`
  return `${h}h${m > 0 ? m + 'min' : ''}`
}
