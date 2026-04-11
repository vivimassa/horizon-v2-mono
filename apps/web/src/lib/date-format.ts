// SkyHub — Date Format Utility
// Reads operator dateFormat setting and formats/parses dates consistently.
// All dates stored as YYYY-MM-DD internally. Display format is operator-configurable.

export type DateFormatType = 'DD-MMM-YY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_MAP: Record<string, string> = {}
MONTHS.forEach((m, i) => {
  MONTH_MAP[m.toLowerCase()] = String(i + 1).padStart(2, '0')
})

/**
 * Format an ISO date (YYYY-MM-DD) to the operator's display format.
 */
export function formatDate(isoDate: string, format: DateFormatType): string {
  if (!isoDate) return ''
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return isoDate
  const [, yyyy, mm, dd] = match

  switch (format) {
    case 'DD-MMM-YY':
      return `${dd}-${MONTHS[parseInt(mm) - 1]}-${yyyy.slice(2)}`
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`
    case 'YYYY-MM-DD':
      return isoDate
    case 'DD.MM.YYYY':
      return `${dd}.${mm}.${yyyy}`
    default:
      return isoDate
  }
}

/**
 * Parse a user-typed date string back to ISO YYYY-MM-DD.
 * Accepts multiple formats and resolves based on operator setting.
 */
export function parseDate(input: string, format: DateFormatType): string {
  if (!input) return ''
  const clean = input.trim()

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean

  // DD-MMM-YY (e.g. 01-Apr-26)
  const mmmMatch = clean.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (mmmMatch) {
    const dd = mmmMatch[1].padStart(2, '0')
    const mm = MONTH_MAP[mmmMatch[2].toLowerCase()] ?? '01'
    const yy = mmmMatch[3].length === 2 ? `20${mmmMatch[3]}` : mmmMatch[3]
    return `${yy}-${mm}-${dd}`
  }

  // Detect separator
  const sep = clean.includes('/') ? '/' : clean.includes('.') ? '.' : clean.includes('-') ? '-' : null

  if (sep) {
    const parts = clean.split(sep)
    if (parts.length === 3) {
      // Use operator format to determine order
      if (format === 'MM/DD/YYYY') {
        return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
      }
      if (format === 'YYYY-MM-DD') {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
      // DD/MM/YYYY or DD.MM.YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }

  // Raw digits: DDMMYYYY (8 digits)
  if (/^\d{8}$/.test(clean)) {
    if (format === 'MM/DD/YYYY') {
      return `${clean.slice(4, 8)}-${clean.slice(0, 2)}-${clean.slice(2, 4)}`
    }
    // Default DD first
    return `${clean.slice(4, 8)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`
  }

  // Raw digits: DDMMYY (6 digits)
  if (/^\d{6}$/.test(clean)) {
    if (format === 'MM/DD/YYYY') {
      return `20${clean.slice(4, 6)}-${clean.slice(0, 2)}-${clean.slice(2, 4)}`
    }
    return `20${clean.slice(4, 6)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`
  }

  return clean
}

/**
 * Normalize any date format to ISO YYYY-MM-DD for storage/comparison.
 */
export function normalizeToIso(d: string, format: DateFormatType): string {
  return parseDate(d, format)
}
