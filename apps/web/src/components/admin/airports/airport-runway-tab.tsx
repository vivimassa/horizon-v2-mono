import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
  editing?: boolean;
  draft?: Partial<AirportRef>;
  onChange?: (key: string, value: string | number | boolean | null) => void;
}

export function AirportRunwayTab({ airport, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key]);

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow label="Number of Runways" value={airport.numberOfRunways}
          editing={editing} fieldKey="numberOfRunways" editValue={get("numberOfRunways")} onChange={onChange} inputType="number" />
        <FieldRow label="Longest Runway (ft)" value={airport.longestRunwayFt?.toLocaleString()}
          editing={editing} fieldKey="longestRunwayFt" editValue={get("longestRunwayFt")} onChange={onChange} inputType="number" />
        <FieldRow label="Number of Gates" value={airport.numberOfGates}
          editing={editing} fieldKey="numberOfGates" editValue={get("numberOfGates")} onChange={onChange} inputType="number" />
        <FieldRow label="Fire Category" value={airport.fireCategory}
          editing={editing} fieldKey="fireCategory" editValue={get("fireCategory")} onChange={onChange} inputType="number" />
        <FieldRow label="Fuel Available"
          value={airport.hasFuelAvailable ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="hasFuelAvailable" editValue={get("hasFuelAvailable")} onChange={onChange} inputType="toggle" />
        <FieldRow label="Crew Facilities"
          value={airport.hasCrewFacilities ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="hasCrewFacilities" editValue={get("hasCrewFacilities")} onChange={onChange} inputType="toggle" />
      </div>
    </div>
  );
}
