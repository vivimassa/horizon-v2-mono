// Bridge between the WatermelonDB layer and the Gantt store. While the
// native dep is uninstalled, every function is a no-op so callers fall back
// to the MMKV cache (apps/mobile/src/lib/gantt/cache.ts). Once
// @nozbe/watermelondb is installed and `getGanttDatabase()` returns a real
// instance, swap these stubs for the implementation shown in the comment
// below — the read/write logic lived in this file at git tag pre-wmdb.

import type { GanttFlight, GanttAircraft, GanttAircraftType } from '@skyhub/types'
import { getGanttDatabase } from '../../database'

interface CachedPeriod {
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  fetchedAt: number
}

interface PeriodKey {
  operatorId: string
  from: string
  to: string
  scenarioId?: string | null
}

export async function readCachedPeriodFromWmdb(_key: PeriodKey): Promise<CachedPeriod | null> {
  if (!getGanttDatabase()) return null
  return null
}

export async function writeCachedPeriodToWmdb(
  _key: PeriodKey,
  _data: { flights: GanttFlight[]; aircraft: GanttAircraft[]; aircraftTypes: GanttAircraftType[] },
): Promise<void> {
  if (!getGanttDatabase()) return
}

export async function enqueuePendingToWmdb(
  _operatorId: string,
  _kind: string,
  _payload: Record<string, unknown>,
): Promise<boolean> {
  if (!getGanttDatabase()) return false
  return false
}

export async function listPendingFromWmdb(_operatorId: string): Promise<number> {
  if (!getGanttDatabase()) return 0
  return 0
}
