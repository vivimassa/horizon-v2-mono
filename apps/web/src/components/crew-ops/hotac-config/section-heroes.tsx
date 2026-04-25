'use client'

/**
 * Section heroes for 4.1.8.3 HOTAC Configurations.
 *
 * Geometry, gradient angle, grid backdrop, and HeroTitle all match
 * 4.1.6.3 Scheduling Configurations exactly so the two screens read
 * as members of the same family. Only the inline SVG illustration
 * differs per section.
 */

interface HeroProps {
  accent: string
  isDark: boolean
}

const HERO_HEIGHT = 180

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

function HeroTitle({
  accent,
  isDark,
  eyebrow,
  title,
  caption,
}: HeroProps & { eyebrow: string; title: string; caption: string }) {
  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 max-w-[52%]">
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

/* ── 1. Layover — bed icon over a clock dial ── */
export function LayoverHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="LAYOVER RULE"
        title="When does a layover earn a hotel?"
        caption="Block-to-block hours and home-base exclusion drive the qualifying threshold."
      />
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Clock dial */}
        <circle cx="100" cy="75" r="58" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="2" />
        <circle
          cx="100"
          cy="75"
          r="58"
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeDasharray="20 280"
          strokeDashoffset="-200"
        />
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
          const x1 = 100 + Math.cos(angle) * 50
          const y1 = 75 + Math.sin(angle) * 50
          const x2 = 100 + Math.cos(angle) * 56
          const y2 = 75 + Math.sin(angle) * 56
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={dim} strokeWidth="1.5" />
        })}
        {/* Bed icon at center */}
        <g transform="translate(100 75)">
          <rect
            x="-22"
            y="-6"
            width="44"
            height="14"
            rx="3"
            fill={accent}
            fillOpacity="0.18"
            stroke={accent}
            strokeWidth="1.5"
          />
          <rect x="-22" y="-6" width="14" height="10" rx="2" fill={accent} fillOpacity="0.4" />
          <line x1="-22" y1="8" x2="22" y2="8" stroke={accent} strokeWidth="2" />
        </g>
        {/* "6h" label */}
        <text x="100" y="42" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          ≥ 6h
        </text>
      </svg>
    </HeroFrame>
  )
}

/* ── 2. Room allocation — two beds + occupancy ── */
export function RoomAllocationHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="ROOM ALLOCATION"
        title="How rooms are counted"
        caption="Default occupancy, sharing rules per position, and contract-cap fallback."
      />
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Single room */}
        <g transform="translate(20 30)">
          <rect
            x="0"
            y="0"
            width="70"
            height="90"
            rx="6"
            fill={accent}
            fillOpacity="0.08"
            stroke={accent}
            strokeWidth="1.5"
          />
          <rect x="10" y="25" width="50" height="22" rx="3" fill={accent} fillOpacity="0.35" />
          <rect x="10" y="20" width="14" height="10" rx="2" fill="white" fillOpacity="0.7" />
          <text x="35" y="74" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill={accent}>
            SINGLE
          </text>
        </g>
        {/* Double room */}
        <g transform="translate(110 30)">
          <rect
            x="0"
            y="0"
            width="70"
            height="90"
            rx="6"
            fill={accent}
            fillOpacity="0.05"
            stroke={dim}
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <rect x="6" y="25" width="26" height="22" rx="3" fill={dim} fillOpacity="0.25" />
          <rect x="38" y="25" width="26" height="22" rx="3" fill={dim} fillOpacity="0.25" />
          <rect x="6" y="20" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.5" />
          <rect x="38" y="20" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.5" />
          <text x="35" y="74" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill={dim}>
            DOUBLE
          </text>
        </g>
      </svg>
    </HeroFrame>
  )
}

/* ── 3. Dispatch — paper plane + clock ── */
export function DispatchHero({ accent, isDark }: HeroProps) {
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="DISPATCH"
        title="When rooming lists go out"
        caption="Auto-dispatch timing, lead window, and SLA threshold for hotel confirmation."
      />
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Trail */}
        <path
          d="M 20 110 Q 70 80 130 50"
          stroke={accent}
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeDasharray="4 4"
          fill="none"
        />
        {/* Paper plane */}
        <g transform="translate(140 30) rotate(-30)">
          <polygon points="0,0 40,15 0,30 8,15" fill={accent} fillOpacity="0.85" />
          <polygon points="0,0 8,15 0,30" fill={accent} fillOpacity="0.55" />
        </g>
        {/* Clock badge */}
        <g transform="translate(40 80)">
          <circle cx="0" cy="0" r="22" fill={accent} fillOpacity="0.15" stroke={accent} strokeWidth="2" />
          <line x1="0" y1="0" x2="0" y2="-14" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="0" x2="10" y2="0" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <text x="0" y="38" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill={accent}>
            T-24h
          </text>
        </g>
      </svg>
    </HeroFrame>
  )
}

