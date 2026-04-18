import 'dotenv/config'
import { fastifyJwt } from '@fastify/jwt'
import Fastify from 'fastify'

// Mint a short-lived token using the same JWT plugin the server uses.
const app = Fastify()
await app.register(fastifyJwt, { secret: process.env.JWT_SECRET as string })
const tok = app.jwt.sign(
  { userId: 'skyhub-admin-001', operatorId: '20169cc0-c914-4662-a300-1dbbe20d1416', role: 'admin' },
  { expiresIn: '10m' },
)

const from = process.argv[2] ?? '2026-04-17'
const to = process.argv[3] ?? '2026-04-18'

const res = await fetch(`http://localhost:3002/flights?from=${from}&to=${to}`, {
  headers: { authorization: 'Bearer ' + tok },
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (await res.json()) as any[]
console.log('status:', res.status, 'count:', data.length)
let u = 0,
  a = 0
for (const f of data) {
  if (f.tail?.registration) a++
  else u++
}
console.log('assigned:', a, 'unassigned:', u)
console.log(
  'sample unassigned:',
  data
    .filter((f) => !f.tail?.registration)
    .slice(0, 6)
    .map((f) => ({
      fn: f.flightNumber,
      opDate: f.operatingDate,
      dep: f.dep?.iata ?? f.dep?.icao,
      arr: f.arr?.iata ?? f.arr?.icao,
      sfId: f.scheduledFlightId,
    })),
)
