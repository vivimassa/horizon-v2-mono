'use client'

/**
 * Inline SVG hero illustrations for each Customization section.
 * Each hero is designed as a ~180px-tall banner occupying the center
 * panel above the form body. All illustrations are theme-aware and
 * use the module accent so they feel native to the Flight Ops family.
 *
 * If one of these ends up looking too icon-y, swap to an Unsplash photo
 * by replacing the relevant component body with an <img>.
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

/* ── 1. SLA Targets — Clock with sweep arc ── */
export function SlaHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-8 top-1/2 -translate-y-1/2"
        width="140"
        height="140"
        viewBox="0 0 140 140"
        aria-hidden
      >
        {/* Bezel */}
        <circle cx="70" cy="70" r="60" fill="none" stroke={dim} strokeWidth="1.5" opacity="0.3" />
        <circle cx="70" cy="70" r="54" fill="none" stroke={accent} strokeWidth="1" opacity="0.4" />

        {/* Tick marks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const x1 = 70 + Math.cos(angle) * 52
          const y1 = 70 + Math.sin(angle) * 52
          const x2 = 70 + Math.cos(angle) * (i % 3 === 0 ? 45 : 48)
          const y2 = 70 + Math.sin(angle) * (i % 3 === 0 ? 45 : 48)
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={i % 3 === 0 ? accent : dim}
              strokeWidth={i % 3 === 0 ? 2 : 1}
              opacity={i % 3 === 0 ? 0.8 : 0.4}
            />
          )
        })}

        {/* SLA sweep arc (15 → 60 → 240 minutes, simplified as a 90° accent sweep) */}
        <path d={`M 70 70 L 70 22 A 48 48 0 0 1 116 70 Z`} fill={accent} opacity="0.18" />

        {/* Hands */}
        <line x1="70" y1="70" x2="70" y2="28" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="70" y1="70" x2="108" y2="70" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.7" />

        {/* Center dot + glow */}
        <circle cx="70" cy="70" r="8" fill={accent} opacity="0.2" />
        <circle cx="70" cy="70" r="4" fill={accent} />
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Response targets"
        title="Set the pace you expect from OCC"
        caption="Tighter targets make breaches visible sooner."
      />
    </HeroFrame>
  )
}

/* ── 2. Backlog Threshold — Stacked cards with water-line ── */
export function BacklogHero({ accent, isDark }: HeroProps) {
  const bar = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-10 top-1/2 -translate-y-1/2"
        width="160"
        height="130"
        viewBox="0 0 160 130"
        aria-hidden
      >
        {/* 8 stacked bars */}
        {Array.from({ length: 8 }).map((_, i) => {
          const y = 108 - i * 13
          const width = 120 - i * 6
          const overThreshold = i >= 5
          return (
            <rect
              key={i}
              x={20}
              y={y}
              width={width}
              height={9}
              rx={2}
              fill={overThreshold ? `${accent}aa` : bar}
              opacity={overThreshold ? 1 : 0.8 - i * 0.06}
            />
          )
        })}
        {/* Threshold line */}
        <line
          x1="10"
          y1="46"
          x2="155"
          y2="46"
          stroke="#FF3B3B"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.85"
        />
        <text x="155" y="42" fontSize="10" fill="#FF3B3B" textAnchor="end" fontFamily="monospace">
          THRESHOLD
        </text>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Backlog signal"
        title="When should the OCC wake up?"
        caption="Above this count the Workflow card starts glowing red."
      />
    </HeroFrame>
  )
}

