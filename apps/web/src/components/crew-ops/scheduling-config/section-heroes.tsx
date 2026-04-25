'use client'

/**
 * Inline SVG hero illustrations for 4.1.6.3 Scheduling Configurations.
 * Pattern cloned from 4.1.5.4 Pairing Configurations section heroes —
 * same HeroFrame geometry, HeroTitle block, grid + radial-glow backdrop.
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

/* ── 1. General — LCC vs Legacy priority stack ── */
export function GeneralHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const body = isDark ? '#13131A' : '#FAFAFC'
  const stack = [
    { label: 'FLIGHT', fill: accent },
    { label: 'STANDBY', fill: `${accent}99` },
    { label: 'DAY OFF', fill: dim },
  ]
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="260"
        height="150"
        viewBox="0 0 260 150"
        aria-hidden
      >
        {/* LCC column */}
        <g transform="translate(80 20)">
          <text
            x="0"
            y="0"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={accent}
            letterSpacing="0.1em"
          >
            LCC
          </text>
          {stack.map((s, i) => (
            <g key={s.label} transform={`translate(-38 ${14 + i * 32})`}>
              <rect width="76" height="26" rx="6" fill={s.fill} opacity={i === 0 ? 0.9 : i === 1 ? 0.45 : 0.22} />
              <rect width="76" height="26" rx="6" fill="none" stroke={s.fill} strokeWidth="1" opacity="0.6" />
              <text
                x="38"
                y="16"
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                fill={isDark ? '#fff' : '#fff'}
                opacity={i === 2 ? 0.6 : 0.9}
              >
                {s.label}
              </text>
              <text
                x="-10"
                y="17"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="ui-monospace"
                fill={dim}
                opacity="0.6"
              >
                {i + 1}
              </text>
            </g>
          ))}
          <text x="0" y="128" fontSize="9" textAnchor="middle" fontFamily="system-ui" fill={dim} opacity="0.7">
            Standby before day off
          </text>
        </g>

        {/* Divider */}
        <line x1="140" y1="10" x2="140" y2="140" stroke={dim} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.4" />

        {/* Legacy column */}
        <g transform="translate(200 20)">
          <text
            x="0"
            y="0"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={dim}
            letterSpacing="0.1em"
          >
            LEGACY
          </text>
          {[stack[0], stack[2], stack[1]].map((s, i) => (
            <g key={`${s.label}-l`} transform={`translate(-38 ${14 + i * 32})`}>
              <rect width="76" height="26" rx="6" fill={i === 0 ? s.fill : dim} opacity={i === 0 ? 0.5 : 0.18} />
              <rect
                width="76"
                height="26"
                rx="6"
                fill="none"
                stroke={i === 0 ? s.fill : dim}
                strokeWidth="1"
                opacity="0.35"
              />
              <text
                x="38"
                y="16"
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                fill={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}
              >
                {s.label}
              </text>
              <text
                x="-10"
                y="17"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="ui-monospace"
                fill={dim}
                opacity="0.5"
              >
                {i + 1}
              </text>
            </g>
          ))}
          <text x="0" y="128" fontSize="9" textAnchor="middle" fontFamily="system-ui" fill={dim} opacity="0.5">
            Day off before standby
          </text>
        </g>

        {/* Arrow pointing to LCC */}
        <path d="M 24 75 L 36 75" stroke={accent} strokeWidth="1.5" fill="none" />
        <polygon points="36,72 42,75 36,78" fill={accent} />
        <rect x="0" y="66" width="24" height="18" rx="4" fill={`${accent}22`} stroke={accent} strokeWidth="0.8" />
        <text x="12" y="78" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          NOW
        </text>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="General · Carrier mode"
        title="Set your scheduling strategy"
        caption="LCC mode fills open days with standby before giving crew a day off. Legacy mode reverses the priority."
      />
    </HeroFrame>
  )
}

