import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Module 4.1.6 Crew Schedule — join between a CrewMember and a Pairing
 * seat. One document per (pairingId, seatPositionId, seatIndex) so a
 * multi-seat pairing (e.g. CC:3) produces three rows.
 *
 * Not to be confused with:
 *   - Pairing.ts        (the duty trip template — shared across crew)
 *   - CrewPairing.ts    (buddy-pairing: "same flights" / "not same offs")
 *   - CrewGroupAssignment.ts (crew → scheduling group membership)
 */
const crewAssignmentSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    scenarioId: { type: String, default: null, index: true }, // null = production
    pairingId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },

    /** The seat being filled — distinct from the crew member's own position
     *  because of downrank (a Purser may fill a Cabin Attendant seat). */
    seatPositionId: { type: String, required: true },
    /** 0-based slot within the seat: CC#0, CC#1, CC#2. */
    seatIndex: { type: Number, required: true, default: 0 },

    status: {
      type: String,
      enum: ['planned', 'confirmed', 'rostered', 'cancelled'],
      default: 'planned',
    },

    /** Denormalized from pairing.reportTime — enables fast period scans. */
    startUtcIso: { type: String, required: true },
    /** Denormalized from last-leg debrief — enables fast period scans. */
    endUtcIso: { type: String, required: true },

    assignedByUserId: { type: String, default: null },
    assignedAtUtc: { type: String, default: () => new Date().toISOString() },

    /** Cached output of validatePairingClient from packages/logic/src/fdtl. */
    legalityResult: { type: Schema.Types.Mixed, default: null },
    lastLegalityCheckUtcIso: { type: String, default: null },

    notes: { type: String, default: null },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewAssignments' },
)

crewAssignmentSchema.index({ operatorId: 1, scenarioId: 1, startUtcIso: 1, endUtcIso: 1 })
crewAssignmentSchema.index({ operatorId: 1, crewId: 1, startUtcIso: 1 })
crewAssignmentSchema.index({ operatorId: 1, pairingId: 1 })
crewAssignmentSchema.index({ operatorId: 1, pairingId: 1, seatPositionId: 1, seatIndex: 1 }, { unique: true })

export type CrewAssignmentDoc = InferSchemaType<typeof crewAssignmentSchema>
export const CrewAssignment = mongoose.model('CrewAssignment', crewAssignmentSchema)
