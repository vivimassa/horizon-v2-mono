// 4.1.6.1 Automatic Crew Assignment (stub).
// Placeholder page for the upcoming automatic crew-assignment solver.
// Real implementation will consume the data-driven FDTL evaluator registry
// (packages/logic/src/fdtl/evaluators.ts) to score candidates.
'use client'

import { Sparkles } from 'lucide-react'

export default function Page() {
  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div
        className="max-w-md w-full rounded-2xl border border-hz-border/40 bg-hz-bg-secondary/60 p-8 text-center"
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
      >
        <div
          className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'var(--module-accent-tint, rgba(124,58,237,0.15))' }}
        >
          <Sparkles size={22} color="var(--module-accent, #7c3aed)" />
        </div>
        <h1 className="text-[18px] font-bold mb-2 text-hz-text">Automatic Crew Assignment</h1>
        <p className="text-[13px] text-hz-text-tertiary leading-relaxed">
          Coming soon. Automatic crew assignment under FDTL constraints, powered by the data-driven rule engine.
        </p>
      </div>
    </div>
  )
}
