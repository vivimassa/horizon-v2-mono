import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const reportingTimeSchema = new Schema(
  {
    timeType: { type: String, enum: ['report', 'debrief'], required: true },
    routeType: { type: String, enum: ['domestic', 'international', 'out_of_base'], required: true },
    columnKey: { type: String, required: true }, // aircraft type ICAO or 'pax_air'/'pax_ground'
    minutes: { type: Number, required: true },
  },
  { _id: false },
)

const fdtlSchemeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true },
    frameworkCode: { type: String, required: true }, // 'CAAV_VAR15', 'EASA_ORO_FTL', 'FAA_P117', etc.
    cabinFrameworkCode: { type: String, default: null }, // null = same as cockpit
    cabinCrewSeparateRules: { type: Boolean, default: false },
    reportTimeMinutes: { type: Number, default: 45 },
    postFlightMinutes: { type: Number, default: 30 },
    debriefMinutes: { type: Number, default: 15 },
    standbyResponseMinutes: { type: Number, default: 60 },
    augmentedComplementKey: { type: String, default: 'aug1' },
    doubleCrewComplementKey: { type: String, default: 'aug2' },
    frmsEnabled: { type: Boolean, default: false },
    frmsApprovalReference: { type: String, default: null },
    woclStart: { type: String, default: '02:00' },
    woclEnd: { type: String, default: '05:59' },
    reportingTimes: { type: [reportingTimeSchema], default: [] },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'fdtlSchemes',
  },
)

fdtlSchemeSchema.index({ operatorId: 1 }, { unique: true })

export type FdtlSchemeDoc = InferSchemaType<typeof fdtlSchemeSchema>
export const FdtlScheme = mongoose.model('FdtlScheme', fdtlSchemeSchema)
