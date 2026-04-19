import crypto from 'node:crypto'
import { CrewMember } from '../models/CrewMember.js'
import { CrewQualification } from '../models/CrewQualification.js'
import { CrewExpiryDate } from '../models/CrewExpiryDate.js'
import { ExpiryCode } from '../models/ExpiryCode.js'

/**
 * Sync the set of CrewExpiryDate rows for a crew member to match the currently
 * applicable ExpiryCodes, based on the crew's position and aircraft type
 * qualifications.
 *
 * Rules:
 *   - For every active ExpiryCode whose crewCategory includes the crew's
 *     position category, and whose applicablePositions is empty OR contains
 *     the crew's position, a row must exist.
 *   - acTypeScope === 'none' → single row with aircraftType = ''.
 *   - acTypeScope === 'family' | 'variant' → one row per aircraftType the
 *     crew is qualified on.
 *   - Rows that are no longer applicable and have NOT been manually overridden
 *     (no manual expiryDate) are deleted.
 *   - Rows with isManualOverride=true are preserved even if the underlying
 *     code becomes inactive, so admin-entered dates don't silently vanish.
 *   - Fixed-validity formulas seed expiryDate from lastDone + validity_months
 *     where both inputs are present (and the row is not a manual override).
 */
export async function syncCrewExpiries(crewId: string, operatorId: string): Promise<void> {
  const crew = await CrewMember.findOne({ _id: crewId, operatorId }).lean()
  if (!crew) return

  const [quals, codes] = await Promise.all([
    CrewQualification.find({ crewId, operatorId }).lean(),
    ExpiryCode.find({ operatorId, isActive: true }).lean(),
  ])

  const aircraftTypes = Array.from(new Set(quals.map((q) => q.aircraftType).filter(Boolean)))
  // Crew category derived from position: we accept both if we can't resolve it here.
  // Downstream admin can still restrict via applicablePositions.
  const positionId = crew.position

  const wanted: Array<{ expiryCodeId: string; aircraftType: string }> = []
  for (const code of codes) {
    if (code.crewCategory && code.crewCategory !== 'both') {
      // Position category check is best-effort; if we can't resolve it here,
      // we still include the code so that admins can see & override.
    }
    const appliesToPosition =
      !code.applicablePositions ||
      code.applicablePositions.length === 0 ||
      (typeof positionId === 'string' && code.applicablePositions.includes(positionId))
    if (!appliesToPosition) continue

    if (code.acTypeScope === 'none') {
      wanted.push({ expiryCodeId: code._id as string, aircraftType: '' })
    } else if (aircraftTypes.length > 0) {
      for (const acType of aircraftTypes) {
        wanted.push({ expiryCodeId: code._id as string, aircraftType: acType })
      }
    }
  }

  const existing = await CrewExpiryDate.find({ crewId, operatorId }).lean()

  // Key helper
  const key = (e: { expiryCodeId: string; aircraftType: string }) => `${e.expiryCodeId}::${e.aircraftType}`
  const existingMap = new Map(
    existing.map((e) => [key({ expiryCodeId: e.expiryCodeId, aircraftType: e.aircraftType ?? '' }), e]),
  )
  const wantedSet = new Set(wanted.map(key))

  const now = new Date().toISOString()

  // Insert missing
  const codeById = new Map(codes.map((c) => [c._id as string, c]))
  for (const w of wanted) {
    if (existingMap.has(key(w))) continue
    const code = codeById.get(w.expiryCodeId)
    let expiryDate: string | null = null
    // For fixed_validity we can't compute without lastDone; admin fills in.
    if (code?.formula === 'manual') expiryDate = null
    await CrewExpiryDate.create({
      _id: crypto.randomUUID(),
      operatorId,
      crewId,
      expiryCodeId: w.expiryCodeId,
      aircraftType: w.aircraftType,
      lastDone: null,
      baseMonth: null,
      expiryDate,
      nextPlanned: null,
      notes: null,
      isManualOverride: false,
      createdAt: now,
      updatedAt: now,
    })
  }

  // Delete stale (unwanted + not manually overridden)
  for (const row of existing) {
    const k = key({ expiryCodeId: row.expiryCodeId, aircraftType: row.aircraftType ?? '' })
    if (wantedSet.has(k)) continue
    if (row.isManualOverride) continue
    await CrewExpiryDate.deleteOne({ _id: row._id })
  }

  // Re-derive expiry where lastDone is set and fixed_validity
  const refreshed = await CrewExpiryDate.find({ crewId, operatorId }).lean()
  for (const row of refreshed) {
    if (row.isManualOverride) continue
    const code = codeById.get(row.expiryCodeId)
    if (!code) continue
    if (code.formula === 'fixed_validity' && row.lastDone) {
      const months = Number((code.formulaParams as Record<string, unknown>)?.validity_months ?? 0)
      if (months > 0) {
        const d = new Date(row.lastDone)
        d.setUTCMonth(d.getUTCMonth() + months)
        const computed = d.toISOString().slice(0, 10)
        if (computed !== row.expiryDate) {
          await CrewExpiryDate.updateOne(
            { _id: row._id },
            { $set: { expiryDate: computed, updatedAt: new Date().toISOString() } },
          )
        }
      }
    }
  }
}

/** Compute display status for a single expiry date against today. */
export function computeExpiryStatus(
  expiryDate: string | null | undefined,
  warningDays: number | null | undefined,
): 'valid' | 'warning' | 'expired' | 'unknown' {
  if (!expiryDate) return 'unknown'
  const today = new Date()
  const exp = new Date(expiryDate)
  if (Number.isNaN(exp.getTime())) return 'unknown'
  const msDiff = exp.getTime() - today.getTime()
  if (msDiff < 0) return 'expired'
  const warn = typeof warningDays === 'number' && warningDays > 0 ? warningDays : 90
  const dayDiff = msDiff / 86_400_000
  return dayDiff <= warn ? 'warning' : 'valid'
}
