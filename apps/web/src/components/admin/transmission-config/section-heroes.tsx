'use client'

/**
 * Inline SVG hero illustrations for 7.1.5.2 ACARS/MVT/LDM Transmission.
 * Pattern cloned from 2.1.3.3 Disruption Customization hero bank
 * (apps/web/src/components/disruption-center/customization/section-heroes.tsx).
 * All heroes are theme-aware and use the module accent so they feel
 * native to the System Administration module family.
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

/* ── 1. Scheduler — Sonar pulse + digital clock ── */
export function SchedulerHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-10 top-1/2 -translate-y-1/2"
        width="170"
        height="140"
        viewBox="0 0 170 140"
        aria-hidden
      >
        {/* Sonar pulse rings */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="85"
            cy="70"
            r={18 + i * 16}
            fill="none"
            stroke={accent}
            strokeWidth="1.2"
            opacity={0.6 - i * 0.18}
          />
        ))}
        {/* Digital clock body */}
        <rect
          x="45"
          y="50"
          width="80"
          height="40"
          rx="8"
          fill={isDark ? '#13131A' : '#FAFAFC'}
          stroke={accent}
          strokeWidth="1.5"
        />
        {/* Digits */}
        <text
          x="85"
          y="78"
          fontSize="22"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill={accent}
        >
          05:00
        </text>
        {/* Pulse dots on the edge of the outermost ring */}
        <circle cx="135" cy="70" r="3" fill={accent} />
        <circle cx="35" cy="70" r="3" fill={accent} opacity="0.5" />
        {/* Radio signal wedges */}
        <path d="M 150 60 Q 158 70 150 80" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.6" />
        <path d="M 20 60 Q 12 70 20 80" stroke={dim} strokeWidth="1.5" fill="none" opacity="0.4" />
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Outbound automation"
        title="Tell the scheduler when to fire"
        caption="Interval, review window and allowlist govern every background sweep."
      />
    </HeroFrame>
  )
}

/* ── 2. Validation — Funnel with ✓ and ✗ exits ── */
export function ValidationHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Incoming arrows */}
        {[36, 56, 76, 96].map((y, i) => (
          <g key={i}>
            <line x1="6" y1={y} x2="48" y2={y} stroke={accent} strokeWidth="1.2" opacity={0.3 + i * 0.1} />
            <polygon points={`46,${y - 3} 52,${y} 46,${y + 3}`} fill={accent} opacity={0.3 + i * 0.1} />
          </g>
        ))}
        {/* Funnel */}
        <polygon points="58,20 158,20 128,70 88,70" fill={`${accent}22`} stroke={accent} strokeWidth="1.5" />
        <polygon points="88,70 128,70 122,110 94,110" fill={dim} stroke={accent} strokeWidth="1.5" opacity="0.7" />
        {/* Three rule bars inside the funnel */}
        {[30, 40, 50].map((y, i) => (
          <line
            key={i}
            x1={68 + i * 4}
            y1={y}
            x2={148 - i * 4}
            y2={y}
            stroke={accent}
            strokeWidth="1.5"
            opacity="0.6"
          />
        ))}
        {/* Accepted (check) */}
        <g transform="translate(100 124)">
          <circle r="10" fill="#06C270" opacity="0.18" stroke="#06C270" strokeWidth="1.2" />
          <path
            d="M -4 0 L -1 3 L 4 -3"
            stroke="#06C270"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {/* Rejected (X), pushed aside */}
        <g transform="translate(170 92)">
          <circle r="10" fill="#E63535" opacity="0.18" stroke="#E63535" strokeWidth="1.2" />
          <line x1="-4" y1="-4" x2="4" y2="4" stroke="#E63535" strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="-4" x2="-4" y2="4" stroke="#E63535" strokeWidth="2" strokeLinecap="round" />
        </g>
        {/* Rejection arrow */}
        <path
          d="M 135 58 Q 155 70 165 82"
          stroke="#E63535"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray="3 2"
          opacity="0.7"
        />
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Inbound quality gate"
        title="Reject bad messages before it touches ops"
        caption="Future timestamps, out-of-order events, and duplicate echos never land."
      />
    </HeroFrame>
  )
}

