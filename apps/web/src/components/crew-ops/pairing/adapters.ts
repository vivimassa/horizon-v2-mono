import type { PairingRef, PairingLegRef } from '@skyhub/api'
import type { Pairing } from './types'

function normalizeLegId(l: PairingLegRef): string {
  const raw = typeof l.flightId === 'string' ? l.flightId : ''
  const date = typeof l.flightDate === 'string' ? l.flightDate : ''
  const sch = raw.split('__')[0] ?? ''
  return `${sch}__${date}`
}

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
    // Normalize leg ids to canonical `${scheduledFlightId}__${flightDate}` so
    // coverage checks match `PairingFlight.id` regardless of how the server
    // stored the leg (some code paths write the raw scheduledFlightId, others
    // write the compound form — split-and-rebuild handles both).
    flightIds: p.legs.map((l: PairingLegRef) => normalizeLegId(l)),
    deadheadFlightIds: p.legs.filter((l: PairingLegRef) => l.isDeadhead).map((l: PairingLegRef) => normalizeLegId(l)),
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
