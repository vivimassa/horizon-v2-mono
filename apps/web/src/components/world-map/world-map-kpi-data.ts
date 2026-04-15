// ─── KPI computation helpers (pure functions, no React) ─────────
import type { WorldMapFlight, OtpKpi, FuelKpi, TatKpi, LoadFactorKpi } from './world-map-types'

// ─── Helpers ────────────────────────────────────────────────────

/** Parse HH:MM on a given date to a UTC timestamp in ms */
function hhmmToMs(hhmm: string, dateStr: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCHours(h, m, 0, 0)
  return d.getTime()
}

/** Check if a flight has departed (real-time: only count flights that are in-progress or completed) */
function hasDeparted(f: WorldMapFlight): boolean {
  return (
    f.flightPhase === 'departed' ||
    f.flightPhase === 'airborne' ||
    f.flightPhase === 'landed' ||
    f.flightPhase === 'arrived' ||
    f.actualOut != null
  )
}

/** Delay in minutes: actual arrival minus scheduled arrival, clamped >= 0 */
function arrivalDelayMinutes(f: WorldMapFlight): number | null {
  const arrTime = f.actualIn || f.actualOn
  if (!arrTime || !f.staUtc) return null
  const actual = hhmmToMs(arrTime, f.instanceDate)
  const scheduled = hhmmToMs(f.staUtc, f.instanceDate)
  // Handle midnight crossover: if actual < scheduled by >12h, assume next day
  let diff = (actual - scheduled) / 60_000
  if (diff < -720) diff += 1440
  return Math.max(0, Math.round(diff))
}

/** Projected arrival delay for in-flight legs: at-least the departure delay. */
function departureDelayMinutes(f: WorldMapFlight): number | null {
  const depTime = f.actualOff || f.actualOut
  if (!depTime || !f.stdUtc) return null
  const actual = hhmmToMs(depTime, f.instanceDate)
  const scheduled = hhmmToMs(f.stdUtc, f.instanceDate)
  let diff = (actual - scheduled) / 60_000
  if (diff < -720) diff += 1440
  return Math.max(0, Math.round(diff))
}

// ─── OTP KPI ────────────────────────────────────────────────────

export function computeOtpKpi(flights: WorldMapFlight[]): OtpKpi {
  const today = todayUtcStr()
  // Today's flights that have at least departed — arrival delay is known
  // for landed legs, projected from departure delay for in-flight legs.
  const tracked = flights.filter(
    (f) => f.instanceDate === today && (f.actualIn != null || f.actualOut != null || f.actualOff != null),
  )

  let onTime = 0
  let d15to30 = 0
  let d30to60 = 0
  let d60plus = 0
  let totalDelayMin = 0
  let delayedCount = 0
  let worstDelay = 0
  let worstFlight = ''

  for (const f of tracked) {
    const delay = arrivalDelayMinutes(f) ?? departureDelayMinutes(f)
    if (delay == null) continue

    if (delay <= 15) {
      onTime++
    } else if (delay <= 30) {
      d15to30++
      totalDelayMin += delay
      delayedCount++
    } else if (delay <= 60) {
      d30to60++
      totalDelayMin += delay
      delayedCount++
    } else {
      d60plus++
      totalDelayMin += delay
      delayedCount++
    }

    if (delay > worstDelay) {
      worstDelay = delay
      worstFlight = f.flightNumber
    }
  }

  const total = tracked.length
  const otpPct = total > 0 ? (onTime / total) * 100 : 0

  return {
    totalCompleted: total,
    onTimeCount: onTime,
    delay15to30: d15to30,
    delay30to60: d30to60,
    delay60plus: d60plus,
    otpPercent: Math.round(otpPct * 10) / 10,
    avgDelayMinutes: delayedCount > 0 ? Math.round(totalDelayMin / delayedCount) : 0,
    worstDelayFlight: worstDelay > 15 ? { flightNumber: worstFlight, minutes: worstDelay } : null,
  }
}

// ─── Fuel KPI ───────────────────────────────────────────────────

