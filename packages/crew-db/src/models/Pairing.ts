import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export class PairingRecord extends Model {
  static table = 'pairings'

  @text('pairing_code') pairingCode!: string
  @text('base_airport') baseAirport!: string
  @text('aircraft_type_icao') aircraftTypeIcao!: string | null
  @text('start_date') startDate!: string
  @text('end_date') endDate!: string
  @field('report_time_utc_ms') reportTimeUtcMs!: number | null
  @field('release_time_utc_ms') releaseTimeUtcMs!: number | null
  @field('number_of_sectors') numberOfSectors!: number
  @field('number_of_duties') numberOfDuties!: number
  @text('layover_airports_json') layoverAirportsJson!: string
  @text('fdtl_status') fdtlStatus!: string
  @field('updated_at_ms') updatedAtMs!: number

  get layoverAirports(): string[] {
    try {
      return JSON.parse(this.layoverAirportsJson) as string[]
    } catch {
      return []
    }
  }
}
