"use client"

import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Save, Trash2, X } from 'lucide-react'
import { api, type ScheduledFlightRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { ScheduleGrid } from '../schedule-grid/schedule-grid'
import { MINI_GRID_COLUMNS } from '../schedule-grid/grid-columns'
import { useScheduleGridStore, createSmartRow } from '@/stores/use-schedule-grid-store'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useGanttStore } from '@/stores/use-gantt-store'

interface AddFlightPanelProps {
  onClose: () => void
}

export function AddFlightPanel({ onClose }: AddFlightPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const snapshotRef = useRef<{ rows: ScheduledFlightRef[]; dirtyMap: Map<string, Partial<ScheduledFlightRef>>; newRowIds: Set<string>; deletedIds: Set<string> } | null>(null)

  // Save store snapshot on mount, restore on unmount
  useEffect(() => {
    const s = useScheduleGridStore.getState()
    snapshotRef.current = {
      rows: s.rows,
      dirtyMap: new Map(s.dirtyMap),
      newRowIds: new Set(s.newRowIds),
      deletedIds: new Set(s.deletedIds),
    }

    // Reset store for the panel
    const getTat = (icao: string) => useScheduleRefStore.getState().getTatMinutes?.(icao) ?? null
    const firstRow = createSmartRow([], new Map(), getTat, {
      airlineCode: useOperatorStore.getState().operator?.iataCode ?? '',
    })
    useScheduleGridStore.setState({
      rows: [firstRow],
      dirtyMap: new Map(),
      newRowIds: new Set([firstRow._id]),
      deletedIds: new Set(),
      selectedCell: { rowIdx: 0, colKey: 'aircraftTypeIcao' },
      editingCell: null,
      editValue: '',
      selectionRange: null,
      clipboard: null,
    })

    return () => {
      // Restore previous store state
      if (snapshotRef.current) {
        useScheduleGridStore.setState({
          rows: snapshotRef.current.rows,
          dirtyMap: snapshotRef.current.dirtyMap,
          newRowIds: snapshotRef.current.newRowIds,
          deletedIds: snapshotRef.current.deletedIds,
          selectedCell: null,
          editingCell: null,
          editValue: '',
          selectionRange: null,
          clipboard: null,
        })
      }
    }
  }, [])

  const handleAddFlight = useCallback((insertAtIdx?: number) => {
    const s = useScheduleGridStore.getState()
    const getTat = (icao: string) => useScheduleRefStore.getState().getTatMinutes?.(icao) ?? null
    const newRow = createSmartRow(s.rows, s.dirtyMap, getTat, {
      airlineCode: useOperatorStore.getState().operator?.iataCode ?? '',
    })
    const rows = [...s.rows]
    if (insertAtIdx !== undefined) rows.splice(insertAtIdx, 0, newRow)
    else rows.push(newRow)
    useScheduleGridStore.setState({
      rows,
      newRowIds: new Set([...s.newRowIds, newRow._id]),
    })
  }, [])

  const handleDeleteFlight = useCallback((rowIdx: number) => {
    const s = useScheduleGridStore.getState()
    const row = s.rows[rowIdx]
    if (!row) return
    const deletedIds = new Set(s.deletedIds)
    deletedIds.add(row._id)
    useScheduleGridStore.setState({ deletedIds })
  }, [])

  const handleSave = useCallback(async () => {
    const s = useScheduleGridStore.getState()
    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    const scenarioId = useGanttStore.getState().scenarioId

    // Collect non-deleted rows with merged dirty data
    const rows = s.rows
      .filter(r => !s.deletedIds.has(r._id))
      .map(r => {
        const dirty = s.dirtyMap.get(r._id)
        return { ...r, ...dirty }
      })
      .filter(r => r.depStation && r.arrStation && r.flightNumber && r.stdUtc && r.staUtc)

    if (rows.length === 0) { onClose(); return }

    // Set metadata
    const payload = rows.map(r => ({
      ...r,
      operatorId,
      scenarioId: scenarioId ?? null,
      source: '1.1.2 Gantt' as const,
      status: 'draft' as const,
    }))

    try {
      await api.createScheduledFlightsBulk(payload)
      // Refetch Gantt data
      useGanttStore.getState().commitPeriod()
      onClose()
    } catch (e) {
      console.error('Failed to save flights:', e)
    }
  }, [onClose])

  const handleDiscard = useCallback(() => {
    const s = useScheduleGridStore.getState()
    const hasDirty = s.dirtyMap.size > 0
    if (hasDirty && !window.confirm('Discard unsaved flights?')) return
    onClose()
  }, [onClose])

  const handleTabWrapDown = useCallback(() => {
    handleAddFlight()
    // Focus first editable column of the new row
    requestAnimationFrame(() => {
      const s = useScheduleGridStore.getState()
      const lastIdx = s.rows.filter(r => !s.deletedIds.has(r._id)).length - 1
      useScheduleGridStore.getState().startEditing({ rowIdx: lastIdx, colKey: 'aircraftTypeIcao' })
    })
  }, [handleAddFlight])

  // Visible rows (non-deleted)
  const allRows = useScheduleGridStore(s => s.rows)
  const deletedIds = useScheduleGridStore(s => s.deletedIds)
  const rows = useMemo(() => allRows.filter(r => !deletedIds.has(r._id)), [allRows, deletedIds])

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return createPortal(
    <div data-gantt-overlay className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="rounded-2xl flex flex-col overflow-hidden"
        style={{
          width: '90vw', maxWidth: 1400, height: 340,
          background: isDark ? palette.card : '#fff',
          border: `1px solid ${palette.border}`,
          boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(96,97,112,0.18)',
          animation: 'bc-dropdown-in 150ms ease-out',
        }}
      >
        {/* Header bar */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${palette.border}` }}>
          <span className="text-[15px] font-semibold" style={{ color: palette.text }}>Add Flights</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{ background: '#06C270' }}
            >
              <Save size={14} /> Save
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{ color: palette.textSecondary, border: `1px solid ${palette.border}` }}
            >
              <Trash2 size={14} /> Discard
            </button>
            <button
              onClick={handleDiscard}
              className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={16} style={{ color: palette.textTertiary }} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-0 overflow-hidden" style={{ background: isDark ? palette.backgroundSecondary : '#F8F9FA' }}>
          <ScheduleGrid
            rows={rows}
            columns={MINI_GRID_COLUMNS}
            emptyBufferRows={7}
            onSave={handleSave}
            onAddFlight={handleAddFlight}
            onDeleteFlight={handleDeleteFlight}
            onTabWrapDown={handleTabWrapDown}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
