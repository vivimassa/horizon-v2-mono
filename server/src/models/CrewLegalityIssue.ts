import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Roster-level FDTL violation/warning, detected by the
 * `evaluate-crew-roster` service. One row per (crew, ruleCode,
 * detectedAtUtc-window-anchor). Upserted on each evaluation so the
 * table reflects the current state of the roster — issues that were
 * fixed between runs are removed.
 *
 * Fed into 4.1.6 left-panel badges + the Legality Check dialog.
 */
const schema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    scenarioId: { type: String, default: null },
    crewId: { type: String, required: true, index: true },
    /** The FDTL rule code that fired — e.g. MIN_REST_HOME_BASE. */
    ruleCode: { type: String, required: true, index: true },
    /** 'warning' | 'violation'. */
    status: { type: String, required: true },
    /** Human-readable label, e.g. "Rest before VJ101". */
    label: { type: String, required: true },
    actual: { type: String, required: true },
    limit: { type: String, required: true },
    /** Numeric actual/limit — minutes for durations, integer for counts.
     *  Used by solvers + reports that need ordered comparison. */
    actualNum: { type: Number, default: null },
    limitNum: { type: Number, default: null },
    /** Rolling-window bounds this check fired for. ISO UTC. Set for
     *  rolling_cumulative / min_rest_in_window / commander_discretion_cap. */
    windowFromIso: { type: String, default: null },
    windowToIso: { type: String, default: null },
    /** Short window label e.g. "28D", "168H". Mirrors ruleCode suffix. */
    windowLabel: { type: String, default: null },
    /** Legal reference string from the active scheme. */
    legalReference: { type: String, default: null },
    /** Concise message surfaced in tooltips + lists. */
    shortReason: { type: String, required: true },
    /** IDs involved in the violation (for drill-through). */
    assignmentIds: { type: [String], default: [] },
    activityIds: { type: [String], default: [] },
    /** Period the evaluation covered — so we can scope the list to the
     *  user's visible window. */
    periodFromIso: { type: String, required: true },
    periodToIso: { type: String, required: true },
    /** Anchor window start (for cumulative rules) — used as a de-dup
     *  key alongside ruleCode + crewId. For non-windowed rules the
     *  candidate assignment start is used. */
    anchorUtc: { type: String, required: true },
    detectedAtUtc: { type: String, required: true },
  },
  { _id: false, timestamps: false, collection: 'crewLegalityIssues' },
)

schema.index({ operatorId: 1, crewId: 1, ruleCode: 1, anchorUtc: 1 }, { unique: true })
schema.index({ operatorId: 1, periodFromIso: 1, periodToIso: 1 })

export type CrewLegalityIssueDoc = InferSchemaType<typeof schema>
export const CrewLegalityIssue = mongoose.model('CrewLegalityIssue', schema)
