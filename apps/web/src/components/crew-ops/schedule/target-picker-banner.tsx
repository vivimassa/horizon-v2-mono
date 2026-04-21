'use client'

import { ArrowLeftRight, CopyPlus, Move, Repeat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

/**
 * Top-of-canvas banner shown while the user is in a target-crew-row
 * picker mode. Explains the mode + source context. Pressing Esc or the
 * Cancel button clears the mode (Esc is handled in the canvas).
 *
 * Modes:
 *   - copy-pairing: Duplicate one pairing to another crew
 *   - copy-block:   Copy a range of pairings to another crew
 *   - move-block:   Reassign a range to another crew
 *   - swap-block:   Atomic swap of a range between two crews
 */
export function TargetPickerBanner() {
  const mode = useCrewScheduleStore((s) => s.targetPickerMode)
  const clear = useCrewScheduleStore((s) => s.clearTargetPickerMode)
  if (!mode) return null

  const { icon: Icon, label } = describeMode(mode)

  return (
    <div
      className="fixed z-[9998] top-4 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg"
      style={{
        background: 'rgba(25,25,33,0.92)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(24px)',
        color: '#FFFFFF',
      }}
    >
      <Icon className="w-4 h-4" style={{ color: 'var(--module-accent)' }} />
      <span className="text-[13px] font-medium">{label}</span>
      <button onClick={clear} className="h-7 px-2 rounded-md text-[13px] font-medium hover:bg-white/10">
        Cancel <span className="text-hz-text-tertiary ml-1">Esc</span>
      </button>
    </div>
  )
}

function describeMode(mode: NonNullable<ReturnType<typeof useCrewScheduleStore.getState>['targetPickerMode']>): {
  icon: LucideIcon
  label: string
} {
  switch (mode.kind) {
    case 'copy-pairing':
      return {
        icon: CopyPlus,
        label: `Copy mode · pick a crew row to copy pairing ${mode.sourcePairingCode} to`,
      }
    case 'copy-block':
      return {
        icon: CopyPlus,
        label: `Copy-block mode · pick a target crew to copy ${mode.fromIso} → ${mode.toIso} to`,
      }
    case 'move-block':
      return {
        icon: Move,
        label: `Move-block mode · pick a target crew to reassign ${mode.fromIso} → ${mode.toIso} to`,
      }
    case 'swap-block':
      return {
        icon: Repeat,
        label: `Swap-block mode · pick another crew to swap ${mode.fromIso} → ${mode.toIso} with`,
      }
    default: {
      // Exhaustiveness helper — `never` check at compile time.
      const _never: never = mode
      void _never
      return { icon: ArrowLeftRight, label: '' }
    }
  }
}
