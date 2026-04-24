import 'dotenv/config'
import crypto from 'node:crypto'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { Operator } from './models/Operator.js'
import { Airport } from './models/Airport.js'
import { CrewHotel } from './models/CrewHotel.js'

interface HotelSeed {
  name: string
  addressLine1?: string
  addressLine2?: string
  latitude?: number
  longitude?: number
  distanceMin?: number
  trainingHotel?: boolean
  checkIn?: string
  checkOut?: string
}

// Real 4-5 star crew hotels per airport ICAO.
// Coordinates verified against Google Maps / hotel websites.
const HOTELS_BY_ICAO: Record<string, HotelSeed> = {
  // ── Vietnam ──
  VVTS: {
    name: 'Pullman Saigon Centre',
    addressLine1: '148 Tran Hung Dao',
    addressLine2: 'District 1, Ho Chi Minh City',
    latitude: 10.7625,
    longitude: 106.6947,
    distanceMin: 25,
  },
  VVNB: {
    name: 'Pullman Hanoi',
    addressLine1: '40 Cat Linh Street',
    addressLine2: 'Dong Da District, Hanoi',
    latitude: 21.0285,
    longitude: 105.8281,
    distanceMin: 35,
  },
  VVCR: {
    name: 'Mövenpick Resort Cam Ranh',
    addressLine1: 'Lot D10b, North Cam Ranh Peninsula',
    addressLine2: 'Cam Lam, Khanh Hoa',
    latitude: 12.0817,
    longitude: 109.2033,
    distanceMin: 12,
  },
  VVDN: {
    name: 'Pullman Danang Beach Resort',
    addressLine1: '101 Vo Nguyen Giap',
    addressLine2: 'Khue My Ward, Ngu Hanh Son, Da Nang',
    latitude: 16.0344,
    longitude: 108.2485,
    distanceMin: 20,
  },
  VVCI: {
    name: 'Pullman Haiphong Grand Hotel',
    addressLine1: '12 Tran Phu',
    addressLine2: 'Ngo Quyen, Hai Phong',
    latitude: 20.8572,
    longitude: 106.6833,
    distanceMin: 18,
  },
  VVVH: {
    name: 'Muong Thanh Luxury Vinh',
    addressLine1: '97 Le Loi',
    addressLine2: 'Vinh City, Nghe An',
    latitude: 18.6767,
    longitude: 105.6922,
    distanceMin: 15,
  },
  VVPQ: {
    name: 'JW Marriott Phu Quoc Emerald Bay',
    addressLine1: 'Bai Khem, An Thoi',
    addressLine2: 'Phu Quoc Island, Kien Giang',
    latitude: 10.0531,
    longitude: 104.0308,
    distanceMin: 30,
  },

  // ── Japan ──
  RJBB: {
    name: 'Hotel Nikko Kansai Airport',
    addressLine1: '1 Senshu-Kuko-Kita',
    addressLine2: 'Izumisano, Osaka 549-0001',
    latitude: 34.4347,
    longitude: 135.2431,
    distanceMin: 3,
  },
  RJAA: {
    name: 'Hilton Tokyo Narita Airport',
    addressLine1: '456 Kosuge',
    addressLine2: 'Narita, Chiba 286-0127',
    latitude: 35.7756,
    longitude: 140.3589,
    distanceMin: 8,
  },

  // ── Australia ──
  YSSY: {
    name: 'Rydges Sydney Airport Hotel',
    addressLine1: '8 Arrivals Court',
    addressLine2: 'Mascot NSW 2020',
    latitude: -33.9347,
    longitude: 151.1769,
    distanceMin: 2,
  },
  YMML: {
    name: 'PARKROYAL Melbourne Airport',
    addressLine1: 'Arrival Drive',
    addressLine2: 'Melbourne Airport VIC 3045',
    latitude: -37.6658,
    longitude: 144.8508,
    distanceMin: 2,
  },
  YPPH: {
    name: 'Pan Pacific Perth',
    addressLine1: '207 Adelaide Terrace',
    addressLine2: 'Perth WA 6000',
    latitude: -31.9572,
    longitude: 115.8694,
    distanceMin: 20,
  },

  // ── Middle East ──
  OMDB: {
    name: 'Le Méridien Dubai Hotel & Conference Centre',
    addressLine1: 'Airport Road',
    addressLine2: 'Al Garhoud, Dubai',
    latitude: 25.2464,
    longitude: 55.3522,
    distanceMin: 5,
  },

  // ── Europe ──
  EGLL: {
    name: 'Sofitel London Heathrow',
    addressLine1: 'Terminal 5, Heathrow Airport',
    addressLine2: 'London TW6 2GD',
    latitude: 51.4722,
    longitude: -0.4886,
    distanceMin: 2,
  },

  // ── Additional common bases (fallback picks) ──
  VTBS: {
    name: 'Novotel Bangkok Suvarnabhumi Airport',
    addressLine1: '999 Moo 1, Nong Prue',
    addressLine2: 'Bang Phli, Samut Prakan 10540',
    latitude: 13.6855,
    longitude: 100.7506,
    distanceMin: 3,
  },
  WMKK: {
    name: 'Sama-Sama Hotel KLIA',
    addressLine1: 'Jalan CTA 4B, KLIA',
    addressLine2: '64000 Sepang, Selangor',
    latitude: 2.7456,
    longitude: 101.7031,
    distanceMin: 3,
  },
  WSSS: {
    name: 'Crowne Plaza Changi Airport',
    addressLine1: '75 Airport Boulevard',
    addressLine2: 'Singapore 819664',
    latitude: 1.3582,
    longitude: 103.9889,
    distanceMin: 2,
  },
  VHHH: {
    name: 'Regal Airport Hotel',
    addressLine1: '9 Cheong Tat Road',
    addressLine2: 'Chek Lap Kok, Hong Kong',
    latitude: 22.3175,
    longitude: 113.9364,
    distanceMin: 3,
  },
  RKSI: {
    name: 'Grand Hyatt Incheon',
    addressLine1: '208 Yeongjonghaeannam-ro 321beon-gil',
    addressLine2: 'Jung-gu, Incheon',
    latitude: 37.4472,
    longitude: 126.4528,
    distanceMin: 5,
  },
  ZBAA: {
    name: 'Langham Place Beijing Capital Airport',
    addressLine1: '1 Er Jing Road',
    addressLine2: 'Terminal 3, Beijing Capital Airport',
    latitude: 40.0747,
    longitude: 116.6036,
    distanceMin: 3,
  },
  ZSPD: {
    name: 'Crowne Plaza Shanghai Pudong',
    addressLine1: '500 Yingbin Avenue',
    addressLine2: 'Pudong New Area, Shanghai',
    latitude: 31.1672,
    longitude: 121.8053,
    distanceMin: 10,
  },
  KLAX: {
    name: 'Hilton Los Angeles Airport',
    addressLine1: '5711 West Century Boulevard',
    addressLine2: 'Los Angeles, CA 90045',
    latitude: 33.9536,
    longitude: -118.3767,
    distanceMin: 5,
  },
  KJFK: {
    name: 'TWA Hotel',
    addressLine1: 'One Idlewild Drive, JFK Airport',
    addressLine2: 'Queens, NY 11430',
    latitude: 40.6459,
    longitude: -73.7802,
    distanceMin: 2,
  },
  EDDF: {
    name: 'Sheraton Frankfurt Airport Hotel',
    addressLine1: 'Hugo-Eckener-Ring',
    addressLine2: '60549 Frankfurt am Main',
    latitude: 50.0513,
    longitude: 8.5706,
    distanceMin: 2,
  },
  LFPG: {
    name: 'Sheraton Paris Charles de Gaulle Airport Hotel',
    addressLine1: 'Terminal 2, Aerogare 2',
    addressLine2: '95700 Roissy-en-France',
    latitude: 49.0028,
    longitude: 2.5714,
    distanceMin: 2,
  },
}

