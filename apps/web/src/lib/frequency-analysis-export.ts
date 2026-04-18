/**
 * Frequency Analysis — Export utilities (CSV, XLSX, PDF).
 * Mirrors apps/web/src/lib/daily-schedule-export.ts; one row per unique
 * flight definition (deduplicated by scheduled-flight id).
 */

import { formatDate, type DateFormatType } from '@/lib/date-format'
import { freqFromDow, fmtHM } from '@/components/network/frequency-analysis/compute-frequency'
import type { FrequencyFlightRow } from '@/components/network/frequency-analysis/frequency-analysis-types'

interface ExportContext {
  /** Deduplicated flight definitions (one per scheduled-flight id). */
  flights: FrequencyFlightRow[]
  /** Full instance list, used to count total departures per flight. */
  instances: FrequencyFlightRow[]
  dateFormat: DateFormatType
  periodFrom: string
  periodTo: string
  operatorName: string
}

const COLUMNS = [
  'Flight',
  'Route',
  'Route Type',
  'DEP',
  'ARR',
  'STD',
  'STA',
  'Type',
  'Service',
  'DOW',
  'Freq/wk',
  'Block',
  'Weekly Hrs',
  'Total Deps',
  'Period From',
  'Period To',
] as const

function buildRows(ctx: ExportContext): { headers: string[]; rows: string[][] } {
  const depCountByFlight = new Map<string, number>()
  for (const i of ctx.instances) depCountByFlight.set(i.id, (depCountByFlight.get(i.id) ?? 0) + 1)

  const rows = ctx.flights.map((f): string[] => {
    const freq = freqFromDow(f.daysOfOperation)
    const weeklyMin = freq * f.blockMinutes
    const deps = depCountByFlight.get(f.id) ?? 0
    return [
      f.flightNumber,
      `${f.depStation}-${f.arrStation}`,
      f.routeType ? f.routeType.toUpperCase() : '',
      f.depStation,
      f.arrStation,
      f.stdUtc,
      f.staUtc,
      f.icaoType,
      f.serviceType,
      f.daysOfOperation,
      String(freq),
      fmtHM(f.blockMinutes),
      fmtHM(weeklyMin),
      String(deps),
      formatDate(f.periodStart, ctx.dateFormat),
      formatDate(f.periodEnd, ctx.dateFormat),
    ]
  })

  return { headers: [...COLUMNS], rows }
}

/* ── CSV ─────────────────────────────────────────────────── */

export function exportCsv(ctx: ExportContext): void {
  const { headers, rows } = buildRows(ctx)
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  downloadBlob(csv, `frequency-analysis-${ctx.periodFrom}-${ctx.periodTo}.csv`, 'text/csv;charset=utf-8')
}

/* ── XLSX ────────────────────────────────────────────────── */

export async function exportXlsx(ctx: ExportContext): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Frequency Analysis')

  const { headers, rows } = buildRows(ctx)

  const headerRow = ws.addRow(headers)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
  headerRow.alignment = { vertical: 'middle' }

  for (const row of rows) ws.addRow(row)

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  ws.columns.forEach((col, i) => {
    const maxLen = Math.max(headers[i].length, ...rows.map((r) => (r[i] ?? '').length))
    col.width = Math.min(Math.max(maxLen + 4, 10), 30)
  })
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    buf,
    `frequency-analysis-${ctx.periodFrom}-${ctx.periodTo}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

/* ── PDF ─────────────────────────────────────────────────── */

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
  const logoAlias = 'skyhub-logo'
  let logoAdded = false

  let pageCounter = 0
  const didDrawPage = () => {
    pageCounter += 1
    const page = pageCounter

    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.8)
    doc.line(10, 8, pageW - 10, 8)

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

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 30, 30)
    doc.text('Frequency Analysis', pageW / 2, 15, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `${formatDate(ctx.periodFrom, ctx.dateFormat)} - ${formatDate(ctx.periodTo, ctx.dateFormat)}  |  ${ctx.operatorName}`,
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
    alternateRowStyles: { fillColor: [248, 248, 252] },
    didDrawPage,
  })

  doc.save(`frequency-analysis-${ctx.periodFrom}-${ctx.periodTo}.pdf`)
}

/* ── Download helper ─────────────────────────────────────── */

function downloadBlob(content: string | ArrayBuffer | BlobPart, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
