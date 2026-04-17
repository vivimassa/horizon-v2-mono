'use client'

import { useState } from 'react'
import { Minus, Plus, Pencil } from 'lucide-react'
import type { FlightChange, FlightDiff, SSIMFlightLeg } from '@skyhub/logic'
import { SectionFrame } from './section-frame'

type Tab = 'added' | 'removed' | 'changed'

/**
 * Flight-level diff with tabs for added / removed / changed records.
 * Match key is (airline, flight#, dep, arr, periodStart), so "changed"
 * captures same-season edits to frequency, times, equipment, etc.
 */
export function FlightDiffTabs({ diff }: { diff: FlightDiff }) {
  const [tab, setTab] = useState<Tab>('changed')

  const counts = {
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.changed.length,
  }

  return (
    <SectionFrame
      title="Flight-level diff"
      subtitle={`${counts.added} added · ${counts.removed} removed · ${counts.changed} changed`}
    >
      <div className="flex gap-1 mb-2">
        <TabButton active={tab === 'changed'} count={counts.changed} onClick={() => setTab('changed')} color="#FF8800">
          <Pencil size={13} /> Changed
        </TabButton>
        <TabButton active={tab === 'added'} count={counts.added} onClick={() => setTab('added')} color="#06C270">
          <Plus size={13} /> Added
        </TabButton>
        <TabButton active={tab === 'removed'} count={counts.removed} onClick={() => setTab('removed')} color="#FF3B3B">
          <Minus size={13} /> Removed
        </TabButton>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--color-hz-card, rgba(255,255,255,0.65))',
          border: '1px solid var(--color-hz-border, rgba(0,0,0,0.06))',
          boxShadow: '0 1px 3px rgba(96,97,112,0.10)',
        }}
      >
        {tab === 'changed' && <ChangedTable rows={diff.changed} />}
        {tab === 'added' && <AddRemoveTable rows={diff.added} empty="Nothing new in File B." />}
        {tab === 'removed' && <AddRemoveTable rows={diff.removed} empty="Nothing dropped from File A." />}
      </div>
    </SectionFrame>
  )
}

function TabButton({
  active,
  count,
  onClick,
  color,
  children,
}: {
  active: boolean
  count: number
  onClick: () => void
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors"
      style={{
        background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
        color: active ? color : 'var(--color-hz-text-secondary, #8F90A6)',
        border: `1px solid ${active ? `color-mix(in srgb, ${color} 30%, transparent)` : 'var(--color-hz-border, rgba(0,0,0,0.08))'}`,
      }}
    >
      {children}
      <span className="text-[13px] font-bold ml-1">{count.toLocaleString()}</span>
    </button>
  )
}

function AddRemoveTable({ rows, empty }: { rows: SSIMFlightLeg[]; empty: string }) {
  if (rows.length === 0) {
    return <div className="px-3 py-6 text-center text-[13px] text-hz-text-tertiary">{empty}</div>
  }
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-hz-text-tertiary" style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.5 }}>
          <th className="px-3 py-2 text-left uppercase">Flight</th>
          <th className="px-3 py-2 text-left uppercase">Route</th>
          <th className="px-3 py-2 text-left uppercase">AC</th>
          <th className="px-3 py-2 text-right uppercase">Seats</th>
          <th className="px-3 py-2 text-left uppercase">Period</th>
          <th className="px-3 py-2 text-left uppercase">DOW</th>
          <th className="px-3 py-2 text-right uppercase">STD UTC</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 500).map((f, i) => (
          <tr
            key={`${f.airlineCode}${f.flightNumber}-${f.periodStart}-${i}`}
            className="border-t border-hz-border/40"
            style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(127,127,143,0.06)' }}
          >
            <td className="px-3 py-2 font-semibold text-hz-text">
              {f.airlineCode}
              {f.flightNumber}
            </td>
            <td className="px-3 py-2 text-hz-text">
              {f.depStation}→{f.arrStation}
            </td>
            <td className="px-3 py-2 text-hz-text-secondary">{f.aircraftType}</td>
            <td className="px-3 py-2 text-right tabular-nums text-hz-text-secondary">
              {f.totalCapacity.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-hz-text-secondary">
              {f.periodStart} → {f.periodEnd}
            </td>
            <td className="px-3 py-2 font-mono text-hz-text-secondary">{f.daysOfOperation.replace(/ /g, '·')}</td>
            <td className="px-3 py-2 text-right tabular-nums text-hz-text-secondary">{formatHhmm(f.stdUtc)}</td>
          </tr>
        ))}
      </tbody>
      {rows.length > 500 && (
        <tfoot>
          <tr>
            <td colSpan={7} className="px-3 py-2 text-[13px] text-hz-text-tertiary text-center">
              Showing first 500 of {rows.length.toLocaleString()} rows.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

function ChangedTable({ rows }: { rows: FlightChange[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[13px] text-hz-text-tertiary">
        No matched flights differ between A and B.
      </div>
    )
  }
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-hz-text-tertiary" style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.5 }}>
          <th className="px-3 py-2 text-left uppercase">Flight</th>
          <th className="px-3 py-2 text-left uppercase">Route</th>
          <th className="px-3 py-2 text-left uppercase">Period</th>
          <th className="px-3 py-2 text-left uppercase">Changes (A → B)</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 500).map((c, i) => (
          <tr
            key={`${c.airlineCode}${c.flightNumber}-${c.periodStart}-${i}`}
            className="border-t border-hz-border/40 align-top"
            style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(127,127,143,0.06)' }}
          >
            <td className="px-3 py-2 font-semibold text-hz-text">
              {c.airlineCode}
              {c.flightNumber}
            </td>
            <td className="px-3 py-2 text-hz-text">
              {c.dep}→{c.arr}
            </td>
            <td className="px-3 py-2 text-hz-text-secondary">{c.periodStart}</td>
            <td className="px-3 py-2">
              <ul className="space-y-0.5">
                {c.changedFields.map((field) => (
                  <li key={field} className="text-[13px]">
                    <span className="text-hz-text-tertiary font-semibold uppercase tracking-wider">
                      {String(field)}:
                    </span>{' '}
                    <span className="text-hz-text-secondary line-through">{formatField(field, c.before[field])}</span>{' '}
                    <span className="text-hz-text-tertiary">→</span>{' '}
                    <span className="text-hz-text font-semibold">{formatField(field, c.after[field])}</span>
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
      {rows.length > 500 && (
        <tfoot>
          <tr>
            <td colSpan={4} className="px-3 py-2 text-[13px] text-hz-text-tertiary text-center">
              Showing first 500 of {rows.length.toLocaleString()} rows.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

function formatField(field: keyof SSIMFlightLeg, value: unknown): string {
  if (value == null) return '—'
  if (field === 'daysOfOperation' && typeof value === 'string') return value.replace(/ /g, '·')
  if (field === 'stdUtc' || field === 'staUtc') return formatHhmm(String(value))
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function formatHhmm(s: string): string {
  if (!s || s.length < 4) return s || '—'
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`
}
