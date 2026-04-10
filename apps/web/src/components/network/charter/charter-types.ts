// ── Charter Manager Types & Constants (Module 1.1.5) ──

export type ContractType =
  | 'passenger' | 'cargo' | 'government' | 'acmi'
  | 'humanitarian' | 'hajj' | 'sports' | 'other'

export type ContractStatus =
  | 'draft' | 'proposed' | 'confirmed'
  | 'operating' | 'completed' | 'cancelled'

export type FlightLegType = 'revenue' | 'positioning' | 'technical'

export type CharterFlightStatus =
  | 'planned' | 'confirmed' | 'assigned' | 'operated' | 'cancelled'

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  passenger: 'Passenger',
  cargo: 'Cargo',
  government: 'Government',
  acmi: 'ACMI Wet Lease',
  humanitarian: 'Humanitarian',
  hajj: 'Hajj Pilgrimage',
  sports: 'Sports / Event',
  other: 'Other',
}

export const CONTRACT_TYPE_ICONS: Record<ContractType, string> = {
  passenger: 'Users',
  cargo: 'Package',
  government: 'Building2',
  acmi: 'Handshake',
  humanitarian: 'Heart',
  hajj: 'Moon',
  sports: 'Trophy',
  other: 'FileText',
}

// ── Status styling (palette-based, not Tailwind classes) ──

export function getStatusStyle(status: ContractStatus, isDark: boolean): { background: string; color: string; borderColor: string } {
  const styles: Record<ContractStatus, { light: { bg: string; fg: string; border: string }; dark: { bg: string; fg: string; border: string } }> = {
    draft: {
      light: { bg: 'rgba(85,87,112,0.08)', fg: '#555770', border: 'rgba(85,87,112,0.12)' },
      dark: { bg: 'rgba(143,144,166,0.12)', fg: '#8F90A6', border: 'rgba(143,144,166,0.15)' },
    },
    proposed: {
      light: { bg: 'rgba(0,99,247,0.10)', fg: '#0063F7', border: 'rgba(0,99,247,0.15)' },
      dark: { bg: 'rgba(91,141,239,0.15)', fg: '#5B8DEF', border: 'rgba(91,141,239,0.20)' },
    },
    confirmed: {
      light: { bg: 'rgba(6,194,112,0.10)', fg: '#06C270', border: 'rgba(6,194,112,0.18)' },
      dark: { bg: 'rgba(57,217,138,0.15)', fg: '#39D98A', border: 'rgba(57,217,138,0.20)' },
    },
    operating: {
      light: { bg: 'rgba(255,136,0,0.10)', fg: '#E67A00', border: 'rgba(255,136,0,0.18)' },
      dark: { bg: 'rgba(253,172,66,0.15)', fg: '#FDAC42', border: 'rgba(253,172,66,0.20)' },
    },
    completed: {
      light: { bg: 'rgba(0,207,222,0.10)', fg: '#00B7C4', border: 'rgba(0,207,222,0.15)' },
      dark: { bg: 'rgba(115,223,231,0.15)', fg: '#73DFE7', border: 'rgba(115,223,231,0.20)' },
    },
    cancelled: {
      light: { bg: 'rgba(255,59,59,0.10)', fg: '#E63535', border: 'rgba(255,59,59,0.18)' },
      dark: { bg: 'rgba(255,92,92,0.15)', fg: '#FF5C5C', border: 'rgba(255,92,92,0.20)' },
    },
  }
  const s = isDark ? styles[status].dark : styles[status].light
  return { background: s.bg, color: s.fg, borderColor: s.border }
}

export function getLegTypeStyle(legType: FlightLegType, isDark: boolean): { background: string; color: string; borderColor: string } {
  const styles: Record<FlightLegType, { light: { bg: string; fg: string; border: string }; dark: { bg: string; fg: string; border: string } }> = {
    revenue: {
      light: { bg: 'rgba(6,194,112,0.10)', fg: '#06C270', border: 'rgba(6,194,112,0.15)' },
      dark: { bg: 'rgba(57,217,138,0.15)', fg: '#39D98A', border: 'rgba(57,217,138,0.20)' },
    },
    positioning: {
      light: { bg: 'rgba(255,136,0,0.10)', fg: '#E67A00', border: 'rgba(255,136,0,0.15)' },
      dark: { bg: 'rgba(253,172,66,0.15)', fg: '#FDAC42', border: 'rgba(253,172,66,0.20)' },
    },
    technical: {
      light: { bg: 'rgba(85,87,112,0.08)', fg: '#555770', border: 'rgba(85,87,112,0.12)' },
      dark: { bg: 'rgba(143,144,166,0.12)', fg: '#8F90A6', border: 'rgba(143,144,166,0.15)' },
    },
  }
  const s = isDark ? styles[legType].dark : styles[legType].light
  return { background: s.bg, color: s.fg, borderColor: s.border }
}

// ── Status workflow transitions ──

export const STATUS_TRANSITIONS: Record<ContractStatus, { label: string; target: ContractStatus; variant: 'blue' | 'green' | 'amber' | 'teal' | 'red' }[]> = {
  draft: [
    { label: 'Send proposal', target: 'proposed', variant: 'blue' },
  ],
  proposed: [
    { label: 'Confirm', target: 'confirmed', variant: 'green' },
    { label: 'Cancel', target: 'cancelled', variant: 'red' },
  ],
  confirmed: [
    { label: 'Start ops', target: 'operating', variant: 'amber' },
    { label: 'Cancel', target: 'cancelled', variant: 'red' },
  ],
  operating: [
    { label: 'Complete', target: 'completed', variant: 'teal' },
    { label: 'Cancel', target: 'cancelled', variant: 'red' },
  ],
  completed: [],
  cancelled: [],
}

export const TRANSITION_VARIANT_COLORS: Record<string, { bg: string; bgDark: string; text: string; textDark: string }> = {
  blue: { bg: 'rgba(0,99,247,0.10)', bgDark: 'rgba(91,141,239,0.15)', text: '#0063F7', textDark: '#5B8DEF' },
  green: { bg: 'rgba(6,194,112,0.10)', bgDark: 'rgba(57,217,138,0.15)', text: '#06C270', textDark: '#39D98A' },
  amber: { bg: 'rgba(255,136,0,0.10)', bgDark: 'rgba(253,172,66,0.15)', text: '#E67A00', textDark: '#FDAC42' },
  teal: { bg: 'rgba(0,207,222,0.10)', bgDark: 'rgba(115,223,231,0.15)', text: '#00B7C4', textDark: '#73DFE7' },
  red: { bg: 'rgba(255,59,59,0.10)', bgDark: 'rgba(255,92,92,0.15)', text: '#E63535', textDark: '#FF5C5C' },
}
