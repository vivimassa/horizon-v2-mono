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
  HOTAC: {
    term: 'HOTAC',
    full: 'Hotel Accommodation',
    definition:
      'Industry shorthand for the desk that books crew layover hotels and ground transport. In Sky Hub the HOTAC module covers 4.1.8.1 Crew Hotel Management, 4.1.8.2 Crew Transport, and the 4.1.8.3 policy page that drives them both.',
  },
  Layover: {
    term: 'Layover',
    full: 'Layover',
    definition:
      'Block-to-block rest period between an inbound STA and the next outbound STD on the same pairing. Qualifies for a hotel only when the gap meets the operator-configured minimum (default ≥6h) and is not at the crew home base.',
  },
  Pairing: {
    term: 'Pairing',
    full: 'Crew Pairing',
    definition:
      'A multi-day rotation a crew member flies — first leg of duty (report) through last leg (release). The unit of work for crew schedule, HOTAC layover detection, and crew-transport derivation.',
  },
  Deadhead: {
    term: 'Deadhead',
    full: 'Deadhead Positioning',
    definition:
      'A leg flown by a crew member as a passenger to position for an upcoming duty rather than to operate the flight. Captured in 4.1.8.2 Flight as either a ticket booking or a GENDEC supernumerary placement.',
  },
  GENDEC: {
    term: 'GENDEC',
    full: 'General Declaration',
    definition:
      'Supernumerary placement of crew on the operator’s own flight without a passenger ticket — typically a cockpit jumpseat, cabin jumpseat, or pax seat declared on the GENDEC manifest. The non-ticketed alternative to a deadhead booking.',
  },
  PNR: {
    term: 'PNR',
    full: 'Passenger Name Record',
    definition:
      'GDS booking reference for a ticketed flight. Stored on a CrewFlightBooking when method=ticket, alongside the carrier code, ticket numbers, fare, and any e-ticket attachments.',
  },
}

export function lookupTerm(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term.toUpperCase()]
}
