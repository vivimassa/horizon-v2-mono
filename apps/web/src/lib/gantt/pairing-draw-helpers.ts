import type { PackedPairing } from './pairing-types'

/**
 * Canvas-2D draw primitives for the Pairing Zone deck. Called from a RAF
 * loop in `pairing-gantt-canvas.tsx`. Each function expects the context to
 * already be transformed for devicePixelRatio and translated for scroll.
 */

/** Strip the 2-letter airline prefix from a flight number so pairing-zone
 *  pills render the same way as Movement Control flight bars (e.g. "SH102"
 *  → "102"). Kept in sync with AIRLINE_PREFIX_RE in layout-engine.ts. */
const AIRLINE_PREFIX_RE = /^[A-Z]{2}\s?-?/
function stripAirlinePrefix(flightNumber: string): string {
  return flightNumber.replace(AIRLINE_PREFIX_RE, '')
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.rect(x, y, w, h)
  }
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Background: divider line + bg tint + lane rules. Drawn first. */
export function drawPairingZoneBg(ctx: CanvasRenderingContext2D, width: number, height: number, isDark: boolean) {
  // Zone bg tint
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)'
  ctx.fillRect(0, 0, width, height)

  // Top divider line (1px)
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  ctx.fillRect(0, 0, width, 1)
}

/** Faint horizontal separator between lanes. */
export function drawPairingLaneRules(
  ctx: CanvasRenderingContext2D,
  scrollX: number,
  viewportW: number,
  maxLane: number,
  topOffset: number,
  isDark: boolean,
  laneHeight: number,
) {
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
  ctx.lineWidth = 0.5
  for (let i = 1; i < maxLane; i++) {
    const y = topOffset + i * laneHeight
    ctx.beginPath()
    ctx.moveTo(scrollX, y)
    ctx.lineTo(scrollX + viewportW, y)
    ctx.stroke()
  }
}

export interface DrawPillsState {
  inspectedPairingId: string | null
  hoveredPairingId: string | null
  isDark: boolean
  accentColor: string
  labelMode: 'flightNo' | 'sector'
  pillHeight: number
  laneHeight: number
}

