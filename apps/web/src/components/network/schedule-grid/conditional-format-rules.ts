// Network Scheduling XL — Conditional Formatting Rules
// Auto-applied visual rules based on cell values

import type { ScheduledFlightRef } from '@skyhub/api'
import type { CellFormat } from './types'

interface ConditionalRule {
  name: string
  condition: (row: ScheduledFlightRef) => boolean
  columns?: string[]
  format: CellFormat
}

export const CONDITIONAL_RULES: ConditionalRule[] = [
  // ETOPS flights — blue highlight on DEP/ARR
  {
    name: 'ETOPS route',
    condition: (row) => row.isEtops,
    columns: ['depStation', 'arrStation'],
    format: { textColor: '#0063F7', bold: true },
  },

  // Overwater flights — teal highlight on DEP/ARR
  {
    name: 'Overwater route',
    condition: (row) => row.isOverwater,
    columns: ['depStation', 'arrStation'],
    format: { textColor: '#00B7C4' },
  },
]

/** Get the conditional format for a specific cell */
export function getConditionalFormat(row: ScheduledFlightRef, colKey: string): CellFormat | null {
  for (const rule of CONDITIONAL_RULES) {
    if (!rule.condition(row)) continue
    if (rule.columns && !rule.columns.includes(colKey)) continue
    return rule.format
  }
  return null
}
