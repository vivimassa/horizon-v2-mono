// Schedule Diff Engine — compares two sets of flights and generates ASM/SSM messages

interface FlightSnapshot {
  _id: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  aircraftTypeIcao: string | null
  daysOfWeek: string
  effectiveFrom: string
  effectiveUntil: string
  status: string
}

export interface ScheduleMessage {
  type: 'ASM' | 'SSM'
  actionCode: 'NEW' | 'CNL' | 'TIM' | 'EQT' | 'RRT'
  flightNumber: string
  depStation: string
  arrStation: string
  effectiveFrom: string
  effectiveUntil: string
  summary: string
  changes: Record<string, { from: string | null; to: string | null }>
}

interface ScenarioFlightSnapshot extends FlightSnapshot {
  sourceFlightId: string | null
}

/**
 * Compute diff between scenario flights and production flights using sourceFlightId linkage.
 * This is the preferred method for scenario publish — it correctly handles cloned flights
 * that have different _ids but track their production origin via sourceFlightId.
 */
export function computeScenarioDiff(
  productionFlights: FlightSnapshot[],
  scenarioFlights: ScenarioFlightSnapshot[],
): ScheduleMessage[] {
  const messages: ScheduleMessage[] = []
  const prodMap = new Map(productionFlights.map((f) => [f._id, f]))
  const referencedProdIds = new Set<string>()

  for (const sf of scenarioFlights) {
    const srcId = sf.sourceFlightId

    if (!srcId) {
      // NEW — created in scenario, no production origin
      messages.push({
        type: 'SSM',
        actionCode: 'NEW',
        flightNumber: sf.flightNumber,
        depStation: sf.depStation,
        arrStation: sf.arrStation,
        effectiveFrom: sf.effectiveFrom,
        effectiveUntil: sf.effectiveUntil,
        summary: `New flight ${sf.flightNumber} ${sf.depStation}-${sf.arrStation}`,
        changes: {},
      })
      continue
    }

    referencedProdIds.add(srcId)
    const prod = prodMap.get(srcId)
    if (!prod) {
      // Source was deleted from production — treat as NEW
      messages.push({
        type: 'SSM',
        actionCode: 'NEW',
        flightNumber: sf.flightNumber,
        depStation: sf.depStation,
        arrStation: sf.arrStation,
        effectiveFrom: sf.effectiveFrom,
        effectiveUntil: sf.effectiveUntil,
        summary: `New flight ${sf.flightNumber} ${sf.depStation}-${sf.arrStation} (source removed)`,
        changes: {},
      })
      continue
    }

    // Cancelled in scenario
    if (sf.status === 'cancelled') {
      messages.push({
        type: 'ASM',
        actionCode: 'CNL',
        flightNumber: prod.flightNumber,
        depStation: prod.depStation,
        arrStation: prod.arrStation,
        effectiveFrom: prod.effectiveFrom,
        effectiveUntil: prod.effectiveUntil,
        summary: `Cancelled flight ${prod.flightNumber} ${prod.depStation}-${prod.arrStation}`,
        changes: {},
      })
      continue
    }

    // Compare for modifications
    const changes: Record<string, { from: string | null; to: string | null }> = {}
    if (prod.stdUtc !== sf.stdUtc) changes.stdUtc = { from: prod.stdUtc, to: sf.stdUtc }
    if (prod.staUtc !== sf.staUtc) changes.staUtc = { from: prod.staUtc, to: sf.staUtc }
    if (prod.depStation !== sf.depStation) changes.depStation = { from: prod.depStation, to: sf.depStation }
    if (prod.arrStation !== sf.arrStation) changes.arrStation = { from: prod.arrStation, to: sf.arrStation }
    if (prod.aircraftTypeIcao !== sf.aircraftTypeIcao)
      changes.aircraftTypeIcao = { from: prod.aircraftTypeIcao, to: sf.aircraftTypeIcao }
    if (prod.daysOfWeek !== sf.daysOfWeek) changes.daysOfWeek = { from: prod.daysOfWeek, to: sf.daysOfWeek }

    if (Object.keys(changes).length === 0) continue

    let actionCode: ScheduleMessage['actionCode'] = 'TIM'
    if (changes.depStation || changes.arrStation) actionCode = 'RRT'
    else if (changes.aircraftTypeIcao) actionCode = 'EQT'

    const parts = Object.entries(changes).map(([k, v]) => `${k}: ${v.from} → ${v.to}`)
    messages.push({
      type: 'ASM',
      actionCode,
      flightNumber: sf.flightNumber,
      depStation: sf.depStation,
      arrStation: sf.arrStation,
      effectiveFrom: sf.effectiveFrom,
      effectiveUntil: sf.effectiveUntil,
      summary: `${actionCode} ${sf.flightNumber}: ${parts.join(', ')}`,
      changes,
    })
  }

  // Production flights not referenced by scenario → cancelled
  for (const [prodId, prod] of prodMap) {
    if (!referencedProdIds.has(prodId) && prod.status !== 'cancelled') {
      messages.push({
        type: 'ASM',
        actionCode: 'CNL',
        flightNumber: prod.flightNumber,
        depStation: prod.depStation,
        arrStation: prod.arrStation,
        effectiveFrom: prod.effectiveFrom,
        effectiveUntil: prod.effectiveUntil,
        summary: `Cancelled flight ${prod.flightNumber} ${prod.depStation}-${prod.arrStation}`,
        changes: {},
      })
    }
  }

  return messages
}

