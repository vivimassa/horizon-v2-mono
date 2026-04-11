import Link from 'next/link'
import type { AirportRef } from '@skyhub/api'
import { FieldRow } from '@/components/ui'
import { MapPin } from 'lucide-react'

interface Props {
  airport: AirportRef
}

export function AirportCrewTab({ airport }: Props) {
  return (
    <div className="px-6 pt-3 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <FieldRow label="Crew Base" value={airport.isCrewBase} type="toggle" />
        <FieldRow label="Crew Reporting Time" value={airport.crewReportingTimeMinutes} suffix="min" />
        <FieldRow label="Crew Debrief Time" value={airport.crewDebriefTimeMinutes} suffix="min" />
        <FieldRow label="Crew Facilities" value={airport.hasCrewFacilities} type="toggle" />
      </div>

      {airport.isCrewBase && (
        <Link
          href="/admin/crew-bases"
          className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
        >
          <MapPin className="h-3.5 w-3.5" />
          Manage in Crew Bases
        </Link>
      )}
    </div>
  )
}
