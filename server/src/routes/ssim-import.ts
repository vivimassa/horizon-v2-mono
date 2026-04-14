/**
 * SSIM Chapter-7 text-format import — module 1.2.1.
 *
 * Distinct from /ssim/import (Excel) in server/src/routes/ssim.ts.
 * Everything here lives under /ssim/import/* subpaths with text-format
 * semantics. Client orchestration (apps/web) calls these endpoints in
 * sequence, wrapping each in its own runway-loading step.
 *
 * Every write route expects `operatorId` + `seasonCode` on the query
 * string. `scenarioId` is optional and, when present, scopes the write
 * to a scenario copy (leaves production flights alone).
 */

import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { parseSSIM, type SSIMParseResult, type SSIMTimeMode } from '@skyhub/logic/src/utils/ssim-parser'
import { buildRotations, type RotationMode } from '@skyhub/logic/src/utils/rotation-builder'
import { lookupAirportByIata } from '@skyhub/logic/src/utils/airport-lookup'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { Airport } from '../models/Airport.js'
import { CityPair } from '../models/CityPair.js'
import { AircraftType } from '../models/AircraftType.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types — shared with the client (apps/web/src/lib/ssim-import-client.ts)
// ─────────────────────────────────────────────────────────────────────────────

interface ValidationBlock {
  airlineMatch: boolean
  recordCountOk: boolean
  missingAirports: string[]
  missingCityPairs: Array<{ dep: string; arr: string }>
  missingAircraftTypes: string[]
}

/** Lightweight parsed-flight shape sent back to the client (no rawLine). */
export interface ParsedFlightData {
  airlineCode: string
  flightNumber: number
  suffix: string
  periodStart: string
  periodEnd: string
  daysOfOperation: string
  depStation: string
  arrStation: string
  stdLocal: string
  stdUtc: string
  staLocal: string
  staUtc: string
  depUtcOffset: string
  arrUtcOffset: string
  aircraftType: string
  serviceType: string
  seatConfig: Record<string, number>
  totalCapacity: number
  blockMinutes: number
  recordNumber: number
  nextAirlineCode: string | null
  nextFlightNumber: number | null
}

