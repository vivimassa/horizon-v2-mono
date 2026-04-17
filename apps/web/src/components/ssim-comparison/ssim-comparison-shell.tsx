'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { collapseDock } from '@/lib/dock-store'
import { useSsimComparisonStore } from '@/stores/use-ssim-comparison-store'
import { SsimComparisonSetupPanel } from './ssim-comparison-setup-panel'
import { ComparisonReport } from './comparison-report'

/**
 * Top-level shell for 1.2.3 SSIM Comparison. Mirrors the SSIM Import +
 * Export shells 1:1 so the three tools feel like one feature family.
 *   - Left: <SsimComparisonSetupPanel> (filter-panel kit)
 *   - Right: workspace that swaps by stage —
 *       idle       → EmptyPanel
 *       parsing    → RunwayLoadingPanel (file parse)
 *       ready      → EmptyPanel ("Click Compare…")
 *       comparing  → RunwayLoadingPanel
 *       done       → <ComparisonReport>
 *       error      → ErrorCard
 */
export function SsimComparisonShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const stage = useSsimComparisonStore((s) => s.stage)
  const errorMessage = useSsimComparisonStore((s) => s.errorMessage)
  const reset = useSsimComparisonStore((s) => s.reset)

  useEffect(() => {
    collapseDock()
  }, [])

  useEffect(() => {
    return () => reset()
  }, [reset])

  return (
    <div className="h-full flex gap-4 p-4">
      <SsimComparisonSetupPanel />

      <div className="flex-1 min-w-0 h-full flex flex-col">
        {stage === 'idle' && (
          <EmptyPanel message="Upload two SSIM files on the left, pick a date range, then click Compare." />
        )}
        {stage === 'parsing' && <RunwayLoadingPanel percent={45} label="Parsing SSIM file…" />}
        {stage === 'ready' && (
          <EmptyPanel message="Files parsed. Adjust the date range and aircraft filter, then click Compare." />
        )}
        {stage === 'comparing' && <RunwayLoadingPanel percent={70} label="Computing comparison…" />}
        {stage === 'error' && <ErrorState message={errorMessage} isDark={isDark} />}
        {stage === 'done' && <ComparisonReport />}
      </div>
    </div>
  )
}

function ErrorState({ message, isDark }: { message: string | null; isDark: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="max-w-md w-full rounded-2xl p-5 flex items-start gap-3"
        style={{
          background: isDark ? 'rgba(255,59,59,0.08)' : 'rgba(255,59,59,0.04)',
          border: '1px solid rgba(255,59,59,0.25)',
        }}
      >
        <AlertTriangle size={18} style={{ color: '#FF3B3B' }} className="shrink-0 mt-0.5" />
        <div>
          <div className="text-[14px] font-semibold text-hz-text">Comparison failed</div>
          <div className="text-[13px] text-hz-text-secondary mt-1">{message ?? 'Unknown error — please retry.'}</div>
        </div>
      </div>
    </div>
  )
}
