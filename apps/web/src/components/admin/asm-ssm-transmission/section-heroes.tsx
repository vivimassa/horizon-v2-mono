'use client'

/**
 * Inline SVG hero illustrations for 7.1.5.1 ASM/SSM Transmission.
 * Matches the visual grammar of 7.1.5.2's section-heroes.tsx — same frame,
 * same title block, same right-side illustration slot.
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

/* ── 1. Generation & Release — Gear + radiating message nodes ── */
export function GenerationHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-8 top-1/2 -translate-y-1/2"
        width="200"
        height="150"
        viewBox="0 0 200 150"
        aria-hidden
      >
        {/* Central gear */}
        <g transform="translate(100 75)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <rect
              key={a}
              x="-4"
              y="-32"
              width="8"
              height="10"
              fill={accent}
              transform={`rotate(${a})`}
              opacity="0.85"
            />
          ))}
          <circle r="24" fill={isDark ? '#13131A' : '#FAFAFC'} stroke={accent} strokeWidth="2" />
          <circle r="8" fill={accent} />
        </g>
        {/* Radiating message envelopes */}
        {[
          { x: 30, y: 30 },
          { x: 170, y: 30 },
          { x: 30, y: 120 },
          { x: 170, y: 120 },
        ].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y})`} opacity={0.85}>
            <rect x="-12" y="-8" width="24" height="16" rx="2" fill={`${accent}22`} stroke={accent} strokeWidth="1.2" />
            <path d="M -12 -8 L 0 2 L 12 -8" fill="none" stroke={accent} strokeWidth="1.2" />
          </g>
        ))}
        {/* Dashed link lines from gear to envelopes */}
        {[
          { x: 30, y: 30 },
          { x: 170, y: 30 },
          { x: 30, y: 120 },
          { x: 170, y: 120 },
        ].map((p, i) => (
          <line
            key={i}
            x1="100"
            y1="75"
            x2={p.x}
            y2={p.y}
            stroke={dim}
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.45"
          />
        ))}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Message emission"
        title="Control what fires and when"
        caption="Generation rules and the auto-release scheduler steer every outbound ASM / SSM."
      />
    </HeroFrame>
  )
}

/* ── 2. Consumers — Hub + spoke with mixed endpoint icons ── */
export function ConsumersHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="220"
        height="150"
        viewBox="0 0 220 150"
        aria-hidden
      >
        {/* Central outbox */}
        <g transform="translate(60 75)">
          <rect x="-22" y="-16" width="44" height="32" rx="5" fill={`${accent}22`} stroke={accent} strokeWidth="1.5" />
          <line x1="-22" y1="-6" x2="22" y2="-6" stroke={accent} strokeWidth="1.2" opacity="0.6" />
          <line x1="-22" y1="2" x2="22" y2="2" stroke={accent} strokeWidth="1.2" opacity="0.4" />
          <line x1="-22" y1="10" x2="22" y2="10" stroke={accent} strokeWidth="1.2" opacity="0.25" />
        </g>
        {/* Spokes */}
        {[
          { x: 180, y: 28, label: 'API' },
          { x: 190, y: 75, label: 'SFTP' },
          { x: 180, y: 122, label: '@' },
        ].map((p, i) => (
          <g key={i}>
            <line
              x1="82"
              y1="75"
              x2={p.x - 14}
              y2={p.y}
              stroke={accent}
              strokeWidth="1.3"
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <circle cx={p.x} cy={p.y} r="15" fill={isDark ? '#13131A' : '#FAFAFC'} stroke={accent} strokeWidth="1.5" />
            <text
              x={p.x}
              y={p.y + 3}
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fill={accent}
            >
              {p.label}
            </text>
          </g>
        ))}
        {/* Outbound arrow dots */}
        {[110, 130, 150].map((x, i) => (
          <circle key={i} cx={x} cy="75" r="1.5" fill={dim} opacity={0.8 - i * 0.25} />
        ))}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Delivery directory"
        title="One outbox, three delivery modes"
        caption="Pull API for modern GDS, SFTP for legacy drops, SMTP for email-driven vendors."
      />
    </HeroFrame>
  )
}

/* ── 3. Held Queue — Holding pen with release gate ── */
export function HeldQueueHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="220"
        height="150"
        viewBox="0 0 220 150"
        aria-hidden
      >
        {/* Holding pen (dashed fence) */}
        <rect
          x="20"
          y="35"
          width="120"
          height="80"
          rx="8"
          fill="none"
          stroke={accent}
          strokeWidth="1.5"
          strokeDasharray="5 3"
          opacity="0.7"
        />
        {/* Pending messages inside */}
        {[
          { x: 45, y: 60 },
          { x: 75, y: 60 },
          { x: 105, y: 60 },
          { x: 45, y: 85 },
          { x: 75, y: 85 },
        ].map((p, i) => (
          <rect
            key={i}
            x={p.x - 10}
            y={p.y - 7}
            width="20"
            height="14"
            rx="2"
            fill={`${accent}33`}
            stroke={accent}
            strokeWidth="1"
            opacity={0.85 - i * 0.08}
          />
        ))}
        {/* Gate / release arrow */}
        <g transform="translate(150 75)">
          <line x1="0" y1="-28" x2="0" y2="28" stroke={dim} strokeWidth="1.5" />
          <path d="M 8 -8 L 32 0 L 8 8 Z" fill={accent} opacity="0.85" />
          <path d="M 0 0 L 30 0" stroke={accent} strokeWidth="1.5" />
        </g>
        {/* Check / discard indicators */}
        <g transform="translate(195 55)">
          <circle r="10" fill="#06C270" opacity="0.22" stroke="#06C270" strokeWidth="1.2" />
          <path
            d="M -4 0 L -1 3 L 4 -3"
            stroke="#06C270"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g transform="translate(195 95)">
          <circle r="10" fill="#E63535" opacity="0.18" stroke="#E63535" strokeWidth="1.2" />
          <line x1="-4" y1="-4" x2="4" y2="4" stroke="#E63535" strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="-4" x2="-4" y2="4" stroke="#E63535" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Pre-send review"
        title="Release what's right. Discard what isn't."
        caption="Neutralized NEW + CNL pairs auto-drop. Everything else waits for approval."
      />
    </HeroFrame>
  )
}

/* ── 4. Delivery Log — Ledger rows with status badges ── */
export function DeliveryLogHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-6 top-1/2 -translate-y-1/2"
        width="220"
        height="150"
        viewBox="0 0 220 150"
        aria-hidden
      >
        {/* Ledger frame */}
        <rect
          x="10"
          y="20"
          width="200"
          height="110"
          rx="6"
          fill={isDark ? '#13131A' : '#FAFAFC'}
          stroke={accent}
          strokeWidth="1.2"
        />
        {/* Header stripe */}
        <rect x="10" y="20" width="200" height="18" rx="6" fill={`${accent}22`} />
        {/* Column lines */}
        {[100, 140, 170].map((x, i) => (
          <line key={i} x1={x} y1="38" x2={x} y2="130" stroke={dim} strokeWidth="0.8" opacity="0.35" />
        ))}
        {/* Row cells — each with a status pill */}
        {[50, 70, 90, 110].map((y, i) => {
          const palette = ['#06C270', '#06C270', '#E63535', '#FF8800']
          const dots = ['#06C270', '#FF8800', '#E63535', '#06C270']
          return (
            <g key={i}>
              {/* Flight id cell */}
              <rect x="14" y={y - 6} width="80" height="12" rx="2" fill={dim} opacity="0.12" />
              {/* Consumer cell */}
              <rect x="106" y={y - 6} width="28" height="12" rx="2" fill={dim} opacity="0.10" />
              {/* Mode cell */}
              <rect x="144" y={y - 6} width="22" height="12" rx="2" fill={dim} opacity="0.10" />
              {/* Status pill */}
              <rect x="176" y={y - 6} width="28" height="12" rx="6" fill={palette[i]} opacity="0.22" />
              <circle cx="182" cy={y} r="2.5" fill={dots[i]} />
            </g>
          )
        })}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Audit trail"
        title="Who got what, when, and how"
        caption="Per-consumer delivery outcomes with retry attempts and exportable history."
      />
    </HeroFrame>
  )
}
