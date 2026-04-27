import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export class CrewActivityRecord extends Model {
  static table = 'crew_activities'

  @text('activity_code_id') activityCodeId!: string
  @field('start_utc_ms') startUtcMs!: number
  @field('end_utc_ms') endUtcMs!: number
  @text('date_iso') dateIso!: string | null
  @text('notes') notes!: string | null
  @field('updated_at_ms') updatedAtMs!: number
}
