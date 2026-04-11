/**
 * ASM Diff Engine — Instance-Level Change Detection
 *
 * Compares two snapshots of flight instances (before and after editing)
 * to produce ASM diff results. Each result represents one detected change
 * that should become an ASM message.
 *
 * Also handles message neutralization (NEW + CNL for the same flight+date
 * cancel each other out) and grouping of held messages for the review dialog.
 *
 * Pure functions — no side effects, no I/O, no framework dependencies.
 */

import type {
  InstanceSnapshot,
  AsmDiffResult,
  HeldMessageRef,
  GroupedMessage,
  ScheduleMessageLogRef,
} from '@skyhub/types'

// ── Diff Engine ─────────────────────────────────────────────

/**
 * Compare two snapshots and generate ASM diff results.
 * Returns only NET changes (reverted changes are excluded).
 */
export function computeAsmDiff(before: InstanceSnapshot[], after: InstanceSnapshot[]): AsmDiffResult[] {
  const results: AsmDiffResult[] = []

  // Build lookup maps by flightNumber + instanceDate
  const makeKey = (s: InstanceSnapshot) => `${s.flightNumber}:${s.instanceDate}`
  const beforeMap = new Map<string, InstanceSnapshot>()
  const afterMap = new Map<string, InstanceSnapshot>()

  for (const s of before) beforeMap.set(makeKey(s), s)
  for (const s of after) afterMap.set(makeKey(s), s)

  // Check for NEW, changed, and cancelled flights
  for (const [k, cur] of afterMap) {
    const prev = beforeMap.get(k)

    if (!prev) {
      // NEW flight instance — didn't exist before
      if (cur.status !== 'cancelled') {
        results.push({
          actionCode: 'NEW',
          flightNumber: cur.flightNumber,
          flightDate: cur.instanceDate,
          changes: {
            dep_station: { to: cur.depStation },
            arr_station: { to: cur.arrStation },
            std: { to: cur.stdUtc },
            sta: { to: cur.staUtc },
            aircraft_type: { to: cur.aircraftTypeIcao },
          },
          summary: `New flight ${cur.flightNumber} on ${cur.instanceDate}: ${cur.depStation}\u2192${cur.arrStation} ${fmtTime(cur.stdUtc)}-${fmtTime(cur.staUtc)}`,
        })
      }
      continue
    }

    // Cancellation
    if (prev.status !== 'cancelled' && cur.status === 'cancelled') {
      results.push({
        actionCode: 'CNL',
        flightNumber: cur.flightNumber,
        flightDate: cur.instanceDate,
        changes: {},
        summary: `Cancelled ${cur.flightNumber} on ${cur.instanceDate}`,
      })
      continue
    }

    // Reinstatement
    if (prev.status === 'cancelled' && cur.status !== 'cancelled') {
      results.push({
        actionCode: 'RIN',
        flightNumber: cur.flightNumber,
        flightDate: cur.instanceDate,
        changes: {},
        summary: `Reinstated ${cur.flightNumber} on ${cur.instanceDate}`,
      })
      continue
    }

    // Skip cancelled instances (no further diff needed)
    if (cur.status === 'cancelled') continue

    // Time and route changes
    const timeChanges: Record<string, { from?: string; to: string }> = {}
    if (prev.stdUtc !== cur.stdUtc) timeChanges['std'] = { from: prev.stdUtc, to: cur.stdUtc }
    if (prev.staUtc !== cur.staUtc) timeChanges['sta'] = { from: prev.staUtc, to: cur.staUtc }
    if (prev.depStation !== cur.depStation) timeChanges['dep_station'] = { from: prev.depStation, to: cur.depStation }
    if (prev.arrStation !== cur.arrStation) timeChanges['arr_station'] = { from: prev.arrStation, to: cur.arrStation }

    if (Object.keys(timeChanges).length > 0) {
      const parts: string[] = []
      if (timeChanges['std'])
        parts.push(`STD ${fmtTime(timeChanges['std'].from!)}\u2192${fmtTime(timeChanges['std'].to)}`)
      if (timeChanges['sta'])
        parts.push(`STA ${fmtTime(timeChanges['sta'].from!)}\u2192${fmtTime(timeChanges['sta'].to)}`)
      if (timeChanges['dep_station'])
        parts.push(`DEP ${timeChanges['dep_station'].from}\u2192${timeChanges['dep_station'].to}`)
      if (timeChanges['arr_station'])
        parts.push(`ARR ${timeChanges['arr_station'].from}\u2192${timeChanges['arr_station'].to}`)

      results.push({
        actionCode: timeChanges['dep_station'] || timeChanges['arr_station'] ? 'RRT' : 'TIM',
        flightNumber: cur.flightNumber,
        flightDate: cur.instanceDate,
        changes: timeChanges,
        summary: `${cur.flightNumber} on ${cur.instanceDate}: ${parts.join(', ')}`,
      })
    }

    // Equipment change (separate ASM from time changes)
    if (prev.aircraftTypeIcao !== cur.aircraftTypeIcao && cur.aircraftTypeIcao) {
      results.push({
        actionCode: 'EQT',
        flightNumber: cur.flightNumber,
        flightDate: cur.instanceDate,
        changes: { aircraft_type: { from: prev.aircraftTypeIcao, to: cur.aircraftTypeIcao } },
        summary: `${cur.flightNumber} on ${cur.instanceDate}: AC ${prev.aircraftTypeIcao}\u2192${cur.aircraftTypeIcao}`,
      })
    }
  }

  // Flights deleted (in before but not in after)
  for (const [k, prev] of beforeMap) {
    if (!afterMap.has(k) && prev.status !== 'cancelled') {
      results.push({
        actionCode: 'CNL',
        flightNumber: prev.flightNumber,
        flightDate: prev.instanceDate,
        changes: {},
        summary: `Cancelled ${prev.flightNumber} on ${prev.instanceDate} (removed)`,
      })
    }
  }

  return results
}

