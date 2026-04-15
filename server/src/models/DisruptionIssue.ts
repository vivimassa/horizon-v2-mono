import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * One row per detected disruption. Written by the rule engine today and
 * (after 2.1.3.1) by the ML adapter as well. Drives the feed, KPI strip,
 * and detail panel in the Disruption Center.
 *
 * Schema mirrors V1's `disruption_issues` table minus crew fields (Crew Ops
 * does not exist yet) and with Mongo-native ids. Keep this shape stable —
 * it is the training dataset 2.1.3.1 will consume.
 */
const disruptionIssueSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    flightNumber: { type: String, default: null },
    forDate: { type: String, default: null },
    depStation: { type: String, default: null },
    arrStation: { type: String, default: null },
    tail: { type: String, default: null },
    aircraftType: { type: String, default: null },

    // Disruption type — 8 categories (V1 minus CREW_CHANGE)
    category: {
      type: String,
      required: true,
      enum: [
        'TAIL_SWAP',
        'DELAY',
        'CANCELLATION',
        'DIVERSION',
        'CONFIG_CHANGE',
        'MISSING_OOOI',
        'MAINTENANCE_RISK',
        'CURFEW_VIOLATION',
        'TAT_VIOLATION',
      ],
    },
    source: {
      type: String,
      required: true,
      enum: ['IROPS_AUTO', 'ML_PREDICTION', 'MANUAL'],
      default: 'IROPS_AUTO',
    },
    severity: {
      type: String,
      required: true,
      enum: ['critical', 'warning', 'info'],
      default: 'warning',
    },

    // Rule-based score 0..1 (ML probability once 2.1.3.1 publishes a model)
    score: { type: Number, default: null },
    reasons: [{ type: String }],

    title: { type: String, required: true },
    description: { type: String, default: null },

    // Lifecycle
    status: {
      type: String,
      required: true,
      enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },

    assignedTo: { type: String, default: null },
    assignedToName: { type: String, default: null },
    assignedBy: { type: String, default: null },
    assignedByName: { type: String, default: null },
    assignedAt: { type: String, default: null },

    resolvedAt: { type: String, default: null },
    resolvedBy: { type: String, default: null },
    resolvedByName: { type: String, default: null },
    resolutionType: { type: String, default: null },
    resolutionNotes: { type: String, default: null },

    closedAt: { type: String, default: null },
    closedBy: { type: String, default: null },
    closedByName: { type: String, default: null },

    // Deep-link target — use MODULE_REGISTRY code, not hardcoded strings
    linkedModuleCode: { type: String, default: null },
    linkedEntityId: { type: String, default: null },

    // Source trace — alert id (live) or prediction flight id (future ML)
    sourceAlertId: { type: String, default: null },
    sourcePredictionFlight: { type: String, default: null },

    hidden: { type: Boolean, default: false },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'disruptionIssues',
  },
)

disruptionIssueSchema.index({ operatorId: 1, forDate: 1 })
disruptionIssueSchema.index({ operatorId: 1, status: 1 })
disruptionIssueSchema.index({ operatorId: 1, flightNumber: 1, forDate: 1 })
disruptionIssueSchema.index({ operatorId: 1, category: 1 })

export type DisruptionIssueDoc = InferSchemaType<typeof disruptionIssueSchema>
export const DisruptionIssue = mongoose.model('DisruptionIssue', disruptionIssueSchema)
