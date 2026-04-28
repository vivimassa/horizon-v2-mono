'use client'

/**
 * Hero illustrations for 7.1.6 Task configuration dialogs.
 *
 * One SVG per built-in task. Pattern follows the 4.1.6.3 Scheduling
 * Configurations heroes (apps/web/src/components/crew-ops/scheduling-config/section-heroes.tsx)
 * but sized for the compact 104px dialog header — width 220, height 80.
 */

interface IllustrationProps {
  accent: string
  isDark: boolean
}

/** Daily Crew Activity Log — three stacked rolling-window bars + radial dial. */
export function DailyCrewActivityLogHero({ accent, isDark }: IllustrationProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  const bars = [
    { label: '28D', pct: 0.62 },
    { label: '90D', pct: 0.41 },
    { label: '365D', pct: 0.78 },
  ]
  return (
    <svg width="220" height="80" viewBox="0 0 220 80" aria-hidden>
      {/* Stacked rolling-window bars */}
      <g transform="translate(0 8)">
        {bars.map((b, i) => (
          <g key={b.label} transform={`translate(0 ${i * 22})`}>
            <text
              x="0"
              y="14"
              fontSize="9"
              fontWeight="700"
              fontFamily="ui-monospace, monospace"
              fill={dim}
              opacity="0.7"
              letterSpacing="0.05em"
            >
              {b.label}
            </text>
            {/* Track */}
            <rect x="32" y="6" width="120" height="10" rx="5" fill={dim} opacity="0.18" />
            {/* Fill */}
            <rect x="32" y="6" width={120 * b.pct} height="10" rx="5" fill={accent} opacity={0.85 - i * 0.15} />
            {/* End-cap dot */}
            <circle cx={32 + 120 * b.pct} cy="11" r="2.5" fill={accent} />
          </g>
        ))}
      </g>

      {/* Radial dial — running total */}
      <g transform="translate(186 36)">
        <circle r="22" fill="none" stroke={dim} strokeWidth="3" opacity="0.18" />
        <circle
          r="22"
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${22 * 2 * Math.PI * 0.62} ${22 * 2 * Math.PI}`}
          transform="rotate(-90)"
        />
        <text
          x="0"
          y="2"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="system-ui"
          fill={isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'}
        >
          62%
        </text>
        <text
          x="0"
          y="13"
          fontSize="7"
          textAnchor="middle"
          fontFamily="system-ui"
          fill={dim}
          opacity="0.7"
          letterSpacing="0.06em"
        >
          BH/CAP
        </text>
      </g>
    </svg>
  )
}

/** Generic fallback hero for unknown taskKey. */
export function GenericTaskHero({ accent, isDark }: IllustrationProps) {
  const dim = isDark ? '#8F90A6' : '#555770'
  return (
    <svg width="220" height="80" viewBox="0 0 220 80" aria-hidden>
      <g transform="translate(60 16)">
        <circle cx="50" cy="24" r="22" fill="none" stroke={accent} strokeWidth="2.5" opacity="0.85" />
        {/* Clock hands */}
        <line x1="50" y1="24" x2="50" y2="9" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="24" x2="62" y2="24" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <circle cx="50" cy="24" r="2" fill={accent} />
        {/* Tick marks */}
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1="50"
            y1="6"
            x2="50"
            y2="9"
            stroke={dim}
            strokeWidth="1.4"
            opacity="0.5"
            transform={`rotate(${deg} 50 24)`}
          />
        ))}
      </g>
    </svg>
  )
}

/** Pick the right hero for a taskKey. Add a case here when introducing new tasks. */
export function HeroForTask({ taskKey, accent, isDark }: { taskKey: string } & IllustrationProps) {
  switch (taskKey) {
    case 'daily-crew-activity-log':
      return <DailyCrewActivityLogHero accent={accent} isDark={isDark} />
    default:
      return <GenericTaskHero accent={accent} isDark={isDark} />
  }
}
