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
  depInfo: FlightDetail['depInfo']
  arrInfo: FlightDetail['arrInfo']
  pax?: FlightDetail['pax']
  fuel?: FlightDetail['fuel']
  cargo?: FlightDetail['cargo']
  delays?: FlightDetail['delays']
  memos?: FlightDetail['memos']
  connections?: FlightDetail['connections']
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
