'use client'

import { memo } from 'react'

// Simplified continent silhouettes, hand-drawn in a 1000x360 viewBox to loosely
// resemble an equirectangular world projection: North America (top-left),
// South America (lower-left), Europe (top-center), Africa (center), Asia
// (top-right), Oceania (lower-right). The shapes are used as a mask for a dot
// pattern, so individual path accuracy matters less than overall recognisability.
const CONTINENT_PATHS = [
  // North America
  'M 70 70 Q 110 50 180 55 Q 240 60 280 80 Q 310 95 305 125 Q 300 150 270 155 Q 240 170 220 165 Q 200 175 180 170 Q 150 180 130 170 Q 100 165 85 145 Q 65 120 70 90 Z',
  // Central America + Caribbean blob
  'M 245 170 Q 270 175 280 195 Q 275 215 255 215 Q 235 210 230 195 Q 232 178 245 170 Z',
  // South America
  'M 260 220 Q 300 225 325 250 Q 335 290 320 325 Q 300 350 275 340 Q 255 325 250 295 Q 245 260 260 225 Z',
  // Greenland
  'M 340 45 Q 380 45 390 70 Q 385 90 360 92 Q 340 88 335 70 Q 335 52 340 45 Z',
  // Europe
  'M 470 75 Q 510 70 555 85 Q 575 95 565 110 Q 540 120 510 120 Q 485 118 470 108 Q 460 92 470 78 Z',
  // UK
  'M 455 85 Q 465 82 470 95 Q 468 105 455 105 Q 448 98 452 88 Z',
  // Africa
  'M 495 135 Q 540 130 585 145 Q 610 160 610 200 Q 605 240 580 275 Q 555 305 525 300 Q 500 295 488 260 Q 478 215 485 175 Q 488 150 495 138 Z',
  // Madagascar
  'M 615 245 Q 625 248 625 265 Q 620 280 612 278 Q 606 265 610 248 Z',
  // Arabian Peninsula
  'M 595 150 Q 620 152 635 170 Q 630 185 610 188 Q 595 180 592 165 Z',
  // Asia (main landmass)
  'M 565 70 Q 650 55 760 65 Q 830 75 870 95 Q 880 120 860 140 Q 800 160 730 155 Q 670 160 620 150 Q 585 140 570 120 Q 560 90 565 72 Z',
  // India
  'M 665 155 Q 690 158 700 185 Q 695 210 678 210 Q 660 200 655 180 Q 655 162 665 155 Z',
  // Southeast Asia / Indochina
  'M 735 165 Q 760 168 765 190 Q 755 205 740 205 Q 725 195 725 178 Z',
  // Indonesia / Philippines (archipelago dots)
  'M 770 210 Q 790 213 800 220 Q 790 225 775 224 Q 765 218 770 210 Z',
  'M 810 205 Q 825 207 830 215 Q 822 220 812 218 Q 805 212 810 205 Z',
  'M 835 195 Q 848 198 850 205 Q 843 210 833 207 Q 828 200 835 195 Z',
  // Japan
  'M 860 115 Q 870 115 875 128 Q 870 140 862 140 Q 855 130 858 118 Z',
  // Oceania (Australia)
  'M 790 270 Q 855 265 895 280 Q 905 305 880 320 Q 830 325 795 315 Q 775 295 790 272 Z',
  // New Zealand
  'M 920 315 Q 930 315 932 325 Q 928 335 918 332 Q 915 322 920 316 Z',
  // Antarctica strip
  'M 30 340 Q 200 335 500 345 Q 800 340 970 345 L 970 360 L 30 360 Z',
]

interface TicketHeroBackgroundProps {
  idPrefix?: string
}

