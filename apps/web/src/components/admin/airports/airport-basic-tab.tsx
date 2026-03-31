import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
}

export function AirportBasicTab({ airport }: Props) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow label="IATA Code" value={airport.iataCode} />
        <FieldRow label="ICAO Code" value={airport.icaoCode} />
        <FieldRow label="Airport Name" value={airport.name} />
        <FieldRow label="City" value={airport.city} />
        <FieldRow
          label="Country"
          value={
            airport.country ? (
              <span>
                {airport.countryFlag && (
                  <span className="mr-1.5">{airport.countryFlag}</span>
                )}
                {airport.country}
                {airport.countryIso2 && (
                  <span className="text-hz-text-secondary ml-1.5 text-[11px]">
                    {airport.countryIso2}
                  </span>
                )}
              </span>
            ) : null
          }
        />
        <FieldRow label="Timezone" value={airport.timezone} />
        <FieldRow
          label="Latitude"
          value={airport.latitude?.toFixed(6)}
        />
        <FieldRow
          label="Longitude"
          value={airport.longitude?.toFixed(6)}
        />
        <FieldRow
          label="Elevation (ft)"
          value={airport.elevationFt}
        />
        <FieldRow
          label="Status"
          value={
            airport.isActive ? (
              <span className="text-green-600 font-semibold">Active</span>
            ) : (
              <span className="text-red-600 font-semibold">Inactive</span>
            )
          }
        />
      </div>
    </div>
  );
}
