// ─── Crew Position Constants ─────────────────────────────────────────
// Single source of truth for position categories and seed defaults.
// Runtime code MUST always query the database — never use these as fallbacks.

/**
 * Position category — the ONLY hardcoded concept.
 * Everything else (codes, names, rank orders) is operator-defined in the DB.
 */
export type CrewPositionCategory = 'cockpit' | 'cabin'

export const CREW_POSITION_CATEGORIES = [
  { key: 'cockpit' as const, label: 'Flight Deck' },
  { key: 'cabin' as const, label: 'Cabin Crew' },
] as const

/** Normalize a position code to uppercase trimmed form. Use everywhere. */
export function normalizePositionCode(code: string): string {
  return code.toUpperCase().trim()
}

/** Validate position code format: 1-4 uppercase alphanumeric chars. */
export function isValidPositionCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{1,4}$/.test(code)
}

// ─── Seed Defaults ───────────────────────────────────────────────────
// Used ONLY by the seed endpoint for initial operator setup.
// Never import these for runtime logic or fallbacks.

export interface CrewPositionSeed {
  code: string
  name: string
  category: CrewPositionCategory
  rankOrder: number
  isPic: boolean
  canDownrank: boolean
  color: string
  description: string
}

export const DEFAULT_CREW_POSITIONS: CrewPositionSeed[] = [
  // ── Flight Deck ──
  {
    code: 'CP', name: 'Captain', category: 'cockpit', rankOrder: 1,
    isPic: true, canDownrank: false, color: '#4338ca',
    description: 'Pilot in Command — responsible for flight safety and operations',
  },
  {
    code: 'FO', name: 'First Officer', category: 'cockpit', rankOrder: 2,
    isPic: false, canDownrank: false, color: '#4f46e5',
    description: 'Second in Command — supports Captain in flight operations',
  },
  {
    code: 'SO', name: 'Second Officer', category: 'cockpit', rankOrder: 3,
    isPic: false, canDownrank: false, color: '#6366f1',
    description: 'Relief pilot for augmented crew operations',
  },
  {
    code: 'FE', name: 'Flight Engineer', category: 'cockpit', rankOrder: 4,
    isPic: false, canDownrank: false, color: '#818cf8',
    description: 'Monitors aircraft systems during flight',
  },
  // ── Cabin Crew ──
  {
    code: 'CC', name: 'Cabin Chief', category: 'cabin', rankOrder: 1,
    isPic: false, canDownrank: false, color: '#92400e',
    description: 'Senior cabin crew member — leads cabin operations',
  },
  {
    code: 'SP', name: 'Senior Purser', category: 'cabin', rankOrder: 2,
    isPic: false, canDownrank: true, color: '#b45309',
    description: 'Experienced purser with supervisory responsibilities',
  },
  {
    code: 'PS', name: 'Purser', category: 'cabin', rankOrder: 3,
    isPic: false, canDownrank: true, color: '#d97706',
    description: 'In-charge of cabin service delivery',
  },
  {
    code: 'FA', name: 'Flight Attendant', category: 'cabin', rankOrder: 4,
    isPic: false, canDownrank: false, color: '#c2410c',
    description: 'Standard cabin crew member',
  },
  {
    code: 'TF', name: 'Trainee FA', category: 'cabin', rankOrder: 5,
    isPic: false, canDownrank: false, color: '#ea580c',
    description: 'Flight attendant under supervised training',
  },
]
