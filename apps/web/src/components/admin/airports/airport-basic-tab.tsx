import type { AirportRef } from '@skyhub/api'
import { FieldRow } from '@/components/ui'

interface Props {
  airport: AirportRef
  editing?: boolean
  draft?: Partial<AirportRef>
  onChange?: (key: string, value: string | number | boolean | null) => void
}

export function AirportBasicTab({ airport, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key])
  const change = (key: string) => (v: string | number | boolean | null | undefined) => onChange?.(key, v ?? null)

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
        <FieldRow
          label="IATA Code"
          value={airport.iataCode}
          editing={editing}
          editValue={get('iataCode')}
          onChangeValue={change('iataCode')}
          mono
        />
        <FieldRow
          label="ICAO Code"
          value={airport.icaoCode}
          editing={editing}
          editValue={get('icaoCode')}
          onChangeValue={change('icaoCode')}
          mono
        />
        <FieldRow
          label="Airport Name"
          value={airport.name}
          editing={editing}
          editValue={get('name')}
          onChangeValue={change('name')}
        />
        <FieldRow
          label="City"
          value={airport.city}
          editing={editing}
          editValue={get('city')}
          onChangeValue={change('city')}
        />
        <FieldRow
          label="Country"
          value={airport.countryName ?? airport.country ?? null}
          editing={editing}
          editValue={get('countryName')}
          onChangeValue={change('countryName')}
        />
        <FieldRow
          label="Timezone"
          value={airport.timezone}
          editing={editing}
          editValue={get('timezone')}
          onChangeValue={change('timezone')}
        />
        <FieldRow
          label="Latitude"
          value={airport.latitude?.toFixed(6)}
          editing={editing}
          editValue={get('latitude')}
          onChangeValue={change('latitude')}
          type="number"
        />
        <FieldRow
          label="Longitude"
          value={airport.longitude?.toFixed(6)}
          editing={editing}
          editValue={get('longitude')}
          onChangeValue={change('longitude')}
          type="number"
        />
        <FieldRow
          label="Elevation"
          value={airport.elevationFt}
          editing={editing}
          editValue={get('elevationFt')}
          onChangeValue={change('elevationFt')}
          type="number"
          suffix="ft"
        />
        <FieldRow
          label="Active"
          value={airport.isActive}
          editing={editing}
          editValue={get('isActive')}
          onChangeValue={change('isActive')}
          type="toggle"
        />
      </div>
    </div>
  )
}