/* ── 3. Source priority — Ranked lanes ── */
export function OverwriteHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const labelDim = isDark ? '#8F90A6' : '#555770'
  const lanes = [
    { label: 'Manual', rank: 1, fill: `${accent}55` },
    { label: 'MVT', rank: 2, fill: `${accent}33` },
    { label: 'ACARS', rank: 3, fill: `${accent}18` },
  ]
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-10 top-1/2 -translate-y-1/2"
        width="200"
        height="140"
        viewBox="0 0 200 140"
        aria-hidden
      >
        {/* Lane rows */}
        {lanes.map((l, i) => {
          const y = 18 + i * 34
          return (
            <g key={l.label}>
              {/* Rank pill */}
              <circle cx="18" cy={y + 12} r="11" fill={l.fill} stroke={accent} strokeWidth="1" opacity={1 - i * 0.15} />
              <text
                x="18"
                y={y + 16}
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="system-ui"
                fill={accent}
              >
                {l.rank}
              </text>
              {/* Lane bar */}
              <rect
                x="36"
                y={y}
                width={140 - i * 10}
                height="24"
                rx="6"
                fill={l.fill}
                stroke={i === 0 ? accent : 'transparent'}
                strokeWidth={i === 0 ? 1.5 : 0}
              />
              <text
                x="46"
                y={y + 16}
                fontSize="11"
                fontWeight="600"
                fontFamily="system-ui"
                fill={i === 0 ? accent : labelDim}
              >
                {l.label}
              </text>
              {/* Overwrite arrows to the lane above */}
              {i < 2 && (
                <path
                  d={`M 170 ${y + 28} Q 180 ${y + 17} 170 ${y + 6}`}
                  stroke={accent}
                  strokeWidth="1"
                  fill="none"
                  opacity={0.5 - i * 0.2}
                  strokeDasharray="3 2"
                />
              )}
            </g>
          )
        })}
        {/* Crown-style indicator on lane 1 */}
        <g transform="translate(176 24)">
          <path d="M 0 4 L 4 0 L 8 4 L 12 0 L 16 4 L 16 10 L 0 10 Z" fill={accent} opacity="0.85" />
        </g>
        {/* Vertical priority scale */}
        <line x1="194" y1="14" x2="194" y2="116" stroke={dim} strokeWidth="1" />
        <text x="198" y="22" fontSize="8" fill={labelDim} fontFamily="monospace">
          HI
        </text>
        <text x="198" y="114" fontSize="8" fill={labelDim} fontFamily="monospace">
          LO
        </text>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Source priority"
        title="Decide who wins a collision"
        caption="Manual always beats automation by default. Bend the rules per source."
      />
    </HeroFrame>
  )
}

/* ── 4. Inbound access — Key slotting into a lock ── */
export function InboundAccessHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-8 top-1/2 -translate-y-1/2"
        width="220"
        height="140"
        viewBox="0 0 220 140"
        aria-hidden
      >
        {/* Incoming connection line with dashes */}
        <line x1="10" y1="70" x2="70" y2="70" stroke={accent} strokeWidth="1.4" strokeDasharray="5 3" />
        <circle cx="10" cy="70" r="4" fill={accent} />

        {/* Key — bow (head) + stem + teeth */}
        <g transform="translate(70 70)">
          {/* Bow (circular head) */}
          <circle r="14" fill="none" stroke={accent} strokeWidth="2.5" />
          <circle r="6" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" />
          {/* Stem */}
          <rect x="14" y="-3" width="44" height="6" fill={accent} />
          {/* Teeth */}
          <rect x="44" y="3" width="4" height="8" fill={accent} />
          <rect x="52" y="3" width="4" height="6" fill={accent} />
        </g>

        {/* Lock body */}
        <g transform="translate(160 40)">
          {/* Shackle */}
          <path d="M 10 20 L 10 12 A 16 16 0 0 1 42 12 L 42 20" fill="none" stroke={dim} strokeWidth="3" />
          {/* Body */}
          <rect x="2" y="20" width="48" height="42" rx="5" fill={`${accent}22`} stroke={accent} strokeWidth="1.5" />
          {/* Keyhole */}
          <circle cx="26" cy="36" r="4" fill={accent} />
          <rect x="24" y="36" width="4" height="14" fill={accent} />
          {/* "OK" check in corner */}
          <g transform="translate(38 52)">
            <circle r="8" fill="#06C270" opacity="0.28" />
            <path
              d="M -3 0 L -0.5 2.5 L 3 -2.5"
              stroke="#06C270"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* Bitstream decoration */}
        {[8, 20, 32, 44, 56].map((x, i) => (
          <text
            key={i}
            x={x}
            y="118"
            fontSize="8"
            fontFamily="ui-monospace, monospace"
            fill={dim}
            opacity={0.3 + (i % 2) * 0.2}
          >
            {(i % 2 === 0 ? '01' : '11').repeat(1)}
          </text>
        ))}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="External ingestion"
        title="Open the port, keep the key"
        caption="Rotate the bearer token any time — old value stops working on the next call."
      />
    </HeroFrame>
  )
}
