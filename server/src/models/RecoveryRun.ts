import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const assignmentSchema = new Schema(
  {
    flightId: { type: String, required: true },
    fromReg: { type: String, default: null },
    toReg: { type: String, required: true },
    newStdUtc: { type: Number, default: null },
    reason: { type: String, default: '' },
  },
  { _id: false, timestamps: false },
)

const metricsSchema = new Schema(
  {
    totalDelayMinutes: { type: Number, default: 0 },
    flightsChanged: { type: Number, default: 0 },
    cancellations: { type: Number, default: 0 },
    estimatedCostImpact: { type: Number, default: 0 },
    estimatedRevenueProtected: { type: Number, default: 0 },
    paxAffected: { type: Number, default: 0 },
  },
  { _id: false, timestamps: false },
)

const solutionSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    summary: { type: String, required: true },
    metrics: { type: metricsSchema, required: true },
    assignments: { type: [assignmentSchema], default: [] },
  },
  { _id: false, timestamps: false },
)

const recoveryRunSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    periodFrom: { type: String, required: true },
    periodTo: { type: String, required: true },
    config: {
      objective: { type: String, required: true },
      horizonHours: { type: Number, required: true },
      lockThresholdMinutes: { type: Number, required: true },
      maxSolutions: { type: Number, required: true },
      maxSolveSeconds: { type: Number, required: true },
      delayCostPerMinute: { type: Number, required: true },
      cancelCostPerFlight: { type: Number, required: true },
      fuelPricePerKg: { type: Number, required: true },
    },
    locked: {
      departedCount: { type: Number, default: 0 },
      withinThresholdCount: { type: Number, default: 0 },
      beyondHorizonCount: { type: Number, default: 0 },
    },
    selectedSolutionIndex: { type: Number, default: 0 },
    solutions: { type: [solutionSchema], default: [] },
    solveTimeMs: { type: Number, default: 0 },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'recoveryRuns',
  },
)

recoveryRunSchema.index({ operatorId: 1, createdAt: -1 })

export type RecoveryRunDoc = InferSchemaType<typeof recoveryRunSchema>
export const RecoveryRun = mongoose.model('RecoveryRun', recoveryRunSchema)
