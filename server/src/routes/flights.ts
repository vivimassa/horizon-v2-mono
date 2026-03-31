import type { FastifyInstance } from 'fastify'
import { FlightInstance } from '../models/FlightInstance.js'

export async function flightRoutes(app: FastifyInstance): Promise<void> {
  // GET /flights?operatorId=&from=&to=
  app.get('/flights', async (req, reply) => {
    const { operatorId, from, to } = req.query as {
      operatorId?: string
      from?: string
      to?: string
    }

    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    if (from || to) {
      filter.operatingDate = {
        ...(from && { $gte: from }),
        ...(to && { $lte: to }),
      }
    }

    const flights = await FlightInstance.find(filter)
      .sort({ 'schedule.stdUtc': 1 })
      .lean()

    return flights
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
      { new: true, runValidators: true }
    ).lean()

    if (!flight) {
      return reply.code(404).send({ error: 'Flight not found' })
    }

    return flight
  })
}
