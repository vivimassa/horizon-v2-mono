import { appSchema, tableSchema } from '@nozbe/watermelondb'

/**
 * SkyHub Crew local database — WatermelonDB schema.
 *
 * Mirrors the wire shape of GET /crew-app/sync/pull. Every table is
 * crew-scoped (the server filters by JWT crewId; this schema exists to
 * make local queries fast and offline reads possible).
 *
 * No operator_id column on most rows — the entire local DB belongs to a
 * single logged-in crew member. When a crew member logs out we wipe the
 * DB (sync_strategy.ts handles teardown).
 */
export const crewSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'crew_assignments',
      columns: [
        { name: 'pairing_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' },
        { name: 'start_utc_ms', type: 'number', isIndexed: true },
        { name: 'end_utc_ms', type: 'number' },
        { name: 'seat_position_id', type: 'string' },
        { name: 'seat_index', type: 'number' },
        { name: 'check_in_utc_ms', type: 'number', isOptional: true },
        { name: 'check_out_utc_ms', type: 'number', isOptional: true },
        { name: 'updated_at_ms', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'pairings',
      columns: [
        { name: 'pairing_code', type: 'string' },
        { name: 'base_airport', type: 'string' },
        { name: 'aircraft_type_icao', type: 'string', isOptional: true },
        { name: 'start_date', type: 'string' },
        { name: 'end_date', type: 'string' },
        { name: 'report_time_utc_ms', type: 'number', isOptional: true },
        { name: 'release_time_utc_ms', type: 'number', isOptional: true },
        { name: 'number_of_sectors', type: 'number' },
        { name: 'number_of_duties', type: 'number' },
        { name: 'layover_airports_json', type: 'string' },
        { name: 'fdtl_status', type: 'string' },
        { name: 'updated_at_ms', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'pairing_legs',
      columns: [
        { name: 'pairing_id', type: 'string', isIndexed: true },
        { name: 'flight_id', type: 'string', isIndexed: true },
        { name: 'flight_date', type: 'string' },
        { name: 'leg_order', type: 'number' },
        { name: 'is_deadhead', type: 'boolean' },
        { name: 'duty_day', type: 'number' },
        { name: 'dep_station', type: 'string' },
        { name: 'arr_station', type: 'string' },
        { name: 'flight_number', type: 'string' },
        { name: 'std_utc_ms', type: 'number', isIndexed: true },
        { name: 'sta_utc_ms', type: 'number' },
        { name: 'block_minutes', type: 'number' },
        { name: 'aircraft_type_icao', type: 'string', isOptional: true },
        { name: 'tail_number', type: 'string', isOptional: true },
        { name: 'updated_at_ms', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'crew_activities',
      columns: [
        { name: 'activity_code_id', type: 'string', isIndexed: true },
        { name: 'start_utc_ms', type: 'number', isIndexed: true },
        { name: 'end_utc_ms', type: 'number' },
        { name: 'date_iso', type: 'string', isOptional: true, isIndexed: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'updated_at_ms', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'crew_messages',
      columns: [
        { name: 'pairing_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'subject', type: 'string', isOptional: true },
        { name: 'body', type: 'string' },
        { name: 'channel', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'delivered_at_ms', type: 'number', isOptional: true },
        { name: 'read_at_ms', type: 'number', isOptional: true },
        { name: 'created_at_ms', type: 'number', isIndexed: true },
        { name: 'updated_at_ms', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'crew_profile',
      columns: [
        { name: 'employee_id', type: 'string' },
        { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' },
        { name: 'position', type: 'string', isOptional: true },
        { name: 'base', type: 'string', isOptional: true },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'is_schedule_visible', type: 'boolean' },
        { name: 'updated_at_ms', type: 'number' },
      ],
    }),
  ],
})
