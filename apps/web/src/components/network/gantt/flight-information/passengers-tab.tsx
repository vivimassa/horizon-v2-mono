"use client"

import { useState } from 'react'
import { PlaneTakeoff, PlaneLanding, Plus, X, Trash2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

interface PassengersTabProps {
  data: FlightDetail
  onUpdate: (updater: (d: FlightDetail) => void) => void
}

export function PassengersTab({ data, onUpdate }: PassengersTabProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const muted = isDark ? '#8F90A6' : '#555770'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = 'var(--module-accent, #1e40af)'
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#fff'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const pax = data.pax ?? { adultExpected: null, adultActual: null, childExpected: null, childActual: null, infantExpected: null, infantActual: null }
  const totalSeats = data.lopa?.totalSeats ?? data.aircraftType?.paxCapacity ?? null

  // Totals
  const totalExpected = (pax.adultExpected ?? 0) + (pax.childExpected ?? 0)
  const totalActual = (pax.adultActual ?? 0) + (pax.childActual ?? 0)
  const paxOnBoard = totalActual + (pax.infantActual ?? 0)
  const loadPct = totalSeats && totalSeats > 0 ? Math.round((paxOnBoard / totalSeats) * 100) : null

  function updatePax(field: keyof NonNullable<FlightDetail['pax']>, value: number | null) {
    onUpdate(d => {
      if (!d.pax) d.pax = { adultExpected: null, adultActual: null, childExpected: null, childActual: null, infantExpected: null, infantActual: null }
      d.pax[field] = value
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {/* PAX breakdown */}
        <div className="col-span-3 rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <h3 className="text-[14px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: accent }}>
            Passenger Breakdown
          </h3>

          {/* LOPA cabin config badge */}
          {data.lopa && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[13px] font-mono font-medium px-2 py-0.5 rounded-lg" style={{ background: `${accent}10`, color: accent }}>
                {data.lopa.configName}
              </span>
              <span className="text-[13px]" style={{ color: muted }}>
                {data.lopa.cabins.map(c => `${c.classCode}${c.seats}`).join(' ')} — {data.lopa.totalSeats} seats
              </span>
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-4 gap-3 mb-2">
            <div />
            <div className="text-[13px] font-bold uppercase text-center" style={{ color: muted }}>Expected</div>
            <div className="text-[13px] font-bold uppercase text-center" style={{ color: muted }}>Actual</div>
            <div className="text-[13px] font-bold uppercase text-center" style={{ color: muted }}>Diff</div>
          </div>

          <PaxRow label="Adults (ADT)" expected={pax.adultExpected} actual={pax.adultActual}
            onExpected={v => updatePax('adultExpected', v)} onActual={v => updatePax('adultActual', v)}
            inputBg={inputBg} inputBorder={inputBorder} textPrimary={textPrimary} muted={muted} />
          <PaxRow label="Children (CHD)" expected={pax.childExpected} actual={pax.childActual}
            onExpected={v => updatePax('childExpected', v)} onActual={v => updatePax('childActual', v)}
            inputBg={inputBg} inputBorder={inputBorder} textPrimary={textPrimary} muted={muted} />
          <PaxRow label="Infants (INF)" expected={pax.infantExpected} actual={pax.infantActual}
            onExpected={v => updatePax('infantExpected', v)} onActual={v => updatePax('infantActual', v)}
            inputBg={inputBg} inputBorder={inputBorder} textPrimary={textPrimary} muted={muted} />

          {/* Totals */}
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <div className="grid grid-cols-4 gap-3 items-center mb-1">
              <span className="text-[13px] font-bold" style={{ color: textPrimary }}>Revenue Pax</span>
              <div className="text-center text-[15px] font-mono font-bold" style={{ color: totalExpected ? textPrimary : `${muted}40` }}>
                {totalExpected || '—'}
              </div>
              <div className="text-center text-[15px] font-mono font-bold" style={{ color: totalActual ? textPrimary : `${muted}40` }}>
                {totalActual || '—'}
              </div>
              <div />
            </div>
            <div className="grid grid-cols-4 gap-3 items-center">
              <span className="text-[13px] font-bold" style={{ color: textPrimary }}>Pax on Board</span>
              <div />
              <div className="text-center text-[15px] font-mono font-bold" style={{ color: paxOnBoard ? textPrimary : `${muted}40` }}>
                {paxOnBoard || '—'}
              </div>
              <div />
            </div>
          </div>
        </div>

        {/* Load donut */}
        <div className="col-span-1 rounded-2xl p-4 flex flex-col items-center justify-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          {(() => {
            const size = 140
            const cx = size / 2
            const r = 54
            const stroke = 10
            const circ = 2 * Math.PI * r
            const fill = loadPct != null ? (loadPct / 100) * circ : 0
            const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
            const ringColor = loadPct == null ? `${muted}20` : loadPct >= 80 ? '#06C270' : loadPct >= 50 ? '#F59E0B' : accent
            // Dot position at the end of the arc
            const angle = loadPct != null ? ((loadPct / 100) * 360 - 90) * (Math.PI / 180) : -Math.PI / 2
            const dotX = cx + r * Math.cos(angle)
            const dotY = cx + r * Math.sin(angle)

            return (
              <>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mb-3">
                  {/* Gradient definition */}
                  <defs>
                    <linearGradient id="donut-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={ringColor} stopOpacity="0.6" />
                      <stop offset="100%" stopColor={ringColor} />
                    </linearGradient>
                    <filter id="donut-glow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  {/* Track */}
                  <circle cx={cx} cy={cx} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
                  {/* Fill arc */}
                  <circle cx={cx} cy={cx} r={r} fill="none" stroke="url(#donut-grad)" strokeWidth={stroke}
                    strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
                    filter={fill > 0 ? 'url(#donut-glow)' : undefined}
                    style={{ transition: 'stroke-dasharray 0.4s ease' }} />
                  {/* End dot */}
                  {fill > 0 && (
                    <circle cx={dotX} cy={dotY} r={5} fill="#fff"
                      stroke={ringColor} strokeWidth={2}
                      style={{ filter: `drop-shadow(0 0 4px ${ringColor}80)` }} />
                  )}
                </svg>
                <span className="text-[26px] font-mono font-bold" style={{ color: loadPct != null ? textPrimary : `${muted}30` }}>
                  {loadPct != null ? `${loadPct}%` : '—'}
                </span>
                <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: muted }}>Load</span>
                {totalSeats != null && (
                  <span className="text-[13px] font-mono mt-1" style={{ color: `${muted}50` }}>
                    {paxOnBoard || 0} of {totalSeats}
                  </span>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* Connections */}
      <div className="grid grid-cols-2 gap-4">
        <ConnectionPanel
          icon={PlaneTakeoff} title="Outgoing Connections" subtitle="Pax on this flight connecting to..."
          items={data.connections.outgoing}
          onAdd={(fn, px) => onUpdate(d => { d.connections.outgoing.push({ flightNumber: fn, pax: px }) })}
          onRemove={i => onUpdate(d => { d.connections.outgoing.splice(i, 1) })}
          onUpdatePax={(i, px) => onUpdate(d => { d.connections.outgoing[i].pax = px })}
          cardBg={cardBg} cardBorder={cardBorder} muted={muted} accent={accent}
          inputBg={inputBg} inputBorder={inputBorder} textPrimary={textPrimary} isDark={isDark}
        />
        <ConnectionPanel
          icon={PlaneLanding} title="Incoming Connections" subtitle="Pax connecting from... to this flight"
          items={data.connections.incoming}
          onAdd={(fn, px) => onUpdate(d => { d.connections.incoming.push({ flightNumber: fn, pax: px }) })}
          onRemove={i => onUpdate(d => { d.connections.incoming.splice(i, 1) })}
          onUpdatePax={(i, px) => onUpdate(d => { d.connections.incoming[i].pax = px })}
          cardBg={cardBg} cardBorder={cardBorder} muted={muted} accent={accent}
          inputBg={inputBg} inputBorder={inputBorder} textPrimary={textPrimary} isDark={isDark}
        />
      </div>
    </div>
  )
}

function PaxRow({ label, expected, actual, onExpected, onActual, inputBg, inputBorder, textPrimary, muted }: {
  label: string; expected: number | null; actual: number | null
  onExpected: (v: number | null) => void; onActual: (v: number | null) => void
  inputBg: string; inputBorder: string; textPrimary: string; muted: string
}) {
  const diff = (expected != null && actual != null) ? actual - expected : null
  const diffColor = diff == null ? `${muted}40` : diff > 0 ? '#06C270' : diff < 0 ? '#E63535' : textPrimary

  return (
    <div className="grid grid-cols-4 gap-3 mb-2 items-center">
      <span className="text-[13px] font-medium" style={{ color: textPrimary }}>{label}</span>
      <input
        type="number"
        min={0}
        value={expected ?? ''}
        onChange={e => onExpected(e.target.value ? parseInt(e.target.value) : null)}
        placeholder="—"
        className="h-[36px] text-center rounded-lg text-[14px] font-mono font-bold outline-none"
        style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: expected != null ? textPrimary : `${muted}40` }}
      />
      <input
        type="number"
        min={0}
        value={actual ?? ''}
        onChange={e => onActual(e.target.value ? parseInt(e.target.value) : null)}
        placeholder="—"
        className="h-[36px] text-center rounded-lg text-[14px] font-mono font-bold outline-none"
        style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: actual != null ? textPrimary : `${muted}40` }}
      />
      <div className="text-center text-[14px] font-mono font-bold" style={{ color: diffColor }}>
        {diff != null ? (diff > 0 ? `+${diff}` : String(diff)) : '—'}
      </div>
    </div>
  )
}

