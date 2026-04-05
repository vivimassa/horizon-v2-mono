import Link from "next/link";
import type { AirportRef } from "@skyhub/api";
import { FieldRow } from "./field-row";
import { MapPin } from "lucide-react";

interface Props {
  airport: AirportRef;
}

export function AirportCrewTab({ airport }: Props) {
  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow label="Crew Base"
          value={airport.isCrewBase ? <span className="text-purple-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>} />
        <FieldRow label="Crew Reporting Time (min)"
          value={airport.crewReportingTimeMinutes != null ? `${airport.crewReportingTimeMinutes} min` : null} />
        <FieldRow label="Crew Debrief Time (min)"
          value={airport.crewDebriefTimeMinutes != null ? `${airport.crewDebriefTimeMinutes} min` : null} />
        <FieldRow label="Crew Facilities"
          value={airport.hasCrewFacilities ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-hz-text-secondary">No</span>} />
      </div>

      {airport.isCrewBase && (
        <Link href="/admin/crew-bases"
          className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors">
          <MapPin className="h-3.5 w-3.5" />
          Manage in Crew Bases
        </Link>
      )}
    </div>
  );
}