/* ── 4. Check-in — door icon + checkmark ── */
export function CheckInHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="CHECK-IN"
        title="Crew arrival monitoring"
        caption="Auto-mark check-in after arrival delay. Flag no-show after a grace window."
      />
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Door */}
        <g transform="translate(70 25)">
          <rect
            x="0"
            y="0"
            width="50"
            height="100"
            rx="4"
            fill={accent}
            fillOpacity="0.10"
            stroke={accent}
            strokeWidth="2"
          />
          <circle cx="38" cy="55" r="3" fill={accent} />
          <line x1="0" y1="100" x2="50" y2="100" stroke={dim} strokeWidth="2" />
        </g>
        {/* Check badge — top-right */}
        <g transform="translate(140 30)">
          <circle cx="0" cy="0" r="20" fill="#06C270" fillOpacity="0.15" stroke="#06C270" strokeWidth="2" />
          <path
            d="M -9 0 L -3 6 L 9 -6"
            stroke="#06C270"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {/* Status pulse below door */}
        <text x="95" y="140" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          ARRIVED · CHECKED-IN
        </text>
      </svg>
    </HeroFrame>
  )
}

/* ── 5. Transport — van + airport icon ── */
export function TransportHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="TRANSPORT"
        title="Crew movement to and from base"
        caption="Hub-shuttle vs door-to-door, buffer windows, vendor SLA, and flight booking mode."
      />
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Road */}
        <line
          x1="20"
          y1="118"
          x2="180"
          y2="118"
          stroke={dim}
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        {/* Van */}
        <g transform="translate(40 70)">
          <rect x="0" y="0" width="84" height="40" rx="6" fill={`${accent}28`} stroke={accent} strokeWidth="2" />
          <rect x="6" y="6" width="22" height="16" rx="2" fill="none" stroke={accent} strokeWidth="1.5" />
          <rect
            x="32"
            y="6"
            width="22"
            height="16"
            rx="2"
            fill="none"
            stroke={accent}
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
          <circle cx="18" cy="46" r="6" fill={dim} />
          <circle cx="66" cy="46" r="6" fill={dim} />
        </g>
        {/* Airport tower */}
        <g transform="translate(140 40)">
          <rect x="6" y="0" width="6" height="70" fill={`${accent}55`} />
          <polygon points="0,70 18,70 12,82 6,82" fill={accent} />
          <circle cx="9" cy="-4" r="3" fill={accent} />
          <line x1="9" y1="-4" x2="9" y2="-12" stroke={accent} strokeWidth="1.5" />
        </g>
      </svg>
    </HeroFrame>
  )
}

/* ── 6. Email — envelope + queue ── */
export function EmailHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="EMAIL"
        title="Hotel correspondence"
        caption="From address, signature, and whether new outbound starts as held."
      />
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Envelope stack */}
        {[2, 1, 0].map((depth) => (
          <g key={depth} transform={`translate(${30 + depth * 6} ${30 + depth * 6})`}>
            <rect
              x="0"
              y="0"
              width="120"
              height="80"
              rx="6"
              fill={depth === 0 ? `${accent}28` : `${accent}10`}
              stroke={depth === 0 ? accent : dim}
              strokeOpacity={depth === 0 ? 1 : 0.4}
              strokeWidth="1.5"
            />
            {depth === 0 && (
              <>
                <path d="M 4 4 L 60 44 L 116 4" fill="none" stroke={accent} strokeWidth="2" />
                <line x1="20" y1="56" x2="100" y2="56" stroke={accent} strokeWidth="2" />
                <line x1="20" y1="64" x2="80" y2="64" stroke={accent} strokeOpacity="0.5" strokeWidth="2" />
                <line x1="20" y1="72" x2="60" y2="72" stroke={accent} strokeOpacity="0.3" strokeWidth="2" />
              </>
            )}
          </g>
        ))}
      </svg>
    </HeroFrame>
  )
}
