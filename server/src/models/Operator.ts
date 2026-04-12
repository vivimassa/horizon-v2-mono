import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const operatorSchema = new Schema(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icaoCode: { type: String, default: null },
    iataCode: { type: String, default: null },
    callsign: { type: String, default: null },
    country: { type: String, default: null },
    countryIso2: { type: String, default: null },
    regulatoryAuthority: { type: String, default: null },
    timezone: { type: String, required: true },
    fdtlRuleset: { type: String, default: null },
    mainBaseIcao: { type: String, default: null },
    currencyCode: { type: String, default: null },
    currencySymbol: { type: String, default: null },
    dateFormat: {
      type: String,
      enum: ['DD-MMM-YY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY'],
      default: 'DD-MMM-YY',
    },
    enabledModules: [{ type: String }],
    accentColor: { type: String, default: '#1e40af' },
    logoUrl: { type: String, default: null },
    // Recovery solver defaults (all configurable by admin, no hard-coded values)
    recoveryConfig: {
      defaultObjective: {
        type: String,
        enum: ['min_delay', 'min_cancel', 'min_cost', 'max_revenue'],
        default: 'min_cost',
      },
      horizonHours: { type: Number, default: 12 },
      lockThresholdMinutes: { type: Number, default: 60 },
      maxSolutions: { type: Number, default: 3 },
      maxSolveSeconds: { type: Number, default: 60 },
      delayCostPerMinute: { type: Number, default: 50.0 },
      cancelCostPerFlight: { type: Number, default: 50000.0 },
      fuelPricePerKg: { type: Number, default: 0.8 },
      maxDelayPerFlightMinutes: { type: Number, default: 0 },
      connectionProtectionMinutes: { type: Number, default: 45 },
      respectCurfews: { type: Boolean, default: true },
      maxCrewDutyHours: { type: Number, default: 12 },
      maxSwapsPerAircraft: { type: Number, default: 0 },
      propagationMultiplier: { type: Number, default: 1.5 },
      minImprovementUsd: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'operators',
  },
)

export type OperatorDoc = InferSchemaType<typeof operatorSchema>
export const Operator = mongoose.model('Operator', operatorSchema)
