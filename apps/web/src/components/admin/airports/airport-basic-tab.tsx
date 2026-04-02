import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";
import { CountryFlag } from "@/components/ui/country-flag";

interface Props {
  airport: AirportRef;
}

export function AirportBasicTab({ airport }: Props) {
  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
        <FieldRow label="IATA Code" value={airport.iataCode} />
        <FieldRow label="ICAO Code" value={airport.icaoCode} />
        <FieldRow label="Airport Name" value={airport.name} />
        <FieldRow label="City" value={airport.city} />
        <FieldRow
          label="Country"
          value={
            airport.countryName ?? airport.country ?? null
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
