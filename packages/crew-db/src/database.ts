import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { crewSchema } from './schema.js'
import { CrewAssignmentRecord } from './models/CrewAssignment.js'
import { PairingRecord } from './models/Pairing.js'
import { PairingLegRecord } from './models/PairingLeg.js'
import { CrewActivityRecord } from './models/CrewActivity.js'
import { CrewMessageRecord } from './models/CrewMessage.js'
import { CrewProfileRecord } from './models/CrewProfile.js'

/**
 * Create a Database instance for the SkyHub Crew app.
 *
 * Call once at app boot inside a <DatabaseProvider> wrapper. The DB file
 * lives in app-private storage (SQLite). On logout we wipe via
 * `database.write(() => database.unsafeResetDatabase())`.
 */
export function createCrewDatabase(opts: { dbName?: string } = {}): Database {
  const adapter = new SQLiteAdapter({
    dbName: opts.dbName ?? 'skyhub_crew',
    schema: crewSchema,
    jsi: true,
    onSetUpError: (error) => {
      console.error('[crew-db] SQLite setup error', error)
    },
  })

  return new Database({
    adapter,
    modelClasses: [
      CrewAssignmentRecord,
      PairingRecord,
      PairingLegRecord,
      CrewActivityRecord,
      CrewMessageRecord,
      CrewProfileRecord,
    ],
  })
}
