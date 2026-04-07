import type { GanttApiResponse } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

export async function fetchGanttFlights(params: {
  operatorId: string
  from: string
  to: string
  scenarioId?: string
  acTypeFilter?: string[]
  statusFilter?: string[]
}): Promise<GanttApiResponse> {
  const qs = new URLSearchParams({
    operatorId: params.operatorId,
    from: params.from,
    to: params.to,
  })
  if (params.scenarioId) qs.set('scenarioId', params.scenarioId)
  if (params.acTypeFilter?.length) qs.set('acTypeFilter', params.acTypeFilter.join(','))
  if (params.statusFilter?.length) qs.set('statusFilter', params.statusFilter.join(','))

  const res = await fetch(`${API_BASE}/gantt/flights?${qs}`)
  if (!res.ok) throw new Error(`Gantt API ${res.status}`)
  return res.json()
}

export async function assignFlights(
  operatorId: string,
  flightIds: string[],
  registration: string,
): Promise<{ updated: number }> {
  const res = await fetch(`${API_BASE}/gantt/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId, flightIds, registration }),
  })
  if (!res.ok) throw new Error(`Assign API ${res.status}`)
  return res.json()
}

export async function unassignFlights(
  operatorId: string,
  flightIds: string[],
): Promise<{ updated: number }> {
  const res = await fetch(`${API_BASE}/gantt/unassign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId, flightIds }),
  })
  if (!res.ok) throw new Error(`Unassign API ${res.status}`)
  return res.json()
}
