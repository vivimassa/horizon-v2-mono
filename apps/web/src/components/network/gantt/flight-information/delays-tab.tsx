'use client'

import { useState, useEffect, useMemo } from 'react'
import { CheckCircle, Plus, Trash2, Search, Check, X } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Dropdown } from '@/components/ui/dropdown'
import { api } from '@skyhub/api'
import type { DelayCodeRef } from '@skyhub/api'
import { useOperatorStore } from '@/stores/use-operator-store'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

const CATEGORY_COLORS: Record<string, string> = {
  airline_internal: '#6B7280',
  passenger_and_baggage: '#8B5CF6',
  cargo_and_mail: '#14B8A6',
  mail_only: '#14B8A6',
  aircraft_and_ramp: '#F97316',
  technical: '#EF4444',
  damage_to_aircraft: '#EF4444',
  egd: '#EF4444',
  atfm: '#3B82F6',
  airport: '#0EA5E9',
  government: '#6B7280',
  weather: '#0EA5E9',
  reactionary: '#F59E0B',
  miscellaneous: '#6B7280',
  default: '#6B7280',
}

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS[cat.toLowerCase().replace(/[\s/]+/g, '_')] ?? '#6B7280'
}

type AhmMode = '730' | '732'

interface DelaysTabProps {
  data: FlightDetail
  onUpdate: (updater: (d: FlightDetail) => void) => void
}

export function DelaysTab({ data, onUpdate }: DelaysTabProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const muted = isDark ? '#8F90A6' : '#555770'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const accent = 'var(--module-accent, #1e40af)'
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#fff'
  const inputBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const [delayCodes, setDelayCodes] = useState<DelayCodeRef[]>([])
  const [ahmMode, setAhmMode] = useState<AhmMode | null>(null)

  useEffect(() => {
    const operatorId = useOperatorStore.getState().operator?._id ?? ''
    api
      .getDelayCodes(operatorId)
      .then(setDelayCodes)
      .catch(() => {})
  }, [])

  // Split codes by AHM type
  const codes730 = useMemo(
    () => delayCodes.filter((c) => !c.ahm732Process && !c.ahm732Reason && !c.ahm732Stakeholder),
    [delayCodes],
  )
  const codes732 = useMemo(
    () => delayCodes.filter((c) => c.ahm732Process || c.ahm732Reason || c.ahm732Stakeholder),
    [delayCodes],
  )
  const activeCodes = ahmMode === '732' ? codes732 : codes730

  function addDelay730(code: DelayCodeRef) {
    onUpdate((d) => {
      d.delays.push({ code: code.code, minutes: 0, reason: code.name, category: code.category })
    })
  }

  function addDelay732(process: string, reason: string, stakeholder: string, minutes: number) {
    const code = [process, reason, stakeholder].filter(Boolean).join('')
    onUpdate((d) => {
      d.delays.push({ code, minutes, reason: `${process}/${reason}/${stakeholder}`, category: 'ahm732' })
    })
  }

  function removeDelay(index: number) {
    onUpdate((d) => {
      d.delays.splice(index, 1)
    })
  }

  function updateDelayMinutes(index: number, minutes: number) {
    onUpdate((d) => {
      d.delays[index].minutes = minutes
    })
  }

  function updateDelayReason(index: number, reason: string) {
    onUpdate((d) => {
      d.delays[index].reason = reason
    })
  }

  return (
    <div>
      {/* AHM scheme selector */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[13px] font-medium shrink-0" style={{ color: muted }}>
          Delay code scheme <span style={{ color: '#E63535' }}>*</span>
        </span>
        <Dropdown
          size="sm"
          value={ahmMode}
          onChange={(v) => setAhmMode(v as AhmMode)}
          placeholder="Select scheme..."
          options={[
            { value: '730', label: 'AHM 730/731' },
            { value: '732', label: 'AHM 732' },
          ]}
          className="w-[160px]"
        />
      </div>

      {/* Computed delay from OOOI */}
      <ComputedDelayBanner data={data} isDark={isDark} muted={muted} accent={accent} />

      <div className="grid grid-cols-2 gap-4">
        <DelaySection
          title="Departure Delays"
          delays={data.delays}
          activeCodes={codes730}
          ahmMode={ahmMode}
          onAdd730={addDelay730}
          onAdd732={addDelay732}
          onRemove={removeDelay}
          onUpdateMinutes={updateDelayMinutes}
          onUpdateReason={updateDelayReason}
          isDark={isDark}
          muted={muted}
          textPrimary={textPrimary}
          cardBg={cardBg}
          cardBorder={cardBorder}
          accent={accent}
          inputBg={inputBg}
          inputBorder={inputBorder}
        />
        <DelaySection
          title="Arrival Delays"
          delays={[]}
          activeCodes={codes730}
          ahmMode={ahmMode}
          onAdd730={addDelay730}
          onAdd732={addDelay732}
          onRemove={removeDelay}
          onUpdateMinutes={updateDelayMinutes}
          onUpdateReason={updateDelayReason}
          isDark={isDark}
          muted={muted}
          textPrimary={textPrimary}
          cardBg={cardBg}
          cardBorder={cardBorder}
          accent={accent}
          inputBg={inputBg}
          inputBorder={inputBorder}
        />
      </div>
    </div>
  )
}

function ComputedDelayBanner({
  data,
  isDark,
  muted,
  accent,
}: {
  data: FlightDetail
  isDark: boolean
  muted: string
  accent: string
}) {
  const depDelayMs = data.actual.atdUtc ? data.actual.atdUtc - data.stdUtc : 0
  const arrDelayMs = data.actual.ataUtc ? data.actual.ataUtc - data.staUtc : 0
  const depMin = Math.round(depDelayMs / 60_000)
  const arrMin = Math.round(arrDelayMs / 60_000)

  if (depMin <= 0 && arrMin <= 0) return null

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <div className="text-[24px] font-bold tabular-nums" style={{ color: depMin > 0 ? '#E63535' : '#06C270' }}>
          {depMin > 0 ? `+${depMin}` : '0'}
        </div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: depMin > 0 ? '#E63535' : '#06C270' }}>
            {depMin > 0 ? 'Departure Delayed' : 'On Time'}
          </div>
          <div className="text-[11px]" style={{ color: muted }}>
            ATD vs STD ({depMin > 0 ? `${depMin} min late` : 'on time'})
          </div>
        </div>
      </div>
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <div className="text-[24px] font-bold tabular-nums" style={{ color: arrMin > 0 ? '#FF8800' : '#06C270' }}>
          {arrMin > 0 ? `+${arrMin}` : '0'}
        </div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: arrMin > 0 ? '#FF8800' : '#06C270' }}>
            {arrMin > 0 ? 'Arrival Delayed' : 'On Time'}
          </div>
          <div className="text-[11px]" style={{ color: muted }}>
            ATA vs STA ({arrMin > 0 ? `${arrMin} min late` : 'on time'})
          </div>
        </div>
      </div>
    </div>
  )
}

