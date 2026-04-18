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
      return FlightInstance.find(filter).sort({ 'schedule.stdUtc': 1 }).lean()
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
