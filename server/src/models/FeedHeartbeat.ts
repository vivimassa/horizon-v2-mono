import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * One row per (operatorId, feed). Upserted by external gateways posting to
 * POST /feeds/heartbeat. Consumed by GET /feed-status to derive ONLINE/STALE/
 * OFFLINE state purely from freshness of `lastHeartbeatAtUtc`.
 *
 * Feeds:
 *  - acars    — inbound ACARS gateway (SITA, Rockwell, ARINC)
 *  - mvt      — outbound MVT transport (SITA Type B, test loopback)
 *  - asmSsm   — outbound ASM/SSM transport to codeshare partners
 *
 * `wx` (NOAA) is NOT stored here — its freshness is derived from the
 * latest WeatherObservation.createdAt written by the weather-poll job.
 */
const feedHeartbeatSchema = new Schema(
  {
    _id: { type: String, required: true }, // `${operatorId}-${feed}`
    operatorId: { type: String, required: true, index: true },
    feed: {
      type: String,
      enum: ['acars', 'mvt', 'asmSsm'],
      required: true,
    },
    lastHeartbeatAtUtc: { type: String, required: true },
    source: { type: String, default: null },
    createdAtUtc: { type: String, required: true },
    updatedAtUtc: { type: String, required: true },
  },
  { _id: false, timestamps: false, collection: 'feedHeartbeats' },
)

feedHeartbeatSchema.index({ operatorId: 1, feed: 1 }, { unique: true })

export type FeedHeartbeatDoc = InferSchemaType<typeof feedHeartbeatSchema>
export const FeedHeartbeat = mongoose.model('FeedHeartbeat', feedHeartbeatSchema)
