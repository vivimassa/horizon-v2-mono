// 4.1.8.2 Crew Transport — UI shapes.
//
// Mirrors HOTAC's types.ts: the in-memory derivation + display shape for
// trips, plus the local-only filter / config helpers. Round-trips with the
// server via trip-converters.ts.

import type {
  CrewTransportDisruptionFlag,
  CrewTransportLocationType,
  CrewTransportPaxStop,
  CrewTransportTripStatus,
  CrewTransportTripType,
  CrewTransportVendorMethod,
} from '@skyhub/api'

export type DerivationMode = 'planning' | 'dayToDay'

export type TripStatus = CrewTransportTripStatus

export interface TripVendorLite {
  id: string
  name: string
  contractId: string | null
  vehicleTierId: string | null
  vehicleTierName: string | null
  paxCapacity: number | null
  ratePerTrip: number
  currency: string
  priority: number
}

export interface TransportTrip {
  id: string
  pairingId: string | null
  pairingCode: string
  tripType: CrewTransportTripType
  scheduledTimeUtcMs: number
  legFlightNumber: string | null
  legStdUtcIso: string | null
  legStaUtcIso: string | null
  airportIcao: string

  fromLocationType: CrewTransportLocationType
  fromAddress: string | null
  fromLabel: string

  toLocationType: CrewTransportLocationType
  toAddress: string | null
  toLabel: string

  paxStops: CrewTransportPaxStop[]
  paxCount: number

  vendor: TripVendorLite | null
  vendorMethod: CrewTransportVendorMethod
  vehiclePlate: string | null
  driverName: string | null
  driverPhone: string | null

  cost: number
  costCurrency: string

  status: TripStatus
  confirmationNumber: string | null
  notes: string | null
  disruptionFlags: CrewTransportDisruptionFlag[]

  // Lifecycle audit (UTC ms; null until reached)
  sentAtUtcMs: number | null
  confirmedAtUtcMs: number | null
  dispatchedAtUtcMs: number | null
  pickedUpAtUtcMs: number | null
  completedAtUtcMs: number | null
}

/** Phase-A config; later read from OperatorHotacConfig.transport. Compiled
 *  defaults so the shell renders for operators without a config doc yet. */
export interface TransportConfig {
  /** door-to-door = one trip per crew (batched within window).
   *  hub-shuttle  = one consolidated trip per duty-start. */
  pickupMode: 'door-to-door' | 'hub-shuttle'
  hubLocation: { name: string; addressLine: string | null } | null
  /** Padding around report/release in minutes. */
  bufferMinutes: number
  /** Door-to-door consolidation window in minutes. */
  batchingWindowMinutes: number
  /** Default crew→airport drive time when CrewMember.travelTimeMinutes is null. */
  defaultTravelTimeMinutes: number
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  pickupMode: 'hub-shuttle',
  hubLocation: { name: 'Crew Hub', addressLine: null },
  bufferMinutes: 15,
  batchingWindowMinutes: 30,
  defaultTravelTimeMinutes: 45,
}

export const NON_TERMINAL_STATUSES: TripStatus[] = ['demand', 'forecast', 'pending', 'sent', 'confirmed', 'dispatched']

export function isTerminal(status: TripStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'no-show'
}