/* ── 2. Days Off & Duties — calendar streak with warnings ── */
export function DaysOffHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const types: ('duty' | 'duty' | 'duty' | 'duty' | 'warn' | 'off' | 'off')[] = [
    'duty',
    'duty',
    'duty',
    'duty',
    'warn',
    'off',
    'off',
  ]
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2"
        width="270"
        height="150"
        viewBox="0 0 270 150"
        aria-hidden
      >
        {/* Week header */}
        {days.map((d, i) => (
          <text
            key={i}
            x={20 + i * 36}
            y="22"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={dim}
            opacity="0.6"
          >
            {d}
          </text>
        ))}

        {/* Day cells */}
        {types.map((t, i) => {
          const x = 20 + i * 36
          const isWarn = t === 'warn'
          const isOff = t === 'off'
          const fill = isOff
            ? isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.04)'
            : isWarn
              ? `rgba(255,136,0,0.18)`
              : `${accent}28`
          const stroke = isOff ? dim : isWarn ? '#FF8800' : accent
          return (
            <g key={i}>
              <rect
                x={x - 15}
                y="30"
                width="30"
                height="38"
                rx="7"
                fill={fill}
                stroke={stroke}
                strokeWidth={isWarn ? 1.5 : 1}
                opacity={isOff ? 0.5 : 1}
              />
              {!isOff && !isWarn && (
                <text
                  x={x}
                  y="53"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="middle"
                  fontFamily="ui-monospace"
                  fill={accent}
                >
                  D
                </text>
              )}
              {isWarn && (
                <text
                  x={x}
                  y="53"
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                  fontFamily="system-ui"
                  fill="#FF8800"
                >
                  !
                </text>
              )}
              {isOff && (
                <text x={x} y="53" fontSize="9" textAnchor="middle" fontFamily="system-ui" fill={dim} opacity="0.5">
                  —
                </text>
              )}
            </g>
          )
        })}

        {/* Streak bracket */}
        <path d="M 5 30 L 5 68 M 5 49 L 9 49" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7" />
        <path d="M 149 30 L 149 68 M 149 49 L 145 49" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7" />
        <text
          x="77"
          y="82"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill={accent}
        >
          4 consecutive duties
        </text>

        {/* Warning callout */}
        <rect
          x="140"
          y="30"
          width="58"
          height="38"
          rx="7"
          fill="rgba(255,136,0,0.08)"
          stroke="#FF8800"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <text x="169" y="45" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill="#FF8800">
          MAX
        </text>
        <text x="169" y="60" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill="#FF8800">
          REACHED
        </text>

        {/* Sun (morning) and moon (afternoon) indicators */}
        <g transform="translate(20 118)">
          <circle cx="0" cy="0" r="7" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.7" />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const rad = (a * Math.PI) / 180
            return (
              <line
                key={a}
                x1={Math.cos(rad) * 8}
                y1={Math.sin(rad) * 8}
                x2={Math.cos(rad) * 10}
                y2={Math.sin(rad) * 10}
                stroke={accent}
                strokeWidth="1"
                opacity="0.6"
              />
            )
          })}
          <text x="14" y="4" fontSize="9" fontFamily="system-ui" fill={dim} opacity="0.7">
            Morning &lt; 12:00
          </text>
        </g>
        <g transform="translate(160 118)">
          <path d="M 0 -7 A 7 7 0 1 1 0 7 A 5 5 0 1 0 0 -7 Z" fill={dim} opacity="0.5" />
          <text x="14" y="4" fontSize="9" fontFamily="system-ui" fill={dim} opacity="0.7">
            Afternoon 12–18
          </text>
        </g>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Days off & duties · Soft rule"
        title="Protect crew rotation quality"
        caption="Cap consecutive duties and days off per period. Morning and afternoon rotation limits reduce fatigue."
      />
    </HeroFrame>
  )
}

