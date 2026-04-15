import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Per-operator AI advisor preferences. Schema-only in Phase 1 — no reads,
 * no writes from UI. 2.1.3.2 (AI Customization) populates this from its
 * settings screen and the advisor call uses it to compose per-operator
 * prompts.
 *
 * Shape mirrors the 12 items captured in
 * `apps/web/src/app/flight-ops/control/disruption-center/ai-customization/page.tsx`.
 * Keep field names stable — changing them breaks 2.1.3.2's settings UI.
 */
const advisorPreferencesSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, unique: true, index: true },

    // Friendly tier — maps to a Claude model internally, never shown to user
    smartnessTier: {
      type: String,
      enum: ['essential', 'pro', 'max'],
      default: 'pro',
    },

    // Which aspects the advisor weighs in on
    scope: {
      weather: { type: Boolean, default: true },
      maintenance: { type: Boolean, default: true },
      crew: { type: Boolean, default: false },
      otp: { type: Boolean, default: true },
      cost: { type: Boolean, default: true },
      passengerImpact: { type: Boolean, default: true },
      stationConstraints: { type: Boolean, default: true },
    },

    // 0..100 sliders — relative weighting
    priorityWeights: {
      otp: { type: Number, default: 50 },
      cost: { type: Number, default: 50 },
      crewWelfare: { type: Number, default: 50 },
      passengerImpact: { type: Number, default: 50 },
    },

    // Regulatory context bias
    regulatoryContext: {
      type: String,
      enum: ['CAAV_VAR_15', 'FAA_PART_117', 'EASA_FTL', 'NONE'],
      default: 'NONE',
    },

    // SOP corpus — documents live in System Admin → Company Document.
    // This array is the subset the advisor is allowed to retrieve from.
    sopDocumentIds: [{ type: String }],

    // Output
    outputLanguage: {
      type: String,
      enum: ['en', 'vi', 'mixed'],
      default: 'en',
    },
    responseFormat: {
      type: String,
      enum: ['structured_cards', 'narrative', 'executive_summary'],
      default: 'structured_cards',
    },

    // Guardrails
    monthlySpendCapUsd: { type: Number, default: null },
    allowedActionScope: {
      type: String,
      enum: ['info_only', 'suggest_with_confirm', 'autonomous'],
      default: 'suggest_with_confirm',
    },

    // Privacy
    sendPassengerPii: { type: Boolean, default: false },
    sendCrewNames: { type: Boolean, default: false },

    // Filter — hide recommendations below this confidence
    confidenceThreshold: { type: Number, default: 0.6 },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'advisorPreferences',
  },
)

export type AdvisorPreferencesDoc = InferSchemaType<typeof advisorPreferencesSchema>
export const AdvisorPreferences = mongoose.model('AdvisorPreferences', advisorPreferencesSchema)
