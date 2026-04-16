import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const movementMessageLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    messageType: {
      type: String,
      enum: ['MVT', 'LDM'],
      required: true,
    },
    actionCode: {
      type: String,
      enum: ['AD', 'AA', 'ED', 'EA', 'NI', 'RR', 'FR'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
    },
    status: {
      type: String,
      enum: ['held', 'pending', 'sent', 'applied', 'rejected', 'discarded', 'failed'],
      default: 'pending',
      index: true,
    },

    flightNumber: { type: String, default: null },
    flightDate: { type: String, default: null },
    registration: { type: String, default: null },
    depStation: { type: String, default: null },
    arrStation: { type: String, default: null },

    summary: { type: String, default: null },
    rawMessage: { type: String, default: null },

    delayStandard: {
      type: String,
      enum: ['ahm730', 'ahm732'],
      default: null,
    },
    delayCodes: [
      {
        _id: false,
        code: { type: String, default: null },
        alphaCode: { type: String, default: null },
        ahm732Process: { type: String, default: null },
        ahm732Reason: { type: String, default: null },
        ahm732Stakeholder: { type: String, default: null },
        duration: { type: String, default: null },
        minutes: { type: Number, default: null },
        reasonText: { type: String, default: null },
        category: { type: String, default: null },
      },
    ],

    envelope: {
      priority: { type: String, default: null },
      addresses: [{ type: String }],
      originator: { type: String, default: null },
      timestamp: { type: String, default: null },
    },
    recipients: [{ type: String }],

    parsed: { type: Schema.Types.Mixed, default: null },

    appliedToFlight: {
      atdUtc: { type: Number, default: null },
      offUtc: { type: Number, default: null },
      onUtc: { type: Number, default: null },
      ataUtc: { type: Number, default: null },
      etdUtc: { type: Number, default: null },
      etaUtc: { type: Number, default: null },
      delaysAppended: { type: Number, default: 0 },
    },

    scenarioId: { type: String, default: null },
    flightInstanceId: { type: String, default: null, index: true },

    externalMessageId: { type: String, default: null },
    errorReason: { type: String, default: null },

    // ── Audit trail (who did what, when) ──
    createdBy: { type: String, default: null },
    createdByName: { type: String, default: null },
    releasedBy: { type: String, default: null },
    releasedByName: { type: String, default: null },
    releasedAtUtc: { type: String, default: null },
    discardedBy: { type: String, default: null },
    discardedByName: { type: String, default: null },
    discardedAtUtc: { type: String, default: null },

    // ── Override chain ──
    supersedesMessageId: { type: String, default: null },
    supersededByMessageId: { type: String, default: null },

    createdAtUtc: { type: String, default: null },
    updatedAtUtc: { type: String, default: null },
    sentAtUtc: { type: String, default: null },
    appliedAtUtc: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'movementMessageLogs',
  },
)

movementMessageLogSchema.index({ operatorId: 1, createdAtUtc: -1 })
movementMessageLogSchema.index({ operatorId: 1, status: 1, direction: 1 })
movementMessageLogSchema.index({ operatorId: 1, scenarioId: 1, status: 1 })
movementMessageLogSchema.index({ operatorId: 1, flightInstanceId: 1, createdAtUtc: -1 })
// Supports the held-duplicate check on compose (one lookup per compose).
movementMessageLogSchema.index({ operatorId: 1, flightInstanceId: 1, actionCode: 1, status: 1 })

export type MovementMessageLogDoc = InferSchemaType<typeof movementMessageLogSchema>
export const MovementMessageLog = mongoose.model('MovementMessageLog', movementMessageLogSchema)
