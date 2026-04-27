import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.6.1 Auto Roster — persisted run record.
 * _id doubles as the SSE stream ID so clients can resume or cancel.
 */

const autoRosterRunStatsSchema = new Schema(
  {
    pairingsTotal: { type: Number, required: true },
    crewTotal: { type: Number, required: true },
    assignedPairings: { type: Number, required: true },
    unassignedPairings: { type: Number, required: true },
    // Sum of unfilled seat slots across all unassigned pairings. Differs
    // from unassignedPairings on multi-seat pairings (e.g. cabin runs).
    unassignedSeats: { type: Number, default: 0 },
    // Canonical "what did the solver fail to fill" list. Step 4 + GCS
    // uncrewed tray both hydrate from here so counts can never diverge.
    unassignedPairingsList: { type: Schema.Types.Mixed, default: null },
    durationMs: { type: Number, required: true },
    objectiveScore: { type: Number, required: true },
  },
  { _id: false, strict: false },
)

const autoRosterRunSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    periodFrom: { type: String, required: true },
    periodTo: { type: String, required: true },

    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      required: true,
    },

    startedAt: { type: String, default: null },
    completedAt: { type: String, default: null },

    // Operator-level run lock — populated while status=running.
    // Blocks concurrent runs for the same operator regardless of caller.
    startedByUserId: { type: String, default: null, index: true },
    startedByUserName: { type: String, default: null },
    // Last progress event wall-clock — used by stale-lock sweep to clear a
    // dead run after the orchestrator process dies without writing terminal.
    lastProgressAt: { type: String, default: null },
    // Most-recent progress snapshot — lets reconnecting clients paint the UI
    // instantly without waiting for the next SSE tick.
    lastProgressPct: { type: Number, default: 0 },
    lastProgressMessage: { type: String, default: null },

    stats: { type: autoRosterRunStatsSchema, default: null },
    error: { type: String, default: null },

    // Original POST args. Persisted so SSE re-drive after a server restart
    // (or any code path where activeRuns no longer holds the runId) can
    // resume with the SAME scope the user originally submitted. Without
    // this, re-drive would call runAutoRoster with default args (empty
    // filters, mode=general) → the run silently widens to the full
    // operator scope.
    mode: {
      type: String,
      enum: ['general', 'daysOff', 'standby', 'longDuties', 'training'],
      default: 'general',
    },
    longDutiesMinDays: { type: Number, default: 2 },
    daysOffActivityCodeId: { type: String, default: null },
    timeLimitSec: { type: Number, default: 1800 },
    filterBase: { type: String, default: null },
    filterPosition: { type: String, default: null },
    filterAcTypes: { type: [String], default: null },
    filterCrewGroupIds: { type: [String], default: null },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'autoRosterRuns',
    timestamps: false,
  },
)

export type AutoRosterRunDoc = InferSchemaType<typeof autoRosterRunSchema>
export const AutoRosterRun = mongoose.model('AutoRosterRun', autoRosterRunSchema)
