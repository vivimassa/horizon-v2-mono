/**
 * Daily Flight Schedule — Export utilities (CSV, XLSX, PDF)
 * Client-side generation. PDF includes SkyHub logo on every page.
 */

import type { Flight } from '@skyhub/api'
import type { TimeMode, ColumnId } from '@/stores/use-daily-schedule-store'
import { utcMsToHhmm, applyOffset, COLUMN_DEFS } from '@/stores/use-daily-schedule-store'
import type { DateFormatType } from '@/lib/date-format'
import { formatDate } from '@/lib/date-format'

/* ── Types ── */

interface ExportContext {
  flights: Flight[]
  visibleColumns: ColumnId[]
  activeModes: TimeMode[]
  homeBaseOffset: number
  airportMap: Record<string, { utcOffset: number; countryId: string | null }>
  regToTypeMap: Record<string, string>
  dateFormat: DateFormatType
  periodFrom: string
  periodTo: string
  operatorName: string
}

/* ── Shared cell builder ── */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildCellValue(flight: Flight, colId: ColumnId, ctx: ExportContext): string {
  switch (colId) {
    case 'date':
      return formatDate(flight.operatingDate, ctx.dateFormat)
    case 'dow': {
      const d = new Date(flight.operatingDate + 'T00:00:00Z')
      return DOW[d.getUTCDay()]
    }
    case 'flt':
      return flight.flightNumber
    case 'dep':
      return flight.dep.iata || flight.dep.icao
    case 'arr':
      return flight.arr.iata || flight.arr.icao
    case 'std':
    case 'sta': {
      const ms = colId === 'std' ? flight.schedule.stdUtc : flight.schedule.staUtc
      if (!ms) return ''
      const utcHhmm = utcMsToHhmm(ms)
      const stationIcao = colId === 'std' ? flight.dep.icao : flight.arr.icao
      const stationOffset = ctx.airportMap[stationIcao]?.utcOffset ?? 0
      return ctx.activeModes
        .map((mode) => {
          const { time, dayShift } =
            mode === 'utc'
              ? { time: utcHhmm, dayShift: 0 }
              : mode === 'localBase'
                ? applyOffset(utcHhmm, ctx.homeBaseOffset)
                : applyOffset(utcHhmm, stationOffset)
          return dayShift ? `${time}${dayShift > 0 ? '+1' : '-1'}` : time
        })
        .join(' / ')
    }
    case 'block': {
      if (!flight.schedule.stdUtc || !flight.schedule.staUtc) return ''
      const mins = Math.round((flight.schedule.staUtc - flight.schedule.stdUtc) / 60000)
      return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
    }
    case 'acType': {
      const acType =
        flight.tail.icaoType || (flight.tail.registration ? ctx.regToTypeMap[flight.tail.registration] : null)
      return acType ?? ''
    }
    case 'acReg':
      return flight.tail.registration ?? ''
    case 'svc':
      return 'J'
    case 'route': {
      const depC = ctx.airportMap[flight.dep.icao]?.countryId
      const arrC = ctx.airportMap[flight.arr.icao]?.countryId
      return depC != null && depC === arrC ? 'DOM' : 'INT'
    }
    case 'atd':
    case 'tkof':
    case 'tdown':
    case 'ata': {
      const ms =
        colId === 'atd'
          ? flight.actual?.atdUtc
          : colId === 'tkof'
            ? flight.actual?.offUtc
            : colId === 'tdown'
              ? flight.actual?.onUtc
              : flight.actual?.ataUtc
      if (!ms) return ''
      return utcMsToHhmm(ms)
    }
    case 'paxExp':
    case 'paxAct': {
      const isExp = colId === 'paxExp'
      const p = flight.pax
      const total =
        ((isExp ? p?.adultExpected : p?.adultActual) ?? 0) +
        ((isExp ? p?.childExpected : p?.childActual) ?? 0) +
        ((isExp ? p?.infantExpected : p?.infantActual) ?? 0)
      const lopa = flight.lopa?.cabins ?? []
      const lopaStr = lopa.length ? lopa.map((c) => c.seats).join('/') : ''
      if (!total) return lopaStr ? `0 (${lopaStr})` : ''
      return lopaStr ? `${total} (${lopaStr})` : String(total)
    }
    case 'lf': {
      const p = flight.pax
      const act = (p?.adultActual ?? 0) + (p?.childActual ?? 0) + (p?.infantActual ?? 0)
      const seats = flight.lopa?.totalSeats ?? 0
      if (!seats) return ''
      return `${Math.round((act / seats) * 1000) / 10}%`
    }
    case 'fuelInitial':
    case 'fuelUplift':
    case 'fuelBurn':
    case 'fuelPlan': {
      const f = flight.fuel
      const v =
        colId === 'fuelInitial'
          ? f?.initial
          : colId === 'fuelUplift'
            ? f?.uplift
            : colId === 'fuelBurn'
              ? f?.burn
              : f?.flightPlan
      if (v == null) return ''
      return String(Math.round(v))
    }
    default:
      return ''
  }
}

