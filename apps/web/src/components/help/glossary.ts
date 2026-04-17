export interface GlossaryEntry {
  term: string
  full?: string
  definition: string
  related?: string[]
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  ICAO: {
    term: 'ICAO',
    full: 'International Civil Aviation Organization',
    definition:
      'UN agency that standardizes aviation codes. Sky Hub uses 4-letter ICAO airport codes (VVTS, RPLL) and ICAO aircraft type codes (A320, A333) in the data layer.',
  },
  IATA: {
    term: 'IATA',
    full: 'International Air Transport Association',
    definition:
      'Airline trade group. Uses 3-letter airport codes (SGN, LAX) and 2-letter airline codes (VJ, AA). Sky Hub displays IATA codes in the UI for readability but stores ICAO.',
  },
  UTC: {
    term: 'UTC',
    full: 'Coordinated Universal Time',
    definition:
      'Global reference time. Sky Hub stores every timestamp in UTC milliseconds and converts to operator-local time only for display. Never mix the two.',
  },
  SSIM: {
    term: 'SSIM',
    full: 'Standard Schedules Information Manual',
    definition:
      'IATA format for exchanging airline schedules between carriers, airports, and ground handlers. Used for codeshare feeds and slot filings.',
  },
  ASM: {
    term: 'ASM',
    full: 'Ad-hoc Schedule Message',
    definition:
      'Standard message announcing a single schedule change (new flight, cancellation, time adjustment, equipment swap, re-routing). Used for incremental updates between a carrier publication.',
  },
  SSM: {
    term: 'SSM',
    full: 'Scheduled Service Message',
    definition:
      'Standard message announcing scheduled service changes in bulk, usually during a season publication. ASM is for ad-hoc deltas, SSM is for planned blocks of changes.',
  },
  TAT: {
    term: 'TAT',
    full: 'Turnaround Time',
    definition:
      'Ground time between a flight arriving (STA) and the next flight departing (STD) on the same aircraft. Configured per aircraft type in Master Data — Aircraft Types (5.2.1), split by DOM→DOM, DOM→INT, INT→DOM, INT→INT.',
  },
  STD: {
    term: 'STD',
    full: 'Scheduled Time of Departure',
    definition: 'Planned off-block time. Always stored in UTC; displayed in operator-local time for the DEP station.',
  },
  STA: {
    term: 'STA',
    full: 'Scheduled Time of Arrival',
    definition: 'Planned on-block time. Always stored in UTC; displayed in operator-local time for the ARR station.',
  },
  Block: {
    term: 'Block',
    full: 'Block Time',
    definition:
      'Duration between off-blocks (STD) and on-blocks (STA). In Sky Hub it is computed automatically from STA − STD, handling midnight wraparound via the OFFSET column.',
  },
}

export function lookupTerm(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term.toUpperCase()]
}