function ConnectionPanel({ icon: Icon, title, subtitle, items, onAdd, onRemove, onUpdatePax,
  cardBg, cardBorder, muted, accent, inputBg, inputBorder, textPrimary, isDark,
}: {
  icon: typeof PlaneTakeoff; title: string; subtitle: string
  items: Array<{ flightNumber: string; pax: number }>
  onAdd: (flightNumber: string, pax: number) => void
  onRemove: (index: number) => void
  onUpdatePax: (index: number, pax: number) => void
  cardBg: string; cardBorder: string; muted: string; accent: string
  inputBg: string; inputBorder: string; textPrimary: string; isDark: boolean
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [newFlight, setNewFlight] = useState('')
  const [newPax, setNewPax] = useState('')

  function handleAdd() {
    if (!newFlight.trim()) return
    onAdd(newFlight.trim().toUpperCase(), parseInt(newPax) || 0)
    setNewFlight(''); setNewPax(''); setShowAdd(false)
  }

  const totalPax = items.reduce((sum, c) => sum + c.pax, 0)

  return (
    <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: accent }} />
          <h3 className="text-[14px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>{title}</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: accent, color: '#fff' }}
        >
          <Plus size={14} />
        </button>
      </div>
      <p className="text-[13px] mb-3" style={{ color: muted }}>{subtitle}</p>

      {/* Add form */}
      {showAdd && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="Search flight..."
            value={newFlight}
            onChange={e => setNewFlight(e.target.value)}
            autoFocus
            className="flex-1 h-[36px] px-3 rounded-lg text-[13px] font-mono outline-none"
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
          />
          <input
            type="number"
            min={0}
            placeholder="Pax"
            value={newPax}
            onChange={e => setNewPax(e.target.value)}
            className="w-[60px] h-[36px] text-center rounded-lg text-[13px] font-mono font-bold outline-none"
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: '#E63535' }}
          />
          <button onClick={handleAdd} className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ background: accent }}>
            <Plus size={14} />
          </button>
          <button onClick={() => { setShowAdd(false); setNewFlight(''); setNewPax('') }}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ color: muted, border: `1px solid ${inputBorder}` }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Items */}
      {items.length === 0 && !showAdd ? (
        <div className="py-3">
          <span className="text-[13px] italic" style={{ color: `${muted}60` }}>No connections</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((c, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <span className="text-[13px] font-mono font-bold flex-1" style={{ color: textPrimary }}>{c.flightNumber}</span>
              <input
                type="number"
                min={0}
                value={c.pax || ''}
                onChange={e => onUpdatePax(i, parseInt(e.target.value) || 0)}
                className="w-[50px] h-[30px] text-center rounded-lg text-[13px] font-mono font-bold outline-none"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: '#E63535' }}
              />
              <span className="text-[13px]" style={{ color: muted }}>pax</span>
              <button onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5 shrink-0">
                <Trash2 size={13} style={{ color: '#E63535' }} />
              </button>
            </div>
          ))}
          {items.length > 0 && (
            <div className="pt-2 mt-1 flex items-center justify-between" style={{ borderTop: `1px solid ${cardBorder}` }}>
              <span className="text-[13px] font-bold" style={{ color: textPrimary }}>Total</span>
              <span className="text-[14px] font-mono font-bold" style={{ color: accent }}>{totalPax} pax</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
