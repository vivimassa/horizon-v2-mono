// WatermelonDB model for the cached Gantt flight rows.
// See packages/types/src/gantt.ts → GanttFlight for the wire shape this
// table mirrors. Storing pendingSync alongside the data keeps the offline
// queue in one place.

import { Model } from '@nozbe/watermelondb'
import { field, date, json, text } from '@nozbe/watermelondb/decorators'

const sanitizeJson = (raw: unknown): unknown => raw

export class GanttFlightInstanceModel extends Model {
  static table = 'gantt_flights'

  @text('operator_id') operatorId!: string
  @text('flight_id') flightId!: string
  @text('scheduled_flight_id') scheduledFlightId!: string
  @text('airline_code') airlineCode!: string | null
  @text('flight_number') flightNumber!: string
  @text('dep_station') depStation!: string
  @text('arr_station') arrStation!: string
  @date('std_utc') stdUtc!: number
  @date('sta_utc') staUtc!: number
  @field('block_minutes') blockMinutes!: number
  @date('atd_utc') atdUtc!: number | null
  @date('off_utc') offUtc!: number | null
  @date('on_utc') onUtc!: number | null
  @date('ata_utc') ataUtc!: number | null
  @date('etd_utc') etdUtc!: number | null
  @date('eta_utc') etaUtc!: number | null
  @text('operating_date') operatingDate!: string
  @text('aircraft_type_icao') aircraftTypeIcao!: string | null
  @text('aircraft_reg') aircraftReg!: string | null
  @text('status') status!: string
  @text('service_type') serviceType!: string
  @text('scenario_id') scenarioId!: string | null
  @text('rotation_id') rotationId!: string | null
  @field('rotation_sequence') rotationSequence!: number | null
  @text('rotation_label') rotationLabel!: string | null
  @text('slot_status') slotStatus!: string | null
  @field('slot_utilization_pct') slotUtilizationPct!: number | null
  @text('slot_risk_level') slotRiskLevel!: string | null
  @text('slot_series_id') slotSeriesId!: string | null
  @field('is_protected') isProtected!: boolean | null
  @json('delays_json', sanitizeJson) delays!: { code: string; minutes: number; category: string }[] | null
  @text('dep_gate') depGate!: string | null
  @text('arr_gate') arrGate!: string | null
  @text('disruption_kind') disruptionKind!: string | null
  @date('disruption_applied_at') disruptionAppliedAt!: number | null
  @field('pending_sync') pendingSync!: boolean
  @date('fetched_at') fetchedAt!: number
}

export class GanttAircraftModel extends Model {
  static table = 'gantt_aircraft'
  @text('operator_id') operatorId!: string
  @text('aircraft_id') aircraftId!: string
  @text('registration') registration!: string
  @text('aircraft_type_id') aircraftTypeId!: string
  @text('aircraft_type_icao') aircraftTypeIcao!: string | null
  @text('aircraft_type_name') aircraftTypeName!: string | null
  @text('status') status!: string
  @text('home_base_icao') homeBaseIcao!: string | null
  @text('color') color!: string | null
  @field('fuel_burn_rate_kg_per_hour') fuelBurnRateKgPerHour!: number | null
  @text('seat_config') seatConfig!: string | null
  @date('fetched_at') fetchedAt!: number
}

export class GanttAircraftTypeModel extends Model {
  static table = 'gantt_aircraft_types'
  @text('operator_id') operatorId!: string
  @text('type_id') typeId!: string
  @text('icao_type') icaoType!: string
  @text('name') name!: string
  @text('category') category!: string
  @text('color') color!: string | null
  @field('tat_default_minutes') tatDefaultMinutes!: number | null
  @field('tat_dom_dom') tatDomDom!: number | null
  @field('tat_dom_int') tatDomInt!: number | null
  @field('tat_int_dom') tatIntDom!: number | null
  @field('tat_int_int') tatIntInt!: number | null
  @field('fuel_burn_rate_kg_per_hour') fuelBurnRateKgPerHour!: number | null
  @date('fetched_at') fetchedAt!: number
}

export class GanttPendingMutationModel extends Model {
  static table = 'gantt_pending_mutations'
  @text('operator_id') operatorId!: string
  @text('kind') kind!: string
  @json('payload_json', sanitizeJson) payload!: Record<string, unknown>
  @date('queued_at') queuedAt!: number
  @text('last_error') lastError!: string | null
  @field('attempts') attempts!: number
}
