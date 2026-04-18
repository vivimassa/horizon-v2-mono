'use client'

import { Users } from 'lucide-react'
import { OccCard } from '../occ-card'

export function ExceptionCrewCard() {
  return (
    <OccCard
      title="Crew Risk"
      moduleCode="5.1.2"
      icon={<Users size={14} />}
      footLeft={<span>FDTL integration pending</span>}
    >
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
        <div className="w-10 h-10 rounded-full bg-[rgba(0,99,247,0.14)] text-[#5AA1FF] grid place-items-center">
          <Users size={18} />
        </div>
        <div className="text-[13px] font-medium text-[var(--occ-text)]">Coming with Crew Ops module</div>
        <div className="text-[11.5px] text-[var(--occ-text-3)] max-w-[220px]">
          FDP risk, sick calls, standby utilisation and expiring qualifications will appear here once the Crew Ops
          module lands.
        </div>
      </div>
    </OccCard>
  )
}
