export interface ComplementTemplateDef {
  key: string
  label: string
  description: string
  badge: string
  badgeColor: string
}

export const COMPLEMENT_TEMPLATES: ComplementTemplateDef[] = [
  {
    key: 'standard',
    label: 'Standard',
    description: 'Default crew for all normal operations. Applied automatically.',
    badge: 'DEFAULT',
    badgeColor: '#22c55e',
  },
  {
    key: 'aug1',
    label: 'Augmented Crew 1',
    description: 'Extended FDP — one additional cockpit + one senior cabin. Requires rest facility.',
    badge: 'AUGMENT 1',
    badgeColor: '#f59e0b',
  },
  {
    key: 'aug2',
    label: 'Augmented Crew 2',
    description: 'Ultra-long haul — full double augmentation of cockpit and cabin crew.',
    badge: 'AUGMENT 2',
    badgeColor: '#ef4444',
  },
]

export const POSITION_COLUMNS = [
  { key: 'cp', code: 'CP', name: 'Captain', category: 'cockpit' },
  { key: 'fo', code: 'FO', name: 'First Officer', category: 'cockpit' },
  { key: 'so', code: 'SO', name: 'Second Officer', category: 'cockpit' },
  { key: 'fe', code: 'FE', name: 'Flight Engineer', category: 'cockpit' },
  { key: 'cc', code: 'CC', name: 'Cabin Chief', category: 'cabin' },
  { key: 'sp', code: 'SP', name: 'Senior Purser', category: 'cabin' },
  { key: 'ps', code: 'PS', name: 'Purser', category: 'cabin' },
  { key: 'fa', code: 'FA', name: 'Flight Attendant', category: 'cabin' },
  { key: 'tf', code: 'TF', name: 'Trainee FA', category: 'cabin' },
] as const

export type PositionKey = (typeof POSITION_COLUMNS)[number]['key']

export const POSITION_DEFAULT_COLORS: Record<string, string> = {
  CP: '#4338ca',
  FO: '#4f46e5',
  SO: '#6366f1',
  FE: '#818cf8',
  CC: '#92400e',
  SP: '#b45309',
  PS: '#d97706',
  FA: '#c2410c',
  TF: '#ea580c',
}
