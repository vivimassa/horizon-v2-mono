'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Trash2, Check, AlertTriangle, Loader2 } from 'lucide-react'
import {
  api,
  type AirportRef,
  type CrewPositionRef,
  type CrewQualificationInput,
  type CrewQualificationRef,
} from '@skyhub/api'
import { useAirports, useCrewPositions } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { crewAccent } from '../common/draft-helpers'
import { useGridKeyboard } from './use-grid-keyboard'

type RowStatus = 'idle' | 'saving' | 'saved' | 'error'

interface LocalRow {
  id: string // local UUID for unsaved rows, server _id once created
  serverId: string | null
  base: string | null
  aircraftType: string
  position: string
  acFamilyQualified: boolean
  startDate: string
  endDate: string | null
  isPrimary: boolean
  status: RowStatus
  error?: string
  dirty: boolean
}

interface Props {
  crewId: string | null
  rows: CrewQualificationRef[]
  onChanged: () => Promise<unknown>
  /** Called whenever the count of "ready" rows (aircraftType + position both
   *  filled) changes. Used by the shell to gate the Save button on drafts. */
  onReadyCountChange?: (count: number) => void
}

export interface AircraftQualificationsGridHandle {
  /** Number of rows with aircraftType + position both filled. */
  getReadyCount(): number
  /** Persist all ready in-memory rows to the given crewId. Used by the shell
   *  during draft-crew save, after the crew member has been created. */
  flushToCrew(crewId: string): Promise<void>
}

const MIN_EMPTY_TRAILING = 1
const COLUMNS = 10 // #, base, actype, family, position, from, to, primary, status, delete
const TODAY = () => new Date().toISOString().slice(0, 10)

function randomLocalId(): string {
  return `new-${Math.random().toString(36).slice(2, 10)}`
}
function emptyRow(): LocalRow {
  return {
    id: randomLocalId(),
    serverId: null,
    base: null,
    aircraftType: '',
    position: '',
    acFamilyQualified: false,
    // Leave blank until the row actually gets edited — `update()` will fill
    // in today's date when a user first types into A/C Type or Position.
    startDate: '',
    endDate: null,
    isPrimary: false,
    status: 'idle',
    dirty: false,
  }
}

