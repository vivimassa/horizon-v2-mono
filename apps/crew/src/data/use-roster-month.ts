import { useEffect, useState } from 'react'
import { Q } from '@nozbe/watermelondb'
import type { Database } from '@nozbe/watermelondb'
import type { CrewAssignmentRecord, CrewActivityRecord, PairingRecord, PairingLegRecord } from '@skyhub/crew-db'
import type { DutyKind } from '../components/primitives'
import { classifyActivityCode, classifyActivityTitle } from './classify-activity'

export interface RosterDuty {
  type: DutyKind
  title: string
  sub: string
  status?: 'scheduled' | 'delayed' | 'cancelled'
  startUtcMs: number
  endUtcMs: number
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

export function useRosterMonth(database: Database, year: number, monthIdx0: number, refreshKey = 0): MonthData {
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

      const first = legs[0]
      const last = legs[legs.length - 1]
      const dep = first?.depStation ?? pairing?.baseAirport ?? '—'
      const arr = last?.arrStation ?? '—'
      const code = pairing?.pairingCode ?? '—'
      const numLegs = legs.length || 1

      const date = new Date(a.startUtcMs)
      const iso = date.toISOString().slice(0, 10)
      const tHHmm = (ms: number) => {
        const d = new Date(ms)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }

      const duty: RosterDuty = {
        type: 'flight',
        title: `${code} · ${dep} → ${arr}`,
        sub: `${tHHmm(a.startUtcMs)}–${tHHmm(a.endUtcMs)} · ${numLegs} sector${numLegs === 1 ? '' : 's'}`,
        status: 'scheduled',
        startUtcMs: a.startUtcMs,
        endUtcMs: a.endUtcMs,
      }
      ;(dutiesByIso[iso] ??= []).push(duty)
    }

    for (const act of activities) {
      const kind = classifyActivityCode(act.activityCodeId)
      const date = new Date(act.startUtcMs)
      const iso = act.dateIso ?? date.toISOString().slice(0, 10)
      const tHHmm = (ms: number) => {
        const d = new Date(ms)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      const sub = kind === 'rest' ? 'Off duty' : `${tHHmm(act.startUtcMs)}–${tHHmm(act.endUtcMs)}`
      ;(dutiesByIso[iso] ??= []).push({
        type: kind,
        title: classifyActivityTitle(act.activityCodeId),
        sub,
        startUtcMs: act.startUtcMs,
        endUtcMs: act.endUtcMs,
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
  }, [database, year, monthIdx0, refreshKey])

  return { byDom, days, loading, reload: load }
}
