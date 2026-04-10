"use client"

import { useState, useMemo } from 'react'
import { Search, Plus } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import type { CodeshareAgreementRef } from '@skyhub/api'
import { STATUS_COLORS } from './codeshare-types'
import { AirlineLogo } from './airline-logo'

interface PartnerListPanelProps {
  agreements: CodeshareAgreementRef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewAgreement: () => void
  isDark: boolean
}

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Embedded partner list — renders inside the content glass panel, not as standalone panel. */
export function PartnerListPanel({
  agreements, selectedId, onSelect, onNewAgreement, isDark,
}: PartnerListPanelProps) {
  const [search, setSearch] = useState('')
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent

  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  const filtered = useMemo(() => {
    if (!search.trim()) return agreements
    const q = search.toLowerCase()
    return agreements.filter(a =>
      a.partnerAirlineName.toLowerCase().includes(q) ||
      a.partnerAirlineCode.toLowerCase().includes(q)
    )
  }, [agreements, search])

  return (
    <div
      className="shrink-0 w-[300px] flex flex-col overflow-hidden"
      style={{ borderRight: `1px solid ${glassBorder}` }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
          <span className="text-[14px] font-semibold flex-1" style={{ color: palette.text }}>
            Codeshare Partners
          </span>
          <span className="text-[13px] font-medium" style={{ color: palette.textSecondary }}>
            {agreements.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2"
            size={14}
            style={{ color: palette.textTertiary }}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search partners..."
            className="w-full pl-9 pr-3 h-9 rounded-xl text-[13px] outline-none"
            style={{ background: inputBg, border: `1px solid ${glassBorder}`, color: palette.text }}
          />
        </div>
      </div>

      {/* Partner list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map(a => {
          const isSelected = selectedId === a._id
          const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending

          return (
            <button
              key={a._id}
              type="button"
              onClick={() => onSelect(a._id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 text-left mb-0.5"
              style={{
                background: isSelected ? accentTint(accent, isDark ? 0.15 : 0.1) : 'transparent',
                border: isSelected ? `1px solid ${accentTint(accent, isDark ? 0.3 : 0.2)}` : '1px solid transparent',
              }}
            >
              {/* Airline logo */}
              <AirlineLogo iataCode={a.partnerAirlineCode} size={32} isDark={isDark} />

              {/* Name + code */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: palette.text }}>
                  {a.partnerAirlineName}
                </div>
                <div className="text-[13px] font-mono" style={{ color: palette.textSecondary }}>
                  {a.partnerAirlineCode}
                  {a.partnerNumericCode ? ` \u00b7 ${a.partnerNumericCode}` : ''} {/* IATA · ICAO */}
                </div>
              </div>

              {/* Status badge */}
              <span
                className="text-[13px] font-semibold px-2 py-0.5 rounded-lg shrink-0"
                style={{ background: sc.bg, color: sc.text }}
              >
                {statusLabel(a.status)}
              </span>
            </button>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center text-[13px] py-8" style={{ color: palette.textTertiary }}>
            {search ? 'No matches' : 'No agreements found'}
          </div>
        )}
      </div>

      {/* Footer — New agreement button */}
      <div className="p-3 shrink-0" style={{ borderTop: `1px solid ${glassBorder}` }}>
        <button
          type="button"
          onClick={onNewAgreement}
          className="w-full h-9 rounded-xl text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors duration-150 hover:opacity-90"
          style={{ background: accent, color: '#ffffff' }}
        >
          <Plus size={15} />
          New agreement
        </button>
      </div>
    </div>
  )
}
