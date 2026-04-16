import type { FastifyInstance } from 'fastify'
import { WeatherObservation } from '../models/WeatherObservation.js'
import { Airport } from '../models/Airport.js'

type TierCount = { warn: number; caution: number; none: number }

async function latestByIcao(icaos: string[]) {
  if (icaos.length === 0) return [] as any[]
  const upper = icaos.map((c) => c.toUpperCase())
  const rows = await WeatherObservation.aggregate([
    { $match: { icao: { $in: upper } } },
    { $sort: { observedAt: -1 } },
    {
      $group: {
        _id: '$icao',
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
  ])
  return rows
}

export async function weatherRoutes(app: FastifyInstance) {
  // ── GET /weather/alerts?icaos=... — bulk latest observations + tier counts ──
  app.get('/weather/alerts', async (req) => {
    const q = req.query as { icaos?: string }

    let icaoList: string[]
    if (q.icaos && q.icaos.trim()) {
      icaoList = q.icaos
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    } else {
      const monitored = await Airport.find(
        { isActive: true, weatherMonitored: true },
        { icaoCode: 1, weatherStation: 1 },
      ).lean()
      icaoList = Array.from(
        new Set(
          (monitored as unknown as Array<{ icaoCode?: string; weatherStation?: string | null }>)
            .map((a) => (a.weatherStation || a.icaoCode || '').toUpperCase())
            .filter(Boolean),
        ),
      )
    }

    const rows = await latestByIcao(icaoList)
    const counts: TierCount = { warn: 0, caution: 0, none: 0 }
    for (const r of rows) counts[r.alertTier as keyof TierCount] += 1

    const ifrCount = rows.filter((r) => r.flightCategory === 'IFR' || r.flightCategory === 'LIFR').length

    const worst = [...rows].sort((a, b) => {
      const order = { warn: 0, caution: 1, none: 2 } as const
      const ai = order[a.alertTier as keyof typeof order] ?? 3
      const bi = order[b.alertTier as keyof typeof order] ?? 3
      return ai - bi
    })[0]

    return {
      stationsMonitored: icaoList.length,
      stationsReporting: rows.length,
      counts,
      ifrCount,
      worst: worst
        ? {
            icao: worst.icao,
            flightCategory: worst.flightCategory,
            alertTier: worst.alertTier,
            observedAt: worst.observedAt,
          }
        : null,
      observations: rows.map((r) => ({
        icao: r.icao,
        observedAt: r.observedAt,
        raw: r.raw,
        flightCategory: r.flightCategory,
        alertTier: r.alertTier,
        windSpeedKts: r.windSpeedKts,
        windGustKts: r.windGustKts,
        visibilityMeters: r.visibilityMeters,
        ceilingFeet: r.ceilingFeet,
        weatherPhenomena: r.weatherPhenomena,
      })),
    }
  })

  // ── GET /weather/station/:icao — latest observation for one station ──
  app.get('/weather/station/:icao', async (req, reply) => {
    const { icao } = req.params as { icao: string }
    const rows = await latestByIcao([icao])
    if (rows.length === 0) return reply.code(404).send({ error: 'No observation available' })
    const r = rows[0]
    return {
      icao: r.icao,
      observedAt: r.observedAt,
      raw: r.raw,
      flightCategory: r.flightCategory,
      alertTier: r.alertTier,
      windDirectionDeg: r.windDirectionDeg,
      windSpeedKts: r.windSpeedKts,
      windGustKts: r.windGustKts,
      visibilityMeters: r.visibilityMeters,
      ceilingFeet: r.ceilingFeet,
      temperatureC: r.temperatureC,
      dewpointC: r.dewpointC,
      weatherPhenomena: r.weatherPhenomena,
    }
  })
}
