import type { FastifyInstance } from 'fastify'
import { FlightInstance } from '../models/FlightInstance.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { Airport } from '../models/Airport.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { LopaConfig } from '../models/LopaConfig.js'

const DAY_MS = 86_400_000

/** Convert "0630" or "06:30" → ms from midnight */
function timeStringToMs(time: string): number {
  const clean = time.replace(':', '')
  const h = parseInt(clean.slice(0, 2), 10) || 0
  const m = parseInt(clean.slice(2, 4), 10) || 0
  return (h * 60 + m) * 60_000
}

/** Normalize date: "DD/MM/YYYY" or ISO → ISO */
function normalizeDate(d: string): string {
  if (d.includes('/')) {
    const [day, month, year] = d.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return d
}

function dateToDayMs(dateStr: string): number {
  return new Date(normalizeDate(dateStr) + 'T00:00:00Z').getTime()
}

export async function flightRoutes(app: FastifyInstance): Promise<void> {
  // Reconcile schema-declared indexes — picks up the new
  // (operatorId, depStation, arrStation) index added for /flights/search.
  ScheduledFlight.syncIndexes().catch((err) => {
    app.log.warn({ err }, 'flights: ScheduledFlight syncIndexes failed')
  })

  // GET /flights?from=&to= — operatorId is always req.operatorId (from JWT)
  //
  // With from+to: expand ScheduledFlight patterns over the date range and overlay
  // per-date FlightInstance data. Daily-schedule reports rely on this so that
  // pattern-level tail assignments (ScheduledFlight.aircraftReg) still show up
  // when no FlightInstance exists yet.
  //
  // Without from+to: legacy FlightInstance-only query (flight-ops callers).
  app.get('/flights', async (req) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const operatorId = req.operatorId as string

    if (!from || !to) {
      const filter: Record<string, unknown> = { operatorId }
      // allowDiskUse fallback for operators large enough to exceed the 32 MB
      // in-memory sort limit even with the supporting index.
      return FlightInstance.find(filter).sort({ 'schedule.stdUtc': 1 }).allowDiskUse(true).lean()
    }

    // Build the set of operating dates in the window — extend back 7 days so we
    // capture lookback pattern expansions (long-haul flights whose operatingDate
    // is earlier than their actual departure due to departureDayOffset). Include
    // both ISO and DD/MM/YYYY format to cover any legacy rows.
    const fromMsPre = dateToDayMs(from)
    const toMsPre = dateToDayMs(to)
    const LOOKBACK_DAYS = 7
    const dateVariants: string[] = []
    for (let d = fromMsPre - LOOKBACK_DAYS * DAY_MS; d <= toMsPre; d += DAY_MS) {
      const iso = new Date(d).toISOString().slice(0, 10)
      const [yyyy, mm, dd] = iso.split('-')
      dateVariants.push(iso, `${dd}/${mm}/${yyyy}`)
    }

    // Daily-schedule report is always production. Scenario patterns (cloned
    // from production with the same flightNumber/dep/arr) would double-render
    // every row, which is how 2419 rows appeared for a 1216-flight schedule.
    const [scheduledFlights, instances, registrations, lopaConfigs] = await Promise.all([
      ScheduledFlight.find({
        operatorId,
        isActive: { $ne: false },
        scenarioId: null,
        status: { $ne: 'cancelled' },
      }).lean(),
      FlightInstance.find({
        operatorId,
        operatingDate: { $in: dateVariants },
      }).lean(),
      AircraftRegistration.find(
        { operatorId },
        {
          registration: 1,
          aircraftTypeId: 1,
          lopaConfigId: 1,
        },
      ).lean(),
      LopaConfig.find(
        { operatorId, isActive: true },
        {
          _id: 1,
          aircraftType: 1,
          cabins: 1,
          totalSeats: 1,
          isDefault: 1,
        },
      ).lean(),
    ])

    // Instance overlay keyed by compositeId ${sfId}|${isoDate}. We normalize the
    // operatingDate side of each instance so DD/MM/YYYY legacy rows line up with
    // the ISO compositeId we build from the pattern expansion.
    const instanceMap = new Map<string, (typeof instances)[number]>()
    for (const inst of instances) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawId = inst._id as string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sfId = (inst as any).scheduledFlightId as string | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opDate = (inst as any).operatingDate as string | null

      // Primary: as-stored
      instanceMap.set(rawId, inst)

      // Secondary: rebuild composite from (scheduledFlightId, normalized operatingDate)
      // so legacy DD/MM/YYYY or out-of-sync _ids still match this request's ISO keys.
      if (sfId && opDate) {
        const isoOpDate = normalizeDate(opDate)
        const isoCompositeId = `${sfId}|${isoOpDate}`
        if (!instanceMap.has(isoCompositeId)) instanceMap.set(isoCompositeId, inst)
      }
    }

    // Airport lookup for dep/arr icao+iata pair
    const stationCodes = new Set<string>()
    for (const sf of scheduledFlights) {
      if (sf.depStation) stationCodes.add(sf.depStation)
      if (sf.arrStation) stationCodes.add(sf.arrStation)
    }
    const airports = stationCodes.size
      ? await Airport.find(
          { $or: [{ icaoCode: { $in: [...stationCodes] } }, { iataCode: { $in: [...stationCodes] } }] },
          { icaoCode: 1, iataCode: 1 },
        ).lean()
      : []
    const stationToPair = new Map<string, { icao: string; iata: string }>()
    for (const ap of airports) {
      const pair = { icao: (ap.icaoCode as string) ?? '', iata: (ap.iataCode as string) ?? '' }
      if (ap.icaoCode) stationToPair.set(ap.icaoCode as string, pair)
      if (ap.iataCode) stationToPair.set(ap.iataCode as string, pair)
    }

    // LOPA lookup chain: registration → registration.lopaConfigId → LopaConfig
    // fallback: aircraftTypeIcao → default LopaConfig for that type
    const lopaById = new Map(lopaConfigs.map((l) => [l._id as string, l]))
    const lopaDefaultByType = new Map<string, (typeof lopaConfigs)[number]>()
    for (const l of lopaConfigs) {
      if (l.isDefault && !lopaDefaultByType.has(l.aircraftType as string)) {
        lopaDefaultByType.set(l.aircraftType as string, l)
      }
    }
    const regByName = new Map(registrations.map((r) => [r.registration as string, r]))

    function resolveLopa(
      registration: string | null,
      icaoType: string | null,
    ): { cabins: { classCode: string; seats: number }[]; totalSeats: number } | null {
      if (registration) {
        const reg = regByName.get(registration)
        if (reg?.lopaConfigId) {
          const l = lopaById.get(reg.lopaConfigId as string)
          if (l) {
            return {
              cabins: (l.cabins as { classCode: string; seats: number }[]) ?? [],
              totalSeats: (l.totalSeats as number) ?? 0,
            }
          }
        }
      }
      if (icaoType) {
        const l = lopaDefaultByType.get(icaoType)
        if (l) {
          return {
            cabins: (l.cabins as { classCode: string; seats: number }[]) ?? [],
            totalSeats: (l.totalSeats as number) ?? 0,
          }
        }
      }
      return null
    }

    const fromMs = dateToDayMs(from)
    const toMs = dateToDayMs(to)
    const visibleEndMs = toMs + DAY_MS
    const out: unknown[] = []

    for (const sf of scheduledFlights) {
      const effFromMs = dateToDayMs(sf.effectiveFrom)
      const effUntilMs = dateToDayMs(sf.effectiveUntil)
      const dow = sf.daysOfWeek
      const depOffset = sf.departureDayOffset ?? 1
      const arrOffset = sf.arrivalDayOffset ?? 1
      const maxOffset = Math.max(depOffset, arrOffset)

      const rangeStart = Math.max(effFromMs, fromMs - (maxOffset - 1) * DAY_MS)
      const rangeEnd = Math.min(effUntilMs, toMs)

      for (let dayMs = rangeStart; dayMs <= rangeEnd; dayMs += DAY_MS) {
        const opDate = new Date(dayMs).toISOString().slice(0, 10)
        const jsDay = new Date(opDate + 'T12:00:00Z').getUTCDay()
        const ssimDay = jsDay === 0 ? 7 : jsDay
        if (!dow.includes(String(ssimDay))) continue

        const stdMs = dayMs + (depOffset - 1) * DAY_MS + timeStringToMs(sf.stdUtc)
        const staMs = dayMs + (arrOffset - 1) * DAY_MS + timeStringToMs(sf.staUtc)
        if (staMs < fromMs || stdMs >= visibleEndMs) continue

        const compositeId = `${sf._id}|${opDate}`
        const inst = instanceMap.get(compositeId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instAny = inst as any
        if (instAny?.status === 'cancelled') continue

        const depPair = stationToPair.get(sf.depStation) ?? { icao: sf.depStation, iata: sf.depStation }
        const arrPair = stationToPair.get(sf.arrStation) ?? { icao: sf.arrStation, iata: sf.arrStation }

        const tailReg = instAny?.tail?.registration ?? sf.aircraftReg ?? null
        const tailIcaoType = instAny?.tail?.icaoType ?? sf.aircraftTypeIcao ?? null

        out.push({
          _id: compositeId,
          operatorId,
          scheduledFlightId: sf._id,
          flightNumber: sf.flightNumber,
          operatingDate: opDate,
          dep: depPair,
          arr: arrPair,
          schedule: { stdUtc: stdMs, staUtc: staMs },
          estimated: {
            etdUtc: instAny?.estimated?.etdUtc ?? null,
            etaUtc: instAny?.estimated?.etaUtc ?? null,
          },
          actual: {
            atdUtc: instAny?.actual?.atdUtc ?? null,
            offUtc: instAny?.actual?.offUtc ?? null,
            onUtc: instAny?.actual?.onUtc ?? null,
            ataUtc: instAny?.actual?.ataUtc ?? null,
          },
          tail: { registration: tailReg, icaoType: tailIcaoType },
          pax: {
            adultExpected: instAny?.pax?.adultExpected ?? null,
            adultActual: instAny?.pax?.adultActual ?? null,
            childExpected: instAny?.pax?.childExpected ?? null,
            childActual: instAny?.pax?.childActual ?? null,
            infantExpected: instAny?.pax?.infantExpected ?? null,
            infantActual: instAny?.pax?.infantActual ?? null,
          },
          fuel: {
            initial: instAny?.fuel?.initial ?? null,
            uplift: instAny?.fuel?.uplift ?? null,
            burn: instAny?.fuel?.burn ?? null,
            flightPlan: instAny?.fuel?.flightPlan ?? null,
          },
          lopa: resolveLopa(tailReg, tailIcaoType),
          crew: instAny?.crew ?? [],
          delays: instAny?.delays ?? [],
          status: instAny?.status ?? (tailReg ? 'assigned' : 'scheduled'),
          syncMeta: instAny?.syncMeta ?? { updatedAt: Date.now(), version: 1 },
        })
      }
    }

    out.sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((a as any).schedule.stdUtc as number) - ((b as any).schedule.stdUtc as number)
    })

    return out
  })

  // GET /flights/search?origin=HAN&destination=CXR&date=YYYY-MM-DD
  // Returns a slim list of company flights between the two stations on the
  // given operating date. Used by the GCS positioning drawer to populate the
  // candidate flight list. Origin/destination accept IATA or ICAO; we match
  // either by joining ScheduledFlight.depStation against both Airport.iataCode
  // and Airport.icaoCode.
  app.get('/flights/search', async (req, reply) => {
    const q = req.query as { origin?: string; destination?: string; date?: string }
    const operatorId = req.operatorId as string
    if (!q.origin || !q.destination || !q.date) {
      return reply.code(400).send({ error: 'origin, destination and date are required' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) {
      return reply.code(400).send({ error: 'date must be YYYY-MM-DD' })
    }

    const origin = q.origin.toUpperCase()
    const destination = q.destination.toUpperCase()
    const date = q.date

    // Resolve airport codes to both IATA + ICAO so a HAN/VVNB pattern still
    // matches when the user typed only one form. Projection trimmed to keep
    // the response small — only the two code fields are needed.
    const airports = await Airport.find(
      {
        $or: [{ iataCode: { $in: [origin, destination] } }, { icaoCode: { $in: [origin, destination] } }],
      },
      { iataCode: 1, icaoCode: 1 },
    )
      .lean()
      .limit(8)
    const codesFor = (code: string): string[] => {
      const out = new Set<string>([code])
      for (const ap of airports) {
        if (ap.iataCode === code || ap.icaoCode === code) {
          if (ap.iataCode) out.add(ap.iataCode as string)
          if (ap.icaoCode) out.add(ap.icaoCode as string)
        }
      }
      return [...out]
    }
    const originCodes = codesFor(origin)
    const destCodes = codesFor(destination)

    // ScheduledFlight stores a single station code; effectiveFrom/Until is a
    // closed range; daysOfWeek is a string SSIM list ('1'..'7').
    const dateMs = dateToDayMs(date)
    const jsDay = new Date(date + 'T12:00:00Z').getUTCDay()
    const ssimDay = jsDay === 0 ? 7 : jsDay
    const effFromMax = `${date}T23:59:59Z`
    const effUntilMin = `${date}T00:00:00Z`

    // Run pattern + per-date instance fetch in parallel. Slim projections
    // and a 200-row cap keep the wire payload small for high-frequency
    // airports (HAN-SGN can have 30+ patterns spanning a year).
    const [patterns, instances] = await Promise.all([
      ScheduledFlight.find(
        {
          operatorId,
          isActive: { $ne: false },
          scenarioId: null,
          status: { $ne: 'cancelled' },
          depStation: { $in: originCodes },
          arrStation: { $in: destCodes },
        },
        {
          _id: 1,
          flightNumber: 1,
          depStation: 1,
          arrStation: 1,
          stdUtc: 1,
          staUtc: 1,
          daysOfWeek: 1,
          effectiveFrom: 1,
          effectiveUntil: 1,
          departureDayOffset: 1,
          arrivalDayOffset: 1,
          aircraftReg: 1,
          aircraftTypeIcao: 1,
        },
      )
        .lean()
        .limit(200),
      FlightInstance.find(
        { operatorId, operatingDate: date },
        { _id: 1, scheduledFlightId: 1, status: 1, tail: 1, estimated: 1 },
      )
        .lean()
        .limit(500),
    ])
    const instById = new Map(instances.map((i) => [i._id as string, i]))

    type Candidate = {
      _id: string
      flightNumber: string
      operatingDate: string
      stdUtcMs: number
      staUtcMs: number
      depCode: string
      arrCode: string
      tail: string | null
      icaoType: string | null
      status: string
    }
    const out: Candidate[] = []
    for (const sf of patterns) {
      // Effective range filter — both `effectiveFrom` and `effectiveUntil`
      // are stored as ISO strings so a string compare works.
      if (sf.effectiveFrom && sf.effectiveFrom > effFromMax) continue
      if (sf.effectiveUntil && sf.effectiveUntil < effUntilMin) continue
      if (sf.daysOfWeek && !sf.daysOfWeek.includes(String(ssimDay))) continue

      const depOffset = sf.departureDayOffset ?? 1
      const arrOffset = sf.arrivalDayOffset ?? 1
      const stdMs = dateMs + (depOffset - 1) * DAY_MS + timeStringToMs(sf.stdUtc)
      const staMs = dateMs + (arrOffset - 1) * DAY_MS + timeStringToMs(sf.staUtc)
      const compositeId = `${sf._id}|${date}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = instById.get(compositeId) as any
      if (inst?.status === 'cancelled') continue

      out.push({
        _id: compositeId,
        flightNumber: sf.flightNumber,
        operatingDate: date,
        stdUtcMs: inst?.estimated?.etdUtc ?? stdMs,
        staUtcMs: inst?.estimated?.etaUtc ?? staMs,
        depCode: sf.depStation,
        arrCode: sf.arrStation,
        tail: inst?.tail?.registration ?? sf.aircraftReg ?? null,
        icaoType: inst?.tail?.icaoType ?? sf.aircraftTypeIcao ?? null,
        status: inst?.status ?? (sf.aircraftReg ? 'assigned' : 'scheduled'),
      })
    }

    out.sort((a, b) => a.stdUtcMs - b.stdUtcMs)
    // Tell the browser this is safe to cache for a minute — same route+date
    // request inside the cache window skips the network entirely. Schedules
    // change at most a few times an hour in production; 60s is conservative.
    reply.header('Cache-Control', 'private, max-age=60')
    return out
  })

  // GET /flights/:id
  app.get('/flights/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const flight = await FlightInstance.findById(id).lean()

    if (!flight) {
      return reply.code(404).send({ error: 'Flight not found' })
    }

    return flight
  })

  // POST /flights
  app.post('/flights', async (req, reply) => {
    const body = req.body as Record<string, unknown>
    const flight = new FlightInstance(body)
    await flight.save()
    return reply.code(201).send(flight.toObject())
  })

  // PATCH /flights/:id
  app.patch('/flights/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const updates = req.body as Record<string, unknown>

    const flight = await FlightInstance.findByIdAndUpdate(
      id,
      {
        ...updates,
        'syncMeta.updatedAt': Date.now(),
        $inc: { 'syncMeta.version': 1 },
      },
      { new: true, runValidators: true },
    ).lean()

    if (!flight) {
      return reply.code(404).send({ error: 'Flight not found' })
    }

    return flight
  })
}
