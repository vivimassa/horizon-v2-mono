'use client'

/**
 * GCS dialog hero illustrations.
 *
 * Every hero renders inside a 240×72 viewBox so the SVGs share a baseline
 * and slot into `DialogShell`'s 104 px hero band consistently. The
 * positioning drawer's hero (in `flight-booking-drawer.tsx`) follows the
 * same conventions — they all use `var(--module-accent)` for the leading
 * stroke / fill so the operator's tenant accent flows through.
 *
 * Visual grammar shared by all heroes:
 *   - Clean line-art over fill
 *   - Soft white rim stroke (`rgba(255,255,255,0.45)`) for contrast on dark
 *   - Subtle ground-shadow ellipses where the icon "rests"
 *   - Optional accent dots / dashes for motion / sequence
 */

const ACCENT = 'var(--module-accent)'
const RIM = 'rgba(255,255,255,0.50)'
const SHADOW = 'rgba(0,0,0,0.45)'

function HeroSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="240" height="72" viewBox="0 0 240 72" aria-hidden>
      {children}
    </svg>
  )
}

/** Map-pin teardrop primitive — used by the temp-base hero and the
 *  positioning drawer. Tip anchored at (cx, baselineY). */
function MapPin({ cx, baselineY }: { cx: number; baselineY: number }) {
  return (
    <g transform={`translate(${cx - 12} ${baselineY - 22})`}>
      <ellipse cx="12" cy="22.5" rx="6" ry="1.4" fill={SHADOW} opacity="0.6" />
      <path d="M12 22s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z" fill={ACCENT} opacity="0.95" />
      <path d="M12 22s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z" fill="none" stroke={RIM} strokeWidth="0.8" />
      <circle cx="12" cy="10" r="2.8" fill="rgba(0,0,0,0.55)" />
      <circle cx="12" cy="10" r="2.8" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" />
    </g>
  )
}

/* ── Temporary Base — re-base flow: pin + chevron + pin ──────────── */
export function TempBaseHero() {
  return (
    <HeroSvg>
      <MapPin cx={20} baselineY={64} />
      <MapPin cx={220} baselineY={64} />
      {/* Dashed arc connecting the two pins */}
      <path
        d="M 20 64 Q 120 14 220 64"
        stroke={ACCENT}
        strokeWidth="1.4"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.55"
      />
      {/* Mid-arc chevron pointing toward destination */}
      <path
        d="M 110 26 L 124 32 L 110 38"
        stroke={ACCENT}
        strokeWidth="1.6"
        fill="none"
        opacity="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Breadcrumb dots along the arc */}
      {[0.2, 0.35, 0.65, 0.8].map((t, i) => {
        const x = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 120 + t * t * 220
        const y = (1 - t) * (1 - t) * 64 + 2 * (1 - t) * t * 14 + t * t * 64
        return <circle key={i} cx={x} cy={y} r="1.4" fill={ACCENT} opacity="0.45" />
      })}
    </HeroSvg>
  )
}

