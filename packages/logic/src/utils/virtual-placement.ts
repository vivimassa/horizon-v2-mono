/**
 * Virtual Flight Placement
 *
 * Distributes unassigned flights across aircraft rows of matching type
 * using a lightweight greedy station-continuity algorithm with
 * BIDIRECTIONAL chaining (forward + backward).
 *
 * **Route-aware**: flights sharing a `routeId` (from SSIM onward flight
 * references / aircraft_route_legs) are grouped into atomic blocks and
 * placed together on the same aircraft row. This ensures OFR chains like
 * 142→143→144→145→146→147 always sit on the same lane in the Gantt.
 *
 * These placements are DISPLAY-ONLY — never persisted to DB.
 */

export interface VirtualPlacementFlight {
  id: string
  depStation: string
  arrStation: string
  aircraftTypeIcao: string | null
  date: Date
  stdMinutes: number
  staMinutes: number
  blockMinutes: number
  /** Full UTC timestamp (ISO string) for absolute time comparison */
  stdUtcTs?: string
  /** Route FK — flights sharing a routeId form an atomic placement block */
  routeId?: string | null
  /** Day offset within route (0 = first leg day, 1 = next day, ...) */
  dayOffset?: number
}

/** Get absolute UTC start time in milliseconds. Prefers stdUtcTs when available. */
function flightStartMs(f: VirtualPlacementFlight): number {
  if (f.stdUtcTs) return new Date(f.stdUtcTs).getTime()
  return f.date.getTime() + f.stdMinutes * 60000 // fallback
}

/** Get absolute UTC end time in milliseconds. */
function flightEndMs(f: VirtualPlacementFlight): number {
  return flightStartMs(f) + f.blockMinutes * 60000
}

interface AircraftSlot {
  registration: string
  icaoType: string
  windows: { startMs: number; endMs: number }[] // ALL assigned time windows (absolute UTC ms)
  // Forward chain tracking (last flight on this aircraft)
  lastArr: string | null
  lastStaMinutes: number
  lastDate: number // epoch ms
  // Backward chain tracking (first flight on this aircraft)
  firstDep: string | null
  firstStdMinutes: number
  firstDate: number // epoch ms (Infinity when no flights)
}

// ─── Placement block (atomic unit) ────────────────────────────────

interface PlacementBlock {
  id: string
  flights: VirtualPlacementFlight[] // sorted chronologically
  depStation: string   // first flight's departure
  arrStation: string   // last flight's arrival
  startDateMs: number  // earliest date epoch
  endDateMs: number    // latest date epoch
  startStd: number     // earliest STD minutes
  endSta: number       // latest STA minutes
}

/**
 * Build atomic placement blocks from flights.
 * Flights with the same routeId + base date form a block.
 * Standalone flights (no routeId) become single-flight blocks.
 */
function buildPlacementBlocks(flights: VirtualPlacementFlight[]): PlacementBlock[] {
  const blockMap = new Map<string, VirtualPlacementFlight[]>()

  for (const f of flights) {
    let key: string
    if (f.routeId) {
      // Compute the operating cycle's base date by subtracting dayOffset
      const dayOff = f.dayOffset ?? 0
      const baseDateMs = f.date.getTime() - dayOff * 86400000
      const baseDate = new Date(baseDateMs).toISOString().slice(0, 10)
      key = `route_${f.routeId}_${baseDate}`
    } else {
      key = `standalone_${f.id}`
    }
    const list = blockMap.get(key) || []
    list.push(f)
    blockMap.set(key, list)
  }

  const blocks: PlacementBlock[] = []
  for (const [id, blockFlights] of blockMap) {
    // Sort flights within block chronologically
    blockFlights.sort((a, b) => {
      const dd = a.date.getTime() - b.date.getTime()
      if (dd !== 0) return dd
      return a.stdMinutes - b.stdMinutes
    })

    const first = blockFlights[0]
    const last = blockFlights[blockFlights.length - 1]

    blocks.push({
      id,
      flights: blockFlights,
      depStation: first.depStation,
      arrStation: last.arrStation,
      startDateMs: first.date.getTime(),
      endDateMs: last.date.getTime(),
      startStd: first.stdMinutes,
      endSta: last.staMinutes,
    })
  }

  return blocks
}

