import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Database } from '@nozbe/watermelondb'
import { createCrewDatabase } from '@skyhub/crew-db'

const DatabaseContext = createContext<Database | null>(null)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  // Single DB instance for the lifetime of the app — recreated only on
  // hard reload. Logout wipes via database.unsafeResetDatabase().
  const database = useMemo(() => createCrewDatabase(), [])
  return <DatabaseContext.Provider value={database}>{children}</DatabaseContext.Provider>
}

export function useDatabase(): Database {
  const db = useContext(DatabaseContext)
  if (!db) throw new Error('useDatabase must be used inside <DatabaseProvider>')
  return db
}
