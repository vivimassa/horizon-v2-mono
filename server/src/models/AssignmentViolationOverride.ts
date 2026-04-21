import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Audit record for every rule violation the planner overrode while
 * assigning a crew member to a pairing.
 *
 * Feeds two future modules:
 *   • 4.3.1 Schedule Legality Check — report of all pairings with
 *     violations (active + acknowledged overrides included).
 *   • 4.2.1 Rule Violation Message — operators can edit the text
 *     shown to planners when a specific `violationKind` fires; the
 *     kind field here is the join key.
 *
 * Right now we only emit `base_mismatch`, but the shape is open-ended
 * so FDP-hour overrides, rest-window overrides, rank overrides, etc.
 * can be stored the same way without migration.
 */
const schema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    /** Scenario the override happened in — null = production planning. */
    scenarioId: { type: String, default: null },
    /** The created assignment. Used to resolve crew / pairing / seat
     *  on the Schedule Legality Check report join. */
    assignmentId: { type: String, required: true, index: true },
    pairingId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    /** Stable string key. e.g. `base_mismatch`, `fdp_exceeded`, etc.
     *  Matches the row key in the 4.2.1 Rule Violation Message table. */
    violationKind: { type: String, required: true, index: true },
    /** Free-form JSON detail — crew base vs pairing base, FDP numbers,
     *  etc. Never drives logic; just surfaced in reports. */
    detail: { type: Schema.Types.Mixed, default: null },
    /** Text shown to the planner at override time (so reports match
     *  whatever wording was in effect, even after 4.2.1 rewrites). */
    messageSnapshot: { type: String, default: null },
    /** Optional reason — unused today, wired for future enforcement. */
    reason: { type: String, default: null },
    overriddenByUserId: { type: String, default: null },
    overriddenAtUtc: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'assignmentViolationOverrides',
  },
)

schema.index({ operatorId: 1, violationKind: 1, overriddenAtUtc: -1 })

export type AssignmentViolationOverrideDoc = InferSchemaType<typeof schema>
export const AssignmentViolationOverride = mongoose.model('AssignmentViolationOverride', schema)
