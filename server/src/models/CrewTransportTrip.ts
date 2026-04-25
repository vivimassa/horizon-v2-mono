import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.2 Crew Transport — persisted ground trip row.
 *
 * One document per (operatorId, pairingId, tripType, scheduledTimeUtcMs).
 * Phase C derivation writes here so multiple HOTAC users see the same view,
 * manual edits persist, and lifecycle events get audited.
 *
 * `upsert-batch` PATCHes derived rows in without overwriting fields that the
 * dispatcher has already touched (status > forecast, vendor, driver, plate,
 * notes, manual cost override).
 */

const TRIP_TYPES = [
  'home-airport',
  'airport-home',
  'hub-airport',
  'airport-hub',
  'hotel-airport',
  'airport-hotel',
  'inter-terminal',
] as const

const TRIP_STATUSES = [
  'demand',
  'forecast',
  'pending',
  'sent',
  'confirmed',
  'dispatched',
  'crew-pickedup',
  'completed',
  'cancelled',
  'no-show',
] as const

const VENDOR_METHODS = ['vendor', 'shuttle', 'walking', 'taxi-voucher'] as const

const LOCATION_TYPES = ['home', 'hub', 'airport', 'hotel'] as const

const DISRUPTION_FLAGS = [
  'inbound-delayed',
  'outbound-delayed',
  'extend',
  'overdue-confirmation',
  'cancelled-leg',
] as const

const paxStopSchema = new Schema(
  {
    crewId: { type: String, required: true },
    crewName: { type: String, default: '' },
    position: { type: String, default: '' },
    pickupAddress: { type: String, default: null },
    pickupTimeUtcMs: { type: Number, default: null },
    pickedUpAtUtcMs: { type: Number, default: null },
    dropoffAtUtcMs: { type: Number, default: null },
  },
  { _id: false },
)

const crewTransportTripSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    // ── Identity (deterministic upsert key) ──
    tripType: { type: String, enum: TRIP_TYPES, required: true },
    scheduledTimeUtcMs: { type: Number, required: true },
    pairingId: { type: String, default: null, index: true },
    hotelBookingId: { type: String, default: null },

    // ── Pairing context (denormalised) ──
    pairingCode: { type: String, default: '' },
    legFlightNumber: { type: String, default: null },
    legStdUtcIso: { type: String, default: null },
    legStaUtcIso: { type: String, default: null },

    // ── Route ──
    fromLocationType: { type: String, enum: LOCATION_TYPES, required: true },
    fromAddress: { type: String, default: null },
    fromLat: { type: Number, default: null },
    fromLng: { type: Number, default: null },
    fromLabel: { type: String, default: '' },
    toLocationType: { type: String, enum: LOCATION_TYPES, required: true },
    toAddress: { type: String, default: null },
    toLat: { type: Number, default: null },
    toLng: { type: Number, default: null },
    toLabel: { type: String, default: '' },
    /** Airport this trip is grouped under for filtering. ICAO. */
    airportIcao: { type: String, required: true, index: true },

    // ── Crew on this trip ──
    paxStops: { type: [paxStopSchema], default: [] },
    paxCount: { type: Number, default: 0 },

    // ── Vendor / vehicle ──
    vendorId: { type: String, default: null },
    vendorMethod: { type: String, enum: VENDOR_METHODS, default: 'vendor' },
    vendorContractId: { type: String, default: null },
    vehicleTierId: { type: String, default: null },
    vehiclePlate: { type: String, default: null },
    driverName: { type: String, default: null },
    driverPhone: { type: String, default: null },

    // ── Cost ──
    costMinor: { type: Number, default: 0 },
    costCurrency: { type: String, default: 'USD' },

    // ── Status ──
    status: { type: String, enum: TRIP_STATUSES, default: 'demand', index: true },
    confirmationNumber: { type: String, default: null },
    notes: { type: String, default: null },
    disruptionFlags: { type: [{ type: String, enum: DISRUPTION_FLAGS }], default: [] },

    // ── Lifecycle audit ──
    sentAtUtcMs: { type: Number, default: null },
    confirmedAtUtcMs: { type: Number, default: null },
    dispatchedAtUtcMs: { type: Number, default: null },
    pickedUpAtUtcMs: { type: Number, default: null },
    completedAtUtcMs: { type: Number, default: null },
    delayMinutes: { type: Number, default: null },

    // ── Crew app sync hook (deferred) ──
    crewAppNotifiedAt: { type: Number, default: null },

    // ── Audit ──
    createdAtUtcMs: { type: Number, default: () => Date.now() },
    updatedAtUtcMs: { type: Number, default: () => Date.now() },
    createdByUserId: { type: String, default: null },
    sourceRunId: { type: String, default: null },
  },
  {
    _id: false,
    collection: 'crewTransportTrips',
    timestamps: false,
  },
)

// Deterministic upsert key — one trip per (operator, pairing, direction, scheduled time).
crewTransportTripSchema.index(
  { operatorId: 1, pairingId: 1, tripType: 1, scheduledTimeUtcMs: 1 },
  { unique: true, partialFilterExpression: { pairingId: { $type: 'string' } } },
)

// Common query patterns
crewTransportTripSchema.index({ operatorId: 1, scheduledTimeUtcMs: 1 })
crewTransportTripSchema.index({ operatorId: 1, airportIcao: 1, scheduledTimeUtcMs: 1 })
crewTransportTripSchema.index({ operatorId: 1, status: 1, scheduledTimeUtcMs: 1 })

export type CrewTransportTripType = (typeof TRIP_TYPES)[number]
export type CrewTransportTripStatus = (typeof TRIP_STATUSES)[number]
export type CrewTransportVendorMethod = (typeof VENDOR_METHODS)[number]
export type CrewTransportLocationType = (typeof LOCATION_TYPES)[number]
export type CrewTransportDisruptionFlag = (typeof DISRUPTION_FLAGS)[number]
export type CrewTransportTripDoc = InferSchemaType<typeof crewTransportTripSchema>
export const CrewTransportTrip = mongoose.model('CrewTransportTrip', crewTransportTripSchema)