/* ── 3. Rolling Period — Calendar strip with range ── */
export function RollingHero({ accent, isDark }: HeroProps) {
  const cell = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const cellBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const labelDim = isDark ? '#8F90A6' : '#555770'
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const activeStart = 2
  const activeEnd = 5
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2"
        width="260"
        height="120"
        viewBox="0 0 260 120"
        aria-hidden
      >
        {/* Range highlight behind */}
        <rect
          x={20 + activeStart * 34 - 2}
          y={38}
          width={(activeEnd - activeStart + 1) * 34 - 6}
          height={54}
          rx={6}
          fill={accent}
          opacity="0.15"
        />
        {days.map((d, i) => {
          const isActive = i >= activeStart && i <= activeEnd
          const x = 20 + i * 34
          return (
            <g key={i}>
              <text x={x + 14} y={32} fontSize="10" fill={labelDim} textAnchor="middle" fontFamily="monospace">
                {d}
              </text>
              <rect
                x={x}
                y={38}
                width={28}
                height={54}
                rx={4}
                fill={isActive ? `${accent}33` : cell}
                stroke={isActive ? accent : cellBorder}
                strokeWidth={isActive ? 1.5 : 1}
              />
              <text
                x={x + 14}
                y={72}
                fontSize="14"
                fontWeight="700"
                fill={isActive ? accent : labelDim}
                textAnchor="middle"
                fontFamily="system-ui"
              >
                {14 + i}
              </text>
            </g>
          )
        })}
        {/* Arrow indicator */}
        <path
          d={`M ${20 + activeStart * 34 + 10} 106 L ${20 + activeEnd * 34 + 18} 106`}
          stroke={accent}
          strokeWidth="1.5"
          markerEnd="url(#arrow)"
        />
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 Z" fill={accent} />
          </marker>
        </defs>
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Rolling window"
        title="How far ahead should OCC look?"
        caption="Short horizons stay sharp; long horizons just add noise."
      />
    </HeroFrame>
  )
}

/* ── 4. Default Feed Status — Funnel ── */
export function FeedHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-10 top-1/2 -translate-y-1/2"
        width="160"
        height="130"
        viewBox="0 0 160 130"
        aria-hidden
      >
        {/* 5 trapezoid stages */}
        {[0, 1, 2, 3, 4].map((i) => {
          const y = 12 + i * 20
          const topW = 130 - i * 20
          const botW = 130 - (i + 1) * 20
          const cx = 80
          return (
            <polygon
              key={i}
              points={`${cx - topW / 2},${y} ${cx + topW / 2},${y} ${cx + botW / 2},${y + 18} ${cx - botW / 2},${y + 18}`}
              fill={i === 1 || i === 2 ? `${accent}${i === 1 ? '88' : 'aa'}` : dim}
              opacity={i === 1 || i === 2 ? 1 : 0.6 - i * 0.05}
              stroke={i === 1 || i === 2 ? accent : 'transparent'}
              strokeWidth="0.5"
            />
          )
        })}
        {/* Flow dots */}
        {[30, 54, 78, 102].map((y, i) => (
          <circle key={i} cx={80} cy={y} r={1.5} fill="#fff" opacity="0.9" />
        ))}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Default view"
        title="What should OCC see on page load?"
        caption="Pick the status filter that matches your ops posture."
      />
    </HeroFrame>
  )
}

/* ── 5. Category Labels — Floating tag cloud ── */
export function CategoriesHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const tags = [
    { x: 50, y: 28, w: 80, label: 'Delay', accent: true, rot: -4 },
    { x: 140, y: 54, w: 70, label: 'Swap', accent: false, rot: 2 },
    { x: 40, y: 78, w: 90, label: 'MX risk', accent: true, rot: 5 },
    { x: 150, y: 98, w: 82, label: 'Curfew', accent: false, rot: -3 },
    { x: 70, y: 128, w: 74, label: 'TAT', accent: false, rot: 1 },
    { x: 175, y: 142, w: 62, label: 'Config', accent: true, rot: -2 },
  ]
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-4 top-0 bottom-0 my-auto"
        width="260"
        height="170"
        viewBox="0 0 260 170"
        aria-hidden
      >
        {tags.map((t, i) => (
          <g key={i} transform={`rotate(${t.rot} ${t.x + t.w / 2} ${t.y + 10})`}>
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={22}
              rx={11}
              fill={t.accent ? `${accent}33` : dim}
              stroke={t.accent ? accent : 'transparent'}
              strokeWidth={t.accent ? 1 : 0}
            />
            <circle cx={t.x + 10} cy={t.y + 11} r={3} fill={t.accent ? accent : '#8F90A6'} />
            <text
              x={t.x + 20}
              y={t.y + 15}
              fontSize="11"
              fontWeight="600"
              fill={t.accent ? accent : isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.70)'}
              fontFamily="system-ui"
            >
              {t.label}
            </text>
          </g>
        ))}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Vocabulary"
        title="Speak your OCC's language"
        caption="Rename categories so the feed reads naturally to your crew."
      />
    </HeroFrame>
  )
}