export function drawPairingPills(
  ctx: CanvasRenderingContext2D,
  packed: PackedPairing[],
  scrollX: number,
  viewportW: number,
  topOffset: number,
  state: DrawPillsState,
) {
  const { inspectedPairingId, hoveredPairingId, isDark, accentColor, labelMode, pillHeight, laneHeight } = state
  const viewportR = scrollX + viewportW

  // Match the flight-bar font ladder so pairing pill text reads identically
  // to the bars above them at every zoom level.
  const fs = pillHeight >= 48 ? 11 : pillHeight >= 36 ? 10 : pillHeight >= 28 ? 9 : 8

  // Stripe pattern for deadhead pills — created once per draw call only when needed.
  let dhPattern: CanvasPattern | null = null
  const hasDh = packed.some((p) => p.pills.some((pill) => pill.isDeadhead))
  if (hasDh) {
    const off = document.createElement('canvas')
    off.width = 8
    off.height = 8
    const sCtx = off.getContext('2d')
    if (sCtx) {
      sCtx.strokeStyle = 'rgba(255,255,255,0.45)'
      sCtx.lineWidth = 2
      sCtx.beginPath()
      sCtx.moveTo(0, 8)
      sCtx.lineTo(8, 0)
      sCtx.moveTo(-4, 8)
      sCtx.lineTo(4, 0)
      sCtx.moveTo(4, 8)
      sCtx.lineTo(12, 0)
      sCtx.stroke()
      dhPattern = ctx.createPattern(off, 'repeat')
    }
  }

  for (const p of packed) {
    if (p.xMax < scrollX || p.xMin > viewportR) continue

    const y = topOffset + p.lane * laneHeight + (laneHeight - pillHeight) / 2
    const isInspected = p.pairingId === inspectedPairingId
    const isHovered = p.pairingId === hoveredPairingId

    // Fill / border palette by state
    let fill: string
    let border: string
    let text: string
    if (p.isBroken || p.status === 'violation') {
      fill = isDark ? 'rgba(239,68,68,0.72)' : 'rgba(220,38,38,0.72)'
      border = '#DC2626'
      text = '#ffffff'
    } else if (isInspected) {
      fill = accentColor
      border = accentColor
      text = '#ffffff'
    } else if (p.status === 'warning') {
      fill = isDark ? 'rgba(217,119,6,0.6)' : 'rgba(217,119,6,0.48)'
      border = '#D97706'
      text = isDark ? '#ffffff' : '#111827'
    } else {
      fill = isDark ? 'rgba(100,116,139,0.45)' : 'rgba(100,116,139,0.28)'
      border = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.55)'
      text = isDark ? '#E5E7EB' : '#1F2937'
    }
    if (isHovered && !isInspected) {
      // brighten on hover
      fill = hexToRgba(border, 0.6)
    }

    // Connectors first (so pills overlap them)
    for (const conn of p.connectors) {
      if (conn.width <= 0) continue
      const cy = y + pillHeight / 2
      ctx.strokeStyle = conn.isLegal ? (isDark ? 'rgba(34,197,94,0.5)' : 'rgba(22,163,74,0.6)') : 'rgba(239,68,68,0.75)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(conn.x, cy)
      ctx.lineTo(conn.x + conn.width, cy)
      ctx.stroke()
    }

    // Pills
    for (const pill of p.pills) {
      if (pill.x + pill.width < scrollX || pill.x > viewportR) continue

      const isDh = pill.isDeadhead
      const pillFill = isDh ? '#1E293B' : fill
      const pillText = isDh ? '#94A3B8' : text
      const pillBorder = isDh ? 'rgba(148,163,184,0.35)' : border

      ctx.fillStyle = pillFill
      rr(ctx, pill.x, y, pill.width, pillHeight, 4)
      ctx.fill()

      // Border
      ctx.strokeStyle = pillBorder
      ctx.lineWidth = isInspected ? 1.5 : 0.75
      rr(ctx, pill.x, y, pill.width, pillHeight, 4)
      ctx.stroke()

      // Deadhead stripe overlay — dark slate + diagonal light lines.
      if (isDh && dhPattern) {
        ctx.save()
        rr(ctx, pill.x + 1, y + 1, pill.width - 2, pillHeight - 2, 3)
        ctx.clip()
        ctx.fillStyle = dhPattern
        ctx.fillRect(pill.x, y, pill.width, pillHeight)
        ctx.restore()
      }

      // Label (if width allows). Mirrors the Movement Control flight-bar
      // label: 2-letter airline prefix stripped so "SH102" renders as "102"
      // and pairing pills read the same as the bars they sit below. In
      // sector mode, narrow pills that can't fit "DEP-ARR" on a single
      // line switch to a two-row stack (DEP on top, ARR on bottom).
      if (pill.width > 14) {
        ctx.fillStyle = pillText
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        const maxTextW = pill.width - 4
        const cx = pill.x + pill.width / 2
        const cy = y + pillHeight / 2

        if (labelMode === 'sector') {
          ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
          const single = `${pill.depStation}-${pill.arrStation}`
          if (ctx.measureText(single).width <= maxTextW) {
            ctx.fillText(single, cx, cy + 0.5)
          } else {
            // Stacked — two rows, each shrunk so they both fit vertically.
            const smallFs = Math.max(8, Math.min(fs, Math.floor((pillHeight - 2) / 2)))
            ctx.font = `600 ${smallFs}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
            const depFits = ctx.measureText(pill.depStation).width <= maxTextW
            const arrFits = ctx.measureText(pill.arrStation).width <= maxTextW
            const lineGap = smallFs + 1
            if (depFits) ctx.fillText(pill.depStation, cx, cy - lineGap / 2)
            if (arrFits) ctx.fillText(pill.arrStation, cx, cy + lineGap / 2)
          }
        } else {
          ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
          const label = stripAirlinePrefix(pill.flightNumber)
          let drawn = label
          if (ctx.measureText(label).width > maxTextW) {
            drawn = ''
            for (let n = label.length - 1; n > 0; n--) {
              const candidate = label.slice(0, n) + '…'
              if (ctx.measureText(candidate).width <= maxTextW) {
                drawn = candidate
                break
              }
            }
          }
          if (drawn) ctx.fillText(drawn, cx, cy + 0.5)
        }
      }
    }

    // Glow on inspected pairing (drawn last on this pairing)
    if (isInspected) {
      ctx.save()
      ctx.shadowColor = hexToRgba(accentColor, 0.45)
      ctx.shadowBlur = 10
      ctx.strokeStyle = hexToRgba(accentColor, 0.0)
      for (const pill of p.pills) {
        rr(ctx, pill.x, y, pill.width, pillHeight, 4)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Unlink icon glyph for broken chain — render a small red "⚬" at the tail
    if (p.isBroken && p.pills.length > 0) {
      const last = p.pills[p.pills.length - 1]
      const gx = last.x + last.width + 4
      const gy = y + pillHeight / 2
      ctx.fillStyle = '#EF4444'
      ctx.beginPath()
      ctx.arc(gx, gy, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Overlay that dims non-connectable bars in build mode. No-op if no build active. */
export function drawBuildModeDim(
  ctx: CanvasRenderingContext2D,
  bars: Array<{ x: number; y: number; width: number; height: number; flightId: string }>,
  connectableIds: Set<string> | null,
  scrollX: number,
  scrollY: number,
  viewportW: number,
  viewportH: number,
) {
  if (!connectableIds) return
  const vr = scrollX + viewportW
  const vb = scrollY + viewportH
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  for (const bar of bars) {
    if (connectableIds.has(bar.flightId)) continue
    if (bar.x + bar.width < scrollX || bar.x > vr) continue
    if (bar.y + bar.height < scrollY || bar.y > vb) continue
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height)
  }
  ctx.restore()
}

/** Highlight band for tail search on a specific row. */
export function drawSearchHighlightRow(
  ctx: CanvasRenderingContext2D,
  rowY: number,
  rowH: number,
  scrollX: number,
  viewportW: number,
  phase: number,
) {
  // Phase: 0..1. Alpha = 0.35 until phase=0.8, then fade to 0 by phase=1.
  const alpha = phase < 0.8 ? 0.35 : 0.35 * (1 - (phase - 0.8) / 0.2)
  if (alpha <= 0) return
  ctx.fillStyle = `rgba(245,158,11,${alpha})`
  ctx.fillRect(scrollX, rowY, viewportW, rowH)
}