function TicketHeroBackgroundImpl({ idPrefix = 'pt-hero' }: TicketHeroBackgroundProps) {
  const dotsId = `${idPrefix}-dots`
  const glowTrId = `${idPrefix}-glow-tr`
  const glowBlId = `${idPrefix}-glow-bl`
  const arcGradId = `${idPrefix}-arc`
  const gridId = `${idPrefix}-grid`
  const worldMaskId = `${idPrefix}-world-mask`
  const routePathId = `${idPrefix}-route`

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 360"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        {/* Subtle grid */}
        <pattern id={gridId} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        </pattern>

        {/* Dots for the earth silhouette */}
        <pattern id={dotsId} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.4" fill="rgba(255,255,255,0.55)" />
        </pattern>

        {/* Warm radial glow top-right (accent) */}
        <radialGradient id={glowTrId} cx="88%" cy="10%" r="60%">
          <stop offset="0%" stopColor="rgba(96,165,250,0.38)" />
          <stop offset="55%" stopColor="rgba(96,165,250,0.08)" />
          <stop offset="100%" stopColor="rgba(96,165,250,0)" />
        </radialGradient>

        {/* Cool counter glow bottom-left */}
        <radialGradient id={glowBlId} cx="10%" cy="95%" r="55%">
          <stop offset="0%" stopColor="rgba(37,99,235,0.32)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0)" />
        </radialGradient>

        {/* Arc stroke gradient */}
        <linearGradient id={arcGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
        </linearGradient>

        {/* Mask that reveals dots only inside continents */}
        <mask id={worldMaskId}>
          <rect width="1000" height="360" fill="black" />
          <g fill="white">
            {CONTINENT_PATHS.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </mask>

        {/* Path referenced by animateMotion */}
        <path id={routePathId} d="M 210 205 Q 500 70 790 205" />
      </defs>

      {/* Base grid */}
      <rect width="1000" height="360" fill={`url(#${gridId})`} />

      {/* Dotted earth silhouette */}
      <rect width="1000" height="360" fill={`url(#${dotsId})`} mask={`url(#${worldMaskId})`} />

      {/* Radial glows on top for depth */}
      <rect width="1000" height="360" fill={`url(#${glowTrId})`} />
      <rect width="1000" height="360" fill={`url(#${glowBlId})`} />

      {/* Latitude guide lines — extremely faint, globe-like */}
      <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" fill="none">
        <path d="M 0 120 Q 500 110 1000 120" />
        <path d="M 0 180 Q 500 172 1000 180" />
        <path d="M 0 240 Q 500 234 1000 240" />
      </g>

      {/* Route arc */}
      <use
        href={`#${routePathId}`}
        fill="none"
        stroke={`url(#${arcGradId})`}
        strokeWidth="1.6"
        strokeDasharray="6 9"
        strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-60" dur="3.2s" repeatCount="indefinite" />
      </use>

      {/* Endpoint pulses */}
      <g>
        <circle cx="210" cy="205" r="3.5" fill="#ffffff" />
        <circle cx="210" cy="205" r="4" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1">
          <animate attributeName="r" values="4;14;4" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.85;0;0.85" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </g>
      <g>
        <circle cx="790" cy="205" r="3.5" fill="#ffffff" />
        <circle cx="790" cy="205" r="4" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1">
          <animate attributeName="r" values="4;14;4" dur="2.4s" repeatCount="indefinite" begin="1.2s" />
          <animate attributeName="opacity" values="0.85;0;0.85" dur="2.4s" repeatCount="indefinite" begin="1.2s" />
        </circle>
      </g>

      {/* Plane flying along the arc (real Lucide plane path, pre-rotated so nose points east) */}
      <g>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="9s" repeatCount="indefinite" />
        <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
          <mpath href={`#${routePathId}`} />
        </animateMotion>
        <g transform="rotate(45)">
          <circle r="16" fill="rgba(255,255,255,0.10)" />
          <circle r="17" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
          <g transform="translate(-12, -12)">
            <path
              d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
              fill="rgba(255,255,255,0.98)"
              stroke="rgba(255,255,255,0.98)"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </g>
    </svg>
  )
}

export const TicketHeroBackground = memo(TicketHeroBackgroundImpl)
