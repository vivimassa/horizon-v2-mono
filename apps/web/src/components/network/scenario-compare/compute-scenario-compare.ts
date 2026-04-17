import type { ScheduledFlightRef } from '@skyhub/api'
import type {
  ChangeField,
  DiffRow,
  DiffRowCell,
  DiffStatus,
  FlightSet,
  FlightSnapshot,
  FlightStatus,
  ScenarioCompareResult,
  ScenarioStats,
} from './scenario-compare-types'

// Pairing key excludes equipment and time fields so that time/equipment changes
// keep the flights paired as "modified". Route changes (dep/arr) break pairing
// into +Added / -Removed — matching the server diff engine's RRT semantics.
function pairingKey(f: ScheduledFlightRef | FlightSnapshot): string {
  return [f.flightNumber, f.depStation, f.arrStation, f.effectiveFrom, f.daysOfWeek].join('|')
}

function withinPeriod(f: ScheduledFlightRef, from: string, to: string): boolean {
  const fromTruncated = from.slice(0, 10)
  const toTruncated = to.slice(0, 10)
  const fEff = f.effectiveFrom.slice(0, 10)
  const uEff = f.effectiveUntil.slice(0, 10)
  return fEff <= toTruncated && uEff >= fromTruncated
}

function toSnapshot(f: ScheduledFlightRef): FlightSnapshot {
  return {
    id: f._id,
    flightNumber: f.flightNumber,
    depStation: f.depStation,
    arrStation: f.arrStation,
    stdUtc: f.stdUtc,
    staUtc: f.staUtc,
    aircraftTypeIcao: f.aircraftTypeIcao ?? null,
    blockMinutes: f.blockMinutes ?? null,
    daysOfWeek: f.daysOfWeek,
    serviceType: f.serviceType ?? null,
    status: (f.status as FlightStatus) ?? 'draft',
    effectiveFrom: f.effectiveFrom,
    effectiveUntil: f.effectiveUntil,
  }
}

const EMPTY_BREAKDOWN: Record<FlightStatus, number> = { draft: 0, active: 0, suspended: 0, cancelled: 0 }

export function computeScenarioStats(flights: FlightSnapshot[]): ScenarioStats {
  const stations = new Set<string>()
  const routes = new Set<string>()
  const types = new Set<string>()
  const breakdown: Record<FlightStatus, number> = { ...EMPTY_BREAKDOWN }
  let blockMinutes = 0
  let sectors = 0
  for (const f of flights) {
    stations.add(f.depStation)
    stations.add(f.arrStation)
    routes.add(`${f.depStation}-${f.arrStation}`)
    if (f.aircraftTypeIcao) types.add(f.aircraftTypeIcao)
    breakdown[f.status] = (breakdown[f.status] ?? 0) + 1
    if (f.status !== 'cancelled') sectors += 1
    blockMinutes += f.blockMinutes ?? 0
  }
  return {
    totalFlights: flights.length,
    totalSectors: sectors,
    totalBlockHours: Math.round((blockMinutes / 60) * 10) / 10,
    uniqueStations: stations.size,
    uniqueRoutes: routes.size,
    aircraftTypes: [...types].sort(),
    statusBreakdown: breakdown,
  }
}

function diffFields(a: FlightSnapshot, b: FlightSnapshot): ChangeField[] {
  const out: ChangeField[] = []
  if (a.stdUtc !== b.stdUtc) out.push('stdUtc')
  if (a.staUtc !== b.staUtc) out.push('staUtc')
  if ((a.aircraftTypeIcao ?? '') !== (b.aircraftTypeIcao ?? '')) out.push('aircraftTypeIcao')
  if ((a.blockMinutes ?? 0) !== (b.blockMinutes ?? 0)) out.push('blockMinutes')
  if (a.daysOfWeek !== b.daysOfWeek) out.push('daysOfWeek')
  if ((a.serviceType ?? '') !== (b.serviceType ?? '')) out.push('serviceType')
  if (a.status !== b.status) out.push('status')
  return out
}

interface ComputeOptions {
  periodFrom: string
  periodTo: string
}

export function computeScenarioCompare(sets: FlightSet[], opts: ComputeOptions): ScenarioCompareResult {
  // Build per-scenario keyed maps of snapshots within the date range.
  const keyedByScenario = sets.map(({ scenarioId, flights }) => {
    const map = new Map<string, FlightSnapshot>()
    for (const f of flights) {
      if (!withinPeriod(f, opts.periodFrom, opts.periodTo)) continue
      map.set(pairingKey(f), toSnapshot(f))
    }
    return { scenarioId, map }
  })

  const perScenario = keyedByScenario.map(({ scenarioId, map }) => ({
    scenarioId,
    stats: computeScenarioStats([...map.values()]),
  }))

  // Union of all pairing keys across selected scenarios.
  const allKeys = new Set<string>()
  for (const { map } of keyedByScenario) for (const key of map.keys()) allKeys.add(key)

  const rows: DiffRow[] = []

  for (const key of allKeys) {
    const cells: DiffRowCell[] = keyedByScenario.map(({ scenarioId, map }) => ({
      scenarioId,
      snap: map.get(key) ?? null,
      changedFields: [],
    }))

    // Pick a reference snapshot for the row header (first non-null).
    const ref = cells.find((c) => c.snap !== null)?.snap
    if (!ref) continue

    const presentCount = cells.filter((c) => c.snap !== null).length
    const totalCount = cells.length

    let overallStatus: DiffStatus
    if (presentCount === totalCount) {
      // All scenarios have this flight — check field divergence pairwise against ref.
      const [first, ...rest] = cells
      if (first.snap) {
        for (const c of rest) {
          if (!c.snap) continue
          c.changedFields = diffFields(first.snap, c.snap)
        }
        // Tag the first cell's changed fields as the union of diffs reported on others.
        const firstChanged = new Set<ChangeField>()
        for (const c of rest) for (const field of c.changedFields) firstChanged.add(field)
        first.changedFields = [...firstChanged]
      }
      const anyDiverged = cells.some((c) => c.changedFields.length > 0)
      overallStatus = anyDiverged ? 'modified' : 'unchanged'
    } else if (presentCount === 1 && totalCount > 1) {
      // Only one scenario has it — treat first-in-order as baseline for semantics.
      overallStatus = cells[0].snap ? 'removed' : 'added'
    } else {
      // Mixed partial presence in 3-way. Call it 'modified' to surface in the diff table.
      overallStatus = 'modified'
    }

    rows.push({
      key,
      flightNumber: ref.flightNumber,
      depStation: ref.depStation,
      arrStation: ref.arrStation,
      effectiveFrom: ref.effectiveFrom,
      daysOfWeek: ref.daysOfWeek,
      perScenario: cells,
      overallStatus,
    })
  }

  // Stable sort: modified/added/removed first, then by flight number.
  const rank: Record<DiffStatus, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 }
  rows.sort((a, b) => {
    const d = rank[a.overallStatus] - rank[b.overallStatus]
    if (d !== 0) return d
    return a.flightNumber.localeCompare(b.flightNumber)
  })

  return { perScenario, rows }
}
