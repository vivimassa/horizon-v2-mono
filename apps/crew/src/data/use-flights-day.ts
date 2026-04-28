import { useEffect, useState } from 'react'
import { Q } from '@nozbe/watermelondb'
import type { Database } from '@nozbe/watermelondb'
import type { PairingLegRecord } from '@skyhub/crew-db'

export interface DayFlights {
  legs: PairingLegRecord[]
  loading: boolean
  reload: () => Promise<void>
}

/**
 * Returns all pairing legs whose STD falls within the given local-day
 * window. We use device-local midnight (Phase A); Phase B will resolve via
 * base-airport tz so a crew member based in HAN sees their own day.
 */
export function useFlightsDay(database: Database, dayStartLocalMs: number, refreshKey = 0): DayFlights {
  const [legs, setLegs] = useState<PairingLegRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const end = dayStartLocalMs + 86_400_000
    const rows = (await database
      .get<PairingLegRecord>('pairing_legs')
      .query(
        Q.where('std_utc_ms', Q.gte(dayStartLocalMs)),
        Q.where('std_utc_ms', Q.lt(end)),
        Q.sortBy('std_utc_ms', Q.asc),
      )
      .fetch()) as PairingLegRecord[]
    setLegs(rows)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [database, dayStartLocalMs, refreshKey])

  return { legs, loading, reload: load }
}
