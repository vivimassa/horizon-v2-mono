'use client'

import { useEffect } from 'react'
import { FileUp, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { useSsimImportStore } from '@/stores/use-ssim-import-store'
import { SsimSetupPanel } from './ssim-setup-panel'
import { ParsedPreview } from './parsed-preview'
import { ImportResults } from './import-results'

/**
 * Top-level shell for 1.2.1 SSIM Import. Two columns:
 *   - Left: <SsimSetupPanel> (our filter-panel kit)
 *   - Right: workspace pane, swaps by stage — empty, preview, runway, results
 *
 * Runway progress is driven by the store's currentStep + stepLabel, mapped
 * onto the same <RunwayLoadingPanel> used by every other shell (schedule
 * grid, gantt, movement control, etc.).
 */
export function SsimImportShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const stage = useSsimImportStore((s) => s.stage)
  const parseResult = useSsimImportStore((s) => s.parseResult)
  const importResult = useSsimImportStore((s) => s.importResult)
  const mode = useSsimImportStore((s) => s.mode)
  const errorMessage = useSsimImportStore((s) => s.errorMessage)
  const reset = useSsimImportStore((s) => s.reset)
  const currentStep = useSsimImportStore((s) => s.currentStep)
  const stepLabel = useSsimImportStore((s) => s.stepLabel)

  // Reset on unmount so re-entering the page shows a clean slate.
  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  return (
    <div className="h-full flex gap-4 p-4">
      {/* Left column — setup panel */}
      <SsimSetupPanel />

      {/* Right column — workspace */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        {stage === 'idle' && <IdleEmptyState isDark={isDark} />}
        {stage === 'error' && <ErrorState message={errorMessage} isDark={isDark} />}
        {stage === 'parsing' && <RunwayLoadingPanel percent={30} label={stepLabel || 'Parsing…'} />}
        {stage === 'importing' && (
          <RunwayLoadingPanel percent={Math.min(10 + (currentStep / 6) * 85, 95)} label={stepLabel || 'Importing…'} />
        )}
        {stage === 'parsed' && parseResult && <ParsedPreview result={parseResult} />}
        {stage === 'done' && importResult && <ImportResults result={importResult} mode={mode} />}
      </div>
    </div>
  )
}

function IdleEmptyState({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div
        className="max-w-md w-full text-center rounded-2xl p-8 flex flex-col items-center gap-3"
        style={{
          background: isDark ? 'rgba(25,25,33,0.55)' : 'rgba(255,255,255,0.55)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
          backdropFilter: 'blur(18px) saturate(150%)',
          WebkitBackdropFilter: 'blur(18px) saturate(150%)',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--module-accent, #1e40af) 18%, transparent)' }}
        >
          <FileUp size={22} strokeWidth={1.8} className="text-module-accent" />
        </div>
        <h2 className="text-[16px] font-bold text-hz-text">Drop a Chapter-7 SSIM file to begin</h2>
        <p className="text-[13px] text-hz-text-secondary leading-relaxed">
          Pick the file, the import period, and your rotation preference on the left. Preview mode parses and validates
          without writing anything to the database.
        </p>
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
          <div className="text-[14px] font-semibold text-hz-text">Something went wrong</div>
          <div className="text-[12px] text-hz-text-secondary mt-1">{message ?? 'Unknown error — please retry.'}</div>
        </div>
      </div>
    </div>
  )
}
