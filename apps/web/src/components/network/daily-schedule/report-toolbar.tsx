"use client"

import { useState } from "react"
import { Columns3, Rows3, Download, FileText, FileSpreadsheet, FileDown, ChevronDown, Plane, CheckCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useDailyScheduleStore, COLUMN_DEFS } from "@/stores/use-daily-schedule-store"
import type { SummaryStats } from "@/stores/use-daily-schedule-store"

interface ReportToolbarProps {
  stats: SummaryStats
  onExport?: (format: "csv" | "xlsx" | "pdf") => void
}

export function ReportToolbar({ stats, onExport }: ReportToolbarProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const { hiddenColumns, toggleColumn, compactMode, setCompactMode } = useDailyScheduleStore()
  const [colOpen, setColOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const glassBg = isDark ? "rgba(25,25,33,0.85)" : "rgba(255,255,255,0.85)"
  const glassBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"
  const btnBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
  const btnBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"

  const blockH = Math.floor(stats.blockMinutes / 60)
  const blockM = stats.blockMinutes % 60
  const pctColor = stats.assignedPct >= 90 ? "#06C270" : stats.assignedPct >= 70 ? "#FF8800" : "#FF3B3B"

  return (
    <div
      className="flex items-center gap-2 px-4 shrink-0 rounded-2xl relative z-10"
      style={{ height: 44, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: "blur(20px)" }}
    >
      {/* Stats — left side */}
      <div className="flex items-center gap-3 mr-auto">
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

      {/* Compact toggle */}
      <button
        onClick={() => setCompactMode(!compactMode)}
        className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors"
        style={{ background: compactMode ? "var(--module-accent, #1e40af)" : btnBg, color: compactMode ? "#fff" : undefined, border: `1px solid ${compactMode ? "transparent" : btnBorder}` }}
        title={compactMode ? "Normal rows" : "Compact rows"}
      >
        <Rows3 size={14} />
        <span className="hidden sm:inline">{compactMode ? "Compact" : "Normal"}</span>
      </button>

      {/* Column visibility */}
      <div className="relative">
        <button
          onClick={() => { setColOpen(o => !o); setExportOpen(false) }}
          className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors"
          style={{ background: btnBg, border: `1px solid ${btnBorder}` }}
          title="Toggle columns"
        >
          <Columns3 size={14} />
          <span className="hidden sm:inline">Columns</span>
          <ChevronDown size={12} />
        </button>
        {colOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-48 rounded-xl py-1 z-[100]"
            style={{
              background: isDark ? "rgba(25,25,33,0.95)" : "rgba(255,255,255,0.98)",
              border: `1px solid ${glassBorder}`,
              boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(96,97,112,0.12)",
            }}
          >
            {COLUMN_DEFS.map(col => {
              const visible = !hiddenColumns.has(col.id)
              const accent = "var(--module-accent, #1e40af)"
              return (
                <button
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className="w-full flex items-center gap-2.5 h-8 px-3 hover:bg-hz-border/20 transition-colors"
                >
                  <span className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                    style={{ borderColor: visible ? accent : (isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.20)"), background: visible ? accent : "transparent" }}>
                    {visible && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <span className="text-[13px] font-medium text-hz-text">{col.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="relative">
        <button
          onClick={() => { setExportOpen(o => !o); setColOpen(false) }}
          className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--module-accent, #1e40af)" }}
        >
          <Download size={14} />
          <span className="hidden sm:inline">Export</span>
          <ChevronDown size={12} />
        </button>
        {exportOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-40 rounded-xl py-1 z-[100]"
            style={{
              background: isDark ? "rgba(25,25,33,0.95)" : "rgba(255,255,255,0.98)",
              border: `1px solid ${glassBorder}`,
              boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(96,97,112,0.12)",
            }}
          >
            {([
              { key: "csv" as const, label: "CSV", icon: FileText },
              { key: "xlsx" as const, label: "Excel", icon: FileSpreadsheet },
              { key: "pdf" as const, label: "PDF", icon: FileDown },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { onExport?.(key); setExportOpen(false) }}
                className="w-full flex items-center gap-2.5 h-9 px-3 hover:bg-hz-border/20 transition-colors"
              >
                <Icon size={14} className="text-hz-text-secondary" />
                <span className="text-[13px] font-medium text-hz-text">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
