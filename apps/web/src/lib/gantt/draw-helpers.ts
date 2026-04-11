import type { BarLayout, RowLayout, TickMark } from './types'
import { SLOT_STATUS_COLORS, SLOT_RISK_COLORS } from './colors'

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
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  isDark: boolean,
  accentColor?: string,
) {
  // Weekend shading — faint accent-tinted columns for Saturday & Sunday
  const majorTicks = ticks.filter((t) => t.isMajor && t.date)
  for (let i = 0; i < majorTicks.length; i++) {
    const tick = majorTicks[i]
    const jsDay = new Date(tick.date! + 'T12:00:00Z').getUTCDay()
    if (jsDay !== 0 && jsDay !== 6) continue // only Sat (6) and Sun (0)
    const nextX =
      i + 1 < majorTicks.length
        ? majorTicks[i + 1].x
        : tick.x + (majorTicks[1]?.x ?? tick.x + 200) - (majorTicks[0]?.x ?? 0)
    const dayW = nextX - tick.x
    if (tick.x + dayW < sx || tick.x > sx + vw) continue
    ctx.fillStyle = accentColor ? hexToRgba(accentColor, 0.15) : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    ctx.fillRect(tick.x, sy, dayW, vh)
  }

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
      ? isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(0,0,0,0.08)'
      : isDark
        ? 'rgba(255,255,255,0.03)'
        : 'rgba(0,0,0,0.03)'
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
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  isDark: boolean,
) {
  ctx.textBaseline = 'middle'
  for (const row of rows) {
    if (row.type !== 'group_header' && row.type !== 'unassigned') continue
    if (row.y + row.height < sy || row.y > sy + vh) continue

    ctx.fillStyle = row.color
      ? hexToRgba(row.color, isDark ? 0.05 : 0.04)
      : isDark
        ? 'rgba(255,255,255,0.02)'
        : 'rgba(0,0,0,0.02)'
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
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  swapSourceIds?: Set<string>,
) {
  const visR = sx + vw
  const visB = sy + vh

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

    const isSwapSource = swapSourceIds?.has(bar.flightId)

    // Selected ring + glow — skip if swap source (swap border takes priority)
    if (isSelected && !isSwapSource) {
      ctx.strokeStyle = '#FF3B3B'
      ctx.lineWidth = 2
      rr(ctx, bar.x - 1, bar.y - 1, bar.width + 2, bar.height + 2, 5)
      ctx.stroke()
      ctx.save()
      ctx.shadowColor = 'rgba(255,59,59,0.4)'
      ctx.shadowBlur = 8
      ctx.strokeStyle = 'rgba(255,59,59,0.3)'
      rr(ctx, bar.x - 1, bar.y - 1, bar.width + 2, bar.height + 2, 5)
      ctx.stroke()
      ctx.restore()
    }

    // Swap source: orange dashed border (overrides selection ring)
    if (isSwapSource) {
      ctx.save()
      ctx.strokeStyle = '#FF8800'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      rr(ctx, bar.x - 1, bar.y - 1, bar.width + 2, bar.height + 2, 5)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.shadowColor = 'rgba(255,136,0,0.35)'
      ctx.shadowBlur = 6
      ctx.strokeStyle = 'rgba(255,136,0,0.25)'
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

    // Label (only if wide enough) — font scales with bar height
    if (bar.width >= 30) {
      const fs = bar.height >= 48 ? 14 : bar.height >= 36 ? 12 : 11
      ctx.fillStyle = bar.textColor
      ctx.font = `700 ${fs}px "JetBrains Mono", ui-monospace, monospace`
      ctx.fillText(bar.label, bar.x + 6, bar.y + bar.height / 2)
    }
  }
}

// ── TAT labels between consecutive bars ──

// ── Pre-sorted bars by row (call once per layout change, reuse across draw calls) ──

export function buildBarsByRow(bars: BarLayout[]): Map<number, BarLayout[]> {
  const map = new Map<number, BarLayout[]>()
  for (const b of bars) {
    const list = map.get(b.row) ?? []
    list.push(b)
    map.set(b.row, list)
  }
  // Pre-sort each row by x position
  for (const rowBars of map.values()) {
    rowBars.sort((a, b) => a.x - b.x)
  }
  return map
}

export function drawTatLabels(
  ctx: CanvasRenderingContext2D,
  barsByRow: Map<number, BarLayout[]>,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  isDark: boolean,
) {
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)'
  ctx.font = '400 9px "JetBrains Mono", ui-monospace, monospace'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  const visB = sy + vh

  for (const rowBars of barsByRow.values()) {
    if (rowBars.length < 2) continue
    // Skip rows entirely off-screen vertically
    const firstY = rowBars[0].y
    if (firstY + rowBars[0].height < sy || firstY > visB) continue

    for (let i = 0; i < rowBars.length - 1; i++) {
      const curr = rowBars[i]
      const next = rowBars[i + 1]
      const gap = next.x - (curr.x + curr.width)
      if (gap < 25) continue
      if (next.x < sx || curr.x + curr.width > sx + vw) continue

      const tatMs = next.flight.stdUtc - curr.flight.staUtc
      if (tatMs <= 0) continue
      const tatMin = Math.round(tatMs / 60_000)
      if (tatMin >= 180) continue
      const label = `${String(Math.floor(tatMin / 60)).padStart(2, '0')}:${String(tatMin % 60).padStart(2, '0')}`

      ctx.fillText(label, curr.x + curr.width + gap / 2, curr.y + curr.height / 2)
    }
  }
  ctx.textAlign = 'left'
}

