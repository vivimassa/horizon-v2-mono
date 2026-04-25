// Bridge between client-side TransportTrip (UI shape) and server-side
// CrewTransportTripRef (persistence). Mirrors HOTAC's booking-converters.

import type { CrewTransportTripDerivedRow, CrewTransportTripRef, CrewTransportVendorRef } from '@skyhub/api'
import type { TransportTrip, TripVendorLite } from '../types'

export function deterministicKey(pairingId: string | null, tripType: string, scheduledTimeUtcMs: number): string {
  return `${pairingId ?? 'manual'}::${tripType}::${scheduledTimeUtcMs}`
}

export function toDerivedRow(t: TransportTrip): CrewTransportTripDerivedRow {
  if (!t.pairingId) {
    throw new Error('toDerivedRow: trip without pairingId cannot be batch-upserted')
  }
  return {
    pairingId: t.pairingId,
    pairingCode: t.pairingCode,
    tripType: t.tripType,
    scheduledTimeUtcMs: t.scheduledTimeUtcMs,
    legFlightNumber: t.legFlightNumber,
    legStdUtcIso: t.legStdUtcIso,
    legStaUtcIso: t.legStaUtcIso,
    airportIcao: t.airportIcao,
    fromLocationType: t.fromLocationType,
    fromAddress: t.fromAddress,
    fromLabel: t.fromLabel,
    toLocationType: t.toLocationType,
    toAddress: t.toAddress,
    toLabel: t.toLabel,
    paxStops: t.paxStops,
    paxCount: t.paxCount,
    vendorId: t.vendor?.id ?? null,
    vendorMethod: t.vendorMethod,
    vendorContractId: t.vendor?.contractId ?? null,
    vehicleTierId: t.vendor?.vehicleTierId ?? null,
    costMinor: t.cost,
    costCurrency: t.costCurrency,
  }
}

interface FromServerCtx {
  /** Most recent local snapshot — preserves rich vendor (rate, name, capacity)
   *  the server doesn't store. Indexed by deterministicKey. */
  localByKey: Map<string, TransportTrip>
  /** Vendor master data, indexed by id, for re-resolving vendor lite when a
   *  manual edit changed vendorId server-side. */
  vendorById: Map<string, CrewTransportVendorRef>
}

export function fromServerRow(row: CrewTransportTripRef, ctx: FromServerCtx): TransportTrip {
  const key = deterministicKey(row.pairingId, row.tripType, row.scheduledTimeUtcMs)
  const local = ctx.localByKey.get(key)

  let vendor: TripVendorLite | null = null
  if (row.vendorId) {
    if (local?.vendor && local.vendor.id === row.vendorId) {
      vendor = local.vendor
    } else {
      const v = ctx.vendorById.get(row.vendorId)
      if (v) {
        const contract = v.contracts.find((c) => c._id === row.vendorContractId) ?? v.contracts[0] ?? null
        const tier = contract?.vehicleTiers.find((t) => t._id === row.vehicleTierId) ?? null
        vendor = {
          id: v._id,
          name: v.vendorName,
          contractId: contract?._id ?? null,
          vehicleTierId: tier?._id ?? null,
          vehicleTierName: tier?.tierName ?? null,
          paxCapacity: tier?.paxCapacity ?? null,
          ratePerTrip: tier?.ratePerTrip ?? 0,
          currency: contract?.currency ?? row.costCurrency,
          priority: v.priority,
        }
      }
    }
  }

  return {
    id: row._id,
    pairingId: row.pairingId,
    pairingCode: row.pairingCode,
    tripType: row.tripType,
    scheduledTimeUtcMs: row.scheduledTimeUtcMs,
    legFlightNumber: row.legFlightNumber,
    legStdUtcIso: row.legStdUtcIso,
    legStaUtcIso: row.legStaUtcIso,
    airportIcao: row.airportIcao,
    fromLocationType: row.fromLocationType,
    fromAddress: row.fromAddress,
    fromLabel: row.fromLabel,
    toLocationType: row.toLocationType,
    toAddress: row.toAddress,
    toLabel: row.toLabel,
    paxStops: row.paxStops,
    paxCount: row.paxCount,
    vendor,
    vendorMethod: row.vendorMethod,
    vehiclePlate: row.vehiclePlate,
    driverName: row.driverName,
    driverPhone: row.driverPhone,
    cost: row.costMinor,
    costCurrency: row.costCurrency,
    status: row.status,
    confirmationNumber: row.confirmationNumber,
    notes: row.notes,
    disruptionFlags: row.disruptionFlags,
    sentAtUtcMs: row.sentAtUtcMs,
    confirmedAtUtcMs: row.confirmedAtUtcMs,
    dispatchedAtUtcMs: row.dispatchedAtUtcMs,
    pickedUpAtUtcMs: row.pickedUpAtUtcMs,
    completedAtUtcMs: row.completedAtUtcMs,
  }
}

export function indexTripsByDetKey(trips: TransportTrip[]): Map<string, TransportTrip> {
  const m = new Map<string, TransportTrip>()
  for (const t of trips) {
    m.set(deterministicKey(t.pairingId, t.tripType, t.scheduledTimeUtcMs), t)
  }
  return m
}

export function indexVendorsById(vendors: CrewTransportVendorRef[]): Map<string, CrewTransportVendorRef> {
  const m = new Map<string, CrewTransportVendorRef>()
  for (const v of vendors) m.set(v._id, v)
  return m
}
