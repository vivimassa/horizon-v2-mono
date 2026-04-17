'use client'

import { ArrowLeftRight, GitCompareArrows, RotateCcw } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { ScenarioRef } from '@skyhub/api'

interface ScenarioCompareHeaderProps {
  scenarios: ScenarioRef[]
  onSwap: () => void
  onReset: () => void
}

const LETTERS = ['A', 'B', 'C'] as const

const STATUS_STYLE: Record<ScenarioRef['status'], { bg: string; fg: string; label: string }> = {
  draft: { bg: 'rgba(125,125,140,0.18)', fg: '#8E8E93', label: 'Draft' },
  review: { bg: 'rgba(255,136,0,0.18)', fg: '#FF8800', label: 'Review' },
  published: { bg: 'rgba(6,194,112,0.18)', fg: '#06C270', label: 'Published' },
  archived: { bg: 'rgba(125,125,140,0.22)', fg: '#606170', label: 'Archived' },
}

export function ScenarioCompareHeader({ scenarios, onSwap, onReset }: ScenarioCompareHeaderProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const chipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="flex items-center gap-3 px-4 h-14 min-w-0">
      <div className="w-[3px] h-5 rounded-full bg-module-accent shrink-0" />
      <GitCompareArrows size={16} className="text-module-accent shrink-0" />
      <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary shrink-0">
        Comparing
      </span>

      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {scenarios.map((s, idx) => (
          <div key={s._id} className="flex items-center gap-1.5 min-w-0">
            {idx > 0 && <ArrowLeftRight size={14} className="text-hz-text-tertiary shrink-0" />}
            <div
              className="inline-flex items-center gap-2 px-2.5 h-8 rounded-xl min-w-0"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${chipBorder}`,
              }}
            >
              <span
                className="px-1.5 rounded text-[13px] font-bold text-white bg-module-accent tracking-wider"
                aria-label={`Scenario ${LETTERS[idx] ?? '?'}`}
              >
                {LETTERS[idx] ?? '?'}
              </span>
              <span className="text-[13px] font-bold text-hz-text truncate max-w-[180px]" title={s.name}>
                {s.name}
              </span>
              <StatusPill status={s.status} />
            </div>
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1 shrink-0">
        {scenarios.length >= 2 && (
          <button
            type="button"
            onClick={onSwap}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[13px] font-medium text-hz-text hover:bg-hz-border/30 transition-colors"
            aria-label="Swap scenario order"
          >
            <ArrowLeftRight size={14} />
            Swap
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[13px] font-medium text-hz-text-secondary hover:text-hz-text hover:bg-hz-border/30 transition-colors"
          aria-label="Reset compare"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: ScenarioRef['status'] }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft
  return (
    <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}
