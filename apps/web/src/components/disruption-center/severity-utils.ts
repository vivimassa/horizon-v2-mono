import type { DisruptionIssueRef, OperatorDisruptionResolutionType } from '@skyhub/api'

/** Module accent for Operations (2.x) — matches MODULE_THEMES. */
export const OPS_ACCENT = '#F59E0B'

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

/**
 * Response-time targets per severity. Drives SLA breach counts on the
 * Response Time KPI card. Hardcoded for now; candidate for per-operator
 * configuration in Operator Settings → Disruption targets.
 */
export const SLA_MINUTES: Record<DisruptionIssueRef['severity'], number> = {
  critical: 15,
  warning: 60,
  info: 240,
}

/**
 * Default open-backlog threshold — when exceeded, the Workflow Status
 * card shows a red warning glow. Hardcoded for now; candidate for
 * per-operator configuration alongside SLA_MINUTES.
 */
export const OPEN_BACKLOG_THRESHOLD = 10

/** XD semantic colors for workflow status segments. */
export const STATUS_COLOR: Record<DisruptionIssueRef['status'], string> = {
  open: '#FF3B3B',
  assigned: '#FF8800',
  in_progress: '#0063F7',
  resolved: '#06C270',
  closed: '#8F90A6',
}

/**
 * Default resolution types offered in the Resolve dialog. Per-operator
 * overrides (label/hint/enabled) land via Disruption Customization (2.1.3.3).
 * Keys are keys of historical data — never change them.
 */
export const DEFAULT_RESOLUTION_TYPES: OperatorDisruptionResolutionType[] = [
  { key: 'swap', label: 'Tail swap', hint: 'Aircraft re-assigned to recover the rotation', enabled: true },
  {
    key: 'delay_accepted',
    label: 'Delay accepted',
    hint: 'Operating with a tolerated delay; no further action',
    enabled: true,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    hint: 'Sector cancelled; pax/crew downstream handled separately',
    enabled: true,
  },
  {
    key: 'reroute',
    label: 'Reroute / diversion',
    hint: 'Routing changed to a different sector or station',
    enabled: true,
  },
  {
    key: 'maintenance_cleared',
    label: 'Maintenance cleared',
    hint: 'Underlying MX risk released; aircraft serviceable',
    enabled: true,
  },
  {
    key: 'monitoring_only',
    label: 'Monitoring only',
    hint: 'No action taken; situation observed and acceptable',
    enabled: true,
  },
]

/** Default rolling-period stops (in days) for the filter panel slider. */
export const DEFAULT_ROLLING_STOPS: number[] = [2, 3, 4]
