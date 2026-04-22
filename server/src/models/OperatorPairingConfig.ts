import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.5.4 Pairing Configurations — per-operator SOFT-rule policy for
 * pairing construction. These are NOT FDTL rules (those live in the
 * crew-law rule engine and are regulatory). These are operator-specific
 * planning conventions surfaced as warnings in the Pairing Inspector
 * legality strip.
 *
 * Current rules:
 *
 *  - aircraftChangeGroundTime: minimum ground time in the event of an
 *    aircraft (tail) change between consecutive legs, parameterised by
 *    the domestic/international character of the incoming and outgoing
 *    flights. Stored as whole MINUTES; the UI renders HH:MM and parses
 *    free-text (e.g. "1:30", "1h30", "90", "90m" all → 90 minutes).
 */

const aircraftChangeGroundTimeSchema = new Schema(
  {
    domToDomMin: { type: Number, default: 45, min: 0, max: 1440 },
    domToIntlMin: { type: Number, default: 60, min: 0, max: 1440 },
    intlToDomMin: { type: Number, default: 60, min: 0, max: 1440 },
    intlToIntlMin: { type: Number, default: 75, min: 0, max: 1440 },
  },
  { _id: false },
)

const operatorPairingConfigSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, unique: true, index: true },

    aircraftChangeGroundTime: { type: aircraftChangeGroundTimeSchema, default: () => ({}) },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'operatorPairingConfig',
    timestamps: false,
  },
)

export type OperatorPairingConfigDoc = InferSchemaType<typeof operatorPairingConfigSchema>
export const OperatorPairingConfig = mongoose.model('OperatorPairingConfig', operatorPairingConfigSchema)
