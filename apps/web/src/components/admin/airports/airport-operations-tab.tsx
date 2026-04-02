import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";

interface Props {
  airport: AirportRef;
}

export function AirportOperationsTab({ airport }: Props) {
  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow
          label="Slot Controlled"
          value={
            airport.isSlotControlled ? (
              <span className="text-amber-600 font-semibold">Yes</span>
            ) : (
              <span className="text-hz-text-secondary">No</span>
            )
          }
        />
        <FieldRow
          label="Curfew"
          value={
            airport.hasCurfew ? (
              <span>
                <span className="text-amber-600 font-semibold">Yes</span>
                {airport.curfewStart && airport.curfewEnd && (
                  <span className="text-hz-text-secondary ml-2 text-[12px]">
                    {airport.curfewStart} – {airport.curfewEnd}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-hz-text-secondary">No</span>
            )
          }
        />
        <FieldRow
          label="Weather Monitored"
          value={
            airport.weatherMonitored ? (
              <span className="text-green-600 font-semibold">Yes</span>
            ) : (
              <span className="text-hz-text-secondary">No</span>
            )
          }
        />
        <FieldRow label="Weather Station" value={airport.weatherStation} />
        <FieldRow label="Home Base" value={airport.isHomeBase ? "Yes" : "No"} />
        <FieldRow label="UTC Offset" value={airport.utcOffsetHours != null ? `UTC${airport.utcOffsetHours >= 0 ? "+" : ""}${airport.utcOffsetHours}` : null} />
      </div>
    </div>
  );
}
