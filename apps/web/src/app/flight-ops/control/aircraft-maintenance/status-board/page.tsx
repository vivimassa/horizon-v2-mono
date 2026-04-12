'use client'

import { BarChart3 } from 'lucide-react'

export default function AircraftStatusBoardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <div className="w-14 h-14 rounded-2xl bg-module-accent/10 flex items-center justify-center">
        <BarChart3 className="w-7 h-7 text-module-accent" />
      </div>
      <h1 className="text-[20px] font-bold">Aircraft Status Board</h1>
      <p className="text-[14px] text-hz-text-secondary text-center max-w-md">
        Fleet-wide maintenance status overview showing each aircraft's check history, remaining intervals, and upcoming
        maintenance events. Coming soon.
      </p>
    </div>
  )
}
