"use client"

import { useTheme } from "@/components/theme-provider"
import { RunwayBar } from "./global-runway-progress"

interface RunwayLoadingPanelProps {
  percent: number
  label: string
}

export function RunwayLoadingPanel({ percent, label }: RunwayLoadingPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/skyhub-logo.png"
        alt=""
        aria-hidden="true"
        data-watermark
        className="select-none mb-10"
        style={{
          width: 400,
          filter: isDark ? "brightness(10) grayscale(1)" : "grayscale(1) brightness(0)",
          opacity: isDark ? 0.051 : 0.038,
          animation: "grp-logo-breathe 3s ease-in-out infinite",
        }}
        draggable={false}
      />
      <div className="w-full max-w-2xl px-4" style={{ opacity: 0.8 }}>
        <RunwayBar percent={percent} label={label} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes grp-logo-breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
      `}} />
    </div>
  )
}
