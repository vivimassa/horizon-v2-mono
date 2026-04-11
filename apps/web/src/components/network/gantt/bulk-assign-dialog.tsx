'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, X, Loader2, ChevronDown, Check } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { bulkAssignFlights, unassignFlights } from '@/lib/gantt/api'

interface BulkAssignDialogProps {
  open: boolean
  onClose: () => void
}

export function BulkAssignDialog({ open, onClose }: BulkAssignDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  const flights = useGanttStore((s) => s.flights)
  const aircraft = useGanttStore((s) => s.aircraft)
  const periodFrom = useGanttStore((s) => s.periodFrom)
  const periodTo = useGanttStore((s) => s.periodTo)

  // Form state
  const [fromDate, setFromDate] = useState('')
  const [fromTime, setFromTime] = useState('00:00')
  const [toDate, setToDate] = useState('')
  const [toTime, setToTime] = useState('23:59')
  const [mode, setMode] = useState<'assign' | 'deassign'>('assign')
  const [selectedRegs, setSelectedRegs] = useState<Set<string>>(new Set())
  const [regDropdownOpen, setRegDropdownOpen] = useState(false)
  const [regSearch, setRegSearch] = useState('')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // Dropdown position (portaled to body to avoid clipping)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sorted aircraft list
  const sortedAircraft = useMemo(
    () => [...aircraft].sort((a, b) => a.registration.localeCompare(b.registration)),
    [aircraft],
  )

  const allRegs = useMemo(() => new Set(sortedAircraft.map((ac) => ac.registration)), [sortedAircraft])

  // Init dates from period — default all aircraft selected
  useEffect(() => {
    if (open) {
      setFromDate(periodFrom)
      setToDate(periodTo)
      setFromTime('00:00')
      setToTime('23:59')
      setMode('assign')
      setSelectedRegs(new Set(allRegs))
      setRegSearch('')
      setResult(null)
    }
  }, [open, periodFrom, periodTo, allRegs])

  // Position the dropdown when opening
  useEffect(() => {
    if (regDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [regDropdownOpen])

  // Close dropdown on outside click
  useEffect(() => {
    if (!regDropdownOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(t) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(t)
      )
        setRegDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [regDropdownOpen])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (regDropdownOpen) {
          setRegDropdownOpen(false)
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, regDropdownOpen])

  // Filtered by search
  const filteredAircraft = useMemo(() => {
    if (!regSearch) return sortedAircraft
    const q = regSearch.toUpperCase()
    return sortedAircraft.filter(
      (ac) => ac.registration.toUpperCase().includes(q) || (ac.aircraftTypeIcao ?? '').toUpperCase().includes(q),
    )
  }, [sortedAircraft, regSearch])

  const isAllSelected = selectedRegs.size === allRegs.size
  const isNoneSelected = selectedRegs.size === 0

  const toggleReg = useCallback((reg: string) => {
    setSelectedRegs((prev) => {
      const next = new Set(prev)
      if (next.has(reg)) next.delete(reg)
      else next.add(reg)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedRegs(isAllSelected ? new Set() : new Set(allRegs))
  }, [isAllSelected, allRegs])

  // Matching flights preview
  const matchingFlights = useMemo(() => {
    if (!fromDate || !toDate || selectedRegs.size === 0) return []
    const fromMs = new Date(`${fromDate}T${fromTime}:00Z`).getTime()
    const toMs = new Date(`${toDate}T${toTime}:59Z`).getTime()
    if (isNaN(fromMs) || isNaN(toMs)) return []

    return flights.filter((f) => {
      if (f.staUtc < fromMs || f.stdUtc > toMs) return false
      if (mode === 'assign') {
        // Unassigned flights that could go on any selected reg
        if (f.aircraftReg) return false
        // Check AC type matches any selected reg's type
        const selectedTypes = new Set(
          sortedAircraft.filter((ac) => selectedRegs.has(ac.registration)).map((ac) => ac.aircraftTypeIcao),
        )
        return selectedTypes.has(f.aircraftTypeIcao)
      } else {
        // Flights currently on any of the selected regs
        return f.aircraftReg ? selectedRegs.has(f.aircraftReg) : false
      }
    })
  }, [flights, fromDate, fromTime, toDate, toTime, mode, selectedRegs, sortedAircraft])

  async function handleExecute() {
    if (selectedRegs.size === 0 || matchingFlights.length === 0) return
    setExecuting(true)
    setResult(null)

    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    const flightIds = matchingFlights.map((f) => f.id)

    try {
      if (mode === 'assign') {
        // Use virtual placements to determine which reg each flight should go to
        const layout = useGanttStore.getState().layout
        const placements = layout?.virtualPlacements
        const byReg = new Map<string, string[]>()
        for (const f of matchingFlights) {
          const targetReg = placements?.get(f.id)
          if (targetReg && selectedRegs.has(targetReg)) {
            const list = byReg.get(targetReg) ?? []
            list.push(f.id)
            byReg.set(targetReg, list)
          }
        }
        // Wait for API to complete before closing
        const assignments = [...byReg.entries()].map(([registration, flightIds]) => ({ registration, flightIds }))
        const totalAssigned = assignments.reduce((sum, a) => sum + a.flightIds.length, 0)
        setResult(`Writing ${totalAssigned} assignments...`)
        const res = await bulkAssignFlights(operatorId, assignments)
        if (res.verified !== undefined && res.verified < totalAssigned) {
          setResult(
            `Warning: ${res.verified}/${totalAssigned} verified. ${totalAssigned - res.verified} may have failed.`,
          )
        }
        // Now apply optimistic update + close
        const regMap = new Map<string, string>()
        for (const [reg, ids] of byReg) {
          for (const id of ids) regMap.set(id, reg)
        }
        const updated = useGanttStore
          .getState()
          .flights.map((f) => (regMap.has(f.id) ? { ...f, aircraftReg: regMap.get(f.id)! } : f))
        useGanttStore.setState({ flights: updated })
        useGanttStore.getState()._recomputeLayout()
        setResult(`Assigned ${totalAssigned} flights across ${assignments.length} aircraft`)
        setTimeout(onClose, 600)
      } else {
        setResult(`Deassigning ${flightIds.length} flights...`)
        await unassignFlights(operatorId, flightIds)
        // Now apply update + close
        const updated = useGanttStore
          .getState()
          .flights.map((f) => (flightIds.includes(f.id) ? { ...f, aircraftReg: null } : f))
        useGanttStore.setState({ flights: updated })
        useGanttStore.getState()._recomputeLayout()
        setResult(`Deassigned ${flightIds.length} flights`)
        setTimeout(onClose, 600)
      }
    } catch (e) {
      console.error('Bulk operation failed:', e)
      setResult('Failed — please try again')
      await useGanttStore.getState()._fetchFlights()
    } finally {
      setExecuting(false)
    }
  }

  if (!mounted || !open) return null

  const accent = 'var(--module-accent)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const canExecute = selectedRegs.size > 0 && matchingFlights.length > 0 && !executing

  // Trigger label
  const triggerLabel = isAllSelected
    ? `All Aircraft (${allRegs.size})`
    : isNoneSelected
      ? 'Select aircraft...'
      : `${selectedRegs.size} aircraft selected`

  // Focus ring classes shared by all inputs
  const inputCls =
    'h-10 rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-module-accent focus:border-transparent transition-colors'

  return createPortal(
    <div
      data-gantt-overlay
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        ref={ref}
        className="rounded-xl overflow-visible"
        style={{
          width: 700,
          maxHeight: '80vh',
          background: palette.card,
          border: `1px solid ${palette.border}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(96,97,112,0.14)',
          animation: 'bc-dropdown-in 150ms ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${palette.border}` }}>
          <Link size={18} className="text-module-accent" />
          <span className="text-[15px] font-semibold flex-1" style={{ color: palette.text }}>
            Bulk Assign Aircraft
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X size={16} style={{ color: palette.textTertiary }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Date/Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium mb-1.5 block" style={{ color: palette.textSecondary }}>
                From
              </label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`flex-1 px-2.5 ${inputCls}`}
                  style={{ background: inputBg, border: `1px solid ${palette.border}`, color: palette.text }}
                />
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className={`w-[90px] px-2 ${inputCls}`}
                  style={{ background: inputBg, border: `1px solid ${palette.border}`, color: palette.text }}
                />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium mb-1.5 block" style={{ color: palette.textSecondary }}>
                To
              </label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={`flex-1 px-2.5 ${inputCls}`}
                  style={{ background: inputBg, border: `1px solid ${palette.border}`, color: palette.text }}
                />
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className={`w-[90px] px-2 ${inputCls}`}
                  style={{ background: inputBg, border: `1px solid ${palette.border}`, color: palette.text }}
                />
              </div>
            </div>
          </div>

          {/* Mode: Assign / Deassign */}
          <div>
            <label className="text-[12px] font-medium mb-1.5 block" style={{ color: palette.textSecondary }}>
              Action
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('assign')}
                className="flex-1 h-8 rounded-lg text-[13px] font-medium transition-all"
                style={{
                  background: mode === 'assign' ? accent : inputBg,
                  color: mode === 'assign' ? '#fff' : palette.text,
                  border: `1px solid ${mode === 'assign' ? 'transparent' : palette.border}`,
                }}
              >
                Assign
              </button>
              <button
                onClick={() => setMode('deassign')}
                className="flex-1 h-8 rounded-lg text-[13px] font-medium transition-all"
                style={{
                  background: mode === 'deassign' ? '#E63535' : inputBg,
                  color: mode === 'deassign' ? '#fff' : palette.text,
                  border: `1px solid ${mode === 'deassign' ? 'transparent' : palette.border}`,
                }}
              >
                Deassign
              </button>
            </div>
          </div>

          {/* Aircraft Registration — multi-select */}
          <div>
            <label className="text-[12px] font-medium mb-1.5 block" style={{ color: palette.textSecondary }}>
              Aircraft Registration
            </label>
            <button
              ref={triggerRef}
              onClick={() => setRegDropdownOpen((o) => !o)}
              className="w-full h-10 px-3 rounded-lg text-[14px] font-medium flex items-center justify-between transition-colors outline-none"
              style={{
                background: inputBg,
                border: `1px solid ${regDropdownOpen ? accent : palette.border}`,
                color: isNoneSelected ? palette.textTertiary : palette.text,
                boxShadow: regDropdownOpen ? `0 0 0 2px color-mix(in srgb, ${accent} 30%, transparent)` : undefined,
              }}
            >
              <span>{triggerLabel}</span>
              <ChevronDown
                size={14}
                style={{
                  color: palette.textTertiary,
                  transform: regDropdownOpen ? 'rotate(180deg)' : undefined,
                  transition: 'transform 150ms',
                }}
              />
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-xl p-4" style={{ background: inputBg, border: `1px solid ${palette.border}` }}>
            <div className="text-[12px] font-medium" style={{ color: palette.textSecondary }}>
              {isNoneSelected
                ? 'Select at least one aircraft'
                : matchingFlights.length === 0
                  ? `No flights to ${mode} in this period`
                  : `${matchingFlights.length} flight${matchingFlights.length !== 1 ? 's' : ''} will be ${mode === 'assign' ? 'assigned to' : 'deassigned from'} ${isAllSelected ? 'all aircraft' : `${selectedRegs.size} aircraft`}`}
            </div>
          </div>

          {/* Result feedback */}
          {result && (
            <div
              className="text-[12px] font-medium text-center py-1"
              style={{
                color: result.startsWith('Failed') ? '#E63535' : '#06C270',
              }}
            >
              {result}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2.5 px-5 py-3"
          style={{ borderTop: `1px solid ${palette.border}` }}
        >
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-lg text-[13px] font-medium transition-colors"
            style={{ color: palette.text, border: `1px solid ${palette.border}` }}
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={!canExecute}
            className="h-10 px-5 rounded-lg text-[13px] font-medium text-white transition-colors flex items-center gap-2"
            style={{
              background: mode === 'deassign' ? '#E63535' : '#06C270',
              opacity: canExecute ? 1 : 0.4,
            }}
          >
            {executing && <Loader2 size={14} className="animate-spin" />}
            {mode === 'assign' ? 'Assign' : 'Deassign'}{' '}
            {matchingFlights.length > 0 ? `(${matchingFlights.length})` : ''}
          </button>
        </div>
      </div>

      {/* Registration dropdown — portaled outside dialog to avoid clipping */}
      {regDropdownOpen && (
        <div
          ref={dropdownRef}
          className="fixed z-[10001] rounded-xl overflow-hidden"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            background: palette.card,
            border: `1px solid ${palette.border}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.10)',
            maxHeight: 300,
          }}
        >
          {/* Search */}
          <div className="p-2" style={{ borderBottom: `1px solid ${palette.border}` }}>
            <input
              type="text"
              value={regSearch}
              onChange={(e) => setRegSearch(e.target.value)}
              placeholder="Search registration..."
              autoFocus
              className={`w-full px-2.5 ${inputCls}`}
              style={{ background: inputBg, border: `1px solid ${palette.border}`, color: palette.text }}
            />
          </div>

          {/* Select All / Deselect All */}
          {!regSearch && (
            <button
              onClick={toggleAll}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[14px] font-medium transition-colors"
              style={{ color: palette.text, borderBottom: `1px solid ${palette.border}` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = palette.backgroundHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span
                className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                style={{
                  background: isAllSelected ? accent : 'transparent',
                  border: isAllSelected ? 'none' : `1.5px solid ${palette.textTertiary}`,
                }}
              >
                {isAllSelected && <Check size={12} color="#fff" strokeWidth={2.5} />}
              </span>
              <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
              <span className="text-[12px] ml-auto" style={{ color: palette.textTertiary }}>
                {allRegs.size}
              </span>
            </button>
          )}

          {/* Aircraft list */}
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filteredAircraft.map((ac) => {
              const checked = selectedRegs.has(ac.registration)
              return (
                <button
                  key={ac.registration}
                  onClick={() => toggleReg(ac.registration)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] transition-colors"
                  style={{
                    color: palette.text,
                    background: checked ? (isDark ? 'rgba(62,123,250,0.08)' : 'rgba(30,64,175,0.04)') : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = palette.backgroundHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = checked
                      ? isDark
                        ? 'rgba(62,123,250,0.08)'
                        : 'rgba(30,64,175,0.04)'
                      : 'transparent'
                  }}
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: checked ? accent : 'transparent',
                      border: checked ? 'none' : `1.5px solid ${palette.textTertiary}`,
                    }}
                  >
                    {checked && <Check size={12} color="#fff" strokeWidth={2.5} />}
                  </span>
                  <span className="font-mono font-bold">{ac.registration}</span>
                  <span className="text-[12px]" style={{ color: palette.textTertiary }}>
                    {ac.aircraftTypeIcao}
                  </span>
                </button>
              )
            })}
            {filteredAircraft.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-center" style={{ color: palette.textTertiary }}>
                No aircraft found
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
