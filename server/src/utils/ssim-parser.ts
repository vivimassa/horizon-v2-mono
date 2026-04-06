// SSIM Excel Parser — reads .xlsx uploads and converts to ScheduledFlight format
import ExcelJS from 'exceljs'

export interface ParsedFlight {
  airlineCode: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  daysOfWeek: string
  aircraftTypeIcao: string
  serviceType: string
  effectiveFrom: string
  effectiveUntil: string
  blockMinutes: number | null
}

export interface ParseResult {
  flights: ParsedFlight[]
  errors: { row: number; message: string }[]
}

const COLUMN_MAP: Record<string, string> = {
  'ac type': 'aircraftTypeIcao',
  'type': 'aircraftTypeIcao',
  'aircraft': 'aircraftTypeIcao',
  'dep': 'depStation',
  'departure': 'depStation',
  'arr': 'arrStation',
  'arrival': 'arrStation',
  'flight': 'flightNumber',
  'flight number': 'flightNumber',
  'flight no': 'flightNumber',
  'std': 'stdUtc',
  'sta': 'staUtc',
  'svc': 'serviceType',
  'service': 'serviceType',
  'freq': 'daysOfWeek',
  'frequency': 'daysOfWeek',
  'dow': 'daysOfWeek',
  'from': 'effectiveFrom',
  'effective from': 'effectiveFrom',
  'period start': 'effectiveFrom',
  'to': 'effectiveUntil',
  'effective to': 'effectiveUntil',
  'effective until': 'effectiveUntil',
  'period end': 'effectiveUntil',
  'block': 'blockMinutes',
  'block time': 'blockMinutes',
}

export async function parseSsimExcel(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return { flights: [], errors: [{ row: 0, message: 'No worksheet found' }] }

  // Map header row
  const headerRow = sheet.getRow(1)
  const colMapping: Record<number, string> = {}
  headerRow.eachCell((cell, colNum) => {
    const header = String(cell.value ?? '').toLowerCase().trim()
    const mapped = COLUMN_MAP[header]
    if (mapped) colMapping[colNum] = mapped
  })

  if (Object.keys(colMapping).length < 4) {
    return { flights: [], errors: [{ row: 1, message: 'Could not map enough columns from header row' }] }
  }

  const flights: ParsedFlight[] = []
  const errors: { row: number; message: string }[] = []

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    if (!row.hasValues) continue

    const data: Record<string, string> = {}
    for (const [colNum, field] of Object.entries(colMapping)) {
      const val = row.getCell(Number(colNum)).value
      data[field] = val != null ? String(val).trim() : ''
    }

    // Validate required fields
    if (!data.flightNumber && !data.depStation && !data.arrStation) continue // skip empty rows
    if (!data.depStation || !data.arrStation) {
      errors.push({ row: r, message: 'Missing DEP or ARR station' })
      continue
    }

    // Parse flight number — extract airline code if present
    let airlineCode = 'HZ'
    let flightNum = data.flightNumber ?? ''
    const match = flightNum.match(/^([A-Z]{2,3})(.+)$/i)
    if (match) {
      airlineCode = match[1].toUpperCase()
      flightNum = match[2]
    }

    flights.push({
      airlineCode,
      flightNumber: flightNum.toUpperCase(),
      depStation: data.depStation.toUpperCase(),
      arrStation: data.arrStation.toUpperCase(),
      stdUtc: data.stdUtc ?? '00:00',
      staUtc: data.staUtc ?? '00:00',
      daysOfWeek: data.daysOfWeek || '1234567',
      aircraftTypeIcao: (data.aircraftTypeIcao ?? '').toUpperCase(),
      serviceType: data.serviceType || 'J',
      effectiveFrom: data.effectiveFrom || '',
      effectiveUntil: data.effectiveUntil || '',
      blockMinutes: data.blockMinutes ? parseInt(data.blockMinutes) || null : null,
    })
  }

  return { flights, errors }
}