/** Current UTC operating date as YYYY-MM-DD. */
function todayUtcStr(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function computeFuelKpi(flights: WorldMapFlight[]): FuelKpi {
  const today = todayUtcStr()
  // Scope to flights operating today (UTC) that have departed — plan is
  // known pre-flight, actual-burn is only meaningful once the leg completes
  // (the "withBurnAndPlan" filter below gates plan-vs-actual metrics on that).
  const pastToday = flights.filter(
    (f) => f.instanceDate === today && (f.actualOut != null || f.actualOff != null || f.actualIn != null),
  )

  // All departed-today flights with any fuel data (for uplift counting)
  const withFuel = pastToday.filter((f) => {
    const burn = Number(f.fuelData?.BURN) || 0
    const plan = Number(f.fuelData?.FPLN) || 0
    return burn > 0 || plan > 0
  })

  // Only completed flights (BURN + FPLN both present) for plan-vs-actual metrics
  const withBurnAndPlan = withFuel.filter((f) => {
    const burn = Number(f.fuelData?.BURN) || 0
    const plan = Number(f.fuelData?.FPLN) || 0
    return burn > 0 && plan > 0
  })

  let totalBurn = 0
  let totalPlan = 0
  let totalUplift = 0
  let upliftCount = 0
  let overBurnCount = 0

  // Accumulate by aircraft type (only completed flights)
  const burnByTypeMap = new Map<string, { totalBurn: number; totalPlan: number; count: number }>()

  for (const f of withBurnAndPlan) {
    const burn = Number(f.fuelData?.BURN) || 0
    const plan = Number(f.fuelData?.FPLN) || 0

    totalBurn += burn
    totalPlan += plan

    if (burn > plan * 1.05) {
      overBurnCount++
    }

    const acType = f.aircraftTypeIcao || 'Unknown'
    const entry = burnByTypeMap.get(acType) || { totalBurn: 0, totalPlan: 0, count: 0 }
    entry.totalBurn += burn
    entry.totalPlan += plan
    entry.count++
    burnByTypeMap.set(acType, entry)
  }

  // Uplift: count from all flights with fuel data (including in-flight)
  for (const f of withFuel) {
    const uplift = Number(f.fuelData?.UPLF) || 0
    if (uplift > 0) {
      totalUplift += uplift
      upliftCount++
    }
  }

  const planVsActualPct = totalPlan > 0 ? Math.round(((totalBurn - totalPlan) / totalPlan) * 1000) / 10 : 0

  const burnByType = Array.from(burnByTypeMap.entries())
    .map(([acType, d]) => ({
      acType,
      avgBurn: d.count > 0 ? Math.round(d.totalBurn / d.count) : 0,
      avgPlan: d.count > 0 ? Math.round(d.totalPlan / d.count) : 0,
    }))
    .sort((a, b) => a.acType.localeCompare(b.acType))

  return {
    planVsActualPct,
    avgUpliftKg: upliftCount > 0 ? Math.round(totalUplift / upliftCount) : 0,
    overBurnCount,
    totalFlightsWithFuel: withBurnAndPlan.length,
    burnByType,
  }
}

// ─── TAT KPI ────────────────────────────────────────────────────

const TAT_TARGET_MINUTES = 45
const TAT_MAX_MINUTES = 180 // ground time > 3h = night stop, excluded from TAT

export function computeTatKpi(flights: WorldMapFlight[], tatTargetMin = 45): TatKpi {
  // Compute ground time at each station by looking at consecutive flights
  // for the same tail number at the same station
  const byTail = new Map<string, WorldMapFlight[]>()
  for (const f of flights) {
    if (!f.tailNumber || !hasDeparted(f)) continue
    const arr = byTail.get(f.tailNumber) || []
    arr.push(f)
    byTail.set(f.tailNumber, arr)
  }

  interface TatEntry {
    station: string
    minutes: number
    flightNumber: string
  }

  const tatEntries: TatEntry[] = []

  for (const [, tailFlights] of byTail) {
    // Sort by STD
    const sorted = [...tailFlights].sort((a, b) => {
      const aMs = hhmmToMs(a.stdUtc, a.instanceDate)
      const bMs = hhmmToMs(b.stdUtc, b.instanceDate)
      return aMs - bMs
    })

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]

      // Station match: previous arrival station = current departure station
      if (prev.arrStation !== curr.depStation) continue

      const prevArr = prev.actualIn || prev.actualOn
      const currDep = curr.actualOut || curr.actualOff

      if (!prevArr || !currDep) {
        // Fall back to scheduled times
        const arrMs = hhmmToMs(prev.staUtc, prev.instanceDate)
        const depMs = hhmmToMs(curr.stdUtc, curr.instanceDate)
        let groundMin = (depMs - arrMs) / 60_000
        if (groundMin < -720) groundMin += 1440
        if (groundMin > 0 && groundMin <= TAT_MAX_MINUTES) {
          tatEntries.push({
            station: curr.depStation,
            minutes: Math.round(groundMin),
            flightNumber: curr.flightNumber,
          })
        }
        continue
      }

      const arrMs = hhmmToMs(prevArr, prev.instanceDate)
      const depMs = hhmmToMs(currDep, curr.instanceDate)
      let groundMin = (depMs - arrMs) / 60_000
      if (groundMin < -720) groundMin += 1440
      if (groundMin > 0 && groundMin <= TAT_MAX_MINUTES) {
        tatEntries.push({
          station: curr.depStation,
          minutes: Math.round(groundMin),
          flightNumber: curr.flightNumber,
        })
      }
    }
  }

  const avgGround =
    tatEntries.length > 0 ? Math.round(tatEntries.reduce((s, e) => s + e.minutes, 0) / tatEntries.length) : 0

  const breaches = tatEntries.filter((e) => e.minutes > tatTargetMin).length

  // Distribution buckets
  const buckets = [
    { label: '<30m', min: 0, max: 30 },
    { label: '30-60m', min: 30, max: 60 },
    { label: '60-90m', min: 60, max: 90 },
    { label: '>90m', min: 90, max: Infinity },
  ]
  const distribution = buckets.map((b) => ({
    label: b.label,
    count: tatEntries.filter((e) => e.minutes >= b.min && e.minutes < b.max).length,
  }))

  // Worst TAT
  let worst: TatEntry | null = null
  for (const e of tatEntries) {
    if (!worst || e.minutes > worst.minutes) worst = e
  }

  return {
    avgGroundMinutes: avgGround,
    breachCount: breaches,
    distribution,
    worstTat: worst ? { station: worst.station, minutes: worst.minutes, flightNumber: worst.flightNumber } : null,
    hasRotationData: tatEntries.length > 0,
  }
}

