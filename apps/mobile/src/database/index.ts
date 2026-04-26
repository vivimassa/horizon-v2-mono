// WatermelonDB bootstrap. Disabled at runtime until the dep is installed
// (`pnpm i` + `pod install`). Returns null so callers fall back to the
// MMKV cache. To enable: install @nozbe/watermelondb, run pod install,
// then replace the body of getGanttDatabase with the real adapter + Database
// init shown in the comment below.

export function getGanttDatabase(): unknown {
  return null
  /*
   * import { Database } from '@nozbe/watermelondb'
   * import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
   * import { GANTT_SCHEMA } from './schema'
   * import {
   *   GanttFlightInstanceModel, GanttAircraftModel,
   *   GanttAircraftTypeModel, GanttPendingMutationModel,
   * } from './models/gantt-flight-instance'
   *
   * const adapter = new SQLiteAdapter({ schema: GANTT_SCHEMA, dbName: 'skyhubGantt', jsi: true })
   * return new Database({
   *   adapter,
   *   modelClasses: [GanttFlightInstanceModel, GanttAircraftModel, GanttAircraftTypeModel, GanttPendingMutationModel],
   * })
   */
}

// Model classes live in ./models/gantt-flight-instance — re-exported only
// once the WatermelonDB dep is wired live (see comment in getGanttDatabase).
