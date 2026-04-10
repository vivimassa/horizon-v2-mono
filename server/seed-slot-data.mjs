/**
 * Seed realistic slot data for testing Module 1.1.3.
 * Updates existing slot series with varied statuses, allocated times,
 * expands dates with mixed operation statuses, and creates action logs.
 *
 * Run: cd server && node seed-slot-data.mjs
 */
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import 'dotenv/config'

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/horizon'

// ── Status distribution — realistic airline portfolio ──
const STATUS_WEIGHTS = [
  { status: 'confirmed', weight: 45 },
  { status: 'offered', weight: 15 },
  { status: 'waitlisted', weight: 8 },
  { status: 'refused', weight: 5 },
  { status: 'submitted', weight: 12 },
  { status: 'draft', weight: 10 },
  { status: 'historic', weight: 5 },
]

const PRIORITY_WEIGHTS = [
  { priority: 'historic', weight: 35 },
  { priority: 'changed_historic', weight: 15 },
  { priority: 'new_entrant', weight: 10 },
  { priority: 'new', weight: 35 },
  { priority: 'adhoc', weight: 5 },
]

const AIRLINE_ACTIONS = ['N', 'Y', 'B', 'F', 'C', 'R']
const COORD_ACTIONS = ['K', 'O', 'U', 'H', 'T']

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function expandDates(seriesId, periodStart, periodEnd, daysOfOp, frequency) {
  const dates = []
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return dates

  const current = new Date(start)
  let weekCount = 0
  let lastWeek = -1

  while (current <= end) {
    const jsDay = current.getDay()
    const iataDay = jsDay === 0 ? 7 : jsDay
    const isoWeek = getISOWeek(current)
    if (isoWeek !== lastWeek) { weekCount++; lastWeek = isoWeek }

    const dayActive = daysOfOp.includes(String(iataDay))
    const weekActive = frequency === 1 || weekCount % 2 === 1

    if (dayActive && weekActive) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// Parse DD/MM/YYYY or ISO
function parseDate(str) {
  if (!str) return null
  if (str.includes('/')) {
    const [d, m, y] = str.split('/')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  return new Date(str)
}

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  const db = mongoose.connection.db
  const seriesCol = db.collection('slotSeries')
  const datesCol = db.collection('slotDates')
  const actionCol = db.collection('slotActionLog')
  const messagesCol = db.collection('slotMessages')

  // Get all existing series
  const allSeries = await seriesCol.find({}).toArray()
  console.log(`Found ${allSeries.length} slot series to enrich`)

  if (allSeries.length === 0) {
    console.log('No series found. Run "Import from Schedule" in the UI first.')
    await mongoose.disconnect()
    return
  }

  const operatorId = allSeries[0].operatorId
  const now = new Date().toISOString()
  let seriesUpdated = 0
  let datesCreated = 0
  let actionsCreated = 0

  // Delete existing dates and action logs to start fresh
  await datesCol.deleteMany({})
  await actionCol.deleteMany({})
  await messagesCol.deleteMany({ operatorId })
  console.log('Cleared existing dates, actions, and messages')

  for (const series of allSeries) {
    // 1. Assign a realistic status
    const { status } = weightedRandom(STATUS_WEIGHTS)
    const { priority } = weightedRandom(PRIORITY_WEIGHTS)

    // 2. Compute allocated times (±15 min from requested, or same)
    const offset = randomInt(-15, 15) * (Math.random() > 0.6 ? 1 : 0) // 40% get exact time
    const allocArr = series.requestedArrivalTime != null
      ? Math.max(0, series.requestedArrivalTime + offset)
      : null
    const allocDep = series.requestedDepartureTime != null
      ? Math.max(0, series.requestedDepartureTime + offset)
      : null

    // 3. Set coordinator codes based on status
    let lastCoordCode = null
    if (status === 'confirmed') lastCoordCode = 'K'
    else if (status === 'offered') lastCoordCode = 'O'
    else if (status === 'refused') lastCoordCode = 'U'
    else if (status === 'historic') lastCoordCode = 'H'

    // 4. Determine action code
    const lastActionCode = status === 'draft' ? null
      : AIRLINE_ACTIONS[randomInt(0, AIRLINE_ACTIONS.length - 1)]

    // 5. Seats based on aircraft type
    const seatMap = { A320: 180, A321: 230, A330: 300, A333: 300, '320': 180, '321': 230, '788': 296 }
    const seats = seatMap[series.aircraftTypeIcao] || randomInt(150, 280)

    // Update series
    await seriesCol.updateOne({ _id: series._id }, {
      $set: {
        status,
        priorityCategory: priority,
        historicEligible: priority === 'historic' || priority === 'changed_historic',
        allocatedArrivalTime: ['confirmed', 'offered', 'historic'].includes(status) ? allocArr : null,
        allocatedDepartureTime: ['confirmed', 'offered', 'historic'].includes(status) ? allocDep : null,
        lastActionCode,
        lastCoordinatorCode: lastCoordCode,
        seats,
        waitlistPosition: status === 'waitlisted' ? randomInt(1, 20) : null,
        coordinatorRef: ['confirmed', 'offered', 'refused'].includes(status) ? `REYT${randomInt(100000, 999999)}` : null,
        updatedAt: now,
      },
    })
    seriesUpdated++

    // 6. Expand and create dates with varied statuses
    const periodStart = parseDate(series.periodStart)
    const periodEnd = parseDate(series.periodEnd)
    if (!periodStart || !periodEnd) continue

    const dateStrings = expandDates(
      series._id,
      periodStart, periodEnd,
      series.daysOfOperation || '1234567',
      series.frequencyRate || 1,
    )

    const today = new Date()
    const dateDocs = dateStrings.map(dateStr => {
      const d = new Date(dateStr)
      let opStatus = 'scheduled'

      if (d < today) {
        // Past dates: mostly operated, some cancelled/jnus
        const roll = Math.random()
        if (status === 'confirmed' || status === 'historic') {
          opStatus = roll < 0.88 ? 'operated' : roll < 0.93 ? 'cancelled' : roll < 0.97 ? 'jnus' : 'no_show'
        } else if (status === 'offered') {
          opStatus = roll < 0.75 ? 'operated' : roll < 0.85 ? 'cancelled' : roll < 0.92 ? 'jnus' : 'no_show'
        } else if (status === 'refused' || status === 'waitlisted') {
          opStatus = roll < 0.3 ? 'operated' : roll < 0.7 ? 'cancelled' : 'no_show'
        } else {
          opStatus = roll < 0.6 ? 'operated' : roll < 0.8 ? 'cancelled' : 'scheduled'
        }
      }

      return {
        _id: crypto.randomUUID(),
        seriesId: series._id,
        slotDate: dateStr,
        operationStatus: opStatus,
        jnusReason: opStatus === 'jnus'
          ? ['Weather', 'ATC disruption', 'Airport/airspace closure', 'Industrial action'][randomInt(0, 3)]
          : null,
        jnusEvidence: null,
        actualArrivalTime: opStatus === 'operated' && allocArr ? allocArr + randomInt(-5, 10) : null,
        actualDepartureTime: opStatus === 'operated' && allocDep ? allocDep + randomInt(-5, 15) : null,
        createdAt: now,
      }
    })

    if (dateDocs.length > 0) {
      await datesCol.insertMany(dateDocs)
      datesCreated += dateDocs.length
    }

    // 7. Create action log entries (1-4 per series)
    const numActions = randomInt(1, 4)
    const actionDocs = []

    // First action: airline submission
    if (lastActionCode) {
      actionDocs.push({
        _id: crypto.randomUUID(),
        seriesId: series._id,
        actionCode: lastActionCode,
        actionSource: 'airline',
        messageId: null,
        details: null,
        createdAt: new Date(Date.now() - randomInt(30, 120) * 86400000).toISOString(),
      })
    }

    // Coordinator response
    if (lastCoordCode) {
      actionDocs.push({
        _id: crypto.randomUUID(),
        seriesId: series._id,
        actionCode: lastCoordCode,
        actionSource: 'coordinator',
        messageId: null,
        details: null,
        createdAt: new Date(Date.now() - randomInt(5, 29) * 86400000).toISOString(),
      })
    }

    if (actionDocs.length > 0) {
      await actionCol.insertMany(actionDocs)
      actionsCreated += actionDocs.length
    }
  }

  // 8. Create sample messages for a few airports
  const airportGroups = {}
  for (const s of allSeries) {
    if (!airportGroups[s.airportIata]) airportGroups[s.airportIata] = []
    airportGroups[s.airportIata].push(s)
  }

  let messagesCreated = 0
  const airports = Object.keys(airportGroups).slice(0, 10) // top 10 airports

  for (const iata of airports) {
    const seasonCode = allSeries[0].seasonCode || 'S26'

    // Inbound SAL (coordinator response)
    await messagesCol.insertOne({
      _id: crypto.randomUUID(),
      operatorId,
      direction: 'inbound',
      messageType: 'SAL',
      airportIata: iata,
      seasonCode,
      rawText: `SAL\n/${iata}-COORD\n${seasonCode}\n${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase().replace(' ', '')}\n${iata}\n` +
        airportGroups[iata].slice(0, 5).map(s =>
          `K${s.arrivalFlightNumber || ''} ${s.departureFlightNumber || ''} 29MAR24OCT 1234567 ${s.seats || 180}${s.aircraftTypeIcao || '320'} ${iata}${String(s.allocatedArrivalTime || s.requestedArrivalTime || 600).padStart(4, '0')} ${String(s.allocatedDepartureTime || s.requestedDepartureTime || 730).padStart(4, '0')}${s.departureDestIata || iata} JJ`
        ).join('\n'),
      parseStatus: 'parsed',
      parseErrors: null,
      parsedSeriesCount: Math.min(5, airportGroups[iata].length),
      source: `coordinator@${iata.toLowerCase()}-airport.aero`,
      reference: `REYT${randomInt(100000, 999999)}`,
      createdAt: new Date(Date.now() - randomInt(5, 60) * 86400000).toISOString(),
    })

    // Outbound SCR (our request)
    await messagesCol.insertOne({
      _id: crypto.randomUUID(),
      operatorId,
      direction: 'outbound',
      messageType: 'SCR',
      airportIata: iata,
      seasonCode,
      rawText: `SCR\n/VJ-SCHEDULE\n${seasonCode}\n${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase().replace(' ', '')}\n${iata}\n` +
        airportGroups[iata].slice(0, 5).map(s =>
          `N${s.arrivalFlightNumber || ''} ${s.departureFlightNumber || ''} 29MAR24OCT 1234567 ${s.seats || 180}${s.aircraftTypeIcao || '320'} ${s.arrivalOriginIata || 'SGN'}${String(s.requestedArrivalTime || 600).padStart(4, '0')} ${String(s.requestedDepartureTime || 730).padStart(4, '0')}${s.departureDestIata || 'SGN'} JJ`
        ).join('\n'),
      parseStatus: 'parsed',
      parseErrors: null,
      parsedSeriesCount: Math.min(5, airportGroups[iata].length),
      source: 'schedule@vietjetair.com',
      reference: null,
      createdAt: new Date(Date.now() - randomInt(60, 120) * 86400000).toISOString(),
    })

    messagesCreated += 2
  }

  console.log(`\nDone:`)
  console.log(`  ${seriesUpdated} series updated with statuses & allocated times`)
  console.log(`  ${datesCreated} slot dates created with operation statuses`)
  console.log(`  ${actionsCreated} action log entries created`)
  console.log(`  ${messagesCreated} sample messages created`)

  // Print status distribution
  const statusCounts = {}
  for (const s of await seriesCol.find({}).toArray()) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1
  }
  console.log(`\nStatus distribution:`)
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count}`)
  }

  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
