// Normalizes dates coming from imports, legacy migrations, or hand-entered rows
// to ISO YYYY-MM-DD. Returns the trimmed input unchanged if it can't parse it,
// so the surrounding Zod validation can surface the malformed value.

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeDate(input: string | null | undefined): string | null {
  if (input == null) return null
  const s = String(input).trim()
  if (!s) return s

  // Already ISO
  if (ISO_RE.test(s)) return s

  // DD-MMM-YY / DD-MMM-YYYY (01-Apr-26, 01-Apr-2026)
  const mmm = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/)
  if (mmm) {
    const dd = mmm[1].padStart(2, '0')
    const mm = MONTHS[mmm[2].toLowerCase()]
    if (mm) {
      const yy = mmm[3].length === 2 ? `20${mmm[3]}` : mmm[3]
      return `${yy}-${mm}-${dd}`
    }
  }

  // DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY (day-first — this is what the legacy
  // import left behind and is unambiguously what VietJet-style Vietnamese
  // locales use). We intentionally do NOT treat this as MM/DD/YYYY.
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    const yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${yy}-${mm}-${dd}`
  }

  // Raw digits: DDMMYYYY
  if (/^\d{8}$/.test(s)) return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`
  if (/^\d{6}$/.test(s)) return `20${s.slice(4, 6)}-${s.slice(2, 4)}-${s.slice(0, 2)}`

  return s
}

/** Returns true if the string is already in ISO YYYY-MM-DD shape. */
export function isIsoDate(s: string | null | undefined): boolean {
  return typeof s === 'string' && ISO_RE.test(s)
}
