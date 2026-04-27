import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export class PairingLegRecord extends Model {
  static table = 'pairing_legs'

  @text('pairing_id') pairingId!: string
  @text('flight_id') flightId!: string
  @text('flight_date') flightDate!: string
  @field('leg_order') legOrder!: number
  @field('is_deadhead') isDeadhead!: boolean
  @field('duty_day') dutyDay!: number
  @text('dep_station') depStation!: string
  @text('arr_station') arrStation!: string
  @text('flight_number') flightNumber!: string
  @field('std_utc_ms') stdUtcMs!: number
  @field('sta_utc_ms') staUtcMs!: number
  @field('block_minutes') blockMinutes!: number
  @text('aircraft_type_icao') aircraftTypeIcao!: string | null
  @text('tail_number') tailNumber!: string | null
  @field('updated_at_ms') updatedAtMs!: number
}
