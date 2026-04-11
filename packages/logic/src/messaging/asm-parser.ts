/**
 * ASM/SSM Message Parser & Generator (IATA SSIM Chapters 4 & 5)
 *
 * ASM = Ad-hoc Schedule Message (instance-level changes, specific date)
 * SSM = Standard Schedule Message (pattern-level changes, date range)
 *
 * This handles the short telex-style messages (NOT the fixed-width Chapter 7 files).
 * Pure functions — no side effects, no I/O, no framework dependencies.
 */

import type { AsmParsed, AsmGenerateInput, AsmActionCode } from '@skyhub/types'

export { ASM_ACTION_CODES } from '@skyhub/types'

// ── Month mapping ───────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Parse ddMMMyy → YYYY-MM-DD */
function parseSsimDate(s: string): string {
  if (!s || s.trim().length < 5) return ''
  const dd = s.slice(0, 2)
  const mmm = s.slice(2, 5).toUpperCase()
  const yy = s.length >= 7 ? s.slice(5, 7) : ''
  const monthIdx = MONTHS.indexOf(mmm)
  if (monthIdx < 0) return ''
  const year = yy ? (parseInt(yy) < 70 ? 2000 + parseInt(yy) : 1900 + parseInt(yy)) : new Date().getFullYear()
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

/** Format a time value to HHMM, padding and stripping colons */
function formatHHMM(val: string | undefined): string {
  if (!val) return '----'
  const clean = val.replace(':', '')
  return clean.padStart(4, '0')
}

// ── Valid action codes (for parsing) ────────────────────────

const ACTION_CODES: readonly string[] = ['NEW', 'TIM', 'CNL', 'EQT', 'CON', 'RIN', 'RPL', 'FLT', 'SKD', 'RRT']

// ── Human-readable labels ───────────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
  NEW: 'New Flight',
  TIM: 'Time Change',
  CNL: 'Cancellation',
  EQT: 'Equipment Change',
  CON: 'Config Change',
  RIN: 'Reinstatement',
  RPL: 'Replace',
  FLT: 'Flight # Change',
  SKD: 'Schedule Change',
  RRT: 'Reroute',
}

// ── Parser ──────────────────────────────────────────────────

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

  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    result.errors.push('Empty message')
    return result
  }

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

  // Line 3: Optional message reference (contains digits and letters, often has E or /)
  if (lineIdx < lines.length && /\d/.test(lines[lineIdx]) && !ACTION_CODES.includes(lines[lineIdx].split(/\s/)[0])) {
    lineIdx++
  }

  // Line 4: Action code + optional reason (e.g., "TIM OPER", "CNL CREW", "NEW")
  if (lineIdx < lines.length) {
    const actionParts = lines[lineIdx].toUpperCase().split(/\s+/)
    for (const code of ACTION_CODES) {
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
  // ASM: {airline}{flightNumber}/{date} e.g., "VJ301/22MAR" or "VJ301/22MAR26"
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

// ── Generator ───────────────────────────────────────────────

/**
 * Generate an IATA-compliant ASM message (SSIM Chapter 5).
 *
 * Output format:
 *   ASM
 *   UTC
 *   {ActionCode}
 *   {airline}{flightNumber}/{ddMMM}
 *   {serviceType} {aircraftType}       (equipment line, if applicable)
 *   {depIATA}{STD} {arrIATA}{STA}      (leg line, for NEW, TIM, RRT)
 */
export function generateAsmMessage(input: AsmGenerateInput): string {
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
  // Short date: ddMMM (5 chars, no year for current-year messages)
  const shortDate = dateFmt.substring(0, 5)
  lines.push(`${input.airline}${fltNum}/${shortDate}`)

  switch (input.actionCode) {
    case 'CNL':
    case 'RIN':
      // Flight identifier is sufficient — no further lines
      break

    case 'NEW': {
      const acType = input.changes['aircraft_type']?.to || '---'
      lines.push(`J ${acType}`)
      const dep = input.changes['dep_station']?.to || input.changes['departure_iata']?.to || '---'
      const arr = input.changes['arr_station']?.to || input.changes['arrival_iata']?.to || '---'
      const std = formatHHMM(input.changes['std']?.to)
      const sta = formatHHMM(input.changes['sta']?.to)
      lines.push(`${dep}${std} ${arr}${sta}`)
      break
    }

    case 'TIM': {
      const dep = input.changes['dep_station']?.to || input.changes['departure_iata']?.to
      const arr = input.changes['arr_station']?.to || input.changes['arrival_iata']?.to
      const std = formatHHMM(input.changes['std']?.to)
      const sta = formatHHMM(input.changes['sta']?.to)
      if (dep && arr) {
        lines.push(`${dep}${std} ${arr}${sta}`)
      } else if (std !== '----') {
        lines.push(`---${std} ---${sta}`)
      }
      break
    }

    case 'EQT': {
      const acType = input.changes['aircraft_type']?.to || '---'
      const svcType = input.changes['service_type']?.to || 'J'
      lines.push(`${svcType} ${acType}`)
      break
    }

    case 'RRT': {
      const dep = input.changes['dep_station']?.to || input.changes['departure_iata']?.to || '---'
      const arr = input.changes['arr_station']?.to || input.changes['arrival_iata']?.to || '---'
      const std = formatHHMM(input.changes['std']?.to)
      const sta = formatHHMM(input.changes['sta']?.to)
      lines.push(`${dep}${std} ${arr}${sta}`)
      break
    }

    default:
      // For unsupported action codes, just the flight identifier line
      break
  }

  return lines.join('\n')
}
