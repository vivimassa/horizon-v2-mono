import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
}

export function AirportCrewTab({ airport }: Props) {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow
          label="Crew Base"
          value={
            airport.isCrewBase ? (
              <span className="text-purple-600 font-semibold">Yes</span>
            ) : (
              <span className="text-hz-text-secondary">No</span>
            )
          }
        />
        <FieldRow
          label="Crew Reporting Time"
          value={
            airport.crewReportingTimeMinutes != null
              ? `${airport.crewReportingTimeMinutes} min`
              : null
          }
        />
        <FieldRow
          label="Crew Debrief Time"
          value={
            airport.crewDebriefTimeMinutes != null
              ? `${airport.crewDebriefTimeMinutes} min`
              : null
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
