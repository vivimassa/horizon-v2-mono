/**
 * Seed slot series for ALL coordinated airports in the database.
 * - Airports with scheduled flights: creates series from actual flight data
 * - Airports without flights: generates synthetic series
 * Then enriches all series with statuses, dates, and action logs.
 *
 * Run: cd server && node seed-slot-all-airports.mjs
 */
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import 'dotenv/config'

const MONGO_URI = process.env.MONGODB_URI
const SEASON = 'S26'
const PERIOD_START = '2026-03-29'
const PERIOD_END = '2026-10-24'

const STATUS_WEIGHTS = [
  { status: 'confirmed', weight: 45 },
  { status: 'offered', weight: 15 },
  { status: 'waitlisted', weight: 8 },
  { status: 'refused', weight: 5 },
  { status: 'submitted', weight: 12 },
  { status: 'draft', weight: 5 },
  { status: 'historic', weight: 10 },
]

const PRIORITY_WEIGHTS = [
  { priority: 'historic', weight: 35 },
  { priority: 'changed_historic', weight: 15 },
  { priority: 'new_entrant', weight: 10 },
  { priority: 'new', weight: 35 },
  { priority: 'adhoc', weight: 5 },
]

const COORD_CODES = { confirmed: 'K', offered: 'O', refused: 'U', historic: 'H' }
const AIRLINE_ACTIONS = ['N', 'Y', 'B', 'F', 'C', 'R']

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) { r -= item.weight; if (r <= 0) return item }
  return items[items.length - 1]
}
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function getISOWeek(date) {
  const d = new Date(date); d.setHours(0,0,0,0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const ys = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7)
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

function parseDate(str) {
  if (!str) return null
  if (str.includes('/')) { const [d,m,y] = str.split('/'); return new Date(parseInt(y), parseInt(m)-1, parseInt(d)) }
  return new Date(str)
}

// Synthetic flight pairs for airports without real flights
const SYNTH_ROUTES = {
  LHR: [{ arr: 'SGN', dep: 'SGN', times: [600, 800] }, { arr: 'HAN', dep: 'HAN', times: [1400, 1600] }],
  AMS: [{ arr: 'SGN', dep: 'SGN', times: [700, 900] }],
  JFK: [{ arr: 'SGN', dep: 'SGN', times: [100, 500] }],
  LAX: [{ arr: 'SGN', dep: 'SGN', times: [200, 600] }],
  SFO: [{ arr: 'SGN', dep: 'SGN', times: [300, 700] }],
}

function generateSyntheticSeries(iata, operatorId, airlineCode) {
  const routes = SYNTH_ROUTES[iata] || [
    { arr: 'SGN', dep: 'SGN', times: [randomInt(1,20)*100 + randomInt(0,5)*10, 0] },
  ]
  const series = []
  const baseNum = randomInt(100, 900)

  const numPairs = randomInt(2, 8)
  for (let i = 0; i < numPairs; i++) {
    const route = routes[i % routes.length]
    const arrNum = baseNum + i * 2
    const depNum = arrNum + 1
    const arrTime = route.times[0] || randomInt(1,23) * 100 + randomInt(0,5) * 10
    const depTime = route.times[1] || arrTime + randomInt(100, 300)
    const dow = Math.random() > 0.3 ? '1234567' : ['1234500', '0034567', '1030507', '1234567'][randomInt(0,3)]

    series.push({
      _id: crypto.randomUUID(),
      operatorId,
      airportIata: iata,
      seasonCode: SEASON,
      arrivalFlightNumber: `${airlineCode}${arrNum}`,
      departureFlightNumber: `${airlineCode}${depNum}`,
      arrivalOriginIata: route.arr,
      departureDestIata: route.dep,
      requestedArrivalTime: arrTime,
      requestedDepartureTime: depTime,
      allocatedArrivalTime: null,
      allocatedDepartureTime: null,
      overnightIndicator: depTime < arrTime ? 1 : 0,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      daysOfOperation: dow,
      frequencyRate: 1,
      seats: [180, 230, 300][randomInt(0,2)],
      aircraftTypeIcao: ['A320', 'A321', 'A330'][randomInt(0,2)],
      arrivalServiceType: 'J',
      departureServiceType: 'J',
      status: 'draft',
      priorityCategory: 'new',
      historicEligible: false,
      lastActionCode: null,
      lastCoordinatorCode: null,
      flexibilityArrival: null,
      flexibilityDeparture: null,
      minTurnaroundMinutes: null,
      coordinatorRef: null,
      coordinatorReasonArrival: null,
      coordinatorReasonDeparture: null,
      waitlistPosition: null,
      linkedScheduledFlightId: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  return series
}

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')
  const db = mongoose.connection.db
  const seriesCol = db.collection('slotSeries')
  const datesCol = db.collection('slotDates')
  const actionCol = db.collection('slotActionLog')
  const airportCol = db.collection('airports')
  const sfCol = db.collection('scheduledFlights')

  const ops = await db.collection('operators').find({}).toArray()
  const operatorId = ops[0]?._id
  const airlineCode = ops[0]?.iataCode || ops[0]?.icaoCode || 'SH'
  console.log('Operator:', operatorId, 'Airline:', airlineCode)

  // Get existing series airports
  const existingAirports = new Set(await seriesCol.distinct('airportIata'))
  console.log('Already seeded:', [...existingAirports].join(', '))

  // Get all slot-controlled airports
  const slotAirports = await airportCol.find({ isSlotControlled: true }).project({ iataCode: 1 }).toArray()
  const missing = slotAirports.map(a => a.iataCode).filter(i => i && !existingAirports.has(i))
  console.log(`Missing airports to seed: ${missing.length}`)

  // Get scheduled flights
  const flights = await sfCol.find({ operatorId, status: { $in: ['draft', 'active'] } }).toArray()
  const flightsByArr = new Map()
  const flightsByDep = new Map()
  for (const f of flights) {
    if (f.arrStation) { if (!flightsByArr.has(f.arrStation)) flightsByArr.set(f.arrStation, []); flightsByArr.get(f.arrStation).push(f) }
    if (f.depStation) { if (!flightsByDep.has(f.depStation)) flightsByDep.set(f.depStation, []); flightsByDep.get(f.depStation).push(f) }
  }

  let totalCreated = 0
  const now = new Date().toISOString()

  for (const iata of missing) {
    const arrivals = flightsByArr.get(iata) || []
    const departures = flightsByDep.get(iata) || []
    let newSeries = []

    if (arrivals.length > 0 || departures.length > 0) {
      // Create from real flights
      const depMap = new Map()
      for (const d of departures) depMap.set(d.flightNumber, d)

      for (const arr of arrivals) {
        const fNum = parseInt(arr.flightNumber, 10)
        const dep = !isNaN(fNum) ? (depMap.get(String(fNum + 1)) || depMap.get(String(fNum - 1))) : null
        const arrTime = arr.staUtc ? parseInt(arr.staUtc.replace(':', ''), 10) : null
        const depTime = dep?.stdUtc ? parseInt(dep.stdUtc.replace(':', ''), 10) : null

        newSeries.push({
          _id: crypto.randomUUID(), operatorId, airportIata: iata, seasonCode: SEASON,
          arrivalFlightNumber: `${arr.airlineCode}${arr.flightNumber}`,
          departureFlightNumber: dep ? `${dep.airlineCode}${dep.flightNumber}` : null,
          arrivalOriginIata: arr.depStation, departureDestIata: dep?.arrStation || null,
          requestedArrivalTime: arrTime, requestedDepartureTime: depTime,
          allocatedArrivalTime: null, allocatedDepartureTime: null,
          overnightIndicator: 0,
          periodStart: arr.effectiveFrom || PERIOD_START, periodEnd: arr.effectiveUntil || PERIOD_END,
          daysOfOperation: arr.daysOfWeek || '1234567', frequencyRate: 1,
          seats: null, aircraftTypeIcao: arr.aircraftTypeIcao,
          arrivalServiceType: 'J', departureServiceType: 'J',
          status: 'draft', priorityCategory: 'new', historicEligible: false,
          lastActionCode: null, lastCoordinatorCode: null,
          flexibilityArrival: null, flexibilityDeparture: null, minTurnaroundMinutes: null,
          coordinatorRef: null, coordinatorReasonArrival: null, coordinatorReasonDeparture: null,
          waitlistPosition: null, linkedScheduledFlightId: arr._id,
          notes: null, createdAt: now, updatedAt: now,
        })
        if (dep) depMap.delete(dep.flightNumber)
      }

      // Unpaired departures
      for (const [, dep] of depMap) {
        const depTime = dep.stdUtc ? parseInt(dep.stdUtc.replace(':', ''), 10) : null
        newSeries.push({
          _id: crypto.randomUUID(), operatorId, airportIata: iata, seasonCode: SEASON,
          departureFlightNumber: `${dep.airlineCode}${dep.flightNumber}`,
          arrivalOriginIata: null, departureDestIata: dep.arrStation,
          requestedDepartureTime: depTime,
          overnightIndicator: 0,
          periodStart: dep.effectiveFrom || PERIOD_START, periodEnd: dep.effectiveUntil || PERIOD_END,
          daysOfOperation: dep.daysOfWeek || '1234567', frequencyRate: 1,
          aircraftTypeIcao: dep.aircraftTypeIcao,
          arrivalServiceType: 'J', departureServiceType: 'J',
          status: 'draft', priorityCategory: 'new', historicEligible: false,
          linkedScheduledFlightId: dep._id,
          createdAt: now, updatedAt: now,
        })
      }
      console.log(`  ${iata}: ${newSeries.length} series from scheduled flights`)
    } else {
      // Generate synthetic
      newSeries = generateSyntheticSeries(iata, operatorId, airlineCode)
      console.log(`  ${iata}: ${newSeries.length} synthetic series`)
    }

    if (newSeries.length > 0) {
      await seriesCol.insertMany(newSeries)
      totalCreated += newSeries.length
    }
  }

  console.log(`\nCreated ${totalCreated} new series across ${missing.length} airports`)

  // Now enrich ALL series (including newly created) with statuses, dates, action logs
  console.log('\nEnriching all series with statuses, dates, and action logs...')
  const allSeries = await seriesCol.find({ status: 'draft' }).toArray()
  console.log(`${allSeries.length} draft series to enrich`)

  let enriched = 0, datesTotal = 0, actionsTotal = 0
  const today = new Date()

  for (const series of allSeries) {
    const { status } = weightedRandom(STATUS_WEIGHTS)
    const { priority } = weightedRandom(PRIORITY_WEIGHTS)
    const offset = randomInt(-15, 15) * (Math.random() > 0.6 ? 1 : 0)
    const allocArr = series.requestedArrivalTime != null ? Math.max(0, series.requestedArrivalTime + offset) : null
    const allocDep = series.requestedDepartureTime != null ? Math.max(0, series.requestedDepartureTime + offset) : null
    const seatMap = { A320: 180, A321: 230, A330: 300, A333: 300 }

    await seriesCol.updateOne({ _id: series._id }, { $set: {
      status, priorityCategory: priority,
      historicEligible: ['historic', 'changed_historic'].includes(priority),
      allocatedArrivalTime: ['confirmed', 'offered', 'historic'].includes(status) ? allocArr : null,
      allocatedDepartureTime: ['confirmed', 'offered', 'historic'].includes(status) ? allocDep : null,
      lastActionCode: AIRLINE_ACTIONS[randomInt(0, AIRLINE_ACTIONS.length - 1)],
      lastCoordinatorCode: COORD_CODES[status] || null,
      seats: seatMap[series.aircraftTypeIcao] || series.seats || randomInt(150, 280),
      waitlistPosition: status === 'waitlisted' ? randomInt(1, 20) : null,
      coordinatorRef: ['confirmed', 'offered', 'refused'].includes(status) ? `REYT${randomInt(100000, 999999)}` : null,
      updatedAt: now,
    }})
    enriched++

    // Expand dates
    const ps = parseDate(series.periodStart)
    const pe = parseDate(series.periodEnd)
    if (!ps || !pe || isNaN(ps.getTime()) || isNaN(pe.getTime())) continue

    const dateStrings = expandDates(series._id, ps, pe, series.daysOfOperation || '1234567', series.frequencyRate || 1)
    const dateDocs = dateStrings.map(ds => {
      const d = new Date(ds)
      let op = 'scheduled'
      if (d < today) {
        const roll = Math.random()
        if (['confirmed', 'historic'].includes(status)) op = roll < 0.88 ? 'operated' : roll < 0.94 ? 'cancelled' : roll < 0.97 ? 'jnus' : 'no_show'
        else if (status === 'offered') op = roll < 0.75 ? 'operated' : roll < 0.88 ? 'cancelled' : roll < 0.94 ? 'jnus' : 'no_show'
        else if (['refused', 'waitlisted'].includes(status)) op = roll < 0.3 ? 'operated' : roll < 0.7 ? 'cancelled' : 'no_show'
        else op = roll < 0.6 ? 'operated' : roll < 0.8 ? 'cancelled' : 'scheduled'
      }
      return {
        _id: crypto.randomUUID(), seriesId: series._id, slotDate: ds, operationStatus: op,
        jnusReason: op === 'jnus' ? ['Weather', 'ATC disruption', 'Airport/airspace closure'][randomInt(0,2)] : null,
        jnusEvidence: null, actualArrivalTime: null, actualDepartureTime: null, createdAt: now,
      }
    })
    if (dateDocs.length > 0) { await datesCol.insertMany(dateDocs); datesTotal += dateDocs.length }

    // Action logs
    const actions = []
    actions.push({ _id: crypto.randomUUID(), seriesId: series._id, actionCode: AIRLINE_ACTIONS[randomInt(0,5)], actionSource: 'airline', messageId: null, details: null, createdAt: new Date(Date.now() - randomInt(30,120)*86400000).toISOString() })
    if (COORD_CODES[status]) {
      actions.push({ _id: crypto.randomUUID(), seriesId: series._id, actionCode: COORD_CODES[status], actionSource: 'coordinator', messageId: null, details: null, createdAt: new Date(Date.now() - randomInt(5,29)*86400000).toISOString() })
    }
    await actionCol.insertMany(actions)
    actionsTotal += actions.length
  }

  console.log(`\nDone:`)
  console.log(`  ${totalCreated} new series created`)
  console.log(`  ${enriched} series enriched with statuses`)
  console.log(`  ${datesTotal} slot dates created`)
  console.log(`  ${actionsTotal} action log entries`)

  // Final distribution
  const dist = {}
  const all = await seriesCol.find({}).project({ status: 1 }).toArray()
  all.forEach(s => { dist[s.status] = (dist[s.status] || 0) + 1 })
  console.log(`\nFinal status distribution (${all.length} total):`)
  Object.entries(dist).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`))

  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
