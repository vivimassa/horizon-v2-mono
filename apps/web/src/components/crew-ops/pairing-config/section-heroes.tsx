'use client'

/**
 * Inline SVG hero illustrations for 4.1.5.4 Pairing Configurations.
 * Pattern cloned from 7.1.5.2 ACARS/MVT/LDM Transmission hero bank — same
 * HeroFrame geometry, same HeroTitle block, same grid + radial-glow backdrop.
 * Kept module-accent-driven so it feels native under the Workforce family.
 */

interface HeroProps {
  accent: string
  isDark: boolean
}

const HERO_HEIGHT = 180

/* ── Base frame shared by every hero ── */
function HeroFrame({ accent, isDark, children }: HeroProps & { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl mb-6"
      style={{
        height: HERO_HEIGHT,
        background: isDark
          ? `linear-gradient(135deg, ${accent}22 0%, ${accent}08 40%, rgba(25,25,33,0.4) 100%)`
          : `linear-gradient(135deg, ${accent}18 0%, ${accent}08 40%, rgba(255,255,255,0.4) 100%)`,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
      }}
    >
      {/* Radial glow bottom-right */}
      <div
        className="absolute pointer-events-none"
        aria-hidden
        style={{
          right: -60,
          bottom: -60,
          width: 320,
          height: 320,
          background: `radial-gradient(circle, ${accent}33 0%, transparent 60%)`,
          filter: 'blur(24px)',
        }}
      />
      {/* Fine grid overlay (subtle) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.18]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at right, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at right, black 0%, transparent 70%)',
        }}
      />
      {children}
    </div>
  )
}

/* ── Shared title block ── */
function HeroTitle({
  accent,
  isDark,
  eyebrow,
  title,
  caption,
}: HeroProps & { eyebrow: string; title: string; caption: string }) {
  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 max-w-[55%]">
      <div className="text-[13px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: accent }}>
        {eyebrow}
      </div>
      <h2
        className="text-[20px] font-bold tracking-tight leading-tight mb-1.5"
        style={{ color: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.95)' }}
      >
        {title}
      </h2>
      <p
        className="text-[13px] leading-relaxed"
        style={{ color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(71,85,105,0.80)' }}
      >
        {caption}
      </p>
    </div>
  )
}

/* ── 1. Aircraft Change Ground Time — tail swap over a stopwatch ── */
export function AircraftChangeHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const body = isDark ? '#13131A' : '#FAFAFC'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-8 top-1/2 -translate-y-1/2"
        width="240"
        height="150"
        viewBox="0 0 240 150"
        aria-hidden
      >
        {/* Runway baseline */}
        <line x1="10" y1="118" x2="230" y2="118" stroke={dim} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

        {/* Inbound aircraft (leaving gate) — tail A, left side */}
        <g transform="translate(38 60)">
          {/* Fuselage */}
          <ellipse cx="0" cy="0" rx="32" ry="6" fill={`${accent}44`} stroke={accent} strokeWidth="1.3" />
          {/* Wings */}
          <path d="M -8 -1 L -22 -12 L -14 -12 L 0 -1 Z" fill={accent} opacity="0.7" />
          <path d="M -8 1 L -22 12 L -14 12 L 0 1 Z" fill={accent} opacity="0.7" />
          {/* Tail */}
          <path d="M 28 -1 L 34 -10 L 32 -1 Z" fill={accent} />
          {/* Nose */}
          <circle cx="-30" cy="0" r="2.5" fill={accent} />
          {/* Tail tag "A" */}
          <text x="28" y="-14" fontSize="9" fontWeight="700" fill={accent} fontFamily="ui-monospace, monospace">
            SK-H403
          </text>
          {/* Departure arrow */}
          <path
            d="M -38 18 L -58 18"
            stroke={accent}
            strokeWidth="1.5"
            strokeDasharray="3 2"
            fill="none"
            opacity="0.7"
          />
          <polygon points="-58,15 -64,18 -58,21" fill={accent} opacity="0.7" />
        </g>

        {/* Stopwatch / ground-time centerpiece */}
        <g transform="translate(120 60)">
          {/* Crown */}
          <rect x="-3" y="-38" width="6" height="6" rx="1" fill={accent} />
          {/* Body */}
          <circle r="26" fill={body} stroke={accent} strokeWidth="2" />
          <circle r="26" fill="none" stroke={accent} strokeWidth="4" strokeDasharray="18 80" opacity="0.7" />
          {/* Tick marks */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
            const ang = (i / 12) * Math.PI * 2 - Math.PI / 2
            const r1 = 22
            const r2 = 25
            return (
              <line
                key={i}
                x1={Math.cos(ang) * r1}
                y1={Math.sin(ang) * r1}
                x2={Math.cos(ang) * r2}
                y2={Math.sin(ang) * r2}
                stroke={dim}
                strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
                opacity={i % 3 === 0 ? 0.8 : 0.5}
              />
            )
          })}
          {/* Hands — minute at 45m, hour near 12 */}
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-18"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            transform="rotate(270)"
          />
          <line x1="0" y1="0" x2="0" y2="-12" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <circle r="2" fill={accent} />
          {/* Label below */}
          <text
            x="0"
            y="44"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fill={accent}
          >
            MIN GT
          </text>
        </g>

        {/* Outbound aircraft (new tail) — tail B, right side */}
        <g transform="translate(202 60)">
          {/* Fuselage */}
          <ellipse cx="0" cy="0" rx="32" ry="6" fill={`${accent}22`} stroke={accent} strokeWidth="1.3" />
          {/* Wings */}
          <path d="M 8 -1 L 22 -12 L 14 -12 L 0 -1 Z" fill={accent} opacity="0.5" />
          <path d="M 8 1 L 22 12 L 14 12 L 0 1 Z" fill={accent} opacity="0.5" />
          {/* Tail (opposite orientation) */}
          <path d="M -28 -1 L -34 -10 L -32 -1 Z" fill={accent} opacity="0.85" />
          {/* Nose */}
          <circle cx="30" cy="0" r="2.5" fill={accent} />
          {/* Tail tag "B" */}
          <text
            x="-28"
            y="-14"
            fontSize="9"
            fontWeight="700"
            textAnchor="end"
            fill={accent}
            fontFamily="ui-monospace, monospace"
          >
            SK-H436
          </text>
          {/* Departure arrow */}
          <path d="M 38 18 L 58 18" stroke={accent} strokeWidth="1.5" strokeDasharray="3 2" fill="none" opacity="0.7" />
          <polygon points="58,15 64,18 58,21" fill={accent} opacity="0.7" />
        </g>

        {/* Swap indicator arcs between aircraft and clock */}
        <path d="M 78 56 Q 100 40 115 52" stroke={accent} strokeWidth="1.3" fill="none" opacity="0.7" />
        <polygon points="113,50 118,52 114,55" fill={accent} opacity="0.7" />
        <path d="M 162 52 Q 180 40 196 56" stroke={accent} strokeWidth="1.3" fill="none" opacity="0.7" />
        <polygon points="194,54 199,56 196,59" fill={accent} opacity="0.7" />

        {/* Segment labels — DOM / INTL pills below each aircraft */}
        <g transform="translate(38 130)">
          <rect x="-22" y="-8" width="44" height="14" rx="7" fill={`${accent}22`} stroke={accent} strokeWidth="0.8" />
          <text
            x="0"
            y="2"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={accent}
            letterSpacing="0.08em"
          >
            DOM
          </text>
        </g>
        <g transform="translate(202 130)">
          <rect x="-22" y="-8" width="44" height="14" rx="7" fill={`${accent}22`} stroke={accent} strokeWidth="0.8" />
          <text
            x="0"
            y="2"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={accent}
            letterSpacing="0.08em"
          >
            INTL
          </text>
        </g>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Aircraft change · Soft rule"
        title="Provide sufficient time for crew to swap aircraft"
        caption="Enforce a minimum turnaround when the tail changes between legs — scoped by domestic or international sector."
      />
    </HeroFrame>
  )
}
