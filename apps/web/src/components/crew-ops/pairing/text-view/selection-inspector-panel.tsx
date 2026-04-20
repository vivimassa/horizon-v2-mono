'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'
import { api, type PairingCreateInput } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore, resolveComplementCounts } from '@/stores/use-pairing-store'
import { useFlightGridSelection } from '@/stores/use-flight-grid-selection'
import { PairingStatusBadge } from '../shared/pairing-status-badge'
import type { LegalityResult, PairingFlight, PairingWorkflowStatus } from '../types'
import { usePairingLegality } from '../use-pairing-legality'
import { pairingFromApi } from '../adapters'
import { IllegalPairingDialog } from '../dialogs/illegal-pairing-dialog'
import { MAX_PAIRING_DAYS, OversizedPairingDialog } from '../dialogs/oversized-pairing-dialog'
import {
  ACCENT,
  SectionHeader,
  ComplementSelector,
  SelectedLegRow,
  LegalityChecks,
  GroundTimeRow,
  LayoverRow,
} from './inspector-helpers'

const LAYOVER_THRESHOLD_MIN = 24 * 60 // ≥24h gap between legs = overnight layover

/**
 * Inspector variant that renders whenever the user has flights selected on the
 * Flight Pool grid. Shows a red banner on violation (loud, V1-style), a live
 * leg list + FDTL checks, and the Draft / Final CTAs. This panel OWNS the
 * save flow + the illegal/oversized confirmation dialogs — the grid dispatches
 * intent via `requestCreatePairing` and we run it here.
 */
