import type { RouteRow } from '@/components/network/schedule-summary/schedule-summary-types'
import { formatBlockTime, formatLargeNumber } from '@/components/network/schedule-summary/compute-schedule-summary'

export interface ScheduleSummaryExportContext {
  rows: RouteRow[]
  periodFrom: string
  periodTo: string
  operatorName: string
}

const HEADERS = ['Route', 'Dist (km)', 'Block', 'Freq/wk', 'Types', 'Seats/wk', 'ASK/wk', 'Hrs/wk', 'Share']

function buildRows(rows: RouteRow[]): string[][] {
  return rows.map((r) => [
    r.route,
    r.distanceKm > 0 ? r.distanceKm.toString() : '—',
    formatBlockTime(r.blockMinutes),
    r.weeklyFreq.toString(),
    r.types.join(', '),
    r.weeklySeats.toString(),
    formatLargeNumber(r.weeklyAsk),
    r.weeklyBlockHrs.toFixed(1),
    `${r.sharePct}%`,
  ])
}

function downloadBlob(data: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportCsv(ctx: ScheduleSummaryExportContext): number {
  const rows = buildRows(ctx.rows)
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = [HEADERS.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  downloadBlob(csv, `schedule-summary-${ctx.periodFrom}-${ctx.periodTo}.csv`, 'text/csv;charset=utf-8')
  return rows.length
}

export async function exportXlsx(ctx: ScheduleSummaryExportContext): Promise<number> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Schedule Summary')

  const rows = buildRows(ctx.rows)

  const headerRow = ws.addRow(HEADERS)
  headerRow.font = { bold: true, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
  headerRow.alignment = { vertical: 'middle' }

  for (const row of rows) ws.addRow(row)

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } }
  ws.columns.forEach((col, i) => {
    const maxLen = Math.max(HEADERS[i].length, ...rows.map((r) => (r[i] ?? '').length))
    col.width = Math.min(Math.max(maxLen + 4, 10), 30)
  })
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    buf,
    `schedule-summary-${ctx.periodFrom}-${ctx.periodTo}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  return rows.length
}

let logoCache: { data: string; w: number; h: number } | null = null

async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  if (logoCache) return logoCache
  try {
    const resp = await fetch('/skyhub-logo.png')
    const blob = await resp.blob()
    return await new Promise((resolve) => {
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

export async function exportPdf(ctx: ScheduleSummaryExportContext): Promise<number> {
  const jsPDF = (await import('jspdf')).default
  const autoTable = (await import('jspdf-autotable')).default

  const rows = buildRows(ctx.rows)
  const logo = await loadLogo()

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const ACCENT: [number, number, number] = [30, 64, 175]

  const logoAlias = 'skyhub-logo'
  let logoAdded = false
  let pageCounter = 0

  const didDrawPage = () => {
    pageCounter++
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
    doc.text('Schedule Summary', pageW / 2, 15, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`${ctx.periodFrom} - ${ctx.periodTo}  |  ${ctx.operatorName}`, pageW / 2, 20, { align: 'center' })

    doc.setFontSize(6.5)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 10, 12, { align: 'right' })

    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.6)
    doc.line(10, pageH - 10, pageW - 10, pageH - 10)
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`Page ${pageCounter}`, pageW - 10, pageH - 6, { align: 'right' })
    doc.text(`${rows.length} routes`, 10, pageH - 6)
  }

  autoTable(doc, {
    head: [HEADERS],
    body: rows,
    startY: 24,
    margin: { top: 24, left: 10, right: 10, bottom: 14 },
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      textColor: [40, 40, 40],
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: ACCENT,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    didDrawPage,
  })

  doc.save(`schedule-summary-${ctx.periodFrom}-${ctx.periodTo}.pdf`)
  return rows.length
}
