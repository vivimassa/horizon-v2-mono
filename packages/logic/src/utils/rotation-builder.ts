/**
 * Rotation builder for SSIM Import.
 *
 * Given an array of parsed SSIM flight legs, groups them into rotations by
 * walking the OFR (onward flight reference: nextAirlineCode + nextFlightNumber)
 * chains and assigns shared rotationId + sequential rotationSequence per leg.
 *
 * Chain-matching criteria (ported from V1 app/actions/ssim-import.ts):
 *   1. The candidate leg's airlineCode+flightNumber matches the current
 *      leg's nextAirlineCode (or same airline if null) + nextFlightNumber.
 *   2. Same aircraftType (IATA code).
 *   3. Candidate's depStation equals current's arrStation.
 *   4. Candidate's period overlaps current's period.
 *   5. At least one shared day-of-operation.
 *
 * The chain head is a flight that (a) has an OFR, and (b) is not the target
 * of any other flight's OFR. Once walked, chain legs are marked consumed.
 *
 * Legs that don't become part of a ≥ 2-leg chain are left with
 * rotationId = null, rotationSequence = null.
 */

import { randomUUID } from 'node:crypto'

/**
 * Minimal shape needed to build rotations. A superset of SSIMFlightLeg.
 * Callers can pass SSIMFlightLeg[] directly.
 */
export interface RotationInputLeg {
  airlineCode: string
  flightNumber: number
  depStation: string
  arrStation: string
  aircraftType: string
  periodStart: string // ISO YYYY-MM-DD
  periodEnd: string // ISO YYYY-MM-DD
  daysOfOperation: string // "1234567" with spaces for non-ops
  stdUtc: string // HHMM
  staUtc: string // HHMM
  nextAirlineCode: string | null
  nextFlightNumber: number | null
}

export interface AssignedRotation {
  rotationId: string | null
  rotationSequence: number | null
  rotationLabel: string | null
}

/** Helper: key identifying a flight by airline code + numeric flight number. */
function flightKey(airlineCode: string, flightNumber: number): string {
  return `${airlineCode}_${flightNumber}`
}

/** Return true if two days-of-operation strings share at least one operating day. */
function sharesOperatingDay(a: string, b: string): boolean {
  for (let i = 0; i < 7; i++) {
    const da = a[i]
    const db = b[i]
    const okA = da && da !== ' ' && da !== '0'
    const okB = db && db !== ' ' && db !== '0'
    if (okA && okB) return true
  }
  return false
}

/** Build a "SGN-HAN-SGN" style label from a rotation's legs. */
function buildRotationLabel(legs: RotationInputLeg[]): string {
  if (legs.length === 0) return ''
  const stops = legs.map((l) => l.depStation)
  stops.push(legs[legs.length - 1].arrStation)
  return stops.join('-')
}

/**
 * Result of `buildRotations`. Aligns 1-1 with the input array by index.
 * For single-leg mode, every entry is `{ rotationId: null, ... }`.
 */
export type BuildRotationsResult = AssignedRotation[]

export type RotationMode = 'single-leg' | 'combine-ofr'

/**
 * Compute rotation assignment for every input leg.
 *
 * - `single-leg`: no-op, every leg gets `null` rotation fields.
 * - `combine-ofr`: walks OFR chains, assigns a shared rotationId +
 *    rotationSequence (1-based) per leg, rotationLabel = station chain.
 */
export function buildRotations(legs: RotationInputLeg[], mode: RotationMode): BuildRotationsResult {
  const result: BuildRotationsResult = legs.map(() => ({
    rotationId: null,
    rotationSequence: null,
    rotationLabel: null,
  }))

  if (mode === 'single-leg' || legs.length === 0) return result

  // Index legs by airline + flight number for fast lookup.
  const byKey = new Map<string, number[]>()
  legs.forEach((l, i) => {
    const k = flightKey(l.airlineCode, l.flightNumber)
    const arr = byKey.get(k) ?? []
    arr.push(i)
    byKey.set(k, arr)
  })

  // Identify flights that ARE the target of some other flight's OFR —
  // these cannot be chain heads.
  const targetedKeys = new Set<string>()
  for (const l of legs) {
    if (l.nextFlightNumber !== null) {
      const nextAirline = l.nextAirlineCode || l.airlineCode
      targetedKeys.add(flightKey(nextAirline, l.nextFlightNumber))
    }
  }

  // A chain head has an OFR but is not targeted.
  const headIdxs: number[] = []
  legs.forEach((l, i) => {
    if (l.nextFlightNumber === null) return
    const selfKey = flightKey(l.airlineCode, l.flightNumber)
    if (targetedKeys.has(selfKey)) return
    headIdxs.push(i)
  })

  const consumed = new Set<number>()

  for (const headIdx of headIdxs) {
    if (consumed.has(headIdx)) continue

    const chainIdxs: number[] = [headIdx]
    const visited = new Set<number>([headIdx])
    let currentIdx = headIdx

    while (true) {
      const current = legs[currentIdx]
      if (current.nextFlightNumber === null) break
      const nextAirline = current.nextAirlineCode || current.airlineCode
      const candidateIdxs = byKey.get(flightKey(nextAirline, current.nextFlightNumber)) ?? []

      let chosen = -1
      for (const ci of candidateIdxs) {
        if (visited.has(ci) || consumed.has(ci)) continue
        const c = legs[ci]
        if (c.aircraftType !== current.aircraftType) continue
        if (c.depStation !== current.arrStation) continue
        // Period overlap (inclusive).
        if (c.periodStart > current.periodEnd || c.periodEnd < current.periodStart) continue
        if (!sharesOperatingDay(current.daysOfOperation, c.daysOfOperation)) continue
        chosen = ci
        break
      }

      if (chosen < 0) break
      chainIdxs.push(chosen)
      visited.add(chosen)
      currentIdx = chosen
    }

    if (chainIdxs.length < 2) continue

    const rotationId = randomUUID()
    const chainLegs = chainIdxs.map((i) => legs[i])
    const label = buildRotationLabel(chainLegs)

    chainIdxs.forEach((i, seq) => {
      consumed.add(i)
      result[i] = {
        rotationId,
        rotationSequence: seq + 1,
        rotationLabel: label,
      }
    })
  }

  return result
}
