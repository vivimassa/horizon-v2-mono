/**
 * Seed fuel + cargo on FlightInstances.
 *
 * Fuel (per aircraft registration fuel burn rate, based on actual block time):
 *   - Burn       = blockHours * fuelBurnRateKgPerHour * variance(0.97..1.05)
 *   - FlightPlan = scheduledBlockHours * fuelBurnRateKgPerHour * variance(0.98..1.03)
 *   - Reserves   = final_reserve(30min) + alternate(45min) + contingency(5% trip) + taxi(200kg)
 *   - Initial    = previous flight's remaining fuel (or minRequired + top-up on first leg)
 *   - Uplift     = max(0, minRequired - prevRemaining) + small operational top-up
 *   - Initial+Uplift capped by performance.maxFuelCapacityKg
 *
 * Cargo (AircraftType.cargo.maxCargoWeightKg per airframe type):
 *   - Baggage    = sum(pax * bag weight per class) with 1.0..1.3 pieces per pax
 *   - Cargo+Mail = fill remainder so Baggage+Cargo+Mail ~= 85..90% of maxCargoWeight
 *   - Split 80..85% cargo vs 15..20% mail
 *
 * Usage: npx tsx src/seed-fuel-cargo.ts [--from=YYYY-MM-DD] [--operator=<id>] [--dry]
 */
import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import mongoose from 'mongoose'
import { FlightInstance } from './models/FlightInstance.js'

const args = process.argv.slice(2)
const getArg = (name: string, fallback?: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : fallback
}

const OPERATOR_ID = getArg('operator', '20169cc0-c914-4662-a300-1dbbe20d1416')!
const FROM_DATE = getArg('from', '2000-01-01')!
const DRY = args.includes('--dry')

const HOUR_MS = 3600 * 1000
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const round10 = (n: number) => Math.round(n / 10) * 10

type Reg = {
  _id: string
  registration: string
  aircraftTypeId: string
  fuelBurnRateKgPerHour: number | null
  performance?: { maxFuelCapacityKg: number | null }
}

type TypeDoc = {
  _id: string
  icaoType: string
  fuelBurnRateKgPerHour: number | null
  cargo?: { maxCargoWeightKg: number | null }
  performance?: { maxFuelCapacityKg: number | null }
}

