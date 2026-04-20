import type { AircraftRegistrationRef, AircraftTypeRef } from '@skyhub/api'
import type { GanttFlight, GanttAircraft, GanttAircraftType } from '@/lib/gantt/types'
import type { PairingFlight } from '../types'

/**
 * Convert a `PairingFlight` (UI-local shape with ISO timestamps and
 * `departureAirport` / `arrivalAirport` naming) into a `GanttFlight`
 * (Movement Control shape with epoch-ms timestamps and `depStation` /
 * `arrStation` naming) so Movement Control's `computeLayout` and canvas
 * primitives can consume pairing data unchanged.
 *
 * Fields absent from the pairing API (OOOI times, slot status, delay
 * entries) stay null / undefined. Movement Control's draw path tolerates
 * this — delay overlays, slot risk indicators, and OOOI-based coloring
 * simply no-op for flights that don't carry those attributes.
 */
export function toGanttFlight(f: PairingFlight): GanttFlight {
  const stdMs = Date.parse(f.stdUtc)
  const staMs = Date.parse(f.staUtc)
  return {
    id: f.id,
    scheduledFlightId: f.scheduledFlightId,
    airlineCode: null,
    flightNumber: f.flightNumber,
    depStation: f.departureAirport,
    arrStation: f.arrivalAirport,
    stdUtc: Number.isFinite(stdMs) ? stdMs : 0,
    staUtc: Number.isFinite(staMs) ? staMs : 0,
    blockMinutes: f.blockMinutes,
    atdUtc: null,
    offUtc: null,
    onUtc: null,
    ataUtc: null,
    etdUtc: null,
    etaUtc: null,
    operatingDate: f.instanceDate,
    aircraftTypeIcao: f.aircraftType || null,
    aircraftReg: f.tailNumber,
    status: f.status ?? 'active',
    serviceType: f.serviceType ?? '',
    scenarioId: null,
    rotationId: f.rotationId ?? null,
    rotationSequence: null,
    rotationLabel: f.rotationLabel ?? null,
  }
}

export function toGanttAircraft(r: AircraftRegistrationRef, typeLookup: Map<string, AircraftTypeRef>): GanttAircraft {
  const t = typeLookup.get(r.aircraftTypeId)
  return {
    id: r._id,
    registration: r.registration,
    aircraftTypeId: r.aircraftTypeId,
    aircraftTypeIcao: t?.icaoType ?? null,
    aircraftTypeName: t?.name ?? null,
    status: r.status ?? 'active',
    homeBaseIcao: r.homeBaseIcao,
    color: t?.color ?? null,
    fuelBurnRateKgPerHour: t?.fuelBurnRateKgPerHour ?? null,
    seatConfig: null,
  }
}

export function toGanttAircraftType(t: AircraftTypeRef): GanttAircraftType {
  return {
    id: t._id,
    icaoType: t.icaoType,
    name: t.name,
    category: t.category,
    color: t.color,
    tatDefaultMinutes: t.tat?.defaultMinutes ?? null,
    tatDomDom: t.tat?.domDom ?? null,
    tatDomInt: t.tat?.domInt ?? null,
    tatIntDom: t.tat?.intDom ?? null,
    tatIntInt: t.tat?.intInt ?? null,
    fuelBurnRateKgPerHour: t.fuelBurnRateKgPerHour,
  }
}
