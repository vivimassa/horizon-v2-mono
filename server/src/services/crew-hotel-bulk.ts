import crypto from 'node:crypto'
import { CrewHotel } from '../models/CrewHotel.js'
import { Airport } from '../models/Airport.js'

/**
 * Minimal CSV parser. Handles quoted fields, escaped quotes (""), CRLF/LF.
 * Not a full RFC 4180 impl — sufficient for our templated uploads.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else if (ch === '\r') {
        // ignore — consume \n next
      } else {
        field += ch
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 0 && r.some((c) => c.trim().length > 0))
}

function parsePipeList(s: string | undefined): string[] {
  if (!s) return []
  return s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseBool(s: string | undefined): boolean {
  if (!s) return false
  const v = s.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'y'
}

function parseNum(s: string | undefined): number | null {
  if (s == null) return null
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function parseTime(s: string | undefined): string | null {
  if (!s) return null
  const t = s.trim()
  if (!/^\d{2}:\d{2}$/.test(t)) return null
  return t
}

function parseWeekdayMask(s: string | undefined): boolean[] | null {
  if (!s) return null
  const t = s.trim()
  if (!/^[01]{7}$/.test(t)) return null
  return t.split('').map((c) => c === '1')
}

function parseDateToUtcMs(s: string | undefined): number | null {
  if (!s) return null
  const t = s.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

// ─── Types ───────────────────────────────────────────────

export interface BulkResult {
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; field?: string; reason: string }>
  dryRun: boolean
}

interface BulkOptions {
  dryRun: boolean
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeHeader(h: string): string {
  return h.trim()
}

function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const o: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) o[headers[i]] = row[i] ?? ''
  return o
}

// ─── Hotel Details ───────────────────────────────────────

export async function bulkIngestHotelDetails(
  operatorId: string,
  csvText: string,
  opts: BulkOptions,
): Promise<BulkResult> {
  const rows = parseCsv(csvText)
  const result: BulkResult = {
    totalRows: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    dryRun: opts.dryRun,
  }
  if (rows.length < 2) {
    result.errors.push({ row: 0, reason: 'File is empty or missing header row' })
    return result
  }

  const headers = rows[0].map(normalizeHeader)
  const dataRows = rows.slice(1)
  result.totalRows = dataRows.length

  const knownIcao = new Set(
    (await Airport.find({}, { icaoCode: 1 }).lean()).map((a) => String(a.icaoCode).toUpperCase()),
  )

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2 // header = row 1
    const r = rowToObject(headers, dataRows[i])
    const icao = (r.airportIcao || '').trim().toUpperCase()
    const hotelName = (r.hotelName || '').trim()

    if (!icao || !/^[A-Z]{3,4}$/.test(icao)) {
      result.errors.push({ row: rowNum, field: 'airportIcao', reason: 'Missing or invalid ICAO' })
      continue
    }
    if (!knownIcao.has(icao)) {
      result.errors.push({ row: rowNum, field: 'airportIcao', reason: `Airport ${icao} not in database` })
      continue
    }
    if (!hotelName) {
      result.errors.push({ row: rowNum, field: 'hotelName', reason: 'Missing hotel name' })
      continue
    }

    const standardCheckIn = parseTime(r.standardCheckInLocal) ?? '10:00'
    const standardCheckOut = parseTime(r.standardCheckOutLocal) ?? '18:00'

    const emails = parsePipeList(r.additionalEmails).map((addr) => ({
      _id: crypto.randomUUID(),
      address: addr,
      isDefault: false,
    }))
    if (r.defaultEmail && r.defaultEmail.trim()) {
      emails.unshift({ _id: crypto.randomUUID(), address: r.defaultEmail.trim(), isDefault: true })
    }

    const contacts = []
    if (r.contact1Name || r.contact1Telephone || r.contact1Fax) {
      contacts.push({
        _id: crypto.randomUUID(),
        name: r.contact1Name || null,
        telephone: r.contact1Telephone || null,
        fax: r.contact1Fax || null,
      })
    }
    if (r.contact2Name || r.contact2Telephone || r.contact2Fax) {
      contacts.push({
        _id: crypto.randomUUID(),
        name: r.contact2Name || null,
        telephone: r.contact2Telephone || null,
        fax: r.contact2Fax || null,
      })
    }

    const doc = {
      airportIcao: icao,
      hotelName,
      priority: parseNum(r.priority) ?? 1,
      isActive: r.isActive ? parseBool(r.isActive) : true,
      isTrainingHotel: parseBool(r.isTrainingHotel),
      isAllInclusive: parseBool(r.isAllInclusive),
      addressLine1: r.addressLine1 || null,
      addressLine2: r.addressLine2 || null,
      addressLine3: r.addressLine3 || null,
      latitude: parseNum(r.latitude),
      longitude: parseNum(r.longitude),
      distanceFromAirportMinutes: parseNum(r.distanceFromAirportMinutes),
      shuttleAlwaysAvailable: parseBool(r.shuttleAlwaysAvailable),
      standardCheckInLocal: standardCheckIn,
      standardCheckOutLocal: standardCheckOut,
      criteria: {
        blockToBlockRestMinutes: parseNum(r.blockToBlockRestMinutes),
        crewPositions: parsePipeList(r.crewPositions),
        aircraftTypes: parsePipeList(r.aircraftTypes),
        crewCategories: parsePipeList(r.crewCategories),
        charterers: parsePipeList(r.charterers),
      },
      contacts,
      emails,
      updatedAt: nowIso(),
    }

    if (opts.dryRun) {
      // Preview only; classify as would-create or would-update.
      const existing = await CrewHotel.findOne({ operatorId, airportIcao: icao, hotelName }, { _id: 1 }).lean()
      if (existing) result.updated++
      else result.created++
      continue
    }

    try {
      const existing = await CrewHotel.findOne({ operatorId, airportIcao: icao, hotelName }).lean()
      if (existing) {
        await CrewHotel.updateOne({ _id: existing._id, operatorId }, { $set: doc })
        result.updated++
      } else {
        await CrewHotel.create({
          _id: crypto.randomUUID(),
          operatorId,
          ...doc,
          contracts: [],
          shuttles: [],
          createdAt: nowIso(),
        })
        result.created++
      }
    } catch (e) {
      result.errors.push({ row: rowNum, reason: (e as Error).message })
    }
  }

  return result
}

// ─── Effective Dates / Contracts ─────────────────────────

export async function bulkIngestEffectiveDates(
  operatorId: string,
  csvText: string,
  opts: BulkOptions,
): Promise<BulkResult> {
  const rows = parseCsv(csvText)
  const result: BulkResult = {
    totalRows: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    dryRun: opts.dryRun,
  }
  if (rows.length < 2) {
    result.errors.push({ row: 0, reason: 'File is empty or missing header row' })
    return result
  }

  const headers = rows[0].map(normalizeHeader)
  const dataRows = rows.slice(1)
  result.totalRows = dataRows.length

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2
    const r = rowToObject(headers, dataRows[i])
    const icao = (r.airportIcao || '').trim().toUpperCase()
    const hotelName = (r.hotelName || '').trim()
    const recordType = (r.recordType || 'CONTRACT').trim().toUpperCase()

    if (!icao || !hotelName) {
      result.errors.push({ row: rowNum, reason: 'airportIcao and hotelName required' })
      continue
    }

    const from = parseDateToUtcMs(r.effectiveFromDate)
    const until = parseDateToUtcMs(r.effectiveUntilDate)

    const hotel = await CrewHotel.findOne({ operatorId, airportIcao: icao, hotelName }).lean()
    if (!hotel) {
      result.errors.push({
        row: rowNum,
        reason: `Hotel "${hotelName}" at ${icao} not found — upload details first`,
      })
      continue
    }

    if (recordType === 'HOTEL_EFFECTIVE') {
      if (opts.dryRun) {
        result.updated++
        continue
      }
      await CrewHotel.updateOne(
        { _id: hotel._id, operatorId },
        {
          $set: {
            effectiveFromUtcMs: from,
            effectiveUntilUtcMs: until,
            updatedAt: nowIso(),
          },
        },
      )
      result.updated++
      continue
    }

    if (recordType === 'CONTRACT') {
      const mask = parseWeekdayMask(r.weekdayMask)
      if (!mask) {
        result.errors.push({ row: rowNum, field: 'weekdayMask', reason: 'Must be 7 chars of 0/1' })
        continue
      }
      const contract = {
        _id: crypto.randomUUID(),
        priority: parseNum(r.contractPriority) ?? 1,
        startDateUtcMs: from,
        endDateUtcMs: until,
        weekdayMask: mask,
        checkInLocal: parseTime(r.checkInLocal),
        checkOutLocal: parseTime(r.checkOutLocal),
        contractNo: r.contractNo || null,
        contractRate: parseNum(r.contractRate),
        currency: r.currency || 'EUR',
        roomsPerNight: parseNum(r.roomsPerNight) ?? 0,
        releaseTime: parseTime(r.releaseTime) ?? '00:00',
        roomRate: parseNum(r.roomRate) ?? 0,
        dailyRateRules: [],
      }

      if (opts.dryRun) {
        result.created++
        continue
      }

      await CrewHotel.updateOne(
        { _id: hotel._id, operatorId },
        { $push: { contracts: contract }, $set: { updatedAt: nowIso() } },
      )
      result.created++
      continue
    }

    result.errors.push({
      row: rowNum,
      field: 'recordType',
      reason: `Unknown recordType "${recordType}" (expected HOTEL_EFFECTIVE or CONTRACT)`,
    })
  }

  return result
}
