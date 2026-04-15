'use client'

import { CheckCircle2, Download, RotateCcw } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useSsimExportStore } from '@/stores/use-ssim-export-store'

/**
 * Right-pane "done" state for 1.2.2 SSIM Export. Compact success card
 * matching the SSIM Import results screen — same glass surface, same
 * checkmark + heading, same footer button row.
 */
export function ExportResult() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const result = useSsimExportStore((s) => s.lastResult)
  const triggerSave = useSsimExportStore((s) => s.triggerSave)
  const reset = useSsimExportStore((s) => s.reset)

  if (!result) return null

  const cardBg = isDark ? 'rgba(25,25,33,0.75)' : 'rgba(255,255,255,0.78)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const innerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'
  const innerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  return (
    <div className="flex-1 overflow-y-auto py-8 px-6 flex justify-center">
      <div className="w-full max-w-xl">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            backdropFilter: 'blur(18px) saturate(150%)',
            WebkitBackdropFilter: 'blur(18px) saturate(150%)',
            boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.35)' : '0 12px 40px rgba(96,97,112,0.12)',
          }}
        >
          <div className="px-7 pt-7 pb-6 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: 'rgba(6,194,112,0.15)',
                  border: '1px solid rgba(6,194,112,0.30)',
                }}
              >
                <CheckCircle2 size={22} strokeWidth={2} color="#06C270" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-[18px] font-bold tracking-tight text-hz-text">Export complete</h1>
                <p className="text-[13px] text-hz-text-secondary mt-0.5">
                  Your file has been generated and the browser save dialog should already be open.
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              <StatCell
                label="Flights"
                value={result.flightCount.toLocaleString()}
                innerBg={innerBg}
                innerBorder={innerBorder}
              />
              <StatCell
                label="File size"
                value={formatBytes(result.byteLength)}
                innerBg={innerBg}
                innerBorder={innerBorder}
              />
              <StatCell label="Format" value=".ssim" innerBg={innerBg} innerBorder={innerBorder} />
            </div>

            {/* Filename */}
            <div className="rounded-xl px-4 py-3" style={{ background: innerBg, border: `1px solid ${innerBorder}` }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-1">
                Filename
              </div>
              <div className="text-[14px] font-medium text-hz-text break-all font-mono">{result.filename}</div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={triggerSave}
                className="flex-1 h-10 inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white bg-module-accent hover:opacity-90 transition-opacity"
              >
                <Download size={14} strokeWidth={2.2} />
                Download again
              </button>
              <button
                type="button"
                onClick={reset}
                className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-hz-text transition-opacity hover:opacity-80"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
                }}
              >
                <RotateCcw size={14} strokeWidth={2.2} />
                Export another
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCell({
  label,
  value,
  innerBg,
  innerBorder,
}: {
  label: string
  value: string
  innerBg: string
  innerBorder: string
}) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: innerBg, border: `1px solid ${innerBorder}` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-1">{label}</div>
      <div className="text-[18px] font-bold text-hz-text tabular-nums">{value}</div>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