export function SelectionInspectorPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const activeComplementKey = usePairingStore((s) => s.activeComplementKey)
  const setComplement = usePairingStore((s) => s.setComplement)
  const flights = usePairingStore((s) => s.flights)
  const complements = usePairingStore((s) => s.complements)
  const addPairing = usePairingStore((s) => s.addPairing)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)
  const setError = usePairingStore((s) => s.setError)
  const pendingCreateRequest = usePairingStore((s) => s.pendingCreateRequest)
  const clearCreateRequest = usePairingStore((s) => s.clearCreateRequest)
  const selectedRowIds = useFlightGridSelection((s) => s.selectedRowIds)
  const clearAll = useFlightGridSelection((s) => s.clearAll)

  const selectedFlights = useMemo<PairingFlight[]>(() => {
    return flights
      .filter((f) => selectedRowIds.has(f.id))
      .sort((a, b) => {
        const d = a.instanceDate.localeCompare(b.instanceDate)
        return d !== 0 ? d : a.stdUtc.localeCompare(b.stdUtc)
      })
  }, [flights, selectedRowIds])

  const { result, usingMock } = usePairingLegality(selectedFlights, {
    complementKey: activeComplementKey,
    facilityClass: activeComplementKey === 'standard' ? undefined : 'CLASS_1',
    homeBase: selectedFlights[0]?.departureAirport,
  })

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

  const violations = result.checks.filter((c) => c.status === 'violation')

  // ── Save flow (moved here from FlightPoolPanel) ──────────────────────
  const [pending, setPending] = useState<{
    flightIds: string[]
    workflow: PairingWorkflowStatus
    workflowLabel: 'Draft' | 'Final'
    result: LegalityResult
  } | null>(null)
  const [oversized, setOversized] = useState<{
    flightIds: string[]
    workflow: PairingWorkflowStatus
    workflowLabel: 'Draft' | 'Final'
    spanDays: number
    flightCount: number
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const savePairing = useCallback(
    async (flightIds: string[], workflow: PairingWorkflowStatus, legality: LegalityResult) => {
      if (saving) return
      setSaving(true)
      setError(null)
      try {
        const selected = flightIds.map((id) => flights.find((f) => f.id === id)).filter(Boolean) as PairingFlight[]
        if (selected.length === 0) return
        const legs: PairingCreateInput['legs'] = selected.map((f, i) => ({
          flightId: f.id,
          flightDate: f.instanceDate,
          legOrder: i,
          isDeadhead: false,
          dutyDay: 1,
          depStation: f.departureAirport,
          arrStation: f.arrivalAirport,
          flightNumber: f.flightNumber,
          stdUtcIso: f.stdUtc,
          staUtcIso: f.staUtc,
          blockMinutes: f.blockMinutes,
          aircraftTypeIcao: f.aircraftType || null,
          tailNumber: f.tailNumber ?? null,
        }))
        const aircraftTypeIcao = selected[0].aircraftType || null
        const crewCounts = resolveComplementCounts(complements, aircraftTypeIcao, activeComplementKey)
        const created = await api.createPairing({
          pairingCode: generatePairingCode(selected),
          baseAirport: selected[0].departureAirport,
          aircraftTypeIcao,
          complementKey: activeComplementKey,
          cockpitCount: activeComplementKey === 'aug2' ? 4 : activeComplementKey === 'aug1' ? 3 : 2,
          crewCounts,
          legs,
          fdtlStatus:
            legality.overallStatus === 'pass'
              ? 'legal'
              : legality.overallStatus === 'warning'
                ? 'warning'
                : 'violation',
          workflowStatus: workflow,
          lastLegalityResult: legality,
        })
        const local = pairingFromApi(created)
        addPairing(local)
        clearAll()
        inspectPairing(local.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create pairing')
      } finally {
        setSaving(false)
      }
    },
    [activeComplementKey, addPairing, clearAll, complements, flights, inspectPairing, saving, setError],
  )

  const proceedToLegalityCheck = useCallback(
    (flightIds: string[], workflow: PairingWorkflowStatus, label: 'Draft' | 'Final') => {
      if (result.overallStatus === 'violation') {
        setPending({ flightIds, workflow, workflowLabel: label, result })
        return
      }
      void savePairing(flightIds, workflow, result)
    },
    [result, savePairing],
  )

  const handleCreate = useCallback(
    (flightIds: string[], workflow: PairingWorkflowStatus, label: 'Draft' | 'Final') => {
      if (flightIds.length === 0 || saving) return
      const uniqueDates = new Set(
        flightIds.map((id) => flights.find((f) => f.id === id)?.instanceDate).filter(Boolean) as string[],
      )
      if (uniqueDates.size > MAX_PAIRING_DAYS) {
        setOversized({
          flightIds,
          workflow,
          workflowLabel: label,
          spanDays: uniqueDates.size,
          flightCount: flightIds.length,
        })
        return
      }
      proceedToLegalityCheck(flightIds, workflow, label)
    },
    [flights, proceedToLegalityCheck, saving],
  )

  // Route grid-originated requests (keyboard Enter / right-click menu) through
  // the same handleCreate so guards + dialogs stay in one place.
  useEffect(() => {
    if (!pendingCreateRequest) return
    const { ids, workflow, label } = pendingCreateRequest
    clearCreateRequest()
    handleCreate(ids, workflow, label)
  }, [pendingCreateRequest, clearCreateRequest, handleCreate])

  const selectedIds = useMemo(() => selectedFlights.map((f) => f.id), [selectedFlights])
  const canCreate = !saving && !pending && !oversized && selectedFlights.length > 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Red banner (only on violation) — loud V1-style warning */}
      {result.overallStatus === 'violation' && (
        <div
          className="shrink-0 flex items-start gap-2.5 px-4 py-3"
          style={{
            background: 'rgba(255,59,59,0.12)',
            borderLeft: '4px solid #FF3B3B',
            borderBottom: `1px solid ${divider}`,
          }}
        >
          <AlertTriangle size={16} strokeWidth={2.4} style={{ color: '#FF3B3B', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={{ color: '#FF3B3B' }}>
              Illegal pairing — {violations.length} violation{violations.length === 1 ? '' : 's'}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
              Use Create Final to override (manager-level) or adjust the selection.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="shrink-0 px-4 pt-3 pb-2.5 flex items-start gap-2"
        style={{ borderBottom: `1px solid ${divider}` }}
      >
        <div className="w-0.5 h-4 rounded-full mt-1" style={{ background: ACCENT }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold tracking-tight" style={{ color: textPrimary }}>
              Selection · {selectedFlights.length} flight{selectedFlights.length === 1 ? '' : 's'}
            </h3>
            <PairingStatusBadge
              status={
                result.overallStatus === 'pass' ? 'legal' : result.overallStatus === 'warning' ? 'warning' : 'violation'
              }
              size="sm"
            />
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: textTertiary }}>
            Live FDTL check. Use the Draft or Final button below to create.
            {usingMock && <span className="ml-1 italic">(preview — FDTL not yet configured)</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="text-[11px] font-semibold tracking-wide uppercase px-2 h-6 rounded"
          style={{
            color: textSecondary,
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
            border: `1px solid ${divider}`,
          }}
          title="Clear selection (Esc)"
        >
          Clear
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-4">
        <SectionHeader title="Complement" isDark={isDark} />
        <ComplementSelector value={activeComplementKey} onChange={setComplement} isDark={isDark} />

        <SectionHeader title={`Selected flights (${selectedFlights.length})`} isDark={isDark} />
        <div className="space-y-1">
          {selectedFlights.map((f, i) => {
            const next = selectedFlights[i + 1]
            const gap = next ? gapMinutes(f, next) : 0
            return (
              <Fragment key={f.id}>
                <SelectedLegRow index={i} flight={f} isDark={isDark} />
                {next &&
                  (gap >= LAYOVER_THRESHOLD_MIN ? (
                    <LayoverRow minutes={gap} station={f.arrivalAirport} isDark={isDark} />
                  ) : (
                    <GroundTimeRow minutes={gap} station={f.arrivalAirport} isDark={isDark} />
                  ))}
              </Fragment>
            )
          })}
        </div>

        <SectionHeader title="Legality" isDark={isDark} />
        <LegalityChecks result={result} isDark={isDark} />
      </div>

      {/* Footer CTAs — faint-orange Draft + faint-green Final */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-2" style={{ borderTop: `1px solid ${divider}` }}>
        <CtaButton
          label={saving ? 'Saving…' : 'Create as Draft'}
          icon={<FileText size={14} strokeWidth={2.2} />}
          tone="draft"
          disabled={!canCreate}
          onClick={() => handleCreate(selectedIds, 'draft', 'Draft')}
          isDark={isDark}
        />
        <CtaButton
          label={saving ? 'Saving…' : 'Create as Final'}
          icon={<CheckCircle2 size={14} strokeWidth={2.2} />}
          tone="final"
          disabled={!canCreate}
          onClick={() => handleCreate(selectedIds, 'committed', 'Final')}
          isDark={isDark}
        />
      </div>

      {oversized && (
        <OversizedPairingDialog
          spanDays={oversized.spanDays}
          flightCount={oversized.flightCount}
          maxDays={MAX_PAIRING_DAYS}
          workflowLabel={oversized.workflowLabel}
          onProceed={() => {
            const snap = oversized
            setOversized(null)
            proceedToLegalityCheck(snap.flightIds, snap.workflow, snap.workflowLabel)
          }}
          onCancel={() => setOversized(null)}
        />
      )}

      {pending && (
        <IllegalPairingDialog
          result={pending.result}
          workflowLabel={pending.workflowLabel}
          onProceed={async () => {
            const snap = pending
            setPending(null)
            await savePairing(snap.flightIds, snap.workflow, snap.result)
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

function CtaButton({
  label,
  icon,
  tone,
  disabled,
  onClick,
  isDark,
}: {
  label: string
  icon: React.ReactNode
  tone: 'draft' | 'final'
  disabled?: boolean
  onClick: () => void
  isDark: boolean
}) {
  // Faint-orange for Draft (WIP) · Faint-green for Final (committed). Uses
  // XD semantic colours at ~15% fill + 35% border so the CTA reads as an
  // action without competing with the red violation banner when present.
  const colour = tone === 'draft' ? '#FF8800' : '#06C270'
  const bg = isDark ? `${colour}26` : `${colour}1F` // 15%/12% alpha
  const border = `${colour}59` // ~35% alpha
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 h-10 rounded-lg inline-flex items-center justify-center gap-2 text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed"
      style={{
        background: bg,
        color: colour,
        border: `1px solid ${border}`,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function gapMinutes(prev: PairingFlight, next: PairingFlight): number {
  const prevArr = Date.parse(prev.staUtc)
  const nextDep = Date.parse(next.stdUtc)
  if (!Number.isFinite(prevArr) || !Number.isFinite(nextDep)) return 0
  return Math.max(0, Math.round((nextDep - prevArr) / 60000))
}

function generatePairingCode(selected: PairingFlight[]): string {
  if (selected.length === 0) return 'P-0000'
  const first = selected[0]
  const stationLetter = (first.departureAirport || 'X').charAt(0).toUpperCase()
  const numericMatch = first.flightNumber.match(/\d+/)
  const num = numericMatch ? numericMatch[0] : first.flightNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 4)
  return `${stationLetter}${num}`
}
