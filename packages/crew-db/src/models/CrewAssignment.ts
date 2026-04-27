import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export class CrewAssignmentRecord extends Model {
  static table = 'crew_assignments'

  @text('pairing_id') pairingId!: string
  @text('status') status!: string
  @field('start_utc_ms') startUtcMs!: number
  @field('end_utc_ms') endUtcMs!: number
  @text('seat_position_id') seatPositionId!: string
  @field('seat_index') seatIndex!: number
  @field('check_in_utc_ms') checkInUtcMs!: number | null
  @field('check_out_utc_ms') checkOutUtcMs!: number | null
  @field('updated_at_ms') updatedAtMs!: number
}
