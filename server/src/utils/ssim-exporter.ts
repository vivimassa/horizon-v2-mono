// SSIM Excel Exporter — generates .xlsx from ScheduledFlight documents
import ExcelJS from 'exceljs'

interface FlightRow {
  aircraftTypeIcao: string | null
  effectiveFrom: string
  effectiveUntil: string
  depStation: string
  arrStation: string
  flightNumber: string
  stdUtc: string
  staUtc: string
  departureDayOffset: number
  serviceType: string
  daysOfWeek: string
  blockMinutes: number | null
  tat: number | null
  status: string
  separatorBelow?: boolean
}

/** Format an ISO date string (YYYY-MM-DD) to the operator's date format */
function formatDate(iso: string, fmt: string): string {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[parseInt(m, 10) - 1] ?? m
  switch (fmt) {
    case 'DD-MMM-YY':
      return `${d}-${mon}-${y.slice(2)}`
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`
    case 'DD.MM.YYYY':
      return `${d}.${m}.${y}`
    default:
      return iso.slice(0, 10)
  }
}

/** Format minutes as H:MM */
function fmtMinutes(min: number | null): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Compute block minutes from STD and STA (HH:MM strings) */
function calcBlock(std: string, sta: string): number | null {
  if (!std || !sta) return null
  const parse = (t: string) => {
    const c = t.replace(':', '')
    if (c.length < 4) return null
    return parseInt(c.slice(0, 2)) * 60 + parseInt(c.slice(2, 4))
  }
  const s = parse(std)
  const a = parse(sta)
  if (s == null || a == null) return null
  let diff = a - s
  if (diff < 0) diff += 1440
  return diff
}

export async function generateSsimExcel(
  flights: FlightRow[],
  seasonCode: string,
  dateFormat = 'YYYY-MM-DD',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SkyHub'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(`Schedule ${seasonCode}`)

  // Header row
  const headers = [
    'AC Type',
    'From',
    'To',
    'DEP',
    'ARR',
    'Flight',
    'STD',
    'STA',
    'Offset',
    'SVC',
    'Frequency',
    'Block',
    'TAT',
    'Status',
  ]
  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F5' } }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 24

  // Column widths
  const widths = [10, 14, 14, 6, 6, 10, 6, 6, 6, 5, 10, 6, 6, 8]
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })

  // Data rows
  for (const f of flights) {
    const row = sheet.addRow([
      f.aircraftTypeIcao ?? '',
      formatDate(f.effectiveFrom, dateFormat),
      formatDate(f.effectiveUntil, dateFormat),
      f.depStation,
      f.arrStation,
      f.flightNumber,
      f.stdUtc,
      f.staUtc,
      f.departureDayOffset ?? 1,
      f.serviceType,
      f.daysOfWeek,
      fmtMinutes(f.blockMinutes ?? calcBlock(f.stdUtc, f.staUtc)),
      fmtMinutes(f.tat),
      f.status,
    ])

    row.alignment = { horizontal: 'center', vertical: 'middle' }
    row.font = { name: 'Consolas', size: 10 }

    // Blank row between cycles
    if (f.separatorBelow) {
      sheet.addRow([])
    }
  }

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  // Alternating row colors
  for (let i = 2; i <= flights.length + 1; i++) {
    if (i % 2 === 0) {
      const row = sheet.getRow(i)
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFC' } }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
