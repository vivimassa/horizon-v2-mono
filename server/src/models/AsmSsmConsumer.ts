import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 7.1.5.1 ASM/SSM Transmission — consumer directory.
 *
 * One document per external recipient of ASM/SSM traffic. Three delivery
 * modes share the same outbox (ScheduleMessageLog): the consumer record
 * declares how it wants to receive messages.
 *
 *   - pull_api: consumer calls GET /integration/asm-ssm/outbox with an
 *               API key. We mark deliveries as "delivered" when the
 *               response successfully reaches them.
 *   - sftp:     background worker uploads an IATA-formatted .txt to the
 *               consumer's SFTP at the configured path.
 *   - smtp:     background worker emails the message to the consumer's
 *               mailbox (to + cc + bcc).
 *
 * The separate `pullApi` / `sftp` / `smtp` blocks keep mode-specific
 * config isolated. Only the block matching `deliveryMode` is read.
 */

const pullApiBlock = new Schema(
  {
    apiKeyHash: { type: String, default: null },
    ipAllowlist: { type: [String], default: () => [] },
  },
  { _id: false },
)

const sftpBlock = new Schema(
  {
    host: { type: String, default: null },
    port: { type: Number, default: 22 },
    user: { type: String, default: null },
    authType: { type: String, enum: ['password', 'key'], default: 'password' },
    secretRef: { type: String, default: null },
    targetPath: { type: String, default: '/' },
    filenamePattern: {
      type: String,
      default: '{operator}_{family}_{type}_{messageId}_{timestamp}.txt',
    },
  },
  { _id: false },
)

const smtpBlock = new Schema(
  {
    to: { type: String, default: null },
    cc: { type: [String], default: () => [] },
    bcc: { type: [String], default: () => [] },
    subjectTemplate: {
      type: String,
      default: '[{family}] {type} — {messageId}',
    },
    asAttachment: { type: Boolean, default: false },
    bounceCount: { type: Number, default: 0 },
  },
  { _id: false },
)

const asmSsmConsumerSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true },

    name: { type: String, required: true },
    contactEmail: { type: String, default: null },
    deliveryMode: {
      type: String,
      enum: ['pull_api', 'sftp', 'smtp'],
      required: true,
    },

    pullApi: { type: pullApiBlock, default: () => ({}) },
    sftp: { type: sftpBlock, default: () => ({}) },
    smtp: { type: smtpBlock, default: () => ({}) },

    active: { type: Boolean, default: true },
    lastDeliveryAtUtc: { type: String, default: null },
    totalMessagesConsumed: { type: Number, default: 0 },
    consecutiveFailures: { type: Number, default: 0 },

    createdAtUtc: { type: String, default: () => new Date().toISOString() },
    updatedAtUtc: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'asmSsmConsumers',
  },
)

// Lookup by operator + active (main query for fan-out)
asmSsmConsumerSchema.index({ operatorId: 1, active: 1 })
// API key lookup for pull endpoint (uses hash, must be unique per operator)
asmSsmConsumerSchema.index({ 'pullApi.apiKeyHash': 1 }, { sparse: true })

export type AsmSsmConsumerDoc = InferSchemaType<typeof asmSsmConsumerSchema>
export const AsmSsmConsumer = mongoose.model('AsmSsmConsumer', asmSsmConsumerSchema)