// ── Night-stop labels ──

const NIGHTSTOP_MIN_GAP = 240

// Text measurement cache — survives across frames, cleared on font change
const _measureCache = new Map<string, number>()

function cachedMeasure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = font + '|' + text
  let w = _measureCache.get(key)
  if (w === undefined) {
    ctx.font = font
    w = ctx.measureText(text).width
    _measureCache.set(key, w)
    // Prevent unbounded growth
    if (_measureCache.size > 500) _measureCache.clear()
  }
  return w
}

export function drawNightstopLabels(
  ctx: CanvasRenderingContext2D,
  barsByRow: Map<number, BarLayout[]>,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  isDark: boolean,
) {
  const textColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const bgColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const stationFont = '700 10px "Inter", system-ui, sans-serif'
  const timeFont = '400 10px "Inter", system-ui, sans-serif'

  const visB = sy + vh

  for (const rowBars of barsByRow.values()) {
    if (rowBars.length < 2) continue
    const firstY = rowBars[0].y
    if (firstY + rowBars[0].height < sy || firstY > visB) continue

    for (let i = 0; i < rowBars.length - 1; i++) {
      const curr = rowBars[i]
      const next = rowBars[i + 1]

      const gapMs = next.flight.stdUtc - curr.flight.staUtc
      const gapMin = Math.round(gapMs / 60_000)
      if (gapMin < NIGHTSTOP_MIN_GAP) continue

      const gapPx = next.x - (curr.x + curr.width)
      if (gapPx < 40) continue

      const gapLeft = curr.x + curr.width
      const gapRight = next.x
      if (gapRight < sx || gapLeft > sx + vw) continue

      const station = curr.flight.arrStation
      const gapH = Math.floor(gapMin / 60)
      const gapM = gapMin % 60
      const timeLabel = gapMin >= 60 ? `${gapH}:${String(gapM).padStart(2, '0')}` : `${gapMin}m`

      // Cached text measurements
      const stationW = cachedMeasure(ctx, station, stationFont)
      const sepW = cachedMeasure(ctx, ' \u2022 ', timeFont)
      const timeW = cachedMeasure(ctx, timeLabel, timeFont)
      const totalW = stationW + sepW + timeW + 12

      const centerX = gapLeft + gapPx / 2
      const centerY = curr.y + curr.height / 2
      const badgeX = centerX - totalW / 2
      const badgeH = 18
      const badgeY = centerY - badgeH / 2

      ctx.fillStyle = bgColor
      rr(ctx, badgeX, badgeY, totalW, badgeH, 6)
      ctx.fill()

      ctx.strokeStyle = borderColor
      ctx.lineWidth = 0.5
      rr(ctx, badgeX, badgeY, totalW, badgeH, 6)
      ctx.stroke()

      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      let tx = badgeX + 6

      ctx.font = stationFont
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.60)'
      ctx.fillText(station, tx, centerY)
      tx += stationW

      ctx.font = timeFont
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'
      ctx.fillText(' \u2022 ', tx, centerY)
      tx += sepW

      ctx.fillStyle = textColor
      ctx.fillText(timeLabel, tx, centerY)
    }
  }
  ctx.textAlign = 'left'
}

// ── Now-line ──

