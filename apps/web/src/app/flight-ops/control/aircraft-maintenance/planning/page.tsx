'use client'

import { CalendarClock } from 'lucide-react'

export default function MaintenancePlanningPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <div className="w-14 h-14 rounded-2xl bg-module-accent/10 flex items-center justify-center">
        <CalendarClock className="w-7 h-7 text-module-accent" />
      </div>
      <h1 className="text-[20px] font-bold">Maintenance Planning</h1>
      <p className="text-[14px] text-hz-text-secondary text-center max-w-md">
        Plan and forecast upcoming maintenance events based on fleet utilization, check intervals, and operational
        constraints. Coming soon.
      </p>
    </div>
  )
}