/**
 * Check if ANY flight in a block overlaps any existing window on a slot.
 * Uses absolute UTC milliseconds — safe for cross-midnight UTC flights.
 */
function blockHasTimeOverlap(
  slot: AircraftSlot,
  block: PlacementBlock,
  tatMs: number,
): boolean {
  for (const f of block.flights) {
    const fStart = flightStartMs(f)
    const fEnd = flightEndMs(f)
    for (const w of slot.windows) {
      if (fStart < w.endMs + tatMs && w.startMs < fEnd + tatMs) {
        return true
      }
    }
  }
  return false
}

/**
 * Check if a single flight overlaps any existing window on an aircraft slot.
 * Uses absolute UTC milliseconds.
 */
function hasTimeOverlap(
  slot: AircraftSlot,
  f: VirtualPlacementFlight,
  tatMs: number,
): boolean {
  const fStart = flightStartMs(f)
  const fEnd = flightEndMs(f)
  for (const w of slot.windows) {
    if (fStart < w.endMs + tatMs && w.startMs < fEnd + tatMs) {
      return true
    }
  }
  return false
}

/**
 * Place all flights in a block on a slot and update forward+backward tracking.
 */
function placeBlockOnSlot(
  slot: AircraftSlot,
  block: PlacementBlock,
  placements: Map<string, string>,
): void {
  for (const f of block.flights) {
    placeOnSlot(slot, f, placements)
  }
}

/**
 * Place a single flight on a slot and update forward+backward tracking.
 */
function placeOnSlot(
  slot: AircraftSlot,
  flight: VirtualPlacementFlight,
  placements: Map<string, string>,
): void {
  const fDateMs = flight.date.getTime()
  placements.set(flight.id, slot.registration)
  slot.windows.push({ startMs: flightStartMs(flight), endMs: flightEndMs(flight) })

  // Update forward tracking (last flight)
  if (fDateMs > slot.lastDate || (fDateMs === slot.lastDate && flight.staMinutes > slot.lastStaMinutes)) {
    slot.lastArr = flight.arrStation
    slot.lastStaMinutes = flight.staMinutes
    slot.lastDate = fDateMs
  }

  // Update backward tracking (first flight)
  if (fDateMs < slot.firstDate || (fDateMs === slot.firstDate && flight.stdMinutes < slot.firstStdMinutes)) {
    slot.firstDep = flight.depStation
    slot.firstStdMinutes = flight.stdMinutes
    slot.firstDate = fDateMs
  }
}

/**
 * Distribute unassigned flights across aircraft of matching type
 * using route-aware atomic blocks + bidirectional station continuity.
 * Returns a Map<expandedFlightId, registration>.
 */
