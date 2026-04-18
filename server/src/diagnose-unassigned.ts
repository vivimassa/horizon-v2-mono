// Diagnostic: find why flights in a date range show as "Unassigned" in the
// daily schedule report. Walks the same path as /flights and prints where each
// flight's tail does or doesn't come from.

import 'dotenv/config'
import mongoose from 'mongoose'
import { ScheduledFlight } from './models/ScheduledFlight.js'
import { FlightInstance } from './models/FlightInstance.js'

const DAY_MS = 86_400_000

function normalize(d: string): string {
  if (d.includes('/')) {
    const [day, m, y] = d.split('/')
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return d
}
function toMs(d: string): number {
  return new Date(normalize(d) + 'T00:00:00Z').getTime()
}
function timeToMs(t: string): number {
  const c = t.replace(':', '')
  return ((parseInt(c.slice(0, 2), 10) || 0) * 60 + (parseInt(c.slice(2, 4), 10) || 0)) * 60_000
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  const operatorId = process.argv[2]
  const from = process.argv[3]
  const to = process.argv[4]
  if (!operatorId || !from || !to) {
    console.log('Usage: tsx diagnose-unassigned.ts <operatorId> <from YYYY-MM-DD> <to YYYY-MM-DD>')
    process.exit(1)
  }

  await mongoose.connect(uri)

  const [sfs, insts] = await Promise.all([
    ScheduledFlight.find({ operatorId, isActive: { $ne: false }, status: { $ne: 'cancelled' } }).lean(),
    FlightInstance.find({
      operatorId,
      operatingDate: {
        $in: (() => {
          const out: string[] = []
          const a = toMs(from),
            b = toMs(to)
          for (let d = a; d <= b; d += DAY_MS) {
            const iso = new Date(d).toISOString().slice(0, 10)
            const [y, m, dd] = iso.split('-')
            out.push(iso, `${dd}/${m}/${y}`)
          }
          return out
        })(),
      },
    }).lean(),
  ])

  const instMap = new Map<string, (typeof insts)[number]>()
  for (const i of insts) instMap.set(i._id as string, i)

  const fromMs = toMs(from)
  const toMsVal = toMs(to)
  const endMs = toMsVal + DAY_MS

  let total = 0
  let bothNull = 0
  let sfHasReg = 0
  let instHasReg = 0
  const sampleBoth: string[] = []
  const sampleSfOnly: string[] = []
  const sampleInstOnly: string[] = []
  const sfRegCountByFlight = new Map<string, number>()
  const sfNoRegCountByFlight = new Map<string, number>()

  for (const sf of sfs) {
    const effFrom = toMs(sf.effectiveFrom)
    const effUntil = toMs(sf.effectiveUntil)
    const dow = sf.daysOfWeek
    const depOff = sf.departureDayOffset ?? 1
    const arrOff = sf.arrivalDayOffset ?? 1
    const maxOff = Math.max(depOff, arrOff)
    const rs = Math.max(effFrom, fromMs - (maxOff - 1) * DAY_MS)
    const re = Math.min(effUntil, toMsVal)

    for (let dayMs = rs; dayMs <= re; dayMs += DAY_MS) {
      const opDate = new Date(dayMs).toISOString().slice(0, 10)
      const jsDay = new Date(opDate + 'T12:00:00Z').getUTCDay()
      const ssimDay = jsDay === 0 ? 7 : jsDay
      if (!dow.includes(String(ssimDay))) continue
      const stdMs = dayMs + (depOff - 1) * DAY_MS + timeToMs(sf.stdUtc)
      const staMs = dayMs + (arrOff - 1) * DAY_MS + timeToMs(sf.staUtc)
      if (staMs < fromMs || stdMs >= endMs) continue

      total++
      const compId = `${sf._id}|${opDate}`
      const inst = instMap.get(compId)
      const instReg = (inst as any)?.tail?.registration ?? null
      const sfReg = (sf as any).aircraftReg ?? null

      if (sfReg) {
        sfHasReg++
        sfRegCountByFlight.set(sf.flightNumber, (sfRegCountByFlight.get(sf.flightNumber) ?? 0) + 1)
      } else {
        sfNoRegCountByFlight.set(sf.flightNumber, (sfNoRegCountByFlight.get(sf.flightNumber) ?? 0) + 1)
      }
      if (instReg) instHasReg++

      if (!instReg && !sfReg) {
        bothNull++
        if (sampleBoth.length < 10) {
          sampleBoth.push(
            `${sf.airlineCode}${sf.flightNumber} ${sf.depStation}-${sf.arrStation} ${opDate} sfId=${sf._id} inst=${inst ? 'exists(tail=null)' : 'missing'} sf.aircraftReg=null`,
          )
        }
      } else if (sfReg && !instReg) {
        if (sampleSfOnly.length < 5) sampleSfOnly.push(`${sf.flightNumber} ${opDate} sf.aircraftReg=${sfReg}`)
      } else if (instReg && !sfReg) {
        if (sampleInstOnly.length < 5) sampleInstOnly.push(`${sf.flightNumber} ${opDate} inst.tail=${instReg}`)
      }
    }
  }

  console.log(`\n── Expansion for ${operatorId} ${from}→${to} ──`)
  console.log(`total flights (post-expansion): ${total}`)
  console.log(`  instance.tail.registration set: ${instHasReg}`)
  console.log(`  scheduledFlight.aircraftReg set: ${sfHasReg}`)
  console.log(`  BOTH null (UNASSIGNED in report): ${bothNull}`)
  console.log(`\nSample unassigned flights:`)
  for (const s of sampleBoth) console.log('  ', s)
  console.log(`\nSample sf-only (should now show assigned post-fix):`)
  for (const s of sampleSfOnly) console.log('  ', s)
  console.log(`\nSample inst-only:`)
  for (const s of sampleInstOnly) console.log('  ', s)

  // Top flight numbers by unassigned count
  const top = [...sfNoRegCountByFlight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  console.log(`\nTop flight numbers where sf.aircraftReg is null:`)
  for (const [fn, c] of top) console.log(`  ${fn}: ${c}`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
