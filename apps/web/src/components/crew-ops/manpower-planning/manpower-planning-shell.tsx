'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import {
  api,
  queryKeys,
  useManpowerPlans,
  useManpowerEvents,
  useManpowerFleetOverrides,
  useManpowerFleetUtilization,
  useManpowerPlanSettings,
  useManpowerScheduleBh,
  useManpowerCrewHeadcount,
  useManpowerMonthlyAcCount,
  useManpowerStandardComplements,
  useCrewPositions,
} from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { ManpowerLeftFilterPanel, type ManpowerFilters } from './panels/left-filter-panel'
import { ManpowerRightConfigPanel } from './panels/right-config-panel'
import { ManpowerTabBar, type ManpowerTabKey } from './manpower-tab-bar'
import { HeadcountTab } from './tabs/headcount-tab'
import { FleetPlanTab } from './tabs/fleet-plan-tab'
import { EventsTab } from './tabs/events-tab'
import { GapAnalysisTab } from './tabs/gap-analysis-tab'

// Default to the current year — this matches the operational schedule
// horizon the block-hours + aircraft endpoints read from. The user can
// pick next year from the filter drawer when they're ready to plan
// forward.
const DEFAULT_YEAR = new Date().getFullYear()

export function ManpowerPlanningShell() {
  const qc = useQueryClient()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const operatorId = getOperatorId()

  const plansQ = useManpowerPlans()
  const plans = plansQ.data ?? []

  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [tab, setTab] = useState<ManpowerTabKey>('headcount')

  // Default to the Base plan on first load.
  useEffect(() => {
    if (!activePlanId && plans.length > 0) {
      const base = plans.find((p) => p.isBasePlan)
      setActivePlanId((base ?? plans[0])._id)
    }
  }, [plans, activePlanId])

  const [draftFilters, setDraftFilters] = useState<ManpowerFilters>({
    year: DEFAULT_YEAR,
    positionIds: [],
    fleetIcaos: [],
    groupIds: [],
  })
  const [filters, setFilters] = useState<ManpowerFilters | null>(null)

  const year = filters?.year ?? draftFilters.year
  const dataEnabled = !!filters && !!activePlanId

  const positionsQ = useCrewPositions(operatorId)
  const settingsQ = useManpowerPlanSettings(activePlanId)
  const scheduleBhQ = useManpowerScheduleBh(activePlanId, year, dataEnabled)
  const headcountQ = useManpowerCrewHeadcount(activePlanId, year, dataEnabled)
  const acCountQ = useManpowerMonthlyAcCount(activePlanId, year, dataEnabled)
  const complementsQ = useManpowerStandardComplements(activePlanId)
  const overridesQ = useManpowerFleetOverrides(activePlanId, year)
  const eventsQ = useManpowerEvents(activePlanId, year)
  const utilisationQ = useManpowerFleetUtilization(activePlanId)

  const runway = useRunwayLoading()

  const handleGo = async () => {
    if (!activePlanId) return
    const next = { ...draftFilters }
    setFilters(next)
    await runway.run(
      async () => {
        await Promise.all([
          qc.fetchQuery({
            queryKey: queryKeys.manpower.scheduleBh(activePlanId, next.year),
            queryFn: () => api.getManpowerScheduleBh(activePlanId, next.year),
            staleTime: 60 * 1000,
          }),
          qc.fetchQuery({
            queryKey: queryKeys.manpower.crewHeadcount(activePlanId, next.year),
            queryFn: () => api.getManpowerCrewHeadcount(activePlanId, next.year),
            staleTime: 60 * 1000,
          }),
          qc.fetchQuery({
            queryKey: queryKeys.manpower.monthlyAcCount(activePlanId, next.year),
            queryFn: () => api.getManpowerMonthlyAcCount(activePlanId, next.year),
            staleTime: 60 * 1000,
          }),
        ])
      },
      'Loading manpower plan…',
      'Ready',
    )
  }

  const overrideCount = (overridesQ.data ?? []).length
  const eventCount = (eventsQ.data ?? []).length

  // Badges for tabs
  const badges: Partial<Record<ManpowerTabKey, number>> = useMemo(
    () => ({
      'fleet-plan': overrideCount,
      events: eventCount,
    }),
    [overrideCount, eventCount],
  )

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  // Sort positions by RANK ORDER: Flight Deck (cockpit) first, then Cabin
  // Crew, each ascending by rankOrder — mirrors the 5.4.2 admin page
  // ordering (CP, FO, PU, CA) and cascades to every tab that reads
  // positions from the bundle.
  const sortedPositions = useMemo(() => {
    const data = positionsQ.data ?? []
    return [...data].sort((a, b) => {
      const catRank = (c: string) => (c === 'cockpit' ? 0 : 1)
      const d = catRank(a.category) - catRank(b.category)
      if (d !== 0) return d
      return (a.rankOrder ?? 999) - (b.rankOrder ?? 999)
    })
  }, [positionsQ.data])

  // Build the engine input bundle once per render.
  const engineBundle = {
    year,
    positions: sortedPositions,
    planSettings: settingsQ.data?.settings ?? null,
    positionSettings: settingsQ.data?.positionSettings ?? [],
    scheduleBh: scheduleBhQ.data ?? {},
    crewHeadcount: headcountQ.data ?? {},
    monthlyAcCount: acCountQ.data ?? {},
    complements: complementsQ.data ?? {},
    overrides: overridesQ.data ?? [],
    events: eventsQ.data ?? [],
    utilisation: utilisationQ.data ?? [],
    filters: filters ?? draftFilters,
    isBasePlan: plans.find((p) => p._id === activePlanId)?.isBasePlan ?? true,
  }

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: isDark ? palette.backgroundSecondary : palette.background }}
    >
      {/* Left filter rail */}
      <div className="shrink-0">
        <ManpowerLeftFilterPanel
          draft={draftFilters}
          onDraftChange={setDraftFilters}
          onGo={() => void handleGo()}
          loading={runway.active}
        />
      </div>

      {/* Center + right.
           Blank until the user clicks Go — match every other SkyHub ops
           screen. During runway loading a single full-width panel fills
           the center+right area. After the first Go, the tabs + inspector
           mount. */}
      <div className="flex-1 flex overflow-hidden px-5 pt-4 pb-5 gap-3">
        {runway.active ? (
          <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
        ) : !filters ? (
          <EmptyPanel message="Set your criteria on the left and click Go to load the manpower plan" />
        ) : (
          <>
            <section
              className="flex-1 flex flex-col rounded-2xl border overflow-hidden"
              style={{
                background: isDark ? '#191921' : '#FFFFFF',
                borderColor: border,
              }}
            >
              <ManpowerTabBar active={tab} onChange={setTab} badges={badges} />

              <div className="flex-1 overflow-y-auto">
                {tab === 'headcount' ? (
                  <HeadcountTab bundle={engineBundle} />
                ) : tab === 'fleet-plan' ? (
                  <FleetPlanTab bundle={engineBundle} activePlanId={activePlanId as string} />
                ) : tab === 'events' ? (
                  <EventsTab bundle={engineBundle} activePlanId={activePlanId as string} />
                ) : (
                  <GapAnalysisTab bundle={engineBundle} />
                )}
              </div>
            </section>

            <aside
              className="shrink-0 flex flex-col rounded-2xl border overflow-hidden"
              style={{
                width: 360,
                background: isDark ? '#191921' : '#FFFFFF',
                borderColor: border,
              }}
            >
              <ManpowerRightConfigPanel
                plans={plans}
                activePlanId={activePlanId}
                onActivePlanChange={setActivePlanId}
                onPlansRefetch={async () => {
                  await plansQ.refetch()
                }}
              />
            </aside>
          </>
        )}
      </div>
    </div>
  )
}

export type ManpowerEngineBundle = ReturnType<typeof buildBundleType>
function buildBundleType() {
  // dummy for ReturnType inference; export the shape where tabs consume it.
  return null as unknown as {
    year: number
    positions: import('@skyhub/api').CrewPositionRef[]
    planSettings: import('@skyhub/api').ManpowerPlanSettingsRef | null
    positionSettings: import('@skyhub/api').ManpowerPositionSettingsRef[]
    scheduleBh: Record<string, number[]>
    crewHeadcount: Record<string, Record<string, number[]>>
    monthlyAcCount: Record<string, number[]>
    complements: Record<string, Record<string, number>>
    overrides: import('@skyhub/api').ManpowerFleetOverrideRef[]
    events: import('@skyhub/api').ManpowerEventRef[]
    utilisation: import('@skyhub/api').ManpowerFleetUtilizationRef[]
    filters: ManpowerFilters
    isBasePlan: boolean
  }
}
