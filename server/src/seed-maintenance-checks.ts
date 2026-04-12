import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { MaintenanceCheckType } from './models/MaintenanceCheckType.js'
import { MaintenanceWindow } from './models/MaintenanceWindow.js'
import crypto from 'node:crypto'

const OPERATOR_ID = '20169cc0-c914-4662-a300-1dbbe20d1416'

// Aircraft type IDs (from database)
const A320 = '3e42a49f-ff55-4a3c-9276-03f39d3eca5d'
const A321 = '36ad3b9a-1438-4dd5-815c-5afe57e591fb'
const A350 = 'f93e9ccf-7de8-41c2-b701-ba9b0b8b3fce'
const A380 = 'fe2667c3-7644-4311-84ce-1b11fc3f22d6'

/**
 * Realistic Airbus maintenance check intervals based on industry MPD
 * (Maintenance Planning Document) standards and common airline practices.
 *
 * References:
 * - Airbus A320 family MPD (MSG-3 based)
 * - Airbus A350 XWB MPD
 * - Airbus A380 MPD
 * - IATA MSG-3 maintenance program development guidelines
 */
const CHECK_TYPES = [
  // ─── Line Maintenance (all aircraft) ───
  {
    code: 'TR',
    name: 'Transit Check',
    description:
      'Walk-around and quick systems check at each turnaround. Visual inspection of aircraft exterior, tire condition, fluid leaks, and damage. Reset cabin for next departure.',
    defaultCyclesInterval: 1,
    defaultDurationHours: 0.25,
    requiresGrounding: false,
    color: '#94a3b8',
    sortOrder: 1,
  },
  {
    code: 'DY',
    name: 'Daily Check',
    description:
      'Comprehensive daily inspection performed once every 24-48 hours. Includes fluid level checks, tire pressure, brake wear measurement, all external lighting, emergency equipment serviceability, and logbook review.',
    defaultDaysInterval: 2,
    defaultDurationHours: 1.5,
    requiresGrounding: false,
    color: '#64748b',
    sortOrder: 2,
  },
  {
    code: 'WK',
    name: 'Weekly Check',
    description:
      'Extended line check performed every 7 days. Detailed inspection of landing gear, engine intake/exhaust, flight control surfaces, hydraulic systems, and APU. Includes operational checks of emergency systems.',
    defaultDaysInterval: 7,
    defaultDurationHours: 4,
    requiresGrounding: false,
    color: '#475569',
    sortOrder: 3,
  },

  // ─── A-Checks (light base maintenance, A320/A321 family) ───
  {
    code: '1A',
    name: 'A1 Check',
    description:
      'First-level base check. General visual inspection of aircraft structure, systems operational tests, lubrication of moving parts, filter replacements, and detailed cabin inspection. Performed in hangar overnight.',
    defaultHoursInterval: 750,
    defaultDaysInterval: 120,
    defaultDurationHours: 24,
    requiresGrounding: true,
    color: '#f59e0b',
    sortOrder: 4,
    resetsCheckCodes: ['TR', 'DY', 'WK'],
  },
  {
    code: '2A',
    name: 'A2 Check',
    description:
      'Second-level base check combining A1 tasks plus additional system inspections. Includes detailed landing gear inspection, flight control rigging checks, fuel system inspection, and avionics calibration.',
    defaultHoursInterval: 1500,
    defaultDaysInterval: 240,
    defaultDurationHours: 48,
    requiresGrounding: true,
    color: '#d97706',
    sortOrder: 5,
    resetsCheckCodes: ['TR', 'DY', 'WK', '1A'],
  },
  {
    code: '4A',
    name: 'A4 Check',
    description:
      'Fourth-level base check. Full A2 scope plus deep structural sampling inspections, corrosion prevention compound renewal, extensive NDT on critical structure, and major component serviceability reviews.',
    defaultHoursInterval: 3000,
    defaultDaysInterval: 480,
    defaultDurationHours: 72,
    requiresGrounding: true,
    color: '#b45309',
    sortOrder: 6,
    resetsCheckCodes: ['TR', 'DY', 'WK', '1A', '2A'],
  },

  // ─── C-Checks (heavy base maintenance) ───
  {
    code: '1C',
    name: 'C1 Check',
    description:
      'First heavy maintenance check. Extensive structural inspection with access panel removal, detailed NDT of fatigue-critical areas, hydraulic and pneumatic system overhaul, flight control actuator inspection, and cabin refurbishment.',
    defaultHoursInterval: 7500,
    defaultCyclesInterval: 5000,
    defaultDaysInterval: 730,
    defaultDurationHours: 168,
    defaultStation: 'VVTS',
    requiresGrounding: true,
    color: '#ef4444',
    sortOrder: 7,
    resetsCheckCodes: ['TR', 'DY', 'WK', '1A', '2A', '4A'],
  },
  {
    code: '2C',
    name: 'C2 Check',
    description:
      'Second heavy maintenance check. Full C1 scope plus deep structural inspection of wing box, center section, and pressure hull. Major landing gear inspection/overhaul, engine pylon structural checks, and fuel tank entry inspection.',
    defaultHoursInterval: 15000,
    defaultCyclesInterval: 10000,
    defaultDaysInterval: 1460,
    defaultDurationHours: 336,
    defaultStation: 'VVTS',
    requiresGrounding: true,
    color: '#dc2626',
    sortOrder: 8,
    resetsCheckCodes: ['TR', 'DY', 'WK', '1A', '2A', '4A', '1C'],
  },
  {
    code: '4C',
    name: 'C4 Check',
    description:
      'Fourth heavy check near D-check scope. Complete structural survey including fuselage skin panel inspection, wing spar and rib examination, empennage deep inspection. May include major modifications and SB compliance.',
    defaultHoursInterval: 30000,
    defaultCyclesInterval: 20000,
    defaultDaysInterval: 2920,
    defaultDurationHours: 500,
    defaultStation: 'VVTS',
    requiresGrounding: true,
    color: '#b91c1c',
    sortOrder: 9,
    resetsCheckCodes: ['TR', 'DY', 'WK', '1A', '2A', '4A', '1C', '2C'],
  },

  // ─── Structural Inspections ───
  {
    code: '6Y',
    name: '6-Year Structural',
    description:
      'Major structural inspection program aligned with 6-year calendar interval. Comprehensive CPCP (Corrosion Prevention and Control Program), DT/DTE (Damage Tolerance) inspections, and supplemental structural inspection document (SSID) tasks.',
    defaultHoursInterval: 22500,
    defaultCyclesInterval: 15000,
    defaultDaysInterval: 2190,
    defaultDurationHours: 400,
    defaultStation: 'VVTS',
    requiresGrounding: true,
    color: '#7c3aed',
    sortOrder: 10,
    resetsCheckCodes: ['TR', 'DY', 'WK', '1A', '2A', '4A', '1C', '2C'],
  },
  {
    code: '12Y',
    name: '12-Year Structural (D-Check)',
    description:
      'Most comprehensive maintenance event. Complete aircraft strip-down and rebuild. Full structural survey, all access panels removed, complete paint strip and repaint, cabin gutted and refurbished, all major components overhauled or replaced. Aircraft returned to near-new condition.',
    defaultHoursInterval: 48000,
    defaultCyclesInterval: 24000,
    defaultDaysInterval: 4380,
    defaultDurationHours: 1200,
    defaultStation: 'VVTS',
    requiresGrounding: true,
    color: '#581c87',
    sortOrder: 11,
    resetsCheckCodes: ['TR', 'DY', 'WK', '1A', '2A', '4A', '1C', '2C', '4C', '6Y'],
  },

  // ─── Component-Specific Checks ───
  {
    code: 'LG',
    name: 'Landing Gear Overhaul',
    description:
      'Complete landing gear removal, disassembly, and overhaul per CMM. Includes trunnion NDT, actuator rebuild, brake assembly overhaul, wheel bearing replacement, and shimmy damper service.',
    defaultCyclesInterval: 18000,
    defaultDaysInterval: 3650,
    defaultDurationHours: 240,
    defaultStation: 'VVTS',
    requiresGrounding: true,
    color: '#0891b2',
    sortOrder: 12,
  },
  {
    code: 'ENG',
    name: 'Engine Shop Visit',
    description:
      'Engine removal for performance restoration or life-limited part replacement. Includes hot section inspection, compressor refurbishment, bearing replacement, and full test cell run. Interval driven by EHM (Engine Health Monitoring) trends.',
    defaultHoursInterval: 20000,
    defaultCyclesInterval: 10000,
    defaultDurationHours: 720,
    requiresGrounding: true,
    color: '#0d9488',
    sortOrder: 13,
  },
  {
    code: 'EWW',
    name: 'Engine Water Wash',
    description:
      'On-wing engine cleaning using desalinated water injection to restore compressor efficiency. Removes salt, dirt, and carbon deposits. Improves EGT margin and fuel efficiency. Required more frequently in coastal/humid environments like Vietnam.',
    defaultHoursInterval: 1000,
    defaultDaysInterval: 90,
    defaultDurationHours: 2,
    requiresGrounding: false,
    color: '#14b8a6',
    sortOrder: 14,
  },
  {
    code: 'BSI',
    name: 'Borescope Inspection',
    description:
      'Endoscopic visual inspection of engine hot section (combustion chamber, HPT, LPT) without engine removal. Detects blade erosion, cracking, coating loss, and FOD damage. Critical for engine-on-wing health monitoring.',
    defaultHoursInterval: 3000,
    defaultCyclesInterval: 2000,
    defaultDurationHours: 8,
    requiresGrounding: false,
    color: '#2dd4bf',
    sortOrder: 15,
  },
  {
    code: 'APU',
    name: 'APU Overhaul',
    description:
      'Auxiliary Power Unit removal and shop visit. Includes turbine section inspection, generator overhaul, fuel control unit calibration, and exhaust duct inspection. Interval based on APU operating hours.',
    defaultHoursInterval: 6000,
    defaultDurationHours: 480,
    requiresGrounding: true,
    color: '#06b6d4',
    sortOrder: 16,
  },

  // ─── A350-Specific Checks (composite-heavy) ───
  {
    code: 'CSI',
    name: 'Composite Structure Inspection',
    description:
      'Specialized NDT inspection for CFRP (Carbon Fiber Reinforced Polymer) composite structures unique to A350 and A380. Uses ultrasonic and thermographic techniques to detect delamination, impact damage, and moisture ingress in fuselage panels, wing skins, and empennage.',
    defaultHoursInterval: 6000,
    defaultDaysInterval: 730,
    defaultDurationHours: 48,
    requiresGrounding: true,
    color: '#8b5cf6',
    sortOrder: 17,
    applicableAircraftTypeIds: [A350, A380],
  },

  // ─── A380-Specific Checks ───
  {
    code: 'WCI',
    name: 'Wing Crack Inspection',
    description:
      'A380-specific wing rib foot inspection for stress cracking per Airbus AD. Ultrasonic inspection of wing rib feet at inboard wing locations. Mandated by EASA AD after fleet-wide findings on early A380 aircraft.',
    defaultHoursInterval: 8000,
    defaultDaysInterval: 1095,
    defaultDurationHours: 72,
    defaultStation: 'VVTS',
    requiresGrounding: true,
    color: '#a855f7',
    sortOrder: 18,
    applicableAircraftTypeIds: [A380],
  },
]