/* ── 6. Status Labels — Workflow dots with gradient line ── */
export function StatusesHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const labels = ['Open', 'Assigned', 'Active', 'Resolved', 'Closed']
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-8 top-1/2 -translate-y-1/2"
        width="280"
        height="100"
        viewBox="0 0 280 100"
        aria-hidden
      >
        <defs>
          <linearGradient id="statusGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#06C270" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FF8800" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8F90A6" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* Connecting line */}
        <rect x={24} y={49} width={232} height={2} rx={1} fill="url(#statusGrad)" />
        {/* 5 dots */}
        {labels.map((l, i) => {
          const cx = 32 + i * 54
          const isCurrent = i === 2
          const isPast = i < 2
          const color = isCurrent ? '#FF8800' : isPast ? '#06C270' : '#8F90A6'
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={50}
                r={isCurrent ? 8 : 5}
                fill={isCurrent || isPast ? color : isDark ? '#13131A' : '#FAFAFC'}
                stroke={color}
                strokeWidth={isCurrent ? 0 : 2}
              />
              {isCurrent && <circle cx={cx} cy={50} r={13} fill={color} opacity="0.2" />}
              <text
                x={cx}
                y={78}
                fontSize="10"
                fontWeight={isCurrent ? 700 : 500}
                fill={isCurrent ? color : dim}
                textAnchor="middle"
                fontFamily="system-ui"
                opacity={isCurrent ? 1 : isPast ? 0.5 : 0.7}
              >
                {l}
              </text>
            </g>
          )
        })}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Lifecycle vocabulary"
        title="Name the stages your way"
        caption="Some airlines say Escalated. Others say Held. Your call."
      />
    </HeroFrame>
  )
}

/* ── 7. Resolution Types — Completion grid ── */
export function ResolutionsHero({ accent, isDark }: HeroProps) {
  const dim = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const tiles = [
    { x: 0, y: 0, done: true },
    { x: 1, y: 0, done: true },
    { x: 2, y: 0, done: false, active: true },
    { x: 0, y: 1, done: true },
    { x: 1, y: 1, done: false },
    { x: 2, y: 1, done: true },
  ]
  return (
    <HeroFrame accent={accent} isDark={isDark}>
      <svg
        className="absolute right-8 top-1/2 -translate-y-1/2"
        width="200"
        height="130"
        viewBox="0 0 200 130"
        aria-hidden
      >
        {tiles.map((t, i) => {
          const x = 10 + t.x * 62
          const y = 10 + t.y * 56
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={54}
                height={48}
                rx={8}
                fill={t.done ? `${accent}22` : dim}
                stroke={t.active ? accent : t.done ? `${accent}88` : 'transparent'}
                strokeWidth={t.active ? 1.5 : 1}
              />
              {t.done && (
                <path
                  d={`M ${x + 18} ${y + 26} L ${x + 24} ${y + 32} L ${x + 36} ${y + 18}`}
                  stroke={accent}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {t.active && (
                <g transform={`translate(${x + 27} ${y + 24})`}>
                  <circle r="8" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="10 4" opacity="0.8">
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0"
                      to="360"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      <HeroTitle
        accent={accent}
        isDark={isDark}
        eyebrow="Resolve vocabulary"
        title="How does OCC close the loop?"
        caption="Edit the options shown when marking an issue resolved."
      />
    </HeroFrame>
  )
}

/* ── Shared title block (left side of every hero) ── */
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