async function run() {
  await connectDB(env.MONGODB_URI)
  console.log(`[fuel-cargo] operator=${OPERATOR_ID} from=${FROM_DATE} dry=${DRY}`)

  const regCol = mongoose.connection.collection<Reg>('aircraftRegistrations')
  const typeCol = mongoose.connection.collection<TypeDoc>('aircraftTypes')
  const schedCol = mongoose.connection.collection('scheduledFlights')

  const regs = await regCol.find({ operatorId: OPERATOR_ID, isActive: true }).toArray()
  const types = await typeCol.find({ operatorId: OPERATOR_ID }).toArray()
  const typeById = new Map(types.map((t) => [t._id, t]))

  // Pool registrations per aircraftTypeId (sorted by registration for determinism)
  const regsByType = new Map<string, Reg[]>()
  for (const r of regs) {
    if (!regsByType.has(r.aircraftTypeId)) regsByType.set(r.aircraftTypeId, [])
    regsByType.get(r.aircraftTypeId)!.push(r)
  }
  for (const pool of regsByType.values()) pool.sort((a, b) => a.registration.localeCompare(b.registration))

  // Get all rotations + their type, sort by label
  const rotations = await schedCol
    .aggregate([
      { $match: { operatorId: OPERATOR_ID } },
      {
        $group: {
          _id: '$rotationId',
          label: { $first: '$rotationLabel' },
          icao: { $first: '$aircraftTypeIcao' },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { label: 1 } },
    ])
    .toArray()

  // icaoType → aircraftTypeId (pick first match for operator)
  const typeByIcao = new Map<string, TypeDoc>()
  for (const t of types) if (!typeByIcao.has(t.icaoType)) typeByIcao.set(t.icaoType, t)

  // Assign each rotation to a registration (round-robin within its type pool)
  const regByRotation = new Map<string, Reg>()
  const cursorByType = new Map<string, number>()
  for (const rot of rotations) {
    const icao = rot.icao as string | null
    if (!icao) continue
    const type = typeByIcao.get(icao)
    if (!type) continue
    const pool = regsByType.get(type._id) || []
    if (!pool.length) continue
    const idx = (cursorByType.get(type._id) || 0) % pool.length
    cursorByType.set(type._id, idx + 1)
    regByRotation.set(rot._id as string, pool[idx])
  }
  console.log(`[fuel-cargo] rotations=${rotations.length} assignedRegs=${regByRotation.size}`)

  // Scheduled → rotation
  const scheds = await schedCol
    .find({ operatorId: OPERATOR_ID }, { projection: { _id: 1, rotationId: 1, aircraftTypeIcao: 1 } })
    .toArray()
  const rotBySched = new Map<string, string>()
  const icaoBySched = new Map<string, string>()
  for (const s of scheds) {
    if (s.rotationId) rotBySched.set(s._id as string, s.rotationId as string)
    if (s.aircraftTypeIcao) icaoBySched.set(s._id as string, s.aircraftTypeIcao as string)
  }

  // Load all flight instances in scope
  const flights = await FlightInstance.find({
    operatorId: OPERATOR_ID,
    operatingDate: { $gte: FROM_DATE },
  })
    .select({
      _id: 1,
      scheduledFlightId: 1,
      operatingDate: 1,
      'schedule.stdUtc': 1,
      'schedule.staUtc': 1,
      'actual.atdUtc': 1,
      'actual.ataUtc': 1,
      'tail.icaoType': 1,
      pax: 1,
    })
    .lean()

  console.log(`[fuel-cargo] loaded ${flights.length} flights`)

  // Group by rotationId so we can carry fuel across the chain.
  const chains = new Map<string, typeof flights>()
  const orphans: typeof flights = []
  for (const f of flights) {
    const rot = f.scheduledFlightId ? rotBySched.get(f.scheduledFlightId) : null
    if (rot && regByRotation.has(rot)) {
      if (!chains.has(rot)) chains.set(rot, [])
      chains.get(rot)!.push(f)
    } else {
      orphans.push(f)
    }
  }
  console.log(`[fuel-cargo] chains=${chains.size} orphans=${orphans.length}`)

  const ops: Array<{ updateOne: { filter: { _id: string }; update: Record<string, unknown> } }> = []
  let seededFuel = 0
  let seededCargo = 0

  function buildCargo(
    pax:
      | {
          adultActual?: number | null
          childActual?: number | null
          infantActual?: number | null
          adultExpected?: number | null
          childExpected?: number | null
          infantExpected?: number | null
        }
      | null
      | undefined,
    maxCargoKg: number | null,
  ) {
    if (!maxCargoKg || maxCargoKg <= 0) return null
    const adults = pax?.adultActual ?? pax?.adultExpected ?? 0
    const children = pax?.childActual ?? pax?.childExpected ?? 0
    const infants = pax?.infantActual ?? pax?.infantExpected ?? 0

    // Baggage weight per pax class (kg) — realistic short/medium-haul averages
    const bagPerAdult = rand(15, 20)
    const bagPerChild = rand(8, 12)
    const bagPerInfant = rand(2, 4)
    const baggageKg = adults * bagPerAdult + children * bagPerChild + infants * bagPerInfant
    const totalPax = adults + children + infants
    const baggagePieces = Math.round(totalPax * rand(1.0, 1.3))

    // Target total hold load: 85–90% of max cargo weight
    const targetLoadFactor = rand(0.85, 0.9)
    const targetTotalKg = maxCargoKg * targetLoadFactor
    const cargoMailKg = Math.max(0, targetTotalKg - baggageKg)

    // Split cargo vs mail
    const cargoShare = rand(0.8, 0.85)
    const cargoKg = cargoMailKg * cargoShare
    const mailKg = cargoMailKg - cargoKg

    // Pieces: cargo avg ~80 kg/piece (ULD content), mail ~25 kg/piece
    const cargoPieces = Math.round(cargoKg / 80)
    const mailPieces = Math.round(mailKg / 25)

    return [
      { category: 'Baggage', weight: round10(baggageKg), pieces: baggagePieces },
      { category: 'Cargo', weight: round10(cargoKg), pieces: cargoPieces },
      { category: 'Mail', weight: round10(mailKg), pieces: mailPieces },
    ]
  }

  function buildFuel(
    reg: Reg | null,
    type: TypeDoc | null,
    blockHours: number | null,
    scheduledBlockHours: number,
    prevRemaining: number | null,
  ): { fuel: { initial: number; uplift: number; burn: number; flightPlan: number } | null; remaining: number | null } {
    const fbr = reg?.fuelBurnRateKgPerHour ?? type?.fuelBurnRateKgPerHour ?? null
    const maxCap = reg?.performance?.maxFuelCapacityKg ?? type?.performance?.maxFuelCapacityKg ?? null
    if (!fbr || !maxCap || !blockHours || blockHours <= 0) return { fuel: null, remaining: null }

    const burn = blockHours * fbr * rand(0.97, 1.05)
    const flightPlan = scheduledBlockHours * fbr * rand(0.98, 1.03)

    const finalReserve = 0.5 * fbr
    const alternate = 0.75 * fbr
    const contingency = 0.05 * burn
    const taxi = 200
    const minRequired = burn + finalReserve + alternate + contingency + taxi

    let initial: number
    let uplift: number
    if (prevRemaining != null && prevRemaining > 0) {
      initial = prevRemaining
      if (prevRemaining < minRequired) {
        uplift = minRequired - prevRemaining + rand(200, 800)
      } else {
        // Small operational top-up ~20% of flights, otherwise no uplift
        uplift = Math.random() < 0.2 ? rand(100, 500) : 0
      }
    } else {
      // First leg of day — start with a realistic initial, no prior remaining
      initial = rand(300, 700) // leftover in tanks
      uplift = minRequired - initial + rand(300, 900)
    }

    // Cap by tank capacity
    if (initial + uplift > maxCap) uplift = Math.max(0, maxCap - initial)

    const remaining = initial + uplift - burn
    return {
      fuel: {
        initial: round10(initial),
        uplift: round10(uplift),
        burn: round10(burn),
        flightPlan: round10(flightPlan),
      },
      remaining,
    }
  }

  function pushOp(flightId: string, $set: Record<string, unknown>, regName: string | null) {
    if (regName) $set['tail.registration'] = regName
    ;($set['syncMeta.updatedAt'] as number) = Date.now()
    ops.push({
      updateOne: {
        filter: { _id: flightId },
        update: { $set, $inc: { 'syncMeta.version': 1 } },
      },
    })
  }

  // Process chains
  for (const [rotId, list] of chains) {
    const reg = regByRotation.get(rotId)!
    const type = typeById.get(reg.aircraftTypeId) || null
    const maxCargoKg = type?.cargo?.maxCargoWeightKg ?? null

    list.sort((a, b) => (a.schedule?.stdUtc ?? 0) - (b.schedule?.stdUtc ?? 0))

    let remaining: number | null = null
    for (const f of list) {
      const atd = f.actual?.atdUtc ?? null
      const ata = f.actual?.ataUtc ?? null
      const std = f.schedule?.stdUtc ?? null
      const sta = f.schedule?.staUtc ?? null

      const blockHours = atd && ata ? (ata - atd) / HOUR_MS : null
      const schedBlockHours = std && sta ? (sta - std) / HOUR_MS : 0

      const { fuel, remaining: newRemaining } = buildFuel(reg, type, blockHours, schedBlockHours, remaining)
      const cargo = buildCargo(f.pax, maxCargoKg)

      const set: Record<string, unknown> = {}
      if (fuel) {
        set['fuel.initial'] = fuel.initial
        set['fuel.uplift'] = fuel.uplift
        set['fuel.burn'] = fuel.burn
        set['fuel.flightPlan'] = fuel.flightPlan
        seededFuel++
      }
      if (cargo) {
        set.cargo = cargo
        seededCargo++
      }
      if (Object.keys(set).length === 0) {
        remaining = null
        continue
      }
      pushOp(f._id as string, set, reg.registration)
      remaining = newRemaining
    }
  }

  // Orphans — cargo only (no fuel chain)
  for (const f of orphans) {
    const icao = f.tail?.icaoType || (f.scheduledFlightId ? icaoBySched.get(f.scheduledFlightId) : null) || null
    const type = icao ? typeByIcao.get(icao) : null
    const maxCargoKg = type?.cargo?.maxCargoWeightKg ?? null
    const cargo = buildCargo(f.pax, maxCargoKg)
    if (!cargo) continue
    pushOp(f._id as string, { cargo }, null)
    seededCargo++
  }

  console.log(`[fuel-cargo] will update flights=${ops.length} (fuel=${seededFuel} cargo=${seededCargo})`)

  if (DRY) {
    console.log('[fuel-cargo] dry run — no writes')
    process.exit(0)
  }

  const CHUNK = 500
  for (let i = 0; i < ops.length; i += CHUNK) {
    const slice = ops.slice(i, i + CHUNK)
    const res = await FlightInstance.bulkWrite(slice, { ordered: false })
    console.log(`[fuel-cargo] bulk ${i}-${i + slice.length}: matched=${res.matchedCount} modified=${res.modifiedCount}`)
  }

  console.log('[fuel-cargo] done')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
