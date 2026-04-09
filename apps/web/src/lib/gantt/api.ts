import type { GanttApiResponse } from './types'
import type { OptimizerStats, ChainBreak, TypeBreakdown } from './tail-optimizer'

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
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gantt API ${res.status}: ${body}`)
  }
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
  // Chunk large requests to avoid timeouts
  const CHUNK = 3000
  let totalUpdated = 0
  for (let i = 0; i < flightIds.length; i += CHUNK) {
    const chunk = flightIds.slice(i, i + CHUNK)
    const res = await fetch(`${API_BASE}/gantt/unassign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorId, flightIds: chunk }),
    })
    if (!res.ok) throw new Error(`Unassign API ${res.status}`)
    const data = await res.json()
    totalUpdated += data.updated
  }
  return { updated: totalUpdated }
}

export async function bulkAssignFlights(
  operatorId: string,
  assignments: { registration: string; flightIds: string[] }[],
): Promise<{ updated: number; verified?: number }> {
  const res = await fetch(`${API_BASE}/gantt/bulk-assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId, assignments }),
  })
  if (!res.ok) throw new Error(`Bulk assign API ${res.status}`)
  return res.json()
}

export async function cancelFlights(
  operatorId: string,
  flightIds: string[],
): Promise<{ removed: number }> {
  const res = await fetch(`${API_BASE}/gantt/remove-from-date`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId, flightIds }),
  })
  if (!res.ok) throw new Error(`Cancel API ${res.status}`)
  return res.json()
}

export async function swapFlights(
  operatorId: string,
  aFlightIds: string[],
  bRegistration: string | null,
  bFlightIds: string[],
  aRegistration: string | null,
): Promise<{ updated: number }> {
  const res = await fetch(`${API_BASE}/gantt/swap`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorId, aFlightIds, aRegistration, bFlightIds, bRegistration }),
  })
  if (!res.ok) throw new Error(`Swap API ${res.status}`)
  return res.json()
}

// ── Optimizer Runs ──

export interface OptimizerRunSummary {
  _id: string
  name: string
  periodFrom: string
  periodTo: string
  config: { preset: string; method: string }
  stats: OptimizerStats
  overflowFlightIds: string[]
  chainBreaks: ChainBreak[]
  typeBreakdown: TypeBreakdown[]
  elapsedMs: number
  createdAt: string
}

export interface OptimizerRunFull extends OptimizerRunSummary {
  assignments: { flightId: string; registration: string }[]
}

export async function saveOptimizerRun(
  operatorId: string,
  run: Omit<OptimizerRunFull, '_id' | 'createdAt'> & { operatorId?: string },
): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/gantt/optimizer/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...run, operatorId }),
  })
  if (!res.ok) throw new Error(`Save optimizer run API ${res.status}`)
  return res.json()
}

export async function listOptimizerRuns(
  operatorId: string,
  periodFrom: string,
  periodTo: string,
): Promise<OptimizerRunSummary[]> {
  const qs = new URLSearchParams({ operatorId, periodFrom, periodTo })
  const res = await fetch(`${API_BASE}/gantt/optimizer/runs?${qs}`)
  if (!res.ok) throw new Error(`List optimizer runs API ${res.status}`)
  return res.json()
}

export async function getOptimizerRun(
  operatorId: string,
  runId: string,
): Promise<OptimizerRunFull> {
  const qs = new URLSearchParams({ operatorId })
  const res = await fetch(`${API_BASE}/gantt/optimizer/runs/${runId}?${qs}`)
  if (!res.ok) throw new Error(`Get optimizer run API ${res.status}`)
  return res.json()
}

export async function deleteOptimizerRun(
  operatorId: string,
  runId: string,
): Promise<{ removed: number }> {
  const qs = new URLSearchParams({ operatorId })
  const res = await fetch(`${API_BASE}/gantt/optimizer/runs/${runId}?${qs}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete optimizer run API ${res.status}`)
  return res.json()
}
