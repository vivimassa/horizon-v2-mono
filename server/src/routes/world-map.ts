import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FlightInstance } from '../models/FlightInstance.js'
import { Airport } from '../models/Airport.js'
import { AircraftType } from '../models/AircraftType.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { LopaConfig } from '../models/LopaConfig.js'
import { Operator } from '../models/Operator.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'

const DAY_MS = 86_400_000

/** Format UTC epoch ms → "HH:MM" UTC */
function formatHHMM(ms: number | null | undefined): string | null {
  if (ms == null) return null
  const d = new Date(ms)
  const h = d.getUTCHours().toString().padStart(2, '0')
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/** Derive OOOI phase from actual timestamps */
function derivePhase(actual: {
  doorCloseUtc?: number | null
  atdUtc?: number | null
  offUtc?: number | null
  onUtc?: number | null
  ataUtc?: number | null
}): string | null {
  if (actual.ataUtc) return 'arrived'
  if (actual.onUtc) return 'landing'
  if (actual.offUtc) return 'airborne'
  if (actual.atdUtc || actual.doorCloseUtc) return 'boarding'
  return null
}

export async function worldMapRoutes(app: FastifyInstance): Promise<void> {
  // GET /world-map/flights?date=YYYY-MM-DD
  app.get('/world-map/flights', async (req, reply) => {
    const parsed = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid date — expected YYYY-MM-DD' })
    }
    const { date } = parsed.data
    const operatorId = req.operatorId

    // Window: today + yesterday-still-airborne (block > 180 min, no ata)
    const prevDate = new Date(new Date(date + 'T00:00:00Z').getTime() - DAY_MS).toISOString().slice(0, 10)

    const flights = await FlightInstance.find({
      operatorId,
      operatingDate: { $in: [prevDate, date] },
      status: { $ne: 'cancelled' },
    }).lean()

    // Drop yesterday's already-arrived flights and short ones
    const windowed = flights.filter((f) => {
      if (f.operatingDate === date) return true
      const blockMinutes =
        f.schedule?.staUtc && f.schedule?.stdUtc ? Math.round((f.schedule.staUtc - f.schedule.stdUtc) / 60_000) : 0
      return !f.actual?.ataUtc && blockMinutes > 180
    })

    // Collect codes needed for lookups
    const iataCodes = new Set<string>()
    const regs = new Set<string>()
    const sfIds = new Set<string>()
    for (const f of windowed) {
      if (f.dep?.iata) iataCodes.add(f.dep.iata)
      if (f.arr?.iata) iataCodes.add(f.arr.iata)
      if (f.tail?.registration) regs.add(f.tail.registration)
      if (f.scheduledFlightId) sfIds.add(f.scheduledFlightId)
    }

    const operator = await Operator.findById(operatorId).select({ iataCode: 1, icaoCode: 1 }).lean()
    const carrierPrefix = operator?.iataCode || operator?.icaoCode || ''

    const [airports, registrations, scheduledFlights] = await Promise.all([
      Airport.find({ iataCode: { $in: [...iataCodes] } })
        .select({ iataCode: 1, latitude: 1, longitude: 1 })
        .lean(),
      AircraftRegistration.find({ operatorId, registration: { $in: [...regs] } })
        .select({ registration: 1, lopaConfigId: 1 })
        .lean(),
      ScheduledFlight.find({ _id: { $in: [...sfIds] } })
        .select({ _id: 1, aircraftTypeIcao: 1 })
        .lean(),
    ])

    const airportByIata = new Map(airports.map((a) => [a.iataCode, a]))
    const icaoTypeBySfId = new Map(scheduledFlights.map((s) => [s._id as string, s.aircraftTypeIcao as string | null]))

    // Seat count lookup — via LopaConfig when available
    const lopaIds = registrations
      .map((r) => (r as Record<string, unknown>).lopaConfigId as string | undefined)
      .filter(Boolean) as string[]
    const lopas = lopaIds.length
      ? await LopaConfig.find({ _id: { $in: lopaIds } })
          .select({ _id: 1, totalSeats: 1 })
          .lean()
      : []
    const lopaById = new Map(lopas.map((l) => [l._id as string, l.totalSeats]))
    const seatsByReg = new Map<string, number>()
    for (const r of registrations) {
      const lopaId = (r as Record<string, unknown>).lopaConfigId as string | undefined
      if (lopaId && lopaById.has(lopaId)) seatsByReg.set(r.registration, lopaById.get(lopaId)!)
    }

    const result = windowed.map((f) => {
      const depApt = f.dep?.iata ? airportByIata.get(f.dep.iata) : null
      const arrApt = f.arr?.iata ? airportByIata.get(f.arr.iata) : null

      const blockMinutes =
        f.schedule?.staUtc && f.schedule?.stdUtc ? Math.round((f.schedule.staUtc - f.schedule.stdUtc) / 60_000) : 0

      const paxAdult = f.pax?.adultActual ?? 0
      const paxChild = f.pax?.childActual ?? 0
      const paxTotal = paxAdult + paxChild
      const seats = f.tail?.registration ? seatsByReg.get(f.tail.registration) : undefined
      const loadFactor = seats && seats > 0 && paxTotal > 0 ? (paxTotal / seats) * 100 : null

      const fuelData: Record<string, number> = {}
      if (f.fuel?.initial != null) fuelData.INIT = f.fuel.initial
      if (f.fuel?.uplift != null) fuelData.UPLF = f.fuel.uplift
      if (f.fuel?.burn != null) fuelData.BURN = f.fuel.burn
      if (f.fuel?.flightPlan != null) fuelData.FPLN = f.fuel.flightPlan

      const cargoData: Record<string, number> = {}
      for (const c of f.cargo ?? []) {
        if (c.weight != null) cargoData[c.category] = c.weight
      }

      // FlightInformationDialog expects "${scheduledFlightId}|${operatingDate}"
      const compositeId = f.scheduledFlightId ? `${f.scheduledFlightId}|${f.operatingDate}` : f._id
      // Prefix flight number with operator code (e.g. "VJ 42") unless already prefixed
      const fnStr = String(f.flightNumber ?? '')
      const displayFlightNumber = carrierPrefix && /^\d/.test(fnStr) ? `${carrierPrefix}${fnStr}` : fnStr

      return {
        id: compositeId,
        scheduledFlightId: f.scheduledFlightId ?? '',
        flightNumber: displayFlightNumber,
        depStation: f.dep?.iata ?? '',
        arrStation: f.arr?.iata ?? '',
        depLat: depApt?.latitude ?? 0,
        depLng: depApt?.longitude ?? 0,
        arrLat: arrApt?.latitude ?? 0,
        arrLng: arrApt?.longitude ?? 0,
        stdUtc: formatHHMM(f.schedule?.stdUtc) ?? '00:00',
        staUtc: formatHHMM(f.schedule?.staUtc) ?? '00:00',
        blockMinutes,
        status: f.status ?? 'scheduled',
        aircraftTypeIcao:
          f.tail?.icaoType ?? (f.scheduledFlightId ? (icaoTypeBySfId.get(f.scheduledFlightId) ?? null) : null),
        tailNumber: f.tail?.registration ?? null,
        flightPhase: derivePhase(f.actual ?? {}),
        actualOut: formatHHMM(f.actual?.atdUtc ?? f.actual?.doorCloseUtc),
        actualOff: formatHHMM(f.actual?.offUtc),
        actualOn: formatHHMM(f.actual?.onUtc),
        actualIn: formatHHMM(f.actual?.ataUtc),
        instanceDate: f.operatingDate,
        paxTotal,
        loadFactor,
        fuelData,
        cargoData,
      }
    })

    return result
  })

  // GET /world-map/airports
  app.get('/world-map/airports', async (req) => {
    const airports = await Airport.find({
      isActive: true,
      latitude: { $ne: null },
      longitude: { $ne: null },
      iataCode: { $ne: null },
    })
      .select({ iataCode: 1, name: 1, latitude: 1, longitude: 1, isHomeBase: 1, isCrewBase: 1 })
      .lean()

    return airports
      .filter((a) => a.iataCode)
      .map((a) => ({
        iataCode: a.iataCode,
        name: a.name,
        lat: a.latitude,
        lng: a.longitude,
        isHub: Boolean(a.isHomeBase || a.isCrewBase),
      }))
  })

  // GET /world-map/aircraft-type-colors
  app.get('/world-map/aircraft-type-colors', async (req) => {
    const types = await AircraftType.find({ operatorId: req.operatorId, color: { $ne: null } })
      .select({ icaoType: 1, color: 1 })
      .lean()
    const map: Record<string, string> = {}
    for (const t of types) {
      if (t.color) map[t.icaoType] = t.color
    }
    return map
  })

  // GET /world-map/airport-search?q=XXX — clock-dock autocomplete
  app.get('/world-map/airport-search', async (req) => {
    const { q } = (req.query as { q?: string }) ?? {}
    if (!q || q.length < 2) return []
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const airports = await Airport.find({
      isActive: true,
      timezone: { $nin: [null, ''] },
      $or: [{ iataCode: { $regex: '^' + pattern, $options: 'i' } }, { name: { $regex: pattern, $options: 'i' } }],
    })
      .select({ iataCode: 1, name: 1, timezone: 1 })
      .limit(12)
      .lean()

    return airports.map((a) => ({
      iata: a.iataCode ?? '',
      name: a.name,
      timezone: a.timezone,
    }))
  })
}
