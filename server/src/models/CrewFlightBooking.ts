import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.8.2 Crew Transport — flight (deadhead / positioning) booking row.
 *
 * Two purposes share the same document shape:
 *
 *   - purpose='pairing-deadhead'      → keyed by (operatorId, pairingId, legId).
 *                                       Created from a pairing's deadhead leg.
 *   - purpose='temp-base-positioning' → keyed by (operatorId, tempBaseId, direction).
 *                                       Created from the GCS Gantt's flanking-day "+"
 *                                       hit on a temp base band (one outbound, one return).
 *
 * Both purposes use the same method axis:
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
const PURPOSES = ['pairing-deadhead', 'temp-base-positioning'] as const
const DIRECTIONS = ['outbound', 'return'] as const

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

    // ── Identity (deterministic upsert key — discriminated by `purpose`) ──
    purpose: { type: String, enum: PURPOSES, default: 'pairing-deadhead', index: true },
    /** Set when purpose='pairing-deadhead'. Null for temp-base positioning. */
    pairingId: { type: String, default: null, index: true },
    legId: { type: String, default: null },
    pairingCode: { type: String, default: '' },
    /** Set when purpose='temp-base-positioning'. */
    tempBaseId: { type: String, default: null, index: true },
    /** Direction of the temp-base positioning leg. Null for pairing deadheads. */
    direction: { type: String, enum: [...DIRECTIONS, null], default: null },

    crewIds: { type: [String], default: [] },

    method: { type: String, enum: METHODS, required: true },

    // ── method='ticket' (carrierCode required) ──
    carrierCode: { type: String, default: null },
    flightNumber: { type: String, default: null },
    flightDate: { type: String, default: null }, // YYYY-MM-DD
    /** UTC instant of scheduled departure / arrival. Populated when the
     *  drawer picks a known company flight or when the planner enters
     *  manual times. Drives the FDTL duty-window for positioning legs;
     *  null falls back to a conservative full-day window. */
    stdUtcMs: { type: Number, default: null },
    staUtcMs: { type: Number, default: null },
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

// Discriminated unique keys — one booking per pairing leg, OR one per temp-base
// direction. Partial filters keep the constraints from interfering when the
// other half of the row is null.
crewFlightBookingSchema.index(
  { operatorId: 1, pairingId: 1, legId: 1 },
  { unique: true, partialFilterExpression: { pairingId: { $type: 'string' } } },
)
crewFlightBookingSchema.index(
  { operatorId: 1, tempBaseId: 1, direction: 1 },
  { unique: true, partialFilterExpression: { tempBaseId: { $type: 'string' } } },
)
crewFlightBookingSchema.index({ operatorId: 1, status: 1, flightDate: 1 })

export type CrewFlightBookingStatus = (typeof STATUSES)[number]
export type CrewFlightBookingMethod = (typeof METHODS)[number]
export type CrewFlightGendecPosition = (typeof GENDEC_POSITIONS)[number]
export type CrewFlightBookingClass = (typeof BOOKING_CLASSES)[number]
export type CrewFlightBookingPurpose = (typeof PURPOSES)[number]
export type CrewFlightBookingDirection = (typeof DIRECTIONS)[number]
export type CrewFlightBookingDoc = InferSchemaType<typeof crewFlightBookingSchema>
export const CrewFlightBooking = mongoose.model('CrewFlightBooking', crewFlightBookingSchema)
