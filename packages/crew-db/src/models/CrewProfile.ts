import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export class CrewProfileRecord extends Model {
  static table = 'crew_profile'

  @text('employee_id') employeeId!: string
  @text('first_name') firstName!: string
  @text('last_name') lastName!: string
  @text('position') position!: string | null
  @text('base') base!: string | null
  @text('photo_url') photoUrl!: string | null
  @field('is_schedule_visible') isScheduleVisible!: boolean
  @field('updated_at_ms') updatedAtMs!: number

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim()
  }
}
