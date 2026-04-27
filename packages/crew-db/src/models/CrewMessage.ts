import { Model } from '@nozbe/watermelondb'
import { field, text, writer } from '@nozbe/watermelondb/decorators'

export class CrewMessageRecord extends Model {
  static table = 'crew_messages'

  @text('pairing_id') pairingId!: string | null
  @text('subject') subject!: string | null
  @text('body') body!: string
  @text('channel') channel!: string
  @text('status') status!: string
  @field('delivered_at_ms') deliveredAtMs!: number | null
  @field('read_at_ms') readAtMs!: number | null
  @field('created_at_ms') createdAtMs!: number
  @field('updated_at_ms') updatedAtMs!: number

  get isRead(): boolean {
    return this.status === 'read' || this.readAtMs !== null
  }

  // Local optimistic mark-as-read; sync layer pushes the read_at_ms to
  // the server on next /crew-app/sync/push.
  @writer async markRead() {
    await this.update((m) => {
      m.status = 'read'
      m.readAtMs = Date.now()
    })
  }
}
