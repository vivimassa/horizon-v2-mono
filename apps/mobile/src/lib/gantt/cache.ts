// Lightweight period cache for the mobile Gantt. Backed by AsyncStorage so
// it runs in Expo Go (MMKV requires Nitro Modules which need a custom dev
// build). Used as a fallback when the network call fails so the user can
// keep browsing the last successful period offline. The full WatermelonDB
// model is the longer-term Phase 9 target — this file is the bridge.

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { GanttApiResponse } from '@skyhub/types'

interface PeriodKey {
  operatorId: string
  from: string
  to: string
  scenarioId?: string | null
}

function periodKey(k: PeriodKey): string {
  return `gantt-cache|period|${k.operatorId}|${k.from}|${k.to}|${k.scenarioId ?? ''}`
}

export interface CachedPeriod {
  data: Pick<GanttApiResponse, 'flights' | 'aircraft' | 'aircraftTypes'>
  fetchedAt: number
}

export async function readCachedPeriod(k: PeriodKey): Promise<CachedPeriod | null> {
  try {
    const raw = await AsyncStorage.getItem(periodKey(k))
    if (!raw) return null
    return JSON.parse(raw) as CachedPeriod
  } catch {
    return null
  }
}

export async function writeCachedPeriod(k: PeriodKey, data: CachedPeriod['data']): Promise<void> {
  try {
    const payload: CachedPeriod = { data, fetchedAt: Date.now() }
    await AsyncStorage.setItem(periodKey(k), JSON.stringify(payload))
  } catch {
    /* ignore — cache is best-effort */
  }
}

// ── Pending mutation queue ──

const QUEUE_KEY = 'gantt-pending-mutations'

export interface PendingMutation {
  id: string
  kind: 'assign' | 'unassign' | 'cancel' | 'reschedule' | 'swap' | 'divert' | 'create'
  payload: Record<string, unknown>
  queuedAt: number
}

export async function listPending(): Promise<PendingMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PendingMutation[]
  } catch {
    return []
  }
}

export async function enqueuePending(m: Omit<PendingMutation, 'id' | 'queuedAt'>): Promise<PendingMutation> {
  const item: PendingMutation = {
    ...m,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
  }
  const list = await listPending()
  list.push(item)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list))
  return item
}

export async function dequeuePending(id: string): Promise<void> {
  const list = (await listPending()).filter((m) => m.id !== id)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list))
}

export async function clearPending(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY)
}
