/**
 * Update country lat/lng from centroids to capital city coordinates.
 * Run: npx tsx src/migrate-capital-coords.ts
 */
import 'dotenv/config'
import { connectDB } from './db/connection.js'
import { Country } from './models/Country.js'

// Capital city coordinates keyed by ISO 3166-1 alpha-2 code
// Source: well-known capital city coordinates
const CAPITAL_COORDS: Record<string, { lat: number; lng: number }> = {
  AF: { lat: 34.5553, lng: 69.2075 },   // Kabul
  AL: { lat: 41.3275, lng: 19.8187 },   // Tirana
  DZ: { lat: 36.7538, lng: 3.0588 },    // Algiers
  AD: { lat: 42.5063, lng: 1.5218 },    // Andorra la Vella
  AO: { lat: -8.8390, lng: 13.2894 },   // Luanda
  AG: { lat: 17.1175, lng: -61.8456 },  // St. John's
  AR: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
  AM: { lat: 40.1792, lng: 44.4991 },   // Yerevan
  AU: { lat: -35.2809, lng: 149.1300 }, // Canberra
  AT: { lat: 48.2082, lng: 16.3738 },   // Vienna
  AZ: { lat: 40.4093, lng: 49.8671 },   // Baku
  BS: { lat: 25.0343, lng: -77.3963 },  // Nassau
  BH: { lat: 26.2285, lng: 50.5860 },   // Manama
  BD: { lat: 23.8103, lng: 90.4125 },   // Dhaka
  BB: { lat: 13.0969, lng: -59.6145 },  // Bridgetown
  BY: { lat: 53.9006, lng: 27.5590 },   // Minsk
  BE: { lat: 50.8503, lng: 4.3517 },    // Brussels
  BZ: { lat: 17.2510, lng: -88.7590 },  // Belmopan
  BJ: { lat: 6.4969, lng: 2.6289 },     // Porto-Novo
  BT: { lat: 27.4728, lng: 89.6390 },   // Thimphu
  BO: { lat: -16.4897, lng: -68.1193 }, // La Paz
  BA: { lat: 43.8563, lng: 18.4131 },   // Sarajevo
  BW: { lat: -24.6282, lng: 25.9231 },  // Gaborone
  BR: { lat: -15.7975, lng: -47.8919 }, // Brasília
  BN: { lat: 4.9031, lng: 114.9398 },   // Bandar Seri Begawan
  BG: { lat: 42.6977, lng: 23.3219 },   // Sofia
  BF: { lat: 12.3714, lng: -1.5197 },   // Ouagadougou
  BI: { lat: -3.3731, lng: 29.3644 },   // Gitega
  KH: { lat: 11.5564, lng: 104.9282 },  // Phnom Penh
  CM: { lat: 3.8480, lng: 11.5021 },    // Yaoundé
  CA: { lat: 45.4215, lng: -75.6972 },  // Ottawa
  CV: { lat: 14.9331, lng: -23.5133 },  // Praia
  CF: { lat: 4.3947, lng: 18.5582 },    // Bangui
  TD: { lat: 12.1348, lng: 15.0557 },   // N'Djamena
  CL: { lat: -33.4489, lng: -70.6693 }, // Santiago
  CN: { lat: 39.9042, lng: 116.4074 },  // Beijing
  CO: { lat: 4.7110, lng: -74.0721 },   // Bogotá
  KM: { lat: -11.7172, lng: 43.2473 },  // Moroni
  CG: { lat: -4.2634, lng: 15.2429 },   // Brazzaville
  CD: { lat: -4.4419, lng: 15.2663 },   // Kinshasa
  CR: { lat: 9.9281, lng: -84.0907 },   // San José
  CI: { lat: 6.8276, lng: -5.2893 },    // Yamoussoukro
  HR: { lat: 45.8150, lng: 15.9819 },   // Zagreb
  CU: { lat: 23.1136, lng: -82.3666 },  // Havana
  CY: { lat: 35.1856, lng: 33.3823 },   // Nicosia
  CZ: { lat: 50.0755, lng: 14.4378 },   // Prague
  DK: { lat: 55.6761, lng: 12.5683 },   // Copenhagen
  DJ: { lat: 11.5721, lng: 43.1456 },   // Djibouti
  DM: { lat: 15.3010, lng: -61.3870 },  // Roseau
  DO: { lat: 18.4861, lng: -69.9312 },  // Santo Domingo
  EC: { lat: -0.1807, lng: -78.4678 },  // Quito
  EG: { lat: 30.0444, lng: 31.2357 },   // Cairo
  SV: { lat: 13.6929, lng: -89.2182 },  // San Salvador
  GQ: { lat: 3.7504, lng: 8.7371 },     // Malabo
  ER: { lat: 15.3229, lng: 38.9251 },   // Asmara
  EE: { lat: 59.4370, lng: 24.7536 },   // Tallinn
  SZ: { lat: -26.3054, lng: 31.1367 },  // Mbabane
  ET: { lat: 9.0250, lng: 38.7469 },    // Addis Ababa
  FJ: { lat: -18.1416, lng: 178.4419 }, // Suva
  FI: { lat: 60.1699, lng: 24.9384 },   // Helsinki
  FR: { lat: 48.8566, lng: 2.3522 },    // Paris
  GA: { lat: 0.4162, lng: 9.4673 },     // Libreville
  GM: { lat: 13.4549, lng: -16.5790 },  // Banjul
  GE: { lat: 41.7151, lng: 44.8271 },   // Tbilisi
  DE: { lat: 52.5200, lng: 13.4050 },   // Berlin
  GH: { lat: 5.6037, lng: -0.1870 },    // Accra
  GR: { lat: 37.9838, lng: 23.7275 },   // Athens
  GD: { lat: 12.0564, lng: -61.7485 },  // St. George's
  GT: { lat: 14.6349, lng: -90.5069 },  // Guatemala City
  GN: { lat: 9.6412, lng: -13.5784 },   // Conakry
  GW: { lat: 11.8037, lng: -15.1804 },  // Bissau
  GY: { lat: 6.8013, lng: -58.1551 },   // Georgetown
  HT: { lat: 18.5944, lng: -72.3074 },  // Port-au-Prince
  HN: { lat: 14.0723, lng: -87.1921 },  // Tegucigalpa
  HU: { lat: 47.4979, lng: 19.0402 },   // Budapest
  IS: { lat: 64.1466, lng: -21.9426 },  // Reykjavik
  IN: { lat: 28.6139, lng: 77.2090 },   // New Delhi
  ID: { lat: -6.2088, lng: 106.8456 },  // Jakarta
  IR: { lat: 35.6892, lng: 51.3890 },   // Tehran
  IQ: { lat: 33.3152, lng: 44.3661 },   // Baghdad
  IE: { lat: 53.3498, lng: -6.2603 },   // Dublin
  IL: { lat: 31.7683, lng: 35.2137 },   // Jerusalem
  IT: { lat: 41.9028, lng: 12.4964 },   // Rome
  JM: { lat: 18.0179, lng: -76.8099 },  // Kingston
  JP: { lat: 35.6762, lng: 139.6503 },  // Tokyo
  JO: { lat: 31.9454, lng: 35.9284 },   // Amman
  KZ: { lat: 51.1694, lng: 71.4491 },   // Astana
  KE: { lat: -1.2921, lng: 36.8219 },   // Nairobi
  KI: { lat: 1.4518, lng: 173.0181 },   // Tarawa
  KP: { lat: 39.0392, lng: 125.7625 },  // Pyongyang
  KR: { lat: 37.5665, lng: 126.9780 },  // Seoul
  KW: { lat: 29.3759, lng: 47.9774 },   // Kuwait City
  KG: { lat: 42.8746, lng: 74.5698 },   // Bishkek
  LA: { lat: 17.9757, lng: 102.6331 },  // Vientiane
  LV: { lat: 56.9496, lng: 24.1052 },   // Riga
  LB: { lat: 33.8938, lng: 35.5018 },   // Beirut
  LS: { lat: -29.3142, lng: 27.4833 },  // Maseru
  LR: { lat: 6.2907, lng: -10.7605 },   // Monrovia
  LY: { lat: 32.8872, lng: 13.1913 },   // Tripoli
  LI: { lat: 47.1660, lng: 9.5554 },    // Vaduz
  LT: { lat: 54.6872, lng: 25.2797 },   // Vilnius
  LU: { lat: 49.6116, lng: 6.1300 },    // Luxembourg City
  MG: { lat: -18.8792, lng: 47.5079 },  // Antananarivo
  MW: { lat: -13.9626, lng: 33.7741 },  // Lilongwe
  MY: { lat: 3.1390, lng: 101.6869 },   // Kuala Lumpur
  MV: { lat: 4.1755, lng: 73.5093 },    // Malé
  ML: { lat: 12.6392, lng: -8.0029 },   // Bamako
  MT: { lat: 35.8989, lng: 14.5146 },   // Valletta
  MH: { lat: 7.1164, lng: 171.1858 },   // Majuro
  MR: { lat: 18.0735, lng: -15.9582 },  // Nouakchott
  MU: { lat: -20.1609, lng: 57.5012 },  // Port Louis
  MX: { lat: 19.4326, lng: -99.1332 },  // Mexico City
  FM: { lat: 6.9248, lng: 158.1618 },   // Palikir
  MD: { lat: 47.0105, lng: 28.8638 },   // Chișinău
  MC: { lat: 43.7384, lng: 7.4246 },    // Monaco
  MN: { lat: 47.8864, lng: 106.9057 },  // Ulaanbaatar
  ME: { lat: 42.4304, lng: 19.2594 },   // Podgorica
  MA: { lat: 33.9716, lng: -6.8498 },   // Rabat
  MZ: { lat: -25.9692, lng: 32.5732 },  // Maputo
  MM: { lat: 19.7633, lng: 96.0785 },   // Naypyidaw
  NA: { lat: -22.5597, lng: 17.0832 },  // Windhoek
  NR: { lat: -0.5477, lng: 166.9209 },  // Yaren
  NP: { lat: 27.7172, lng: 85.3240 },   // Kathmandu
  NL: { lat: 52.3676, lng: 4.9041 },    // Amsterdam
  NZ: { lat: -41.2865, lng: 174.7762 }, // Wellington
  NI: { lat: 12.1150, lng: -86.2362 },  // Managua
  NE: { lat: 13.5116, lng: 2.1254 },    // Niamey
  NG: { lat: 9.0765, lng: 7.3986 },     // Abuja
  MK: { lat: 41.9973, lng: 21.4280 },   // Skopje
  NO: { lat: 59.9139, lng: 10.7522 },   // Oslo
  OM: { lat: 23.5880, lng: 58.3829 },   // Muscat
  PK: { lat: 33.6844, lng: 73.0479 },   // Islamabad
  PW: { lat: 7.5150, lng: 134.5825 },   // Ngerulmud
  PA: { lat: 8.9824, lng: -79.5199 },   // Panama City
  PG: { lat: -6.3149, lng: 143.9556 },  // Port Moresby (corrected to capital area)
  PY: { lat: -25.2637, lng: -57.5759 }, // Asunción
  PE: { lat: -12.0464, lng: -77.0428 }, // Lima
  PH: { lat: 14.5995, lng: 120.9842 }, // Manila
  PL: { lat: 52.2297, lng: 21.0122 },   // Warsaw
  PT: { lat: 38.7223, lng: -9.1393 },   // Lisbon
  QA: { lat: 25.2854, lng: 51.5310 },   // Doha
  RO: { lat: 44.4268, lng: 26.1025 },   // Bucharest
  RU: { lat: 55.7558, lng: 37.6173 },   // Moscow
  RW: { lat: -1.9403, lng: 29.8739 },   // Kigali
  KN: { lat: 17.3026, lng: -62.7177 },  // Basseterre
  LC: { lat: 14.0101, lng: -60.9870 },  // Castries
  VC: { lat: 13.1579, lng: -61.2248 },  // Kingstown
  WS: { lat: -13.8333, lng: -171.7500 },// Apia
  SM: { lat: 43.9424, lng: 12.4578 },   // San Marino
  ST: { lat: 0.1864, lng: 6.6131 },     // São Tomé
  SA: { lat: 24.7136, lng: 46.6753 },   // Riyadh
  SN: { lat: 14.7167, lng: -17.4677 },  // Dakar
  RS: { lat: 44.7866, lng: 20.4489 },   // Belgrade
  SC: { lat: -4.6191, lng: 55.4513 },   // Victoria
  SL: { lat: 8.4657, lng: -13.2317 },   // Freetown
  SG: { lat: 1.3521, lng: 103.8198 },   // Singapore
  SK: { lat: 48.1486, lng: 17.1077 },   // Bratislava
  SI: { lat: 46.0569, lng: 14.5058 },   // Ljubljana
  SB: { lat: -9.4456, lng: 160.0000 },  // Honiara
  SO: { lat: 2.0469, lng: 45.3182 },    // Mogadishu
  ZA: { lat: -25.7479, lng: 28.2293 },  // Pretoria
  SS: { lat: 4.8594, lng: 31.5713 },    // Juba
  ES: { lat: 40.4168, lng: -3.7038 },   // Madrid
  LK: { lat: 6.9271, lng: 79.8612 },    // Colombo
  SD: { lat: 15.5007, lng: 32.5599 },   // Khartoum
  SR: { lat: 5.8520, lng: -55.2038 },   // Paramaribo
  SE: { lat: 59.3293, lng: 18.0686 },   // Stockholm
  CH: { lat: 46.9480, lng: 7.4474 },    // Bern
  SY: { lat: 33.5138, lng: 36.2765 },   // Damascus
  TW: { lat: 25.0330, lng: 121.5654 },  // Taipei
  TJ: { lat: 38.5598, lng: 68.7740 },   // Dushanbe
  TZ: { lat: -6.7924, lng: 39.2083 },   // Dar es Salaam
  TH: { lat: 13.7563, lng: 100.5018 },  // Bangkok
  TL: { lat: -8.5569, lng: 125.5603 },  // Dili
  TG: { lat: 6.1256, lng: 1.2254 },     // Lomé
  TO: { lat: -21.2087, lng: -175.1982 },// Nukuʻalofa
  TT: { lat: 10.6596, lng: -61.5086 },  // Port of Spain
  TN: { lat: 36.8065, lng: 10.1815 },   // Tunis
  TR: { lat: 39.9334, lng: 32.8597 },   // Ankara
  TM: { lat: 37.9601, lng: 58.3261 },   // Ashgabat
  TV: { lat: -8.5211, lng: 179.1962 },  // Funafuti
  UG: { lat: 0.3476, lng: 32.5825 },    // Kampala
  UA: { lat: 50.4501, lng: 30.5234 },   // Kyiv
  AE: { lat: 24.4539, lng: 54.3773 },   // Abu Dhabi
  GB: { lat: 51.5074, lng: -0.1278 },   // London
  US: { lat: 38.9072, lng: -77.0369 },  // Washington D.C.
  UY: { lat: -34.9011, lng: -56.1645 }, // Montevideo
  UZ: { lat: 41.2995, lng: 69.2401 },   // Tashkent
  VU: { lat: -17.7334, lng: 168.3273 }, // Port Vila
  VA: { lat: 41.9029, lng: 12.4534 },   // Vatican City
  VE: { lat: 10.4806, lng: -66.9036 },  // Caracas
  VN: { lat: 21.0278, lng: 105.8342 },  // Hanoi
  YE: { lat: 15.3694, lng: 44.1910 },   // Sana'a
  ZM: { lat: -15.3875, lng: 28.3228 },  // Lusaka
  ZW: { lat: -17.8252, lng: 31.0335 },  // Harare
  // Territories & dependencies
  HK: { lat: 22.3193, lng: 114.1694 },  // Hong Kong
  MO: { lat: 22.1987, lng: 113.5439 },  // Macau
  PS: { lat: 31.9522, lng: 35.2332 },   // Ramallah
  XK: { lat: 42.6629, lng: 21.1655 },   // Pristina
  PR: { lat: 18.4655, lng: -66.1057 },  // San Juan
}

async function main() {
  await connectDB()

  const countries = await Country.find({})
  let updated = 0
  let notFound = 0

  for (const country of countries) {
    const coords = CAPITAL_COORDS[country.isoCode2]
    if (coords) {
      await Country.updateOne(
        { _id: country._id },
        { $set: { latitude: coords.lat, longitude: coords.lng } }
      )
      updated++
    } else {
      console.log(`  No capital coords for: ${country.isoCode2} — ${country.name}`)
      notFound++
    }
  }

  console.log(`\n✓ Updated ${updated} countries to capital city coordinates`)
  if (notFound > 0) console.log(`  ${notFound} countries had no mapping (kept existing coords)`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
