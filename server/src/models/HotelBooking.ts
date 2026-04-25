import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.1 Crew Hotel Management — persisted booking row.
 *
 * One document per (operatorId, pairingId, airportIcao, layoverNightUtcMs).
 * Phase 1's in-memory derivation now writes here so multiple HOTAC users
 * see the same view, manual edits persist, and check-in events get audited.
 *
 * `upsert-batch` PATCHes derived rows in without overwriting fields that the
 * planner has already touched (status > demand/forecast, confirmationNumber,
 * notes, contractId, manual cost override, check-in markers).
 */

const BOOKING_STATUSES = [
  'demand',
  'forecast',
  'pending',
  'sent',
  'confirmed',
  'in-house',
  'departed',
  'cancelled',
  'no-show',
] as const

const DISRUPTION_FLAGS = [
  'inbound-cancelled',
  'outbound-cancelled',
  'inbound-delayed',
  'outbound-delayed',
  'extend-night',
  'overdue-confirmation',
] as const

const checkInBySchema = ['crew', 'hotac', 'hotel'] as const

const hotelBookingSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    // ── Identity (deterministic upsert key) ──
    pairingId: { type: String, required: true, index: true },
    airportIcao: { type: String, required: true },
    /** UTC ms of 00:00 UTC on the date of crew arrival. */
    layoverNightUtcMs: { type: Number, required: true },

    // ── Pairing context (denormalised for query speed) ──
    pairingCode: { type: String, default: '' },
    arrFlight: { type: String, default: null },
    arrStaUtcIso: { type: String, default: null },
    depFlight: { type: String, default: null },
    depStdUtcIso: { type: String, default: null },
    layoverHours: { type: Number, default: 0 },

    // ── Hotel selection ──
    hotelId: { type: String, default: null }, // → CrewHotel._id
    hotelName: { type: String, default: '' },
    hotelPriority: { type: Number, default: null },
    hotelDistance: { type: Number, default: null },
    contractId: { type: String, default: null }, // → CrewHotel.contracts[]._id

    // ── Allocation ──
    rooms: { type: Number, default: 0 },
    occupancy: { type: String, enum: ['single', 'double'], default: 'single' },
    pax: { type: Number, default: 0 },
    /** Aggregate counts by position code (e.g. {PIC: 1, FO: 1, CCM: 4}). */
    crewByPosition: { type: Schema.Types.Mixed, default: {} },
    /** Crew member IDs assigned to the layover. */
    crewIds: { type: [String], default: [] },

    // ── Cost ──
    costMinor: { type: Number, default: 0 },
    costCurrency: { type: String, default: 'USD' },

    // ── Status + booking lifecycle ──
    status: { type: String, enum: BOOKING_STATUSES, default: 'demand', index: true },
    confirmationNumber: { type: String, default: null },
    shuttle: { type: String, enum: ['Y', 'N', 'walking', null], default: null },
    notes: { type: String, default: null },

    // ── Disruption flags (set by polling/detect-disruptions) ──
    disruptionFlags: { type: [{ type: String, enum: DISRUPTION_FLAGS }], default: [] },

    // ── Check-in audit ──
    checkedInAtUtcMs: { type: Number, default: null },
    checkedInBy: { type: String, enum: [...checkInBySchema, null], default: null },
    checkedOutAtUtcMs: { type: Number, default: null },

    // ── Audit ──
    createdAtUtcMs: { type: Number, default: () => Date.now() },
    updatedAtUtcMs: { type: Number, default: () => Date.now() },
    createdByUserId: { type: String, default: null },
    /** Marks rows that were derived (vs ad-hoc / manually-created). */
    sourceRunId: { type: String, default: null },
  },
  {
    _id: false,
    collection: 'hotelBookings',
    timestamps: false,
  },
)

// Deterministic upsert key — one booking per (operator, pairing, station, night).
hotelBookingSchema.index({ operatorId: 1, pairingId: 1, airportIcao: 1, layoverNightUtcMs: 1 }, { unique: true })

// Common query patterns
hotelBookingSchema.index({ operatorId: 1, layoverNightUtcMs: 1 })
hotelBookingSchema.index({ operatorId: 1, airportIcao: 1, layoverNightUtcMs: 1 })

export type HotelBookingStatus = (typeof BOOKING_STATUSES)[number]
export type HotelBookingDisruptionFlag = (typeof DISRUPTION_FLAGS)[number]
export type HotelBookingDoc = InferSchemaType<typeof hotelBookingSchema>
export const HotelBooking = mongoose.model('HotelBooking', hotelBookingSchema)
