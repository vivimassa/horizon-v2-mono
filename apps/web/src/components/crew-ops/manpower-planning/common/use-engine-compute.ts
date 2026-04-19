'use client'

import { useMemo } from 'react'
import {
  MONTHS,
  computeAvailable,
  computeGap,
  computeMonthlyBH,
  computeRequired,
  type MppCrewPosition,
  type MppEvent,
  type MppFleetOverride,
  type MppPositionSettings,
} from '@skyhub/logic'
import type { ManpowerEngineBundle } from '../manpower-planning-shell'

/** Single-pass derived-data hook — feeds Headcount / Fleet / Gap tabs. */
export function useEngineCompute(bundle: ManpowerEngineBundle) {
  return useMemo(() => {
    const { positions, positionSettings, planSettings, crewHeadcount } = bundle

    // Adapt CrewPositionRef → MppCrewPosition for the engine (field names match).
    const enginePositions: MppCrewPosition[] = positions.map((p) => ({
      id: p._id,
      code: p.code,
      name: p.name,
      category: p.category,
      rankOrder: p.rankOrder,
      color: p.color ?? '#0F766E',
    }))

    const filteredPositions = (
      bundle.filters.positionIds.length
        ? enginePositions.filter((p) => bundle.filters.positionIds.includes(p.id))
        : enginePositions
    )
      .slice()
      .sort((a, b) => {
        // Flight Deck (cockpit) before Cabin Crew, then ascending rankOrder
        // within each category — mirrors 5.4.2 admin ordering (CP, FO, PU, CA).
        const catRank = (c: string) => (c === 'cockpit' ? 0 : 1)
        const d = catRank(a.category) - catRank(b.category)
        if (d !== 0) return d
        return (a.rankOrder ?? 999) - (b.rankOrder ?? 999)
      })

    // Determine active fleets — respect the filter if set.
    const allFleets = new Set<string>()
    for (const k of Object.keys(bundle.scheduleBh)) allFleets.add(k)
    for (const k of Object.keys(bundle.monthlyAcCount)) allFleets.add(k)
    const activeFleets = bundle.filters.fleetIcaos.length
      ? bundle.filters.fleetIcaos.filter((f) => allFleets.has(f))
      : Array.from(allFleets)

    const fleetCount: Record<string, number> = {}
    for (const icao of activeFleets) {
      fleetCount[icao] = bundle.monthlyAcCount[icao]?.[0] ?? 0
    }

    const utilisation = new Map<string, number>()
    for (const u of bundle.utilisation) utilisation.set(u.aircraftTypeIcao, u.dailyUtilizationHours)

    // Engine-shape overrides.
    const overrides: MppFleetOverride[] = bundle.overrides.map((o) => ({
      id: o._id,
      planId: o.planId,
      aircraftTypeIcao: o.aircraftTypeIcao,
      monthIndex: o.monthIndex,
      planYear: o.planYear,
      acCount: o.acCount,
    }))

    const monthlyBH = computeMonthlyBH(bundle.scheduleBh, overrides, activeFleets, fleetCount, bundle.year, {
      isBase: bundle.isBasePlan,
      monthlyAcCount: bundle.monthlyAcCount,
      utilization: utilisation,
    })

    const posSettingsByPos: Record<string, MppPositionSettings> = {}
    for (const ps of bundle.positionSettings) {
      posSettingsByPos[ps.positionId] = {
        positionId: ps.positionId,
        bhTarget: ps.bhTarget,
        naSick: ps.naSick,
        naAnnual: ps.naAnnual,
        naTraining: ps.naTraining,
        naMaternity: ps.naMaternity,
        naAttrition: ps.naAttrition,
        naOther: ps.naOther,
      }
    }

    const naOtherIsDrain = planSettings?.naOtherIsDrain ?? false

    const required = computeRequired(monthlyBH, posSettingsByPos, filteredPositions, bundle.complements, naOtherIsDrain)

    // Adapt events to engine shape.
    const engineEvents: MppEvent[] = bundle.events.map((e) => ({
      id: e._id,
      planId: e.planId,
      eventType: e.eventType,
      monthIndex: e.monthIndex,
      planYear: e.planYear,
      count: e.count,
      fleetIcao: e.fleetIcao,
      positionName: e.positionName,
      leadMonths: e.leadMonths,
      notes: e.notes,
    }))

    const available = computeAvailable(
      engineEvents,
      crewHeadcount,
      filteredPositions,
      posSettingsByPos,
      naOtherIsDrain,
      activeFleets,
    )

    const gap = computeGap(required, available, filteredPositions)

    // Total block hours per month and aircraft count per month (UI summary).
    const totalBh = new Array(12).fill(0) as number[]
    for (const arr of Object.values(monthlyBH)) arr.forEach((v, m) => (totalBh[m] += v))
    const totalAc = new Array(12).fill(0) as number[]
    for (const icao of activeFleets) {
      const arr = bundle.monthlyAcCount[icao] ?? []
      arr.forEach((v, m) => (totalAc[m] += v))
    }

    return {
      months: MONTHS,
      positions: filteredPositions,
      activeFleets,
      monthlyBH,
      required,
      available,
      gap,
      totalBh,
      totalAc,
    }
  }, [bundle])
}
