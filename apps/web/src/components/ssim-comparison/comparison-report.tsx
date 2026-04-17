'use client'

import { useSsimComparisonStore } from '@/stores/use-ssim-comparison-store'
import { HeadlineKpis } from './sections/headline-kpis'
import { FleetMixDonut } from './sections/fleet-mix-donut'
import { ByAircraftTypeTable } from './sections/by-aircraft-type-table'
import { ByRouteTable } from './sections/by-route-table'
import { ByDayChart } from './sections/by-day-chart'
import { FlightDiffTabs } from './sections/flight-diff-tabs'

export function ComparisonReport() {
  const report = useSsimComparisonStore((s) => s.report)
  const fileA = useSsimComparisonStore((s) => s.a.file)
  const fileB = useSsimComparisonStore((s) => s.b.file)
  if (!report) return null

  const aName = fileA?.name ?? 'A'
  const bName = fileB?.name ?? 'B'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <div className="space-y-5">
        <HeadlineKpis report={report} fileA={aName} fileB={bName} />
        <FleetMixDonut report={report} fileA={aName} fileB={bName} />
        <ByAircraftTypeTable report={report} />
        <ByRouteTable report={report} />
        <ByDayChart report={report} />
        <FlightDiffTabs diff={report.diff} />
      </div>
    </div>
  )
}
