import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const scenarioSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    seasonCode: { type: String, default: '' },
    name: { type: String, required: true },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'review', 'published', 'archived'],
      default: 'draft',
    },
    parentScenarioId: { type: String, default: null },
    publishedAt: { type: String, default: null },
    publishedBy: { type: String, default: null },
    createdBy: { type: String, required: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'scenarios',
  },
)

scenarioSchema.index({ operatorId: 1, seasonCode: 1 })

export type ScenarioDoc = InferSchemaType<typeof scenarioSchema>
export const Scenario = mongoose.model('Scenario', scenarioSchema)
