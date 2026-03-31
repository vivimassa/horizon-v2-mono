/**
 * Severity definitions for crew expiry tracking.
 *
 * Icon references are stored as string keys (matching lucide icon names)
 * for platform-agnostic usage. Map to actual icon components in the UI layer.
 */

export interface SeverityDefinition {
  key: string
  label: string
  description: string
  /** Lucide icon name — resolve to platform icon in UI layer */
  icon: string
  isDestructive: boolean
}

export const SEVERITY_DEFINITIONS: SeverityDefinition[] = [
  {
    key: 'block_auto_assign',
    label: 'Block Auto-Assignment',
    description: 'Prevents the auto-assignment engine from rostering crew beyond the expiry date',
    icon: 'shield-off',
    isDestructive: false,
  },
  {
    key: 'block_manual_assign',
    label: 'Block Manual Assignment',
    description: 'Warns or prevents schedulers from manually assigning crew with an expired code',
    icon: 'hand',
    isDestructive: false,
  },
  {
    key: 'include_in_reports',
    label: 'Include in Expiry Reports',
    description: 'This code appears in the crew expiry monitoring reports and dashboards',
    icon: 'bar-chart-3',
    isDestructive: false,
  },
  {
    key: 'show_validation_warning',
    label: 'Show Validation Warnings',
    description: 'Displays warnings in roster validation when expiry is approaching or breached',
    icon: 'alert-triangle',
    isDestructive: false,
  },
  {
    key: 'expire_on_failure',
    label: 'Immediate Expiry on Failure',
    description: 'If linked training is failed, the expiry date is set to the failure date — crew is grounded',
    icon: 'x-octagon',
    isDestructive: true,
  },
  {
    key: 'auto_renew',
    label: 'Auto-Renew on Completion',
    description: 'Automatically extends the expiry date when linked training or flight duty is completed',
    icon: 'rotate-ccw',
    isDestructive: false,
  },
]