function DelaySection({
  title,
  delays,
  activeCodes,
  ahmMode,
  onAdd730,
  onAdd732,
  onRemove,
  onUpdateMinutes,
  onUpdateReason,
  isDark,
  muted,
  textPrimary,
  cardBg,
  cardBorder,
  accent,
  inputBg,
  inputBorder,
}: {
  title: string
  delays: FlightDetail['delays']
  activeCodes: DelayCodeRef[]
  ahmMode: AhmMode | null
  onAdd730: (code: DelayCodeRef) => void
  onAdd732: (process: string, reason: string, stakeholder: string, minutes: number) => void
  onRemove: (index: number) => void
  onUpdateMinutes: (index: number, min: number) => void
  onUpdateReason: (index: number, reason: string) => void
  isDark: boolean
  muted: string
  textPrimary: string
  cardBg: string
  cardBorder: string
  accent: string
  inputBg: string
  inputBorder: string
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  // AHM 732 form state
  const [f732Process, setF732Process] = useState('')
  const [f732Reason, setF732Reason] = useState('')
  const [f732Stakeholder, setF732Stakeholder] = useState('')
  const [f732Time, setF732Time] = useState('')

  const filtered = useMemo(() => {
    let list = activeCodes.filter((c) => c.isActive !== false)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.alphaCode && c.alphaCode.toLowerCase().includes(q)) ||
          (c.category && c.category.toLowerCase().includes(q)),
      )
    }
    return list
  }, [activeCodes, search])

  function handleAdd732() {
    if (!f732Process && !f732Reason && !f732Stakeholder) return
    const [h, m] = f732Time.split(':').map(Number)
    const mins = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
    onAdd732(f732Process, f732Reason, f732Stakeholder, mins)
    setF732Process('')
    setF732Reason('')
    setF732Stakeholder('')
    setF732Time('')
    setShowAdd(false)
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>
          {title}
        </h3>
        <button
          onClick={() => {
            if (ahmMode) setShowAdd(!showAdd)
          }}
          disabled={!ahmMode}
          className="flex items-center gap-1.5 rounded-xl text-[13px] font-medium h-8 px-3 disabled:opacity-30"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: accent }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Add delay form */}
      {showAdd && ahmMode === '730' && (
        <div className="mb-4 rounded-xl p-3" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Search size={14} style={{ color: muted }} />
            <input
              type="text"
              placeholder="Search AHM 730/731 code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="flex-1 text-[13px] bg-transparent outline-none"
              style={{ color: textPrimary }}
            />
            <span className="text-[13px] font-mono" style={{ color: muted }}>
              {filtered.length} codes
            </span>
          </div>
          <div className="max-h-[280px] overflow-y-auto space-y-0.5">
            {filtered.map((code) => {
              const color = getCategoryColor(code.category)
              return (
                <button
                  key={code._id}
                  onClick={() => {
                    onAdd730(code)
                    setShowAdd(false)
                    setSearch('')
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors"
                  style={{ color: textPrimary }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="text-[14px] font-mono font-bold w-[40px] shrink-0" style={{ color }}>
                    {code.code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{code.name}</div>
                    {code.alphaCode && (
                      <div className="text-[13px] font-mono" style={{ color: muted }}>
                        {code.alphaCode}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[13px] px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap"
                    style={{ background: `${color}15`, color }}
                  >
                    {code.category.replace(/_/g, ' ')}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="text-center py-4 text-[13px]" style={{ color: muted }}>
                No matching delay codes
              </div>
            )}
          </div>
        </div>
      )}

      {/* AHM 732 — Triple-A free-form input, single row */}
      {showAdd && ahmMode === '732' && (
        <div
          className="mb-4 rounded-xl px-3 py-2.5 flex items-end gap-2"
          style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
        >
          <div className="text-center flex-1">
            <label className="text-[13px] font-medium mb-1 block" style={{ color: muted }}>
              Process
            </label>
            <input
              type="text"
              maxLength={2}
              value={f732Process}
              onChange={(e) => setF732Process(e.target.value.toUpperCase())}
              autoFocus
              className="w-full h-[36px] text-center rounded-lg text-[15px] font-mono font-bold uppercase outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                border: `1px solid ${inputBorder}`,
                color: textPrimary,
              }}
            />
          </div>
          <div className="text-center flex-1">
            <label className="text-[13px] font-medium mb-1 block" style={{ color: muted }}>
              Reason
            </label>
            <input
              type="text"
              maxLength={2}
              value={f732Reason}
              onChange={(e) => setF732Reason(e.target.value.toUpperCase())}
              className="w-full h-[36px] text-center rounded-lg text-[15px] font-mono font-bold uppercase outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                border: `1px solid ${inputBorder}`,
                color: textPrimary,
              }}
            />
          </div>
          <div className="text-center flex-1">
            <label className="text-[13px] font-medium mb-1 block" style={{ color: muted }}>
              Stakeholder
            </label>
            <input
              type="text"
              maxLength={2}
              value={f732Stakeholder}
              onChange={(e) => setF732Stakeholder(e.target.value.toUpperCase())}
              className="w-full h-[36px] text-center rounded-lg text-[15px] font-mono font-bold uppercase outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                border: `1px solid ${inputBorder}`,
                color: textPrimary,
              }}
            />
          </div>
          <div className="text-center flex-1">
            <label className="text-[13px] font-medium mb-1 block" style={{ color: muted }}>
              Time
            </label>
            <input
              type="text"
              placeholder="HH:MM"
              value={f732Time}
              onChange={(e) => setF732Time(e.target.value)}
              className="w-full h-[36px] text-center rounded-lg text-[15px] font-mono font-bold outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                border: `1px solid ${inputBorder}`,
                color: '#E63535',
              }}
            />
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={handleAdd732}
              disabled={!f732Process && !f732Reason && !f732Stakeholder}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-30"
              style={{ background: '#06C270' }}
            >
              <Check size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ color: muted, border: `1px solid ${inputBorder}` }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* Existing delays */}
      {delays.length === 0 && !showAdd ? (
        <div className="flex items-center gap-2 py-3">
          <CheckCircle size={16} style={{ color: '#06C270' }} />
          <span className="text-[14px] font-medium" style={{ color: '#06C270' }}>
            On time
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {delays.map((d, i) => {
            const color = getCategoryColor(d.category)
            return (
              <div
                key={i}
                className="rounded-xl p-3 flex items-start gap-3 group"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderLeft: `3px solid ${color}`,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <input
                  type="number"
                  min={0}
                  value={d.minutes || ''}
                  onChange={(e) => onUpdateMinutes(i, parseInt(e.target.value) || 0)}
                  className="w-[56px] h-[36px] text-center rounded-lg text-[18px] font-mono font-bold outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: '#E63535' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-[14px]" style={{ color: textPrimary }}>
                      {d.code}
                    </span>
                    <span
                      className="text-[13px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: `${color}15`, color }}
                    >
                      {d.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={d.reason}
                    onChange={(e) => onUpdateReason(i, e.target.value)}
                    placeholder="Reason..."
                    className="w-full text-[13px] bg-transparent outline-none"
                    style={{ color: muted }}
                  />
                </div>
                <button
                  onClick={() => onRemove(i)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 shrink-0"
                >
                  <Trash2 size={14} style={{ color: '#E63535' }} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
