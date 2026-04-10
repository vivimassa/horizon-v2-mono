/**
 * Seed slot coordination data for all coordinated airports.
 * Run: node server/seed-slot-airports.mjs
 */
import mongoose from 'mongoose'
import 'dotenv/config'

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/horizon'

const updates = [
  // Level 3 — Fully Coordinated
  { iata: 'LHR', level: 3, day: 88, night: 42, coord: 'Airport Coordination Limited', email: 'slots@acl-uk.org' },
  { iata: 'FRA', level: 3, day: 104, night: 52, coord: 'FLUKO', email: 'slots@fluko.org' },
  { iata: 'AMS', level: 3, day: 106, night: 32, coord: 'Airport Coordination Netherlands', email: 'slots@slotcoordination.nl' },
  { iata: 'FCO', level: 3, day: 90, night: 30, coord: 'Assoclearance', email: 'slots@assoclearance.it' },
  { iata: 'IST', level: 3, day: 120, night: 60, coord: 'SHGM', email: 'slots@shgm.gov.tr' },
  { iata: 'JFK', level: 3, day: 81, night: 60, coord: 'FAA Slot Administration', email: 'slots@faa.gov' },
  { iata: 'LAX', level: 3, day: 100, night: 70, coord: 'IATA Slot Coordination', email: 'slots@iata.org' },
  { iata: 'SFO', level: 3, day: 60, night: 40, coord: 'IATA Slot Coordination', email: 'slots@iata.org' },
  { iata: 'DXB', level: 3, day: 100, night: 50, coord: 'Dubai Airports', email: 'slotcoordination@dubaiairports.ae' },
  { iata: 'DOH', level: 3, day: 70, night: 40, coord: 'Qatar CAA', email: 'slots@caa.gov.qa' },
  { iata: 'NRT', level: 3, day: 68, night: 22, coord: 'JSC', email: 'slots@jsc-schedule.jp' },
  { iata: 'HND', level: 3, day: 80, night: 40, coord: 'JSC', email: 'slots@jsc-schedule.jp' },
  { iata: 'ICN', level: 3, day: 90, night: 45, coord: 'KACA', email: 'slots@kaca.or.kr' },
  { iata: 'SIN', level: 3, day: 82, night: 41, coord: 'CAAS', email: 'slots@caas.gov.sg' },
  { iata: 'HKG', level: 3, day: 68, night: 34, coord: 'HKIA', email: 'slotcoordination@hkairport.com' },
  { iata: 'BKK', level: 3, day: 76, night: 38, coord: 'CAAT Thailand', email: 'slots@caat.or.th' },
  { iata: 'TPE', level: 3, day: 60, night: 30, coord: 'CAA Taiwan', email: 'slots@caa.gov.tw' },
  { iata: 'PVG', level: 3, day: 86, night: 43, coord: 'CAAC Shanghai', email: 'slots@caac.gov.cn' },
  { iata: 'PEK', level: 3, day: 88, night: 44, coord: 'CAAC Beijing', email: 'slots@caac.gov.cn' },
  { iata: 'PKX', level: 3, day: 100, night: 50, coord: 'CAAC Beijing', email: 'slots@caac.gov.cn' },
  { iata: 'CAN', level: 3, day: 72, night: 36, coord: 'CAAC Guangzhou', email: 'slots@caac.gov.cn' },
  { iata: 'SZX', level: 3, day: 60, night: 30, coord: 'CAAC Shenzhen', email: 'slots@caac.gov.cn' },
  { iata: 'SGN', level: 3, day: 44, night: 22, coord: 'CAAV Vietnam', email: 'slots@caa.gov.vn' },
  { iata: 'HAN', level: 3, day: 36, night: 18, coord: 'CAAV Vietnam', email: 'slots@caa.gov.vn' },
  { iata: 'DAD', level: 3, day: 30, night: 15, coord: 'CAAV Vietnam', email: 'slots@caa.gov.vn' },
  { iata: 'SYD', level: 3, day: 80, night: 40, coord: 'ASA', email: 'slots@airservicesaustralia.com' },
  { iata: 'MEL', level: 3, day: 65, night: 32, coord: 'ASA', email: 'slots@airservicesaustralia.com' },
  { iata: 'CGK', level: 3, day: 60, night: 30, coord: 'AirNav Indonesia', email: 'slots@airnav.co.id' },
  { iata: 'KUL', level: 3, day: 70, night: 35, coord: 'MAHB', email: 'slots@malaysiaairports.com.my' },
  { iata: 'MNL', level: 3, day: 40, night: 20, coord: 'CAAP Philippines', email: 'slots@caap.gov.ph' },
  { iata: 'DEL', level: 3, day: 70, night: 35, coord: 'AAI', email: 'slots@aai.aero' },
  { iata: 'BOM', level: 3, day: 46, night: 23, coord: 'AAI', email: 'slots@aai.aero' },
  { iata: 'KIX', level: 3, day: 50, night: 25, coord: 'JSC', email: 'slots@jsc-schedule.jp' },
  { iata: 'PUS', level: 3, day: 40, night: 20, coord: 'KACA', email: 'slots@kaca.or.kr' },
  { iata: 'FUK', level: 3, day: 35, night: 17, coord: 'JSC', email: 'slots@jsc-schedule.jp' },
  { iata: 'NGO', level: 3, day: 40, night: 20, coord: 'JSC', email: 'slots@jsc-schedule.jp' },
  { iata: 'XIY', level: 3, day: 50, night: 25, coord: 'CAAC Xian', email: 'slots@caac.gov.cn' },
  { iata: 'TFU', level: 3, day: 55, night: 27, coord: 'CAAC Chengdu', email: 'slots@caac.gov.cn' },

  // Level 2 — Schedules Facilitated
  { iata: 'ATH', level: 2, day: 45, night: 22, coord: 'HCAA', email: 'slots@hcaa.gr' },
  { iata: 'PRG', level: 2, day: 46, night: 23, coord: 'Czech ANS', email: 'slots@ans.cz' },
  { iata: 'WAW', level: 2, day: 44, night: 22, coord: 'PANSA', email: 'slots@pansa.pl' },
  { iata: 'KHH', level: 2, day: 25, night: 12, coord: 'CAA Taiwan', email: 'slots@caa.gov.tw' },
  { iata: 'AKL', level: 2, day: 35, night: 17, coord: 'Airways NZ', email: 'slots@airways.co.nz' },
  { iata: 'DMK', level: 2, day: 40, night: 20, coord: 'CAAT Thailand', email: 'slots@caat.or.th' },
  { iata: 'CNX', level: 2, day: 20, night: 10, coord: 'CAAT Thailand', email: 'slots@caat.or.th' },
  { iata: 'HKT', level: 2, day: 25, night: 12, coord: 'CAAT Thailand', email: 'slots@caat.or.th' },
  { iata: 'DPS', level: 2, day: 30, night: 15, coord: 'AirNav Indonesia', email: 'slots@airnav.co.id' },
  { iata: 'SUB', level: 2, day: 25, night: 12, coord: 'AirNav Indonesia', email: 'slots@airnav.co.id' },
  { iata: 'CEB', level: 2, day: 20, night: 10, coord: 'CAAP Philippines', email: 'slots@caap.gov.ph' },
  { iata: 'PEN', level: 2, day: 25, night: 12, coord: 'MAHB', email: 'slots@malaysiaairports.com.my' },
  { iata: 'BKI', level: 2, day: 20, night: 10, coord: 'MAHB', email: 'slots@malaysiaairports.com.my' },
  { iata: 'BNE', level: 2, day: 40, night: 20, coord: 'ASA', email: 'slots@airservicesaustralia.com' },
  { iata: 'PER', level: 2, day: 35, night: 17, coord: 'ASA', email: 'slots@airservicesaustralia.com' },
  { iata: 'CXR', level: 2, day: 20, night: 10, coord: 'CAAV Vietnam', email: 'slots@caa.gov.vn' },
  { iata: 'PQC', level: 2, day: 15, night: 8, coord: 'CAAV Vietnam', email: 'slots@caa.gov.vn' },
  { iata: 'HPH', level: 2, day: 12, night: 6, coord: 'CAAV Vietnam', email: 'slots@caa.gov.vn' },
  { iata: 'CTS', level: 2, day: 30, night: 15, coord: 'JSC', email: 'slots@jsc-schedule.jp' },
  { iata: 'HIJ', level: 2, day: 20, night: 10, coord: 'JSC', email: 'slots@jsc-schedule.jp' },
  { iata: 'RMQ', level: 2, day: 20, night: 10, coord: 'CAA Taiwan', email: 'slots@caa.gov.tw' },
  { iata: 'TNN', level: 2, day: 15, night: 8, coord: 'CAA Taiwan', email: 'slots@caa.gov.tw' },
  { iata: 'TAE', level: 2, day: 25, night: 12, coord: 'KACA', email: 'slots@kaca.or.kr' },
  { iata: 'MFM', level: 2, day: 20, night: 10, coord: 'AACM Macau', email: 'slots@aacm.gov.mo' },
  { iata: 'BLR', level: 2, day: 40, night: 20, coord: 'AAI', email: 'slots@aai.aero' },
  { iata: 'HYD', level: 2, day: 36, night: 18, coord: 'AAI', email: 'slots@aai.aero' },
  { iata: 'CCU', level: 2, day: 30, night: 15, coord: 'AAI', email: 'slots@aai.aero' },
  { iata: 'COK', level: 2, day: 22, night: 11, coord: 'AAI', email: 'slots@aai.aero' },
  { iata: 'AMD', level: 2, day: 28, night: 14, coord: 'AAI', email: 'slots@aai.aero' },
  { iata: 'BWN', level: 2, day: 15, night: 8, coord: 'DCA Brunei', email: 'slots@dca.gov.bn' },
  { iata: 'RGN', level: 2, day: 18, night: 9, coord: 'DCA Myanmar', email: 'slots@dca.gov.mm' },
  { iata: 'REP', level: 2, day: 15, night: 8, coord: 'SSCA Cambodia', email: 'slots@ssca.gov.kh' },
  { iata: 'PNH', level: 2, day: 18, night: 9, coord: 'SSCA Cambodia', email: 'slots@ssca.gov.kh' },
  { iata: 'VTE', level: 2, day: 10, night: 5, coord: 'DCA Laos', email: 'slots@dca.gov.la' },
  { iata: 'LPQ', level: 2, day: 8, night: 4, coord: 'DCA Laos', email: 'slots@dca.gov.la' },
  { iata: 'CRK', level: 2, day: 18, night: 9, coord: 'CAAP Philippines', email: 'slots@caap.gov.ph' },
  { iata: 'USM', level: 2, day: 12, night: 6, coord: 'CAAT Thailand', email: 'slots@caat.or.th' },
  { iata: 'KBV', level: 2, day: 12, night: 6, coord: 'CAAT Thailand', email: 'slots@caat.or.th' },
]

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  const db = mongoose.connection.db
  const col = db.collection('airports')

  let updated = 0
  let notFound = 0

  for (const u of updates) {
    const result = await col.updateOne(
      { iataCode: u.iata },
      {
        $set: {
          isSlotControlled: true,
          coordinationLevel: u.level,
          slotsPerHourDay: u.day,
          slotsPerHourNight: u.night,
          coordinatorName: u.coord,
          coordinatorEmail: u.email,
        },
      },
    )
    if (result.matchedCount > 0) {
      updated++
      console.log(`  ${u.iata} -> Level ${u.level} (${u.day}/${u.night} slots/hr)`)
    } else {
      notFound++
      console.log(`  ${u.iata} -> NOT FOUND in database`)
    }
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found in database`)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
