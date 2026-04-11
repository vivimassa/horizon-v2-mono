'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

export function AssignPopover() {
  const pop = useGanttStore((s) => s.assignPopover)
  const close = useGanttStore((s) => s.closeAssignPopover)
  const aircraft = useGanttStore((s) => s.aircraft)
  const assignToAircraft = useGanttStore((s) => s.assignToAircraft)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ registration: string; typeIcao: string } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (pop) {
      setSearch('')
      setConfirmTarget(null)
    }
  }, [pop])

  useEffect(() => {
    if (!pop) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [pop, close])

  useEffect(() => {
    if (!pop) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmTarget) setConfirmTarget(null)
        else close()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pop, close, confirmTarget])

  // Show ALL aircraft, sorted: matching type first, then others
  const available = useMemo(() => {
    if (!pop) return []
    let list = aircraft.filter((ac) => ac.status === 'active')
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (ac) =>
          ac.registration.toLowerCase().includes(q) ||
          (ac.aircraftTypeIcao && ac.aircraftTypeIcao.toLowerCase().includes(q)) ||
          (ac.homeBaseIcao && ac.homeBaseIcao.toLowerCase().includes(q)),
      )
    }
    // Sort: matching type first
    return list.sort((a, b) => {
      const aMatch = a.aircraftTypeIcao === pop.aircraftTypeIcao ? 0 : 1
      const bMatch = b.aircraftTypeIcao === pop.aircraftTypeIcao ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return a.registration.localeCompare(b.registration)
    })
  }, [pop, aircraft, search])

  async function doAssign(registration: string) {
    if (!pop || assigning) return
    setAssigning(true)
    try {
      await assignToAircraft(pop.flightIds, registration)
      setConfirmTarget(null)
      close()
    } catch (e) {
      console.error('Assign failed:', e)
    } finally {
      setAssigning(false)
    }
  }

  function handleAssign(registration: string, typeIcao: string | null) {
    if (!pop) return
    if (typeIcao && typeIcao !== pop.aircraftTypeIcao) {
      setConfirmTarget({ registration, typeIcao })
    } else {
      doAssign(registration)
    }
  }

  if (!mounted || !pop) return null

  const bg = isDark ? 'rgba(244,244,245,0.95)' : 'rgba(24,24,27,0.92)'
  const border = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const text = isDark ? '#18181b' : '#fafafa'
  const textSec = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const textMuted = isDark ? 'rgba(24,24,27,0.40)' : 'rgba(250,250,250,0.40)'
  const hoverBg = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'
  const inputBg = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)'
  const warnBg = isDark ? 'rgba(255,136,0,0.08)' : 'rgba(255,136,0,0.06)'

  const w = 320
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = pop.x + w > vpW ? vpW - w - 12 : pop.x
  const top = Math.min(pop.y, vpH - 400)
  const count = pop.flightIds.length

  return createPortal(
    <div ref={ref} data-gantt-overlay>
      <div
        className="fixed z-[9999] rounded-xl overflow-hidden"
        style={{
          left,
          top,
          width: w,
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div>
            <span className="text-[14px] font-bold" style={{ color: text }}>
              Assign Aircraft
            </span>
            <span className="text-[13px] ml-2" style={{ color: textSec }}>
              {count} flight{count > 1 ? 's' : ''} · {pop.aircraftTypeIcao}
            </span>
          </div>
          <button
            onClick={close}
            className="w-6 h-6 rounded-md flex items-center justify-center opacity-60 hover:opacity-100"
            style={{ background: inputBg }}
          >
            <X size={14} style={{ color: text }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div
            className="flex items-center gap-2 h-8 px-2.5 rounded-lg"
            style={{ background: inputBg, border: `1px solid ${border}` }}
          >
            <Search size={13} style={{ color: textMuted }} />
            <input
              type="text"
              placeholder="Search registration or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="flex-1 text-[13px] font-mono bg-transparent outline-none"
              style={{ color: text }}
            />
          </div>
        </div>

        {/* Aircraft list */}
        <div className="max-h-[280px] overflow-y-auto pb-2">
          {available.length === 0 ? (
            <div className="text-center py-4 text-[13px]" style={{ color: textMuted }}>
              No matching aircraft
            </div>
          ) : (
            available.map((ac) => {
              const isMatch = ac.aircraftTypeIcao === pop.aircraftTypeIcao
              return (
                <button
                  key={ac.id}
                  onClick={() => handleAssign(ac.registration, ac.aircraftTypeIcao)}
                  disabled={assigning}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors disabled:opacity-40"
                  style={{ color: text, background: !isMatch ? warnBg : 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = !isMatch ? warnBg : 'transparent'
                  }}
                >
                  <span className="font-mono font-bold w-[80px] text-left shrink-0">{ac.registration}</span>
                  <span className="font-mono text-left flex-1" style={{ color: isMatch ? textSec : '#FF8800' }}>
                    {ac.aircraftTypeIcao ?? ''}
                  </span>
                  {ac.homeBaseIcao && (
                    <span className="font-mono" style={{ color: textMuted }}>
                      {ac.homeBaseIcao}
                    </span>
                  )}
                  {!isMatch && <AlertTriangle size={13} style={{ color: '#FF8800' }} />}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Warning confirmation dialog for AC type mismatch */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmTarget(null)
          }}
        >
          <div
            className="rounded-2xl p-5 max-w-[400px] w-full mx-4"
            style={{
              background: isDark ? '#1F1F28' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            }}
          >
            {/* Warning accent bar */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-1 h-12 rounded-full shrink-0" style={{ background: '#FF8800' }} />
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: '#FF8800' }} />
                <div>
                  <div className="text-[15px] font-bold mb-1" style={{ color: isDark ? '#F5F2FD' : '#1C1C28' }}>
                    Aircraft Type Mismatch
                  </div>
                  <div className="text-[13px]" style={{ color: isDark ? '#8F90A6' : '#555770' }}>
                    The selected flight{count > 1 ? 's are' : ' is'} planned for{' '}
                    <span className="font-mono font-bold">{pop.aircraftTypeIcao}</span> but you are assigning{' '}
                    <span className="font-mono font-bold">{confirmTarget.registration}</span> which is{' '}
                    <span className="font-mono font-bold">{confirmTarget.typeIcao}</span>. This may affect seating
                    capacity and performance calculations.
                  </div>
                </div>
              </div>
            </div>
            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="h-9 px-4 rounded-xl text-[13px] font-medium"
                style={{
                  color: isDark ? '#8F90A6' : '#555770',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                }}
              >
                No, Cancel
              </button>
              <button
                onClick={() => doAssign(confirmTarget.registration)}
                disabled={assigning}
                className="h-9 px-4 rounded-xl text-[13px] font-bold text-white disabled:opacity-40"
                style={{ background: '#FF8800' }}
              >
                {assigning ? 'Assigning...' : 'Yes, Assign Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