interface ParseResponse {
  carrier: SSIMParseResult['carrier']
  flights: ParsedFlightData[]
  stats: SSIMParseResult['stats']
  errors: SSIMParseResult['errors']
  trailer: SSIMParseResult['trailer']
  validation: ValidationBlock
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** SSIM numeric flight number → zero-padded string (matches manual-entry format). */
function padFlightNumber(n: number): string {
  return String(n).padStart(3, '0')
}

/** SSIM HHMM → HH:MM. */
function colonize(hhmm: string): string {
  if (!hhmm || hhmm.length < 4) return '00:00'
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`
}

/** Alphabetically order two ICAO codes (station1 = smaller, station2 = larger). */
function orderStations(a: string, b: string): { station1: string; station2: string } {
  return a <= b ? { station1: a, station2: b } : { station1: b, station2: a }
}

/** Strip rawLine from a parse-engine flight leg for client delivery. */
function stripLeg(f: SSIMParseResult['flights'][number]): ParsedFlightData {
  return {
    airlineCode: f.airlineCode,
    flightNumber: f.flightNumber,
    suffix: f.suffix,
    periodStart: f.periodStart,
    periodEnd: f.periodEnd,
    daysOfOperation: f.daysOfOperation,
    depStation: f.depStation,
    arrStation: f.arrStation,
    stdLocal: f.stdLocal,
    stdUtc: f.stdUtc,
    staLocal: f.staLocal,
    staUtc: f.staUtc,
    depUtcOffset: f.depUtcOffset,
    arrUtcOffset: f.arrUtcOffset,
    aircraftType: f.aircraftType,
    serviceType: f.serviceType,
    seatConfig: f.seatConfig,
    totalCapacity: f.totalCapacity,
    blockMinutes: f.blockMinutes,
    recordNumber: f.recordNumber,
    nextAirlineCode: f.nextAirlineCode,
    nextFlightNumber: f.nextFlightNumber,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────────────────

export async function ssimImportRoutes(app: FastifyInstance): Promise<void> {
  // ── 1. Parse ────────────────────────────────────────────────────────────
  // Body: { fileContent: string, timeMode?: 'standard' | 'utc_only' }
  // Query: operatorId (required)
  app.post('/ssim/parse', async (req, reply) => {
    const { operatorId } = req.query as Record<string, string>
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const body = req.body as { fileContent?: string; timeMode?: SSIMTimeMode } | undefined
    const content = body?.fileContent
    if (!content || typeof content !== 'string') {
      return reply.code(400).send({ error: 'fileContent required' })
    }
    const timeMode: SSIMTimeMode = body?.timeMode === 'utc_only' ? 'utc_only' : 'standard'

    const result = parseSSIM(content, timeMode)

    // Validation: airline match, record-count trailer, missing refs.
    // Scoped to the operator's existing master-data records.
    const [airports, aircraftTypes, cityPairs] = await Promise.all([
      Airport.find({ isActive: true }, 'iataCode icaoCode').lean(),
      AircraftType.find({ operatorId }, 'icaoType iataType').lean(),
      CityPair.find({ operatorId, isActive: true }, 'station1Iata station2Iata').lean(),
    ])
    const knownIata = new Set<string>()
    for (const a of airports) if (a.iataCode) knownIata.add(String(a.iataCode).toUpperCase())
    const knownAcIata = new Set<string>()
    const knownAcIcao = new Set<string>()
    for (const t of aircraftTypes) {
      if (t.icaoType) knownAcIcao.add(String(t.icaoType).toUpperCase())
      if (t.iataType) knownAcIata.add(String(t.iataType).toUpperCase())
    }
    const knownPairs = new Set<string>()
    for (const cp of cityPairs) {
      const a = (cp.station1Iata || '').toUpperCase()
      const b = (cp.station2Iata || '').toUpperCase()
      if (a && b) {
        const ord = orderStations(a, b)
        knownPairs.add(`${ord.station1}-${ord.station2}`)
      }
    }

    const missingAirports = new Set<string>()
    const missingCityPairs = new Map<string, { dep: string; arr: string }>()
    const missingAircraftTypes = new Set<string>()
    for (const f of result.flights) {
      if (!knownIata.has(f.depStation)) missingAirports.add(f.depStation)
      if (!knownIata.has(f.arrStation)) missingAirports.add(f.arrStation)
      const ord = orderStations(f.depStation, f.arrStation)
      const pk = `${ord.station1}-${ord.station2}`
      if (!knownPairs.has(pk)) {
        missingCityPairs.set(pk, { dep: f.depStation, arr: f.arrStation })
      }
      const acUpper = f.aircraftType.toUpperCase()
      if (!knownAcIata.has(acUpper) && !knownAcIcao.has(acUpper)) {
        missingAircraftTypes.add(acUpper)
      }
    }

    const ssimAirline = (result.carrier?.airlineCode ?? '').toUpperCase()
    const validation: ValidationBlock = {
      airlineMatch: Boolean(ssimAirline), // fine-grained operator match handled client-side
      recordCountOk: result.trailer ? result.trailer.recordCount === result.stats.totalRecords : true,
      missingAirports: Array.from(missingAirports).sort(),
      missingCityPairs: Array.from(missingCityPairs.values()),
      missingAircraftTypes: Array.from(missingAircraftTypes).sort(),
    }

    const response: ParseResponse = {
      carrier: result.carrier,
      flights: result.flights.map(stripLeg),
      stats: result.stats,
      errors: result.errors,
      trailer: result.trailer,
      validation,
    }
    return response
  })

  // ── 2. Auto-create missing airports via OurAirports lookup ────────────
  app.post('/ssim/import/airports', async (req, reply) => {
    const body = req.body as { codes?: string[] } | undefined
    const codes = Array.from(new Set((body?.codes ?? []).map((c) => c.toUpperCase().trim()))).filter(
      (c) => c.length === 3,
    )
    if (codes.length === 0) return { created: 0, skipped: 0 }

    let created = 0
    let skipped = 0
    const now = new Date().toISOString()
    for (const iata of codes) {
      const existing = await Airport.findOne({ iataCode: iata }, '_id').lean()
      if (existing) {
        skipped++
        continue
      }
      const info = await lookupAirportByIata(iata).catch(() => null)
      if (!info || !info.icaoCode) {
        skipped++
        continue
      }
      try {
        await Airport.create({
          _id: crypto.randomUUID(),
          icaoCode: info.icaoCode,
          iataCode: iata,
          name: info.name ?? iata,
          city: info.city ?? null,
          country: info.country ?? null,
          timezone: 'UTC', // best-effort default; operator can refine later
          latitude: info.latitude,
          longitude: info.longitude,
          elevationFt: info.elevationFt,
          isActive: true,
          createdAt: now,
        })
        created++
      } catch {
        skipped++
      }
    }
    return reply.send({ created, skipped })
  })

  // ── 3. Auto-create missing city pairs ─────────────────────────────────
  app.post('/ssim/import/city-pairs', async (req, reply) => {
    const { operatorId } = req.query as Record<string, string>
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const body = req.body as { pairs?: Array<{ dep: string; arr: string }> } | undefined
    const pairs = body?.pairs ?? []
    if (pairs.length === 0) return { created: 0, skipped: 0 }

    // Pre-load airport map for ICAO resolution.
    const iataCodes = new Set<string>()
    pairs.forEach((p) => {
      iataCodes.add(p.dep.toUpperCase())
      iataCodes.add(p.arr.toUpperCase())
    })
    const airports = await Airport.find(
      { iataCode: { $in: Array.from(iataCodes) } },
      'iataCode icaoCode country',
    ).lean()
    const byIata = new Map<string, { icao: string; country: string | null }>()
    for (const a of airports) {
      if (a.iataCode) {
        byIata.set(String(a.iataCode).toUpperCase(), {
          icao: String(a.icaoCode),
          country: (a.country as string | null) ?? null,
        })
      }
    }

    let created = 0
    let skipped = 0
    const now = new Date().toISOString()
    const seen = new Set<string>()
    for (const { dep, arr } of pairs) {
      const depU = dep.toUpperCase()
      const arrU = arr.toUpperCase()
      const ord = orderStations(depU, arrU)
      const dedupeKey = `${ord.station1}-${ord.station2}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      const a = byIata.get(ord.station1)
      const b = byIata.get(ord.station2)
      if (!a || !b) {
        skipped++
        continue
      }
      const existing = await CityPair.findOne({ operatorId, station1Icao: a.icao, station2Icao: b.icao }, '_id').lean()
      if (existing) {
        skipped++
        continue
      }
      const routeType = a.country && b.country ? (a.country === b.country ? 'domestic' : 'international') : 'unknown'
      try {
        await CityPair.create({
          _id: crypto.randomUUID(),
          operatorId,
          station1Icao: a.icao,
          station1Iata: ord.station1,
          station1CountryIso2: a.country,
          station2Icao: b.icao,
          station2Iata: ord.station2,
          station2CountryIso2: b.country,
          routeType,
          isActive: true,
          createdAt: now,
        })
        created++
      } catch {
        skipped++
      }
    }
    return reply.send({ created, skipped })
  })

  // ── 4. Clear existing flights (Replace mode) ──────────────────────────
  app.post('/ssim/import/clear', async (req, reply) => {
    const { operatorId, seasonCode, scenarioId } = req.query as Record<string, string>
    if (!operatorId || !seasonCode) {
      return reply.code(400).send({ error: 'operatorId + seasonCode required' })
    }

    const body = req.body as { dateFrom?: string; dateTo?: string } | undefined
    const filter: Record<string, unknown> = {
      operatorId,
      seasonCode,
      source: 'ssim_import',
      scenarioId: scenarioId ?? null,
    }
    if (body?.dateFrom && body?.dateTo) {
      // Clip to the user-selected window: delete flights whose effective
      // range overlaps [dateFrom, dateTo].
      filter.effectiveFrom = { $lte: body.dateTo }
      filter.effectiveUntil = { $gte: body.dateFrom }
    }

    const { deletedCount } = await ScheduledFlight.deleteMany(filter)
    return reply.send({ deleted: deletedCount ?? 0 })
  })

  // ── 5. Import one batch of flights ────────────────────────────────────
  // Body: { flights: ParsedFlightData[] with already-clipped dateFrom/dateTo,
  //         rotationMode, batchNum }
  app.post('/ssim/import/flights-batch', async (req, reply) => {
    const { operatorId, seasonCode, scenarioId } = req.query as Record<string, string>
    if (!operatorId || !seasonCode) {
      return reply.code(400).send({ error: 'operatorId + seasonCode required' })
    }

    const body = req.body as
      | {
          flights?: Array<ParsedFlightData & { effectiveFrom: string; effectiveUntil: string }>
          rotationMode?: RotationMode
          batchNum?: number
        }
      | undefined
    const flights = body?.flights ?? []
    const rotationMode: RotationMode = body?.rotationMode === 'combine-ofr' ? 'combine-ofr' : 'single-leg'
    if (flights.length === 0) return { created: 0, errors: [] as Array<{ lineNo: number; message: string }> }

    // Stamp rotationId/Sequence BEFORE insert so multi-leg rotations land
    // consistently in the same transactional boundary.
    const rotations = buildRotations(flights, rotationMode)

    // Resolve aircraft-type ICAO → id once (avoids N+1 lookups).
    const iataAircraftCodes = Array.from(new Set(flights.map((f) => f.aircraftType.toUpperCase())))
    const acTypes = await AircraftType.find(
      { operatorId, $or: [{ icaoType: { $in: iataAircraftCodes } }, { iataType: { $in: iataAircraftCodes } }] },
      '_id icaoType iataType',
    ).lean()
    const acByCode = new Map<string, { id: string; icao: string }>()
    for (const t of acTypes) {
      if (t.icaoType) acByCode.set(String(t.icaoType).toUpperCase(), { id: String(t._id), icao: String(t.icaoType) })
      if (t.iataType) acByCode.set(String(t.iataType).toUpperCase(), { id: String(t._id), icao: String(t.icaoType) })
    }

    // Resolve airport IATA → id for dep/arr airport refs.
    const allIata = new Set<string>()
    flights.forEach((f) => {
      allIata.add(f.depStation.toUpperCase())
      allIata.add(f.arrStation.toUpperCase())
    })
    const airports = await Airport.find({ iataCode: { $in: Array.from(allIata) } }, '_id iataCode').lean()
    const airportByIata = new Map<string, string>()
    for (const a of airports) if (a.iataCode) airportByIata.set(String(a.iataCode).toUpperCase(), String(a._id))

    const now = new Date().toISOString()
    const docs = flights.map((f, i) => {
      const rot = rotations[i]
      const acRef = acByCode.get(f.aircraftType.toUpperCase())
      return {
        _id: crypto.randomUUID(),
        operatorId,
        seasonCode,
        scenarioId: scenarioId ?? null,
        airlineCode: f.airlineCode.trim(),
        flightNumber: padFlightNumber(f.flightNumber),
        suffix: f.suffix || null,
        depStation: f.depStation,
        arrStation: f.arrStation,
        depAirportId: airportByIata.get(f.depStation.toUpperCase()) ?? null,
        arrAirportId: airportByIata.get(f.arrStation.toUpperCase()) ?? null,
        stdUtc: colonize(f.stdUtc),
        staUtc: colonize(f.staUtc),
        stdLocal: f.stdLocal ? colonize(f.stdLocal) : null,
        staLocal: f.staLocal ? colonize(f.staLocal) : null,
        blockMinutes: f.blockMinutes || null,
        daysOfWeek: f.daysOfOperation,
        aircraftTypeId: acRef?.id ?? null,
        aircraftTypeIcao: acRef?.icao ?? f.aircraftType.toUpperCase(),
        serviceType: f.serviceType || 'J',
        status: 'draft' as const,
        effectiveFrom: f.effectiveFrom,
        effectiveUntil: f.effectiveUntil,
        isActive: true,
        rotationId: rot.rotationId,
        rotationSequence: rot.rotationSequence,
        rotationLabel: rot.rotationLabel,
        source: 'ssim_import' as const,
        sortOrder: (body?.batchNum ?? 0) * 1000 + i,
        createdAt: now,
      }
    })

    // Try the fast path first; fall back to per-doc insert on error to
    // isolate individual failures.
    const errors: Array<{ lineNo: number; message: string }> = []
    try {
      await ScheduledFlight.insertMany(docs, { ordered: false })
      return { created: docs.length, errors }
    } catch {
      let created = 0
      for (let i = 0; i < docs.length; i++) {
        try {
          await ScheduledFlight.create(docs[i])
          created++
        } catch (err) {
          errors.push({
            lineNo: flights[i].recordNumber,
            message: err instanceof Error ? err.message : 'insert failed',
          })
        }
      }
      return { created, errors }
    }
  })

  // ── 6. Finalize — backfill any nulled refs we couldn't resolve earlier ─
  app.post('/ssim/import/finalize', async (req, reply) => {
    const { operatorId, seasonCode, scenarioId } = req.query as Record<string, string>
    if (!operatorId || !seasonCode) {
      return reply.code(400).send({ error: 'operatorId + seasonCode required' })
    }

    const airports = await Airport.find({}, '_id iataCode').lean()
    const byIata = new Map<string, string>()
    for (const a of airports) if (a.iataCode) byIata.set(String(a.iataCode).toUpperCase(), String(a._id))

    const flights = await ScheduledFlight.find(
      { operatorId, seasonCode, scenarioId: scenarioId ?? null, source: 'ssim_import' },
      '_id depStation arrStation depAirportId arrAirportId',
    ).lean()

    let synced = 0
    for (const f of flights) {
      const depId = (f as { depAirportId?: string | null }).depAirportId
      const arrId = (f as { arrAirportId?: string | null }).arrAirportId
      const depNeeded = !depId ? byIata.get(String(f.depStation).toUpperCase()) : null
      const arrNeeded = !arrId ? byIata.get(String(f.arrStation).toUpperCase()) : null
      if (depNeeded || arrNeeded) {
        const update: Record<string, string> = {}
        if (depNeeded) update.depAirportId = depNeeded
        if (arrNeeded) update.arrAirportId = arrNeeded
        await ScheduledFlight.updateOne({ _id: f._id }, { $set: update })
        synced++
      }
    }
    return reply.send({ synced })
  })

  // ── 7. Seed median block time per city-pair ───────────────────────────
  app.post('/ssim/import/block-times', async (req, reply) => {
    const { operatorId, seasonCode, scenarioId } = req.query as Record<string, string>
    if (!operatorId || !seasonCode) {
      return reply.code(400).send({ error: 'operatorId + seasonCode required' })
    }

    const flights = await ScheduledFlight.find(
      {
        operatorId,
        seasonCode,
        scenarioId: scenarioId ?? null,
        source: 'ssim_import',
        blockMinutes: { $gt: 0 },
      },
      'depStation arrStation blockMinutes',
    ).lean()

    // Bucket by ordered station pair → array of blockMinutes.
    const buckets = new Map<string, number[]>()
    for (const f of flights) {
      const dep = String(f.depStation).toUpperCase()
      const arr = String(f.arrStation).toUpperCase()
      const ord = orderStations(dep, arr)
      const key = `${ord.station1}-${ord.station2}`
      const list = buckets.get(key) ?? []
      list.push(Number(f.blockMinutes))
      buckets.set(key, list)
    }

    let updated = 0
    for (const [key, mins] of buckets) {
      if (mins.length === 0) continue
      const sorted = [...mins].sort((a, b) => a - b)
      const median =
        sorted.length % 2 === 0
          ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
          : sorted[Math.floor(sorted.length / 2)]
      const [iata1, iata2] = key.split('-')
      const a = await Airport.findOne({ iataCode: iata1 }, 'icaoCode').lean()
      const b = await Airport.findOne({ iataCode: iata2 }, 'icaoCode').lean()
      if (!a || !b) continue
      const res = await CityPair.updateOne(
        { operatorId, station1Icao: a.icaoCode, station2Icao: b.icaoCode },
        { $set: { standardBlockMinutes: median } },
      )
      if (res.modifiedCount > 0) updated++
    }
    return reply.send({ updated })
  })
}