// ── Neutralization ──────────────────────────────────────────

/**
 * Find NEW/CNL pairs for the same flight+date among held messages.
 * Returns IDs of messages that should be neutralized (status → 'neutralized').
 */
export function findNeutralizablePairs(held: HeldMessageRef[]): string[] {
  // Group by flightNumber + flightDate
  const byKey = new Map<string, HeldMessageRef[]>()
  for (const m of held) {
    const key = `${m.flightNumber}:${m.flightDate}`
    const arr = byKey.get(key) || []
    arr.push(m)
    byKey.set(key, arr)
  }

  const toNeutralize: string[] = []
  for (const [, msgs] of byKey) {
    const newMsgs = msgs.filter((m) => m.actionCode === 'NEW')
    const cnlMsgs = msgs.filter((m) => m.actionCode === 'CNL')
    if (newMsgs.length > 0 && cnlMsgs.length > 0) {
      const pairs = Math.min(newMsgs.length, cnlMsgs.length)
      for (let i = 0; i < pairs; i++) {
        toNeutralize.push(newMsgs[i].id, cnlMsgs[i].id)
      }
    }
  }

  return toNeutralize
}

// ── Grouping (for ASM Review Dialog) ────────────────────────

/**
 * Group held messages by flight + action + changes for display
 * in the ASM Review Dialog (used in both 1.1.1 and 1.1.2).
 */
export function groupHeldMessages(messages: ScheduleMessageLogRef[]): GroupedMessage[] {
  const groups = new Map<string, ScheduleMessageLogRef[]>()

  for (const m of messages) {
    const changesStr = JSON.stringify(m.changes || {})
    const key = `${m.flightNumber}:${m.actionCode}:${changesStr}`
    const existing = groups.get(key) || []
    existing.push(m)
    groups.set(key, existing)
  }

  const result: GroupedMessage[] = []
  for (const [key, msgs] of groups) {
    // Sort by date
    msgs.sort((a, b) => (a.flightDate || '').localeCompare(b.flightDate || ''))
    const first = msgs[0]
    const last = msgs[msgs.length - 1]

    // Build clean summary from the first message
    const parts = (first.summary || '').split(': ')
    const changePart = parts.length > 1 ? parts.slice(1).join(': ') : first.summary || ''

    result.push({
      key,
      actionCode: first.actionCode,
      flightNumber: first.flightNumber || '',
      dateFrom: first.flightDate || '',
      dateTo: last.flightDate || '',
      instanceCount: msgs.length,
      summary: changePart,
      messageIds: msgs.map((m) => m._id),
      messages: msgs,
    })
  }

  // Sort by flight number then date
  result.sort((a, b) => {
    const fn = a.flightNumber.localeCompare(b.flightNumber)
    if (fn !== 0) return fn
    return a.dateFrom.localeCompare(b.dateFrom)
  })

  return result
}

// ── Helpers ─────────────────────────────────────────────────

function fmtTime(hhmm: string): string {
  if (!hhmm || hhmm.length !== 4) return hhmm
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`
}
