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
  serviceType: string
  daysOfWeek: string
  blockMinutes: number | null
  status: string
}

export async function generateSsimExcel(flights: FlightRow[], seasonCode: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SkyHub'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(`Schedule ${seasonCode}`)

  // Header row
  const headers = ['AC Type', 'From', 'To', 'DEP', 'ARR', 'Flight', 'STD', 'STA', 'SVC', 'Frequency', 'Block', 'Status']
  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F5' } }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 24

  // Column widths
  const widths = [10, 12, 12, 6, 6, 10, 6, 6, 5, 10, 6, 8]
  widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

  // Data rows
  for (const f of flights) {
    const blockStr = f.blockMinutes != null
      ? `${Math.floor(f.blockMinutes / 60)}:${String(f.blockMinutes % 60).padStart(2, '0')}`
      : ''

    const row = sheet.addRow([
      f.aircraftTypeIcao ?? '',
      f.effectiveFrom,
      f.effectiveUntil,
      f.depStation,
      f.arrStation,
      f.flightNumber,
      f.stdUtc,
      f.staUtc,
      f.serviceType,
      f.daysOfWeek,
      blockStr,
      f.status,
    ])

    row.alignment = { horizontal: 'center', vertical: 'middle' }
    row.font = { name: 'Consolas', size: 10 }
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
