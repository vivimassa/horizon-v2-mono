import { useEffect, useState } from 'react'
import { Q } from '@nozbe/watermelondb'
import type { Database } from '@nozbe/watermelondb'
import type { CrewAssignmentRecord, CrewActivityRecord, PairingRecord, PairingLegRecord } from '@skyhub/crew-db'
import type { ActivityCodeMeta } from '../lib/api-client'
import type { DutyKind } from '../components/primitives'
import { classifyActivityCode, classifyActivityTitle } from './classify-activity'

export interface RosterDuty {
  /** assignment._id for flight duties, activity._id for activities. Used for /duty/[id] or /activity/[id] nav. */
  id: string
  kind: 'flight' | 'activity'
  type: DutyKind
  title: string
  sub: string
  status?: 'scheduled' | 'delayed' | 'cancelled'
  startUtcMs: number
  endUtcMs: number
  blockMinutes: number
  /** Original activityCodeId for activity rows (so detail screen can look up). */
  activityCodeId?: string
  /** pairingId for flight rows. */
  pairingId?: string
}

export interface RosterDay {
  iso: string
  dom: number
  dayOfWeek: string
  duties: RosterDuty[]
}

export interface MonthData {
  byDom: Record<number, RosterDuty[]>
  days: RosterDay[]
  loading: boolean
  reload: () => Promise<void>
}

export function useRosterMonth(
  database: Database,
  year: number,
  monthIdx0: number,
  activityCodesById: Map<string, ActivityCodeMeta>,
  refreshKey = 0,
): MonthData {
  const [byDom, setByDom] = useState<Record<number, RosterDuty[]>>({})
  const [days, setDays] = useState<RosterDay[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const monthStart = new Date(year, monthIdx0, 1).getTime()
    const monthEnd = new Date(year, monthIdx0 + 1, 1).getTime()

    const assignments = (await database
      .get<CrewAssignmentRecord>('crew_assignments')
      .query(
        Q.where('status', Q.notEq('cancelled')),
        Q.where('end_utc_ms', Q.gte(monthStart)),
        Q.where('start_utc_ms', Q.lt(monthEnd)),
        Q.sortBy('start_utc_ms', Q.asc),
      )
      .fetch()) as CrewAssignmentRecord[]

    const activities = (await database
      .get<CrewActivityRecord>('crew_activities')
      .query(
        Q.where('end_utc_ms', Q.gte(monthStart)),
        Q.where('start_utc_ms', Q.lt(monthEnd)),
        Q.sortBy('start_utc_ms', Q.asc),
      )
      .fetch()) as CrewActivityRecord[]

    const dutiesByIso: Record<string, RosterDuty[]> = {}

    for (const a of assignments) {
      const pairing = (await database
        .get<PairingRecord>('pairings')
        .find(a.pairingId)
        .catch(() => null)) as PairingRecord | null
      const legs = (await database
        .get<PairingLegRecord>('pairing_legs')
        .query(Q.where('pairing_id', a.pairingId), Q.sortBy('leg_order', Q.asc))
        .fetch()) as PairingLegRecord[]

      // Build full sector chain: HAN → BKK → HAN
      const codes: string[] =
        legs.length > 0
          ? [legs[0].depStation, ...legs.map((l) => l.arrStation)]
          : pairing?.baseAirport
            ? [pairing.baseAirport, '—']
            : ['—', '—']
      const code = pairing?.pairingCode ?? '—'
      const numLegs = legs.length || 1
      const totalBlock = legs.reduce((s, l) => s + (l.blockMinutes ?? 0), 0)

      const date = new Date(a.startUtcMs)
      const iso = date.toISOString().slice(0, 10)
      const tHHmm = (ms: number) => {
        const d = new Date(ms)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }

      const duty: RosterDuty = {
        id: a.id,
        kind: 'flight',
        type: 'flight',
        title: `${code} · ${codes.join(' → ')}`,
        sub: `${tHHmm(a.startUtcMs)}–${tHHmm(a.endUtcMs)} · ${numLegs} sector${numLegs === 1 ? '' : 's'}`,
        status: 'scheduled',
        startUtcMs: a.startUtcMs,
        endUtcMs: a.endUtcMs,
        blockMinutes: totalBlock,
        pairingId: a.pairingId,
      }
      ;(dutiesByIso[iso] ??= []).push(duty)
    }

    for (const act of activities) {
      const meta = activityCodesById.get(act.activityCodeId)
      const kind: DutyKind = meta ? classifyActivityKindFromMeta(meta) : classifyActivityCode(act.activityCodeId)
      const title = meta?.name ?? classifyActivityTitle(act.activityCodeId)
      const date = new Date(act.startUtcMs)
      const iso = act.dateIso ?? date.toISOString().slice(0, 10)
      const tHHmm = (ms: number) => {
        const d = new Date(ms)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      const sub =
        kind === 'rest' ? 'Off duty' : `${tHHmm(act.startUtcMs)}–${tHHmm(act.endUtcMs)}${meta ? ` · ${meta.code}` : ''}`
      ;(dutiesByIso[iso] ??= []).push({
        id: act.id,
        kind: 'activity',
        type: kind,
        title,
        sub,
        startUtcMs: act.startUtcMs,
        endUtcMs: act.endUtcMs,
        blockMinutes: 0,
        activityCodeId: act.activityCodeId,
      })
    }

    const byDomLocal: Record<number, RosterDuty[]> = {}
    const daysList: RosterDay[] = []
    const dim = new Date(year, monthIdx0 + 1, 0).getDate()
    for (let dom = 1; dom <= dim; dom++) {
      const d = new Date(year, monthIdx0, dom)
      const iso = d.toISOString().slice(0, 10)
      const duties = dutiesByIso[iso] ?? []
      byDomLocal[dom] = duties
      if (duties.length > 0) {
        daysList.push({
          iso,
          dom,
          dayOfWeek: d.toLocaleDateString(undefined, { weekday: 'short' }),
          duties,
        })
      }
    }

    setByDom(byDomLocal)
    setDays(daysList)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [database, year, monthIdx0, refreshKey, activityCodesById])

  return { byDom, days, loading, reload: load }
}

/**
 * Map an ActivityCode (with its `flags[]`) to a DutyKind. Operator-
 * configured flags are the source of truth — typical flags include
 * 'rest', 'standby', 'training', 'duty'.
 */
function classifyActivityKindFromMeta(meta: ActivityCodeMeta): DutyKind {
  const f = (meta.flags ?? []).map((x) => x.toLowerCase())
  if (f.includes('rest') || /OFF/i.test(meta.code) || /DOFF/i.test(meta.code)) return 'rest'
  if (f.includes('standby') || /STBY/i.test(meta.code) || /STAND/i.test(meta.code)) return 'standby'
  if (f.includes('training') || /SIM/i.test(meta.code) || /TRN/i.test(meta.code) || /TRAIN/i.test(meta.code))
    return 'training'
  return 'ground'
}