export function computeScheduleDiff(baseFights: FlightSnapshot[], targetFlights: FlightSnapshot[]): ScheduleMessage[] {
  const messages: ScheduleMessage[] = []

  const baseMap = new Map(baseFights.map((f) => [f._id, f]))
  const targetMap = new Map(targetFlights.map((f) => [f._id, f]))

  // NEW — in target but not in base
  for (const [id, tf] of targetMap) {
    if (!baseMap.has(id)) {
      messages.push({
        type: 'ASM',
        actionCode: 'NEW',
        flightNumber: tf.flightNumber,
        depStation: tf.depStation,
        arrStation: tf.arrStation,
        effectiveFrom: tf.effectiveFrom,
        effectiveUntil: tf.effectiveUntil,
        summary: `New flight ${tf.flightNumber} ${tf.depStation}-${tf.arrStation}`,
        changes: {},
      })
    }
  }

  // CNL — in base but not in target (or status changed to cancelled)
  for (const [id, bf] of baseMap) {
    const tf = targetMap.get(id)
    if (!tf || tf.status === 'cancelled') {
      messages.push({
        type: 'ASM',
        actionCode: 'CNL',
        flightNumber: bf.flightNumber,
        depStation: bf.depStation,
        arrStation: bf.arrStation,
        effectiveFrom: bf.effectiveFrom,
        effectiveUntil: bf.effectiveUntil,
        summary: `Cancelled flight ${bf.flightNumber} ${bf.depStation}-${bf.arrStation}`,
        changes: {},
      })
      continue
    }

    // Compare fields for changes
    const changes: Record<string, { from: string | null; to: string | null }> = {}

    if (bf.stdUtc !== tf.stdUtc) changes.stdUtc = { from: bf.stdUtc, to: tf.stdUtc }
    if (bf.staUtc !== tf.staUtc) changes.staUtc = { from: bf.staUtc, to: tf.staUtc }
    if (bf.depStation !== tf.depStation) changes.depStation = { from: bf.depStation, to: tf.depStation }
    if (bf.arrStation !== tf.arrStation) changes.arrStation = { from: bf.arrStation, to: tf.arrStation }
    if (bf.aircraftTypeIcao !== tf.aircraftTypeIcao)
      changes.aircraftTypeIcao = { from: bf.aircraftTypeIcao, to: tf.aircraftTypeIcao }
    if (bf.daysOfWeek !== tf.daysOfWeek) changes.daysOfWeek = { from: bf.daysOfWeek, to: tf.daysOfWeek }

    if (Object.keys(changes).length === 0) continue

    // Determine action code
    let actionCode: ScheduleMessage['actionCode'] = 'TIM'
    if (changes.depStation || changes.arrStation) actionCode = 'RRT'
    else if (changes.aircraftTypeIcao) actionCode = 'EQT'

    const parts = Object.entries(changes).map(([k, v]) => `${k}: ${v.from} → ${v.to}`)

    messages.push({
      type: 'ASM',
      actionCode,
      flightNumber: tf.flightNumber,
      depStation: tf.depStation,
      arrStation: tf.arrStation,
      effectiveFrom: tf.effectiveFrom,
      effectiveUntil: tf.effectiveUntil,
      summary: `${actionCode} ${tf.flightNumber}: ${parts.join(', ')}`,
      changes,
    })
  }

  return messages
}
