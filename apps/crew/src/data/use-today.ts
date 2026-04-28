import { useEffect, useState } from 'react'
import { Q } from '@nozbe/watermelondb'
import type { Database } from '@nozbe/watermelondb'
import type { CrewAssignmentRecord, PairingRecord, PairingLegRecord, CrewMessageRecord } from '@skyhub/crew-db'

export interface NextDuty {
  assignment: CrewAssignmentRecord
  pairing: PairingRecord | null
  legs: PairingLegRecord[]
}

export interface HomeData {
  nextDuty: NextDuty | null
  todaysLegs: PairingLegRecord[]
  unreadMessages: number
  recentMessages: CrewMessageRecord[]
  loading: boolean
  reload: () => Promise<void>
}

export function useTodayData(database: Database, refreshKey = 0): HomeData {
  const [nextDuty, setNextDuty] = useState<NextDuty | null>(null)
  const [todaysLegs, setTodaysLegs] = useState<PairingLegRecord[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [recentMessages, setRecentMessages] = useState<CrewMessageRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)

    const now = Date.now()
    const horizon = now + 7 * 86_400_000

    // Next assignment in next 7 days
    const upcoming = (await database
      .get<CrewAssignmentRecord>('crew_assignments')
      .query(
        Q.where('status', Q.notEq('cancelled')),
        Q.where('end_utc_ms', Q.gte(now)),
        Q.where('start_utc_ms', Q.lte(horizon)),
        Q.sortBy('start_utc_ms', Q.asc),
        Q.take(1),
      )
      .fetch()) as CrewAssignmentRecord[]

    let nd: NextDuty | null = null
    if (upcoming[0]) {
      const a = upcoming[0]
      const pairing = (await database
        .get<PairingRecord>('pairings')
        .find(a.pairingId)
        .catch(() => null)) as PairingRecord | null
      const legs = (await database
        .get<PairingLegRecord>('pairing_legs')
        .query(Q.where('pairing_id', a.pairingId), Q.sortBy('leg_order', Q.asc))
        .fetch()) as PairingLegRecord[]
      nd = { assignment: a, pairing, legs }
    }
    setNextDuty(nd)

    // Today's legs (across all of today's assignments)
    const startOfDay = (() => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })()
    const endOfDay = startOfDay + 86_400_000
    const todayLegs = (await database
      .get<PairingLegRecord>('pairing_legs')
      .query(
        Q.where('std_utc_ms', Q.gte(startOfDay)),
        Q.where('std_utc_ms', Q.lt(endOfDay)),
        Q.sortBy('std_utc_ms', Q.asc),
      )
      .fetch()) as PairingLegRecord[]
    setTodaysLegs(todayLegs)

    // Recent messages + unread count
    const allMsgs = (await database
      .get<CrewMessageRecord>('crew_messages')
      .query(Q.sortBy('created_at_ms', Q.desc), Q.take(20))
      .fetch()) as CrewMessageRecord[]
    setRecentMessages(allMsgs.slice(0, 3))
    setUnreadMessages(allMsgs.filter((m) => !m.readAtMs).length)

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [database, refreshKey])

  return { nextDuty, todaysLegs, unreadMessages, recentMessages, loading, reload: load }
}
