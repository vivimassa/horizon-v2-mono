import type { PairingRef, PairingLegRef } from '@skyhub/api'
import type { Pairing } from './types'

/** Adapt the API `PairingRef` shape to the component-local `Pairing` shape
 *  (notably `_id` → `id` and split-out deadheadFlightIds / flightIds arrays). */
export function pairingFromApi(p: PairingRef): Pairing {
  return {
    id: p._id,
    pairingCode: p.pairingCode,
    baseAirport: p.baseAirport,
    aircraftTypeIcao: p.aircraftTypeIcao ?? p.legs[0]?.aircraftTypeIcao ?? null,
    status: p.fdtlStatus,
    workflowStatus: p.workflowStatus,
    totalBlockMinutes: p.totalBlockMinutes,
    totalDutyMinutes: p.totalDutyMinutes,
    pairingDays: p.pairingDays,
    startDate: p.startDate,
    endDate: p.endDate,
    flightIds: p.legs.map((l: PairingLegRef) => l.flightId),
    deadheadFlightIds: p.legs.filter((l: PairingLegRef) => l.isDeadhead).map((l: PairingLegRef) => l.flightId),
    complementKey: p.complementKey,
    cockpitCount: p.cockpitCount,
    facilityClass: p.facilityClass,
    crewCounts: p.crewCounts,
    routeChain: p.routeChain,
    reportTime: p.reportTime ?? undefined,
    legs: p.legs.map((l: PairingLegRef) => ({
      flightId: l.flightId,
      legOrder: l.legOrder,
      isDeadhead: l.isDeadhead,
      depStation: l.depStation,
      arrStation: l.arrStation,
      flightDate: l.flightDate,
      flightNumber: l.flightNumber,
      stdUtc: l.stdUtcIso.slice(11, 16),
      staUtc: l.staUtcIso.slice(11, 16),
      blockMinutes: l.blockMinutes,
      aircraftTypeIcao: l.aircraftTypeIcao ?? undefined,
      stdUtcIso: l.stdUtcIso,
      staUtcIso: l.staUtcIso,
      tailNumber: l.tailNumber ?? null,
    })),
  }
}