/* ── Override — shield with caution stripe + check ───────────────── */
export function OverrideHero() {
  return (
    <HeroSvg>
      {/* Ground shadow */}
      <ellipse cx="120" cy="68" rx="36" ry="2" fill={SHADOW} opacity="0.5" />
      {/* Shield body */}
      <g transform="translate(120 36)">
        <path
          d="M 0 -28 L 24 -20 L 24 4 Q 24 18 0 28 Q -24 18 -24 4 L -24 -20 Z"
          fill={ACCENT}
          opacity="0.18"
          stroke={ACCENT}
          strokeWidth="1.6"
        />
        {/* Diagonal caution stripe */}
        <path
          d="M -22 0 L 22 0"
          stroke={ACCENT}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.5"
          transform="rotate(-30)"
        />
        {/* Inner check mark */}
        <path
          d="M -8 -2 L -2 4 L 9 -8"
          stroke={ACCENT}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {/* Side warning triangles fading out */}
      {[
        { x: 50, op: 0.45 },
        { x: 200, op: 0.45 },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x} 36)`} opacity={t.op}>
          <path d="M 0 -10 L 9 6 L -9 6 Z" fill="none" stroke={ACCENT} strokeWidth="1.2" />
          <line x1="0" y1="-4" x2="0" y2="2" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="0" cy="4.5" r="0.8" fill={ACCENT} />
        </g>
      ))}
    </HeroSvg>
  )
}

/* ── Blocked — lock + slash ──────────────────────────────────────── */
export function BlockedHero() {
  return (
    <HeroSvg>
      <ellipse cx="120" cy="68" rx="40" ry="2" fill={SHADOW} opacity="0.5" />
      {/* Lock body */}
      <g transform="translate(120 38)">
        <rect
          x="-16"
          y="-6"
          width="32"
          height="24"
          rx="4"
          fill={ACCENT}
          opacity="0.18"
          stroke={ACCENT}
          strokeWidth="1.6"
        />
        {/* Shackle */}
        <path
          d="M -10 -6 L -10 -16 A 10 10 0 1 1 10 -16 L 10 -6"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Keyhole */}
        <circle cx="0" cy="4" r="2.2" fill={ACCENT} />
        <rect x="-1" y="4" width="2" height="6" fill={ACCENT} />
      </g>
      {/* Side prohibition rings */}
      {[60, 180].map((cx, i) => (
        <g key={i} transform={`translate(${cx} 38)`} opacity="0.45">
          <circle r="11" fill="none" stroke={ACCENT} strokeWidth="1.3" />
          <line x1="-8" y1="-8" x2="8" y2="8" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      ))}
    </HeroSvg>
  )
}

/* ── Legality — balance scale ────────────────────────────────────── */
export function LegalityHero() {
  return (
    <HeroSvg>
      <ellipse cx="120" cy="68" rx="44" ry="2" fill={SHADOW} opacity="0.5" />
      <g transform="translate(120 38)">
        {/* Vertical post */}
        <line x1="0" y1="-22" x2="0" y2="22" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
        {/* Base */}
        <line x1="-14" y1="22" x2="14" y2="22" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" />
        {/* Horizontal beam */}
        <line x1="-22" y1="-18" x2="22" y2="-18" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
        {/* Left pan */}
        <line x1="-22" y1="-18" x2="-32" y2="-2" stroke={ACCENT} strokeWidth="0.9" opacity="0.55" />
        <line x1="-22" y1="-18" x2="-12" y2="-2" stroke={ACCENT} strokeWidth="0.9" opacity="0.55" />
        <path d="M -34 -2 Q -22 8 -10 -2 Z" fill={ACCENT} opacity="0.18" stroke={ACCENT} strokeWidth="1.4" />
        {/* Right pan */}
        <line x1="22" y1="-18" x2="32" y2="-2" stroke={ACCENT} strokeWidth="0.9" opacity="0.55" />
        <line x1="22" y1="-18" x2="12" y2="-2" stroke={ACCENT} strokeWidth="0.9" opacity="0.55" />
        <path d="M 10 -2 Q 22 8 34 -2 Z" fill={ACCENT} opacity="0.18" stroke={ACCENT} strokeWidth="1.4" />
        {/* Pivot */}
        <circle cx="0" cy="-18" r="2" fill={ACCENT} />
      </g>
    </HeroSvg>
  )
}

/* ── Pairing details — pairing pill + leg breadcrumbs ─────────────── */
export function PairingDetailsHero() {
  return (
    <HeroSvg>
      <ellipse cx="120" cy="68" rx="60" ry="2" fill={SHADOW} opacity="0.4" />
      {/* Pairing pill */}
      <g transform="translate(40 38)">
        <rect
          x="-30"
          y="-12"
          width="60"
          height="24"
          rx="12"
          fill={ACCENT}
          opacity="0.20"
          stroke={ACCENT}
          strokeWidth="1.4"
        />
        <text
          x="0"
          y="4"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill={ACCENT}
        >
          PRG
        </text>
      </g>
      {/* Leg breadcrumb dots + connecting line */}
      <line x1="80" y1="38" x2="220" y2="38" stroke={ACCENT} strokeDasharray="4 3" strokeWidth="1.2" opacity="0.5" />
      {[100, 130, 160, 190, 220].map((cx, i) => (
        <g key={i} transform={`translate(${cx} 38)`}>
          <circle r="6" fill="rgba(0,0,0,0.4)" stroke={ACCENT} strokeWidth="1.4" />
          <circle r="2" fill={ACCENT} />
        </g>
      ))}
    </HeroSvg>
  )
}

/* ── Flight schedule changes — two clocks with delta arrow ────────── */
export function FlightChangesHero() {
  return (
    <HeroSvg>
      <ellipse cx="120" cy="68" rx="56" ry="2" fill={SHADOW} opacity="0.4" />
      {/* Old (planned) clock */}
      <g transform="translate(70 38)" opacity="0.6">
        <circle r="22" fill="none" stroke={ACCENT} strokeWidth="1.4" />
        {[0, 90, 180, 270].map((a) => (
          <line key={a} x1="0" y1="-19" x2="0" y2="-22" stroke={ACCENT} strokeWidth="1.2" transform={`rotate(${a})`} />
        ))}
        {/* Hands at 10:10 */}
        <line x1="0" y1="0" x2="-10" y2="-10" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
        <line x1="0" y1="0" x2="9" y2="-2" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
        <circle r="1.8" fill={ACCENT} />
      </g>
      {/* Delta arrow */}
      <g transform="translate(120 38)">
        <line x1="-22" y1="0" x2="22" y2="0" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M 14 -6 L 22 0 L 14 6"
          stroke={ACCENT}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="0"
          y="-8"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill={ACCENT}
        >
          Δ
        </text>
      </g>
      {/* New (revised) clock */}
      <g transform="translate(170 38)">
        <circle r="22" fill="none" stroke={ACCENT} strokeWidth="1.4" />
        {[0, 90, 180, 270].map((a) => (
          <line key={a} x1="0" y1="-19" x2="0" y2="-22" stroke={ACCENT} strokeWidth="1.2" transform={`rotate(${a})`} />
        ))}
        {/* Hands at 11:00 */}
        <line x1="0" y1="0" x2="-3" y2="-13" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="0" y1="0" x2="0" y2="-15" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
        <circle r="1.8" fill={ACCENT} />
      </g>
    </HeroSvg>
  )
}

/* ── Assign pairing — ring of seats with one filling ──────────────── */
export function AssignPairingHero() {
  // 6 seats around a centre node; index 1 (top-right) lit as the new fill.
  const seats = [
    { x: 120, y: 14, fill: false },
    { x: 168, y: 30, fill: true }, // newly filled
    { x: 168, y: 60, fill: false },
    { x: 120, y: 70, fill: false },
    { x: 72, y: 60, fill: false },
    { x: 72, y: 30, fill: false },
  ]
  return (
    <HeroSvg>
      {/* Centre node */}
      <circle cx="120" cy="44" r="6" fill={ACCENT} opacity="0.85" />
      <circle cx="120" cy="44" r="11" fill="none" stroke={ACCENT} strokeWidth="1" opacity="0.45" />
      {/* Spokes */}
      {seats.map((s, i) => (
        <line
          key={i}
          x1="120"
          y1="44"
          x2={s.x}
          y2={s.y}
          stroke={ACCENT}
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.35"
        />
      ))}
      {/* Seat circles — empty rings except the newly-filled one */}
      {seats.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <circle
            r="7"
            fill={s.fill ? ACCENT : 'rgba(0,0,0,0.4)'}
            stroke={ACCENT}
            strokeWidth="1.4"
            opacity={s.fill ? 0.95 : 0.6}
          />
          {s.fill && (
            <path
              d="M -2.5 -0.2 L -0.5 1.8 L 3 -1.7"
              stroke="white"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      ))}
    </HeroSvg>
  )
}

/* ── Assign series — calendar grid with sweep fill ─────────────────── */
export function AssignSeriesHero() {
  // 6×3 grid. Highlight a contiguous range across two rows to suggest
  // "batch fill across consecutive dates".
  const cellW = 22
  const cellH = 16
  const gridX = 96
  const gridY = 14
  const filledIdx = new Set([3, 4, 5, 9, 10, 11])
  return (
    <HeroSvg>
      {/* Calendar header bar */}
      <rect x={gridX - 2} y={gridY - 6} width={6 * cellW + 4} height="6" rx="2" fill={ACCENT} opacity="0.85" />
      {/* Grid cells */}
      {Array.from({ length: 18 }).map((_, i) => {
        const r = Math.floor(i / 6)
        const c = i % 6
        const filled = filledIdx.has(i)
        return (
          <rect
            key={i}
            x={gridX + c * cellW}
            y={gridY + r * cellH}
            width={cellW - 2}
            height={cellH - 2}
            rx="2"
            fill={filled ? ACCENT : 'rgba(0,0,0,0.35)'}
            stroke={ACCENT}
            strokeWidth="0.8"
            opacity={filled ? 0.85 : 0.45}
          />
        )
      })}
      {/* Sweep arrow indicating batch direction */}
      <path
        d="M 70 32 L 92 32"
        stroke={ACCENT}
        strokeWidth="1.6"
        fill="none"
        strokeDasharray="3 2"
        opacity="0.7"
        strokeLinecap="round"
      />
      <path
        d="M 86 26 L 94 32 L 86 38"
        stroke={ACCENT}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </HeroSvg>
  )
}
