import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
  editing?: boolean;
  draft?: Partial<AirportRef>;
  onChange?: (key: string, value: string | number | boolean | null) => void;
}

export function AirportOperationsTab({ airport, editing, draft = {}, onChange }: Props) {
  const get = (key: keyof AirportRef) => (key in draft ? (draft as any)[key] : airport[key]);

  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow label="Slot Controlled"
          value={airport.isSlotControlled ? <span className="font-semibold" style={{ color: "#E67A00" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="isSlotControlled" editValue={get("isSlotControlled")} onChange={onChange} inputType="toggle" />
        <FieldRow label="Has Curfew"
          value={airport.hasCurfew ? <span className="font-semibold" style={{ color: "#E67A00" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="hasCurfew" editValue={get("hasCurfew")} onChange={onChange} inputType="toggle" />
        <FieldRow label="Curfew Start" value={airport.curfewStart}
          editing={editing} fieldKey="curfewStart" editValue={get("curfewStart")} onChange={onChange} />
        <FieldRow label="Curfew End" value={airport.curfewEnd}
          editing={editing} fieldKey="curfewEnd" editValue={get("curfewEnd")} onChange={onChange} />
        <FieldRow label="Weather Monitored"
          value={airport.weatherMonitored ? <span className="font-semibold" style={{ color: "#06C270" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="weatherMonitored" editValue={get("weatherMonitored")} onChange={onChange} inputType="toggle" />
        <FieldRow label="Weather Station" value={airport.weatherStation}
          editing={editing} fieldKey="weatherStation" editValue={get("weatherStation")} onChange={onChange} />
        <FieldRow label="Home Base"
          value={airport.isHomeBase ? <span className="font-semibold" style={{ color: "#06C270" }}>Yes</span> : <span className="text-hz-text-secondary">No</span>}
          editing={editing} fieldKey="isHomeBase" editValue={get("isHomeBase")} onChange={onChange} inputType="toggle" />
        <FieldRow label="UTC Offset" value={airport.utcOffsetHours != null ? `UTC${airport.utcOffsetHours >= 0 ? "+" : ""}${airport.utcOffsetHours}` : null}
          editing={editing} fieldKey="utcOffsetHours" editValue={get("utcOffsetHours")} onChange={onChange} inputType="number" />
      </div>
    </div>
  );
}