/* ── 3. Standby — quota bar + home/airport split ── */
export function StandbyHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const body = isDark ? '#1F1F28' : '#F2F2F5'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2"
        width="270"
        height="150"
        viewBox="0 0 270 150"
        aria-hidden
      >
        {/* Timeline bar */}
        <rect
          x="10"
          y="18"
          width="250"
          height="20"
          rx="5"
          fill={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
          stroke={dim}
          strokeWidth="0.8"
          opacity="0.5"
        />
        {/* Standby window */}
        <rect x="50" y="18" width="130" height="20" rx="5" fill={`${accent}30`} stroke={accent} strokeWidth="1.2" />
        <text
          x="115"
          y="32"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill={accent}
        >
          STANDBY WINDOW 6h – 10h
        </text>
        {/* Lead time arrow */}
        <line
          x1="10"
          y1="48"
          x2="48"
          y2="48"
          stroke={accent}
          strokeWidth="1.2"
          markerEnd="url(#arrow)"
          strokeDasharray="3 2"
          opacity="0.8"
        />
        <text x="29" y="44" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          lead 2h
        </text>
        {/* First departure marker */}
        <line x1="50" y1="14" x2="50" y2="52" stroke={accent} strokeWidth="1.5" opacity="0.9" />
        <polygon points="44,14 50,8 56,14" fill={accent} opacity="0.9" />
        <text x="50" y="60" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          STD
        </text>

        {/* Home vs Airport split donut */}
        <g transform="translate(185 95)">
          {/* Donut — 80% home (accent), 20% airport (dim) */}
          <circle r="32" fill="none" stroke={dim} strokeWidth="10" opacity="0.18" />
          {/* Home 80% = 201 of 251 */}
          <circle
            r="32"
            fill="none"
            stroke={accent}
            strokeWidth="10"
            strokeDasharray="160 40"
            strokeDashoffset="0"
            transform="rotate(-90)"
            opacity="0.85"
          />
          <text x="0" y="-4" fontSize="14" fontWeight="800" textAnchor="middle" fontFamily="ui-monospace" fill={accent}>
            80%
          </text>
          <text x="0" y="10" fontSize="8" fontFamily="system-ui" textAnchor="middle" fill={dim}>
            home
          </text>
          {/* Legend */}
          <rect x="-38" y="40" width="10" height="6" rx="2" fill={accent} opacity="0.85" />
          <text x="-24" y="47" fontSize="8" fontFamily="system-ui" fill={dim}>
            Home SBY
          </text>
          <rect x="-38" y="52" width="10" height="6" rx="2" fill={dim} opacity="0.4" />
          <text x="-24" y="59" fontSize="8" fontFamily="system-ui" fill={dim}>
            Airport SBY
          </text>
        </g>

        {/* Crew figure at home */}
        <g transform="translate(75 100)">
          {/* House */}
          <polygon points="0,-20 -18,0 18,0" fill={`${accent}22`} stroke={accent} strokeWidth="1.2" />
          <rect x="-12" y="0" width="24" height="18" rx="2" fill={`${accent}22`} stroke={accent} strokeWidth="1.2" />
          <rect x="-4" y="6" width="8" height="12" rx="1" fill={accent} opacity="0.5" />
          <text
            x="0"
            y="32"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={dim}
            opacity="0.7"
          >
            HOME
          </text>
        </g>
        <g transform="translate(130 100)">
          {/* Aircraft / airport */}
          <ellipse cx="0" cy="-8" rx="18" ry="4" fill={`${accent}18`} stroke={dim} strokeWidth="1" opacity="0.7" />
          <path d="M -6 -8 L -14 -18 L -10 -18 L 0 -8 Z" fill={dim} opacity="0.5" />
          <path d="M -6 -8 L -14 2 L -10 2 L 0 -8 Z" fill={dim} opacity="0.5" />
          <rect
            x="-8"
            y="2"
            width="16"
            height="16"
            rx="2"
            fill={`${accent}18`}
            stroke={dim}
            strokeWidth="1"
            opacity="0.7"
          />
          <text
            x="0"
            y="32"
            fontSize="8"
            fontWeight="600"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={dim}
            opacity="0.7"
          >
            AIRPORT
          </text>
        </g>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Standby · Post-flight priority"
        title="Fill open days with standby crew"
        caption="Set daily standby quota, home vs airport split, timing relative to first departure, and duration bounds."
      />
    </HeroFrame>
  )
}

