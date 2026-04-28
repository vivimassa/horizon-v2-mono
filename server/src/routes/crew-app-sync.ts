import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CrewMember } from '../models/CrewMember.js'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewActivity } from '../models/CrewActivity.js'
import { CrewMessage } from '../models/CrewMessage.js'
import { Pairing } from '../models/Pairing.js'
import { Airport } from '../models/Airport.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'

// ── Window bounds ───────────────────────────────────────────────────────
// On full pull (lastPulledAt = 0) we send 30 days back + 90 days forward.
// On incremental pull we still scope to that window but layer an
// updatedAt > lastPulledAt filter on top, so the wire payload stays tiny.
const HISTORY_DAYS = 30
const FUTURE_DAYS = 90
const DAY_MS = 86_400_000

// WatermelonDB-compatible sync envelope:
//   { changes: { table: { created, updated, deleted } }, timestamp }
// The crew app's @nozbe/watermelondb synchronize() consumes this directly.
type Bucket<T> = { created: T[]; updated: T[]; deleted: string[] }

interface CrewAssignmentRow {
  id: string
  pairing_id: string
  status: string
  start_utc_ms: number
  end_utc_ms: number
  seat_position_id: string
  seat_index: number
  check_in_utc_ms: number | null
  check_out_utc_ms: number | null
  updated_at_ms: number
}

interface PairingRow {
  id: string
  pairing_code: string
  base_airport: string
  aircraft_type_icao: string | null
  start_date: string
  end_date: string
  report_time_utc_ms: number | null
  release_time_utc_ms: number | null
  number_of_sectors: number
  number_of_duties: number
  layover_airports_json: string
  fdtl_status: string
  updated_at_ms: number
}

interface PairingLegRow {
  id: string
  pairing_id: string
  flight_id: string
  flight_date: string
  leg_order: number
  is_deadhead: boolean
  duty_day: number
  dep_station: string
  arr_station: string
  flight_number: string
  std_utc_ms: number
  sta_utc_ms: number
  block_minutes: number
  aircraft_type_icao: string | null
  tail_number: string | null
  updated_at_ms: number
}

interface CrewActivityRow {
  id: string
  activity_code_id: string
  start_utc_ms: number
  end_utc_ms: number
  date_iso: string | null
  notes: string | null
  updated_at_ms: number
}

interface CrewMessageRow {
  id: string
  pairing_id: string | null
  subject: string | null
  body: string
  channel: string
  status: string
  delivered_at_ms: number | null
  read_at_ms: number | null
  created_at_ms: number
  updated_at_ms: number
}

interface CrewProfileRow {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  position: string | null
  base: string | null
  photo_url: string | null
  is_schedule_visible: boolean
  updated_at_ms: number
}

const PullQuerySchema = z.object({
  lastPulledAt: z.coerce.number().int().nonnegative().default(0),
})

function isoToMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