export function drawNowLine(ctx: CanvasRenderingContext2D, nowX: number, totalHeight: number) {
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

// ── Drag & Drop visuals ──

/** Dashed outlines at the original position of dragged bars */
export function drawDragGhosts(
  ctx: CanvasRenderingContext2D,
  bars: BarLayout[],
  dragFlightIds: Set<string>,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
) {
  ctx.save()
  ctx.strokeStyle = 'rgba(100,100,100,0.35)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  for (const bar of bars) {
    if (!dragFlightIds.has(bar.flightId)) continue
    if (bar.x + bar.width < sx || bar.x > sx + vw) continue
    if (bar.y + bar.height < sy || bar.y > sy + vh) continue
    rr(ctx, bar.x, bar.y, bar.width, bar.height, 4)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()
}

/** Semi-transparent bars following the cursor during drag */
export function drawDraggedBars(
  ctx: CanvasRenderingContext2D,
  bars: BarLayout[],
  dragFlightIds: Set<string>,
  deltaY: number,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
) {
  ctx.save()
  ctx.globalAlpha = 0.65
  for (const bar of bars) {
    if (!dragFlightIds.has(bar.flightId)) continue
    const dy = bar.y + deltaY
    if (bar.x + bar.width < sx || bar.x > sx + vw) continue
    if (dy + bar.height < sy || dy > sy + vh) continue

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.20)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4

    ctx.fillStyle = bar.color
    rr(ctx, bar.x, dy, bar.width, bar.height, 4)
    ctx.fill()

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Label
    if (bar.width > 20) {
      ctx.fillStyle = bar.textColor
      ctx.font = '500 11px "Inter", system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      const maxW = bar.width - 6
      ctx.fillText(bar.label, bar.x + bar.width / 2, dy + bar.height / 2, maxW)
      ctx.textAlign = 'left'
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

/** Highlight the target aircraft row during drag */
export function drawDropTarget(
  ctx: CanvasRenderingContext2D,
  rows: RowLayout[],
  targetRowIdx: number,
  validity: 'valid' | 'cross-type' | 'invalid',
  sx: number,
  vw: number,
) {
  if (targetRowIdx < 0 || targetRowIdx >= rows.length) return
  const row = rows[targetRowIdx]

  const colors = {
    valid: { bg: 'rgba(59,130,246,0.06)', border: '#3B82F6' },
    'cross-type': { bg: 'rgba(255,136,0,0.06)', border: '#FF8800' },
    invalid: { bg: 'rgba(239,68,68,0.06)', border: '#EF4444' },
  }
  const c = colors[validity]

  // Row background highlight
  ctx.fillStyle = c.bg
  ctx.fillRect(sx, row.y, vw, row.height)

  // Left accent bar
  ctx.fillStyle = c.border
  ctx.fillRect(sx, row.y, 3, row.height)
}

// ── Slot Status Indicators ──

/**
 * Draw a corner flag in the top-right of flight bars that have a linked slot status.
 * The flag is a filled triangle whose 90-degree corner follows the bar's border radius,
 * creating a seamless "folded corner" effect.
 *
 *   Bar top-right corner:
 *          ╭──────╮
 *          │  ◣   │  ← colored triangle fills the corner
 *          │      │
 *
 * The curved edge uses an arc matching the bar's 4px radius.
 */
export function drawSlotIndicators(
  ctx: CanvasRenderingContext2D,
  bars: BarLayout[],
  sx: number,
  sy: number,
  vw: number,
  vh: number,
) {
  const BAR_RADIUS = 4
  const FLAG_SIZE = 12 // triangle leg length

  for (const bar of bars) {
    const status = bar.flight.slotStatus
    if (!status) continue

    // Hide "safe" flags to reduce visual noise — only show close / at_risk
    const riskLevel = bar.flight.slotRiskLevel
    if (riskLevel === 'safe') continue

    // Use risk-level color if available, otherwise fall back to slot status color
    const color = riskLevel ? SLOT_RISK_COLORS[riskLevel] : SLOT_STATUS_COLORS[status]
    if (!color) continue

    // Skip bars outside viewport
    // Note: canvas is already translated by (-sx, -sy), so use bar coords directly
    if (bar.x + bar.width < sx || bar.x > sx + vw || bar.y + bar.height < sy || bar.y > sy + vh) continue

    // Slightly larger flag for at-risk flights, clamped so tiny bars
    // don't get a flag that overflows the bar
    const baseFlag = riskLevel === 'at_risk' ? 14 : FLAG_SIZE
    const flagSize = Math.max(4, Math.min(baseFlag, bar.width, bar.height))
    const radius = Math.min(BAR_RADIUS, flagSize)

    // Top-right corner of the bar
    const rx = bar.x + bar.width
    const ty = bar.y

    ctx.save()

    // Pulse animation for at-risk flights
    if (riskLevel === 'at_risk') {
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(Date.now() / 400)
    }

    ctx.beginPath()
    ctx.moveTo(rx - flagSize, ty)
    ctx.lineTo(rx - radius, ty)
    ctx.arc(rx - radius, ty + radius, radius, -Math.PI / 2, 0)
    ctx.lineTo(rx, ty + flagSize)
    ctx.closePath()

    ctx.fillStyle = color
    ctx.fill()

    ctx.restore()
  }
}
