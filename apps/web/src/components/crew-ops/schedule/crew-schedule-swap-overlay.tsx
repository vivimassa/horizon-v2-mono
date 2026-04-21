'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Loader2, X } from 'lucide-react'
import { api } from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface Props {
  onAfterSwap: () => void
}

/**
 * Two UI pieces for AIMS §4.2 "Swap duties":
 *
 *   1. A thin top banner while the user is in swap-picker mode but
 *      hasn't clicked a target yet. ("Pick another bar to swap with.")
 *   2. A centered confirm dialog once both sides are chosen, showing
 *      the before/after with crew names + pairing codes + seat codes.
 *
 * Both mount into the shell above the canvas. They subscribe to the
 * shared `swapPicker` store slice.
 */
export function CrewScheduleSwapOverlay({ onAfterSwap }: Props) {
  const swapPicker = useCrewScheduleStore((s) => s.swapPicker)
  const clearSwapPicker = useCrewScheduleStore((s) => s.clearSwapPicker)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const crew = useCrewScheduleStore((s) => s.crew)
  const positions = useCrewScheduleStore((s) => s.positions)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pairingsById = useMemo(() => new Map(pairings.map((p) => [p._id, p])), [pairings])
  const crewById = useMemo(() => new Map(crew.map((c) => [c._id, c])), [crew])
  const positionsById = useMemo(() => new Map(positions.map((p) => [p._id, p])), [positions])

  if (!swapPicker) return null

  // Pick-mode banner (target not yet chosen).
  if (!swapPicker.targetAssignmentId) {
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
        <ArrowLeftRight className="w-4 h-4" style={{ color: 'var(--module-accent)' }} />
        <span className="text-[13px] font-medium">
          Swap mode · pick another bar to swap with <strong>{swapPicker.sourcePairingCode}</strong>
        </span>
        <button onClick={clearSwapPicker} className="h-7 px-2 rounded-md text-[11px] font-medium hover:bg-white/10">
          Cancel <span className="text-hz-text-tertiary ml-1">Esc</span>
        </button>
      </div>
    )
  }

  // Confirm dialog (both sides chosen).
  const src = assignments.find((a) => a._id === swapPicker.sourceAssignmentId)
  const tgt = assignments.find((a) => a._id === swapPicker.targetAssignmentId)
  if (!src || !tgt) {
    // Underlying data vanished — bail out.
    clearSwapPicker()
    return null
  }

  const srcPairing = pairingsById.get(src.pairingId)
  const tgtPairing = pairingsById.get(tgt.pairingId)
  const srcCrew = crewById.get(src.crewId)
  const tgtCrew = crewById.get(tgt.crewId)
  const srcSeat = positionsById.get(src.seatPositionId)
  const tgtSeat = positionsById.get(tgt.seatPositionId)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.swapCrewAssignments({
        assignmentAId: swapPicker.sourceAssignmentId,
        assignmentBId: swapPicker.targetAssignmentId!,
      })
      clearSwapPicker()
      onAfterSwap()
    } catch (e) {
      const msg = (e as Error).message
      try {
        const parsed = JSON.parse(msg.replace(/^.*?\{/, '{')) as { error?: string; detail?: string }
        setError(parsed.detail || parsed.error || msg)
      } catch {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={clearSwapPicker}
    >
      <div
        className="w-[440px] rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(25,25,33,0.98)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#FFFFFF',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" style={{ color: 'var(--module-accent)' }} />
            <h3 className="text-[15px] font-bold">Confirm swap</h3>
          </div>
          <button
            onClick={clearSwapPicker}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-3">
          <SwapSide
            label="A"
            pairingCode={srcPairing?.pairingCode ?? '?'}
            crewName={srcCrew ? `${srcCrew.lastName} ${srcCrew.firstName}` : '?'}
            seatCode={srcSeat?.code ?? '?'}
          />
          <div className="flex items-center justify-center text-hz-text-tertiary">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <SwapSide
            label="B"
            pairingCode={tgtPairing?.pairingCode ?? '?'}
            crewName={tgtCrew ? `${tgtCrew.lastName} ${tgtCrew.firstName}` : '?'}
            seatCode={tgtSeat?.code ?? '?'}
          />

          <div className="text-[11px] text-hz-text-tertiary border-t border-white/10 pt-3">
            After swap: <strong className="text-white">{srcCrew?.lastName ?? '?'}</strong> →{' '}
            {tgtPairing?.pairingCode ?? '?'} ({tgtSeat?.code ?? '?'}) ·{' '}
            <strong className="text-white">{tgtCrew?.lastName ?? '?'}</strong> → {srcPairing?.pairingCode ?? '?'} (
            {srcSeat?.code ?? '?'})
          </div>

          {error && (
            <div
              className="p-2 rounded-md text-[12px]"
              style={{ backgroundColor: 'rgba(255,59,59,0.18)', color: '#FF6A6A' }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
          <button
            onClick={clearSwapPicker}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[13px] font-medium hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--module-accent)' }}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Swapping…' : 'Confirm swap'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SwapSide({
  label,
  pairingCode,
  crewName,
  seatCode,
}: {
  label: string
  pairingCode: string
  crewName: string
  seatCode: string
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 flex items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold"
        style={{ background: 'rgba(62,123,250,0.18)', color: '#5B8DEF' }}
      >
        {label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold truncate">{pairingCode}</div>
        <div className="text-[11px] text-hz-text-tertiary tabular-nums truncate">
          {crewName} · seat {seatCode}
        </div>
      </div>
    </div>
  )
}
