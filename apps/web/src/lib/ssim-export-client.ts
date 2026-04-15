/**
 * Thin client for the Fastify GET /ssim/export endpoint
 * (server/src/routes/ssim.ts). Drives the 1.2.2 SSIM Export workspace.
 *
 * Returns the file body as a Blob plus the record count + filename which
 * the server surfaces via custom headers (X-Ssim-Flight-Count,
 * X-Ssim-Filename) so the UI can show counts without re-parsing the file.
 */

import { getApiBaseUrl } from '@skyhub/api'
import { authedFetch } from './authed-fetch'
import { getOperatorId } from '@/stores/use-operator-store'

export type SsimExportActionCode = 'H' | 'N' | 'R'
export type SsimExportTimeMode = 'local' | 'utc'

export interface SsimExportFilters {
  /** YYYY-MM-DD overlap window. Both required if either is set. */
  dateFrom: string
  dateTo: string
  /** Numeric range. Inclusive. Empty = no bound. */
  flightNumFrom: string
  flightNumTo: string
  /** ICAO codes. Empty = all stations. */
  depStations: string[]
  arrStations: string[]
  /** Single-char IATA service types (J, S, U, C, F, …). Empty = all. */
  serviceTypes: string[]
  /** SSIM action code stamped into the Type 2 record. */
  actionCode: SsimExportActionCode
  /** Time-format mode for output. */
  timeMode: SsimExportTimeMode
}

export interface SsimExportResult {
  blob: Blob
  filename: string
  flightCount: number
}

export async function exportSsimText(filters: SsimExportFilters): Promise<SsimExportResult> {
  const params = new URLSearchParams({
    operatorId: getOperatorId(),
    format: 'ssim',
    timeMode: filters.timeMode,
    actionCode: filters.actionCode,
  })
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.flightNumFrom) params.set('flightNumFrom', filters.flightNumFrom)
  if (filters.flightNumTo) params.set('flightNumTo', filters.flightNumTo)
  if (filters.depStations.length > 0) params.set('depStations', filters.depStations.join(','))
  if (filters.arrStations.length > 0) params.set('arrStations', filters.arrStations.join(','))
  if (filters.serviceTypes.length > 0) params.set('serviceTypes', filters.serviceTypes.join(','))

  const url = `${getApiBaseUrl()}/ssim/export?${params.toString()}`
  const res = await authedFetch(url, { method: 'GET' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = (data as { error?: string }).error ?? `${res.status} ${res.statusText}`
    throw new Error(msg)
  }

  const blob = await res.blob()
  const filename =
    parseContentDispositionFilename(res.headers.get('Content-Disposition')) ??
    res.headers.get('X-Ssim-Filename') ??
    defaultFilename()
  const countHeader = res.headers.get('X-Ssim-Flight-Count')
  const flightCount = countHeader ? parseInt(countHeader, 10) || 0 : 0

  return { blob, filename, flightCount }
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/filename\*?=(?:"([^"]+)"|([^;]+))/i)
  if (!match) return null
  return (match[1] || match[2] || '').trim() || null
}

function defaultFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `SSIM_export_${stamp}.ssim`
}
