/**
 * Seed slot series from ACTUAL scheduled flights only.
 * Wipes all existing slot data first, then creates series
 * by pairing arrivals/departures at each coordinated airport.
 *
 * Run: cd server && node seed-slots-from-schedule.mjs
 */
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import 'dotenv/config'

const MONGO_URI = process.env.MONGODB_URI
const SEASON = 'S26'

const STATUS_WEIGHTS = [
  { s: 'confirmed', w: 45 }, { s: 'offered', w: 15 }, { s: 'waitlisted', w: 8 },
  { s: 'refused', w: 5 }, { s: 'submitted', w: 12 }, { s: 'historic', w: 10 }, { s: 'draft', w: 5 },
]
const COORD = { confirmed: 'K', offered: 'O', refused: 'U', historic: 'H' }
const ACTIONS = ['N', 'Y', 'B', 'F', 'C', 'R']

function wr(items) { let t = items.reduce((s, i) => s + i.w, 0), r = Math.random() * t; for (const i of items) { r -= i.w; if (r <= 0) return i } return items[0] }
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

function getISOWeek(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const ys = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7)
}

function parseDate(str) {
  if (!str) return null
  if (str.includes('/')) { const [d, m, y] = str.split('/'); return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)) }
  return new Date(str)
}

function parseTime(str) {
  if (!str) return null
  const clean = String(str).replace(':', '')
  if (clean.length < 3) return null
  const padded = clean.padStart(4, '0')
  return parseInt(padded.slice(0, 2), 10) * 100 + parseInt(padded.slice(2, 4), 10)
}

