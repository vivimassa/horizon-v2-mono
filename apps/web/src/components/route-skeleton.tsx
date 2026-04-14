'use client'

import { useTheme } from './theme-provider'

/**
 * Shared loading skeleton rendered by Next.js App Router's loading.tsx
 * boundaries while a module segment is streaming. Gives the zoom-in
 * transition a structured target to land on instead of a white flash.
 * Uses neutral glass-ish blocks that read in both light and dark mode.
 */
export function RouteSkeleton() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const block = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
  const sheen = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'

  return (
    <>
      <style>{`
        @keyframes skyhub-skeleton-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .sk-block {
          background: linear-gradient(90deg, ${block} 0%, ${sheen} 50%, ${block} 100%);
          background-size: 800px 100%;
          animation: skyhub-skeleton-shimmer 1400ms linear infinite;
          border-radius: 10px;
        }
      `}</style>
      <div className="p-6 flex flex-col gap-4 h-full">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="sk-block" style={{ width: 40, height: 40, borderRadius: 999 }} />
          <div className="sk-block" style={{ width: 180, height: 18 }} />
          <div className="flex-1" />
          <div className="sk-block" style={{ width: 110, height: 30 }} />
        </div>
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk-block" style={{ height: 84 }} />
          ))}
        </div>
        {/* Main body */}
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-[280px]">
          <div className="sk-block col-span-2" />
          <div className="flex flex-col gap-3">
            <div className="sk-block flex-1" />
            <div className="sk-block flex-1" />
          </div>
        </div>
      </div>
    </>
  )
}
