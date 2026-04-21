'use client'

import { formatDate, type DateFormatType } from '@skyhub/logic'
import { useOperatorStore } from '@/stores/use-operator-store'

/**
 * Hook that returns a function for rendering dates in the operator's
 * configured format (Settings → Admin → Operator Config). All date strings
 * in the system are stored as ISO `YYYY-MM-DD`; this helper converts them
 * to the display form without each call-site having to thread the format
 * through props.
 *
 * Usage:
 *   const fmt = useDateFormat()
 *   return <span>{fmt(crew.dateOfBirth)}</span>
 *
 * Empty / invalid input → em-dash so UI rows can render consistently.
 */
export function useDateFormat(): (iso: string | null | undefined) => string {
  const format: DateFormatType = useOperatorStore((s) => s.dateFormat)
  return (iso) => {
    if (!iso) return '—'
    return formatDate(iso, format) || '—'
  }
}
