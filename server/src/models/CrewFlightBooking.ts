import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.2 Crew Transport — flight (deadhead) booking row.
 *
 * One document per (operatorId, pairingId, legId). Deterministic upsert key
 * — exactly one booking per deadhead leg in a pairing. Two methods:
 *
 *   - method='ticket'  → revenue/non-revenue ticket on a real flight,
 *                        carrierCode is REQUIRED (FK to /admin/carrier-codes),
 *                        attachments[] hold image OR PDF e-tickets.
 *   - method='gendec'  → supernumerary placement on the operator's own flight,
 *                        gendecPosition required (cockpit/cabin/pax seat).
 */

const STATUSES = ['pending', 'booked', 'confirmed', 'cancelled'] as const
const METHODS = ['ticket', 'gendec'] as const
const GENDEC_POSITIONS = ['cockpit-jumpseat', 'cabin-jumpseat', 'pax-seat'] as const
const BOOKING_CLASSES = ['Y', 'J', 'F', 'C', 'W'] as const

const attachmentSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, default: null },
    sizeBytes: { type: Number, default: null },
    uploadedAtUtcMs: { type: Number, default: () => Date.now() },
    uploadedByUserId: { type: String, default: null },
  },
  { _id: false },
)

const crewFlightBookingSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    // ── Identity (deterministic upsert key) ──
    pairingId: { type: String, required: true, index: true },
    legId: { type: String, required: true },
    pairingCode: { type: String, default: '' },

    crewIds: { type: [String], default: [] },

    method: { type: String, enum: METHODS, required: true },

    // ── method='ticket' (carrierCode required) ──
    carrierCode: { type: String, default: null },
    flightNumber: { type: String, default: null },
    flightDate: { type: String, default: null }, // YYYY-MM-DD
    depStation: { type: String, default: null },
    arrStation: { type: String, default: null },
    bookingClass: { type: String, enum: [...BOOKING_CLASSES, null], default: null },
    pnr: { type: String, default: null },
    ticketNumbers: { type: [String], default: [] },
    fareCost: { type: Number, default: null },
    fareCurrency: { type: String, default: 'USD' },
    attachments: { type: [attachmentSchema], default: [] },

    // ── method='gendec' ──
    gendecPosition: { type: String, enum: [...GENDEC_POSITIONS, null], default: null },

    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    notes: { type: String, default: null },

    // ── Audit ──
    bookedAtUtcMs: { type: Number, default: null },
    bookedByUserId: { type: String, default: null },
    cancelledAtUtcMs: { type: Number, default: null },
    sourceRunId: { type: String, default: null },

    /** Crew app sync hook (deferred). */
    crewAppNotifiedAt: { type: Number, default: null },

    createdAtUtcMs: { type: Number, default: () => Date.now() },
    updatedAtUtcMs: { type: Number, default: () => Date.now() },
    createdByUserId: { type: String, default: null },
  },
  {
    _id: false,
    collection: 'crewFlightBookings',
    timestamps: false,
  },
)

// Deterministic upsert key — one booking per (operator, pairing, leg).
crewFlightBookingSchema.index({ operatorId: 1, pairingId: 1, legId: 1 }, { unique: true })
crewFlightBookingSchema.index({ operatorId: 1, status: 1, flightDate: 1 })

export type CrewFlightBookingStatus = (typeof STATUSES)[number]
export type CrewFlightBookingMethod = (typeof METHODS)[number]
export type CrewFlightGendecPosition = (typeof GENDEC_POSITIONS)[number]
export type CrewFlightBookingClass = (typeof BOOKING_CLASSES)[number]
export type CrewFlightBookingDoc = InferSchemaType<typeof crewFlightBookingSchema>
export const CrewFlightBooking = mongoose.model('CrewFlightBooking', crewFlightBookingSchema)