// ─── Load Factor KPI ────────────────────────────────────────────

export function computeLoadFactorKpi(flights: WorldMapFlight[]): LoadFactorKpi {
  const withLf = flights.filter((f) => hasDeparted(f) && f.loadFactor != null && f.loadFactor > 0)

  let totalLf = 0
  let below80 = 0
  let above95 = 0
  let totalPax = 0

  const lfByTypeMap = new Map<string, { totalLf: number; count: number }>()

  for (const f of withLf) {
    const lf = f.loadFactor!
    totalLf += lf
    if (lf < 80) below80++
    if (lf > 95) above95++
    totalPax += f.paxTotal

    const acType = f.aircraftTypeIcao || 'Unknown'
    const entry = lfByTypeMap.get(acType) || { totalLf: 0, count: 0 }
    entry.totalLf += lf
    entry.count++
    lfByTypeMap.set(acType, entry)
  }

  // Also count pax from departed flights without LF
  for (const f of flights) {
    if (!hasDeparted(f)) continue
    if (f.loadFactor != null && f.loadFactor > 0) continue
    totalPax += f.paxTotal
  }

  const fleetAvg = withLf.length > 0 ? Math.round((totalLf / withLf.length) * 10) / 10 : 0

  const lfByType = Array.from(lfByTypeMap.entries())
    .map(([acType, d]) => ({
      acType,
      avgLf: d.count > 0 ? Math.round((d.totalLf / d.count) * 10) / 10 : 0,
      count: d.count,
    }))
    .sort((a, b) => a.acType.localeCompare(b.acType))

  return {
    fleetAvgLf: fleetAvg,
    lfByType,
    below80Count: below80,
    above95Count: above95,
    totalRevenuePax: totalPax,
  }
}