/* ── 4. Destination Rules — airport pair with separation arc ── */
export function DestinationHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2"
        width="270"
        height="150"
        viewBox="0 0 270 150"
        aria-hidden
      >
        {/* Base airport */}
        <g transform="translate(60 80)">
          <circle r="14" fill={`${accent}22`} stroke={accent} strokeWidth="1.5" />
          <circle r="4" fill={accent} />
          <text
            x="0"
            y="26"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fill={accent}
          >
            HOME
          </text>
        </g>

        {/* Destination airport */}
        <g transform="translate(210 80)">
          <circle r="14" fill={`${accent}18`} stroke={`${accent}99`} strokeWidth="1.5" strokeDasharray="3 2" />
          <circle r="4" fill={`${accent}88`} />
          <text
            x="0"
            y="26"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fill={`${accent}99`}
          >
            DEST
          </text>
        </g>

        {/* Flight arc outbound */}
        <path
          d="M 75 75 Q 135 20 195 75"
          stroke={accent}
          strokeWidth="1.5"
          fill="none"
          opacity="0.8"
          strokeDasharray="5 3"
        />
        <polygon points="192,72 198,75 193,78" fill={accent} opacity="0.8" />

        {/* Return arc (dashed, dimmer) */}
        <path
          d="M 195 85 Q 135 130 75 85"
          stroke={dim}
          strokeWidth="1.2"
          fill="none"
          opacity="0.5"
          strokeDasharray="4 3"
        />
        <polygon points="78,82 72,85 77,88" fill={dim} opacity="0.5" />

        {/* Separation label */}
        <rect x="100" y="28" width="70" height="18" rx="5" fill={`${accent}22`} stroke={accent} strokeWidth="0.8" />
        <text
          x="135"
          y="40"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill={accent}
        >
          MIN 7d SEP
        </text>

        {/* Layover counter badge */}
        <g transform="translate(210 45)">
          <rect x="-22" y="-10" width="44" height="18" rx="5" fill={`${accent}22`} stroke={accent} strokeWidth="1" />
          <text
            x="0"
            y="2"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fill={accent}
          >
            MAX 3×
          </text>
          <text x="0" y="18" fontSize="8" textAnchor="middle" fontFamily="system-ui" fill={dim} opacity="0.7">
            layovers/period
          </text>
        </g>

        {/* Night / hotel icon at destination */}
        <g transform="translate(210 80)">
          <text x="0" y="-18" fontSize="12" textAnchor="middle" fontFamily="system-ui" fill={dim} opacity="0.6">
            🌙
          </text>
        </g>

        {/* Scope pills */}
        <g transform="translate(60 130)">
          <rect x="-22" y="-8" width="44" height="14" rx="7" fill={`${accent}22`} stroke={accent} strokeWidth="0.8" />
          <text
            x="0"
            y="2"
            fontSize="8"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={accent}
            letterSpacing="0.08em"
          >
            ICAO
          </text>
        </g>
        <g transform="translate(210 130)">
          <rect
            x="-22"
            y="-8"
            width="44"
            height="14"
            rx="7"
            fill={`${accent}18`}
            stroke={`${accent}88`}
            strokeWidth="0.8"
          />
          <text
            x="0"
            y="2"
            fontSize="8"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={`${accent}99`}
            letterSpacing="0.08em"
          >
            COUNTRY
          </text>
        </g>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Destination rules · Soft rule"
        title="Limit layovers and protect crew rest"
        caption="Cap layovers per airport or country per period. Enforce minimum separation days between visits."
      />
    </HeroFrame>
  )
}

/* ── 5. Optimization — gender balance scale ── */
export function OptimizationHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const body = isDark ? '#1F1F28' : '#F2F2F5'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2"
        width="270"
        height="150"
        viewBox="0 0 270 150"
        aria-hidden
      >
        {/* Balance beam */}
        <line x1="90" y1="55" x2="210" y2="55" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        {/* Fulcrum */}
        <polygon points="150,55 138,100 162,100" fill={`${accent}44`} stroke={accent} strokeWidth="1.2" />
        <rect x="130" y="100" width="40" height="8" rx="4" fill={`${accent}44`} stroke={accent} strokeWidth="1" />
        {/* Pivot pin */}
        <circle cx="150" cy="55" r="5" fill={accent} />

        {/* Left pan — balanced */}
        <line x1="100" y1="55" x2="100" y2="68" stroke={accent} strokeWidth="1.5" opacity="0.8" />
        <ellipse cx="100" cy="70" rx="22" ry="6" fill={`${accent}22`} stroke={accent} strokeWidth="1.2" />

        {/* Right pan — balanced */}
        <line x1="200" y1="55" x2="200" y2="68" stroke={accent} strokeWidth="1.5" opacity="0.8" />
        <ellipse cx="200" cy="70" rx="22" ry="6" fill={`${accent}22`} stroke={accent} strokeWidth="1.2" />

        {/* Left crew figures (2 silhouettes) */}
        <g transform="translate(100 40)">
          <circle cx="-8" cy="-8" r="5" fill={accent} opacity="0.7" />
          <path
            d="M -8 -2 L -8 12 M -14 4 L -2 4 M -8 12 L -12 22 M -8 12 L -4 22"
            stroke={accent}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="8" cy="-8" r="5" fill={accent} opacity="0.85" />
          <path
            d="M 8 -2 L 8 12 M 2 4 L 14 4 M 8 12 L 4 22 M 8 12 L 12 22"
            stroke={accent}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* Right crew figures (2 silhouettes) */}
        <g transform="translate(200 40)">
          <circle cx="-8" cy="-8" r="5" fill={accent} opacity="0.7" />
          <path
            d="M -8 -2 L -8 12 M -14 4 L -2 4 M -8 12 L -12 22 M -8 12 L -4 22"
            stroke={accent}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="8" cy="-8" r="5" fill={accent} opacity="0.85" />
          <path
            d="M 8 -2 L 8 12 M 2 4 L 14 4 M 8 12 L 4 22 M 8 12 L 12 22"
            stroke={accent}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* Balance label */}
        <text
          x="150"
          y="118"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill={accent}
        >
          BALANCED
        </text>

        {/* Weight slider visual */}
        <rect
          x="70"
          y="128"
          width="160"
          height="6"
          rx="3"
          fill={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
        />
        <rect x="70" y="128" width="128" height="6" rx="3" fill={`${accent}70`} />
        <circle cx="198" cy="131" r="6" fill={accent} stroke={body} strokeWidth="2" />
        <text x="150" y="144" fontSize="8" textAnchor="middle" fontFamily="system-ui" fill={dim} opacity="0.7">
          Gender balance weight 80%
        </text>

        {/* HOTAC cost pill */}
        <rect
          x="100"
          y="102"
          width="100"
          height="16"
          rx="5"
          fill={`${accent}18`}
          stroke={`${accent}66`}
          strokeWidth="0.8"
        />
        <text x="150" y="113" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          ↓ HOTAC cost
        </text>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Optimization · Objective weights"
        title="Balance gender on layover flights"
        caption="Crew of the same gender in shared accommodation reduces HOTAC cost. Tune how hard the solver tries."
      />
    </HeroFrame>
  )
}

