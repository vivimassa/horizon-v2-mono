'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useSsimExportStore } from '@/stores/use-ssim-export-store'
import { SsimExportSetupPanel } from './ssim-export-setup-panel'
import { ExportResult } from './export-result'

/**
 * Top-level shell for 1.2.2 SSIM Export. Mirrors the SSIM Import shell
 * 1:1 in layout and theming so the two siblings feel like one feature
 * with two verbs:
 *   - Left: <SsimExportSetupPanel> (filter-panel kit)
 *   - Right: workspace pane that swaps by stage —
 *       idle       → EmptyPanel
 *       generating → RunwayLoadingPanel
 *       done       → ExportResult (success card with re-download)
 *       error      → ErrorState (red alert)
 */
export function SsimExportShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const stage = useSsimExportStore((s) => s.stage)
  const errorMessage = useSsimExportStore((s) => s.errorMessage)
  const reset = useSsimExportStore((s) => s.reset)

  // Reset on unmount so re-entering the page shows a clean slate.
  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  return (
    <div className="h-full flex gap-4 p-4">
      {/* Left column — setup panel */}
      <SsimExportSetupPanel />

      {/* Right column — workspace */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        {stage === 'idle' && (
          <EmptyPanel message="Configure the export filters on the left, then click Download SSIM." />
        )}
        {stage === 'error' && <ErrorState message={errorMessage} isDark={isDark} />}
        {stage === 'generating' && <RunwayLoadingPanel percent={45} label="Generating SSIM file…" />}
        {stage === 'done' && (
          <EmptyPanel>
            <ExportResult />
          </EmptyPanel>
        )}
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
          <div className="text-[14px] font-semibold text-hz-text">Export failed</div>
          <div className="text-[13px] text-hz-text-secondary mt-1">{message ?? 'Unknown error — please retry.'}</div>
        </div>
      </div>
    </div>
  )
}
