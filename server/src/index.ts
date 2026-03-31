import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { connectDB } from './db/connection.js'
import { flightRoutes } from './routes/flights.js'
import { referenceRoutes } from './routes/reference.js'

const port = Number(process.env.PORT) || 3001

async function main(): Promise<void> {
  const app = Fastify({ logger: true })

  // Plugins
  await app.register(cors, { origin: true })
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  })

  // Database
  await connectDB()

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // Routes
  await app.register(flightRoutes)
  await app.register(referenceRoutes)

  // Start
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`✓ Server listening on port ${port}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
