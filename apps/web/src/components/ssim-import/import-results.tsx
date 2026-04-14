'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useSsimImportStore, type SsimImportResult } from '@/stores/use-ssim-import-store'

interface ImportResultsProps {
  result: SsimImportResult
  mode: 'replace' | 'merge' | 'preview'
}

/**
 * Right-pane "we're done" card rendered after the orchestrator finishes.
 * For Preview mode, shows what WOULD have happened. For Replace/Merge,
 * shows the real tally plus any per-record errors.
 */
export function ImportResults({ result, mode }: ImportResultsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const reset = useSsimImportStore((s) => s.reset)
  const router = useRouter()

  const cardBg = isDark ? 'rgba(25,25,33,0.75)' : 'rgba(255,255,255,0.75)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const [errorsOpen, setErrorsOpen] = useState(false)

  const isPreview = mode === 'preview'
  const title = isPreview ? 'Preview complete' : 'Import complete'
  const subtitle = isPreview
    ? `${result.droppedOutOfPeriod} legs would be dropped out of period. No writes performed.`
    : `${result.imported} flight${result.imported === 1 ? '' : 's'} imported.`

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="max-w-xl w-full rounded-2xl p-6"
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          backdropFilter: 'blur(18px) saturate(150%)',
          WebkitBackdropFilter: 'blur(18px) saturate(150%)',
          boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.35)' : '0 12px 40px rgba(96,97,112,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(6,194,112,0.14)' }}
          >
            <CheckCircle2 size={20} style={{ color: '#06C270' }} />
          </div>
          <div>
            <div className="text-[16px] font-bold text-hz-text leading-tight">{title}</div>
            <div className="text-[12px] text-hz-text-secondary">{subtitle}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <ResultStat label="Imported" value={result.imported} highlight />
          {mode === 'replace' && <ResultStat label="Deleted" value={result.deleted} />}
          <ResultStat label="Airports created" value={result.airportsCreated} />
          <ResultStat label="City pairs created" value={result.cityPairsCreated} />
          <ResultStat label="Block times updated" value={result.blockTimesUpdated} />
          <ResultStat label="Dropped (out of period)" value={result.droppedOutOfPeriod} />
        </div>

        {/* Errors */}
        {result.errors.length > 0 && (
          <div
            className="rounded-xl p-3 mb-4"
            style={{
              background: 'rgba(255,59,59,0.06)',
              border: '1px solid rgba(255,59,59,0.18)',
            }}
          >
            <button
              type="button"
              onClick={() => setErrorsOpen((v) => !v)}
              className="w-full flex items-center gap-2 focus:outline-none"
            >
              <span className="flex-1 text-left text-[13px] font-semibold text-hz-text">
                {result.errors.length} row{result.errors.length === 1 ? '' : 's'} skipped
              </span>
              {errorsOpen ? (
                <ChevronDown size={14} className="text-hz-text-tertiary" />
              ) : (
                <ChevronRight size={14} className="text-hz-text-tertiary" />
              )}
            </button>
            {errorsOpen && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-[12px] font-mono text-hz-text-secondary">
                    <span className="text-hz-text-tertiary">Line {e.lineNo}:</span> {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-[13px] font-semibold transition-colors"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
              color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)',
            }}
          >
            <RotateCcw size={14} strokeWidth={2} />
            Import another
          </button>
          {!isPreview && (
            <button
              type="button"
              onClick={() => router.push('/network/control/schedule-grid')}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: 'var(--module-accent, #1e40af)',
                boxShadow: '0 4px 14px color-mix(in srgb, var(--module-accent, #1e40af) 35%, transparent)',
              }}
            >
              View in Scheduling XL
              <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: highlight ? 'color-mix(in srgb, var(--module-accent, #1e40af) 10%, transparent)' : 'transparent',
        border: `1px solid ${highlight ? 'color-mix(in srgb, var(--module-accent, #1e40af) 24%, transparent)' : 'rgba(127,127,140,0.15)'}`,
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{label}</div>
      <div className="text-[20px] font-bold text-hz-text tabular-nums leading-none mt-1">{value}</div>
    </div>
  )
}
