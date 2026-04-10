import type { ScheduledFlightRef } from '@skyhub/api'
import type { CellFormat } from './types'

interface ConditionalRule {
  name: string
  condition: (row: ScheduledFlightRef) => boolean
  columns?: string[]
  format: CellFormat
}

const RULES: ConditionalRule[] = [
  {
    name: 'ETOPS route',
    condition: (row) => row.isEtops,
    columns: ['depStation', 'arrStation'],
    format: { bold: true, textColor: '#0063F7' },
  },
  {
    name: 'Overwater route',
    condition: (row) => row.isOverwater,
    columns: ['depStation', 'arrStation'],
    format: { textColor: '#00B7C4' },
  },
]

export function getConditionalFormat(row: ScheduledFlightRef, colKey: string): CellFormat | null {
  for (const rule of RULES) {
    if (rule.condition(row) && (!rule.columns || rule.columns.includes(colKey))) {
      return rule.format
    }
  }
  return null
}
