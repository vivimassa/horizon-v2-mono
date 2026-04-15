import type { DisruptionIssueRef } from '@skyhub/api'

/** Module accent for Operations (2.x) — matches MODULE_THEMES. */
export const OPS_ACCENT = '#4f46e5'

/** Vibrant XD status palette — do not hardcode elsewhere. */
export const SEVERITY_COLOR = {
  critical: '#FF3B3B',
  warning: '#FF8800',
  info: '#0063F7',
} as const

export const CATEGORY_LABEL: Record<DisruptionIssueRef['category'], string> = {
  TAIL_SWAP: 'Tail swap',
  DELAY: 'Delay',
  CANCELLATION: 'Cancellation',
  DIVERSION: 'Diversion',
  CONFIG_CHANGE: 'Config change',
  MISSING_OOOI: 'Missing OOOI',
  MAINTENANCE_RISK: 'Maintenance risk',
  CURFEW_VIOLATION: 'Curfew violation',
  TAT_VIOLATION: 'TAT violation',
}

export const STATUS_LABEL: Record<DisruptionIssueRef['status'], string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}
