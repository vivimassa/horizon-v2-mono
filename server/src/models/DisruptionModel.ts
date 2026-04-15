import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Per-operator ML model registry. Schema-only in Phase 1 — no routes,
 * no reads. 2.1.3.1 (ML Training) writes here when an operator trains
 * and publishes a model. The signal adapter interface in
 * `packages/shared/src/logic/disruption/` reads the currently-published
 * row to decide whether to use the rules engine or the trained model.
 *
 * Keep this schema stable — 2.1.3.1's publish step depends on it.
 */
const disruptionModelSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    version: { type: String, required: true },
    trainedAt: { type: String, required: true },
    trainedBy: { type: String, default: null },

    // Dataset provenance — date range, station subset, feature list
    provenance: {
      datasetFrom: { type: String, default: null },
      datasetTo: { type: String, default: null },
      stations: [{ type: String }],
      fleetSubset: [{ type: String }],
      features: [{ type: String }],
      rowCount: { type: Number, default: null },
    },

    // Training + validation metrics (precision, recall, F1, calibration)
    metrics: { type: Schema.Types.Mixed, default: null },

    // Model artifact pointer — path or URL resolved by the ML service
    artifactRef: { type: String, default: null },

    publishedAt: { type: String, default: null },
    isPublished: { type: Boolean, default: false, index: true },

    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'disruptionModels',
  },
)

disruptionModelSchema.index({ operatorId: 1, isPublished: 1, publishedAt: -1 })
disruptionModelSchema.index({ operatorId: 1, version: 1 }, { unique: true })

export type DisruptionModelDoc = InferSchemaType<typeof disruptionModelSchema>
export const DisruptionModel = mongoose.model('DisruptionModel', disruptionModelSchema)