export async function crewAppSyncRoutes(app: FastifyInstance) {
  // ── GET /crew-app/sync/pull ────────────────────────────────────────────
  app.get('/crew-app/sync/pull', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = PullQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
    }
    const lastPulledAt = parsed.data.lastPulledAt
    const now = Date.now()
    const windowStartIso = new Date(now - HISTORY_DAYS * DAY_MS).toISOString()
    const windowEndIso = new Date(now + FUTURE_DAYS * DAY_MS).toISOString()
    const sinceIso = lastPulledAt > 0 ? new Date(lastPulledAt).toISOString() : null

    const operatorId = req.crewOperatorId
    const crewId = req.crewId

    // Crew profile gate — if the planner has hidden the schedule for this
    // crew member (4.1.6 "Toggle published schedule"), return only the
    // profile and a heads-up flag; never leak duties.
    const profile = await CrewMember.findById(crewId).lean()
    if (!profile) {
      return reply.code(404).send({ error: 'Crew member not found' })
    }
    const scheduleHidden = profile.isScheduleVisible === false

    // ── Crew assignments (production scenario only) ──
    const assignmentFilter: Record<string, unknown> = {
      operatorId,
      crewId,
      scenarioId: null,
      startUtcIso: { $lte: windowEndIso },
      endUtcIso: { $gte: windowStartIso },
    }
    if (sinceIso) assignmentFilter.updatedAt = { $gt: sinceIso }

    const assignmentDocs = scheduleHidden ? [] : await CrewAssignment.find(assignmentFilter).lean()

    const assignmentBucket: Bucket<CrewAssignmentRow> = { created: [], updated: [], deleted: [] }
    const pairingIds = new Set<string>()
    for (const a of assignmentDocs) {
      const row: CrewAssignmentRow = {
        id: a._id as string,
        pairing_id: a.pairingId,
        status: a.status,
        start_utc_ms: isoToMs(a.startUtcIso),
        end_utc_ms: isoToMs(a.endUtcIso),
        seat_position_id: a.seatPositionId,
        seat_index: a.seatIndex,
        check_in_utc_ms: a.checkInUtcMs ?? null,
        check_out_utc_ms: a.checkOutUtcMs ?? null,
        updated_at_ms: isoToMs(a.updatedAt),
      }
      const createdMs = isoToMs(a.createdAt)
      if (lastPulledAt > 0 && createdMs <= lastPulledAt) assignmentBucket.updated.push(row)
      else assignmentBucket.created.push(row)
      pairingIds.add(a.pairingId)
    }

    // ── Pairings + legs (only those crew is on) ──
    // We always pull the FULL pairing for any assignment in the window,
    // even if the pairing's updatedAt didn't move. Without this the leg
    // table on the device is missing rows for newly-rostered duties.
    const pairingDocs = pairingIds.size
      ? await Pairing.find({ operatorId, _id: { $in: Array.from(pairingIds) } }).lean()
      : []

    const pairingBucket: Bucket<PairingRow> = { created: [], updated: [], deleted: [] }
    const legBucket: Bucket<PairingLegRow> = { created: [], updated: [], deleted: [] }

    for (const p of pairingDocs) {
      const pUpdatedMs = isoToMs(p.updatedAt)
      const pCreatedMs = isoToMs(p.createdAt)
      const pairingChanged = pUpdatedMs > lastPulledAt
      if (pairingChanged) {
        const row: PairingRow = {
          id: p._id as string,
          pairing_code: p.pairingCode,
          base_airport: p.baseAirport,
          aircraft_type_icao: p.aircraftTypeIcao ?? null,
          start_date: p.startDate,
          end_date: p.endDate,
          report_time_utc_ms: isoToMs(p.reportTime),
          release_time_utc_ms: isoToMs(p.releaseTime),
          number_of_sectors: p.numberOfSectors ?? 0,
          number_of_duties: p.numberOfDuties ?? 1,
          layover_airports_json: JSON.stringify(p.layoverAirports ?? []),
          fdtl_status: p.fdtlStatus,
          updated_at_ms: pUpdatedMs,
        }
        if (lastPulledAt > 0 && pCreatedMs <= lastPulledAt) pairingBucket.updated.push(row)
        else pairingBucket.created.push(row)
      }

      // Legs are denormalized inside the Pairing doc — we re-emit them
      // whenever the pairing changed (cheap; max ~8 legs per pairing).
      if (pairingChanged) {
        for (const leg of p.legs ?? []) {
          const row: PairingLegRow = {
            id: `${p._id}:${leg.legOrder}`,
            pairing_id: p._id as string,
            flight_id: leg.flightId,
            flight_date: leg.flightDate,
            leg_order: leg.legOrder,
            is_deadhead: !!leg.isDeadhead,
            duty_day: leg.dutyDay,
            dep_station: leg.depStation,
            arr_station: leg.arrStation,
            flight_number: leg.flightNumber,
            std_utc_ms: isoToMs(leg.stdUtcIso),
            sta_utc_ms: isoToMs(leg.staUtcIso),
            block_minutes: leg.blockMinutes,
            aircraft_type_icao: leg.aircraftTypeIcao ?? null,
            tail_number: leg.tailNumber ?? null,
            updated_at_ms: pUpdatedMs,
          }
          if (lastPulledAt > 0 && pCreatedMs <= lastPulledAt) legBucket.updated.push(row)
          else legBucket.created.push(row)
        }
      }
    }

    // ── Activities ──
    const activityFilter: Record<string, unknown> = {
      operatorId,
      crewId,
      scenarioId: null,
      startUtcIso: { $lte: windowEndIso },
      endUtcIso: { $gte: windowStartIso },
    }
    if (sinceIso) activityFilter.updatedAt = { $gt: sinceIso }

    const activityDocs = scheduleHidden ? [] : await CrewActivity.find(activityFilter).lean()
    const activityBucket: Bucket<CrewActivityRow> = { created: [], updated: [], deleted: [] }
    for (const a of activityDocs) {
      const row: CrewActivityRow = {
        id: a._id as string,
        activity_code_id: a.activityCodeId,
        start_utc_ms: isoToMs(a.startUtcIso),
        end_utc_ms: isoToMs(a.endUtcIso),
        date_iso: a.dateIso ?? null,
        notes: a.notes ?? null,
        updated_at_ms: isoToMs(a.updatedAt),
      }
      const createdMs = isoToMs(a.createdAt)
      if (lastPulledAt > 0 && createdMs <= lastPulledAt) activityBucket.updated.push(row)
      else activityBucket.created.push(row)
    }

    // ── Messages ──
    // CrewMessage is keyed by recipientCrewIds[] + has a per-crew
    // deliveries[] row. We project to a flat row for the device.
    const messageFilter: Record<string, unknown> = {
      operatorId,
      recipientCrewIds: crewId,
    }
    if (sinceIso) messageFilter.updatedAt = { $gt: sinceIso }

    const messageDocs = await CrewMessage.find(messageFilter).lean()
    const messageBucket: Bucket<CrewMessageRow> = { created: [], updated: [], deleted: [] }
    for (const m of messageDocs) {
      const delivery = (m.deliveries ?? []).find((d) => d.crewId === crewId)
      const row: CrewMessageRow = {
        id: m._id as string,
        pairing_id: m.pairingId ?? null,
        subject: m.subject ?? null,
        body: m.body,
        channel: m.channel,
        status: delivery?.status ?? 'queued',
        delivered_at_ms: delivery?.deliveredAtUtcMs ?? null,
        read_at_ms: delivery?.readAtUtcMs ?? null,
        created_at_ms: isoToMs(m.createdAt),
        updated_at_ms: isoToMs(m.updatedAt),
      }
      const createdMs = isoToMs(m.createdAt)
      if (lastPulledAt > 0 && createdMs <= lastPulledAt) messageBucket.updated.push(row)
      else messageBucket.created.push(row)
    }

    // ── Profile (own record) ──
    // Resolve base UUID → ICAO code, position UUID → position code/name
    // so the device shows human-readable labels (e.g. HAN, CP) instead of
    // raw IDs.
    const profileBucket: Bucket<CrewProfileRow> = { created: [], updated: [], deleted: [] }
    const profileUpdatedMs = isoToMs(profile.updatedAt)
    if (profileUpdatedMs > lastPulledAt || lastPulledAt === 0) {
      const [baseDoc, positionDoc] = await Promise.all([
        profile.base ? Airport.findById(profile.base, { icaoCode: 1, iataCode: 1 }).lean() : Promise.resolve(null),
        profile.position ? CrewPosition.findById(profile.position, { code: 1, name: 1 }).lean() : Promise.resolve(null),
      ])
      const baseLabel = baseDoc?.iataCode ?? baseDoc?.icaoCode ?? null
      const positionLabel = positionDoc?.code ?? positionDoc?.name ?? null

      const row: CrewProfileRow = {
        id: profile._id as string,
        employee_id: profile.employeeId,
        first_name: profile.firstName,
        last_name: profile.lastName,
        position: positionLabel,
        base: baseLabel,
        photo_url: profile.photoUrl ?? null,
        is_schedule_visible: profile.isScheduleVisible !== false,
        updated_at_ms: profileUpdatedMs,
      }
      if (lastPulledAt === 0) profileBucket.created.push(row)
      else profileBucket.updated.push(row)
    }

    req.log.info(
      {
        crewId,
        operatorId,
        lastPulledAt,
        scheduleHidden,
        counts: {
          assignments: assignmentBucket.created.length + assignmentBucket.updated.length,
          pairings: pairingBucket.created.length + pairingBucket.updated.length,
          legs: legBucket.created.length + legBucket.updated.length,
          activities: activityBucket.created.length + activityBucket.updated.length,
          messages: messageBucket.created.length + messageBucket.updated.length,
        },
      },
      '[crew-sync] pull',
    )

    return {
      changes: {
        crew_assignments: assignmentBucket,
        pairings: pairingBucket,
        pairing_legs: legBucket,
        crew_activities: activityBucket,
        crew_messages: messageBucket,
        crew_profile: profileBucket,
      },
      timestamp: now,
      scheduleHidden,
    }
  })

  // ── POST /crew-app/sync/push ──────────────────────────────────────────
  // The crew app can ack a message read, and (later) flip a check-in
  // timestamp. Whitelisted writes only — anything else is a 403.
  const PushSchema = z.object({
    changes: z
      .object({
        crew_messages: z
          .object({
            updated: z
              .array(
                z.object({
                  id: z.string().min(1),
                  read_at_ms: z.number().int().positive().nullable().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      })
      .optional(),
    lastPulledAt: z.number().int().nonnegative().optional(),
  })

  app.post('/crew-app/sync/push', { preHandler: requireCrewAuth }, async (req, reply) => {
    const parsed = PushSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() })
    }

    const messageUpdates = parsed.data.changes?.crew_messages?.updated ?? []
    let acked = 0
    for (const m of messageUpdates) {
      if (!m.read_at_ms) continue
      // Only update the delivery row that belongs to THIS crew. Cross-crew
      // mutations are impossible because the positional filter targets
      // `deliveries.$.crewId === req.crewId`.
      const result = await CrewMessage.updateOne(
        {
          _id: m.id,
          operatorId: req.crewOperatorId,
          recipientCrewIds: req.crewId,
          'deliveries.crewId': req.crewId,
        },
        {
          $set: {
            'deliveries.$.status': 'read',
            'deliveries.$.readAtUtcMs': m.read_at_ms,
            updatedAt: new Date().toISOString(),
          },
        },
      )
      if (result.modifiedCount > 0) acked += 1
    }

    return { acked, timestamp: Date.now() }
  })
}
