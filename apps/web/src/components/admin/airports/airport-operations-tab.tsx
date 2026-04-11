import type { AirportRef } from '@skyhub/api'
import { FieldRow } from '@/components/ui'

interface Props {
  airport: AirportRef
  editing?: boolean
  draft?: Partial<AirportRef>
  onChange?: (key: string, value: string | number | boolean | null) => void
}

export function AirportOperationsTab({ airport, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key])
  const change = (key: string) => (v: string | number | boolean | null | undefined) => onChange?.(key, v ?? null)

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow
          label="Slot Controlled"
          value={airport.isSlotControlled}
          editing={editing}
          editValue={get('isSlotControlled')}
          onChangeValue={change('isSlotControlled')}
          type="toggle"
        />
        <FieldRow
          label="Has Curfew"
          value={airport.hasCurfew}
          editing={editing}
          editValue={get('hasCurfew')}
          onChangeValue={change('hasCurfew')}
          type="toggle"
        />
        <FieldRow
          label="Curfew Start"
          value={airport.curfewStart}
          editing={editing}
          editValue={get('curfewStart')}
          onChangeValue={change('curfewStart')}
        />
        <FieldRow
          label="Curfew End"
          value={airport.curfewEnd}
          editing={editing}
          editValue={get('curfewEnd')}
          onChangeValue={change('curfewEnd')}
        />
        <FieldRow
          label="Weather Monitored"
          value={airport.weatherMonitored}
          editing={editing}
          editValue={get('weatherMonitored')}
          onChangeValue={change('weatherMonitored')}
          type="toggle"
        />
        <FieldRow
          label="Weather Station"
          value={airport.weatherStation}
          editing={editing}
          editValue={get('weatherStation')}
          onChangeValue={change('weatherStation')}
        />
        <FieldRow
          label="Home Base"
          value={airport.isHomeBase}
          editing={editing}
          editValue={get('isHomeBase')}
          onChangeValue={change('isHomeBase')}
          type="toggle"
        />
        <FieldRow
          label="UTC Offset"
          value={
            airport.utcOffsetHours != null
              ? `UTC${airport.utcOffsetHours >= 0 ? '+' : ''}${airport.utcOffsetHours}`
              : null
          }
          editing={editing}
          editValue={get('utcOffsetHours')}
          onChangeValue={change('utcOffsetHours')}
          type="number"
        />
      </div>
    </div>
  )
}
