import type { BarLayout, RowLayout, TickMark } from './types'

// ── Helpers ──

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.rect(x, y, w, h)
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Grid ──

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  ticks: TickMark[],
  rows: RowLayout[],
  sx: number, sy: number,
  vw: number, vh: number,
  isDark: boolean,
) {
  // Horizontal row separators
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  ctx.lineWidth = 0.5
  for (const row of rows) {
    const y = row.y + row.height
    if (y < sy - 1 || y > sy + vh + 1) continue
    ctx.beginPath()
    ctx.moveTo(sx, y)
    ctx.lineTo(sx + vw, y)
    ctx.stroke()
  }

  // Vertical tick lines
  for (const tick of ticks) {
    if (tick.x < sx - 1 || tick.x > sx + vw + 1) continue
    ctx.strokeStyle = tick.isMajor
      ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
      : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
    ctx.lineWidth = tick.isMajor ? 0.8 : 0.5
    ctx.beginPath()
    ctx.moveTo(tick.x, sy)
    ctx.lineTo(tick.x, sy + vh)
    ctx.stroke()
  }
}

// ── Group header backgrounds ──

export function drawGroupHeaders(
  ctx: CanvasRenderingContext2D,
  rows: RowLayout[],
  sx: number, sy: number,
  vw: number, vh: number,
  isDark: boolean,
) {
  ctx.textBaseline = 'middle'
  for (const row of rows) {
    if (row.type !== 'group_header' && row.type !== 'unassigned') continue
    if (row.y + row.height < sy || row.y > sy + vh) continue

    ctx.fillStyle = row.color
      ? hexToRgba(row.color, isDark ? 0.05 : 0.04)
      : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
    ctx.fillRect(sx, row.y, vw, row.height)

    // Pinned label in canvas area
    ctx.fillStyle = isDark ? 'rgba(194,198,217,0.4)' : 'rgba(55,65,81,0.3)'
    ctx.font = '600 11px Inter, system-ui, sans-serif'
    ctx.fillText(row.label, sx + 12, row.y + row.height / 2)
  }
}

// ── Flight bars ──

export function drawBars(
  ctx: CanvasRenderingContext2D,
  bars: BarLayout[],
  selectedIds: Set<string>,
  hoveredId: string | null,
  sx: number, sy: number,
  vw: number, vh: number,
) {
  const visR = sx + vw
  const visB = sy + vh

  // Set font once for all bar labels
  ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'

  for (const bar of bars) {
    if (bar.x + bar.width < sx || bar.x > visR) continue
    if (bar.y + bar.height < sy || bar.y > visB) continue

    const isSelected = selectedIds.has(bar.flightId)
    const isHovered = bar.flightId === hoveredId

    // Fill
    ctx.fillStyle = bar.color
    rr(ctx, bar.x, bar.y, bar.width, bar.height, 4)
    ctx.fill()

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(bar.x + 1, bar.y + 1, bar.width - 2, bar.height * 0.4)

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 0.5
    rr(ctx, bar.x, bar.y, bar.width, bar.height, 4)
    ctx.stroke()

    // Selected ring + glow (expensive — only 1-3 bars)
    if (isSelected) {
      ctx.strokeStyle = '#0061FF'
      ctx.lineWidth = 2
      rr(ctx, bar.x - 1, bar.y - 1, bar.width + 2, bar.height + 2, 5)
      ctx.stroke()
      ctx.save()
      ctx.shadowColor = 'rgba(0,97,255,0.4)'
      ctx.shadowBlur = 8
      ctx.strokeStyle = 'rgba(0,97,255,0.3)'
      rr(ctx, bar.x - 1, bar.y - 1, bar.width + 2, bar.height + 2, 5)
      ctx.stroke()
      ctx.restore()
    }

    // Hover brightness
    if (isHovered && !isSelected) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      rr(ctx, bar.x, bar.y, bar.width, bar.height, 4)
      ctx.fill()
    }

    // Label (only if wide enough)
    if (bar.width >= 30) {
      ctx.fillStyle = bar.textColor
      ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace'
      ctx.fillText(bar.label, bar.x + 6, bar.y + bar.height / 2)
    }
  }
}

// ── TAT labels between consecutive bars ──

export function drawTatLabels(
  ctx: CanvasRenderingContext2D,
  bars: BarLayout[],
  sx: number,
  vw: number,
  isDark: boolean,
) {
  const barsByRow = new Map<number, BarLayout[]>()
  for (const b of bars) {
    const list = barsByRow.get(b.row) ?? []
    list.push(b)
    barsByRow.set(b.row, list)
  }

  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)'
  ctx.font = '400 9px "JetBrains Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  for (const rowBars of barsByRow.values()) {
    if (rowBars.length < 2) continue
    const sorted = [...rowBars].sort((a, b) => a.x - b.x)
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i]
      const next = sorted[i + 1]
      const gap = next.x - (curr.x + curr.width)
      if (gap < 25) continue
      if (next.x < sx || curr.x + curr.width > sx + vw) continue

      const tatMs = next.flight.stdUtc - curr.flight.staUtc
      if (tatMs <= 0) continue
      const tatMin = Math.round(tatMs / 60_000)
      const label = tatMin >= 60
        ? `${Math.floor(tatMin / 60)}h${tatMin % 60 > 0 ? String(tatMin % 60) + 'm' : ''}`
        : `${tatMin}m`

      ctx.fillText(label, curr.x + curr.width + gap / 2, curr.y + curr.height / 2)
    }
  }
  ctx.textAlign = 'left'
}

// ── Now-line ──

export function drawNowLine(
  ctx: CanvasRenderingContext2D,
  nowX: number,
  totalHeight: number,
) {
  ctx.strokeStyle = '#0061FF'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(nowX, 0)
  ctx.lineTo(nowX, totalHeight)
  ctx.stroke()

  ctx.fillStyle = '#0061FF'
  ctx.beginPath()
  ctx.arc(nowX, 0, 4, 0, Math.PI * 2)
  ctx.fill()
}
