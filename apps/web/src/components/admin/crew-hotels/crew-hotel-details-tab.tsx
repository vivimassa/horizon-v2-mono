import type { CrewHotelRef } from '@skyhub/api'
import { FieldRow } from '@/components/ui'

interface Props {
  hotel: CrewHotelRef
  editing?: boolean
  draft?: Partial<CrewHotelRef>
  onChange?: (key: string, value: string | number | boolean | null) => void
}

export function CrewHotelDetailsTab({ hotel, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof CrewHotelRef) => (key in draft ? (draft as any)[key] : hotel[key])
  const change = (key: string) => (v: string | number | boolean | null | undefined) => onChange?.(key, v ?? null)

  const addr = [hotel.addressLine1, hotel.addressLine2, hotel.addressLine3].filter(Boolean).join(', ')

  return (
    <div className="px-6 pt-3 pb-6 space-y-6">
      <div>
        <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
          <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
          Hotel Info
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          <FieldRow
            label="Hotel Name"
            value={hotel.hotelName}
            editing={editing}
            editValue={get('hotelName')}
            onChangeValue={change('hotelName')}
          />
          <FieldRow
            label="Airport ICAO"
            value={hotel.airportIcao}
            editing={editing}
            editValue={get('airportIcao')}
            onChangeValue={change('airportIcao')}
            mono
          />
          <FieldRow
            label="Priority"
            value={hotel.priority}
            editing={editing}
            editValue={get('priority')}
            onChangeValue={change('priority')}
            type="number"
          />
          <FieldRow
            label="Active"
            value={hotel.isActive}
            editing={editing}
            editValue={get('isActive')}
            onChangeValue={change('isActive')}
            type="toggle"
          />
          <FieldRow
            label="Training Hotel"
            value={hotel.isTrainingHotel}
            editing={editing}
            editValue={get('isTrainingHotel')}
            onChangeValue={change('isTrainingHotel')}
            type="toggle"
          />
          <FieldRow
            label="All Inclusive"
            value={hotel.isAllInclusive}
            editing={editing}
            editValue={get('isAllInclusive')}
            onChangeValue={change('isAllInclusive')}
            type="toggle"
          />
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
          <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
          Address
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          <FieldRow
            label="Address Line 1"
            value={hotel.addressLine1}
            editing={editing}
            editValue={get('addressLine1')}
            onChangeValue={change('addressLine1')}
          />
          <FieldRow
            label="Address Line 2"
            value={hotel.addressLine2}
            editing={editing}
            editValue={get('addressLine2')}
            onChangeValue={change('addressLine2')}
          />
          <FieldRow
            label="Address Line 3"
            value={hotel.addressLine3}
            editing={editing}
            editValue={get('addressLine3')}
            onChangeValue={change('addressLine3')}
          />
          <FieldRow
            label="Latitude"
            value={hotel.latitude?.toFixed(6)}
            editing={editing}
            editValue={get('latitude')}
            onChangeValue={change('latitude')}
            type="number"
          />
          <FieldRow
            label="Longitude"
            value={hotel.longitude?.toFixed(6)}
            editing={editing}
            editValue={get('longitude')}
            onChangeValue={change('longitude')}
            type="number"
          />
          <FieldRow
            label="Distance from Airport"
            value={hotel.distanceFromAirportMinutes}
            editing={editing}
            editValue={get('distanceFromAirportMinutes')}
            onChangeValue={change('distanceFromAirportMinutes')}
            type="number"
            suffix="min"
          />
        </div>
        {!editing && addr && <div className="text-[13px] text-hz-text-secondary mt-2">{addr}</div>}
      </div>

      <div>
        <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
          <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
          Check-In / Check-Out (Airport Local)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          <FieldRow
            label="Check-In"
            value={hotel.standardCheckInLocal}
            editing={editing}
            editValue={get('standardCheckInLocal')}
            onChangeValue={change('standardCheckInLocal')}
          />
          <FieldRow
            label="Check-Out"
            value={hotel.standardCheckOutLocal}
            editing={editing}
            editValue={get('standardCheckOutLocal')}
            onChangeValue={change('standardCheckOutLocal')}
          />
          <FieldRow
            label="Shuttle Always Available"
            value={hotel.shuttleAlwaysAvailable}
            editing={editing}
            editValue={get('shuttleAlwaysAvailable')}
            onChangeValue={change('shuttleAlwaysAvailable')}
            type="toggle"
          />
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium uppercase tracking-wider text-hz-text-secondary mb-3 flex items-center gap-2">
          <span className="inline-block w-[3px] h-3.5 bg-module-accent rounded-sm" />
          Criteria for Hotel Selection
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          <FieldRow label="Block-to-Block Rest (min)" value={hotel.criteria?.blockToBlockRestMinutes} type="number" />
          <FieldRow label="Crew Positions" value={hotel.criteria?.crewPositions?.join(', ') || '—'} />
          <FieldRow label="A/C Types" value={hotel.criteria?.aircraftTypes?.join(', ') || '—'} />
          <FieldRow label="Crew Categories" value={hotel.criteria?.crewCategories?.join(', ') || '—'} />
          <FieldRow label="Charterers" value={hotel.criteria?.charterers?.join(', ') || '—'} />
        </div>
      </div>
    </div>
  )
}