export const AircraftQualificationsGrid = forwardRef<AircraftQualificationsGridHandle, Props>(
  function AircraftQualificationsGrid({ crewId, rows, onChanged, onReadyCountChange }, ref) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const palette = isDark ? colors.dark : colors.light
    const rootRef = useRef<HTMLDivElement>(null)

    const basesQ = useAirports({ crewBase: true })
    const posQ = useCrewPositions(getOperatorId())
    const bases: AirportRef[] = basesQ.data ?? []
    const positions: CrewPositionRef[] = posQ.data ?? []

    // Initialize / reconcile local state from server rows
    const [local, setLocal] = useState<LocalRow[]>([])
    const copiedRef = useRef<Partial<LocalRow> | null>(null)

    useEffect(() => {
      setLocal((prev) => {
        const serverMap = new Map(rows.map((r) => [r._id, r]))
        // Keep unsaved local rows; replace saved ones with fresh server data
        const kept: LocalRow[] = []
        for (const r of prev) {
          if (r.serverId && !serverMap.has(r.serverId)) continue // deleted on server
          if (!r.serverId) {
            kept.push(r)
            continue
          }
          const s = serverMap.get(r.serverId)!
          serverMap.delete(r.serverId)
          kept.push({
            ...r,
            base: s.base,
            aircraftType: s.aircraftType,
            position: s.position,
            acFamilyQualified: s.acFamilyQualified,
            startDate: s.startDate,
            endDate: s.endDate,
            isPrimary: s.isPrimary,
            dirty: false,
            status: r.status === 'saved' ? 'saved' : 'idle',
          })
        }
        for (const [, s] of serverMap) {
          kept.push({
            id: s._id,
            serverId: s._id,
            base: s.base,
            aircraftType: s.aircraftType,
            position: s.position,
            acFamilyQualified: s.acFamilyQualified,
            startDate: s.startDate,
            endDate: s.endDate,
            isPrimary: s.isPrimary,
            status: 'idle',
            dirty: false,
          })
        }
        return padTrailing(kept)
      })
    }, [rows])

    // Debounced save per row
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

    const queueSave = useCallback(
      (rowId: string) => {
        if (!crewId) return // drafts can't persist yet
        const existing = timersRef.current.get(rowId)
        if (existing) clearTimeout(existing)
        const t = setTimeout(async () => {
          const row = latestRow(setLocal, rowId)
          if (!row) return
          if (!row.aircraftType.trim() || !row.position.trim()) return // incomplete
          setLocal((prev) => prev.map((r) => (r.id === rowId ? { ...r, status: 'saving' } : r)))
          try {
            const payload: CrewQualificationInput = {
              base: row.base,
              aircraftType: row.aircraftType.toUpperCase(),
              position: row.position,
              startDate: row.startDate,
              endDate: row.endDate,
              isPrimary: row.isPrimary,
              acFamilyQualified: row.acFamilyQualified,
              trainingQuals: [],
            }
            if (row.serverId) {
              await api.updateCrewQualification(crewId, row.serverId, payload)
            } else {
              const created = await api.addCrewQualification(crewId, payload)
              setLocal((prev) =>
                prev.map((r) => (r.id === rowId ? { ...r, serverId: created._id, dirty: false, status: 'saved' } : r)),
              )
              await onChanged()
              setTimeout(() => {
                setLocal((prev) =>
                  prev.map((r) => (r.id === rowId && r.status === 'saved' ? { ...r, status: 'idle' } : r)),
                )
              }, 1200)
              return
            }
            setLocal((prev) => prev.map((r) => (r.id === rowId ? { ...r, dirty: false, status: 'saved' } : r)))
            await onChanged()
            setTimeout(() => {
              setLocal((prev) =>
                prev.map((r) => (r.id === rowId && r.status === 'saved' ? { ...r, status: 'idle' } : r)),
              )
            }, 1200)
          } catch (e) {
            setLocal((prev) =>
              prev.map((r) => (r.id === rowId ? { ...r, status: 'error', error: (e as Error).message } : r)),
            )
          }
        }, 500)
        timersRef.current.set(rowId, t)
      },
      [crewId, onChanged],
    )

    const update = useCallback(
      (rowId: string, patch: Partial<LocalRow>) => {
        setLocal((prev) => {
          const next = prev.map((r) => {
            if (r.id !== rowId) return r
            const merged = { ...r, ...patch, dirty: true }
            // Default startDate to today the first time a user fills in A/C Type
            // or Position on a new row — previously we pre-populated it on empty
            // rows which made placeholder rows look filled.
            if (!merged.startDate && !merged.serverId && (merged.aircraftType || merged.position)) {
              merged.startDate = TODAY()
            }
            return merged
          })
          return padTrailing(next)
        })
        queueSave(rowId)
      },
      [queueSave],
    )

    const deleteRow = useCallback(
      async (rowId: string) => {
        const row = local.find((r) => r.id === rowId)
        if (!row) return
        if (row.serverId && crewId) {
          await api.deleteCrewQualification(crewId, row.serverId)
          await onChanged()
        }
        setLocal((prev) => padTrailing(prev.filter((r) => r.id !== rowId)))
      },
      [local, crewId, onChanged],
    )

    const copyRow = useCallback(
      (rowIdx: number) => {
        const row = local[rowIdx]
        if (!row) return
        copiedRef.current = {
          base: row.base,
          aircraftType: row.aircraftType,
          position: row.position,
          acFamilyQualified: row.acFamilyQualified,
          isPrimary: false,
        }
      },
      [local],
    )
    const pasteRow = useCallback(
      (rowIdx: number) => {
        const row = local[rowIdx]
        if (!row || !copiedRef.current) return
        update(row.id, copiedRef.current)
      },
      [local, update],
    )
    const removeRowIfEmpty = useCallback(
      (rowIdx: number) => {
        const row = local[rowIdx]
        if (!row || row.serverId || row.aircraftType || row.position) return false
        setLocal((prev) => padTrailing(prev.filter((r) => r.id !== row.id)))
        return true
      },
      [local],
    )
    const appendRow = useCallback(() => {
      setLocal((prev) => {
        // Only append if no trailing empty row
        if (prev.at(-1) && !prev.at(-1)!.aircraftType && !prev.at(-1)!.position && !prev.at(-1)!.serverId) return prev
        return [...prev, emptyRow()]
      })
    }, [])

    useGridKeyboard(rootRef, {
      rowCount: local.length,
      colCount: COLUMNS,
      copyRow,
      pasteRow,
      removeRowIfEmpty,
      onAppendRow: appendRow,
    })

    // Count "ready" rows (both aircraftType + position filled) and notify parent.
    const readyCount = useMemo(() => local.filter((r) => r.aircraftType.trim() && r.position.trim()).length, [local])
    const onReadyCountChangeRef = useRef(onReadyCountChange)
    onReadyCountChangeRef.current = onReadyCountChange
    useEffect(() => {
      onReadyCountChangeRef.current?.(readyCount)
    }, [readyCount])

    // Imperative handle — lets the shell flush pending draft rows once the
    // crew member has been created server-side.
    useImperativeHandle(
      ref,
      (): AircraftQualificationsGridHandle => ({
        getReadyCount: () => readyCount,
        flushToCrew: async (newCrewId: string) => {
          const readyRows = local.filter((r) => r.aircraftType.trim() && r.position.trim() && !r.serverId)
          for (const r of readyRows) {
            const payload: CrewQualificationInput = {
              base: r.base,
              aircraftType: r.aircraftType.toUpperCase(),
              position: r.position,
              startDate: r.startDate || TODAY(),
              endDate: r.endDate,
              isPrimary: r.isPrimary,
              acFamilyQualified: r.acFamilyQualified,
              trainingQuals: [],
            }
            await api.addCrewQualification(newCrewId, payload)
          }
          await onChanged()
        },
      }),
      [readyCount, local, onChanged],
    )

    const headerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
    const cellBg = isDark ? 'transparent' : '#FFFFFF'

    const baseOpts = useMemo(() => bases.map((b) => ({ value: b._id, label: b.iataCode ?? b.icaoCode })), [bases])
    const posOpts = useMemo(() => positions.map((p) => ({ value: p._id, label: p.code })), [positions])

    return (
      <div ref={rootRef} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
        <div
          className="grid text-[12px] font-medium uppercase tracking-wide"
          style={{
            gridTemplateColumns: '40px 80px 110px 60px 100px 120px 120px 60px 44px 44px',
            background: headerBg,
            color: palette.textSecondary,
          }}
        >
          <HeaderCell>#</HeaderCell>
          <HeaderCell>Base</HeaderCell>
          <HeaderCell>A/C Type</HeaderCell>
          <HeaderCell>Family</HeaderCell>
          <HeaderCell>Position</HeaderCell>
          <HeaderCell>From</HeaderCell>
          <HeaderCell>To</HeaderCell>
          <HeaderCell>Pri</HeaderCell>
          <HeaderCell>—</HeaderCell>
          <HeaderCell>—</HeaderCell>
        </div>
        {local.map((row, r) => {
          // Flag row 1 as mandatory for a draft crew that has zero ready rows.
          // Same red tint + left border as Crew ID / First / Last require fields.
          const requiresFirstRow = !crewId && readyCount === 0 && r === 0
          const rowBg = requiresFirstRow
            ? isDark
              ? 'rgba(230,53,53,0.10)'
              : 'rgba(230,53,53,0.05)'
            : r % 2 === 0
              ? cellBg
              : isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.01)'
          return (
            <div
              key={row.id}
              className="grid"
              style={{
                gridTemplateColumns: '40px 80px 110px 60px 100px 120px 120px 60px 44px 44px',
                background: rowBg,
                borderTop: `1px solid ${requiresFirstRow ? '#E63535' : border}`,
                borderBottom: requiresFirstRow ? `1px solid #E63535` : undefined,
                borderLeft: requiresFirstRow ? `3px solid #E63535` : undefined,
              }}
            >
              <DataCell row={r} col={0} palette={palette}>
                <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                  {r + 1}
                </span>
              </DataCell>
              <DataCell row={r} col={1} palette={palette}>
                <select
                  value={row.base ?? ''}
                  onChange={(e) => update(row.id, { base: e.target.value || null })}
                  className="w-full h-8 px-1.5 text-[13px] bg-transparent outline-none"
                  style={{ color: palette.text }}
                >
                  <option value="">—</option>
                  {baseOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </DataCell>
              <DataCell row={r} col={2} palette={palette}>
                <input
                  type="text"
                  value={row.aircraftType}
                  onChange={(e) => update(row.id, { aircraftType: e.target.value.toUpperCase() })}
                  placeholder="A320"
                  className="w-full h-8 px-1.5 text-[13px] bg-transparent outline-none font-mono"
                  style={{ color: palette.text }}
                />
              </DataCell>
              <DataCell row={r} col={3} palette={palette} center>
                <input
                  type="checkbox"
                  checked={row.acFamilyQualified}
                  onChange={(e) => update(row.id, { acFamilyQualified: e.target.checked })}
                  className="w-3.5 h-3.5"
                  style={{ accentColor: crewAccent(isDark) }}
                />
              </DataCell>
              <DataCell row={r} col={4} palette={palette}>
                <select
                  value={row.position}
                  onChange={(e) => update(row.id, { position: e.target.value })}
                  className="w-full h-8 px-1.5 text-[13px] bg-transparent outline-none"
                  style={{ color: palette.text }}
                >
                  <option value="">—</option>
                  {posOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </DataCell>
              <DataCell row={r} col={5} palette={palette}>
                <input
                  type="date"
                  value={row.startDate}
                  onChange={(e) => update(row.id, { startDate: e.target.value })}
                  className="w-full h-8 px-1.5 text-[13px] bg-transparent outline-none"
                  style={{ color: palette.text }}
                />
              </DataCell>
              <DataCell row={r} col={6} palette={palette}>
                <input
                  type="date"
                  value={row.endDate ?? ''}
                  onChange={(e) => update(row.id, { endDate: e.target.value || null })}
                  className="w-full h-8 px-1.5 text-[13px] bg-transparent outline-none"
                  style={{ color: palette.text }}
                />
              </DataCell>
              <DataCell row={r} col={7} palette={palette} center>
                <input
                  type="checkbox"
                  checked={row.isPrimary}
                  onChange={(e) => update(row.id, { isPrimary: e.target.checked })}
                  className="w-3.5 h-3.5"
                  style={{ accentColor: crewAccent(isDark) }}
                />
              </DataCell>
              <DataCell row={r} col={8} palette={palette} center>
                <StatusIcon status={row.status} error={row.error} isDark={isDark} />
              </DataCell>
              <DataCell row={r} col={9} palette={palette} center>
                {(row.aircraftType || row.position || row.serverId) && (
                  <button
                    type="button"
                    onClick={() => void deleteRow(row.id)}
                    className="opacity-60 hover:opacity-100"
                    title="Delete row"
                  >
                    <Trash2 size={12} style={{ color: '#E63535' }} />
                  </button>
                )}
              </DataCell>
            </div>
          )
        })}
        {!crewId && (
          <div
            className="p-3 text-[13px] border-t flex items-center gap-1.5"
            style={{
              borderColor: readyCount > 0 ? border : '#E63535',
              color: readyCount > 0 ? palette.textTertiary : '#E63535',
              background: readyCount > 0 ? headerBg : isDark ? 'rgba(230,53,53,0.08)' : 'rgba(230,53,53,0.04)',
              fontWeight: readyCount > 0 ? 400 : 600,
            }}
          >
            {readyCount > 0 ? (
              <>
                <Check size={12} style={{ color: '#06C270' }} />
                {readyCount} qualification{readyCount > 1 ? 's' : ''} queued — will save when you click Save.
              </>
            ) : (
              <>
                <AlertTriangle size={12} />
                At least one qualification is required. Fill A/C Type and Position to enable Save.
              </>
            )}
          </div>
        )}
        <p
          className="px-3 py-2 text-[13px] border-t"
          style={{ borderColor: border, color: palette.textTertiary, background: headerBg }}
        >
          Tab moves next cell · Enter moves down · Ctrl+C / Ctrl+V copies a row ·{' '}
          {crewId ? 'Rows auto-save 500ms after editing' : 'Rows save with the new crew'}
        </p>
      </div>
    )
  },
)