export function QolHero({ accent, isDark }: HeroProps) {
  // Visualises a 3-day strip: Day -1 (early off), Day 0 (vacation block),
  // Day +1 (late report). Soft amber highlights the wind-down + late return
  // windows; the green block in the middle is the activity (e.g. AL).
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="280"
        height="150"
        viewBox="0 0 280 150"
        aria-hidden
      >
        {/* Day labels */}
        {['Day −1', 'Vacation', 'Day +1'].map((lbl, i) => (
          <text
            key={lbl}
            x={28 + i * 92}
            y="22"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="system-ui"
            fill={dim}
            letterSpacing="0.08em"
          >
            {lbl.toUpperCase()}
          </text>
        ))}

        {/* Day -1 lane: full duty bar with wind-down highlight on the right */}
        <rect x="0" y="34" width="84" height="22" rx="6" fill={`${accent}55`} stroke={accent} strokeWidth="0.8" />
        <rect x="58" y="34" width="26" height="22" rx="6" fill={`${accent}cc`} />
        <text
          x="42"
          y="49"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill="#fff"
        >
          DUTY
        </text>
        {/* arrow showing early end */}
        <line x1="84" y1="68" x2="84" y2="78" stroke={accent} strokeWidth="1" />
        <text x="84" y="90" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          end ≤ 12:00
        </text>

        {/* Vacation block (green) */}
        <rect x="92" y="34" width="84" height="22" rx="6" fill="#06C27033" stroke="#06C270" strokeWidth="0.8" />
        <text
          x="134"
          y="49"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill="#06C270"
        >
          AL
        </text>

        {/* Day +1 lane: late start bar */}
        <rect x="184" y="34" width="84" height="22" rx="6" fill={`${accent}55`} stroke={accent} strokeWidth="0.8" />
        <rect x="184" y="34" width="26" height="22" rx="6" fill={`${accent}cc`} />
        <text
          x="226"
          y="49"
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fill="#fff"
        >
          DUTY
        </text>
        <line x1="210" y1="68" x2="210" y2="78" stroke={accent} strokeWidth="1" />
        <text x="210" y="90" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="system-ui" fill={accent}>
          start ≥ 12:00
        </text>

        {/* Heart glyph footer */}
        <text x="140" y="128" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="system-ui" fill={dim}>
          Soft preference · coverage still wins
        </text>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Quality of life · Soft rule"
        title="Wind down before, ease back after"
        caption="Per-activity windows that nudge the solver toward early relief and late return around vacations and leave."
      />
    </HeroFrame>
  )
}