function buildRows(ctx: ExportContext): { headers: string[]; rows: string[][] } {
  const headers = ctx.visibleColumns.map((id) => {
    const def = COLUMN_DEFS.find((d) => d.id === id)!
    if ((id === 'std' || id === 'sta') && ctx.activeModes.length > 1) {
      const labels: Record<TimeMode, string> = { utc: 'UTC', localBase: 'Base', localStation: 'Lcl' }
      return `${def.label} (${ctx.activeModes.map((m) => labels[m]).join('/')})`
    }
    return def.label
  })
  const rows = ctx.flights.map((f) => ctx.visibleColumns.map((c) => buildCellValue(f, c, ctx)))
  return { headers, rows }
}

/* ── CSV ── */

export function exportCsv(ctx: ExportContext): void {
  const { headers, rows } = buildRows(ctx)
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  downloadBlob(csv, `daily-schedule-${ctx.periodFrom}-${ctx.periodTo}.csv`, 'text/csv;charset=utf-8')
}

/* ── XLSX ── */

export async function exportXlsx(ctx: ExportContext): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Daily Schedule')

  const { headers, rows } = buildRows(ctx)

  // Header row
  const headerRow = ws.addRow(headers)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
  headerRow.alignment = { vertical: 'middle' }

  // Data rows
  for (const row of rows) {
    ws.addRow(row)
  }

  // Auto-filter
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  // Column widths
  ws.columns.forEach((col, i) => {
    const maxLen = Math.max(headers[i].length, ...rows.map((r) => (r[i] ?? '').length))
    col.width = Math.min(Math.max(maxLen + 4, 10), 30)
  })

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    buf,
    `daily-schedule-${ctx.periodFrom}-${ctx.periodTo}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

/* ── PDF ── */

let logoCache: { data: string; w: number; h: number } | null = null

async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  if (logoCache) return logoCache
  try {
    const resp = await fetch('/skyhub-logo.png')
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          // Downscale to max 120px width for smaller file size
          const maxW = 120
          const scale = Math.min(1, maxW / img.width)
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const c = canvas.getContext('2d')!
          c.fillStyle = '#fff'
          c.fillRect(0, 0, w, h)
          c.drawImage(img, 0, 0, w, h)
          const data = canvas.toDataURL('image/jpeg', 0.7)
          logoCache = { data, w, h }
          resolve(logoCache)
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function exportPdf(ctx: ExportContext): Promise<void> {
  const jsPDFModule = await import('jspdf')
  const jsPDF = jsPDFModule.default
  const autoTable = (await import('jspdf-autotable')).default

  const { headers, rows } = buildRows(ctx)
  const logo = await loadLogo()

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const ACCENT: [number, number, number] = [30, 64, 175]

  // Add logo image ONCE to the PDF document, then reference by alias on each page
  const logoAlias = 'skyhub-logo'
  let logoAdded = false

  let pageCounter = 0
  const didDrawPage = () => {
    pageCounter++
    const page = pageCounter

    // Top accent line
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.8)
    doc.line(10, 8, pageW - 10, 8)

    // Logo — add once, reuse alias
    if (logo) {
      const logoH = 8
      const logoW = (logo.w / logo.h) * logoH
      if (!logoAdded) {
        doc.addImage(logo.data, 'JPEG', 10, 10, logoW, logoH, logoAlias, 'FAST')
        logoAdded = true
      } else {
        doc.addImage(logoAlias, 'JPEG', 10, 10, logoW, logoH)
      }
    }

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text('Daily Flight Schedule', pageW / 2, 15, { align: 'center' })

    // Period
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `${formatDate(ctx.periodFrom, ctx.dateFormat)} - ${formatDate(ctx.periodTo, ctx.dateFormat)}  |  ${ctx.operatorName}`,
      pageW / 2,
      20,
      { align: 'center' },
    )

    // Generated timestamp
    doc.setFontSize(6.5)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 10, 12, { align: 'right' })

    // Bottom accent line
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.6)
    doc.line(10, pageH - 10, pageW - 10, pageH - 10)

    // Page number
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`Page ${page}`, pageW - 10, pageH - 6, { align: 'right' })

    // Row count
    doc.text(`${rows.length} records`, 10, pageH - 6)
  }

  // Table
  autoTable(doc, {
    head: [headers],
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
      fillColor: [240, 240, 245],
      textColor: [60, 60, 70],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 252],
    },
    didDrawPage,
  })

  doc.save(`daily-schedule-${ctx.periodFrom}-${ctx.periodTo}.pdf`)
}

/* ── Download helper ── */

function downloadBlob(content: string | ArrayBuffer | BlobPart, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
