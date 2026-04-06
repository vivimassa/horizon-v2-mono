import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
  editing?: boolean;
  draft?: Partial<AirportRef>;
  onChange?: (key: string, value: string | number | boolean | null) => void;
}

export function AirportBasicTab({ airport, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key]);

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
        <FieldRow label="IATA Code" value={airport.iataCode}
          editing={editing} fieldKey="iataCode" editValue={get("iataCode")} onChange={onChange} />
        <FieldRow label="ICAO Code" value={airport.icaoCode}
          editing={editing} fieldKey="icaoCode" editValue={get("icaoCode")} onChange={onChange} />
        <FieldRow label="Airport Name" value={airport.name}
          editing={editing} fieldKey="name" editValue={get("name")} onChange={onChange} />
        <FieldRow label="City" value={airport.city}
          editing={editing} fieldKey="city" editValue={get("city")} onChange={onChange} />
        <FieldRow label="Country" value={airport.countryName ?? airport.country ?? null}
          editing={editing} fieldKey="countryName" editValue={get("countryName")} onChange={onChange} />
        <FieldRow label="Timezone" value={airport.timezone}
          editing={editing} fieldKey="timezone" editValue={get("timezone")} onChange={onChange} />
        <FieldRow label="Latitude" value={airport.latitude?.toFixed(6)}
          editing={editing} fieldKey="latitude" editValue={get("latitude")} onChange={onChange} inputType="number" />
        <FieldRow label="Longitude" value={airport.longitude?.toFixed(6)}
          editing={editing} fieldKey="longitude" editValue={get("longitude")} onChange={onChange} inputType="number" />
        <FieldRow label="Elevation (ft)" value={airport.elevationFt}
          editing={editing} fieldKey="elevationFt" editValue={get("elevationFt")} onChange={onChange} inputType="number" />
        <FieldRow label="Active"
          value={airport.isActive ? <span className="font-semibold" style={{ color: "#06C270" }}>Active</span> : <span className="font-semibold" style={{ color: "#E63535" }}>Inactive</span>}
          editing={editing} fieldKey="isActive" editValue={get("isActive")} onChange={onChange} inputType="toggle" />
      </div>
    </div>
  );
}
