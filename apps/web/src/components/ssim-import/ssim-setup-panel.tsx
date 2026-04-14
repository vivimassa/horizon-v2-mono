'use client'

import {
  FilterPanel,
  FilterSection,
  PeriodField,
  SegmentedField,
  FileField,
  FilterGoButton,
} from '@/components/filter-panel'
import { useSsimImportStore } from '@/stores/use-ssim-import-store'

/**
 * Left-side setup panel for 1.2.1 SSIM Import. Composes the kit
 * primitives. Drives parse → import orchestration via the zustand store.
 * The Go button label flips by stage: "Parse" → "Import" / "Done".
 */
export function SsimSetupPanel() {
  const stage = useSsimImportStore((s) => s.stage)
  const file = useSsimImportStore((s) => s.file)
  const setFile = useSsimImportStore((s) => s.setFile)
  const timeMode = useSsimImportStore((s) => s.timeMode)
  const setTimeMode = useSsimImportStore((s) => s.setTimeMode)
  const mode = useSsimImportStore((s) => s.mode)
  const setMode = useSsimImportStore((s) => s.setMode)
  const rotationMode = useSsimImportStore((s) => s.rotationMode)
  const setRotationMode = useSsimImportStore((s) => s.setRotationMode)
  const autoCreateAirports = useSsimImportStore((s) => s.autoCreateAirports)
  const setAutoCreateAirports = useSsimImportStore((s) => s.setAutoCreateAirports)
  const autoCreateCityPairs = useSsimImportStore((s) => s.autoCreateCityPairs)
  const setAutoCreateCityPairs = useSsimImportStore((s) => s.setAutoCreateCityPairs)
  const periodFrom = useSsimImportStore((s) => s.periodFrom)
  const periodTo = useSsimImportStore((s) => s.periodTo)
  const setPeriod = useSsimImportStore((s) => s.setPeriod)
  const parse = useSsimImportStore((s) => s.parse)
  const runImport = useSsimImportStore((s) => s.runImport)

  const isIdle = stage === 'idle' || stage === 'error'
  const isParsed = stage === 'parsed'
  const isBusy = stage === 'parsing' || stage === 'importing'
  const periodMissing = !periodFrom || !periodTo

  // Button label depends on whether we've parsed and which mode is selected.
  const goLabel = isParsed ? (mode === 'preview' ? 'Done' : 'Import') : 'Parse'
  const goHint =
    isIdle && !file ? 'Select a SSIM file to begin' : periodMissing ? 'Select the import period' : undefined

  function handleGo() {
    if (isParsed) {
      runImport()
    } else {
      parse()
    }
  }

  // Rotation mode toggle is always active; user must decide per import.
  const rotationOptions = [
    { key: 'single-leg' as const, label: 'Single-leg' },
    { key: 'combine-ofr' as const, label: 'Combine via OFR' },
  ]
  const modeOptions = [
    { key: 'replace' as const, label: 'Replace' },
    { key: 'merge' as const, label: 'Merge' },
    { key: 'preview' as const, label: 'Preview' },
  ]
  const timeOptions = [
    { key: 'standard' as const, label: 'Standard' },
    { key: 'utc_only' as const, label: 'UTC only' },
  ]

  // Active-count badge: count of non-default choices the user has made.
  const activeCount =
    (file ? 1 : 0) +
    (periodFrom ? 1 : 0) +
    (periodTo ? 1 : 0) +
    (timeMode !== 'standard' ? 1 : 0) +
    (mode !== 'replace' ? 1 : 0) +
    (rotationMode !== 'combine-ofr' ? 1 : 0)

  return (
    <FilterPanel
      title="SSIM Import"
      activeCount={activeCount}
      footer={
        <FilterGoButton
          onClick={handleGo}
          loading={isBusy}
          disabled={!file || periodMissing}
          label={goLabel}
          hint={goHint}
        />
      }
    >
      <FilterSection label="SSIM File">
        <FileField
          value={file}
          onChange={setFile}
          accept=".txt,.ssim,.dat"
          placeholder="Drop a Chapter-7 SSIM file"
          hint="Accepted: .txt, .ssim, .dat"
        />
      </FilterSection>

      <FilterSection label="Period">
        <PeriodField
          from={periodFrom}
          to={periodTo}
          onChangeFrom={(v) => setPeriod(v, periodTo)}
          onChangeTo={(v) => setPeriod(periodFrom, v)}
        />
      </FilterSection>

      <FilterSection label="Time format">
        <SegmentedField options={timeOptions} value={timeMode} onChange={setTimeMode} />
      </FilterSection>

      <FilterSection label="Import mode">
        <SegmentedField options={modeOptions} value={mode} onChange={setMode} />
      </FilterSection>

      <FilterSection label="Rotations">
        <SegmentedField options={rotationOptions} value={rotationMode} onChange={setRotationMode} />
      </FilterSection>

      <FilterSection label="Auto-create">
        <div className="flex flex-col gap-1.5">
          <ToggleRow label="Missing airports" checked={autoCreateAirports} onChange={setAutoCreateAirports} />
          <ToggleRow label="Missing city pairs" checked={autoCreateCityPairs} onChange={setAutoCreateCityPairs} />
        </div>
      </FilterSection>
    </FilterPanel>
  )
}

/* Inline toggle row — intentionally local since it's only used here. */
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between px-3 py-2 rounded-lg transition-colors"
      style={{
        background: checked ? 'color-mix(in srgb, var(--module-accent, #1e40af) 12%, transparent)' : 'transparent',
        border: `1px solid ${checked ? 'color-mix(in srgb, var(--module-accent, #1e40af) 28%, transparent)' : 'rgba(127,127,140,0.18)'}`,
      }}
    >
      <span className="text-[13px] font-medium text-hz-text">{label}</span>
      <span
        className="w-8 h-4 rounded-full relative transition-colors"
        style={{
          background: checked ? 'var(--module-accent, #1e40af)' : 'rgba(127,127,140,0.30)',
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  )
}
