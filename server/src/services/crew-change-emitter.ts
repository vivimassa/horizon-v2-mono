import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewActivity } from '../models/CrewActivity.js'
import { CrewMessage } from '../models/CrewMessage.js'
import { Pairing } from '../models/Pairing.js'
import { sendToCrew, sendToCrewBatch } from './crew-push.js'

/**
 * Mongoose post-save / post-update hooks that fan out push notifications
 * to crew devices when their schedule changes. Wired in main() at boot.
 *
 * Design notes:
 *   - Production-scenario only — draft scenarios never trigger pushes.
 *   - Fire-and-forget — we never await the push from inside the hook so a
 *     slow Expo round-trip can't block the originating write.
 *   - Errors are logged, never thrown — a push failure must never roll
 *     back the underlying schedule write.
 */

function fireAndForget(label: string, p: Promise<unknown>): void {
  p.catch((err) => {
    console.error(`[crew-push:${label}]`, (err as Error).message)
  })
}

export function registerCrewChangeEmitter(): void {
  // ── CrewAssignment: created or status/time changed ──
  CrewAssignment.schema.post('save', function (doc) {
    if (doc.scenarioId) return // skip draft scenarios
    if (doc.status === 'cancelled') {
      fireAndForget(
        'assignment.cancelled',
        sendToCrew(doc.crewId, {
          title: 'Duty cancelled',
          body: 'A duty has been removed from your roster.',
          data: { type: 'sync', table: 'crew_assignments', id: doc._id },
          channelId: 'roster',
        }),
      )
      return
    }
    fireAndForget(
      'assignment.saved',
      sendToCrew(doc.crewId, {
        title: 'Roster updated',
        body: 'New duty added to your roster — pull to refresh.',
        data: { type: 'sync', table: 'crew_assignments', id: doc._id },
        channelId: 'roster',
      }),
    )
  })

  CrewAssignment.schema.post('findOneAndUpdate', function (doc) {
    if (!doc || (doc as { scenarioId?: string }).scenarioId) return
    const d = doc as { _id: string; crewId: string }
    fireAndForget(
      'assignment.updated',
      sendToCrew(d.crewId, {
        title: 'Duty updated',
        body: 'A duty in your roster has changed — pull to refresh.',
        data: { type: 'sync', table: 'crew_assignments', id: d._id },
        channelId: 'roster',
      }),
    )
  })

  // ── CrewActivity: created (e.g. STBY assigned) ──
  CrewActivity.schema.post('save', function (doc) {
    if (doc.scenarioId) return
    fireAndForget(
      'activity.saved',
      sendToCrew(doc.crewId, {
        title: 'Roster updated',
        body: 'A new activity has been added to your roster.',
        data: { type: 'sync', table: 'crew_activities', id: doc._id },
        channelId: 'roster',
      }),
    )
  })

  // ── CrewMessage: new outbound message ──
  CrewMessage.schema.post('save', function (doc) {
    const subject = doc.subject?.trim() || 'Message from Crew Control'
    const preview = doc.body.slice(0, 140)
    fireAndForget(
      'message.saved',
      sendToCrewBatch(doc.recipientCrewIds, {
        title: subject,
        body: preview,
        data: { type: 'message', messageId: doc._id },
        channelId: 'message',
      }),
    )
  })

  // ── Pairing: leg time changed → notify all assigned crew ──
  Pairing.schema.post('findOneAndUpdate', async function (doc) {
    if (!doc || (doc as { scenarioId?: string }).scenarioId) return
    const p = doc as { _id: string; pairingCode: string; operatorId: string }
    try {
      const assignments = await CrewAssignment.find(
        { operatorId: p.operatorId, pairingId: p._id, scenarioId: null, status: { $ne: 'cancelled' } },
        { crewId: 1 },
      ).lean()
      const crewIds = Array.from(new Set(assignments.map((a) => a.crewId)))
      if (!crewIds.length) return
      fireAndForget(
        'pairing.updated',
        sendToCrewBatch(crewIds, {
          title: `Pairing ${p.pairingCode} updated`,
          body: 'Times or routing for one of your duties changed — pull to refresh.',
          data: { type: 'sync', table: 'pairings', id: p._id },
          channelId: 'roster',
        }),
      )
    } catch (err) {
      console.error('[crew-push:pairing.updated]', (err as Error).message)
    }
  })

  console.log('✓ Crew push change-emitter registered (CrewAssignment, CrewActivity, CrewMessage, Pairing)')
}
