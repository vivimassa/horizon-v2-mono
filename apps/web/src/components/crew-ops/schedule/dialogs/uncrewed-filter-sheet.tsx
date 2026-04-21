'use client'

import { useMemo } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { SelectField } from '@/components/filter-panel'
import { DialogShell, DialogCancelButton } from './dialog-shell'

/**
 * Uncrewed-duty customization sheet (AIMS §4.4).
 *
 * Client-side filter for the bottom uncrewed-duties tray. Applies
 * instantly — there is no draft/commit two-step; edits write straight
 * through to `uncrewedFilter` in the store and are persisted to
 * localStorage under `horizon.crewSchedule.uncrewedFilter`.
 */
export function UncrewedFilterSheet({ onClose }: { onClose: () => void }) {
  const filter = useCrewScheduleStore((s) => s.uncrewedFilter)
  const setUncrewedFilter = useCrewScheduleStore((s) => s.setUncrewedFilter)
  const resetUncrewedFilter = useCrewScheduleStore((s) => s.resetUncrewedFilter)
  const uncrewed = useCrewScheduleStore((s) => s.uncrewed)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const positions = useCrewScheduleStore((s) => s.positions)

  // Unique seat codes across all currently-loaded uncrewed pairings —
  // avoids showing seat filters for positions that aren't actually
  // short-staffed in this period.
  const seatCodes = useMemo(() => {
    const seen = new Set<string>()
    for (const u of uncrewed) for (const m of u.missing) seen.add(m.seatCode)
    // Order by rankOrder so CP < FO < PU < CA in the UI.
    const byCode = new Map(positions.map((p) => [p.code, p.rankOrder]))
    return Array.from(seen).sort((a, b) => (byCode.get(a) ?? 999) - (byCode.get(b) ?? 999))
  }, [uncrewed, positions])

  const baseOptions = useMemo(() => {
    const seen = new Set<string>()
    const pairingById = new Map(pairings.map((p) => [p._id, p]))
    for (const u of uncrewed) {
      const p = pairingById.get(u.pairingId)
      if (p?.baseAirport) seen.add(p.baseAirport)
    }
    return Array.from(seen).sort()
  }, [uncrewed, pairings])

  const acTypeOptions = useMemo(() => {
    const seen = new Set<string>()
    const pairingById = new Map(pairings.map((p) => [p._id, p]))
    for (const u of uncrewed) {
      const p = pairingById.get(u.pairingId)
      if (p?.aircraftTypeIcao) seen.add(p.aircraftTypeIcao)
    }
    return Array.from(seen).sort()
  }, [uncrewed, pairings])

  const toggleSeat = (code: string) => {
    const next = filter.seatCodes.includes(code)
      ? filter.seatCodes.filter((c) => c !== code)
      : [...filter.seatCodes, code]
    setUncrewedFilter({ seatCodes: next })
  }

  return (
    <DialogShell
      title="Uncrewed-duty customization"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button
            onClick={resetUncrewedFilter}
            className="mr-auto h-9 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 hover:bg-white/10"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <DialogCancelButton onClick={onClose} label="Close" />
        </>
      }
    >
      <div className="space-y-5">
        {/* Missing seats */}
        <div>
          <div className="text-[13px] font-medium mb-2">Missing seats</div>
          <div className="text-[13px] text-hz-text-tertiary mb-2">
            Show pairings missing at least one of the selected seats.
          </div>
          {seatCodes.length === 0 ? (
            <div className="text-[13px] text-hz-text-tertiary">No missing seats in the current period.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {seatCodes.map((code) => {
                const active = filter.seatCodes.includes(code)
                return (
                  <button
                    key={code}
                    onClick={() => toggleSeat(code)}
                    className="h-8 px-3 rounded-full text-[13px] font-semibold border transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--module-accent)' : 'transparent',
                      color: active ? '#FFFFFF' : 'inherit',
                      borderColor: active ? 'var(--module-accent)' : 'rgba(142,142,160,0.4)',
                    }}
                  >
                    {code}
                  </button>
                )
              })}
            </div>
          )}
          {filter.seatCodes.length === 0 && (
            <div className="text-[13px] text-hz-text-tertiary mt-2">All seats (no filter).</div>
          )}
        </div>

        {/* Base */}
        <div>
          <div className="text-[13px] font-medium mb-1">Base</div>
          <SelectField
            value={filter.baseAirport ?? ''}
            placeholder="All bases"
            onChange={(v) => setUncrewedFilter({ baseAirport: v || null })}
            options={[{ value: '', label: 'All bases' }, ...baseOptions.map((b) => ({ value: b, label: b }))]}
          />
        </div>

        {/* Aircraft type */}
        <div>
          <div className="text-[13px] font-medium mb-1">Aircraft type</div>
          <SelectField
            value={filter.aircraftTypeIcao ?? ''}
            placeholder="All types"
            onChange={(v) => setUncrewedFilter({ aircraftTypeIcao: v || null })}
            options={[{ value: '', label: 'All types' }, ...acTypeOptions.map((t) => ({ value: t, label: t }))]}
          />
        </div>

        {/* Min missing */}
        <div>
          <div className="text-[13px] font-medium mb-1">Minimum missing seats</div>
          <div className="text-[13px] text-hz-text-tertiary mb-2">
            Sum of missing counts. 1 = show everything with at least one hole.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUncrewedFilter({ minMissingCount: Math.max(1, filter.minMissingCount - 1) })}
              className="w-9 h-9 rounded-lg border border-hz-border/30 hover:bg-white/10 flex items-center justify-center"
              aria-label="Decrease"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 h-10 rounded-lg border border-hz-border/30 flex items-center justify-center text-[15px] font-semibold tabular-nums">
              {filter.minMissingCount}
            </div>
            <button
              onClick={() => setUncrewedFilter({ minMissingCount: Math.min(10, filter.minMissingCount + 1) })}
              className="w-9 h-9 rounded-lg border border-hz-border/30 hover:bg-white/10 flex items-center justify-center"
              aria-label="Increase"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </DialogShell>
  )
}
