'use client'

import { useTheme } from '@/components/theme-provider'

interface EmptyPanelProps {
  message?: string
  className?: string
}

/**
 * Glass-styled empty state panel with SkyHub logo watermark.
 * Use as the right-panel placeholder before data is loaded.
 */
export function EmptyPanel({
  message = 'Select a period and click Go to load the schedule',
  className = '',
}: EmptyPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center rounded-2xl ${className}`}
      style={{
        background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/skyhub-logo.png"
        alt=""
        aria-hidden="true"
        data-watermark
        className="select-none mb-6"
        style={{
          width: 360,
          filter: isDark ? 'brightness(10) grayscale(1)' : 'grayscale(1) brightness(0)',
          opacity: isDark ? 0.051 : 0.038,
        }}
        draggable={false}
      />
      <p className="text-[14px] text-hz-text-secondary" style={{ opacity: 0.64 }}>
        {message}
      </p>
    </div>
  )
}
