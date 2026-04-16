import { getApiBaseUrl } from '@skyhub/api'
import { authedFetch } from '../authed-fetch'
import type { FlightDetail } from './flight-detail-types'

export async function fetchFlightDetail(
  scheduledFlightId: string,
  operatingDate: string,
  operatorId: string,
): Promise<FlightDetail> {
  const params = new URLSearchParams({ operatorId, sfId: scheduledFlightId, opDate: operatingDate })
  const res = await authedFetch(`${getApiBaseUrl()}/gantt/flight-detail?${params}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

export async function saveFlightInstance(data: {
  operatorId: string
  scheduledFlightId: string
  operatingDate: string
  flightNumber: string
  actual: FlightDetail['actual']
  estimated?: FlightDetail['estimated']
  depInfo: FlightDetail['depInfo']
  arrInfo: FlightDetail['arrInfo']
  pax?: FlightDetail['pax']
  fuel?: FlightDetail['fuel']
  cargo?: FlightDetail['cargo']
  delays?: FlightDetail['delays']
  memos?: FlightDetail['memos']
  connections?: FlightDetail['connections']
  scenarioId?: string | null
}): Promise<{ success: boolean; id: string }> {
  const res = await authedFetch(`${getApiBaseUrl()}/gantt/flight-instance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

// ── Flight action endpoints (AIMS 2.1.1 §5.3, §5.4) ──

export async function applyFlightDisruption(
  flightInstanceId: string,
  body: {
    kind: 'divert' | 'airReturn' | 'rampReturn' | 'none'
    divertAirportIcao?: string | null
    ataUtc?: number | null
    etaUtc?: number | null
    reasonCode?: string | null
    reasonText?: string | null
    nextFlightNumber?: string | null
    nextEtdUtc?: number | null
    doNotGenerateNextFlight?: boolean
  },
): Promise<void> {
  const res = await authedFetch(
    `${getApiBaseUrl()}/gantt/flight-instance/${encodeURIComponent(flightInstanceId)}/disruption`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
}

export async function delayFlight(
  flightInstanceId: string,
  body: { newEtdUtc: number; delayCode: string; delayMinutes: number; reason?: string },
): Promise<void> {
  const res = await authedFetch(
    `${getApiBaseUrl()}/gantt/flight-instance/${encodeURIComponent(flightInstanceId)}/delay`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
}

export async function rescheduleFlight(
  flightInstanceId: string,
  body: { newEtdUtc: number; newEtaUtc?: number | null; reason?: string },
): Promise<void> {
  const res = await authedFetch(
    `${getApiBaseUrl()}/gantt/flight-instance/${encodeURIComponent(flightInstanceId)}/reschedule`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
}

export async function setJumpseaters(
  flightInstanceId: string,
  jumpSeaters: Array<{
    kind: 'crew' | 'nonCrew'
    personId: string
    name: string
    company?: string | null
    department?: string | null
  }>,
): Promise<void> {
  const res = await authedFetch(
    `${getApiBaseUrl()}/gantt/flight-instance/${encodeURIComponent(flightInstanceId)}/jumpseaters`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jumpSeaters }),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
}