function genericHotel(icao: string, airportName: string, city: string | null): HotelSeed {
  return {
    name: `Airport Crew Hotel ${icao}`,
    addressLine1: `Near ${airportName}`,
    addressLine2: city ?? '',
    distanceMin: 20,
  }
}

async function run() {
  await connectDB(env.MONGODB_URI)

  const op = await Operator.findOne({ isActive: { $ne: false } }).lean()
  if (!op) {
    console.error('✗ No active operator in DB')
    process.exit(1)
  }
  const operatorId = op._id as string
  console.log(`Seeding crew hotels for operator: ${operatorId}`)

  const airports = await Airport.find({ isActive: { $ne: false } }).lean()
  console.log(`Found ${airports.length} active airports`)

  let created = 0
  let skipped = 0

  for (const ap of airports) {
    const icao = String(ap.icaoCode).toUpperCase()
    const seed = HOTELS_BY_ICAO[icao] ?? genericHotel(icao, String(ap.name), ap.city ?? null)

    const existing = await CrewHotel.findOne({
      operatorId,
      airportIcao: icao,
      hotelName: seed.name,
    }).lean()
    if (existing) {
      skipped++
      continue
    }

    await CrewHotel.create({
      _id: crypto.randomUUID(),
      operatorId,
      airportIcao: icao,
      hotelName: seed.name,
      priority: 1,
      isActive: true,
      effectiveFromUtcMs: null,
      effectiveUntilUtcMs: null,
      isTrainingHotel: seed.trainingHotel ?? false,
      isAllInclusive: false,
      addressLine1: seed.addressLine1 ?? null,
      addressLine2: seed.addressLine2 ?? null,
      addressLine3: null,
      latitude: seed.latitude ?? ap.latitude ?? null,
      longitude: seed.longitude ?? ap.longitude ?? null,
      distanceFromAirportMinutes: seed.distanceMin ?? 20,
      shuttleAlwaysAvailable: false,
      standardCheckInLocal: seed.checkIn ?? '14:00',
      standardCheckOutLocal: seed.checkOut ?? '12:00',
      criteria: {
        blockToBlockRestMinutes: null,
        crewPositions: [],
        aircraftTypes: [],
        crewCategories: [],
        charterers: [],
      },
      contacts: [],
      emails: [],
      contracts: [],
      shuttles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    created++
    console.log(`  + ${icao} — ${seed.name}`)
  }

  console.log(`\n✓ Created ${created} hotels, skipped ${skipped} existing`)
  process.exit(0)
}

run().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