/**
 * Realistic maintenance windows for Vietnamese bases.
 * Based on typical VietJet Air / Vietnam Airlines night schedules.
 */
const WINDOWS = [
  {
    base: 'VVTS', // Ho Chi Minh City (SGN)
    windowStartUtc: '18:00', // 01:00 local (UTC+7)
    windowEndUtc: '21:00', // 04:00 local
    notes: 'SGN overnight window. Most domestic flights end by 00:00 local.',
  },
  {
    base: 'VVNB', // Hanoi (HAN)
    windowStartUtc: '16:00', // 23:00 local
    windowEndUtc: '19:00', // 02:00 local
    notes: 'HAN overnight window. Slightly earlier than SGN due to curfew.',
  },
  {
    base: 'VVDN', // Da Nang (DAD)
    windowStartUtc: '17:00', // 00:00 local
    windowEndUtc: '20:00', // 03:00 local
    notes: 'DAD overnight window. Limited maintenance capability.',
  },
  {
    base: 'VVCR', // Cam Ranh (CXR)
    windowStartUtc: '17:30', // 00:30 local
    windowEndUtc: '20:30', // 03:30 local
    notes: 'CXR overnight window. Line maintenance only.',
  },
]

async function seed() {
  await connectDB(env.MONGODB_URI)
  const now = new Date().toISOString()

  // Clear existing
  await MaintenanceCheckType.deleteMany({ operatorId: OPERATOR_ID })
  await MaintenanceWindow.deleteMany({ operatorId: OPERATOR_ID })
  console.log('Cleared existing maintenance data')

  // Seed check types
  for (const ct of CHECK_TYPES) {
    await MaintenanceCheckType.create({
      _id: crypto.randomUUID(),
      operatorId: OPERATOR_ID,
      ...ct,
      applicableAircraftTypeIds: ct.applicableAircraftTypeIds ?? [],
      resetsCheckCodes: ct.resetsCheckCodes ?? null,
      amosCode: null,
      isActive: true,
      createdAt: now,
    })
  }
  console.log(`Seeded ${CHECK_TYPES.length} maintenance check types`)

  // Seed maintenance windows
  for (const w of WINDOWS) {
    // Compute duration
    const [sh, sm] = w.windowStartUtc.split(':').map(Number)
    const [eh, em] = w.windowEndUtc.split(':').map(Number)
    const startMin = sh * 60 + sm
    let endMin = eh * 60 + em
    if (endMin <= startMin) endMin += 24 * 60
    const duration = Math.round(((endMin - startMin) / 60) * 100) / 100

    await MaintenanceWindow.create({
      _id: crypto.randomUUID(),
      operatorId: OPERATOR_ID,
      base: w.base,
      windowStartUtc: w.windowStartUtc,
      windowEndUtc: w.windowEndUtc,
      windowDurationHours: duration,
      isManualOverride: false,
      notes: w.notes,
      createdAt: now,
    })
  }
  console.log(`Seeded ${WINDOWS.length} maintenance windows`)

  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
