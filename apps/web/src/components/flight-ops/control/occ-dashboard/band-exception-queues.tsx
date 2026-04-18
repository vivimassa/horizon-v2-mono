'use client'

import type { GanttFlight } from '@/lib/gantt/types'
import type { MaintenanceRollup } from './lib/aog-from-maintenance'
import { BandHead } from './lib/occ-helpers'
import { ExceptionIropsCard } from './cards/exception-irops-card'
import { ExceptionMaintenanceCard } from './cards/exception-maintenance-card'
import { ExceptionCrewCard } from './cards/exception-crew-card'

interface BandExceptionQueuesProps {
  flights: GanttFlight[]
  maintenance: MaintenanceRollup
  delayStandardLabel: string
}

export function BandExceptionQueues({ flights, maintenance, delayStandardLabel }: BandExceptionQueuesProps) {
  return (
    <section aria-label="Exception Queues">
      <BandHead tag="Exception Queues · 2.1.3" hint="Prioritized by severity · click a row to deep-link" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        <ExceptionIropsCard flights={flights} delayStandardLabel={delayStandardLabel} />
        <ExceptionMaintenanceCard maintenance={maintenance} />
        <ExceptionCrewCard />
      </div>
    </section>
  )
}
