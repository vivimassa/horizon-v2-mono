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

export function computeScheduleDiff(
  baseFights: FlightSnapshot[],
  targetFlights: FlightSnapshot[]
): ScheduleMessage[] {
  const messages: ScheduleMessage[] = []

  const baseMap = new Map(baseFights.map(f => [f._id, f]))
  const targetMap = new Map(targetFlights.map(f => [f._id, f]))

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
    if (bf.aircraftTypeIcao !== tf.aircraftTypeIcao) changes.aircraftTypeIcao = { from: bf.aircraftTypeIcao, to: tf.aircraftTypeIcao }
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
