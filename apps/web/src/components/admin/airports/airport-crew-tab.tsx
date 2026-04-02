import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
  editing?: boolean;
  draft?: Partial<AirportRef>;
  onChange?: (key: string, value: string | number | boolean | null) => void;
}

export function AirportCrewTab({ airport, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key]);

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow label="Crew Base"
          value={airport.isCrewBase ? <span className="text-purple-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="isCrewBase" editValue={get("isCrewBase")} onChange={onChange} inputType="toggle" />
        <FieldRow label="Crew Reporting Time (min)"
          value={airport.crewReportingTimeMinutes != null ? `${airport.crewReportingTimeMinutes} min` : null}
          editing={editing} fieldKey="crewReportingTimeMinutes" editValue={get("crewReportingTimeMinutes")} onChange={onChange} inputType="number" />
        <FieldRow label="Crew Debrief Time (min)"
          value={airport.crewDebriefTimeMinutes != null ? `${airport.crewDebriefTimeMinutes} min` : null}
          editing={editing} fieldKey="crewDebriefTimeMinutes" editValue={get("crewDebriefTimeMinutes")} onChange={onChange} inputType="number" />
        <FieldRow label="Crew Facilities"
          value={airport.hasCrewFacilities ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="hasCrewFacilities" editValue={get("hasCrewFacilities")} onChange={onChange} inputType="toggle" />
      </div>
    </div>
  );
}
