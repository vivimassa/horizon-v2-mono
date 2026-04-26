// WatermelonDB schema for the mobile Gantt offline cache.
// Tables:
//   gantt_flights — mirrors the GanttFlight wire shape, plus a syncMeta
//                   bookkeeping column (pendingSync) to flag local edits.
//   gantt_aircraft + gantt_aircraft_types — supporting reference data so
//                   the cached period stands on its own offline.
//   gantt_pending_mutations — outbound mutation queue, replaces the MMKV
//                   queue once WMDB is wired live.

import { appSchema, tableSchema } from '@nozbe/watermelondb/Schema'

export const GANTT_SCHEMA = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'gantt_flights',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'flight_id', type: 'string', isIndexed: true },
        { name: 'scheduled_flight_id', type: 'string' },
        { name: 'airline_code', type: 'string', isOptional: true },
        { name: 'flight_number', type: 'string' },
        { name: 'dep_station', type: 'string' },
        { name: 'arr_station', type: 'string' },
        { name: 'std_utc', type: 'number' },
        { name: 'sta_utc', type: 'number' },
        { name: 'block_minutes', type: 'number' },
        { name: 'atd_utc', type: 'number', isOptional: true },
        { name: 'off_utc', type: 'number', isOptional: true },
        { name: 'on_utc', type: 'number', isOptional: true },
        { name: 'ata_utc', type: 'number', isOptional: true },
        { name: 'etd_utc', type: 'number', isOptional: true },
        { name: 'eta_utc', type: 'number', isOptional: true },
        { name: 'operating_date', type: 'string', isIndexed: true },
        { name: 'aircraft_type_icao', type: 'string', isOptional: true },
        { name: 'aircraft_reg', type: 'string', isOptional: true, isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'service_type', type: 'string' },
        { name: 'scenario_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'rotation_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'rotation_sequence', type: 'number', isOptional: true },
        { name: 'rotation_label', type: 'string', isOptional: true },
        { name: 'slot_status', type: 'string', isOptional: true },
        { name: 'slot_utilization_pct', type: 'number', isOptional: true },
        { name: 'slot_risk_level', type: 'string', isOptional: true },
        { name: 'slot_series_id', type: 'string', isOptional: true },
        { name: 'is_protected', type: 'boolean', isOptional: true },
        { name: 'delays_json', type: 'string', isOptional: true },
        { name: 'dep_gate', type: 'string', isOptional: true },
        { name: 'arr_gate', type: 'string', isOptional: true },
        { name: 'disruption_kind', type: 'string', isOptional: true },
        { name: 'disruption_applied_at', type: 'number', isOptional: true },
        { name: 'pending_sync', type: 'boolean' },
        { name: 'fetched_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'gantt_aircraft',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'aircraft_id', type: 'string' },
        { name: 'registration', type: 'string', isIndexed: true },
        { name: 'aircraft_type_id', type: 'string' },
        { name: 'aircraft_type_icao', type: 'string', isOptional: true },
        { name: 'aircraft_type_name', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'home_base_icao', type: 'string', isOptional: true },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'fuel_burn_rate_kg_per_hour', type: 'number', isOptional: true },
        { name: 'seat_config', type: 'string', isOptional: true },
        { name: 'fetched_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'gantt_aircraft_types',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'type_id', type: 'string' },
        { name: 'icao_type', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'tat_default_minutes', type: 'number', isOptional: true },
        { name: 'tat_dom_dom', type: 'number', isOptional: true },
        { name: 'tat_dom_int', type: 'number', isOptional: true },
        { name: 'tat_int_dom', type: 'number', isOptional: true },
        { name: 'tat_int_int', type: 'number', isOptional: true },
        { name: 'fuel_burn_rate_kg_per_hour', type: 'number', isOptional: true },
        { name: 'fetched_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'gantt_pending_mutations',
      columns: [
        { name: 'operator_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string', isIndexed: true },
        { name: 'payload_json', type: 'string' },
        { name: 'queued_at', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'attempts', type: 'number' },
      ],
    }),
  ],
})
