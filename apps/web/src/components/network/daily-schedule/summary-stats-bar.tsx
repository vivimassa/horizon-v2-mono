"use client"

import { useTheme } from "@/components/theme-provider"
import { Plane, CheckCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react"
import type { SummaryStats } from "@/stores/use-daily-schedule-store"

interface SummaryStatsBarProps {
  stats: SummaryStats
}

export function SummaryStatsBar({ stats }: SummaryStatsBarProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const glassBg = isDark ? "rgba(25,25,33,0.85)" : "rgba(255,255,255,0.85)"
  const glassBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"

  const blockH = Math.floor(stats.blockMinutes / 60)
  const blockM = stats.blockMinutes % 60

  const pctColor = stats.assignedPct >= 90 ? "#06C270" : stats.assignedPct >= 70 ? "#FF8800" : "#FF3B3B"

  return (
    <div
      className="flex items-center gap-3 px-4 shrink-0 rounded-2xl"
      style={{ height: 40, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: "blur(20px)" }}
    >
      <Stat icon={Plane} label="Total" value={String(stats.total)} color="var(--module-accent, #1e40af)" />
      <Sep isDark={isDark} />
      <Stat icon={CheckCircle} label="Assigned" value={`${stats.assignedPct}%`} color={pctColor} />
      <Sep isDark={isDark} />
      <Stat icon={AlertTriangle} label="Unassigned" value={String(stats.unassigned)} color={stats.unassigned > 0 ? "#FF8800" : "#06C270"} />
      <Sep isDark={isDark} />
      <Stat icon={Clock} label="Block Hours" value={`${blockH}:${String(blockM).padStart(2, "0")}`} color="var(--module-accent, #1e40af)" />
      <Sep isDark={isDark} />
      <Stat icon={TrendingUp} label="Avg/Day" value={String(stats.avgPerDay)} color="var(--module-accent, #1e40af)" />
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} style={{ color }} strokeWidth={1.8} />
      <span className="text-[13px] text-hz-text-tertiary">{label}</span>
      <span className="text-[14px] font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

function Sep({ isDark }: { isDark: boolean }) {
  return <div className="w-px h-4" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />
}
