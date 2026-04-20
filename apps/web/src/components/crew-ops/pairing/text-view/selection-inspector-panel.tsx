'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { useFlightGridSelection } from '@/stores/use-flight-grid-selection'
import { PairingStatusBadge } from '../shared/pairing-status-badge'
import type { PairingFlight } from '../types'
import { usePairingLegality } from '../use-pairing-legality'
import { ACCENT, SectionHeader, ComplementSelector, SelectedLegRow, LegalityChecks } from './inspector-helpers'

/**
 * Inspector variant that renders whenever the user has flights selected on the
 * Flight Pool grid. Shows a red banner on violation (loud, V1-style) and a
 * live leg list + FDTL checks. No "Create" button here — creation happens
 * through the grid's right-click context menu.
 */
export function SelectionInspectorPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const activeComplementKey = usePairingStore((s) => s.activeComplementKey)
  const setComplement = usePairingStore((s) => s.setComplement)
  const flights = usePairingStore((s) => s.flights)
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
              Right-click the grid to create anyway (manager override) or adjust the selection.
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
            Live FDTL check. Right-click the grid to create as Draft or Final.
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
          {selectedFlights.map((f, i) => (
            <SelectedLegRow key={f.id} index={i} flight={f} isDark={isDark} />
          ))}
        </div>

        <SectionHeader title="Legality" isDark={isDark} />
        <LegalityChecks result={result} isDark={isDark} />
      </div>
    </div>
  )
}
