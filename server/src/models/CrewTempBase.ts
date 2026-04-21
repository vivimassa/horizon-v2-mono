import mongoose, { Schema } from 'mongoose'

/**
 * Crew temporary base assignment (AIMS §4.6 "Temp Base").
 *
 * A planner re-bases a crew member to a different airport for a closed
 * date range (inclusive, UTC). The 4.1.6 Gantt paints a yellow band
 * over the range; `checkAssignmentViolations` uses the entry to
 * suppress the `base_mismatch` warning for pairings that operate out
 * of the temp airport while the window is active.
 *
 * Per-tenant via operatorId. Keyed by crewId for cheap lookups on the
 * schedule aggregator.
 */
const crewTempBaseSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    fromIso: { type: String, required: true },
    toIso: { type: String, required: true },
    /** IATA (3-letter) — free text. Kept uppercased by the route. */
    airportCode: { type: String, required: true },
    createdByUserId: { type: String, default: null },
  },
  { timestamps: true, _id: false },
)

crewTempBaseSchema.index({ operatorId: 1, crewId: 1, fromIso: 1 })

export const CrewTempBase = mongoose.model('CrewTempBase', crewTempBaseSchema)