export function computeVirtualPlacements(
  unassignedFlights: VirtualPlacementFlight[],
  aircraftByType: Map<string, { registration: string; icaoType: string }[]>,
  assignedFlightsByReg: Map<string, VirtualPlacementFlight[]>,
  defaultTatMinutes: number = 30,
): Map<string, string> {
  const placements = new Map<string, string>()

  // Group unassigned flights by AC type
  const byType = new Map<string, VirtualPlacementFlight[]>()
  for (const f of unassignedFlights) {
    const type = f.aircraftTypeIcao || 'UNKN'
    const list = byType.get(type) || []
    list.push(f)
    byType.set(type, list)
  }

  for (const [icaoType, flights] of byType) {
    const aircraft = aircraftByType.get(icaoType)
    if (!aircraft || aircraft.length === 0) continue

    // ─── Build atomic placement blocks from route chains ──────────────
    const allBlocks = buildPlacementBlocks(flights)

    // Sort blocks by earliest departure time
    allBlocks.sort((a, b) => {
      if (a.startDateMs !== b.startDateMs) return a.startDateMs - b.startDateMs
      return a.startStd - b.startStd
    })

    // Initialize aircraft slots from their REAL assigned flights
    const slots: AircraftSlot[] = aircraft.map(ac => {
      const realFlights = assignedFlightsByReg.get(ac.registration) || []
      let lastArr: string | null = null
      let lastSta = 0
      let lastDate = 0
      let firstDep: string | null = null
      let firstStd = Infinity
      let firstDate = Infinity
      const windows: { startMs: number; endMs: number }[] = []

      for (const rf of realFlights) {
        const rfDateMs = rf.date.getTime()
        windows.push({ startMs: flightStartMs(rf), endMs: flightEndMs(rf) })

        if (rfDateMs > lastDate || (rfDateMs === lastDate && rf.staMinutes > lastSta)) {
          lastArr = rf.arrStation
          lastSta = rf.staMinutes
          lastDate = rfDateMs
        }

        if (rfDateMs < firstDate || (rfDateMs === firstDate && rf.stdMinutes < firstStd)) {
          firstDep = rf.depStation
          firstStd = rf.stdMinutes
          firstDate = rfDateMs
        }
      }

      return {
        registration: ac.registration,
        icaoType: ac.icaoType,
        windows,
        lastArr,
        lastStaMinutes: lastSta,
        lastDate,
        firstDep,
        firstStdMinutes: firstStd === Infinity ? 0 : firstStd,
        firstDate: firstDate === Infinity ? 0 : firstDate,
      }
    })

    // ─── Pass 1: Forward (chronological) — station continuity ─────────
    const deferredBlocks: PlacementBlock[] = []
    for (const block of allBlocks) {
      let bestIdx = -1
      let bestScore = -Infinity

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]
        if (blockHasTimeOverlap(s, block, defaultTatMinutes * 60000)) continue

        let score = 0

        // Forward chain: block departs from where the last flight arrived
        if (s.lastArr && s.lastArr === block.depStation) {
          score += 1000
        }

        // Backward chain: block arrives at where the first flight departs
        if (s.firstDep && s.firstDep === block.arrStation) {
          score += 900
        }

        // Prefer unused aircraft or different-day continuations
        const dayDiff = s.lastDate > 0 ? (block.startDateMs - s.lastDate) / 86400000 : 0
        if (s.lastDate === 0 && s.firstDate === 0) {
          score += 500 // idle aircraft
        } else if (dayDiff > 0) {
          score += 100 // different day, forward direction
        } else if (s.firstDate > 0 && block.startDateMs < s.firstDate) {
          score += 100 // different day, backward direction
        }

        if (score > bestScore) {
          bestScore = score
          bestIdx = i
        }
      }

      if (bestIdx >= 0 && bestScore > 0) {
        placeBlockOnSlot(slots[bestIdx], block, placements)
      } else {
        deferredBlocks.push(block)
      }
    }

    // ─── Pass 2: Backward (reverse chronological) ─────────────────────
    if (deferredBlocks.length > 0) {
      const reversed = deferredBlocks.slice().reverse()
      const pass2Remaining: PlacementBlock[] = []

      for (const block of reversed) {
        if (block.flights.every(f => placements.has(f.id))) continue

        let bestIdx = -1
        let bestScore = -Infinity

        for (let i = 0; i < slots.length; i++) {
          const s = slots[i]
          if (blockHasTimeOverlap(s, block, defaultTatMinutes * 60000)) continue

          let score = 0

          if (s.firstDep && s.firstDep === block.arrStation) {
            score += 1000
          }

          if (s.lastArr && s.lastArr === block.depStation) {
            score += 900
          }

          if (s.lastDate === 0 && s.firstDate === 0) {
            score += 500
          }

          if (score > bestScore) {
            bestScore = score
            bestIdx = i
          }
        }

        if (bestIdx >= 0 && bestScore > 0) {
          placeBlockOnSlot(slots[bestIdx], block, placements)
        } else {
          pass2Remaining.push(block)
        }
      }

      // ─── Pass 3: Fallback — place remaining on any non-overlapping slot ─
      for (const block of pass2Remaining) {
        if (block.flights.every(f => placements.has(f.id))) continue

        let bestIdx = -1
        let bestLoad = Infinity

        for (let i = 0; i < slots.length; i++) {
          const s = slots[i]
          if (blockHasTimeOverlap(s, block, defaultTatMinutes * 60000)) continue
          if (s.windows.length < bestLoad) {
            bestLoad = s.windows.length
            bestIdx = i
          }
        }

        if (bestIdx >= 0) {
          placeBlockOnSlot(slots[bestIdx], block, placements)
        }
      }
    }
  }

  return placements
}
