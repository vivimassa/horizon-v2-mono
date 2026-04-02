import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
}

export function AirportRunwayTab({ airport }: Props) {
  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow label="Number of Runways" value={airport.numberOfRunways} />
        <FieldRow
          label="Longest Runway (ft)"
          value={airport.longestRunwayFt?.toLocaleString()}
        />
        <FieldRow label="Number of Gates" value={airport.numberOfGates} />
        <FieldRow
          label="Fire Category"
          value={airport.fireCategory}
        />
        <FieldRow
          label="Fuel Available"
          value={
            airport.hasFuelAvailable ? (
              <span className="text-green-600 font-semibold">Yes</span>
            ) : (
              <span className="text-hz-text-secondary">No</span>
            )
          }
        />
        <FieldRow
          label="Crew Facilities"
          value={
            airport.hasCrewFacilities ? (
              <span className="text-green-600 font-semibold">Yes</span>
            ) : (
              <span className="text-hz-text-secondary">No</span>
            )
          }
        />
      </div>
    </div>
  );
}
