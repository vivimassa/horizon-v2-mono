'use client'

import { useState } from 'react'

interface AirlineLogoProps {
  iataCode: string
  /** px width & height of the container */
  size?: number
  isDark: boolean
  className?: string
}

function getAirlineLogoUrl(iataCode: string): string {
  return `https://pics.avs.io/200/80/${iataCode}.png`
}

/** Airline logo from pics.avs.io with SkyHub fallback. */
export function AirlineLogo({ iataCode, size = 32, isDark, className = '' }: AirlineLogoProps) {
  const [failed, setFailed] = useState(false)

  const containerBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div
      className={`rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: containerBg,
        border: `1px solid ${borderColor}`,
      }}
    >
      {iataCode && !failed ? (
        <img
          src={getAirlineLogoUrl(iataCode)}
          alt={iataCode}
          className="object-contain"
          style={{ width: size - 4, height: size - 4 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src="/skyhub-logo.png"
          alt="SkyHub"
          className="object-contain opacity-40"
          style={{ width: size - 6, height: size - 6 }}
        />
      )}
    </div>
  )
}