// ─── helpers ───

function padTrailing(rows: LocalRow[]): LocalRow[] {
  let trailingEmpty = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]
    if (!r.serverId && !r.aircraftType && !r.position) trailingEmpty++
    else break
  }
  const missing = Math.max(0, MIN_EMPTY_TRAILING - trailingEmpty)
  if (missing === 0) return rows
  const toAdd = Array.from({ length: missing }, () => emptyRow())
  return [...rows, ...toAdd]
}

function latestRow(setLocal: React.Dispatch<React.SetStateAction<LocalRow[]>>, id: string): LocalRow | null {
  let found: LocalRow | null = null
  setLocal((prev) => {
    found = prev.find((r) => r.id === id) ?? null
    return prev
  })
  return found
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1.5 flex items-center">{children}</div>
}
function DataCell({
  row,
  col,
  children,
  palette,
  center,
}: {
  row: number
  col: number
  children: React.ReactNode
  palette: Palette
  center?: boolean
}) {
  return (
    <div
      data-cell={`${row},${col}`}
      className={`px-1 border-l first:border-l-0 flex items-center ${center ? 'justify-center' : ''}`}
      style={{ borderColor: 'transparent', color: palette.text, minHeight: 36 }}
      tabIndex={-1}
    >
      {children}
    </div>
  )
}
function StatusIcon({ status, error, isDark }: { status: RowStatus; error?: string; isDark: boolean }) {
  if (status === 'saving') return <Loader2 size={12} className="animate-spin" style={{ color: crewAccent(isDark) }} />
  if (status === 'saved') return <Check size={12} style={{ color: '#06C270' }} />
  if (status === 'error')
    return (
      <span title={error}>
        <AlertTriangle size={12} style={{ color: '#E63535' }} />
      </span>
    )
  return null
}
