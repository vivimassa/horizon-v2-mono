import type { TimetableFlight } from './logic'
import { formatDurationHm } from './logic'

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const HEADERS = [
  'Flight',
  'From',
  'Departs (Local)',
  'To',
  'Arrives (Local)',
  'Duration',
  'Aircraft',
  'Seats',
  'Days',
  'Effective From',
  'Effective To',
] as const

interface ExportContext {
  flights: TimetableFlight[]
  periodFrom: string
  periodTo: string
  operatorName: string
  fromCity: string
  toCity: string
}

function formatDays(daysOfWeek: string): string {
  return DOW_LABELS.map((d, i) => (daysOfWeek.includes(String(i + 1)) ? d : '-')).join('')
}

function buildRows(flights: TimetableFlight[]): string[][] {
  return flights.map((f) => {
    const arr =
      f.arrivalDayOffset !== 0
        ? `${f.staLocal}${f.arrivalDayOffset > 0 ? `+${f.arrivalDayOffset}` : f.arrivalDayOffset}`
        : f.staLocal
    return [
      f.flightNumber,
      f.depStation,
      f.stdLocal,
      f.arrStation,
      arr,
      formatDurationHm(f.blockMinutes),
      f.aircraftName || f.aircraftTypeIcao,
      f.paxCapacity ? String(f.paxCapacity) : '',
      formatDays(f.daysOfWeek),
      f.effectiveFrom,
      f.effectiveUntil,
    ]
  })
}

function downloadBlob(content: string | ArrayBuffer | BlobPart, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCsv(ctx: ExportContext): void {
  const rows = buildRows(ctx.flights)
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = [HEADERS.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  downloadBlob(csv, `public-timetable-${ctx.periodFrom}-${ctx.periodTo}.csv`, 'text/csv;charset=utf-8')
}

export async function exportXlsx(ctx: ExportContext): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Public Timetable')

  const rows = buildRows(ctx.flights)

  const titleRow = ws.addRow([`${ctx.operatorName} — Public Timetable`])
  titleRow.font = { bold: true, size: 13 }
  ws.mergeCells(1, 1, 1, HEADERS.length)

  const subtitle = ws.addRow([`${ctx.fromCity} → ${ctx.toCity}    Period: ${ctx.periodFrom} – ${ctx.periodTo}`])
  subtitle.font = { size: 10, color: { argb: 'FF606170' } }
  ws.mergeCells(2, 1, 2, HEADERS.length)

  ws.addRow([])

  const headerRow = ws.addRow([...HEADERS])
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
  headerRow.alignment = { vertical: 'middle' }

  for (const r of rows) ws.addRow(r)

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: HEADERS.length } }

  ws.columns.forEach((col, i) => {
    const maxLen = Math.max(HEADERS[i].length, ...rows.map((r) => (r[i] ?? '').length))
    col.width = Math.min(Math.max(maxLen + 4, 10), 32)
  })

  ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 0, activeCell: 'A5' }]

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    buf,
    `public-timetable-${ctx.periodFrom}-${ctx.periodTo}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

export async function exportPdf(ctx: ExportContext): Promise<void> {
  const jsPDFModule = await import('jspdf')
  const jsPDF = jsPDFModule.default
  const autoTable = (await import('jspdf-autotable')).default

  const rows = buildRows(ctx.flights)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const ACCENT: [number, number, number] = [37, 99, 235]

  let pageCounter = 0
  const didDrawPage = () => {
    pageCounter++
    const page = pageCounter

    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.8)
    doc.line(10, 8, pageW - 10, 8)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text('Public Timetable', pageW / 2, 15, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `${ctx.fromCity} → ${ctx.toCity}    ${ctx.periodFrom} - ${ctx.periodTo}    |    ${ctx.operatorName}`,
      pageW / 2,
      20,
      { align: 'center' },
    )

    doc.setFontSize(6.5)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 10, 12, { align: 'right' })

    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.6)
    doc.line(10, pageH - 10, pageW - 10, pageH - 10)

    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`Page ${page}`, pageW - 10, pageH - 6, { align: 'right' })
    doc.text(`${rows.length} flights`, 10, pageH - 6)
  }

  autoTable(doc, {
    head: [[...HEADERS]],
    body: rows,
    startY: 24,
    margin: { top: 24, left: 10, right: 10, bottom: 14 },
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
      textColor: [40, 40, 40],
      lineColor: [200, 200, 210],
      lineWidth: 0.15,
      halign: 'center',
    },
    headStyles: {
      fillColor: [239, 246, 255],
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage,
  })

  doc.save(`public-timetable-${ctx.periodFrom}-${ctx.periodTo}.pdf`)
}