function expandDates(seriesId, start, end, dow, freq) {
  const dates = []; const cur = new Date(start)
  let wc = 0, lw = -1
  while (cur <= end) {
    const jsDay = cur.getDay(); const iata = jsDay === 0 ? 7 : jsDay
    const iw = getISOWeek(cur)
    if (iw !== lw) { wc++; lw = iw }
    if (dow.includes(String(iata)) && (freq === 1 || wc % 2 === 1)) {
      dates.push(cur.toISOString().split('T')[0])
    }
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

const SEAT_MAP = { A320: 180, A321: 230, A350: 340, A380: 500 }

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')
  const db = mongoose.connection.db

  // 1. Wipe all existing slot data
  const delSeries = await db.collection('slotSeries').deleteMany({})
  const delDates = await db.collection('slotDates').deleteMany({})
  const delActions = await db.collection('slotActionLog').deleteMany({})
  const delMessages = await db.collection('slotMessages').deleteMany({})
  console.log(`Wiped: ${delSeries.deletedCount} series, ${delDates.deletedCount} dates, ${delActions.deletedCount} actions, ${delMessages.deletedCount} messages`)

  // 2. Get operator
  const ops = await db.collection('operators').find({}).toArray()
  const operatorId = ops[0]?._id
  const airlineCode = ops[0]?.iataCode || ops[0]?.icaoCode || 'SH'
  console.log(`Operator: ${operatorId} (${airlineCode})`)

  // 3. Get all slot-controlled airports
  const slotAirports = await db.collection('airports').find({ isSlotControlled: true }).project({ iataCode: 1, name: 1 }).toArray()
  const slotIatas = new Set(slotAirports.map(a => a.iataCode).filter(Boolean))
  console.log(`Slot-controlled airports: ${slotIatas.size}`)

  // 4. Get all scheduled flights
  const flights = await db.collection('scheduledFlights').find({
    operatorId,
    status: { $in: ['draft', 'active'] },
  }).toArray()
  console.log(`Scheduled flights: ${flights.length}`)

  // 5. Group flights by airport (arrivals + departures)
  const arrByAirport = new Map()
  const depByAirport = new Map()
  for (const f of flights) {
    if (f.arrStation && slotIatas.has(f.arrStation)) {
      if (!arrByAirport.has(f.arrStation)) arrByAirport.set(f.arrStation, [])
      arrByAirport.get(f.arrStation).push(f)
    }
    if (f.depStation && slotIatas.has(f.depStation)) {
      if (!depByAirport.has(f.depStation)) depByAirport.set(f.depStation, [])
      depByAirport.get(f.depStation).push(f)
    }
  }

  // 6. Create series by pairing arrivals/departures at each airport
  const now = new Date().toISOString()
  const today = new Date()
  let totalSeries = 0
  let totalDates = 0
  let totalActions = 0
  const airportsProcessed = []

  for (const iata of slotIatas) {
    const arrivals = arrByAirport.get(iata) || []
    const departures = depByAirport.get(iata) || []

    if (arrivals.length === 0 && departures.length === 0) continue

    // Build departure lookup by flight number for pairing
    const depMap = new Map()
    for (const d of departures) depMap.set(d.flightNumber, d)

    const seriesDocs = []
    const dateDocs = []
    const actionDocs = []

    // Pair arrivals with departures
    for (const arr of arrivals) {
      const fNum = parseInt(arr.flightNumber, 10)
      const dep = !isNaN(fNum) ? (depMap.get(String(fNum + 1)) || depMap.get(String(fNum - 1))) : null

      const arrTime = parseTime(arr.staUtc)
      const depTime = dep ? parseTime(dep.stdUtc) : null
      const { s: status } = wr(STATUS_WEIGHTS)
      const priority = ['historic', 'changed_historic', 'new_entrant', 'new', 'adhoc'][ri(0, 4)]
      const offset = ri(-15, 15) * (Math.random() > 0.6 ? 1 : 0)
      const acType = arr.aircraftTypeIcao || null
      const seats = SEAT_MAP[acType] || null

      const id = crypto.randomUUID()
      seriesDocs.push({
        _id: id,
        operatorId,
        airportIata: iata,
        seasonCode: SEASON,
        arrivalFlightNumber: `${arr.airlineCode}${arr.flightNumber}`,
        departureFlightNumber: dep ? `${dep.airlineCode}${dep.flightNumber}` : null,
        arrivalOriginIata: arr.depStation,
        departureDestIata: dep?.arrStation || null,
        requestedArrivalTime: arrTime,
        requestedDepartureTime: depTime,
        allocatedArrivalTime: ['confirmed', 'offered', 'historic'].includes(status) ? (arrTime != null ? Math.max(0, arrTime + offset) : null) : null,
        allocatedDepartureTime: ['confirmed', 'offered', 'historic'].includes(status) ? (depTime != null ? Math.max(0, depTime + offset) : null) : null,
        overnightIndicator: depTime != null && arrTime != null && depTime < arrTime ? 1 : 0,
        periodStart: arr.effectiveFrom || '29/03/2026',
        periodEnd: arr.effectiveUntil || '24/10/2026',
        daysOfOperation: arr.daysOfWeek || '1234567',
        frequencyRate: 1,
        seats,
        aircraftTypeIcao: acType,
        arrivalServiceType: arr.serviceType || 'J',
        departureServiceType: dep?.serviceType || 'J',
        status,
        priorityCategory: priority,
        historicEligible: ['historic', 'changed_historic'].includes(priority),
        lastActionCode: ACTIONS[ri(0, 5)],
        lastCoordinatorCode: COORD[status] || null,
        flexibilityArrival: null,
        flexibilityDeparture: null,
        minTurnaroundMinutes: null,
        coordinatorRef: ['confirmed', 'offered', 'refused'].includes(status) ? `REYT${ri(100000, 999999)}` : null,
        coordinatorReasonArrival: null,
        coordinatorReasonDeparture: null,
        waitlistPosition: status === 'waitlisted' ? ri(1, 20) : null,
        linkedScheduledFlightId: arr._id,
        notes: null,
        createdAt: now,
        updatedAt: now,
      })

      // Expand dates
      const ps = parseDate(arr.effectiveFrom || '29/03/2026')
      const pe = parseDate(arr.effectiveUntil || '24/10/2026')
      if (ps && pe && !isNaN(ps.getTime()) && !isNaN(pe.getTime())) {
        const dateStrings = expandDates(id, ps, pe, arr.daysOfWeek || '1234567', 1)
        for (const ds of dateStrings) {
          const d = new Date(ds)
          let op = 'scheduled'
          if (d < today) {
            const roll = Math.random()
            if (['confirmed', 'historic'].includes(status)) op = roll < 0.88 ? 'operated' : roll < 0.94 ? 'cancelled' : roll < 0.97 ? 'jnus' : 'no_show'
            else if (status === 'offered') op = roll < 0.75 ? 'operated' : roll < 0.88 ? 'cancelled' : 'jnus'
            else if (['refused', 'waitlisted'].includes(status)) op = roll < 0.3 ? 'operated' : roll < 0.7 ? 'cancelled' : 'no_show'
            else op = roll < 0.6 ? 'operated' : 'cancelled'
          }
          dateDocs.push({
            _id: crypto.randomUUID(), seriesId: id, slotDate: ds, operationStatus: op,
            jnusReason: op === 'jnus' ? ['Weather', 'ATC disruption', 'Airport/airspace closure'][ri(0, 2)] : null,
            jnusEvidence: null, actualArrivalTime: null, actualDepartureTime: null, createdAt: now,
          })
        }
      }

      // Action log
      actionDocs.push({ _id: crypto.randomUUID(), seriesId: id, actionCode: ACTIONS[ri(0, 5)], actionSource: 'airline', messageId: null, details: null, createdAt: new Date(Date.now() - ri(30, 120) * 86400000).toISOString() })
      if (COORD[status]) actionDocs.push({ _id: crypto.randomUUID(), seriesId: id, actionCode: COORD[status], actionSource: 'coordinator', messageId: null, details: null, createdAt: new Date(Date.now() - ri(5, 29) * 86400000).toISOString() })

      // Remove paired departure so it's not double-processed
      if (dep) depMap.delete(dep.flightNumber)
    }

    // Unpaired departures
    for (const [, dep] of depMap) {
      const depTime = parseTime(dep.stdUtc)
      const { s: status } = wr(STATUS_WEIGHTS)
      const priority = ['historic', 'changed_historic', 'new_entrant', 'new', 'adhoc'][ri(0, 4)]
      const acType = dep.aircraftTypeIcao || null
      const seats = SEAT_MAP[acType] || null
      const id = crypto.randomUUID()

      seriesDocs.push({
        _id: id, operatorId, airportIata: iata, seasonCode: SEASON,
        arrivalFlightNumber: null,
        departureFlightNumber: `${dep.airlineCode}${dep.flightNumber}`,
        arrivalOriginIata: null, departureDestIata: dep.arrStation,
        requestedArrivalTime: null, requestedDepartureTime: depTime,
        allocatedArrivalTime: null, allocatedDepartureTime: null,
        overnightIndicator: 0,
        periodStart: dep.effectiveFrom || '29/03/2026', periodEnd: dep.effectiveUntil || '24/10/2026',
        daysOfOperation: dep.daysOfWeek || '1234567', frequencyRate: 1,
        seats, aircraftTypeIcao: acType,
        arrivalServiceType: 'J', departureServiceType: dep.serviceType || 'J',
        status, priorityCategory: priority,
        historicEligible: ['historic', 'changed_historic'].includes(priority),
        lastActionCode: ACTIONS[ri(0, 5)], lastCoordinatorCode: COORD[status] || null,
        flexibilityArrival: null, flexibilityDeparture: null, minTurnaroundMinutes: null,
        coordinatorRef: ['confirmed', 'offered', 'refused'].includes(status) ? `REYT${ri(100000, 999999)}` : null,
        coordinatorReasonArrival: null, coordinatorReasonDeparture: null,
        waitlistPosition: status === 'waitlisted' ? ri(1, 20) : null,
        linkedScheduledFlightId: dep._id,
        notes: null, createdAt: now, updatedAt: now,
      })

      const ps = parseDate(dep.effectiveFrom || '29/03/2026')
      const pe = parseDate(dep.effectiveUntil || '24/10/2026')
      if (ps && pe && !isNaN(ps.getTime()) && !isNaN(pe.getTime())) {
        const dateStrings = expandDates(id, ps, pe, dep.daysOfWeek || '1234567', 1)
        for (const ds of dateStrings) {
          const d = new Date(ds)
          let op = 'scheduled'
          if (d < today) {
            const roll = Math.random()
            if (['confirmed', 'historic'].includes(status)) op = roll < 0.88 ? 'operated' : roll < 0.94 ? 'cancelled' : roll < 0.97 ? 'jnus' : 'no_show'
            else op = roll < 0.6 ? 'operated' : 'cancelled'
          }
          dateDocs.push({ _id: crypto.randomUUID(), seriesId: id, slotDate: ds, operationStatus: op, jnusReason: op === 'jnus' ? 'Weather' : null, jnusEvidence: null, actualArrivalTime: null, actualDepartureTime: null, createdAt: now })
        }
      }

      actionDocs.push({ _id: crypto.randomUUID(), seriesId: id, actionCode: ACTIONS[ri(0, 5)], actionSource: 'airline', messageId: null, details: null, createdAt: new Date(Date.now() - ri(30, 120) * 86400000).toISOString() })
      if (COORD[status]) actionDocs.push({ _id: crypto.randomUUID(), seriesId: id, actionCode: COORD[status], actionSource: 'coordinator', messageId: null, details: null, createdAt: new Date(Date.now() - ri(5, 29) * 86400000).toISOString() })
    }

    // Insert
    if (seriesDocs.length > 0) {
      await db.collection('slotSeries').insertMany(seriesDocs)
      totalSeries += seriesDocs.length
    }
    if (dateDocs.length > 0) {
      await db.collection('slotDates').insertMany(dateDocs)
      totalDates += dateDocs.length
    }
    if (actionDocs.length > 0) {
      await db.collection('slotActionLog').insertMany(actionDocs)
      totalActions += actionDocs.length
    }

    airportsProcessed.push(`${iata}: ${seriesDocs.length} series`)
  }

  console.log(`\nProcessed ${airportsProcessed.length} airports:`)
  airportsProcessed.forEach(a => console.log(`  ${a}`))

  console.log(`\nTotals:`)
  console.log(`  ${totalSeries} series`)
  console.log(`  ${totalDates} dates`)
  console.log(`  ${totalActions} action log entries`)

  // Verify AC types
  const acTypes = await db.collection('slotSeries').distinct('aircraftTypeIcao')
  console.log(`\nAC types in slot series: ${acTypes.sort().join(', ')}`)

  // Status distribution
  const dist = {}
  const all = await db.collection('slotSeries').find({}).project({ status: 1 }).toArray()
  all.forEach(s => { dist[s.status] = (dist[s.status] || 0) + 1 })
  console.log(`Status distribution:`)
  Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`))

  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
